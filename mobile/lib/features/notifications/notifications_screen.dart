import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../web/web_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _items = [];
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
    final repo = context.read<AppState>().repo;
    try {
      final n = await repo.notifications();
      setState(() => _items = n);
      // Clear the unread badge once the user has seen the list.
      repo.markNotificationsRead().catchError((_) {});
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Notifications")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _items.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  ])
                : _items.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        GwEmpty(
                            icon: Icons.notifications_none,
                            title: "No notifications yet"),
                      ])
                    : ListView.separated(
                        itemCount: _items.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, indent: 72),
                        itemBuilder: (_, i) => _tile(_items[i]),
                      ),
      ),
    );
  }

  Widget _tile(AppNotification n) {
    final name = n.actor?.displayName ?? tr(context, "Someone", "တစ်ယောက်");
    return Container(
      color: n.read ? null : GwColors.primary.withValues(alpha: 0.08),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        onTap: () => _open(n),
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
  void _open(AppNotification n) {
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
