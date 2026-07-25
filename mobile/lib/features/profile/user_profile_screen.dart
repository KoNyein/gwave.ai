import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../messenger/video_view_screen.dart';

/// A native, international-standard user profile: a cover + avatar header, name,
/// bio and live stats, then tabbed Posts / Photos / Videos grids built from the
/// owner's own posts. The account owner controls which sections are shown on
/// their profile (persisted per account), so they curate what's displayed.
class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  Profile? _me;
  List<Post> _posts = [];
  int _friends = 0;
  bool _loading = true;

  // Owner display controls — which sections show on the profile.
  bool _showPosts = true;
  bool _showPhotos = true;
  bool _showVideos = true;

  String get _prefKey => "gw_profile_sections_${_me?.id ?? "me"}";

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final repo = context.read<AppState>().repo;
    try {
      final me = await repo.myProfile();
      final posts = await repo.myPosts(limit: 60);
      int friends = 0;
      try {
        friends = (await repo.friends()).length;
      } catch (_) {}
      final prefs = await SharedPreferences.getInstance();
      final key = "gw_profile_sections_${me?.id ?? "me"}";
      if (mounted) {
        setState(() {
          _me = me;
          _posts = posts;
          _friends = friends;
          _showPosts = prefs.getBool("${key}_posts") ?? true;
          _showPhotos = prefs.getBool("${key}_photos") ?? true;
          _showVideos = prefs.getBool("${key}_videos") ?? true;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _savePrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool("${_prefKey}_posts", _showPosts);
    await prefs.setBool("${_prefKey}_photos", _showPhotos);
    await prefs.setBool("${_prefKey}_videos", _showVideos);
  }

  List<PostMedia> get _photos => [
        for (final p in _posts)
          ...p.media.where((m) => m.mediaType == "image"),
      ];

  List<({PostMedia media, Post post})> get _videos => [
        for (final p in _posts)
          for (final m in p.media.where((m) => m.mediaType == "video"))
            (media: m, post: p),
      ];

  List<String> get _tabs {
    final t = <String>[];
    if (_showPosts) t.add("posts");
    if (_showPhotos) t.add("photos");
    if (_showVideos) t.add("videos");
    return t;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(tr(context, "Profile", "ပရိုဖိုင်"))),
        body: const Center(
            child: CircularProgressIndicator(color: GwColors.primary)),
      );
    }
    final tabs = _tabs;
    return DefaultTabController(
      length: tabs.isEmpty ? 1 : tabs.length,
      child: Scaffold(
        body: NestedScrollView(
          headerSliverBuilder: (ctx, _) => [
            SliverAppBar(
              pinned: true,
              expandedHeight: 250,
              actions: [
                IconButton(
                  icon: const Icon(Icons.tune),
                  tooltip: tr(context, "Display settings", "ပြသမှု ဆက်တင်"),
                  onPressed: _ownerControls,
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: _header(),
                collapseMode: CollapseMode.pin,
              ),
              bottom: tabs.isEmpty
                  ? null
                  : TabBar(
                      labelColor: GwColors.primary,
                      unselectedLabelColor: GwColors.inkSoftOf(context),
                      indicatorColor: GwColors.primary,
                      tabs: [for (final t in tabs) Tab(text: _tabLabel(t))],
                    ),
            ),
          ],
          body: tabs.isEmpty
              ? Center(
                  child: GwEmpty(
                    icon: Icons.visibility_off_outlined,
                    title: tr(context, "All sections are hidden",
                        "အပိုင်းအားလုံး ဖျောက်ထားသည်"),
                    subtitle: tr(context,
                        "Tap the settings icon to show your posts, photos or videos.",
                        "ဆက်တင် ကို နှိပ်၍ သင့် post/ဓာတ်ပုံ/ဗီဒီယို ပြပါ။"),
                  ),
                )
              : TabBarView(
                  children: [for (final t in tabs) _tabView(t)],
                ),
        ),
      ),
    );
  }

  String _tabLabel(String t) {
    switch (t) {
      case "photos":
        return tr(context, "Photos ${_photos.length}", "ဓာတ်ပုံ ${_photos.length}");
      case "videos":
        return tr(context, "Videos ${_videos.length}", "ဗီဒီယို ${_videos.length}");
      default:
        return tr(context, "Posts ${_posts.length}", "ပို့စ် ${_posts.length}");
    }
  }

  Widget _tabView(String t) {
    switch (t) {
      case "photos":
        return _photoGrid();
      case "videos":
        return _videoGrid();
      default:
        return _postList();
    }
  }

  Widget _header() {
    final me = _me;
    final cover = resolveMedia(me?.coverUrl);
    return Stack(
      fit: StackFit.expand,
      children: [
        // Cover
        cover != null
            ? CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover)
            : Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF16351F), Color(0xFF0F2A16)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
        // Scrim for text legibility
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withValues(alpha: 0.1),
                Colors.black.withValues(alpha: 0.65),
              ],
            ),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: 12,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
                child: GwAvatar(
                  url: resolveMedia(me?.avatarUrl),
                  name: me?.displayName ?? "?",
                  size: 76,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            me?.displayName ?? "",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 20,
                                shadows: [
                                  Shadow(color: Colors.black, blurRadius: 6)
                                ]),
                          ),
                        ),
                        if (me?.isOnline ?? false) ...[
                          const SizedBox(width: 6),
                          Container(
                            width: 11,
                            height: 11,
                            decoration: BoxDecoration(
                              color: const Color(0xFF31A24C),
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.white, width: 2),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (me?.username != null)
                      Text("@${me!.username}",
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 13,
                              shadows: const [
                                Shadow(color: Colors.black, blurRadius: 6)
                              ])),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        _stat("${_posts.length}", tr(context, "posts", "ပို့စ်")),
                        const SizedBox(width: 16),
                        _stat("${_photos.length}",
                            tr(context, "photos", "ဓာတ်ပုံ")),
                        const SizedBox(width: 16),
                        _stat("$_friends", tr(context, "friends", "သူငယ်ချင်း")),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _stat(String value, String label) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value,
            style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 16,
                shadows: [Shadow(color: Colors.black, blurRadius: 6)])),
        Text(label,
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 11,
                shadows: const [Shadow(color: Colors.black, blurRadius: 6)])),
      ],
    );
  }

  Widget _postList() {
    if (_posts.isEmpty) {
      return _empty(tr(context, "No posts yet", "ပို့စ် မရှိသေးပါ"));
    }
    return RefreshIndicator(
      color: GwColors.primary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _posts.length,
        itemBuilder: (_, i) => _postCard(_posts[i]),
      ),
    );
  }

  Widget _postCard(Post p) {
    final img = p.firstImage;
    final hasVideo = p.firstVideo != null;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (p.content.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
              child: Text(p.content,
                  style: const TextStyle(fontSize: 14.5, height: 1.35)),
            ),
          if (img != null && !hasVideo)
            ClipRRect(
              borderRadius: p.content.trim().isEmpty
                  ? const BorderRadius.vertical(top: Radius.circular(GwRadius.lg))
                  : BorderRadius.zero,
              child: CachedNetworkImage(
                imageUrl: resolveMedia(img.storagePath, bucket: "media") ?? "",
                fit: BoxFit.cover,
                width: double.infinity,
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          if (hasVideo)
            _videoThumb(p.firstVideo!, p),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                _metric(Icons.favorite_border, p.reactionCount),
                const SizedBox(width: 16),
                _metric(Icons.mode_comment_outlined, p.commentCount),
                const SizedBox(width: 16),
                _metric(Icons.share_outlined, p.shareCount),
                const Spacer(),
                Text(timeAgo(p.createdAt),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(IconData icon, int n) {
    return Row(
      children: [
        Icon(icon, size: 17, color: GwColors.inkSoftOf(context)),
        const SizedBox(width: 4),
        Text("$n",
            style: TextStyle(
                color: GwColors.inkSoftOf(context),
                fontSize: 12.5,
                fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _videoThumb(PostMedia v, Post p) {
    return InkWell(
      onTap: () => _openVideo(v),
      child: Container(
        height: 200,
        color: Colors.black,
        alignment: Alignment.center,
        child: const CircleAvatar(
          radius: 26,
          backgroundColor: Colors.black45,
          child: Icon(Icons.play_arrow, color: Colors.white, size: 34),
        ),
      ),
    );
  }

  Widget _photoGrid() {
    final photos = _photos;
    if (photos.isEmpty) {
      return _empty(tr(context, "No photos yet", "ဓာတ်ပုံ မရှိသေးပါ"));
    }
    return RefreshIndicator(
      color: GwColors.primary,
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.all(3),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          mainAxisSpacing: 3,
          crossAxisSpacing: 3,
        ),
        itemCount: photos.length,
        itemBuilder: (_, i) {
          final url = resolveMedia(photos[i].storagePath, bucket: "media");
          return GestureDetector(
            onTap: () => _openPhoto(photos, i),
            child: CachedNetworkImage(
              imageUrl: url ?? "",
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => Container(
                color: GwColors.surfaceMutedOf(context),
                child: Icon(Icons.broken_image_outlined,
                    color: GwColors.inkSoftOf(context)),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _videoGrid() {
    final videos = _videos;
    if (videos.isEmpty) {
      return _empty(tr(context, "No videos yet", "ဗီဒီယို မရှိသေးပါ"));
    }
    return RefreshIndicator(
      color: GwColors.primary,
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.all(3),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 3,
          crossAxisSpacing: 3,
          childAspectRatio: 1,
        ),
        itemCount: videos.length,
        itemBuilder: (_, i) {
          return GestureDetector(
            onTap: () => _openVideo(videos[i].media),
            child: Container(
              color: Colors.black,
              alignment: Alignment.center,
              child: const CircleAvatar(
                radius: 22,
                backgroundColor: Colors.black45,
                child: Icon(Icons.play_arrow, color: Colors.white, size: 30),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _empty(String title) {
    return ListView(children: [
      const SizedBox(height: 80),
      GwEmpty(icon: Icons.inbox_outlined, title: title),
    ]);
  }

  void _openVideo(PostMedia v) {
    final url = resolveMedia(v.storagePath, bucket: "media");
    if (url == null) return;
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => VideoViewScreen(url: url, title: "Video"),
    ));
  }

  void _openPhoto(List<PostMedia> photos, int index) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _PhotoViewer(photos: photos, initialIndex: index),
    ));
  }

  Future<void> _ownerControls() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, "Display on my profile", "ကျွန်ုပ်ပရိုဖိုင်တွင် ပြသရန်"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 17)),
                const SizedBox(height: 4),
                Text(
                    tr(context,
                        "Choose which of your sections other people can see.",
                        "အခြားသူများ မြင်နိုင်မယ့် အပိုင်းများကို ရွေးပါ။"),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12.5)),
                const SizedBox(height: 8),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: GwColors.primary,
                  title: Text(tr(context, "Posts", "ပို့စ်")),
                  value: _showPosts,
                  onChanged: (v) {
                    setSheet(() => _showPosts = v);
                    setState(() {});
                    _savePrefs();
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: GwColors.primary,
                  title: Text(tr(context, "Photos", "ဓာတ်ပုံ")),
                  value: _showPhotos,
                  onChanged: (v) {
                    setSheet(() => _showPhotos = v);
                    setState(() {});
                    _savePrefs();
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: GwColors.primary,
                  title: Text(tr(context, "Videos", "ဗီဒီယို")),
                  value: _showVideos,
                  onChanged: (v) {
                    setSheet(() => _showVideos = v);
                    setState(() {});
                    _savePrefs();
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A swipeable, zoomable fullscreen photo viewer for the profile grids.
class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.photos, required this.initialIndex});
  final List<PostMedia> photos;
  final int initialIndex;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer> {
  late final PageController _pc =
      PageController(initialPage: widget.initialIndex);
  late int _index = widget.initialIndex;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text("${_index + 1} / ${widget.photos.length}",
            style: const TextStyle(color: Colors.white, fontSize: 15)),
      ),
      body: PageView.builder(
        controller: _pc,
        onPageChanged: (i) => setState(() => _index = i),
        itemCount: widget.photos.length,
        itemBuilder: (_, i) {
          final url = resolveMedia(widget.photos[i].storagePath, bucket: "media");
          return InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: Center(
              child: CachedNetworkImage(
                imageUrl: url ?? "",
                fit: BoxFit.contain,
                placeholder: (_, __) => const Center(
                    child: CircularProgressIndicator(color: Colors.white)),
                errorWidget: (_, __, ___) => const Icon(
                    Icons.broken_image_outlined, color: Colors.white54),
              ),
            ),
          );
        },
      ),
    );
  }
}
