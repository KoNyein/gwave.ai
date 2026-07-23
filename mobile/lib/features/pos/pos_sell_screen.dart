import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
/// store, tap products into the cart, and charge (cash) through the same
/// `create_sale` RPC the web uses, which validates the open shift, claims the
/// receipt number and writes stock movements atomically.
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
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(context, "Charge (cash)", "ငွေရှင်းမည် (cash)")),
        content: Text("$_count ${tr(context, "items", "ခု")} — ${money(total, store.currency)}"),
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

    setState(() => _charging = true);
    try {
      final receipt = await context.read<AppState>().repo.createSale(
            storeId: store.id,
            items: [
              for (final e in _cart.entries)
                (productId: e.key, quantity: e.value),
            ],
            total: total,
          );
      if (!mounted) return;
      setState(() => _cart.clear());
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.check_circle,
              color: GwColors.primary, size: 44),
          title: Text(tr(context, "Sale complete", "ရောင်းပြီးပါပြီ")),
          content: Text(receipt != null
              ? "${tr(context, "Receipt", "ဘောင်ချာနံပါတ်")} #$receipt\n${money(total, store.currency)}"
              : money(total, store.currency)),
          actions: [
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

  /// Selling needs an open shift; opening one (with a cash float) lives in the
  /// web POS back-office for now.
  Future<void> _shiftDialog() async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: Icon(Icons.schedule, color: GwColors.gold, size: 40),
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
                        ? SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                valueColor:
                                    AlwaysStoppedAnimation(GwColors.onPrimary)))
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
          ? Center(
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
                                      Icon(Icons.storefront_outlined,
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
          color: GwColors.surface,
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
                            style: TextStyle(
                                color: GwColors.onPrimary,
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
                      style: TextStyle(
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
        color: GwColors.surfaceMuted,
        child: Center(
          child: Icon(Icons.inventory_2_outlined,
              color: GwColors.inkSoft, size: 26),
        ),
      );

  Widget _noStore() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.storefront_outlined,
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
              style: TextStyle(color: GwColors.inkSoft, fontSize: 13.5),
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
