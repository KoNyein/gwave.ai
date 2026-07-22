import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../cctv/cctv_screen.dart';
import '../dashboard/dashboard_screen.dart';
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

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 172,
            pinned: true,
            backgroundColor: GwColors.primary,
            flexibleSpace: FlexibleSpaceBar(
              background: _cover(me?.coverUrl),
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
                    child: GwAvatar(
                      url: resolveMedia(me?.avatarUrl),
                      name: name,
                      size: 96,
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
            errorWidget: (_, __, ___) => _coverPh(),
            placeholder: (_, __) => _coverPh(),
          )
        : _coverPh();
    // Gentle bottom scrim so the white avatar and status icons stay legible.
    return Stack(
      fit: StackFit.expand,
      children: [
        base,
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Color(0x33000000)],
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
        _MenuEntry(Icons.sensors, "Live", tab: 3),
        _MenuEntry(Icons.record_voice_over_outlined, "Walkie",
            native: _Native.talk),
        _MenuEntry(Icons.movie_outlined, "Reels", tab: 1),
        _MenuEntry(Icons.sports_esports_outlined, "Games",
            native: _Native.games),
      ]),
      _MenuSection("Learning", Icons.school_outlined, const Color(0xFF2E7DB1), [
        _MenuEntry(Icons.menu_book_outlined, "Learn", native: _Native.learn),
        _MenuEntry(Icons.emoji_events_outlined, "Leaderboard", web: "/leaderboard"),
        _MenuEntry(Icons.spa_outlined, "Wellness", web: "/wellness"),
      ]),
      _MenuSection("Farm & Home", Icons.eco_outlined, const Color(0xFF2E9E5B), [
        _MenuEntry(Icons.agriculture_outlined, "Farm", native: _Native.farm),
        _MenuEntry(Icons.lightbulb_outline, "Smart Home", web: "/home"),
        _MenuEntry(Icons.videocam_outlined, "Cameras", native: _Native.cctv),
        _MenuEntry(Icons.location_on_outlined, "Family", web: "/family"),
        _MenuEntry(Icons.map_outlined, "Map", native: _Native.map),
        _MenuEntry(Icons.emergency_outlined, "SOS", web: "/map"),
      ]),
      _MenuSection("Shop & Business", Icons.storefront_outlined,
          const Color(0xFF7A4DD6), [
        _MenuEntry(Icons.storefront_outlined, "Shop", tab: 4),
        _MenuEntry(Icons.work_outline, "Jobs", native: _Native.jobs),
        _MenuEntry(Icons.point_of_sale_outlined, "POS", native: _Native.pos),
        _MenuEntry(Icons.rocket_launch_outlined, "Boost", web: "/boost"),
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
              onTap: () => context.read<AppState>().logout(),
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
      case null:
        break;
    }
    if (e.web != null) _openWeb(context, e.web!);
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
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
