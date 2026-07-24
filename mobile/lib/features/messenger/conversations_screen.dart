import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'chat_screen.dart';

class ConversationsScreen extends StatefulWidget {
  const ConversationsScreen({super.key});

  @override
  State<ConversationsScreen> createState() => _ConversationsScreenState();
}

class _ConversationsScreenState extends State<ConversationsScreen> {
  List<Conversation> _items = [];
  Map<String, DateTime> _presence = {}; // user id → last_seen_at
  Timer? _presencePoll;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    // Keep the online dots fresh while the list is open.
    _presencePoll =
        Timer.periodic(const Duration(seconds: 45), (_) => _loadPresence());
  }

  @override
  void dispose() {
    _presencePoll?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final c = await context.read<AppState>().repo.conversations();
      setState(() => _items = c);
      _loadPresence();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadPresence() async {
    if (!mounted) return;
    final ids = _items
        .map((c) => c.other?.id)
        .whereType<String>()
        .toList();
    final p = await context.read<AppState>().repo.presenceFor(ids);
    if (mounted && p.isNotEmpty) setState(() => _presence = p);
  }

  bool _isOnline(String? userId) {
    final t = userId == null ? null : _presence[userId];
    return t != null &&
        DateTime.now().difference(t) < const Duration(minutes: 2);
  }

  /// Start a new chat: pick a friend, then open (or create) the 1-to-1 thread.
  Future<void> _startChat() async {
    final repo = context.read<AppState>().repo;
    List<Friendship> friends;
    try {
      friends = await repo.friends();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't load friends — $e")),
        );
      }
      return;
    }
    if (!mounted) return;
    if (friends.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Add friends first to start a chat.",
            "စကားပြောရန် သူငယ်ချင်း အရင်ထည့်ပါ။")),
      ));
      return;
    }

    final picked = await showModalBottomSheet<Profile>(
      context: context,
      backgroundColor: GwColors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Text(tr(ctx, "New message", "စာအသစ်"),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 6),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: friends.length,
                itemBuilder: (_, i) {
                  final f = friends[i].other;
                  return ListTile(
                    leading: GwAvatar(
                        url: resolveMedia(f.avatarUrl),
                        name: f.displayName,
                        size: 44),
                    title: Text(f.displayName,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: f.username != null
                        ? Text("@${f.username}",
                            style: const TextStyle(
                                color: GwColors.inkSoft, fontSize: 12))
                        : null,
                    onTap: () => Navigator.of(ctx).pop(f),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (picked == null || !mounted) return;

    try {
      final convo = await repo.openConversationWith(picked);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: convo)),
      );
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't open the chat — $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Chat"),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_square),
            tooltip: tr(context, "New message", "စာအသစ်"),
            onPressed: _startChat,
          ),
        ],
      ),
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
                        title: "Couldn't load Chat",
                        subtitle: _error),
                  ])
                : _items.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        GwEmpty(
                            icon: Icons.chat_bubble_outline,
                            title: "No conversations yet"),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.only(bottom: 90),
                        itemCount: _items.length,
                        separatorBuilder: (_, __) => const Divider(
                            height: 1, indent: 78, color: GwColors.line),
                        itemBuilder: (_, i) => _tile(_items[i]),
                      ),
      ),
    );
  }

  Widget _tile(Conversation c) {
    final online = !c.isGroup && _isOnline(c.other?.id);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      leading: c.isGroup
          ? Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.groups, color: GwColors.primary),
            )
          : Stack(
              clipBehavior: Clip.none,
              children: [
                GwAvatar(
                  url: resolveMedia(c.other?.avatarUrl),
                  name: c.displayTitle,
                  size: 52,
                ),
                // Messenger-style online dot.
                if (online)
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Container(
                      width: 15,
                      height: 15,
                      decoration: BoxDecoration(
                        color: const Color(0xFF31A24C),
                        shape: BoxShape.circle,
                        border: Border.all(color: GwColors.bg, width: 2.5),
                      ),
                    ),
                  ),
              ],
            ),
      title: Text(c.displayTitle,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      subtitle: Text(
        online
            ? tr(context, "Active now", "အွန်လိုင်းရှိသည်")
            : (c.lastMessage ?? "Tap to open"),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
            color: online ? const Color(0xFF31A24C) : GwColors.inkSoft,
            fontSize: 13,
            fontWeight: online ? FontWeight.w600 : FontWeight.w400),
      ),
      trailing: Text(timeAgo(c.lastMessageAt),
          style: const TextStyle(color: GwColors.inkSoft, fontSize: 12)),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: c)),
      ),
    );
  }
}
