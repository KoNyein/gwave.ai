import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
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
    try {
      final c = await context.read<AppState>().repo.conversations();
      setState(() => _items = c);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Chat"),
        actions: [
          IconButton(icon: const Icon(Icons.edit_square), onPressed: () {}),
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
          : GwAvatar(
              url: resolveMedia(c.other?.avatarUrl),
              name: c.displayTitle,
              size: 52,
            ),
      title: Text(c.displayTitle,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      subtitle: Text(
        c.lastMessage ?? "Tap to open",
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
      ),
      trailing: Text(timeAgo(c.lastMessageAt),
          style: const TextStyle(color: GwColors.inkSoft, fontSize: 12)),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: c)),
      ),
    );
  }
}
