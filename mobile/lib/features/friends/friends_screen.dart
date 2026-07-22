import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Native Friends — incoming requests you can accept/decline, requests you've
/// sent, and your friend list. Mirrors the web `/friends` page.
class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  List<Friendship> _incoming = [];
  List<Friendship> _outgoing = [];
  List<Friendship> _friends = [];
  bool _loading = true;
  String? _error;
  final _busyIds = <String>{};

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
    try {
      final repo = context.read<AppState>().repo;
      final results = await Future.wait([
        repo.incomingRequests(),
        repo.outgoingRequests(),
        repo.friends(),
      ]);
      if (mounted) {
        setState(() {
          _incoming = results[0];
          _outgoing = results[1];
          _friends = results[2];
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept(Friendship f) async {
    setState(() => _busyIds.add(f.id));
    try {
      await context.read<AppState>().repo.acceptFriend(f.id);
      await _load();
    } catch (e) {
      _snack("Couldn't accept — $e");
    } finally {
      if (mounted) setState(() => _busyIds.remove(f.id));
    }
  }

  Future<void> _remove(Friendship f, String verb) async {
    setState(() => _busyIds.add(f.id));
    try {
      await context.read<AppState>().repo.removeFriendship(f.id);
      await _load();
    } catch (e) {
      _snack("Couldn't $verb — $e");
    } finally {
      if (mounted) setState(() => _busyIds.remove(f.id));
    }
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  Future<void> _openProfile(Profile p) async {
    if (p.username == null) return;
    await openWeb(context, "/u/${p.username}", title: p.displayName);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Friends")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _friends.isEmpty && _incoming.isEmpty
            ? Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _friends.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 100),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load friends",
                        subtitle: _error),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
                    children: [
                      if (_incoming.isNotEmpty) ...[
                        _sectionTitle(
                            "Friend requests", _incoming.length, GwColors.live),
                        const SizedBox(height: 8),
                        _card(_incoming
                            .map((f) => _personRow(f, incoming: true))
                            .toList()),
                        const SizedBox(height: 16),
                      ],
                      if (_outgoing.isNotEmpty) ...[
                        _sectionTitle("Requests sent", _outgoing.length,
                            GwColors.inkSoft),
                        const SizedBox(height: 8),
                        _card(_outgoing
                            .map((f) => _personRow(f, sent: true))
                            .toList()),
                        const SizedBox(height: 16),
                      ],
                      _sectionTitle(
                          "All friends", _friends.length, GwColors.primary),
                      const SizedBox(height: 8),
                      if (_friends.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 30),
                          child: GwEmpty(
                            icon: Icons.group_outlined,
                            title: "No friends yet",
                            subtitle: "Send a request to get started.",
                          ),
                        )
                      else
                        _card(_friends.map((f) => _personRow(f)).toList()),
                    ],
                  ),
      ),
    );
  }

  Widget _sectionTitle(String title, int count, Color color) => Row(
        children: [
          Text(title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text("$count",
                style: TextStyle(
                    color: color, fontWeight: FontWeight.w800, fontSize: 12)),
          ),
        ],
      );

  Widget _card(List<Widget> rows) {
    final children = <Widget>[];
    for (var i = 0; i < rows.length; i++) {
      children.add(rows[i]);
      if (i != rows.length - 1) {
        children.add(const Divider(height: 1, indent: 66));
      }
    }
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(children: children),
    );
  }

  Widget _personRow(Friendship f, {bool incoming = false, bool sent = false}) {
    final p = f.other;
    final busy = _busyIds.contains(f.id);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      onTap: () => _openProfile(p),
      leading: GwAvatar(url: resolveMedia(p.avatarUrl), name: p.displayName, size: 46),
      title: Text(p.displayName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: p.username != null
          ? Text("@${p.username}",
              maxLines: 1, overflow: TextOverflow.ellipsis)
          : null,
      trailing: busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2.2))
          : incoming
              ? Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: Icon(Icons.check_circle,
                          color: GwColors.primary),
                      tooltip: "Accept",
                      onPressed: () => _accept(f),
                    ),
                    IconButton(
                      icon: Icon(Icons.cancel_outlined,
                          color: GwColors.inkSoft),
                      tooltip: "Decline",
                      onPressed: () => _remove(f, "decline"),
                    ),
                  ],
                )
              : sent
                  ? TextButton(
                      onPressed: () => _remove(f, "cancel"),
                      child: const Text("Cancel"),
                    )
                  : Icon(Icons.chevron_right, color: GwColors.inkSoft),
    );
  }
}
