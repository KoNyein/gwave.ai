import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Orders placed on my listings — the seller's side of the sale.
///
/// Everything needed to fulfil one is on the card: what was bought, where it
/// goes, and a phone number that dials. The status button only ever offers the
/// next step, so a sale moves forward with one tap and can't skip a state.
class SellerOrdersScreen extends StatefulWidget {
  const SellerOrdersScreen({super.key});

  @override
  State<SellerOrdersScreen> createState() => _SellerOrdersScreenState();
}

class _SellerOrdersScreenState extends State<SellerOrdersScreen> {
  List<ShopOrder> _orders = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await context.read<AppState>().repo.sellerOrders();
      if (mounted) setState(() => _orders = rows);
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// The one status that follows this one. Null = the order is finished, so
  /// the button disappears rather than offering a meaningless move.
  String? _next(String status) {
    switch (status) {
      case "pending":
        return "forwarded";
      case "forwarded":
        return "shipped";
      case "shipped":
        return "delivered";
      default:
        return null;
    }
  }

  String _label(String status) {
    switch (status) {
      case "forwarded":
        return tr(context, "Confirmed", "အတည်ပြုပြီး");
      case "shipped":
        return tr(context, "Shipped", "ပို့ဆောင်နေသည်");
      case "delivered":
        return tr(context, "Delivered", "ရောက်ရှိပြီး");
      case "cancelled":
        return tr(context, "Cancelled", "ပယ်ဖျက်ပြီး");
      default:
        return tr(context, "New", "အသစ်");
    }
  }

  Color _color(String status) {
    switch (status) {
      case "delivered":
        return const Color(0xFF31A24C);
      case "cancelled":
        return GwColors.live;
      case "shipped":
        return GwColors.primary;
      case "pending":
        return const Color(0xFFF7B928);
      default:
        return GwColors.inkSoft;
    }
  }

  Future<void> _move(ShopOrder order, String status) async {
    try {
      await context.read<AppState>().repo.setOrderStatus(order.id, status);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  Future<void> _cancel(ShopOrder order) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(context, "Cancel this order?", "ဤအော်ဒါကို ပယ်ဖျက်မလား")),
        content: Text(tr(
          context,
          "The buyer will see it as cancelled. This can't be undone.",
          "ဝယ်သူဘက်တွင် ပယ်ဖျက်ပြီးဟု ပြပါမည်။ ပြန်ပြင်၍ မရပါ။",
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(tr(context, "Keep", "မလုပ်တော့ပါ")),
          ),
          TextButton(
            onPressed: () => Navigator.of(d).pop(true),
            child: Text(tr(context, "Cancel order", "ပယ်ဖျက်မည်"),
                style: const TextStyle(color: GwColors.live)),
          ),
        ],
      ),
    );
    if (yes == true) await _move(order, "cancelled");
  }

  Future<void> _dial(String phone) async {
    final uri = Uri(scheme: "tel", path: phone.replaceAll(" ", ""));
    if (!await launchUrl(uri) && mounted) {
      Clipboard.setData(ClipboardData(text: phone));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Number copied", "ဖုန်းနံပါတ် ကူးပြီးပါပြီ")),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = _orders
        .where((o) => o.status != "delivered" && o.status != "cancelled")
        .length;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "My sales", "ကျွန်ုပ်၏ အရောင်း")),
        bottom: open == 0
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(26),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    tr(context, "$open to handle", "ဆောင်ရွက်ရန် $open ခု"),
                    style: const TextStyle(
                        color: GwColors.primary,
                        fontWeight: FontWeight.w700,
                        fontSize: 13),
                  ),
                ),
              ),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _orders.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                      icon: Icons.storefront_outlined,
                      title: tr(context, "No orders yet", "အော်ဒါ မရှိသေးပါ"),
                      subtitle: _error ??
                          tr(
                            context,
                            "Orders on your listings show up here.",
                            "သင့်ပစ္စည်းများအတွက် အော်ဒါများ ဤနေရာတွင် ပေါ်ပါမည်။",
                          ),
                    ),
                  ])
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 24),
                    itemCount: _orders.length,
                    itemBuilder: (_, i) => _card(_orders[i]),
                  ),
      ),
    );
  }

  Widget _card(ShopOrder o) {
    final next = _next(o.status);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(GwRadius.sm),
                  child: SizedBox(
                    width: 52,
                    height: 52,
                    child: o.productImage != null && o.productImage!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: resolveMedia(o.productImage,
                                    bucket: "media") ??
                                o.productImage!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => _ph(),
                            placeholder: (_, __) => _ph(),
                          )
                        : _ph(),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        o.productTitle ??
                            tr(context, "Removed product", "ဖျက်ပြီးသား ပစ္စည်း"),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                      const SizedBox(height: 3),
                      Text("×${o.quantity} · ${money(o.total, o.currency)}",
                          style: const TextStyle(fontSize: 13)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(_label(o.status),
                        style: TextStyle(
                            color: _color(o.status),
                            fontWeight: FontWeight.w800,
                            fontSize: 12.5)),
                    const SizedBox(height: 3),
                    Text(timeAgo(o.createdAt),
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 11)),
                  ],
                ),
              ],
            ),
            const Divider(height: 20),
            _line(Icons.person_outline, o.shipName),
            if (o.shipPhone != null && o.shipPhone!.isNotEmpty)
              InkWell(
                onTap: () => _dial(o.shipPhone!),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      const Icon(Icons.phone_outlined,
                          size: 15, color: GwColors.primary),
                      const SizedBox(width: 8),
                      Text(o.shipPhone!,
                          style: const TextStyle(
                              color: GwColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                    ],
                  ),
                ),
              ),
            _line(Icons.location_on_outlined, o.shipAddress),
            if (o.note != null && o.note!.trim().isNotEmpty)
              _line(Icons.sticky_note_2_outlined, o.note),
            // A finished order — delivered or cancelled — has no next step, so
            // it gets no button row at all rather than a dead one.
            if (next != null) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => _move(o, next),
                      child: Text(_action(next)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: () => _cancel(o),
                    style:
                        OutlinedButton.styleFrom(foregroundColor: GwColors.live),
                    child: Text(tr(context, "Cancel", "ပယ်ဖျက်")),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// What tapping the button does, phrased as the seller's next action rather
  /// than the status name it writes.
  String _action(String next) {
    switch (next) {
      case "forwarded":
        return tr(context, "Confirm order", "အော်ဒါ လက်ခံမည်");
      case "shipped":
        return tr(context, "Mark as shipped", "ပို့ပြီးဟု မှတ်မည်");
      default:
        return tr(context, "Mark as delivered", "ရောက်ပြီဟု မှတ်မည်");
    }
  }

  Widget _line(IconData icon, String? text) {
    if (text == null || text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 15, color: GwColors.inkSoftOf(context)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text.trim(),
                style: const TextStyle(fontSize: 13, height: 1.35)),
          ),
        ],
      ),
    );
  }

  Widget _ph() => Container(
        color: GwColors.surfaceMuted,
        child: const Center(
          child: Icon(Icons.image_outlined, color: GwColors.line, size: 20),
        ),
      );
}
