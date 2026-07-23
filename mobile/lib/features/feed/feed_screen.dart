import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
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
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(9),
                border: Border.all(color: GwColors.line),
              ),
              child: Image.asset("assets/icon-512.png", fit: BoxFit.contain),
            ),
            const SizedBox(width: 8),
            const Text("Gwave"),
          ],
        ),
        actions: [
          IconButton(
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text("$_unread"),
              backgroundColor: GwColors.live,
              child: const Icon(Icons.notifications_none),
            ),
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const NotificationsScreen()),
              );
              // The screen marks everything read — clear the badge on return.
              if (mounted) setState(() => _unread = 0);
            },
          ),
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ConversationsScreen()),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: GwColors.primary,
        onPressed: _openComposer,
        child: const Icon(Icons.edit, color: Colors.white),
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
    // Index 0 is the stories rail; posts follow; a trailing loader while paging.
    return ListView.separated(
      controller: _scroll,
      padding: const EdgeInsets.only(bottom: 90),
      itemCount: _posts.length + 1 + (_end ? 0 : 1),
      separatorBuilder: (_, i) =>
          SizedBox(height: i == 0 ? 0 : 12),
      itemBuilder: (context, i) {
        if (i == 0) return const StoriesBar();
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
}
