import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../audio/audio_hub_screen.dart';
import '../boost/boost_screen.dart';
import '../cctv/cctv_screen.dart';
import '../dashboard/dashboard_screen.dart';
import '../health/health_hub_screen.dart';
import '../dating/dating_screen.dart';
import '../drone/drone_scanner_screen.dart';
import '../wellness/wellness_hub_screen.dart';
import 'my_profile_screen.dart';
import '../family/family_screen.dart';
import '../farm/farm_screen.dart';
import '../finance/finance_screen.dart';
import '../friends/friends_screen.dart';
import '../games/games_screen.dart';
import '../gpay/gpay_screen.dart';
import '../groups/groups_screen.dart';
import '../jobs/jobs_screen.dart';
import '../books/books_screen.dart';
import '../knowledge/mine_sites_screen.dart';
import '../knowledge/minerals_screen.dart';
import '../knowledge/strains_screen.dart';
import '../learn/learn_screen.dart';
import '../map/map_screen.dart';
import '../market/market_screen.dart';
import '../pos/pos_sell_screen.dart';
import '../settings/settings_screen.dart';
import '../talk/talk_screen.dart';
import '../tools/tools_screen.dart';

/// The Me tab = the app's **Main Menu**: a compact identity header that opens
/// the dedicated Profile page ([MyProfileScreen]), then the launcher grid of
/// every Gwave module. Profile (cover/bio/posts) and navigation are separate,
/// focused pages — the tab itself stays a clean launcher.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, this.onSelectTab});

  /// Lets menu entries that map to a bottom tab (Home/Live/Reels/Shop) switch
  /// the shell tab instead of opening the web app.
  final void Function(int index)? onSelectTab;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
          children: [
            Row(
              children: [
                Text(tr(context, "Menu", "မီနူး"),
                    style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5)),
                const Spacer(),
                _roundIcon(context, Icons.settings_outlined,
                    () => _push(context, const SettingsScreen())),
              ],
            ),
            const SizedBox(height: 12),
            _identityCard(context),
            const SizedBox(height: 14),
            ..._sections(context),
            _logoutCard(context),
          ],
        ),
      ),
    );
  }

  /// Compact identity header — avatar + name on a brand gradient, tapping it
  /// (or the button) opens the full Profile page.
  Widget _identityCard(BuildContext context) {
    final state = context.watch<AppState>();
    final me = state.me;
    final name = me?.displayName ?? state.api.session?.email ?? "Gwave user";
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => _push(context, const MyProfileScreen()),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              GwColors.primaryDark,
              GwColors.primary,
            ],
          ),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(2.5),
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: GwAvatar(
                url: resolveMedia(me?.avatarUrl),
                name: name,
                size: 56,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w900)),
                  if (me?.username != null)
                    Text("@${me!.username}",
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 12.5)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.account_circle_outlined,
                            color: Colors.white, size: 14),
                        const SizedBox(width: 5),
                        Text(
                            tr(context, "View my profile",
                                "ကိုယ့်ပရိုဖိုင် ကြည့်ရန်"),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  Widget _roundIcon(BuildContext context, IconData icon, VoidCallback onTap) =>
      InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: GwColors.surfaceMutedOf(context),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: GwColors.inkOf(context), size: 21),
        ),
      );

  /// The full Gwave menu, grouped exactly like the web sidebar
  /// (`src/components/layout/nav-items.ts`) but rendered as a modern super-app
  /// launcher: each category is its own card with a color-accented header and a
  /// 4-up grid of tinted icon tiles. Tabbed entries switch the bottom tab;
  /// Farm + Cameras are native; everything else opens the web app.
  List<Widget> _sections(BuildContext context) {
    final sections = <_MenuSection>[
      _MenuSection(tr(context, "Social", "လူမှုကွန်ရက်"),
          Icons.groups_2_outlined, const Color(0xFF3B6D11), [
        _MenuEntry(Icons.home_outlined, tr(context, "Home", "ပင်မ"), tab: 0),
        _MenuEntry(
            Icons.account_circle_outlined, tr(context, "My profile", "ပရိုဖိုင်"),
            native: _Native.myprofile),
        _MenuEntry(Icons.dashboard_outlined,
            tr(context, "Dashboard", "ဒက်ရှ်ဘုတ်"),
            native: _Native.dashboard),
        _MenuEntry(Icons.group_outlined, tr(context, "Friends", "မိတ်ဆွေများ"),
            native: _Native.friends),
        _MenuEntry(Icons.grid_view_outlined, tr(context, "Groups", "အုပ်စုများ"),
            native: _Native.groups),
        _MenuEntry(Icons.flag_outlined, tr(context, "Pages", "စာမျက်နှာများ"),
            web: "/pages"),
        _MenuEntry(Icons.sensors, "Live", tab: 2),
        _MenuEntry(Icons.record_voice_over_outlined,
            tr(context, "Walkie", "ဝေါ်ကီတော်ကီ"),
            native: _Native.talk),
        _MenuEntry(Icons.movie_outlined, "Reels", tab: 1),
        _MenuEntry(Icons.library_music_outlined, tr(context, "Audio", "အသံ"),
            native: _Native.audio),
        _MenuEntry(Icons.sports_esports_outlined,
            tr(context, "Games", "ဂိမ်းများ"),
            native: _Native.games),
        _MenuEntry(Icons.favorite_outline, tr(context, "Dating", "ချိန်းတွေ့"),
            native: _Native.dating),
      ]),
      _MenuSection(tr(context, "Learning", "ပညာရေး"), Icons.school_outlined,
          const Color(0xFF2E7DB1), [
        _MenuEntry(Icons.menu_book_outlined, tr(context, "Learn", "သင်ယူရန်"),
            native: _Native.learn),
        _MenuEntry(Icons.emoji_events_outlined,
            tr(context, "Leaderboard", "အဆင့်ဇယား"),
            web: "/leaderboard"),
        _MenuEntry(Icons.monitor_heart_outlined,
            tr(context, "Health", "ကျန်းမာရေး"),
            native: _Native.health),
        _MenuEntry(Icons.self_improvement_outlined,
            tr(context, "Wellness", "စိတ်ကျန်းမာ"),
            native: _Native.wellness),
      ]),
      _MenuSection(tr(context, "Farm & Home", "စိုက်ပျိုးရေးနှင့် အိမ်"),
          Icons.eco_outlined, const Color(0xFF2E9E5B), [
        _MenuEntry(Icons.agriculture_outlined, tr(context, "Farm", "ခြံ"),
            native: _Native.farm),
        _MenuEntry(Icons.lightbulb_outline,
            tr(context, "Smart Home", "စမတ်အိမ်"),
            web: "/home"),
        _MenuEntry(Icons.videocam_outlined, tr(context, "Cameras", "ကင်မရာ"),
            native: _Native.cctv),
        _MenuEntry(Icons.location_on_outlined,
            tr(context, "Family", "မိသားစု"),
            native: _Native.family),
        _MenuEntry(Icons.map_outlined, tr(context, "Map", "မြေပုံ"),
            native: _Native.map),
        _MenuEntry(Icons.radar, tr(context, "Drone radar", "ဒရုန်းရေဒါ"),
            native: _Native.drone),
        _MenuEntry(Icons.emergency_outlined, "SOS", native: _Native.map),
      ]),
      _MenuSection(tr(context, "Shop & Business", "ဈေးဝယ်နှင့် စီးပွား"),
          Icons.storefront_outlined, const Color(0xFF7A4DD6), [
        _MenuEntry(Icons.storefront_outlined, tr(context, "Shop", "ဆိုင်"),
            tab: 3),
        _MenuEntry(Icons.sell_outlined, tr(context, "Market", "ဈေး"),
            native: _Native.market),
        _MenuEntry(Icons.work_outline, tr(context, "Jobs", "အလုပ်များ"),
            native: _Native.jobs),
        _MenuEntry(Icons.point_of_sale_outlined, "POS", native: _Native.pos),
        _MenuEntry(Icons.rocket_launch_outlined, "Boost",
            native: _Native.boost),
        _MenuEntry(Icons.account_balance_wallet_outlined, "G-Pay",
            native: _Native.gpay),
        _MenuEntry(Icons.account_balance_outlined,
            tr(context, "Finance", "ငွေရေးကြေးရေး"),
            native: _Native.finance),
        _MenuEntry(Icons.workspace_premium_outlined,
            tr(context, "Member", "အသင်းဝင်"),
            web: "/membership"),
      ]),
      _MenuSection(tr(context, "Knowledge & Tools", "ဗဟုသုတနှင့် ကိရိယာ"),
          Icons.auto_stories_outlined, const Color(0xFF139C9C), [
        _MenuEntry(Icons.menu_book_outlined, tr(context, "Books", "စာအုပ်ဆိုင်"),
            native: _Native.books),
        _MenuEntry(Icons.eco_outlined, tr(context, "Strains", "မျိုးကွဲများ"),
            native: _Native.strains),
        _MenuEntry(Icons.diamond_outlined,
            tr(context, "Minerals", "ဓာတ်သတ္တု"),
            native: _Native.minerals),
        _MenuEntry(Icons.terrain_outlined,
            tr(context, "Mine sites", "မိုင်းနေရာများ"),
            native: _Native.mineSites),
        _MenuEntry(Icons.calculate_outlined, tr(context, "Tools", "ကိရိယာများ"),
            native: _Native.tools),
      ]),
    ];

    return [
      for (final s in sections) ...[
        _categoryCard(context, s),
        const SizedBox(height: 12),
      ],
    ];
  }

  Widget _logoutCard(BuildContext context) => _card(
        context,
        InkWell(
          borderRadius: BorderRadius.circular(GwRadius.lg),
          onTap: () {
            final state = context.read<AppState>();
            Navigator.of(context).popUntil((r) => r.isFirst);
            state.logout();
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: GwColors.live.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child:
                      const Icon(Icons.logout, color: GwColors.live, size: 19),
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
      );

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
      case _Native.books:
        _push(context, const BooksScreen());
        return;
      case _Native.strains:
        _push(context, const StrainsScreen());
        return;
      case _Native.minerals:
        _push(context, const MineralsScreen());
        return;
      case _Native.mineSites:
        _push(context, const MineSitesScreen());
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
      case _Native.audio:
        _push(context, const AudioHubScreen());
        return;
      case _Native.wellness:
        _push(context, const WellnessHubScreen());
        return;
      case _Native.myprofile:
        _push(context, const MyProfileScreen());
        return;
      case null:
        break;
    }
    if (e.web != null) _openWeb(context, e.web!);
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

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
  books,
  strains,
  minerals,
  mineSites,
  market,
  dating,
  family,
  boost,
  health,
  drone,
  audio,
  wellness,
  myprofile,
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
