import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../feed/post_card.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../settings/settings_screen.dart';

/// The dedicated Profile page — Facebook-style cover + avatar + bio and the
/// user's own timeline. The Me tab itself is the app's Main Menu
/// ([ProfileScreen]); this page is pushed from its header, keeping identity
/// and navigation on separate, focused screens.
class MyProfileScreen extends StatelessWidget {
  const MyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final me = state.me;
    final name = me?.displayName ?? state.api.session?.email ?? "Gwave user";

    // Facebook-style proportional cover: height follows the screen width at
    // FB's ~2.4:1 banner ratio, so photos crop the same way they do there.
    final coverH =
        (MediaQuery.of(context).size.width * 0.42).clamp(150.0, 240.0);

    const avatarSize = 108.0;
    const avatarOverlap = 54.0; // half the avatar hangs over the cover edge

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Cover + avatar live in ONE Stack so the avatar always paints
                // on top of the cover.
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Column(
                      children: [
                        SizedBox(
                          height: coverH,
                          width: double.infinity,
                          child: _cover(resolveMedia(me?.coverUrl)),
                        ),
                        // Room for the hanging half of the avatar.
                        const SizedBox(height: avatarOverlap + 10),
                      ],
                    ),
                    // Back button over the cover's top-left.
                    Positioned(
                      top: MediaQuery.of(context).padding.top + 2,
                      left: 4,
                      child: IconButton(
                        icon: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.35),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.arrow_back,
                              color: Colors.white, size: 20),
                        ),
                        onPressed: () => Navigator.of(context).maybePop(),
                      ),
                    ),
                    // Settings gear over the cover's top-right.
                    Positioned(
                      top: MediaQuery.of(context).padding.top + 2,
                      right: 4,
                      child: IconButton(
                        icon: Container(
                          padding: const EdgeInsets.all(7),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.35),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.settings,
                              color: Colors.white, size: 20),
                        ),
                        onPressed: () => _openSettings(context),
                      ),
                    ),
                    // Change-cover control, Facebook style (bottom-right of
                    // the cover itself).
                    Positioned(
                      right: 12,
                      bottom: avatarOverlap + 10 + 12,
                      child: InkWell(
                        onTap: () => _changePhoto(context, cover: true),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 7),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.45),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.photo_camera_outlined,
                                  color: Colors.white, size: 16),
                              SizedBox(width: 6),
                              Text("Cover",
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // The avatar, overlapping the cover's bottom-left with a
                    // thick page-background ring — classic Facebook.
                    Positioned(
                      left: 16,
                      top: coverH - avatarOverlap,
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(
                          color: GwColors.bg,
                          shape: BoxShape.circle,
                        ),
                        child: Stack(
                          children: [
                            GwAvatar(
                              url: resolveMedia(me?.avatarUrl),
                              name: name,
                              size: avatarSize,
                            ),
                            Positioned(
                              right: 2,
                              bottom: 2,
                              child: InkWell(
                                onTap: () =>
                                    _changePhoto(context, cover: false),
                                child: Container(
                                  width: 34,
                                  height: 34,
                                  decoration: BoxDecoration(
                                    color: GwColors.surfaceMuted,
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: GwColors.bg, width: 2.5),
                                  ),
                                  child: const Icon(Icons.photo_camera,
                                      color: GwColors.ink, size: 17),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5)),
                      if (me?.username != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text("@${me!.username}",
                              style: TextStyle(
                                  color: GwColors.inkSoftOf(context),
                                  fontSize: 14)),
                        ),
                      if (me?.bio != null && me!.bio!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(me.bio!,
                              style: TextStyle(
                                  color: GwColors.inkOf(context),
                                  fontSize: 14.5,
                                  height: 1.35)),
                        ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () => _openSettings(context),
                              icon: const Icon(Icons.edit, size: 18),
                              label: Text(tr(
                                  context, "Edit Profile", "ပရိုဖိုင် ပြင်ရန်")),
                            ),
                          ),
                          const SizedBox(width: 10),
                          OutlinedButton(
                            onPressed: () =>
                                _openWeb(context, "/u/${me?.username ?? ''}"),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: GwColors.primary,
                              backgroundColor: GwColors.surfaceOf(context),
                              side: BorderSide(color: GwColors.lineOf(context)),
                              padding: const EdgeInsets.all(14),
                            ),
                            child: const Icon(Icons.open_in_new, size: 18),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Divider(color: GwColors.lineOf(context), height: 20),
                    ],
                  ),
                ),
                // Facebook-style timeline: your own posts right on the
                // profile, newest first.
                const MyPostsSection(),
                const SizedBox(height: 30),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _cover(String? url) {
    final Widget base = (url != null && url.isNotEmpty)
        ? CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            alignment: Alignment.center,
            errorWidget: (_, __, ___) => _coverPh(),
            placeholder: (_, __) => _coverPh(),
          )
        : _coverPh();
    // Facebook-style: square-edged cover with a gentle top/bottom scrim so
    // the status icons and the Cover button stay legible on any photo.
    return Stack(
      fit: StackFit.expand,
      children: [
        base,
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x22000000), Colors.transparent, Color(0x33000000)],
              stops: [0, 0.5, 1],
            ),
          ),
        ),
      ],
    );
  }

  Widget _coverPh() => const DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              GwColors.primaryBright,
              GwColors.primary,
              GwColors.primaryDark,
            ],
          ),
        ),
      );

  /// Pick a photo and set it as the cover (or avatar) — uploads to the
  /// media bucket and updates profiles.cover_url / avatar_url, then refreshes
  /// the header.
  Future<void> _changePhoto(BuildContext context, {required bool cover}) async {
    try {
      final file = await ImagePicker().pickImage(
          source: ImageSource.gallery,
          maxWidth: cover ? 2000 : 800,
          imageQuality: 85);
      if (file == null || !context.mounted) return;
      final bytes = await file.readAsBytes();
      if (!context.mounted) return;
      final state = context.read<AppState>();
      final path = await state.api.uploadBytes(
        bytes,
        ext: "jpg",
        contentType: "image/jpeg",
      );
      if (cover) {
        await state.repo.setCoverPhoto(path);
      } else {
        await state.repo.setAvatarPhoto(path);
      }
      await state.refreshMe();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(cover
                ? "Cover updated 🖼️"
                : "Profile photo updated 🖼️")));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("Couldn't update — $e")));
      }
    }
  }

  void _openSettings(BuildContext context) => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => const SettingsScreen()));

  /// Web features open in the signed-in in-app browser.
  Future<void> _openWeb(BuildContext context, String path) =>
      openWeb(context, path);
}

/// Facebook-style timeline on the profile: the signed-in user's own posts,
/// loaded lazily and rendered with the same cards as the feed.
class MyPostsSection extends StatefulWidget {
  const MyPostsSection({super.key});

  @override
  State<MyPostsSection> createState() => _MyPostsSectionState();
}

class _MyPostsSectionState extends State<MyPostsSection> {
  List<Post> _posts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final posts = await context.read<AppState>().repo.myPosts(limit: 15);
      if (mounted) setState(() => _posts = posts);
    } catch (_) {
      // The profile stays useful without the timeline.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
          child: Text(
            tr(context, "Posts", "ပို့စ်များ"),
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
          ),
        ),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(
                child: CircularProgressIndicator(color: GwColors.primary)),
          )
        else if (_posts.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: Text(
              tr(context, "No posts yet — share something from the Feed tab.",
                  "ပို့စ် မရှိသေးပါ — Feed tab ကနေ တစ်ခုခု မျှဝေကြည့်ပါ။"),
              style:
                  TextStyle(color: GwColors.inkSoftOf(context), fontSize: 13),
            ),
          )
        else
          for (final p in _posts)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PostCard(post: p),
            ),
      ],
    );
  }
}
