import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../feed/post_card.dart';

/// Native Groups — your groups, public groups to discover (with one-tap
/// join), and a native group feed built from the same post cards as Home.
class GroupsScreen extends StatefulWidget {
  const GroupsScreen({super.key});

  @override
  State<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends State<GroupsScreen> {
  List<Group> _mine = [];
  List<Group> _discover = [];
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
      final g = await context.read<AppState>().repo.groups();
      if (mounted) {
        setState(() {
          _mine = g.mine;
          _discover = g.discover;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join(Group g) async {
    setState(() => _busyIds.add(g.id));
    try {
      await context.read<AppState>().repo.joinGroup(g.id);
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text("${tr(context, "Joined", "ဝင်ပြီးပါပြီ")} ${g.name} ✓"),
              backgroundColor: GwColors.primary),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("${tr(context, "Couldn't join", "မဝင်နိုင်ပါ")} — $e")),
        );
      }
    } finally {
      if (mounted) setState(() => _busyIds.remove(g.id));
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Groups"),
        actions: [
          TextButton.icon(
            onPressed: () => _openWeb("/groups/new"),
            icon: const Icon(Icons.add, size: 18),
            label: Text(tr(context, "Create", "ဖွဲ့ရန်")),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _mine.isEmpty && _discover.isEmpty
            ? Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _mine.isEmpty && _discover.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 100),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load groups",
                        subtitle: _error),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                    children: [
                      if (_mine.isNotEmpty) ...[
                        Text(tr(context, "My groups", "ကျွန်ုပ်၏ Groups"),
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 10),
                        ..._mine.map((g) => _groupCard(g)),
                        const SizedBox(height: 14),
                      ],
                      Text(tr(context, "Discover", "ရှာဖွေရန်"),
                          style: const TextStyle(
                              fontSize: 16, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 10),
                      if (_discover.isEmpty)
                        GwEmpty(
                          icon: Icons.grid_view_outlined,
                          title: tr(context, "No groups to discover yet", "Group အသစ် မရှိသေးပါ"),
                        )
                      else
                        ..._discover.map((g) => _groupCard(g)),
                    ],
                  ),
      ),
    );
  }

  Widget _groupCard(Group g) {
    final busy = _busyIds.contains(g.id);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: g.isMember
            ? () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => GroupFeedScreen(group: g)),
                )
            : null,
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(13),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: g.coverUrl != null && g.coverUrl!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: resolveMedia(g.coverUrl) ?? g.coverUrl!,
                          fit: BoxFit.cover,
                          errorWidget: (_, __, ___) => _ph(),
                          placeholder: (_, __) => _ph(),
                        )
                      : _ph(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    Text(
                      "${g.memberCount} members${g.privacy == "private" ? " · Private" : ""}",
                      style: TextStyle(
                          color: GwColors.inkSoft, fontSize: 12.5),
                    ),
                  ],
                ),
              ),
              if (g.isMember)
                Icon(Icons.chevron_right, color: GwColors.inkSoft)
              else if (busy)
                const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2))
              else
                TextButton(
                  onPressed: () => _join(g),
                  style: TextButton.styleFrom(
                    backgroundColor:
                        GwColors.primary.withValues(alpha: 0.1),
                  ),
                  child: Text(tr(context, "Join", "ဝင်မည်")),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _ph() => Container(
        color: GwColors.primary.withValues(alpha: 0.12),
        child: Icon(Icons.groups_2, color: GwColors.primary, size: 26),
      );
}

/// A group's post feed, reusing the same PostCard as the Home tab.
class GroupFeedScreen extends StatefulWidget {
  const GroupFeedScreen({super.key, required this.group});
  final Group group;

  @override
  State<GroupFeedScreen> createState() => _GroupFeedScreenState();
}

class _GroupFeedScreenState extends State<GroupFeedScreen> {
  List<Post> _posts = [];
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
      final p =
          await context.read<AppState>().repo.groupFeed(widget.group.id);
      if (mounted) setState(() => _posts = p);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.group.name)),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _posts.isEmpty
            ? Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _posts.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 100),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load posts",
                        subtitle: _error),
                  ])
                : _posts.isEmpty
                    ? ListView(children: [
                        const SizedBox(height: 100),
                        GwEmpty(
                          icon: Icons.forum_outlined,
                          title: tr(context, "No posts yet", "Post မရှိသေးပါ"),
                          subtitle: tr(context, "Be the first to post!",
                              "ပထမဆုံး ရေးတဲ့သူ ဖြစ်လိုက်ပါ!"),
                        ),
                      ])
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(0, 8, 0, 40),
                        itemCount: _posts.length,
                        itemBuilder: (_, i) => PostCard(post: _posts[i]),
                      ),
      ),
    );
  }
}
