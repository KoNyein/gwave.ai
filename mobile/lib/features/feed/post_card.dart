import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../../widgets/secure_image_viewer.dart';
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
                            const Icon(Icons.place,
                                size: 12, color: GwColors.inkSoft),
                            const SizedBox(width: 2),
                            Flexible(
                              child: Text(
                                p.locationName!,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: GwColors.inkSoft,
                                  fontSize: 12,
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
            if (p.firstImage != null) ...[
              const SizedBox(height: 12),
              // A protected photo is never rendered inline in the scrolling
              // feed — FLAG_SECURE can't be guaranteed per-card there — so it
              // is hidden behind a tap-to-view lock that opens the secure
              // full-screen viewer (which raises FLAG_SECURE). Unprotected
              // photos show inline as before.
              if (p.protected)
                _ProtectedImageLock(
                  imageUrl:
                      resolveMedia(p.firstImage!.storagePath, bucket: "media")!,
                  caption: p.content,
                )
              else
                ClipRRect(
                  borderRadius: BorderRadius.circular(GwRadius.md),
                  child: CachedNetworkImage(
                    imageUrl: resolveMedia(p.firstImage!.storagePath,
                        bucket: "media")!,
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
                // Protected posts offer no share / forward affordance.
                if (p.protected)
                  _action(Icons.lock_outline, "Protected",
                      GwColors.inkSoft.withValues(alpha: 0.5), () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                            "ဤပို့စ်သည် ကာကွယ်ထားသဖြင့် မျှဝေ၍မရပါ။"),
                      ),
                    );
                  })
                else
                  _action(Icons.share_outlined, "Share", GwColors.inkSoft,
                      () {}),
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

/// Placeholder shown in place of a protected post's photo in the feed. The
/// blurred image itself is never rendered inline; tapping opens the secure
/// full-screen viewer where FLAG_SECURE is active.
class _ProtectedImageLock extends StatelessWidget {
  const _ProtectedImageLock({required this.imageUrl, this.caption});

  final String imageUrl;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => SecureImageViewer.open(
        context,
        imageUrl: imageUrl,
        caption: caption,
      ),
      child: Container(
        height: 220,
        decoration: BoxDecoration(
          color: GwColors.surfaceMuted,
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.line),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.lock_outline, size: 34, color: GwColors.primary),
            SizedBox(height: 10),
            Text(
              "ကာကွယ်ထားသော ဓာတ်ပုံ",
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: GwColors.ink),
            ),
            SizedBox(height: 4),
            Text(
              "ကြည့်ရန် တို့ပါ • screenshot / save မရပါ",
              style: TextStyle(fontSize: 12, color: GwColors.inkSoft),
            ),
          ],
        ),
      ),
    );
  }
}
