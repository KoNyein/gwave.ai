import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

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
    final name = n.actor?.displayName ?? "Someone";
    return Container(
      color: n.read ? null : GwColors.primary.withValues(alpha: 0.06),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: GwAvatar(
            url: resolveMedia(n.actor?.avatarUrl), name: name, size: 46),
        title: Text.rich(
          TextSpan(children: [
            TextSpan(
                text: name,
                style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(
                text: " ${_verb(n.type)}",
                style: const TextStyle(color: GwColors.ink)),
          ]),
        ),
        subtitle: Text(timeAgo(n.createdAt),
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 12)),
        trailing: Icon(_icon(n.type), color: GwColors.primary, size: 20),
      ),
    );
  }

  String _verb(String type) {
    switch (type) {
      case "friend_request":
        return "sent you a friend request";
      case "friend_accepted":
        return "accepted your friend request";
      case "post_reaction":
        return "liked your post";
      case "post_comment":
        return "commented on your post";
      case "comment_reply":
        return "replied to your comment";
      case "post_share":
        return "shared your post";
      case "new_follower":
        return "started following you";
      case "device_alert":
        return "device alert";
      default:
        return "new notification";
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
      case "friend_request":
      case "friend_accepted":
        return Icons.person_add;
      case "device_alert":
        return Icons.sensors;
      default:
        return Icons.notifications;
    }
  }
}
