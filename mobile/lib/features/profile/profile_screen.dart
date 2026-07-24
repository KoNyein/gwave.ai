import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../feed/post_card.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../boost/boost_screen.dart';
import '../cctv/cctv_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../health/health_hub_screen.dart';
import '../dating/dating_screen.dart';
import '../drone/drone_scanner_screen.dart';
import '../family/family_screen.dart';
import '../farm/farm_screen.dart';
import '../finance/finance_screen.dart';
import '../friends/friends_screen.dart';
import '../games/games_screen.dart';
import '../gpay/gpay_screen.dart';
import '../groups/groups_screen.dart';
import '../jobs/jobs_screen.dart';
import '../knowledge/minerals_screen.dart';
import '../knowledge/strains_screen.dart';
import '../learn/learn_screen.dart';
import '../map/map_screen.dart';
import '../market/market_screen.dart';
import '../pos/pos_sell_screen.dart';
import '../settings/settings_screen.dart';
import '../talk/talk_screen.dart';
import '../tools/tools_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, this.onSelectTab});

  /// Lets menu entries that map to a bottom tab (Home/Live/Reels/Shop) switch
  /// the shell tab instead of opening the web app.
  final void Function(int index)? onSelectTab;

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
                // on top of the cover. (A pinned SliverAppBar used to paint
                // over the translated avatar and swallow its top half.)
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
                              label: const Text("Edit Profile"),
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
                _menu(context),
                // Facebook-style timeline: your own posts right on the
                // profile, newest first.
                const _MyPostsSection(),
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

  /// The full Gwave menu, grouped exactly like the web sidebar
  /// (`src/components/layout/nav-items.ts`) but rendered as a modern super-app
  /// launcher: each category is its own card with a color-accented header and a
  /// 4-up grid of tinted icon tiles. Tabbed entries switch the bottom tab;
  /// Farm + Cameras are native; everything else opens the web app.
  Widget _menu(BuildContext context) {
    final sections = <_MenuSection>[
      _MenuSection("Social", Icons.groups_2_outlined, const Color(0xFF3B6D11), [
        _MenuEntry(Icons.home_outlined, "Home", tab: 0),
        _MenuEntry(Icons.dashboard_outlined, "Dashboard",
            native: _Native.dashboard),
        _MenuEntry(Icons.group_outlined, "Friends", native: _Native.friends),
        _MenuEntry(Icons.grid_view_outlined, "Groups", native: _Native.groups),
        _MenuEntry(Icons.flag_outlined, "Pages", web: "/pages"),
        _MenuEntry(Icons.sensors, "Live", tab: 2),
        _MenuEntry(Icons.record_voice_over_outlined, "Walkie",
            native: _Native.talk),
        _MenuEntry(Icons.movie_outlined, "Reels", tab: 1),
        _MenuEntry(Icons.sports_esports_outlined, "Games",
            native: _Native.games),
        _MenuEntry(Icons.favorite_outline, "Dating", native: _Native.dating),
      ]),
      _MenuSection("Learning", Icons.school_outlined, const Color(0xFF2E7DB1), [
        _MenuEntry(Icons.menu_book_outlined, "Learn", native: _Native.learn),
        _MenuEntry(Icons.emoji_events_outlined, "Leaderboard", web: "/leaderboard"),
        _MenuEntry(Icons.monitor_heart_outlined, "Health",
            native: _Native.health),
        _MenuEntry(Icons.spa_outlined, "Wellness", web: "/wellness"),
      ]),
      _MenuSection("Farm & Home", Icons.eco_outlined, const Color(0xFF2E9E5B), [
        _MenuEntry(Icons.agriculture_outlined, "Farm", native: _Native.farm),
        _MenuEntry(Icons.lightbulb_outline, "Smart Home", web: "/home"),
        _MenuEntry(Icons.videocam_outlined, "Cameras", native: _Native.cctv),
        _MenuEntry(Icons.location_on_outlined, "Family",
            native: _Native.family),
        _MenuEntry(Icons.map_outlined, "Map", native: _Native.map),
        _MenuEntry(Icons.radar, "Drone radar", native: _Native.drone),
        _MenuEntry(Icons.emergency_outlined, "SOS", native: _Native.map),
      ]),
      _MenuSection("Shop & Business", Icons.storefront_outlined,
          const Color(0xFF7A4DD6), [
        _MenuEntry(Icons.storefront_outlined, "Shop", tab: 3),
        _MenuEntry(Icons.sell_outlined, "Market", native: _Native.market),
        _MenuEntry(Icons.work_outline, "Jobs", native: _Native.jobs),
        _MenuEntry(Icons.point_of_sale_outlined, "POS", native: _Native.pos),
        _MenuEntry(Icons.rocket_launch_outlined, "Boost",
            native: _Native.boost),
        _MenuEntry(Icons.account_balance_wallet_outlined, "G-Pay",
            native: _Native.gpay),
        _MenuEntry(Icons.account_balance_outlined, "Finance",
            native: _Native.finance),
        _MenuEntry(Icons.workspace_premium_outlined, "Member", web: "/membership"),
      ]),
      _MenuSection("Knowledge & Tools", Icons.auto_stories_outlined,
          const Color(0xFF139C9C), [
        _MenuEntry(Icons.eco_outlined, "Strains", native: _Native.strains),
        _MenuEntry(Icons.diamond_outlined, "Minerals",
            native: _Native.minerals),
        _MenuEntry(Icons.calculate_outlined, "Tools", native: _Native.tools),
      ]),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final s in sections) ...[
            _categoryCard(context, s),
            const SizedBox(height: 12),
          ],
          // Log out
          _card(
            context,
            InkWell(
              borderRadius: BorderRadius.circular(GwRadius.lg),
              onTap: () {
                final state = context.read<AppState>();
                Navigator.of(context).popUntil((r) => r.isFirst);
                state.logout();
              },
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: GwColors.live.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: const Icon(Icons.logout,
                          color: GwColors.live, size: 19),
                    ),
                    const SizedBox(width: 12),
                    Text(tr(context, "Log out", "ထွက်မည်"),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                            color: GwColors.live)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// A category = a "system module": an accent-tinted header strip on top of a
  /// theme-aware surface card, then a tight 4-up grid of tinted icon tiles.
  Widget _categoryCard(BuildContext context, _MenuSection s) {
    return _card(
      context,
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Accent header strip.
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: s.accent.withValues(alpha: 0.10),
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(GwRadius.lg)),
            ),
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: s.accent.withValues(alpha: 0.20),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(s.icon, color: s.accent, size: 17),
                ),
                const SizedBox(width: 10),
                Text(
                  s.title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: GwColors.inkOf(context),
                    letterSpacing: -0.2,
                  ),
                ),
                const Spacer(),
                Text("${s.items.length}",
                    style: TextStyle(
                        color: s.accent.withValues(alpha: 0.8),
                        fontWeight: FontWeight.w800,
                        fontSize: 13)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
            child: GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 6,
              crossAxisSpacing: 2,
              childAspectRatio: 0.82,
              children: s.items
                  .map((e) => _gridTile(context, e, s.accent))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _gridTile(BuildContext context, _MenuEntry e, Color accent) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => _handle(context, e),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  accent.withValues(alpha: 0.22),
                  accent.withValues(alpha: 0.09),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: accent.withValues(alpha: 0.16)),
            ),
            child: Icon(e.icon, color: accent, size: 24),
          ),
          const SizedBox(height: 6),
          Text(
            e.label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              height: 1.1,
              fontWeight: FontWeight.w600,
              color: GwColors.inkOf(context),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(BuildContext context, Widget child) => Container(
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          border: Border.all(color: GwColors.lineOf(context)),
          boxShadow: GwShadow.card,
        ),
        child: child,
      );

  void _handle(BuildContext context, _MenuEntry e) {
    if (e.tab != null) {
      onSelectTab?.call(e.tab!);
      return;
    }
    switch (e.native) {
      case _Native.farm:
        _push(context, const FarmScreen());
        return;
      case _Native.cctv:
        _push(context, const CctvScreen());
        return;
      case _Native.tools:
        _push(context, const ToolsScreen());
        return;
      case _Native.dashboard:
        _push(context, DashboardScreen(onSelectTab: onSelectTab));
        return;
      case _Native.health:
        _push(context, const HealthHubScreen());
        return;
      case _Native.friends:
        _push(context, const FriendsScreen());
        return;
      case _Native.games:
        _push(context, const GamesScreen());
        return;
      case _Native.talk:
        _push(context, const TalkScreen());
        return;
      case _Native.map:
        _push(context, const MapScreen());
        return;
      case _Native.gpay:
        _push(context, const GpayScreen());
        return;
      case _Native.jobs:
        _push(context, const JobsScreen());
        return;
      case _Native.pos:
        _push(context, const PosSellScreen());
        return;
      case _Native.finance:
        _push(context, const FinanceScreen());
        return;
      case _Native.groups:
        _push(context, const GroupsScreen());
        return;
      case _Native.learn:
        _push(context, const LearnScreen());
        return;
      case _Native.strains:
        _push(context, const StrainsScreen());
        return;
      case _Native.minerals:
        _push(context, const MineralsScreen());
        return;
      case _Native.market:
        _push(context, const MarketScreen());
        return;
      case _Native.dating:
        _push(context, const DatingScreen());
        return;
      case _Native.family:
        _push(context, const FamilyScreen());
        return;
      case _Native.boost:
        _push(context, const BoostScreen());
        return;
      case _Native.drone:
        _push(context, const DroneScannerScreen());
        return;
      case null:
        break;
    }
    if (e.web != null) _openWeb(context, e.web!);
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  /// Pick a photo and set it as the cover (or avatar) — uploads to the
  /// avatars bucket (what resolveMedia expects for profile art) and updates
  /// profiles.cover_url / avatar_url, then refreshes the header.
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
      // The mobile upload endpoint only signs the media bucket; on the S3
      // data plane every key resolves through the same CDN, so profile art
      // lives there too.
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

  void _openSettings(BuildContext context) =>
      _push(context, const SettingsScreen());

  /// Web features open in the signed-in in-app browser.
  Future<void> _openWeb(BuildContext context, String path) =>
      openWeb(context, path);
}

/// A native screen a menu entry can push directly (no web hand-off).
enum _Native {
  farm,
  cctv,
  tools,
  dashboard,
  friends,
  games,
  talk,
  map,
  gpay,
  jobs,
  pos,
  finance,
  groups,
  learn,
  strains,
  minerals,
  market,
  dating,
  family,
  boost,
  health,
  drone,
}

/// One category of the launcher menu: a titled, color-accented card of tiles.
class _MenuSection {
  const _MenuSection(this.title, this.icon, this.accent, this.items);
  final String title;
  final IconData icon;
  final Color accent;
  final List<_MenuEntry> items;
}

/// One menu row. Exactly one destination is set: [tab] switches the bottom
/// tab, [native] pushes a native screen, [web] opens the web app.
class _MenuEntry {
  const _MenuEntry(this.icon, this.label, {this.tab, this.native, this.web});
  final IconData icon;
  final String label;
  final int? tab;
  final _Native? native;
  final String? web;
}

/// Facebook-style timeline on the profile: the signed-in user's own posts,
/// loaded lazily and rendered with the same cards as the feed.
class _MyPostsSection extends StatefulWidget {
  const _MyPostsSection();

  @override
  State<_MyPostsSection> createState() => _MyPostsSectionState();
}

class _MyPostsSectionState extends State<_MyPostsSection> {
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
