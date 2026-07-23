import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../boost/boost_screen.dart';
import '../cctv/cctv_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../dating/dating_screen.dart';
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

    // Facebook-style proportional cover: height follows the screen width
    // (≈1.9:1) so the photo isn't squashed into a thin strip on any device.
    final coverH =
        (MediaQuery.of(context).size.width * 0.52).clamp(160.0, 280.0);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: coverH,
            pinned: true,
            backgroundColor: GwColors.primary,
            flexibleSpace: FlexibleSpaceBar(
              background: Stack(
                fit: StackFit.expand,
                children: [
                  _cover(resolveMedia(me?.coverUrl)),
                  // Change-cover control, Facebook style (bottom-right).
                  Positioned(
                    right: 12,
                    bottom: 12,
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
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings, color: Colors.white),
                onPressed: () => _openSettings(context),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -44),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: GwColors.bg,
                      shape: BoxShape.circle,
                      boxShadow: GwShadow.card,
                    ),
                    child: Stack(
                      children: [
                        GwAvatar(
                          url: resolveMedia(me?.avatarUrl),
                          name: name,
                          size: 96,
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: InkWell(
                            onTap: () => _changePhoto(context, cover: false),
                            child: Container(
                              width: 30,
                              height: 30,
                              decoration: BoxDecoration(
                                color: GwColors.primary,
                                shape: BoxShape.circle,
                                border:
                                    Border.all(color: Colors.white, width: 2),
                              ),
                              child: const Icon(Icons.photo_camera,
                                  color: Colors.white, size: 15),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(name,
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w900)),
                  if (me?.username != null)
                    Text("@${me!.username}",
                        style: const TextStyle(color: GwColors.inkSoft)),
                  if (me?.bio != null && me!.bio!.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(32, 10, 32, 0),
                      child: Text(me.bio!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: GwColors.inkSoft)),
                    ),
                  const SizedBox(height: 18),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _openSettings(context),
                            icon: const Icon(Icons.edit, size: 18),
                            label: const Text("Edit Profile"),
                          ),
                        ),
                        const SizedBox(width: 12),
                        OutlinedButton(
                          onPressed: () => _openWeb(context, "/u/${me?.username ?? ''}"),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: GwColors.primary,
                            backgroundColor: GwColors.surface,
                            side: const BorderSide(color: GwColors.line),
                            padding: const EdgeInsets.all(14),
                          ),
                          child: const Icon(Icons.open_in_new, size: 18),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  _menu(context),
                  const SizedBox(height: 30),
                ],
              ),
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
    // Rounded bottom corners + a gentle bottom scrim: the photo reads as a
    // banner card and the white avatar / status icons stay legible on it.
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(26)),
      child: Stack(
        fit: StackFit.expand,
        children: [
          base,
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x22000000), Colors.transparent, Color(0x44000000)],
                stops: [0, 0.45, 1],
              ),
            ),
          ),
        ],
      ),
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
        _MenuEntry(Icons.monitor_heart_outlined, "Health", web: "/health"),
        _MenuEntry(Icons.spa_outlined, "Wellness", web: "/wellness"),
      ]),
      _MenuSection("Farm & Home", Icons.eco_outlined, const Color(0xFF2E9E5B), [
        _MenuEntry(Icons.agriculture_outlined, "Farm", native: _Native.farm),
        _MenuEntry(Icons.lightbulb_outline, "Smart Home", web: "/home"),
        _MenuEntry(Icons.videocam_outlined, "Cameras", native: _Native.cctv),
        _MenuEntry(Icons.location_on_outlined, "Family",
            native: _Native.family),
        _MenuEntry(Icons.map_outlined, "Map", native: _Native.map),
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
            const SizedBox(height: 16),
          ],
          _card(
            _menuTile(
              icon: Icons.logout,
              label: "Log out",
              color: GwColors.live,
              trailing: false,
              // Pop to the Navigator root first so the login screen (which
              // replaces home) isn't hidden under whatever is pushed on top.
              onTap: () {
                final state = context.read<AppState>();
                Navigator.of(context).popUntil((r) => r.isFirst);
                state.logout();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _categoryCard(BuildContext context, _MenuSection s) {
    return _card(
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: s.accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: Icon(s.icon, color: s.accent, size: 17),
                ),
                const SizedBox(width: 10),
                Text(
                  s.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: GwColors.ink,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 4,
              childAspectRatio: 0.80,
              children: s.items
                  .map((e) => _gridTile(context, e, s.accent))
                  .toList(),
            ),
          ],
        ),
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
                  accent.withValues(alpha: 0.18),
                  accent.withValues(alpha: 0.07),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: accent.withValues(alpha: 0.12)),
            ),
            child: Icon(e.icon, color: accent, size: 24),
          ),
          const SizedBox(height: 6),
          Text(
            e.label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              height: 1.1,
              fontWeight: FontWeight.w600,
              color: GwColors.ink,
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(Widget child) => Container(
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: child,
      );

  Widget _menuTile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color color = GwColors.primary,
    bool trailing = true,
  }) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(label,
          style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: color == GwColors.live ? GwColors.live : GwColors.ink)),
      trailing: trailing
          ? const Icon(Icons.chevron_right, color: GwColors.inkSoft)
          : null,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GwRadius.lg)),
      onTap: onTap,
    );
  }

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
