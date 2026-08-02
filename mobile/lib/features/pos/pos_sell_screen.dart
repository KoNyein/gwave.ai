import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Native POS Sell — the web `/pos/sell` counter as a phone screen: pick a
/// store, tap products into the cart, and charge through the same
/// `create_sale` RPC the web uses, which validates the open shift, claims the
/// receipt number and writes stock movements atomically.
///
/// Tenders: cash, real G-Pay (customer phone + PIN through pos_settle_gpay),
/// and a G-Pay QR the customer scans to pay. After the sale the receipt can be
/// printed as an 80mm ticket via the system print dialog (Bluetooth/WiFi
/// receipt printers, save as PDF, share).
class PosSellScreen extends StatefulWidget {
  const PosSellScreen({super.key});

  @override
  State<PosSellScreen> createState() => _PosSellScreenState();
}

class _PosSellScreenState extends State<PosSellScreen> {
  List<PosStore> _stores = [];
  PosStore? _store;
  List<PosProduct> _products = [];
  final Map<String, int> _cart = {}; // productId → qty
  bool _loading = true;
  bool _charging = false;
  String? _error;
  String _search = "";

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<AppState>().repo;
      final stores = await repo.myStores();
      PosStore? store = stores.isNotEmpty ? stores.first : null;
      List<PosProduct> products = [];
      if (store != null) products = await repo.posProducts(store.id);
      if (mounted) {
        setState(() {
          _stores = stores;
          _store = store;
          _products = products;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _switchStore(PosStore s) async {
    setState(() {
      _store = s;
      _cart.clear();
      _loading = true;
    });
    try {
      final products =
          await context.read<AppState>().repo.posProducts(s.id);
      if (mounted) setState(() => _products = products);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double get _total {
    double t = 0;
    for (final p in _products) {
      final qty = _cart[p.id] ?? 0;
      t += p.price * qty;
    }
    return t;
  }

  int get _count => _cart.values.fold(0, (a, b) => a + b);

  void _add(PosProduct p) =>
      setState(() => _cart[p.id] = (_cart[p.id] ?? 0) + 1);

  void _remove(PosProduct p) {
    setState(() {
      final q = (_cart[p.id] ?? 0) - 1;
      if (q <= 0) {
        _cart.remove(p.id);
      } else {
        _cart[p.id] = q;
      }
    });
  }

  Future<void> _charge() async {
    final store = _store;
    if (store == null || _cart.isEmpty || _charging) return;
    final total = _total;

    // 1) Pick the tender.
    final method = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: GwColors.bgOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
              child: Text(
                "$_count ${tr(ctx, "items", "ခု")} — ${money(total, store.currency)}",
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 17),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.payments_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "Cash", "ငွေသား")),
              onTap: () => Navigator.of(ctx).pop("cash"),
            ),
            ListTile(
              leading: const Icon(Icons.qr_code_2, color: GwColors.primary),
              title: Text(tr(ctx, "G-Pay QR (customer scans)",
                  "G-Pay QR (ဝယ်သူ scan ဖတ်၍ပေး)")),
              onTap: () => Navigator.of(ctx).pop("qr"),
            ),
            ListTile(
              leading: const Icon(Icons.account_balance_wallet_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "G-Pay (phone + PIN)",
                  "G-Pay (ဖုန်း + PIN ဖြင့်)")),
              onTap: () => Navigator.of(ctx).pop("gpay"),
            ),
            const SizedBox(height: 6),
          ],
        ),
      ),
    );
    if (method == null || !mounted) return;

    // 2) Collect / confirm the payment for the chosen tender.
    if (method == "qr") {
      final paid = await _showQrPayment(store, total);
      if (paid != true) return;
    } else if (method == "gpay") {
      final settled = await _collectGpay(store, total);
      if (settled != true) return;
    } else {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(tr(context, "Charge (cash)", "ငွေရှင်းမည် (cash)")),
          content: Text(
              "$_count ${tr(context, "items", "ခု")} — ${money(total, store.currency)}"),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(tr(context, "Cancel", "မလုပ်တော့ပါ"))),
            ElevatedButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: Text(tr(context, "Charge", "ရှင်းမည်"))),
          ],
        ),
      );
      if (ok != true) return;
    }
    if (!mounted) return;

    // 3) Record the sale (stock + receipt number) and offer a printed ticket.
    setState(() => _charging = true);
    // Snapshot the lines before the cart clears, for the printed receipt.
    final lines = [
      for (final e in _cart.entries)
        if (_productById(e.key) != null)
          (product: _productById(e.key)!, quantity: e.value),
    ];
    try {
      final receipt = await context.read<AppState>().repo.createSale(
            storeId: store.id,
            items: [
              for (final e in _cart.entries)
                (productId: e.key, quantity: e.value),
            ],
            total: total,
            method: method,
          );
      if (!mounted) return;
      setState(() => _cart.clear());
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          icon: const Icon(Icons.check_circle,
              color: GwColors.primary, size: 44),
          title: Text(tr(context, "Sale complete", "ရောင်းပြီးပါပြီ")),
          content: Text(receipt != null
              ? "${tr(context, "Receipt", "ဘောင်ချာနံပါတ်")} #$receipt\n${money(total, store.currency)}"
              : money(total, store.currency)),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                _printReceipt(
                  store: store,
                  receipt: receipt,
                  lines: lines,
                  total: total,
                  method: method,
                );
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.print_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(tr(ctx, "Print", "Print ထုတ်မည်")),
                ],
              ),
            ),
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text("OK")),
          ],
        ),
      );
    } catch (e) {
      final msg = e.toString();
      if (mounted) {
        if (msg.contains("No open shift")) {
          _shiftDialog();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("${tr(context, "Couldn't charge", "မရောင်းနိုင်ပါ")} — $msg")),
          );
        }
      }
    } finally {
      if (mounted) setState(() => _charging = false);
    }
  }

  PosProduct? _productById(String id) {
    for (final p in _products) {
      if (p.id == id) return p;
    }
    return null;
  }

  /// Show the store's G-Pay QR for the amount; the customer scans it with
  /// their app (G-Pay → Scan) and sends the money. The seller confirms once
  /// the transfer notification arrives.
  Future<bool?> _showQrPayment(PosStore store, double total) async {
    final acc = await context.read<AppState>().repo.myGpayAccount();
    if (!mounted) return false;
    final phone = acc?.phone ?? "";
    if (phone.isEmpty || acc?.isActive != true) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(
            context,
            "You need an active G-Pay wallet to receive QR payments.",
            "QR ဖြင့် ငွေလက်ခံရန် သင့်မှာ active G-Pay wallet ရှိရပါမည်။")),
      ));
      return false;
    }
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Scan to pay", "Scan ဖတ်၍ ငွေပေးရန်")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: QrImageView(data: "gpay:$phone", size: 190),
            ),
            const SizedBox(height: 10),
            Text(
              money(total, store.currency),
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: GwColors.primary),
            ),
            const SizedBox(height: 6),
            Text(
              tr(
                  ctx,
                  "Customer: open Gwave → G-Pay → Scan, send the amount, then show you the confirmation.",
                  "ဝယ်သူ — Gwave app ထဲ G-Pay → Scan ဖွင့်ပြီး ပမာဏ ပေးပို့ပါ။ ပို့ပြီးကြောင်း အတည်ပြုချက်ကို ပြပါစေ။"),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, color: GwColors.inkSoftOf(context)),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(
                  tr(ctx, "Payment received", "ငွေလက်ခံရရှိပြီ"))),
        ],
      ),
    );
  }

  /// Real G-Pay settlement at the counter: the customer gives their wallet
  /// phone and authorises with their own PIN; pos_settle_gpay moves the money.
  Future<bool?> _collectGpay(PosStore store, double total) async {
    final phoneCtl = TextEditingController();
    final pinCtl = TextEditingController();
    try {
      return await showDialog<bool>(
        context: context,
        builder: (ctx) {
          bool busy = false;
          String? err;
          return StatefulBuilder(
            builder: (ctx, setDlg) => AlertDialog(
              title: Text(tr(ctx, "G-Pay payment", "G-Pay ဖြင့် ရှင်းမည်")),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(money(total, store.currency),
                      style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w900,
                          color: GwColors.primary)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneCtl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: tr(ctx, "Customer G-Pay phone",
                          "ဝယ်သူ G-Pay ဖုန်းနံပါတ်"),
                      prefixIcon: const Icon(Icons.phone_outlined),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: pinCtl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    decoration: InputDecoration(
                      labelText: tr(ctx, "Customer PIN (they type it)",
                          "ဝယ်သူ PIN (ဝယ်သူကိုယ်တိုင် ရိုက်ရန်)"),
                      prefixIcon: const Icon(Icons.password),
                      counterText: "",
                    ),
                  ),
                  if (err != null) ...[
                    const SizedBox(height: 8),
                    Text(err!,
                        style: const TextStyle(
                            color: GwColors.live, fontSize: 12.5)),
                  ],
                ],
              ),
              actions: [
                TextButton(
                    onPressed:
                        busy ? null : () => Navigator.of(ctx).pop(false),
                    child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
                ElevatedButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setDlg(() {
                            busy = true;
                            err = null;
                          });
                          try {
                            await context.read<AppState>().repo.posSettleGpay(
                                  storeId: store.id,
                                  customerPhone: phoneCtl.text.trim(),
                                  amount: total,
                                  pin: pinCtl.text.trim(),
                                );
                            if (ctx.mounted) Navigator.of(ctx).pop(true);
                          } catch (e) {
                            setDlg(() {
                              busy = false;
                              err = e.toString();
                            });
                          }
                        },
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : Text(tr(ctx, "Take payment", "ငွေကောက်ခံမည်")),
                ),
              ],
            ),
          );
        },
      );
    } finally {
      phoneCtl.dispose();
      pinCtl.dispose();
    }
  }

  /// Build an 80mm receipt PDF and hand it to the system print dialog.
  Future<void> _printReceipt({
    required PosStore store,
    required int? receipt,
    required List<({PosProduct product, int quantity})> lines,
    required double total,
    required String method,
  }) async {
    try {
      // Padauk covers Burmese product/store names; bundled so printing works
      // offline at the counter.
      final fontData = await rootBundle.load("assets/Padauk-Regular.ttf");
      final font = pw.Font.ttf(fontData);
      final bold = pw.TextStyle(
          font: font, fontSize: 11, fontWeight: pw.FontWeight.bold);
      final normal = pw.TextStyle(font: font, fontSize: 9.5);
      final now = DateTime.now();
      final stamp =
          "${now.year}-${now.month.toString().padLeft(2, "0")}-${now.day.toString().padLeft(2, "0")} "
          "${now.hour.toString().padLeft(2, "0")}:${now.minute.toString().padLeft(2, "0")}";

      final doc = pw.Document();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.roll80,
          build: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.stretch,
            children: [
              pw.Center(
                  child: pw.Text(store.name,
                      style: pw.TextStyle(
                          font: font,
                          fontSize: 14,
                          fontWeight: pw.FontWeight.bold))),
              pw.SizedBox(height: 2),
              pw.Center(child: pw.Text("Gwave POS", style: normal)),
              pw.SizedBox(height: 6),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(receipt != null ? "Receipt #$receipt" : "Receipt",
                      style: normal),
                  pw.Text(stamp, style: normal),
                ],
              ),
              pw.Divider(),
              for (final l in lines)
                pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 2),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Expanded(
                          child: pw.Text(
                              "${l.product.name} × ${l.quantity}",
                              style: normal)),
                      pw.Text(
                          money(l.product.price * l.quantity, store.currency),
                          style: normal),
                    ],
                  ),
                ),
              pw.Divider(),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text("TOTAL", style: bold),
                  pw.Text(money(total, store.currency), style: bold),
                ],
              ),
              pw.SizedBox(height: 2),
              pw.Text("Paid: ${method.toUpperCase()}", style: normal),
              pw.SizedBox(height: 8),
              pw.Center(
                  child:
                      pw.Text("ကျေးဇူးတင်ပါသည် — Thank you!", style: normal)),
            ],
          ),
        ),
      );
      await Printing.layoutPdf(
        onLayout: (_) => doc.save(),
        name: receipt != null ? "receipt-$receipt.pdf" : "receipt.pdf",
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't print — $e")),
        );
      }
    }
  }

  /// Selling needs an open shift; opening one (with a cash float) lives in the
  /// web POS back-office for now.
  Future<void> _shiftDialog() async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.schedule, color: GwColors.gold, size: 40),
        title: Text(tr(context, "No open shift", "Shift မဖွင့်ရသေးပါ")),
        content: Text(tr(context, "Open today's shift (set the cash float) before selling.", "မရောင်းခင် ဒီနေ့အတွက် shift အရင်ဖွင့်ပါ (cash float သတ်မှတ်ရန်)။")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(tr(context, "Later", "နောက်မှ"))),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _openWeb("/pos/shifts");
            },
            child: Text(tr(context, "Open shift", "Shift ဖွင့်ရန်")),
          ),
        ],
      ),
    );
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    final store = _store;
    final filtered = _search.trim().isEmpty
        ? _products
        : _products
            .where((p) =>
                p.name.toLowerCase().contains(_search.trim().toLowerCase()) ||
                (p.sku ?? "").toLowerCase().contains(_search.trim().toLowerCase()))
            .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text("POS — Sell"),
        actions: [
          IconButton(
            tooltip: "Receipts",
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => _openWeb("/pos/receipts"),
          ),
        ],
      ),
      bottomNavigationBar: _cart.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: SizedBox(
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _charging ? null : _charge,
                    child: _charging
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                valueColor:
                                    AlwaysStoppedAnimation(Colors.white)))
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text("🛒 $_count",
                                  style: const TextStyle(fontSize: 15)),
                              Text(
                                  "${tr(context, "Charge", "ရှင်းမည်")} — ${money(_total, store?.currency ?? "")}",
                                  style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800)),
                            ],
                          ),
                  ),
                ),
              ),
            ),
      body: _loading && _products.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: GwColors.primary))
          : _error != null && _stores.isEmpty
              ? GwEmpty(
                  icon: Icons.cloud_off,
                  title: "Couldn't load POS",
                  subtitle: _error)
              : _stores.isEmpty
                  ? _noStore()
                  : Column(
                      children: [
                        // Store picker + search
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                          child: Row(
                            children: [
                              if (_stores.length > 1)
                                Expanded(
                                  child: DropdownButtonFormField<String>(
                                    value: store?.id,
                                    items: [
                                      for (final s in _stores)
                                        DropdownMenuItem(
                                            value: s.id, child: Text(s.name)),
                                    ],
                                    onChanged: (id) {
                                      final s = _stores
                                          .where((x) => x.id == id)
                                          .firstOrNull;
                                      if (s != null) _switchStore(s);
                                    },
                                    decoration: const InputDecoration(
                                      prefixIcon:
                                          Icon(Icons.storefront_outlined),
                                    ),
                                  ),
                                )
                              else
                                Expanded(
                                  child: Row(
                                    children: [
                                      const Icon(Icons.storefront_outlined,
                                          color: GwColors.primary, size: 20),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(store?.name ?? "",
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 16)),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
                          child: TextField(
                            onChanged: (v) => setState(() => _search = v),
                            decoration: InputDecoration(
                              hintText: tr(context, "Search products / SKU…", "ပစ္စည်း / SKU ရှာရန်…"),
                              prefixIcon: Icon(Icons.search),
                              isDense: true,
                            ),
                          ),
                        ),
                        Expanded(
                          child: filtered.isEmpty
                              ? GwEmpty(
                                  icon: Icons.inventory_2_outlined,
                                  title: tr(context, "No products yet",
                                      "ပစ္စည်း မရှိသေးပါ"),
                                  subtitle: tr(
                                      context,
                                      "Add products in Inventory first.",
                                      "Inventory ထဲမှာ ပစ္စည်း အရင်ထည့်ပါ။"),
                                )
                              : GridView.builder(
                                  padding: const EdgeInsets.fromLTRB(
                                      16, 4, 16, 90),
                                  gridDelegate:
                                      const SliverGridDelegateWithFixedCrossAxisCount(
                                    crossAxisCount: 3,
                                    mainAxisSpacing: 10,
                                    crossAxisSpacing: 10,
                                    childAspectRatio: 0.74,
                                  ),
                                  itemCount: filtered.length,
                                  itemBuilder: (_, i) =>
                                      _productTile(filtered[i], store!),
                                ),
                        ),
                      ],
                    ),
    );
  }

  Widget _productTile(PosProduct p, PosStore store) {
    final qty = _cart[p.id] ?? 0;
    final img = resolveMedia(p.imagePath, bucket: "media");
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => _add(p),
      child: Container(
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
          boxShadow: GwShadow.card,
          border: qty > 0
              ? Border.all(color: GwColors.primary, width: 1.6)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(GwRadius.md)),
                      child: img != null
                          ? CachedNetworkImage(
                              imageUrl: img,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => _ph(),
                              placeholder: (_, __) => _ph(),
                            )
                          : _ph(),
                    ),
                  ),
                  if (qty > 0)
                    Positioned(
                      top: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: GwColors.primary,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Text("×$qty",
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 12)),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 12.5)),
                  Text(money(p.price, store.currency),
                      style: const TextStyle(
                          color: GwColors.primaryDark,
                          fontWeight: FontWeight.w800,
                          fontSize: 12)),
                ],
              ),
            ),
            if (qty > 0)
              Padding(
                padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
                child: Row(
                  children: [
                    _qtyBtn(Icons.remove, () => _remove(p)),
                    Expanded(
                      child: Text("$qty",
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 13)),
                    ),
                    _qtyBtn(Icons.add, () => _add(p)),
                  ],
                ),
              )
            else
              const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }

  Widget _qtyBtn(IconData icon, VoidCallback onTap) => InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: GwColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 16, color: GwColors.primary),
        ),
      );

  Widget _ph() => Container(
        color: GwColors.surfaceMutedOf(context),
        child: Center(
          child: Icon(Icons.inventory_2_outlined,
              color: GwColors.inkSoftOf(context), size: 26),
        ),
      );

  Widget _noStore() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.storefront_outlined,
                size: 56, color: GwColors.primary),
            const SizedBox(height: 14),
            Text(tr(context, "No store yet", "ဆိုင် မရှိသေးပါ"),
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(
              tr(
                  context,
                  "Create a store first — store setup and products live in "
                      "the web POS.",
                  "POS သုံးဖို့ ဆိုင်တစ်ခု အရင်ဖွင့်ပါ — ဆိုင်ဖွင့်ခြင်း၊ "
                      "ပစ္စည်း ထည့်ခြင်းကို web POS မှာ လုပ်နိုင်ပါတယ်။"),
              textAlign: TextAlign.center,
              style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 13.5),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () => _openWeb("/pos"),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: Text(tr(context, "Open web POS", "POS ဖွင့်ရန်")),
            ),
          ],
        ),
      ),
    );
  }
}
