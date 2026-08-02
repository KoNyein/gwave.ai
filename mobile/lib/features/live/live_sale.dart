import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../shop/product_screen.dart';

/// The buy card pinned over a live stream.
///
/// One product shows in full; several collapse to the first with a "see all"
/// tap, because the video is the thing being watched and a list of cards over
/// it defeats the point. Buying opens the normal checkout on top of the
/// stream — the broadcast keeps playing behind it, and a viewer who leaves to
/// buy usually doesn't come back.
class LiveSaleCard extends StatelessWidget {
  const LiveSaleCard({
    super.key,
    required this.products,
    required this.onChanged,
  });

  final List<ShopProduct> products;

  /// Called after an order so the host's own view can refresh counts.
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    if (products.isEmpty) return const SizedBox.shrink();
    final first = products.first;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(GwRadius.md),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: products.length > 1
              ? () => showLiveSaleSheet(context, products, onChanged)
              : null,
          child: Padding(
            padding: const EdgeInsets.all(8),
            child: Row(
              children: [
                _thumb(first, 52),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        first.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.black,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            height: 1.25),
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Text(
                            money(first.price, first.currency),
                            style: const TextStyle(
                                color: GwColors.live,
                                fontWeight: FontWeight.w900,
                                fontSize: 15),
                          ),
                          if (products.length > 1) ...[
                            const SizedBox(width: 8),
                            Text(
                              tr(context, "+${products.length - 1} more",
                                  "+${products.length - 1} ခု"),
                              style: const TextStyle(
                                  color: Colors.black54, fontSize: 11.5),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _BuyButton(product: first, onDone: onChanged),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static Widget _thumb(ShopProduct p, double size) {
    final cover = p.gallery.isEmpty ? null : p.gallery.first;
    return ClipRRect(
      borderRadius: BorderRadius.circular(GwRadius.sm),
      child: SizedBox(
        width: size,
        height: size,
        child: cover == null
            ? const ColoredBox(
                color: GwColors.surfaceMuted,
                child: Icon(Icons.image_outlined,
                    color: GwColors.line, size: 20),
              )
            : CachedNetworkImage(
                imageUrl: resolveMedia(cover, bucket: "media") ?? cover,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => const ColoredBox(
                  color: GwColors.surfaceMuted,
                  child: Icon(Icons.image_outlined,
                      color: GwColors.line, size: 20),
                ),
                placeholder: (_, __) =>
                    const ColoredBox(color: GwColors.surfaceMuted),
              ),
      ),
    );
  }
}

/// Every product pinned to the stream, when the host has pinned more than one.
Future<void> showLiveSaleSheet(
  BuildContext context,
  List<ShopProduct> products,
  VoidCallback onChanged,
) {
  return showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (sheet) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(
              tr(context, "On sale in this live", "ဤ Live တွင် ရောင်းနေသည်"),
              style: const TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.w800,
                  fontSize: 16),
            ),
          ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              itemCount: products.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 74),
              itemBuilder: (_, i) {
                final p = products[i];
                return ListTile(
                  leading: LiveSaleCard._thumb(p, 48),
                  title: Text(p.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.black,
                          fontWeight: FontWeight.w700,
                          fontSize: 13.5)),
                  subtitle: Text(money(p.price, p.currency),
                      style: const TextStyle(
                          color: GwColors.live,
                          fontWeight: FontWeight.w800,
                          fontSize: 13)),
                  trailing: _BuyButton(product: p, onDone: onChanged),
                );
              },
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
    ),
  );
}

class _BuyButton extends StatelessWidget {
  const _BuyButton({required this.product, required this.onDone});
  final ShopProduct product;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: () async {
        final ordered = await showProductCheckout(context, product);
        if (!ordered) return;
        onDone();
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text(tr(context, "Order placed.", "အော်ဒါ တင်ပြီးပါပြီ။")),
          ));
        }
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: GwColors.live,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        visualDensity: VisualDensity.compact,
      ),
      child: Text(tr(context, "Buy", "ဝယ်မည်"),
          style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}

/// Host-side: choose which of my listings are pinned to this stream.
///
/// A checklist rather than an add/remove pair of screens — pinning during a
/// broadcast has to be doable one-handed while still talking.
class LiveProductPicker extends StatefulWidget {
  const LiveProductPicker({
    super.key,
    required this.streamId,
    this.pinned = const [],
  });

  final String streamId;

  /// Optional seed so the switches are already right on the first frame; the
  /// real set is re-read from the server either way, because the host may have
  /// pinned from another device — or from this screen a minute ago.
  final List<ShopProduct> pinned;

  @override
  State<LiveProductPicker> createState() => _LiveProductPickerState();
}

class _LiveProductPickerState extends State<LiveProductPicker> {
  List<ShopProduct> _mine = [];
  late Set<String> _pinnedIds;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _pinnedIds = widget.pinned.map((p) => p.id).toSet();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<AppState>().repo;
    try {
      // Re-read the pins rather than trusting the seed: the host may have
      // pinned from another device, or from this screen a minute ago, and a
      // stale switch would insert a duplicate the unique index rejects.
      final results = await Future.wait([
        repo.myListings(),
        repo.liveProducts(widget.streamId),
      ]);
      if (mounted) {
        setState(() {
          _mine = results[0].where((p) => p.status == "active").toList();
          _pinnedIds = results[1].map((p) => p.id).toSet();
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(ShopProduct p) async {
    final repo = context.read<AppState>().repo;
    final wasPinned = _pinnedIds.contains(p.id);
    // Optimistic: the host is mid-broadcast and shouldn't watch a spinner.
    setState(() =>
        wasPinned ? _pinnedIds.remove(p.id) : _pinnedIds.add(p.id));
    try {
      if (wasPinned) {
        await repo.unpinLiveProduct(widget.streamId, p.id);
      } else {
        await repo.pinLiveProduct(widget.streamId, p.id);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() =>
          wasPinned ? _pinnedIds.add(p.id) : _pinnedIds.remove(p.id));
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("$e")));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Sell in this live", "ဤ Live တွင် ရောင်းရန်")),
        // Hand back what's pinned so the stream can redraw its buy card.
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(true),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : _mine.isEmpty
              ? GwEmpty(
                  icon: Icons.sell_outlined,
                  title: tr(context, "Nothing to sell yet",
                      "ရောင်းစရာ မရှိသေးပါ"),
                  subtitle: _error ??
                      tr(
                        context,
                        "List a product in Shop first, then pin it here.",
                        "Shop တွင် ပစ္စည်းတင်ပြီးမှ ဤနေရာတွင် ရွေးပါ။",
                      ),
                )
              : ListView.separated(
                  itemCount: _mine.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 74),
                  itemBuilder: (_, i) {
                    final p = _mine[i];
                    final on = _pinnedIds.contains(p.id);
                    return ListTile(
                      leading: LiveSaleCard._thumb(p, 48),
                      title: Text(p.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13.5)),
                      subtitle: Text(money(p.price, p.currency),
                          style: const TextStyle(
                              color: GwColors.primary,
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                      trailing: Switch(
                        value: on,
                        onChanged: (_) => _toggle(p),
                      ),
                      onTap: () => _toggle(p),
                    );
                  },
                ),
    );
  }
}
