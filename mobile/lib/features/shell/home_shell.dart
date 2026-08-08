import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

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
import '../dashboard/dashboard_screen.dart';
import '../games/games_screen.dart';
import '../market/market_screen.dart';
import '../metaverse/metaverse_screen.dart';
import '../pos/pos_sell_screen.dart';
import '../live/live_list_screen.dart';
import '../messenger/conversations_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../reels/reels_screen.dart';
import '../search/search_screen.dart';
import '../shop/shop_screen.dart';
import 'start_screen.dart';

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

  /// 🚪 ဝင်ရာ နေရာ — app ဖွင့်တာနဲ့ **ဘယ်ကို သွားမလဲ** user ကိုယ်တိုင်
  /// ရွေးတယ် (user: "ဝင်ဝင်ချင်း category တွေ ရွေးဝင်လို့ရအောင်")。
  ///
  /// အရင်က ဖွင့်တိုင်း Metaverse ကို အတင်း ဆွဲထည့်တယ် — ဈေးရောင်းဖို့/
  /// POS ဖွင့်ဖို့ ဖွင့်တဲ့သူက 3D လောကတစ်ခု ဖြတ်ရတယ်။ အခု ပထမဆုံး
  /// ဖွင့်တဲ့အခါ ရွေးခိုင်းပြီး ရွေးထားတာကို မှတ်တယ်၊ Profile ကနေ
  /// ပြန်ပြောင်းလို့ရတယ်။ Web ရဲ့ /start နဲ့ တူညီတဲ့ key တွေ သုံးတယ်။
  static const _homeKey = 'gw.home.choice';
  static bool _startupDone = false;

  @override
  void initState() {
    super.initState();
    if (!_startupDone) {
      _startupDone = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _openStartChoice());
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

  /// 🚪 ဖွင့်တာနဲ့ ဘယ်ကို သွားမလဲ — မှတ်ထားရင် တန်းသွား၊ မမှတ်ရင် မေးတယ်။
  Future<void> _openStartChoice() async {
    if (!mounted) return;
    String? choice;
    try {
      final prefs = await SharedPreferences.getInstance();
      choice = prefs.getString(_homeKey);
    } catch (_) {
      // prefs မရရင် မေးတယ် — ကျမသွားစေရ
    }
    if (!mounted) return;
    if (choice == null) {
      choice = await _askHomeChoice();
      if (choice == null) return; // ပိတ်လိုက်တယ် — Feed မှာ ဆက်နေမယ်
    }
    if (!mounted) return; // ရွေးနေတုန်း ထွက်သွားရင် context သေပြီ
    _applyHomeChoice(choice);
  }

  /// အခန်းကဏ္ဍ ရွေးတဲ့ **စာမျက်နှာ** — web ရဲ့ /start နဲ့ တူညီတဲ့ စာရင်း
  ///
  /// အရင်က `showModalBottomSheet` (အောက်ကနေ ပွတ်တက်တဲ့ sheet) ဖြစ်ပြီး
  /// ရွေးစရာ ၄ ခုပဲ ပါတယ်။ အခု ကိုယ်ပိုင် စာမျက်နှာ — ရွေးစရာ ၈ ခု၊
  /// ခန့်ခန့်ငြားငြား၊ ဘာမှ ထပ်မဖုံးဘူး။
  Future<String?> _askHomeChoice() async {
    final me = context.read<AppState>().me;
    final res = await Navigator.of(context).push<StartResult>(
      MaterialPageRoute(
        settings: const RouteSettings(name: 'start'),
        builder: (_) => StartScreen(name: me?.displayName),
      ),
    );
    if (res == null) return null; // ← back — Feed မှာ ဆက်နေမယ်
    if (res.remember) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_homeKey, res.key);
      } catch (_) {
        // မှတ်လို့ မရရင်လည်း ဒီတစ်ခေါက် အလုပ်လုပ်ရမယ်
      }
    }
    return res.key;
  }

  /// ရွေးလိုက်တဲ့ကဏ္ဍကို သွား — tab ရှိရင် tab ပြောင်း၊ မရှိရင် screen ဖွင့်။
  /// ★ `start_screen.dart` ရဲ့ `startChoices` နဲ့ key တွေ တူညီရမယ်။
  void _applyHomeChoice(String key) {
    switch (key) {
      case 'metaverse':
        openMetaverse(context);
        break;
      case 'shop':
        _selectTab(3);
        break;
      case 'live':
        _selectTab(2);
        break;
      case 'market':
        _push(const MarketScreen());
        break;
      case 'pos':
        _push(const PosSellScreen());
        break;
      case 'games':
        _push(const GamesScreen());
        break;
      case 'dashboard':
        _push(DashboardScreen(onSelectTab: _selectTab));
        break;
      case 'feed':
      default:
        _selectTab(0);
    }
  }

  void _push(Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  /// 🧭 ဘေးပွတ်ဆွဲ — ဘယ်ဘက် = လောက, ညာဘက် = နောက် content tab。
  ///
  /// `primaryVelocity` က ညာဘက်ဆွဲရင် အပေါင်း၊ ဘယ်ဘက်ဆွဲရင် အနုတ်။
  /// ၃၀၀ px/s ကို အနိမ့်ဆုံး အဖြစ် ထားတယ် — ဖြည်းဖြည်း ရွေ့တာတွေက
  /// list ကို ဘေးတိုက် ထိမိတာ ဖြစ်တတ်လို့ tab မပြောင်းစေချင်ဘူး။
  void _onDeckSwipe(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    if (v.abs() < 300) return;
    if (v < 0) {
      // ← လောကထဲ ဝင်
      openMetaverse(context);
    } else {
      // → Feed → Reels → Live → Shop (စက်ဝိုင်း — Notifications/Profile က
      //   deck ထဲ မပါဘူး၊ အဲဒါတွေက ရည်ရွယ်ချက်ရှိရှိ သွားရမယ့် နေရာတွေ)
      _selectTab((_index + 1) % 4);
    }
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
              //
              // 🧭 ဘေးပွတ်ဆွဲ လမ်းညွှန် (web ရဲ့ SwipeDeck နဲ့ တူညီအောင်):
              //   ← ဘယ်ဘက်ဆွဲ → 🌍 Metaverse
              //   → ညာဘက်ဆွဲ  → နောက် content tab (Feed→Reels→Live→Shop)
              // ★ Detector က အပေါ်ဆုံးမှာ ရှိပေမယ့် အထဲက အလျားလိုက်
              //   scroll (story အတန်း, carousel) က gesture arena မှာ
              //   အနိုင်ရတယ် — သူတို့ ပိုနက်လို့။ ဒါကြောင့် ဝင်မယူဘူး။
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onHorizontalDragEnd: _onDeckSwipe,
                child: Stack(
                  children: [
                    IndexedStack(index: _index, children: tabs),
                    GwFloatingPlayer(visible: _index != 1),
                  ],
                ),
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
