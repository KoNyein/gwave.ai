import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// One product, with the action that actually matches its kind:
/// a dropship listing checks out in-app, an affiliate listing hands off to the
/// merchant (and says so, instead of pretending our copied price is binding).
class ProductScreen extends StatelessWidget {
  const ProductScreen({super.key, required this.product});
  final ShopProduct product;

  Future<void> _openMerchant(BuildContext context) async {
    final url = product.externalUrl;
    if (url == null || url.isEmpty) return;
    // Fire-and-forget: the click stat must never delay the handoff.
    context.read<AppState>().repo.recordAffiliateClick(product.id);
    await openWeb(context, url, title: product.title);
  }

  Future<void> _buy(BuildContext context) async {
    final ordered = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => _CheckoutScreen(product: product)),
    );
    if (ordered == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Order placed.", "အော်ဒါ တင်ပြီးပါပြီ။")),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final merchant = product.merchant?.trim();
    return Scaffold(
      appBar: AppBar(title: Text(product.title, maxLines: 1)),
      body: ListView(
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: product.imageUrl != null && product.imageUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: product.imageUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _ph(),
                    placeholder: (_, __) => _ph(),
                  )
                : _ph(),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.title,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800, height: 1.25)),
                const SizedBox(height: 12),
                if (product.hasOwnPrice)
                  Text(money(product.price, product.currency),
                      style: const TextStyle(
                          color: GwColors.primary,
                          fontSize: 24,
                          fontWeight: FontWeight.w900))
                else ...[
                  Text(
                    product.price != null
                        ? "~ ${money(product.price, product.currency)}"
                        : tr(context, "Price at merchant",
                            "စျေးနှုန်း — ရောင်းသူဆီတွင်"),
                    style: const TextStyle(
                        color: GwColors.primary,
                        fontSize: 20,
                        fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr(
                      context,
                      "Indicative only — ${merchant ?? "the merchant"} sets the "
                          "final price and stock.",
                      "ခန့်မှန်းသာ — အတိအကျစျေးနှုန်းနှင့် ပစ္စည်းရှိမရှိကို "
                          "${merchant ?? "ရောင်းသူ"} ဘက်တွင် စစ်ပါ။",
                    ),
                    style: const TextStyle(
                        color: GwColors.inkSoft, fontSize: 12.5, height: 1.35),
                  ),
                ],
                if (merchant != null && merchant.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(Icons.storefront_outlined,
                          size: 16, color: GwColors.inkSoft),
                      const SizedBox(width: 6),
                      Text(merchant,
                          style: const TextStyle(
                              color: GwColors.inkSoft,
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
                if (product.description != null &&
                    product.description!.trim().isNotEmpty) ...[
                  const SizedBox(height: 18),
                  Text(product.description!.trim(),
                      style: const TextStyle(fontSize: 14, height: 1.45)),
                ],
                const SizedBox(height: 90),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: product.isAffiliate
            ? OutlinedButton.icon(
                onPressed: () => _openMerchant(context),
                icon: const Icon(Icons.open_in_new),
                label: Text(merchant != null && merchant.isNotEmpty
                    ? tr(context, "View on $merchant", "$merchant တွင် ကြည့်ရန်")
                    : tr(context, "View on merchant", "ရောင်းသူဆီ သွားရန်")),
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
              )
            : ElevatedButton.icon(
                onPressed: () => _buy(context),
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(tr(context, "Buy now", "ဝယ်မည်")),
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
              ),
      ),
    );
  }

  Widget _ph() => Container(
        color: GwColors.surfaceMuted,
        child: const Center(
          child: Icon(Icons.image_outlined, color: GwColors.line, size: 48),
        ),
      );
}

/// Quantity + delivery details for a dropship order. The price and the seller
/// come from the server RPC, never from here.
class _CheckoutScreen extends StatefulWidget {
  const _CheckoutScreen({required this.product});
  final ShopProduct product;

  @override
  State<_CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<_CheckoutScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _note = TextEditingController();
  int _qty = 1;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<AppState>().me;
    if (me != null) _name.text = me.displayName;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_name.text.trim().isEmpty ||
        _phone.text.trim().isEmpty ||
        _address.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Name, phone and address are required.",
            "အမည်၊ ဖုန်းနှင့် လိပ်စာ ဖြည့်ပါ။")),
      ));
      return;
    }
    setState(() => _saving = true);
    try {
      await context.read<AppState>().repo.placeDropshipOrder(
            productId: widget.product.id,
            quantity: _qty,
            name: _name.text,
            phone: _phone.text,
            address: _address.text,
            note: _note.text,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final total = (p.price ?? 0) * _qty;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Checkout", "ဝယ်ယူရန်"))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(p.title,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
          const SizedBox(height: 14),
          Row(
            children: [
              Text(tr(context, "Quantity", "အရေအတွက်"),
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: _qty > 1 ? () => setState(() => _qty--) : null,
              ),
              Text("$_qty",
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800)),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: _qty < 999 ? () => setState(() => _qty++) : null,
              ),
            ],
          ),
          const Divider(),
          Row(
            children: [
              Text(tr(context, "Total", "စုစုပေါင်း"),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text(money(total, p.currency),
                  style: const TextStyle(
                      color: GwColors.primary,
                      fontSize: 18,
                      fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _name,
            decoration: InputDecoration(
                labelText: tr(context, "Full name", "အမည်"),
                prefixIcon: const Icon(Icons.person_outline)),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
                labelText: tr(context, "Phone", "ဖုန်းနံပါတ်"),
                prefixIcon: const Icon(Icons.phone_outlined)),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _address,
            maxLines: 3,
            decoration: InputDecoration(
                labelText: tr(context, "Delivery address", "ပို့ဆောင်ရန် လိပ်စာ"),
                alignLabelWithHint: true),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _note,
            maxLines: 2,
            decoration: InputDecoration(
                labelText: tr(context, "Note (optional)", "မှတ်ချက် (ရွေးချယ်)"),
                alignLabelWithHint: true),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _saving ? null : _submit,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50)),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(tr(context, "Place order", "အော်ဒါတင်မည်")),
          ),
          const SizedBox(height: 10),
          Text(
            tr(
              context,
              "You'll pay on delivery. The seller confirms stock and shipping.",
              "ပစ္စည်းရောက်မှ ငွေချေရပါမည်။ ပစ္စည်းရှိမရှိနှင့် ပို့ဆောင်မှုကို "
                  "ရောင်းသူက အတည်ပြုပါမည်။",
            ),
            style: const TextStyle(
                color: GwColors.inkSoft, fontSize: 12.5, height: 1.35),
          ),
        ],
      ),
    );
  }
}
