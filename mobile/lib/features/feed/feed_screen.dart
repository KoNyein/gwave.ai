import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../messenger/conversations_screen.dart';
import '../notifications/notifications_screen.dart';
import '../stories/stories_bar.dart';
import 'composer_screen.dart';
import 'post_card.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _scroll = ScrollController();
  final List<Post> _posts = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _end = false;
  String? _error;
  int _unread = 0;
  int _newerBuild = 0; // > 0 when the release carries a newer APK

  @override
  void initState() {
    super.initState();
    _load(reset: true);
    _loadUnread();
    _checkUpdate();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) {
        _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      _end = false;
    } else if (_loadingMore || _end || _loading) {
      return;
    }
    final repo = context.read<AppState>().repo;
    setState(() {
      if (reset) {
        _loading = true;
        _error = null;
      } else {
        _loadingMore = true;
      }
    });
    try {
      final batch = await repo.feed(offset: reset ? 0 : _posts.length);
      setState(() {
        if (reset) _posts.clear();
        _posts.addAll(batch);
        if (batch.length < 20) _end = true;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  /// In-app update check: compare our CI build number against the rolling
  /// release's version.json. Best-effort; dev builds (APP_BUILD=0) skip it.
  Future<void> _checkUpdate() async {
    if (AppConfig.appBuild <= 0) return;
    try {
      final res = await http
          .get(Uri.parse(AppConfig.versionManifestUrl))
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return;
      final latest = (jsonDecode(res.body)["build"] as num?)?.toInt() ?? 0;
      if (mounted && latest > AppConfig.appBuild) {
        setState(() => _newerBuild = latest);
      }
    } catch (_) {}
  }

  Future<void> _loadUnread() async {
    final n =
        await context.read<AppState>().repo.unreadNotificationCount();
    if (mounted && n != _unread) setState(() => _unread = n);
  }

  Future<void> _openComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ComposerScreen()),
    );
    if (created == true) _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        // Facebook-style masthead: brand wordmark left, round gray action
        // chips right.
        title: const Text(
          "gwave",
          style: TextStyle(
            color: GwColors.primary,
            fontSize: 28,
            fontWeight: FontWeight.w900,
            letterSpacing: -1.2,
            height: 1,
          ),
        ),
        actions: [
          _HeaderChip(
            icon: Icons.add,
            onTap: _openComposer,
          ),
          _HeaderChip(
            icon: Icons.notifications,
            badge: _unread,
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              );
              // The screen marks everything read — clear the badge on return.
              if (mounted) setState(() => _unread = 0);
            },
          ),
          _HeaderChip(
            icon: Icons.chat_bubble,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ConversationsScreen()),
            ),
          ),
          const SizedBox(width: 10),
        ],
      ),
      body: Column(
        children: [
          if (_newerBuild > 0)
            Material(
              color: GwColors.primary,
              child: InkWell(
                onTap: () => launchUrl(Uri.parse(AppConfig.downloadUrl),
                    mode: LaunchMode.externalApplication),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  child: Row(
                    children: [
                      const Icon(Icons.system_update,
                          color: Colors.white, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Update ရနိုင်ပါပြီ (v1.0.$_newerBuild) — နှိပ်ပြီး ဒေါင်းလုဒ်ဆွဲပါ",
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => setState(() => _newerBuild = 0),
                        child: const Icon(Icons.close,
                            color: Colors.white70, size: 17),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: GwColors.primary,
              onRefresh: () => _load(reset: true),
              child: _buildBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: GwColors.primary),
      );
    }
    if (_error != null && _posts.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          GwEmpty(
            icon: Icons.cloud_off,
            title: "Couldn't load Feed",
            subtitle: _error,
          ),
        ],
      );
    }
    if (_posts.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          GwEmpty(
            icon: Icons.dynamic_feed,
            title: "No posts yet",
            subtitle: "Share your first post",
          ),
        ],
      );
    }
    // Index 0 is the composer pill + stories rail; posts follow; a trailing
    // loader while paging.
    return ListView.separated(
      controller: _scroll,
      padding: const EdgeInsets.only(bottom: 90),
      itemCount: _posts.length + 1 + (_end ? 0 : 1),
      separatorBuilder: (_, i) =>
          SizedBox(height: i == 0 ? 0 : 8),
      itemBuilder: (context, i) {
        if (i == 0) {
          return Column(
            children: [
              _composerRow(),
              const SizedBox(height: 8),
              const StoriesBar(),
            ],
          );
        }
        final idx = i - 1;
        if (idx >= _posts.length) {
          return const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
              child: CircularProgressIndicator(color: GwColors.primary),
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: PostCard(post: _posts[idx]),
        );
      },
    );
  }

  /// Facebook-style "What's on your mind?" row: my avatar, the composer pill,
  /// and a photo shortcut — all opening the composer.
  Widget _composerRow() {
    final me = context.read<AppState>().me;
    return Container(
      color: GwColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          GwAvatar(
            url: resolveMedia(me?.avatarUrl),
            name: me?.displayName ?? "Me",
            size: 38,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: _openComposer,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                decoration: BoxDecoration(
                  color: GwColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: GwColors.line, width: 1.2),
                ),
                child: const Text(
                  "ဘာတွေ တွေးနေလဲ?",
                  style: TextStyle(color: GwColors.inkSoft, fontSize: 15),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          IconButton(
            onPressed: _openComposer,
            icon: const Icon(Icons.photo_library,
                color: Color(0xFF45BD62), size: 26),
          ),
        ],
      ),
    );
  }
}

/// Round light-gray icon button, the Facebook header chip.
class _HeaderChip extends StatelessWidget {
  const _HeaderChip({required this.icon, required this.onTap, this.badge = 0});
  final IconData icon;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Badge(
          isLabelVisible: badge > 0,
          label: Text("$badge"),
          backgroundColor: GwColors.live,
          child: Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: GwColors.surfaceMuted,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 21, color: GwColors.ink),
          ),
        ),
      ),
    );
  }
}
