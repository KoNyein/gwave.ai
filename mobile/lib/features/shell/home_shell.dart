import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../core/video_audio.dart';
import '../../widgets/common.dart';
import '../audio/floating_player.dart';
import '../feed/composer_screen.dart';
import '../feed/feed_screen.dart';
import '../metaverse/metaverse_screen.dart';
import '../live/live_list_screen.dart';
import '../messenger/conversations_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../reels/reels_screen.dart';
import '../search/search_screen.dart';
import '../shop/shop_screen.dart';

/// The signed-in root, laid out Facebook-style: a masthead (wordmark +
/// round action chips) on the Home tab, then a persistent row of icon tabs
/// with a blue underline — Home, Reels, Live, Shop, Notifications and the
/// Menu tab showing the user's own avatar. Navigation lives at the TOP of
/// the screen, matching the reference UI.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  int _unread = 0;
  Timer? _unreadPoll;

  /// 🌍 Metaverse-first — login ဝင်ပြီးတာနဲ့ လောကထဲ တစ်ခါ ဝင်ပေးတယ်
  /// (user: "login ဝင်လိုက်တာနဲ့ Metaverse room ထဲ ရောက်ပါ")။ Back နှိပ်ရင်
  /// app ထဲ ပြန်ရောက်တယ် — app က ပျောက်မသွားဘူး။ App တစ်ခါဖွင့်ရင်
  /// တစ်ခါပဲ — အခန်းထဲက ထွက်ပြီးတိုင်း ပြန်မဆွဲဘူး။
  static bool _worldShown = false;

  @override
  void initState() {
    super.initState();
    if (!_worldShown) {
      _worldShown = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) openMetaverse(context);
      });
    }
    _loadUnread();
    // Keep the bell badge fresh the way the presence dots are.
    _unreadPoll =
        Timer.periodic(const Duration(seconds: 60), (_) => _loadUnread());
  }

  @override
  void dispose() {
    _unreadPoll?.cancel();
    super.dispose();
  }

  Future<void> _loadUnread() async {
    if (!mounted || _index == 4) return;
    try {
      final n = await context.read<AppState>().repo.unreadNotificationCount();
      if (mounted && n != _unread) setState(() => _unread = n);
    } catch (_) {}
  }

  /// Switching tabs is not a route push, so the route observer never hears
  /// about it — but leaving the Feed with a video talking is exactly the case
  /// users notice. Anything being watched stops here; music and calls don't.
  void _selectTab(int i) {
    if (i != _index) GwSound.instance.silenceMedia();
    setState(() {
      _index = i;
      // Opening the Notifications tab marks everything read on the server —
      // clear the badge in step with it.
      if (i == 4) _unread = 0;
    });
  }

  Future<void> _openComposer() async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const ComposerScreen()),
    );
    if (created == true) FeedScreen.requestRefresh();
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AppState>().me;
    final tabs = [
      const FeedScreen(),
      // Only the visible Reels tab should play (and make sound); pass whether
      // it's the selected tab so it pauses when the user switches away.
      ReelsScreen(active: _index == 1),
      const LiveListScreen(),
      const ShopScreen(),
      // Lazy: the tab only loads (and marks read) when actually opened —
      // IndexedStack builds every child up front.
      NotificationsScreen(active: _index == 4, embedded: true),
      ProfileScreen(onSelectTab: _selectTab),
    ];
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            if (_index == 0) _masthead(context),
            _iconTabBar(context, me?.avatarUrl, me?.displayName ?? "Me"),
            Expanded(
              // The player floats *over* the content rather than taking a
              // strip of every screen for itself. It renders nothing when
              // nothing is loaded, and it is hidden over Reels —
              // edge-to-edge video is no place for chrome.
              child: Stack(
                children: [
                  IndexedStack(index: _index, children: tabs),
                  GwFloatingPlayer(visible: _index != 1),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Brand row shown on Home only — wordmark left, round gray chips right.
  Widget _masthead(BuildContext context) {
    return Container(
      color: GwColors.surfaceOf(context),
      padding: const EdgeInsets.fromLTRB(14, 6, 10, 2),
      child: Row(
        children: [
          const Text(
            "gwave",
            style: TextStyle(
              color: GwColors.primary,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              letterSpacing: -1.2,
              height: 1,
            ),
          ),
          const Spacer(),
          _chip(context, Icons.add, _openComposer),
          _chip(context, Icons.search, () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SearchScreen()),
            );
          }),
          _chip(context, Icons.chat_bubble, () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ConversationsScreen()),
            );
          }),
        ],
      ),
    );
  }

  Widget _chip(BuildContext context, IconData icon, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: GwColors.surfaceMutedOf(context),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 21, color: GwColors.inkOf(context)),
        ),
      ),
    );
  }

  /// Facebook-style icon tab strip: no labels, active tab gets the primary
  /// color and a 3px underline; the last tab is the user's avatar (Menu).
  Widget _iconTabBar(BuildContext context, String? avatarUrl, String name) {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        border: Border(bottom: BorderSide(color: GwColors.lineOf(context))),
      ),
      child: Row(
        children: [
          _tab(0, Icons.home_outlined, Icons.home),
          _tab(1, Icons.ondemand_video_outlined, Icons.ondemand_video),
          _tab(2, Icons.sensors, Icons.sensors),
          _tab(3, Icons.storefront_outlined, Icons.storefront),
          _tab(4, Icons.notifications_none, Icons.notifications,
              badge: _unread),
          _avatarTab(5, avatarUrl, name),
        ],
      ),
    );
  }

  Widget _tab(int i, IconData icon, IconData selectedIcon, {int badge = 0}) {
    final selected = _index == i;
    return Expanded(
      child: InkWell(
        onTap: () => _selectTab(i),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Badge(
                isLabelVisible: badge > 0,
                label: Text("$badge"),
                backgroundColor: GwColors.live,
                child: Icon(
                  selected ? selectedIcon : icon,
                  size: 26,
                  color: selected ? GwColors.primary : GwColors.inkSoft,
                ),
              ),
            ),
            _underline(selected),
          ],
        ),
      ),
    );
  }

  Widget _avatarTab(int i, String? avatarUrl, String name) {
    final selected = _index == i;
    return Expanded(
      child: InkWell(
        onTap: () => _selectTab(i),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Container(
                padding: const EdgeInsets.all(1.5),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected ? GwColors.primary : Colors.transparent,
                    width: 2,
                  ),
                ),
                child: GwAvatar(
                  url: resolveMedia(avatarUrl),
                  name: name,
                  size: 24,
                ),
              ),
            ),
            _underline(selected),
          ],
        ),
      ),
    );
  }

  Widget _underline(bool selected) {
    return Container(
      height: 3,
      margin: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: selected ? GwColors.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
