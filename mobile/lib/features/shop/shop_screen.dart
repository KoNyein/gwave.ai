import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'my_listings_screen.dart';
import 'orders_screen.dart';
import 'product_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  List<ShopProduct> _products = [];
  bool _loading = true;
  String? _error;

  bool _searching = false;
  final _search = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final p = await context
          .read<AppState>()
          .repo
          .products(query: _search.text.trim());
      if (mounted) setState(() => _products = p);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Search the catalogue server-side, one query per pause in typing.
  void _onQueryChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _search,
                autofocus: true,
                onChanged: _onQueryChanged,
                decoration: InputDecoration(
                  hintText: tr(context, "Search products", "ပစ္စည်း ရှာရန်"),
                  border: InputBorder.none,
                ),
              )
            : const Text("Shop"),
        actions: [
          IconButton(
            icon: Icon(_searching ? Icons.close : Icons.search),
            tooltip: tr(context, "Search", "ရှာရန်"),
            onPressed: () {
              setState(() {
                _searching = !_searching;
                if (!_searching && _search.text.isNotEmpty) {
                  _search.clear();
                  _load();
                }
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.receipt_long_outlined),
            tooltip: tr(context, "My orders", "ကျွန်ုပ်၏ အော်ဒါများ"),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const OrdersScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.storefront_outlined),
            tooltip: tr(context, "Sell", "ရောင်းရန်"),
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const MyListingsScreen()),
              );
              // A new listing belongs in the grid the seller just came back to.
              await _load();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _products.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load Shop",
                        subtitle: _error),
                  ])
                : _products.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 120),
                        GwEmpty(
                          icon: Icons.storefront_outlined,
                          title: _search.text.trim().isEmpty
                              ? tr(context, "No products yet",
                                  "ပစ္စည်း မရှိသေးပါ")
                              : tr(context, "Nothing matched",
                                  "ရှာမတွေ့ပါ"),
                        ),
                      ])
                    : GridView.builder(
                        padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.62,
                        ),
                        itemCount: _products.length,
                        itemBuilder: (_, i) =>
                            _ProductCard(product: _products[i]),
                      ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final ShopProduct product;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProductScreen(product: product)),
      ),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  product.imageUrl != null && product.imageUrl!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl:
                              resolveMedia(product.imageUrl, bucket: "media") ??
                                  product.imageUrl!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _ph(),
                          placeholder: (_, __) => _ph(),
                        )
                      : _ph(),
                  if (product.category != null)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: GwPill(
                        label: product.category!,
                        color: Colors.black.withValues(alpha: 0.4),
                        filled: true,
                      ),
                    ),
                  // An affiliate listing is a hand-off, not a purchase — say so
                  // on the card so the price below is read as indicative.
                  if (product.isAffiliate)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: GwPill(
                        label: product.merchant?.trim().isNotEmpty == true
                            ? product.merchant!
                            : "Partner",
                        color: Colors.black.withValues(alpha: 0.55),
                        filled: true,
                        icon: Icons.open_in_new,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13.5, height: 1.2),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              product.price == null
                                  ? "—"
                                  : product.hasOwnPrice
                                      ? money(product.price, product.currency)
                                      : "~ ${money(product.price, product.currency)}",
                              style: const TextStyle(
                                color: GwColors.primary,
                                fontWeight: FontWeight.w900,
                                fontSize: 15,
                              ),
                            ),
                            if (product.isAffiliate)
                              Text(
                                tr(context, "at merchant", "ရောင်းသူဈေး"),
                                style: const TextStyle(
                                    color: GwColors.inkSoft, fontSize: 10.5),
                              ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: const BoxDecoration(
                          gradient: GwColors.primaryGradient,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                            product.isAffiliate
                                ? Icons.open_in_new
                                : Icons.shopping_bag_outlined,
                            color: Colors.white,
                            size: 16),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ph() => Container(
        color: GwColors.surfaceMuted,
        child: const Center(
          child: Icon(Icons.image_outlined, color: GwColors.line, size: 40),
        ),
      );
}
