import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../health/health_hub_screen.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Personal overview — the native twin of the web `/dashboard`: a stat grid of
/// "what have I done so far", the G-Pay balance banner, and quick actions.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onSelectTab});
  final void Function(int index)? onSelectTab;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  DashboardStats? _stats;
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
      final s = await context.read<AppState>().repo.dashboardStats();
      if (mounted) setState(() => _stats = s);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AppState>().me;
    final name = me?.displayName ?? "Gwave user";
    return Scaffold(
      appBar: AppBar(title: const Text("Dashboard")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            // Identity strip
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: GwColors.surface,
                borderRadius: BorderRadius.circular(GwRadius.lg),
                boxShadow: GwShadow.card,
              ),
              child: Row(
                children: [
                  GwAvatar(
                      url: resolveMedia(me?.avatarUrl), name: name, size: 52),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w900, fontSize: 16)),
                        if (me?.username != null)
                          Text("@${me!.username}",
                              style: const TextStyle(
                                  color: GwColors.inkSoft, fontSize: 13)),
                      ],
                    ),
                  ),
                  OutlinedButton(
                    onPressed: () => _openWeb("/settings"),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: GwColors.primary,
                      side: const BorderSide(color: GwColors.line),
                    ),
                    child: const Text("Settings"),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (_loading && _stats == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: Center(
                    child: CircularProgressIndicator(color: GwColors.primary)),
              )
            else if (_error != null && _stats == null)
              GwEmpty(
                  icon: Icons.cloud_off,
                  title: "Couldn't load dashboard",
                  subtitle: _error)
            else if (_stats != null) ...[
              // G-Pay balance banner
              if (_stats!.walletBalance != null)
                _walletBanner(_stats!.walletBalance!),
              if (_stats!.walletBalance != null) const SizedBox(height: 14),

              // Health hub — native, on-device health tracking.
              _healthCard(),
              const SizedBox(height: 14),

              // Stat grid
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.55,
                children: [
                  _stat(Icons.article_outlined, "${_stats!.posts}", "Posts",
                      const Color(0xFF3B6D11)),
                  _stat(Icons.group_outlined, "${_stats!.friends}", "Friends",
                      const Color(0xFF2E7DB1), onTap: () => _openWeb("/friends")),
                  _stat(Icons.menu_book_outlined, "${_stats!.lessons}",
                      "Lessons done", const Color(0xFF2E9E5B),
                      onTap: () => _openWeb("/learn")),
                  _stat(Icons.shopping_bag_outlined, "${_stats!.orders}",
                      "Orders", const Color(0xFF7A4DD6),
                      onTap: () => _openWeb("/shop/orders")),
                  _stat(Icons.storefront_outlined, "${_stats!.listings}",
                      "My listings", const Color(0xFFCB6D1E),
                      onTap: () => widget.onSelectTab?.call(3)),
                  _stat(Icons.calculate_outlined, "—", "Tools",
                      const Color(0xFF139C9C),
                      onTap: () => _openWeb("/tools")),
                ],
              ),
              const SizedBox(height: 16),

              // Quick actions
              _quickActions(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _walletBanner(double balance) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => _openWeb("/gpay"),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: GwColors.primaryGradient,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(Icons.account_balance_wallet,
                  color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(context, "G-Pay balance", "G-Pay လက်ကျန်"),
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 13)),
                  Text(money(balance, "Ks"),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  Widget _healthCard() {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const HealthHubScreen())),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFE23B54), Color(0xFFF0768A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(Icons.favorite, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(context, "Health", "ကျန်းမာရေး"),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900)),
                  Text(
                      tr(context, "Pulse, vitals, cycle, report",
                          "Pulse၊ vitals၊ ရာသီ၊ report"),
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 13)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  Widget _stat(IconData icon, String value, String label, Color color,
      {VoidCallback? onTap}) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(value,
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w900)),
            Text(label,
                style: const TextStyle(
                    color: GwColors.inkSoft, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _quickActions() {
    final actions = <(IconData, String, String)>[
      (Icons.emoji_events_outlined, tr(context, "Leaderboard", "အဆင့်ဇယား"), "/leaderboard"),
      (Icons.rocket_launch_outlined, "Boost", "/boost"),
      (Icons.workspace_premium_outlined, "Membership", "/membership"),
      (Icons.help_outline, tr(context, "Help", "အကူအညီ"), "/help"),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "⚡ Quick actions", "⚡ အမြန် လုပ်ဆောင်ရန်"),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final a in actions)
                ActionChip(
                  avatar: Icon(a.$1, size: 18, color: GwColors.primary),
                  label: Text(a.$2),
                  labelStyle: const TextStyle(
                      color: GwColors.ink, fontWeight: FontWeight.w600),
                  backgroundColor: GwColors.surfaceMuted,
                  side: const BorderSide(color: GwColors.line),
                  onPressed: () => _openWeb(a.$3),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
