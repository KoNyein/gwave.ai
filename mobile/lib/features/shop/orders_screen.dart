import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// The buyer's own orders and where each one has got to.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
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
      final rows = await context.read<AppState>().repo.myOrders();
      if (mounted) setState(() => _orders = rows);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Colour the status so "delivered" and "cancelled" read at a glance.
  Color _statusColor(String status) {
    switch (status) {
      case "delivered":
        return const Color(0xFF31A24C);
      case "cancelled":
        return GwColors.live;
      case "shipped":
        return GwColors.primary;
      default:
        return GwColors.inkSoft;
    }
  }

  String _statusLabel(BuildContext context, String status) {
    switch (status) {
      case "forwarded":
        return tr(context, "Sent to seller", "ရောင်းသူထံ ပို့ပြီး");
      case "shipped":
        return tr(context, "Shipped", "ပို့ဆောင်နေသည်");
      case "delivered":
        return tr(context, "Delivered", "ရောက်ရှိပြီး");
      case "cancelled":
        return tr(context, "Cancelled", "ပယ်ဖျက်ပြီး");
      default:
        return tr(context, "Pending", "စောင့်ဆိုင်းဆဲ");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "My orders", "ကျွန်ုပ်၏ အော်ဒါများ"))),
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
                      icon: Icons.receipt_long_outlined,
                      title: tr(context, "No orders yet", "အော်ဒါ မရှိသေးပါ"),
                      subtitle: _error,
                    ),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: _orders.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 84),
                    itemBuilder: (_, i) {
                      final o = _orders[i];
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(GwRadius.sm),
                          child: SizedBox(
                            width: 56,
                            height: 56,
                            child: o.productImage != null &&
                                    o.productImage!.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: o.productImage!,
                                    fit: BoxFit.cover,
                                    errorWidget: (_, __, ___) => _ph(),
                                    placeholder: (_, __) => _ph(),
                                  )
                                : _ph(),
                          ),
                        ),
                        title: Text(
                          o.productTitle ??
                              tr(context, "Removed product", "ဖျက်ပြီးသား ပစ္စည်း"),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 14),
                        ),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            "×${o.quantity} · ${money(o.total, o.currency)}",
                            style: const TextStyle(fontSize: 13),
                          ),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              _statusLabel(context, o.status),
                              style: TextStyle(
                                  color: _statusColor(o.status),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12.5),
                            ),
                            const SizedBox(height: 4),
                            Text(timeAgo(o.createdAt),
                                style: const TextStyle(
                                    color: GwColors.inkSoft, fontSize: 11)),
                          ],
                        ),
                      );
                    },
                  ),
      ),
    );
  }

  Widget _ph() => Container(
        color: GwColors.surfaceMuted,
        child: const Center(
          child: Icon(Icons.image_outlined, color: GwColors.line, size: 22),
        ),
      );
}
