import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../web/web_screen.dart';
import '../live/live_watch_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, this.active = true, this.embedded = false});

  /// In the shell's IndexedStack every tab is built up front — loading (and
  /// marking read) must wait until this tab is actually the visible one.
  final bool active;

  /// Tab mode: no back arrow, big Facebook-style headline.
  final bool embedded;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _items = [];
  bool _loading = true;
  bool _loadedOnce = false;
  String? _error;
  String _filter = "all"; // all | comments | mentions

  @override
  void initState() {
    super.initState();
    if (widget.active) _load();
  }

  @override
  void didUpdateWidget(NotificationsScreen old) {
    super.didUpdateWidget(old);
    if (!old.active && widget.active) _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = context.read<AppState>().repo;
    try {
      final n = await repo.notifications();
      setState(() {
        _items = n;
        _loadedOnce = true;
      });
      // Clear the unread badge once the user has seen the list.
      repo.markNotificationsRead().catchError((_) {});
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static const _commentTypes = {"post_comment", "comment_reply"};
  static const _mentionTypes = {"post_mention", "mention"};

  List<AppNotification> get _visible {
    switch (_filter) {
      case "comments":
        return _items.where((n) => _commentTypes.contains(n.type)).toList();
      case "mentions":
        return _items.where((n) => _mentionTypes.contains(n.type)).toList();
      default:
        return _items;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        titleSpacing: widget.embedded ? 16 : null,
        title: Text(
          tr(context, "Notifications", "အသိပေးချက်များ"),
          style: const TextStyle(
              fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: -0.5),
        ),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && !_loadedOnce
            ? const GwSkeletonList(count: 7)
            : _error != null && _items.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  ])
                : ListView(children: _listChildren(context)),
      ),
    );
  }

  /// Facebook layout: filter pills, then a bold "New" section (unread) and
  /// an "Earlier" section (read) — unread rows keep their blue tint.
  List<Widget> _listChildren(BuildContext context) {
    final visible = _visible;
    final fresh = visible.where((n) => !n.read).toList();
    final earlier = visible.where((n) => n.read).toList();
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
        child: Row(children: [
          _pill(context, "all", tr(context, "All", "အားလုံး")),
          const SizedBox(width: 8),
          _pill(context, "comments", tr(context, "Comments", "Comment များ")),
          const SizedBox(width: 8),
          _pill(context, "mentions", tr(context, "Mentions", "Tag များ")),
        ]),
      ),
      if (visible.isEmpty) ...[
        const SizedBox(height: 100),
        const GwEmpty(
            icon: Icons.notifications_none, title: "No notifications yet"),
      ] else ...[
        if (fresh.isNotEmpty) _sectionHeader(context, tr(context, "New", "အသစ်")),
        ...fresh.map(_tile),
        if (earlier.isNotEmpty)
          _sectionHeader(context, tr(context, "Earlier", "အရင်က")),
        ...earlier.map(_tile),
        const SizedBox(height: 30),
      ],
    ];
  }

  Widget _sectionHeader(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
      child: Text(label,
          style: const TextStyle(
              fontSize: 19, fontWeight: FontWeight.w900, letterSpacing: -0.3)),
    );
  }

  Widget _pill(BuildContext context, String value, String label) {
    final on = _filter == value;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: on
              ? GwColors.primary.withValues(alpha: 0.14)
              : GwColors.surfaceMutedOf(context),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: on ? GwColors.primary : GwColors.inkOf(context))),
      ),
    );
  }

  Widget _tile(AppNotification n) {
    final name = n.actor?.displayName ?? tr(context, "Someone", "တစ်ယောက်");
    return Container(
      color: n.read ? null : GwColors.primary.withValues(alpha: 0.08),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        onTap: () => unawaited(_open(n)),
        leading: Stack(
          children: [
            GwAvatar(
                url: resolveMedia(n.actor?.avatarUrl), name: name, size: 46),
            // Small type badge on the avatar, Facebook-style.
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: _iconColor(n.type),
                  shape: BoxShape.circle,
                  border: Border.all(color: GwColors.bgOf(context), width: 2),
                ),
                child: Icon(_icon(n.type), color: Colors.white, size: 12),
              ),
            ),
          ],
        ),
        title: Text.rich(
          TextSpan(children: [
            TextSpan(
                text: name,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: GwColors.inkOf(context))),
            TextSpan(
                text: " ${_verb(n.type)}",
                style: TextStyle(color: GwColors.inkOf(context))),
          ]),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(timeAgo(n.createdAt),
              style: TextStyle(
                  color: n.read ? GwColors.inkSoftOf(context) : GwColors.primary,
                  fontSize: 12,
                  fontWeight: n.read ? FontWeight.w400 : FontWeight.w700)),
        ),
        trailing: n.read
            ? null
            : Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                    color: GwColors.primary, shape: BoxShape.circle)),
      ),
    );
  }

  /// Open the thing a notification is about: the post, or the actor's profile.
  /// A live notification is about a broadcast, so open the broadcast.
  ///
  /// It used to open whatever it could find — the announcement post if there
  /// was one, otherwise the host's profile URL — and for the "is live now"
  /// notifications from before the announcement post was reliable there was
  /// neither, so the tap landed on a 404 inside the web view. The one thing
  /// every one of them knows is who went live, and a host has one broadcast at
  /// a time; their newest is the one the notification meant.
  ///
  /// Still running: the live opens. Already over: the replay opens, which is
  /// what "I missed it" wants. Neither: say so, rather than showing an error
  /// page from the website.
  Future<void> _open(AppNotification n) async {
    if (n.type == "live_started" || n.type == "live") {
      final hostId = n.actor?.id;
      if (hostId != null && hostId.isNotEmpty) {
        LiveStream? live;
        try {
          live = await context.read<AppState>().repo.latestStreamByHost(hostId);
        } catch (_) {
          live = null;
        }
        if (!mounted) return;
        // Copied into a final before the closure: `live` is assigned inside the
        // try, so it cannot be promoted to non-nullable inside a builder.
        final found = live;
        if (found != null) {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => LiveWatchScreen(stream: found)),
          );
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(tr(context, "That broadcast has ended.",
                "အဲဒီ live ပြီးသွားပါပြီ")),
          ),
        );
        return;
      }
    }
    if (n.postId != null && n.postId!.isNotEmpty) {
      openWeb(context, "/p/${n.postId}");
      return;
    }
    final u = n.actor?.username;
    if (u != null && u.isNotEmpty) {
      openWeb(context, "/u/$u");
    }
  }

  String _verb(String type) {
    switch (type) {
      case "friend_request":
        return tr(context, "sent you a friend request",
            "သင့်ကို friend request ပို့ထားသည်");
      case "friend_accepted":
        return tr(context, "accepted your friend request",
            "သင့် friend request ကို လက်ခံလိုက်ပြီ");
      case "post_reaction":
        return tr(context, "liked your post", "သင့် post ကို like လုပ်ထားသည်");
      case "post_comment":
        return tr(context, "commented on your post",
            "သင့် post မှာ comment ရေးထားသည်");
      case "comment_reply":
        return tr(context, "replied to your comment",
            "သင့် comment ကို ပြန်ဖြေထားသည်");
      case "post_share":
        return tr(context, "shared your post", "သင့် post ကို share လုပ်ထားသည်");
      case "post_mention":
      case "mention":
        return tr(context, "mentioned you in a post", "post တစ်ခုမှာ သင့်ကို tag လုပ်ထားသည်");
      case "new_follower":
      case "follow":
        return tr(context, "started following you", "သင့်ကို စတင် follow လုပ်ထားသည်");
      case "live_started":
      case "live":
        return tr(context, "is live now", "အခု live လွှင့်နေပါပြီ");
      case "message":
      case "new_message":
        return tr(context, "sent you a message", "သင့်ကို message ပို့ထားသည်");
      case "call":
      case "missed_call":
        return tr(context, "called you", "သင့်ကို ဖုန်းခေါ်ထားသည်");
      case "gift":
        return tr(context, "sent you a gift", "သင့်ကို လက်ဆောင် ပေးထားသည်");
      case "device_alert":
        return tr(context, "device alert", "device သတိပေးချက်");
      case "order":
      case "order_update":
        return tr(context, "updated your order", "သင့် order ကို update လုပ်ထားသည်");
      default:
        return tr(context, "sent you a notification", "အကြောင်းကြားစာ ပို့ထားသည်");
    }
  }

  Color _iconColor(String type) {
    switch (type) {
      case "post_reaction":
        return GwColors.heart;
      case "live_started":
      case "live":
      case "call":
      case "missed_call":
        return GwColors.live;
      case "gift":
        return GwColors.gold;
      default:
        return GwColors.primary;
    }
  }

  IconData _icon(String type) {
    switch (type) {
      case "post_reaction":
        return Icons.favorite;
      case "post_comment":
      case "comment_reply":
        return Icons.mode_comment;
      case "post_share":
        return Icons.share;
      case "new_follower":
      case "follow":
      case "friend_request":
      case "friend_accepted":
        return Icons.person_add;
      case "post_mention":
      case "mention":
        return Icons.alternate_email;
      case "live_started":
      case "live":
        return Icons.sensors;
      case "message":
      case "new_message":
        return Icons.chat_bubble;
      case "call":
      case "missed_call":
        return Icons.call;
      case "gift":
        return Icons.card_giftcard;
      case "order":
      case "order_update":
        return Icons.local_shipping;
      case "device_alert":
        return Icons.sensors;
      default:
        return Icons.notifications;
    }
  }
}
