import '../../widgets/share_sheet.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../map/map_screen.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../../widgets/photo_view_screen.dart';
import '../live/live_watch_screen.dart';
import '../map/quake.dart';
import '../shop/product_screen.dart';
import 'comments_sheet.dart';
import 'reactions.dart';
import '../../core/video_audio.dart';

class PostCard extends StatefulWidget {
  const PostCard({super.key, required this.post, this.onChanged});
  final Post post;

  /// Called after the post is edited or deleted, so a feed can refresh. The
  /// card also updates itself, so a parent that does not care can omit this.
  final VoidCallback? onChanged;

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  /// The viewer's reaction type ("like", "love", …) or null.
  String? _myReaction;
  late int _likes = widget.post.reactionCount;
  late int _comments = widget.post.commentCount;
  bool _busy = false;

  /// The card owns the text after an edit so the change is visible instantly,
  /// without waiting for whatever list is holding this post to reload.
  late String _content = widget.post.content;
  bool _deleted = false;

  @override
  void initState() {
    super.initState();
    _loadMyReaction();
  }

  Future<void> _loadMyReaction() async {
    try {
      final r =
          await context.read<AppState>().repo.myPostReaction(widget.post.id);
      if (mounted && r != null) setState(() => _myReaction = r);
    } catch (_) {
      // Non-fatal — leave as not-reacted.
    }
  }

  bool get _isMine =>
      context.read<AppState>().api.session?.profileId == widget.post.authorId;

  /// The post's own menu — the `…` used to be a plain Icon, so it looked like
  /// a button and did nothing. Own posts get edit and delete; everyone else's
  /// get report. Copy and share apply to both.
  void _openMenu() {
    final mine = _isMine;
    showModalBottomSheet<void>(
      context: context,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (mine) ...[
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: Text(tr(sheet, "Edit post", "ပို့စ် ပြင်မည်")),
                onTap: () {
                  Navigator.of(sheet).pop();
                  _edit();
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline,
                    color: Color(0xFFDC2626)),
                title: Text(
                  tr(sheet, "Delete post", "ပို့စ် ဖျက်မည်"),
                  style: const TextStyle(color: Color(0xFFDC2626)),
                ),
                onTap: () {
                  Navigator.of(sheet).pop();
                  _delete();
                },
              ),
            ],
            ListTile(
              leading: const Icon(Icons.copy_outlined),
              title: Text(tr(sheet, "Copy text", "စာသား ကူးယူ")),
              onTap: () {
                Navigator.of(sheet).pop();
                Clipboard.setData(ClipboardData(text: _content));
                _toast(tr(context, "Copied", "ကူးပြီးပါပြီ"));
              },
            ),
            ListTile(
              leading: const Icon(Icons.share_outlined),
              title: Text(tr(sheet, "Share", "မျှဝေမည်")),
              onTap: () {
                Navigator.of(sheet).pop();
                Share.share(
                  _content.trim().isEmpty
                      ? "${AppConfig.apiBase}/p/${widget.post.id}"
                      : "$_content\n\n${AppConfig.apiBase}/p/${widget.post.id}",
                );
              },
            ),
            if (!mine)
              ListTile(
                leading: const Icon(Icons.flag_outlined,
                    color: Color(0xFFD97706)),
                title: Text(
                  tr(sheet, "Report post", "ပို့စ် တိုင်ကြားမည်"),
                  style: const TextStyle(color: Color(0xFFD97706)),
                ),
                onTap: () {
                  Navigator.of(sheet).pop();
                  _report();
                },
              ),
          ],
        ),
      ),
    );
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _edit() async {
    final controller = TextEditingController(text: _content);
    final next = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(d, "Edit post", "ပို့စ် ပြင်မည်")),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 8,
          minLines: 3,
          decoration: InputDecoration(
            hintText: tr(d, "What's on your mind?", "ဘာတွေ တွေးနေလဲ?"),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(),
            child: Text(tr(d, "Cancel", "မလုပ်တော့")),
          ),
          FilledButton(
            onPressed: () => Navigator.of(d).pop(controller.text.trim()),
            child: Text(tr(d, "Save", "သိမ်းမည်")),
          ),
        ],
      ),
    );
    if (next == null || next == _content || !mounted) return;
    final repo = context.read<AppState>().repo;
    // Optimistic: the text is already what the user typed, so show it and put
    // the old one back only if the write fails.
    final previous = _content;
    setState(() => _content = next);
    try {
      await repo.editPost(widget.post.id, next);
      widget.onChanged?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() => _content = previous);
      _toast("$e");
    }
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(d, "Delete this post?", "ဤပို့စ်ကို ဖျက်မလား?")),
        content: Text(tr(
          d,
          "This cannot be undone.",
          "ပြန်ပြင်၍ မရတော့ပါ။",
        )),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(false),
            child: Text(tr(d, "Cancel", "မလုပ်တော့")),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.of(d).pop(true),
            child: Text(tr(d, "Delete", "ဖျက်မည်")),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final repo = context.read<AppState>().repo;
    try {
      await repo.deletePost(widget.post.id);
      if (!mounted) return;
      setState(() => _deleted = true);
      widget.onChanged?.call();
    } catch (e) {
      _toast("$e");
    }
  }

  Future<void> _report() async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(d, "Report post", "ပို့စ် တိုင်ကြားမည်")),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(
            hintText: tr(d, "What is wrong with it?",
                "ဘာဖြစ်လို့ တိုင်ကြားတာလဲ?"),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(d).pop(),
            child: Text(tr(d, "Cancel", "မလုပ်တော့")),
          ),
          FilledButton(
            onPressed: () => Navigator.of(d).pop(controller.text.trim()),
            child: Text(tr(d, "Send", "ပို့မည်")),
          ),
        ],
      ),
    );
    if (reason == null || reason.length < 3 || !mounted) return;
    final repo = context.read<AppState>().repo;
    try {
      await repo.reportPost(widget.post.id, reason);
      _toast(tr(context, "Reported — a moderator will review it.",
          "တိုင်ကြားပြီးပါပြီ — စစ်ဆေးပေးပါလိမ့်မယ်။"));
    } catch (e) {
      _toast("$e");
    }
  }

  /// Apply [next] as the viewer's reaction (null = remove). Optimistic UI,
  /// reverted on failure; post.reaction_count is kept by a DB trigger.
  Future<void> _applyReaction(String? next) async {
    if (_busy || next == _myReaction) return;
    final prev = _myReaction;
    setState(() {
      _busy = true;
      _myReaction = next;
      if (prev == null && next != null) _likes += 1;
      if (prev != null && next == null) _likes -= 1;
    });
    final repo = context.read<AppState>().repo;
    try {
      if (next == null) {
        await repo.removeReaction(widget.post.id);
      } else {
        await repo.setPostReaction(widget.post.id, next);
      }
    } catch (_) {
      setState(() {
        _myReaction = prev;
        if (prev == null && next != null) _likes -= 1;
        if (prev != null && next == null) _likes += 1;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Tap: toggle a plain like on/off. Long-press: open the six-emoji chooser.
  Future<void> _toggleLike() =>
      _applyReaction(_myReaction == null ? "like" : null);

  Future<void> _pickReaction() async {
    final type = await showGwReactionPicker(context, current: _myReaction);
    if (type == null) return;
    // Re-picking the current reaction removes it.
    await _applyReaction(type == _myReaction ? null : type);
  }

  Future<void> _openComments() async {
    await CommentsSheet.show(context, widget.post.id);
    // Refresh the comment count after the sheet closes.
    try {
      final list = await context.read<AppState>().repo.comments(widget.post.id);
      if (mounted) setState(() => _comments = list.length);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    // A deleted post leaves nothing behind: the list it sits in may not have
    // reloaded yet, and a card for a row that is gone would 404 on every tap.
    if (_deleted) return const SizedBox.shrink();
    final p = widget.post;
    final name = p.author?.displayName ?? "Gwave user";
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                GwAvatar(
                  url: resolveMedia(p.author?.avatarUrl),
                  name: name,
                  size: 42,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      Row(
                        children: [
                          Text(
                            timeAgo(p.createdAt),
                            style: const TextStyle(
                              color: GwColors.inkSoft,
                              fontSize: 12,
                            ),
                          ),
                          if (p.locationName != null) ...[
                            const Text(" · ",
                                style: TextStyle(color: GwColors.inkSoft)),
                            // With coordinates, the tag opens the map right
                            // at the tagged spot.
                            Flexible(
                              child: InkWell(
                                onTap: p.latitude != null &&
                                        p.longitude != null
                                    ? () => Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (_) => MapScreen(
                                              focusLat: p.latitude,
                                              focusLng: p.longitude,
                                              focusLabel: p.locationName,
                                            ),
                                          ),
                                        )
                                    : null,
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(Icons.place,
                                        size: 12,
                                        color: p.latitude != null
                                            ? GwColors.primary
                                            : GwColors.inkSoft),
                                    const SizedBox(width: 2),
                                    Flexible(
                                      child: Text(
                                        p.locationName!,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: p.latitude != null
                                              ? GwColors.primary
                                              : GwColors.inkSoft,
                                          fontSize: 12,
                                          fontWeight: p.latitude != null
                                              ? FontWeight.w700
                                              : FontWeight.w400,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.more_horiz, color: GwColors.inkSoft),
                  tooltip: tr(context, "More", "နောက်ထပ်"),
                  onPressed: _openMenu,
                ),
              ],
            ),
            // A live announcement post carries a gwave.cc/live/<id> link.
            // The raw URL and the generated "🔴 Live …" line are plumbing,
            // not content: show the live video card (auto-playing preview,
            // LIVE/REPLAY badge, title, watch row) — no URL, like the big
            // platforms. Anything the user typed themselves still shows.
            if (_liveStreamId(_content) != null) ...[
              if (_liveExtraText(_content).isNotEmpty) ...[
                const SizedBox(height: 12),
                _RichPostBody(content: _liveExtraText(_content)),
              ],
              const SizedBox(height: 12),
              _LiveBanner(streamId: _liveStreamId(_content)!),
            ]
            // A shared listing carries a gwave.cc/shop/<id> link. Same rule as
            // live: the URL is plumbing, so show the product itself — photo,
            // title, price, Buy — and never the raw link.
            else if (_shopProductId(_content) != null) ...[
              if (_shopExtraText(_content).isNotEmpty) ...[
                const SizedBox(height: 12),
                _RichPostBody(content: _shopExtraText(_content)),
              ],
              const SizedBox(height: 12),
              _ProductBanner(productId: _shopProductId(_content)!),
            ]
            // A shared quake renders as an alert card — magnitude, place and
            // the safety guide — never as a URL.
            else if (_quakeInfo(_content) != null) ...[
              if (_quakeExtraText(_content).isNotEmpty) ...[
                const SizedBox(height: 12),
                _RichPostBody(content: _quakeExtraText(_content)),
              ],
              const SizedBox(height: 12),
              _QuakePostCard(info: _quakeInfo(_content)!),
            ] else if (_content.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              _RichPostBody(content: _content),
            ],
            // Video posts play inline (muted autoplay, tap for sound); an image
            // widget can't render a video, so this must come before firstImage.
            if (p.firstVideo != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(GwRadius.md),
                child: _PostVideo(
                  url: resolveMedia(p.firstVideo!.storagePath,
                      bucket: "media")!,
                ),
              ),
            ] else if (p.firstImage != null) ...[
              const SizedBox(height: 12),
              Builder(builder: (ctx) {
                final url =
                    resolveMedia(p.firstImage!.storagePath, bucket: "media")!;
                // Tap the photo to open the full-screen viewer (pinch-zoom,
                // drag down to dismiss) — the standard feed-photo gesture.
                return GestureDetector(
                  onTap: () => PhotoViewScreen.open(ctx, url),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    child: CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      // Sharper downscale than Flutter's default low-quality
                      // filter, so feed photos aren't soft on Retina screens.
                      filterQuality: FilterQuality.medium,
                      placeholder: (_, __) => Container(
                        height: 200,
                        color: GwColors.surfaceMuted,
                      ),
                      errorWidget: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                );
              }),
            ],
            const SizedBox(height: 12),
            if (_likes > 0 || _comments > 0)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    if (_likes > 0) ...[
                      const Icon(Icons.favorite, size: 14, color: GwColors.heart),
                      const SizedBox(width: 4),
                      Text("$_likes",
                          style: const TextStyle(
                              color: GwColors.inkSoft, fontSize: 12)),
                    ],
                    const Spacer(),
                    if (_comments > 0)
                      Text("$_comments comments",
                          style: const TextStyle(
                              color: GwColors.inkSoft, fontSize: 12)),
                  ],
                ),
              ),
            const Divider(height: 1),
            Row(
              children: [
                _reactionAction(),
                _action(Icons.mode_comment_outlined, "Comment",
                    GwColors.inkSoft, _openComments),
                _action(Icons.share_outlined, "Share", GwColors.inkSoft, () {
                  final p = widget.post;
                  final text = _content.trim();
                  showShareSheet(
                    context,
                    url: "https://gwave.cc/p/${p.id}",
                    title: text.isEmpty ? "Gwave post" : text,
                    message: text.isEmpty ? null : text,
                  );
                }),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// The Like slot: shows the picked reaction's emoji + label when reacted.
  /// Tap toggles like; hold opens the reaction chooser.
  Widget _reactionAction() {
    final r = gwReactionOf(_myReaction);
    final color = r?.color ?? GwColors.inkSoft;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.sm),
        onTap: _toggleLike,
        onLongPress: _pickReaction,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (r != null)
                Text(r.emoji, style: const TextStyle(fontSize: 17))
              else
                const Icon(Icons.favorite_border,
                    size: 19, color: GwColors.inkSoft),
              const SizedBox(width: 6),
              Text(r?.label ?? "Like",
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w600,
                      fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _action(IconData icon, String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.sm),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 19, color: color),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w600,
                      fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Renders post text with @mentions and bare links tinted green. Links are
/// tappable: an internal gwave.cc link opens inside the app (a `/live/<id>`
/// link plays natively), and only genuinely external links leave for a browser.
class _RichPostBody extends StatefulWidget {
  const _RichPostBody({required this.content});
  final String content;

  @override
  State<_RichPostBody> createState() => _RichPostBodyState();
}

class _RichPostBodyState extends State<_RichPostBody> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _openLink(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    // Internal gwave.cc links stay in the app. A live share link plays natively.
    if (uri.host == "gwave.cc" || uri.host == "www.gwave.cc") {
      final seg = uri.pathSegments;
      if (seg.length >= 2 && seg[0] == "live") {
        try {
          final stream = await context.read<AppState>().repo.stream(seg[1]);
          if (stream != null && mounted) {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => LiveWatchScreen(stream: stream)),
            );
            return;
          }
        } catch (_) {
          // fall through to opening the web page
        }
      }
    }
    if (uri.host == "gwave.cc" || uri.host == "www.gwave.cc") {
      if (mounted) await openWeb(context, uri.path.isEmpty ? "/" : "${uri.path}${uri.hasQuery ? "?${uri.query}" : ""}");
      return;
    }
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final content = widget.content;
    final spans = <InlineSpan>[];
    final re = RegExp(r"(@\w+|https?://\S+)");
    int last = 0;
    for (final m in re.allMatches(content)) {
      if (m.start > last) {
        spans.add(TextSpan(text: content.substring(last, m.start)));
      }
      final token = m.group(0)!;
      final isLink = token.startsWith("http");
      TapGestureRecognizer? recognizer;
      if (isLink) {
        recognizer = TapGestureRecognizer()..onTap = () => _openLink(token);
        _recognizers.add(recognizer);
      }
      spans.add(TextSpan(
        text: token,
        recognizer: recognizer,
        style: TextStyle(
          // Web links blue (tappable); @mentions stay brand green.
          color: isLink ? GwColors.linkOf(context) : GwColors.primary,
          fontWeight: FontWeight.w600,
          decoration: isLink ? TextDecoration.underline : null,
          decorationColor: isLink ? GwColors.linkOf(context) : null,
        ),
      ));
      last = m.end;
    }
    if (last < content.length) {
      spans.add(TextSpan(text: content.substring(last)));
    }
    return Text.rich(
      TextSpan(
        style: TextStyle(
            fontSize: 15, height: 1.4, color: GwColors.inkOf(context)),
        children: spans,
      ),
    );
  }
}

/// Live-announcement content minus the plumbing: the gwave.cc/live URL and
/// the generated "🔴 Live …" line (the card already shows the title).
/// Whatever the user typed themselves survives.
String _liveExtraText(String content) {
  return content
      .replaceAll(RegExp(r"https?://\S*gwave\.cc/live/\S+"), "")
      .replaceAll(RegExp(r"^\s*🔴\s*Live[^\n]*$", multiLine: true), "")
      .trim();
}

/// The product id when [content] contains a gwave.cc/shop/<uuid> link.
String? _shopProductId(String content) {
  final m = RegExp(
          r"gwave\.cc/shop/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")
      .firstMatch(content);
  return m?.group(1);
}

/// Shared-listing content minus the plumbing: the gwave.cc/shop URL. The card
/// carries the title, price and photo, so the link has nothing left to say.
/// Whatever the sharer typed themselves survives.
String _shopExtraText(String content) {
  return content
      .replaceAll(RegExp(r"https?://\S*gwave\.cc/shop/\S+"), "")
      .trim();
}

/// A shared earthquake: the generated "🫨 M x.x place" line plus the USGS
/// eventpage link. Both are plumbing — the card renders the quake itself.
({double mag, String place, String url})? _quakeInfo(String content) {
  final url = RegExp(
          r"https?://earthquake\.usgs\.gov/earthquakes/eventpage/\S+")
      .firstMatch(content)
      ?.group(0);
  if (url == null) return null;
  final line = RegExp(r"🫨\s*M\s*([\d.]+)\s*([^\n·]*)").firstMatch(content);
  return (
    mag: double.tryParse(line?.group(1) ?? "") ?? 0,
    place: (line?.group(2) ?? "").trim(),
    url: url,
  );
}

/// Quake-share content minus the plumbing: the USGS URL and the generated
/// 🫨 line. Whatever the sharer typed themselves survives.
String _quakeExtraText(String content) {
  return content
      .replaceAll(
          RegExp(r"https?://earthquake\.usgs\.gov/earthquakes/eventpage/\S+"),
          "")
      .replaceAll(RegExp(r"^\s*🫨[^\n]*$", multiLine: true), "")
      .trim();
}

/// The live stream id when [content] contains a gwave.cc/live/<uuid> link.
String? _liveStreamId(String content) {
  final m = RegExp(
          r"gwave\.cc/live/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")
      .firstMatch(content);
  return m?.group(1);
}

/// A shared earthquake as an alert card: severity-coloured magnitude badge,
/// place, and the two taps that matter — details (USGS, in-app) and the
/// safety guide. Everything on it is parsed from the post text, so it renders
/// instantly and offline.
class _QuakePostCard extends StatelessWidget {
  const _QuakePostCard({required this.info});
  final ({double mag, String place, String url}) info;

  Color get _color => info.mag >= 7
      ? const Color(0xFF8B0000)
      : info.mag >= 6
          ? const Color(0xFFD32F2F)
          : info.mag >= 5
              ? const Color(0xFFF57C00)
              : info.mag >= 4
                  ? const Color(0xFFF9A825)
                  : const Color(0xFF7CB342);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => openWeb(context, info.url, title: "USGS"),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: _color.withValues(alpha: 0.5)),
          color: _color.withValues(alpha: 0.08),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: _color,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    "M ${info.mag.toStringAsFixed(1)}",
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 17),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        tr(context, "Earthquake", "ငလျင် သတင်း"),
                        style: TextStyle(
                            color: _color,
                            fontWeight: FontWeight.w800,
                            fontSize: 12),
                      ),
                      Text(
                        info.place.isEmpty
                            ? tr(context, "See details", "အသေးစိတ် ကြည့်ရန်")
                            : info.place,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            height: 1.25),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        openWeb(context, info.url, title: "USGS"),
                    icon: const Icon(Icons.public, size: 16),
                    label: Text(tr(context, "Details", "အသေးစိတ်"),
                        style: const TextStyle(fontSize: 12.5)),
                    style: OutlinedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        foregroundColor: _color,
                        side: BorderSide(color: _color)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const QuakeSafetyScreen())),
                    icon: const Icon(Icons.health_and_safety, size: 16),
                    label: Text(
                        tr(context, "Safety guide", "ဘေးကင်းရေး"),
                        style: const TextStyle(fontSize: 12.5)),
                    style: ElevatedButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        backgroundColor: _color,
                        foregroundColor: Colors.white),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A shared listing rendered as the product itself: cover photo, title, price
/// and a Buy button that goes straight to checkout — the same card the shop
/// shows, so a post about something for sale looks like a shop card and not a
/// pasted URL.
class _ProductBanner extends StatefulWidget {
  const _ProductBanner({required this.productId});
  final String productId;

  @override
  State<_ProductBanner> createState() => _ProductBannerState();
}

class _ProductBannerState extends State<_ProductBanner> {
  ShopProduct? _product;
  bool _gone = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final p = await context.read<AppState>().repo.product(widget.productId);
      if (!mounted) return;
      // Deleted or hidden since it was shared: say so plainly rather than
      // leaving an empty frame where a product used to be.
      setState(() {
        _product = p;
        _gone = p == null || p.status != "active";
      });
    } catch (_) {
      if (mounted) setState(() => _gone = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_gone) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: GwColors.surfaceMutedOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: Row(
          children: [
            Icon(Icons.remove_shopping_cart_outlined,
                size: 18, color: GwColors.inkSoftOf(context)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tr(context, "This listing is no longer available.",
                    "ဤပစ္စည်း မရှိတော့ပါ။"),
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }
    final p = _product;
    if (p == null) {
      return Container(
        height: 96,
        decoration: BoxDecoration(
          color: GwColors.surfaceMutedOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
      );
    }
    final cover = p.gallery.isEmpty ? null : p.gallery.first;
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProductScreen(product: p)),
      ),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (cover != null)
              AspectRatio(
                aspectRatio: 1.4,
                child: CachedNetworkImage(
                  imageUrl: resolveMedia(cover, bucket: "media") ?? cover,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  errorWidget: (_, __, ___) => ColoredBox(
                      color: GwColors.surfaceMutedOf(context)),
                  placeholder: (_, __) => ColoredBox(
                      color: GwColors.surfaceMutedOf(context)),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(p.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                                height: 1.25)),
                        const SizedBox(height: 4),
                        Text(
                          p.hasOwnPrice
                              ? money(p.price, p.currency)
                              : "~ ${money(p.price, p.currency)}",
                          style: const TextStyle(
                              color: GwColors.primary,
                              fontWeight: FontWeight.w900,
                              fontSize: 15),
                        ),
                        if (p.description != null &&
                            p.description!.trim().isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text(
                            p.description!.trim(),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: GwColors.inkSoftOf(context),
                                fontSize: 12.5,
                                height: 1.35),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  ElevatedButton(
                    onPressed: () async {
                      if (p.isAffiliate) {
                        // An affiliate listing is a hand-off; the product
                        // screen is where that is explained honestly.
                        Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => ProductScreen(product: p)));
                        return;
                      }
                      final ordered = await showProductCheckout(context, p);
                      if (ordered && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(tr(context, "Order placed.",
                              "အော်ဒါ တင်ပြီးပါပြီ။")),
                        ));
                      }
                    },
                    style: ElevatedButton.styleFrom(
                        visualDensity: VisualDensity.compact),
                    child: Text(p.isAffiliate
                        ? tr(context, "View", "ကြည့်ရန်")
                        : tr(context, "Buy", "ဝယ်မည်")),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A tappable Watch-Live banner for live-announcement posts: loads the stream
/// row once (LIVE vs replay) and opens the native player on tap.
class _LiveBanner extends StatefulWidget {
  const _LiveBanner({required this.streamId});
  final String streamId;

  @override
  State<_LiveBanner> createState() => _LiveBannerState();
}

class _LiveBannerState extends State<_LiveBanner> {
  LiveStream? _stream;

  // Inline video preview: HLS (app broadcasts) plays muted; browser (LiveKit)
  // lives join the room as a muted subscriber — real video in the feed.
  // A speaker toggle lets the viewer unmute right in the feed, and sound is
  // shared with the rest of the feed through [feedSoundHolder] — one mute
  // button silences everything, and only one card can talk at a time.
  VideoPlayerController? _vc;
  lk.Room? _lkRoom;
  lk.EventsListener<lk.RoomEvent>? _lkListener;
  lk.VideoTrack? _lkVideo;

  /// This card's claim on the feed's sound. Set once the preview URL is known,
  /// which is the only stable id this card has.
  String? _soundId;

  bool get _muted => _soundId == null || feedSoundHolder.value != _soundId;

  @override
  void initState() {
    super.initState();
    feedSoundHolder.addListener(_applyMute);
    _load();
  }

  void _applyMute() {
    _vc?.setVolume(_muted ? 0 : 1);
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    feedSoundHolder.removeListener(_applyMute);
    // Scrolling a talking preview off screen should not leave the feed
    // thinking something is still speaking.
    if (_soundId != null && feedSoundHolder.value == _soundId) {
      feedSoundHolder.value = null;
    }
    _vc?.dispose();
    _lkListener?.dispose();
    final room = _lkRoom;
    if (room != null) room.disconnect().then((_) => room.dispose());
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final state = context.read<AppState>();
      var s = await state.repo.stream(widget.streamId);
      // Self-heal a stale "live" row (broadcast died without ending): the
      // server verifies the real media plane and, when dead, marks it ended
      // AND links the saved replay — so this banner flips from a ghost LIVE
      // badge to the muted auto-playing REPLAY card.
      if (s != null &&
          s.isLive &&
          s.createdAt != null &&
          DateTime.now().difference(s.createdAt!).inMinutes >= 4) {
        try {
          final status = await state.api.liveVerify(s.id);
          if (status != "live") {
            s = await state.repo.stream(widget.streamId);
          }
        } catch (_) {
          // Verify is best-effort; the banner still renders.
        }
      }
      if (mounted) setState(() => _stream = s);
      if (s != null) await _initPreview(s);
    } catch (_) {}
  }

  Future<void> _initPreview(LiveStream s) async {
    if (!mounted) return;
    if (!s.isLive) {
      // Ended broadcast: autoplay the replay muted, Facebook-style.
      String? url;
      final rp = s.recordingPath;
      if (rp != null && rp.isNotEmpty) {
        url = rp.startsWith("http")
            ? rp
            : "${AppConfig.apiBase}/recordings/$rp";
      } else if (s.vodPlaybackId != null && s.vodPlaybackId!.isNotEmpty) {
        url = "https://stream.mux.com/${s.vodPlaybackId}.m3u8";
      }
      if (url == null) return;
      try {
        // Silent preview — must not take audio focus off the user's music.
        final c = silentVideoController(Uri.parse(url));
        _vc = c;
        _soundId = url;
        await c.initialize();
        await c.setVolume(0);
        await c.setLooping(true);
        await c.play();
        if (mounted) setState(() {});
      } catch (_) {}
      return;
    }
    final hls = s.ivsPlaybackUrl;
    if (hls != null && hls.isNotEmpty) {
      try {
        final c = silentVideoController(Uri.parse(hls));
        _vc = c;
        _soundId = hls;
        await c.initialize();
        await c.setVolume(0);
        await c.play();
        if (mounted) setState(() {});
      } catch (_) {}
      return;
    }
    final lkRoomName = s.livekitRoom;
    if (lkRoomName == null || lkRoomName.isEmpty) return;
    try {
      final t = await context.read<AppState>().api.liveToken(s.id);
      final room = lk.Room(
        roomOptions: const lk.RoomOptions(adaptiveStream: true, dynacast: true),
      );
      _lkRoom = room;
      final listener = room.createListener();
      _lkListener = listener;
      listener.on<lk.TrackSubscribedEvent>((e) {
        final track = e.track;
        if (track is lk.VideoTrack && mounted) {
          setState(() => _lkVideo = track);
        }
        if (track is lk.AudioTrack) {
          // Preview is silent; sound lives in the full player.
          e.publication.unsubscribe();
        }
      });
      await room.connect(t.url, t.token);
      for (final p in room.remoteParticipants.values) {
        for (final pub in p.videoTrackPublications) {
          final track = pub.track;
          if (track is lk.VideoTrack) _lkVideo = track;
        }
        for (final pub in p.audioTrackPublications) {
          pub.unsubscribe();
        }
      }
      if (mounted) setState(() {});
    } catch (_) {}
  }

  Widget? _preview() {
    if (_vc != null && _vc!.value.isInitialized) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: VideoPlayer(_vc!),
      );
    }
    if (_lkVideo != null) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: lk.VideoTrackRenderer(_lkVideo!, fit: lk.VideoViewFit.cover),
      );
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final live = _stream?.isLive ?? false;
    final preview = _preview();
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: _stream == null
          ? null
          : () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => LiveWatchScreen(stream: _stream!))),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(GwRadius.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (preview != null)
              Stack(
                children: [
                  preview,
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: (_stream?.isLive ?? false)
                            ? GwColors.live
                            : Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_stream?.isLive ?? false) ...[
                            const Icon(Icons.circle,
                                color: Colors.white, size: 8),
                            const SizedBox(width: 5),
                          ],
                          Text(
                              (_stream?.isLive ?? false) ? "LIVE" : "REPLAY",
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.6)),
                        ],
                      ),
                    ),
                  ),
                  // Viewer count while live — standard live-card furniture.
                  if ((_stream?.isLive ?? false) &&
                      (_stream?.viewerCount ?? 0) > 0)
                    Positioned(
                      top: 10,
                      right: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.55),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.visibility,
                                color: Colors.white, size: 13),
                            const SizedBox(width: 4),
                            Text("${_stream?.viewerCount}",
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ),
                    ),
                  // Sound toggle for the inline preview (HLS live + replays).
                  if (_vc != null)
                    Positioned(
                      bottom: 10,
                      right: 10,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () {
                          if (_vc == null) return;
                          final id = _soundId;
                          if (_muted && id != null) {
                            feedUnmute(id);
                          } else {
                            feedMuteAll();
                          }
                        },
                        child: Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                              _muted ? Icons.volume_off : Icons.volume_up,
                              color: Colors.white,
                              size: 18),
                        ),
                      ),
                    ),
                ],
              ),
            _bannerRow(context, live),
          ],
        ),
      ),
    );
  }

  Widget _bannerRow(BuildContext context, bool live) {
    return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1B2417), Color(0xFF0B0F08)],
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: live
                    ? GwColors.live
                    : Colors.white.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Icon(live ? Icons.sensors : Icons.play_arrow,
                  color: Colors.white, size: 26),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _stream?.title ??
                        tr(context, "Live broadcast", "တိုက်ရိုက်လွှင့်ချက်"),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14.5),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    live
                        ? tr(context, "🔴 LIVE now — tap to watch",
                            "🔴 တိုက်ရိုက် — နှိပ်ပြီး ကြည့်ပါ")
                        : tr(context, "▶ Watch the replay",
                            "▶ Replay ပြန်ကြည့်ရန်"),
                    style: TextStyle(
                        color: live ? const Color(0xFFFF8A8A) : Colors.white70,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white54),
          ],
        ));
  }
}

/// Inline feed video for an uploaded video post. Autoplays muted and loops
/// (TikTok/Facebook style); tap toggles sound. Falls back to a tap-to-play
/// poster if autoplay init fails.
///
/// Sound is decided by [feedSoundHolder], not by this widget: muting here
/// mutes the whole feed, and unmuting here takes the sound *from* whichever
/// other card had it. See the note on that notifier.
class _PostVideo extends StatefulWidget {
  const _PostVideo({required this.url});
  final String url;

  @override
  State<_PostVideo> createState() => _PostVideoState();
}

class _PostVideoState extends State<_PostVideo> {
  VideoPlayerController? _vc;
  bool _failed = false;

  bool get _muted => feedSoundHolder.value != widget.url;

  @override
  void initState() {
    super.initState();
    feedSoundHolder.addListener(_applyMute);
    _init();
  }

  @override
  void dispose() {
    feedSoundHolder.removeListener(_applyMute);
    // Scrolling a talking video off screen should not leave the feed thinking
    // something is still speaking.
    if (feedSoundHolder.value == widget.url) feedSoundHolder.value = null;
    _vc?.dispose();
    super.dispose();
  }

  void _applyMute() {
    _vc?.setVolume(_muted ? 0 : 1);
    if (mounted) setState(() {});
  }

  Future<void> _init() async {
    try {
      // Autoplays muted, so it stays out of the audio focus fight.
      final c = silentVideoController(Uri.parse(widget.url));
      _vc = c;
      await c.initialize();
      await c.setVolume(0);
      await c.setLooping(true);
      await c.play();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  void _toggleSound() {
    final c = _vc;
    if (c == null) return;
    if (_muted) {
      // Takes the sound from any other card that had it, and from the music —
      // the one moment there is a real conflict over the speaker.
      feedUnmute(widget.url);
      if (!c.value.isPlaying) c.play();
    } else {
      feedMuteAll();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _vc;
    if (_failed) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: Colors.black,
          child: const Center(
            child: Icon(Icons.videocam_off, color: Colors.white54, size: 40),
          ),
        ),
      );
    }
    if (c == null || !c.value.isInitialized) {
      return AspectRatio(
        aspectRatio: 16 / 9,
        child: Container(
          color: GwColors.surfaceMuted,
          child: const Center(
            child: CircularProgressIndicator(color: GwColors.primary),
          ),
        ),
      );
    }
    return GestureDetector(
      onTap: _toggleSound,
      child: AspectRatio(
        aspectRatio: c.value.aspectRatio == 0 ? 16 / 9 : c.value.aspectRatio,
        child: Stack(
          alignment: Alignment.bottomRight,
          children: [
            VideoPlayer(c),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _muted ? Icons.volume_off : Icons.volume_up,
                  color: Colors.white,
                  size: 18,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
