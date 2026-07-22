import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../feed/feed_screen.dart';
import '../live/live_list_screen.dart';
import '../messenger/conversations_screen.dart';
import '../reels/reels_screen.dart';
import '../shop/shop_screen.dart';
import '../profile/profile_screen.dart';

/// The signed-in root: six native tabs behind one bottom navigation bar,
/// matching the web super-app's primary sections.
///
/// Chat has a tab because messaging is a daily destination. It used to be
/// reachable only from one icon in the Feed app bar, so from any other tab
/// there was no way to open it at all.
///
/// Tab indices are referenced by `ProfileScreen`'s shortcuts — keep the two in
/// step when reordering.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  void _selectTab(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    final tabs = [
      const FeedScreen(),
      // Only the visible Reels tab should play (and make sound); pass whether
      // it's the selected tab so it pauses when the user switches away.
      ReelsScreen(active: _index == 1),
      const ConversationsScreen(),
      const LiveListScreen(),
      const ShopScreen(),
      ProfileScreen(onSelectTab: _selectTab),
    ];
    return Scaffold(
      body: IndexedStack(index: _index, children: tabs),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: GwColors.surface,
          border: const Border(top: BorderSide(color: GwColors.line)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: Colors.transparent,
              indicatorColor: GwColors.primary.withValues(alpha: 0.12),
              labelTextStyle: WidgetStateProperty.resolveWith(
                (states) => TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: states.contains(WidgetState.selected)
                      ? GwColors.primary
                      : GwColors.inkSoft,
                ),
              ),
            ),
            child: NavigationBar(
              height: 64,
              selectedIndex: _index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.home, color: GwColors.primary),
                  label: "Feed",
                ),
                NavigationDestination(
                  icon: Icon(Icons.play_circle_outline, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.play_circle, color: GwColors.primary),
                  label: "Reels",
                ),
                NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.chat_bubble, color: GwColors.primary),
                  label: "Chat",
                ),
                NavigationDestination(
                  icon: Icon(Icons.videocam_outlined, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.videocam, color: GwColors.primary),
                  label: "Live",
                ),
                NavigationDestination(
                  icon: Icon(Icons.storefront_outlined, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.storefront, color: GwColors.primary),
                  label: "Shop",
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline, color: GwColors.inkSoft),
                  selectedIcon: Icon(Icons.person, color: GwColors.primary),
                  label: "Me",
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
