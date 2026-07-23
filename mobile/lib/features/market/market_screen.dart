import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../messenger/chat_screen.dart';
import 'market_create_screen.dart';

/// Marketplace category keys with bilingual labels. "all" is a filter-only
/// pseudo-category; the rest are stored on the listing row.
const marketCategories = <(String, String, String)>[
  ("all", "All", "အားလုံး"),
  ("farm", "Farm", "စိုက်ပျိုးရေး"),
  ("electronics", "Electronics", "လျှပ်စစ်ပစ္စည်း"),
  ("vehicles", "Vehicles", "ယာဉ်များ"),
  ("home", "Home", "အိမ်သုံး"),
  ("fashion", "Fashion", "ဖက်ရှင်"),
  ("food", "Food", "အစားအသောက်"),
  ("other", "Other", "အခြား"),
];

String marketCategoryLabel(BuildContext context, String key) {
  for (final c in marketCategories) {
    if (c.$1 == key) return tr(context, c.$2, c.$3);
  }
  return key;
}

/// Facebook-Marketplace-style person-to-person buy & sell board: browse and
/// search active listings, post your own with photos, chat with the seller.
class MarketScreen extends StatefulWidget {
  const MarketScreen({super.key});

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  final _search = TextEditingController();
  List<Map<String, dynamic>> _listings = [];
  String _category = "all";
  bool _mine = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<AppState>().api;
      final rows = await api.marketList(
        q: _search.text.trim(),
        category: _category == "all" ? null : _category,
        mine: _mine,
      );
      if (!mounted) return;
      setState(() => _listings = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = tr(context, "Couldn't load the marketplace.",
            "ဈေးကွက်ကို ဖွင့်လို့မရပါ။"));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sell() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const MarketCreateScreen()),
    );
    if (created == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Marketplace", "ဈေးကွက်")),
        actions: [
          // My listings toggle.
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(tr(context, "Mine", "ကျွန်ုပ်၏")),
              selected: _mine,
              selectedColor: GwColors.primary.withValues(alpha: 0.15),
              checkmarkColor: GwColors.primary,
              onSelected: (v) {
                setState(() => _mine = v);
                _load();
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _sell,
        backgroundColor: GwColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_a_photo_outlined),
        label: Text(tr(context, "Sell", "ရောင်းမယ်")),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _filters()),
            if (_loading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: GwEmpty(
                  icon: Icons.wifi_off,
                  title: _error!,
                  subtitle: tr(context, "Pull down to retry.",
                      "ပြန်ကြိုးစားရန် အောက်ဆွဲပါ။"),
                ),
              )
            else if (_listings.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: GwEmpty(
                  icon: Icons.storefront_outlined,
                  title: tr(context, "Nothing for sale yet",
                      "ရောင်းထားတာ မရှိသေးပါ"),
                  subtitle: tr(context, "Be the first — tap Sell.",
                      "ပထမဆုံး ရောင်းသူဖြစ်လိုက်ပါ — Sell ကိုနှိပ်ပါ။"),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 96),
                sliver: SliverGrid.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.72,
                  children:
                      _listings.map((l) => _ListingCard(l, onChanged: _load)).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _filters() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            onSubmitted: (_) => _load(),
            decoration: InputDecoration(
              hintText: tr(context, "Search the marketplace…",
                  "ဈေးကွက်ထဲ ရှာရန်…"),
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () {
                        _search.clear();
                        _load();
                      },
                    ),
            ),
          ),
        ),
        SizedBox(
          height: 46,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [
              for (final c in marketCategories)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(tr(context, c.$2, c.$3)),
                    selected: _category == c.$1,
                    selectedColor: GwColors.primary.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: _category == c.$1
                          ? GwColors.primary
                          : GwColors.inkSoft,
                    ),
                    onSelected: (_) {
                      setState(() => _category = c.$1);
                      _load();
                    },
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ListingCard extends StatelessWidget {
  const _ListingCard(this.listing, {required this.onChanged});
  final Map<String, dynamic> listing;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final photos = (listing["photos"] as List?)?.cast<String>() ?? const [];
    final photo = photos.isEmpty
        ? null
        : resolveMedia(photos.first, bucket: "media");
    final status = (listing["status"] ?? "active").toString();
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => MarketDetailScreen(listing: listing),
        )).then((_) => onChanged());
      },
      child: Container(
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  photo == null
                      ? const ColoredBox(
                          color: GwColors.surfaceMuted,
                          child: Icon(Icons.image_outlined,
                              size: 42, color: GwColors.inkSoft),
                        )
                      : CachedNetworkImage(
                          imageUrl: photo,
                          fit: BoxFit.cover,
                          placeholder: (_, __) =>
                              const ColoredBox(color: GwColors.surfaceMuted),
                          errorWidget: (_, __, ___) => const ColoredBox(
                            color: GwColors.surfaceMuted,
                            child: Icon(Icons.broken_image_outlined,
                                color: GwColors.inkSoft),
                          ),
                        ),
                  if (status != "active")
                    Positioned(
                      top: 8,
                      left: 8,
                      child: GwPill(
                        label: status == "sold"
                            ? tr(context, "SOLD", "ရောင်းပြီး")
                            : tr(context, "HIDDEN", "ဖျောက်ထား"),
                        color: status == "sold" ? GwColors.live : GwColors.inkSoft,
                        filled: true,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    formatMarketPrice(listing),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: GwColors.primary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    (listing["title"] ?? "").toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13.5),
                  ),
                  if ((listing["location"] ?? "").toString().isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.place_outlined,
                            size: 12, color: GwColors.inkSoft),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            listing["location"].toString(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 11.5, color: GwColors.inkSoft),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String formatMarketPrice(Map<String, dynamic> listing) {
  final price = (listing["price"] as num?) ?? 0;
  final currency = (listing["currency"] ?? "MMK").toString();
  final v = price == price.roundToDouble()
      ? price.toInt().toString().replaceAllMapped(
          RegExp(r"\B(?=(\d{3})+(?!\d))"), (m) => ",")
      : price.toString();
  return currency == "MMK" ? "$v Ks" : "$v $currency";
}

/// Full listing: photo pager, price/title/description, seller row with a
/// "Chat with seller" button; sellers get sold/hide/relist controls instead.
class MarketDetailScreen extends StatefulWidget {
  const MarketDetailScreen({super.key, required this.listing});
  final Map<String, dynamic> listing;

  @override
  State<MarketDetailScreen> createState() => _MarketDetailScreenState();
}

class _MarketDetailScreenState extends State<MarketDetailScreen> {
  bool _busy = false;
  late String _status = (widget.listing["status"] ?? "active").toString();

  bool get _isMine =>
      context.read<AppState>().api.session?.profileId ==
      widget.listing["seller_id"]?.toString();

  Future<void> _setStatus(String status) async {
    setState(() => _busy = true);
    try {
      await context
          .read<AppState>()
          .api
          .marketSetStatus(widget.listing["id"].toString(), status);
      if (mounted) setState(() => _status = status);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _chatWithSeller() async {
    final seller = widget.listing["seller"];
    if (seller is! Map) return;
    setState(() => _busy = true);
    try {
      final repo = context.read<AppState>().repo;
      final convo = await repo.openConversationWith(
        Profile.fromJson(seller.cast<String, dynamic>()),
      );
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: convo)),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Couldn't open the chat.",
              "စကားပြောခန်း ဖွင့်လို့မရပါ။")),
        ));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = widget.listing;
    final photos = (l["photos"] as List?)?.cast<String>() ?? const [];
    final seller = l["seller"] is Map
        ? (l["seller"] as Map).cast<String, dynamic>()
        : null;
    final sellerName = seller == null
        ? "Gwave user"
        : Profile.fromJson(seller).displayName;

    return Scaffold(
      appBar: AppBar(title: Text((l["title"] ?? "").toString())),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          if (photos.isNotEmpty)
            SizedBox(
              height: 300,
              child: PageView(
                children: [
                  for (final p in photos)
                    CachedNetworkImage(
                      imageUrl: resolveMedia(p, bucket: "media") ?? "",
                      fit: BoxFit.cover,
                      placeholder: (_, __) =>
                          const ColoredBox(color: GwColors.surfaceMuted),
                      errorWidget: (_, __, ___) => const ColoredBox(
                        color: GwColors.surfaceMuted,
                        child: Icon(Icons.broken_image_outlined,
                            color: GwColors.inkSoft),
                      ),
                    ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatMarketPrice(l),
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: GwColors.primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  (l["title"] ?? "").toString(),
                  style: const TextStyle(
                      fontSize: 19, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    GwPill(
                      label: marketCategoryLabel(
                          context, (l["category"] ?? "other").toString()),
                      icon: Icons.sell_outlined,
                    ),
                    if ((l["location"] ?? "").toString().isNotEmpty)
                      GwPill(
                        label: l["location"].toString(),
                        icon: Icons.place_outlined,
                        color: GwColors.inkSoft,
                      ),
                    if (_status != "active")
                      GwPill(
                        label: _status == "sold"
                            ? tr(context, "SOLD", "ရောင်းပြီး")
                            : tr(context, "HIDDEN", "ဖျောက်ထား"),
                        color: _status == "sold"
                            ? GwColors.live
                            : GwColors.inkSoft,
                        filled: true,
                      ),
                  ],
                ),
                if ((l["description"] ?? "").toString().isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text(
                    l["description"].toString(),
                    style: const TextStyle(fontSize: 15, height: 1.45),
                  ),
                ],
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: GwColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(GwRadius.lg),
                  ),
                  child: Row(
                    children: [
                      GwAvatar(
                        url: seller == null
                            ? null
                            : resolveMedia(
                                seller["avatar_url"]?.toString()),
                        name: sellerName,
                        size: 42,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(sellerName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            Text(
                              tr(context, "Seller", "ရောင်းသူ"),
                              style: const TextStyle(
                                  fontSize: 12, color: GwColors.inkSoft),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (_isMine)
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: _busy
                              ? null
                              : () => _setStatus(
                                  _status == "sold" ? "active" : "sold"),
                          icon: const Icon(Icons.check_circle_outline),
                          label: Text(_status == "sold"
                              ? tr(context, "Relist", "ပြန်တင်မယ်")
                              : tr(context, "Mark sold", "ရောင်းပြီးလို့ မှတ်မယ်")),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy
                              ? null
                              : () => _setStatus(
                                  _status == "hidden" ? "active" : "hidden"),
                          icon: const Icon(Icons.visibility_off_outlined),
                          label: Text(_status == "hidden"
                              ? tr(context, "Unhide", "ပြန်ဖော်မယ်")
                              : tr(context, "Hide", "ဖျောက်မယ်")),
                        ),
                      ),
                    ],
                  )
                else
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _busy || seller == null ? null : _chatWithSeller,
                      style: FilledButton.styleFrom(
                        backgroundColor: GwColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: const Icon(Icons.chat_bubble_outline),
                      label: Text(tr(context, "Chat with seller",
                          "ရောင်းသူနှင့် စကားပြောမယ်")),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
