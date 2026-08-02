import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/config.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../../widgets/share_sheet.dart';

/// Buy a dropship product from anywhere — the shop, or the buy card pinned to
/// a live stream. Returns true when an order was placed.
///
/// Live selling is the reason this is a function and not just a route: a
/// viewer who leaves the broadcast to buy usually doesn't come back, so the
/// checkout has to be reachable without unwinding the screen behind it.
Future<bool> showProductCheckout(
  BuildContext context,
  ShopProduct product,
) async {
  final ordered = await Navigator.of(context).push<bool>(
    MaterialPageRoute(builder: (_) => _CheckoutScreen(product: product)),
  );
  return ordered == true;
}

/// One product, with the action that actually matches its kind:
/// a dropship listing checks out in-app, an affiliate listing hands off to the
/// merchant (and says so, instead of pretending our copied price is binding).
class ProductScreen extends StatefulWidget {
  const ProductScreen({super.key, required this.product});
  final ShopProduct product;

  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  final _page = PageController();
  int _index = 0;

  ShopProduct get product => widget.product;
  String get _link => "${AppConfig.apiBase}/shop/${product.id}";

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  Future<void> _openMerchant() async {
    final url = product.externalUrl;
    if (url == null || url.isEmpty) return;
    // Fire-and-forget: the click stat must never delay the handoff.
    context.read<AppState>().repo.recordAffiliateClick(product.id);
    await openWeb(context, url, title: product.title);
  }

  Future<void> _buy() async {
    final ordered = await showProductCheckout(context, product);
    if (ordered && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Order placed.", "အော်ဒါ တင်ပြီးပါပြီ။")),
      ));
    }
  }

  /// The line that goes out with the link, whichever way it's shared.
  String get _pitch {
    final price = product.hasOwnPrice
        ? "\n${money(product.price, product.currency)}"
        : "";
    return "${product.title}$price";
  }

  void _share() {
    showShareSheet(
      context,
      url: _link,
      title: product.title,
      message: _pitch,
      onShareToFeed: _shareToFeed,
      onSendInChat: _sendInChat,
    );
  }

  /// Post it to my feed. The composer isn't reused here on purpose: there is
  /// nothing left to compose — the seller wants the listing in front of people,
  /// and one confirm is the whole interaction.
  Future<void> _shareToFeed() async {
    final go = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(context, "Share to your feed?", "Feed တွင် မျှဝေမလား")),
        content: Text("$_pitch\n$_link",
            style: const TextStyle(fontSize: 13, height: 1.4)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(tr(context, "Cancel", "မလုပ်တော့ပါ")),
          ),
          TextButton(
            onPressed: () => Navigator.of(d).pop(true),
            child: Text(tr(context, "Share", "မျှဝေမည်")),
          ),
        ],
      ),
    );
    if (go != true || !mounted) return;
    try {
      // The link alone: the feed renders the listing as a card — photo, title,
      // price, Buy — and strips the URL. Posting the title and price as text
      // too would just print them twice above their own card.
      await context.read<AppState>().repo.createPost(_link);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Shared to your feed.",
              "Feed တွင် မျှဝေပြီးပါပြီ။")),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  /// Send it to a chat. The picker loads the conversations we already have
  /// rather than starting a new thread — sharing a product is something you do
  /// with someone you're already talking to.
  Future<void> _sendInChat() async {
    final repo = context.read<AppState>().repo;
    List<Conversation> threads;
    try {
      threads = await repo.conversations();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
      return;
    }
    if (!mounted) return;
    if (threads.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "No chats yet.", "စကားပြောခန်း မရှိသေးပါ။")),
      ));
      return;
    }
    final picked = await showModalBottomSheet<Conversation>(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text(tr(context, "Send to", "ဘယ်သူ့ဆီ ပို့မလဲ"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 16)),
            ),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: threads.length,
                itemBuilder: (_, i) => ListTile(
                  leading: const Icon(Icons.chat_bubble_outline),
                  title: Text(threads[i].displayTitle, maxLines: 1),
                  onTap: () => Navigator.of(sheet).pop(threads[i]),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;
    try {
      await repo.sendMessage(picked.id, "$_pitch\n$_link");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Sent to ${picked.displayTitle}.",
              "${picked.displayTitle} ဆီ ပို့ပြီးပါပြီ။")),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final merchant = product.merchant?.trim();
    final gallery = product.gallery;
    return Scaffold(
      appBar: AppBar(
        title: Text(product.title, maxLines: 1),
        actions: [
          IconButton(
            tooltip: tr(context, "Share", "မျှဝေရန်"),
            icon: const Icon(Icons.ios_share),
            onPressed: _share,
          ),
        ],
      ),
      body: ListView(
        children: [
          _gallery(gallery),
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
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context),
                        fontSize: 12.5,
                        height: 1.35),
                  ),
                ],
                if (merchant != null && merchant.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(Icons.storefront_outlined,
                          size: 16, color: GwColors.inkSoftOf(context)),
                      const SizedBox(width: 6),
                      Text(merchant,
                          style: TextStyle(
                              color: GwColors.inkSoftOf(context),
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ],
                if (product.category != null &&
                    product.category!.trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Chip(
                    label: Text(product.category!.trim(),
                        style: const TextStyle(fontSize: 12)),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
                if (product.description != null &&
                    product.description!.trim().isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(tr(context, "Details", "အသေးစိတ်"),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 8),
                  // SelectableText so a buyer can copy a size, a model number
                  // or a phone number straight out of the description.
                  SelectableText(product.description!.trim(),
                      style: const TextStyle(fontSize: 14, height: 1.5)),
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
                onPressed: _openMerchant,
                icon: const Icon(Icons.open_in_new),
                label: Text(merchant != null && merchant.isNotEmpty
                    ? tr(context, "View on $merchant", "$merchant တွင် ကြည့်ရန်")
                    : tr(context, "View on merchant", "ရောင်းသူဆီ သွားရန်")),
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
              )
            : ElevatedButton.icon(
                onPressed: _buy,
                icon: const Icon(Icons.shopping_bag_outlined),
                label: Text(tr(context, "Buy now", "ဝယ်မည်")),
                style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50)),
              ),
      ),
    );
  }

  /// Swipeable photos with a counter. One photo behaves exactly as before —
  /// the pager and the counter only show up when there's something to page to.
  Widget _gallery(List<String> gallery) {
    if (gallery.isEmpty) {
      return AspectRatio(aspectRatio: 1, child: _ph());
    }
    return AspectRatio(
      aspectRatio: 1,
      child: Stack(
        children: [
          PageView.builder(
            controller: _page,
            itemCount: gallery.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (_, i) => CachedNetworkImage(
              imageUrl: resolveMedia(gallery[i], bucket: "media") ?? gallery[i],
              fit: BoxFit.cover,
              width: double.infinity,
              errorWidget: (_, __, ___) => _ph(),
              placeholder: (_, __) => _ph(),
            ),
          ),
          if (gallery.length > 1)
            Positioned(
              right: 12,
              bottom: 12,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text("${_index + 1}/${gallery.length}",
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ),
            ),
        ],
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
  bool _reused = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<AppState>().me;
    if (me != null) _name.text = me.displayName;
    _prefill();
  }

  /// Reuse the last delivery details. Typing an address on a phone is the
  /// slowest part of buying anything, and the second order should not cost
  /// what the first one did.
  Future<void> _prefill() async {
    final last = await context.read<AppState>().repo.lastOrder();
    if (last == null || !mounted) return;
    if ((last.shipAddress ?? "").trim().isEmpty) return;
    setState(() {
      _name.text = last.shipName ?? _name.text;
      _phone.text = last.shipPhone ?? "";
      _address.text = last.shipAddress ?? "";
      _reused = true;
    });
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
          if (_reused)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  const Icon(Icons.bolt, size: 16, color: GwColors.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      tr(context, "Filled in from your last order — edit if it changed.",
                          "ယခင်အော်ဒါမှ အလိုအလျောက် ဖြည့်ထားသည် — ပြောင်းလဲပါက ပြင်ပါ။"),
                      style: TextStyle(
                          fontSize: 12.5,
                          color: GwColors.inkSoftOf(context),
                          height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
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
            style: TextStyle(
                color: GwColors.inkSoftOf(context),
                fontSize: 12.5,
                height: 1.35),
          ),
        ],
      ),
    );
  }
}
