import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../map/map_screen.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../live/live_watch_screen.dart';
import 'comments_sheet.dart';
import 'reactions.dart';

class PostCard extends StatefulWidget {
  const PostCard({super.key, required this.post});
  final Post post;

  @override
  State<PostCard> createState() => _PostCardState();
}

class _PostCardState extends State<PostCard> {
  /// The viewer's reaction type ("like", "love", …) or null.
  String? _myReaction;
  late int _likes = widget.post.reactionCount;
  late int _comments = widget.post.commentCount;
  bool _busy = false;

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
                const Icon(Icons.more_horiz, color: GwColors.inkSoft),
              ],
            ),
            if (p.content.trim().isNotEmpty) ...[
              const SizedBox(height: 12),
              _RichPostBody(content: p.content),
            ],
            // A live announcement post carries a gwave.cc/live/<id> link —
            // render a proper Watch-Live banner that opens the native player
            // instead of leaving viewers with a bare URL.
            if (_liveStreamId(p.content) != null) ...[
              const SizedBox(height: 12),
              _LiveBanner(streamId: _liveStreamId(p.content)!),
            ],
            if (p.firstImage != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(GwRadius.md),
                child: CachedNetworkImage(
                  imageUrl:
                      resolveMedia(p.firstImage!.storagePath, bucket: "media")!,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  placeholder: (_, __) => Container(
                    height: 200,
                    color: GwColors.surfaceMuted,
                  ),
                  errorWidget: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
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
                _action(Icons.share_outlined, "Share", GwColors.inkSoft, () {}),
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
        style: const TextStyle(
          color: GwColors.primary,
          fontWeight: FontWeight.w600,
        ),
      ));
      last = m.end;
    }
    if (last < content.length) {
      spans.add(TextSpan(text: content.substring(last)));
    }
    return Text.rich(
      TextSpan(
        style: const TextStyle(fontSize: 15, height: 1.4, color: GwColors.ink),
        children: spans,
      ),
    );
  }
}

/// The live stream id when [content] contains a gwave.cc/live/<uuid> link.
String? _liveStreamId(String content) {
  final m = RegExp(
          r"gwave\.cc/live/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})")
      .firstMatch(content);
  return m?.group(1);
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await context.read<AppState>().repo.stream(widget.streamId);
      if (mounted) setState(() => _stream = s);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final live = _stream?.isLive ?? false;
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: _stream == null
          ? null
          : () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => LiveWatchScreen(stream: _stream!))),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF1B2417), Color(0xFF0B0F08)],
          ),
          borderRadius: BorderRadius.circular(GwRadius.md),
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
        ),
      ),
    );
  }
}
