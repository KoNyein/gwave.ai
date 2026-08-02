import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'product_screen.dart';
import 'seller_orders_screen.dart';
import 'sell_screen.dart';

/// What I have for sale. Hidden listings are shown too, greyed — a seller who
/// can't see what they've taken down can't put it back.
class MyListingsScreen extends StatefulWidget {
  const MyListingsScreen({super.key});

  @override
  State<MyListingsScreen> createState() => _MyListingsScreenState();
}

class _MyListingsScreenState extends State<MyListingsScreen> {
  List<ShopProduct> _items = [];
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
      final rows = await context.read<AppState>().repo.myListings();
      if (mounted) setState(() => _items = rows);
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sell() async {
    final made = await Navigator.of(context).push<ShopProduct>(
      MaterialPageRoute(builder: (_) => const SellScreen()),
    );
    if (made != null) await _load();
  }

  Future<void> _toggle(ShopProduct p) async {
    final next = p.status == "active" ? "hidden" : "active";
    try {
      await context.read<AppState>().repo.setProductStatus(p.id, next);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  Future<void> _delete(ShopProduct p) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(context, "Delete this listing?", "ဤပစ္စည်းကို ဖျက်မလား")),
        content: Text(tr(
          context,
          "Hiding it keeps past orders tidy. Deleting is permanent.",
          "ဖျောက်ထားလျှင် အော်ဒါဟောင်းများ အဆင်ပြေပါသည်။ ဖျက်လျှင် ပြန်မရပါ။",
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(tr(context, "Keep", "မဖျက်တော့ပါ")),
          ),
          TextButton(
            onPressed: () => Navigator.of(d).pop(true),
            child: Text(tr(context, "Delete", "ဖျက်မည်"),
                style: const TextStyle(color: GwColors.live)),
          ),
        ],
      ),
    );
    if (yes != true) return;
    try {
      await context.read<AppState>().repo.deleteProduct(p.id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "My listings", "ကျွန်ုပ်၏ ပစ္စည်းများ")),
        actions: [
          IconButton(
            tooltip: tr(context, "My sales", "ကျွန်ုပ်၏ အရောင်း"),
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const SellerOrdersScreen())),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _sell,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Sell", "ရောင်းမည်")),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _items.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                      icon: Icons.sell_outlined,
                      title: tr(context, "Nothing listed yet",
                          "ရောင်းစရာ မရှိသေးပါ"),
                      subtitle: _error ??
                          tr(
                            context,
                            "Tap Sell to put your first item in the shop.",
                            "“ရောင်းမည်” ကို နှိပ်၍ ပထမဆုံး ပစ္စည်း တင်ပါ။",
                          ),
                    ),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.only(bottom: 90),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, indent: 78),
                    itemBuilder: (_, i) => _row(_items[i]),
                  ),
      ),
    );
  }

  Widget _row(ShopProduct p) {
    final hidden = p.status != "active";
    final cover = p.gallery.isEmpty ? null : p.gallery.first;
    return Opacity(
      opacity: hidden ? 0.55 : 1,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => ProductScreen(product: p)),
        ),
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(GwRadius.sm),
          child: SizedBox(
            width: 54,
            height: 54,
            child: cover == null
                ? _ph()
                : CachedNetworkImage(
                    imageUrl: resolveMedia(cover, bucket: "media") ?? cover,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => _ph(),
                    placeholder: (_, __) => _ph(),
                  ),
          ),
        ),
        title: Text(p.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(
            hidden
                ? "${money(p.price, p.currency)} · ${tr(context, "Hidden", "ဖျောက်ထားသည်")}"
                : money(p.price, p.currency),
            style: TextStyle(
                fontSize: 13,
                color: hidden ? GwColors.inkSoftOf(context) : GwColors.primary,
                fontWeight: FontWeight.w700),
          ),
        ),
        trailing: PopupMenuButton<String>(
          onSelected: (v) => v == "delete" ? _delete(p) : _toggle(p),
          itemBuilder: (_) => [
            PopupMenuItem(
              value: "toggle",
              child: Text(hidden
                  ? tr(context, "Put back on sale", "ပြန်ရောင်းမည်")
                  : tr(context, "Hide from shop", "ဆိုင်မှ ဖျောက်မည်")),
            ),
            PopupMenuItem(
              value: "delete",
              child: Text(tr(context, "Delete", "ဖျက်မည်"),
                  style: const TextStyle(color: GwColors.live)),
            ),
          ],
        ),
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
