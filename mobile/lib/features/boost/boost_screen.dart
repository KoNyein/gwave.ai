import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native Boost manager — the web ad-campaign page as a phone screen: escrow
/// summary up top, one card per campaign (status, spend progress, views /
/// clicks / CTR) with pause-resume and cancel-refund, and a new-boost flow
/// that picks one of your posts and escrows the budget from G-Pay.
class BoostScreen extends StatefulWidget {
  const BoostScreen({super.key});

  @override
  State<BoostScreen> createState() => _BoostScreenState();
}

class _BoostScreenState extends State<BoostScreen> {
  List<Map<String, dynamic>> _boosts = [];
  bool _loading = true;
  bool _busy = false;
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
      final rows = await context.read<AppState>().repo.myBoosts();
      if (mounted) setState(() => _boosts = rows);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  double _n(dynamic v) => (v as num?)?.toDouble() ?? 0;

  ({double budget, double spent, double escrow}) get _summary {
    double budget = 0, spent = 0, escrow = 0;
    for (final b in _boosts) {
      final s = (b["status"] ?? "").toString();
      budget += _n(b["budget_mmk"]);
      spent += _n(b["spent_mmk"]);
      if (s == "active" || s == "paused") {
        escrow += _n(b["budget_mmk"]) - _n(b["spent_mmk"]);
      }
    }
    return (budget: budget, spent: spent, escrow: escrow);
  }

  Future<void> _setStatus(String id, String status) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().repo.setBoostStatus(id, status);
      await _load();
    } catch (e) {
      _toast("$e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Cancel this campaign?", "ကြော်ငြာ ရပ်မလား?")),
        content: Text(tr(
            ctx,
            "The unspent budget refunds to your G-Pay wallet.",
            "မသုံးရသေးသော ငွေကို G-Pay wallet ထဲ ပြန်အမ်းပါမည်။")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Keep running", "ဆက်လည်မည်"))),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: GwColors.live),
            child: Text(tr(ctx, "Cancel & refund", "ရပ်ပြီး ပြန်အမ်း")),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().repo.cancelBoost(id);
      await _load();
      _toast(tr(context, "Cancelled — refund sent to your wallet.",
          "ရပ်ပြီးပါပြီ — ကျန်ငွေ wallet ထဲ ပြန်ရောက်ပါပြီ။"));
    } catch (e) {
      _toast("$e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// New boost: pick one of my posts, set headline + budget, escrow + start.
  Future<void> _newBoost() async {
    List<Post> posts = [];
    try {
      posts = await context.read<AppState>().repo.myPosts();
    } catch (_) {}
    if (!mounted) return;
    if (posts.isEmpty) {
      _toast(tr(context, "Create a post first, then boost it.",
          "Post အရင်တင်ပြီးမှ ကြော်ငြာလို့ရပါမည်။"));
      return;
    }
    final post = await showModalBottomSheet<Post>(
      context: context,
      backgroundColor: GwColors.bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(14),
          children: [
            Text(tr(ctx, "Boost which post?", "ဘယ် post ကို ကြော်ငြာမလဲ?"),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            for (final p in posts.take(12))
              ListTile(
                dense: true,
                leading: const Icon(Icons.article_outlined,
                    color: GwColors.primary),
                title: Text(
                  p.content.isEmpty
                      ? tr(ctx, "(photo post)", "(ဓာတ်ပုံ post)")
                      : p.content,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(timeAgo(p.createdAt)),
                onTap: () => Navigator.of(ctx).pop(p),
              ),
          ],
        ),
      ),
    );
    if (post == null || !mounted) return;

    final headline = TextEditingController();
    final budget = TextEditingController(text: "1000");
    final daily = TextEditingController(text: "500");
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Boost settings", "ကြော်ငြာ သတ်မှတ်ချက်")),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: headline,
                maxLength: 160,
                decoration: InputDecoration(
                  labelText: tr(ctx, "Headline (optional)",
                      "ခေါင်းစဉ် (မဖြစ်မနေမဟုတ်)"),
                  counterText: "",
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: budget,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText:
                      tr(ctx, "Total budget (Ks)", "စုစုပေါင်း ဘတ်ဂျက် (ကျပ်)"),
                  prefixIcon: const Icon(Icons.payments_outlined),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: daily,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText:
                      tr(ctx, "Daily cap (Ks)", "တစ်ရက် အများဆုံး (ကျပ်)"),
                  prefixIcon: const Icon(Icons.today_outlined),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                tr(
                    ctx,
                    "Runs 7 days. The budget is escrowed from your G-Pay wallet; whatever isn't spent refunds on cancel.",
                    "၇ ရက် လည်ပါမည်။ ဘတ်ဂျက်ကို G-Pay wallet မှ ကြိုတင်ယူထားပြီး မသုံးဖြစ်ပါက ရပ်ချိန် ပြန်အမ်းပါမည်။"),
                style: const TextStyle(
                    fontSize: 11.5, color: GwColors.inkSoft),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "🚀 Start boost", "🚀 စတင်မည်"))),
        ],
      ),
    );
    final b = double.tryParse(budget.text.trim()) ?? 0;
    final d = double.tryParse(daily.text.trim()) ?? 0;
    headline.dispose();
    budget.dispose();
    daily.dispose();
    if (ok != true || !mounted) return;
    if (b < 100 || d < 50 || d > b) {
      _toast(tr(
          context,
          "Budget must be ≥100 Ks and daily cap between 50 and the budget.",
          "ဘတ်ဂျက် ၁၀၀ ကျပ်အထက်၊ တစ်ရက်စာက ၅၀ နှင့် ဘတ်ဂျက်ကြားရှိရပါမည်။"));
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<AppState>().repo.createPostBoost(
            postId: post.id,
            budgetMmk: b,
            dailyCapMmk: d,
          );
      await _load();
      _toast(tr(context, "Boost started 🚀", "ကြော်ငြာ စတင်ပါပြီ 🚀"));
    } catch (e) {
      _toast("$e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _summary;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Boost — Ads", "ကြော်ငြာ စီမံခန့်ခွဲမှု")),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: GwColors.primary,
        foregroundColor: Colors.white,
        onPressed: _busy ? null : _newBoost,
        icon: const Icon(Icons.rocket_launch_outlined),
        label: Text(tr(context, "New", "အသစ်")),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _boosts.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                children: [
                  // Escrow summary strip.
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: GwColors.surface,
                      borderRadius: BorderRadius.circular(GwRadius.lg),
                      boxShadow: GwShadow.card,
                    ),
                    child: Row(
                      children: [
                        _sum(tr(context, "Total budget", "စုစုပေါင်း ဘတ်ဂျက်"),
                            s.budget, GwColors.ink),
                        _sum(tr(context, "Spent", "သုံးပြီး"), s.spent,
                            GwColors.primary),
                        _sum(tr(context, "Left (escrow)", "ကျန် (escrow)"),
                            s.escrow, GwColors.primaryDark),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_error != null && _boosts.isEmpty)
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error)
                  else if (_boosts.isEmpty)
                    GwEmpty(
                      icon: Icons.rocket_launch_outlined,
                      title: tr(context, "No campaigns yet",
                          "ကြော်ငြာ မရှိသေးပါ"),
                      subtitle: tr(
                          context,
                          "Boost a post so more people see it.",
                          "Post ကို ကြော်ငြာပြီး လူများများ မြင်အောင်လုပ်ပါ။"),
                    )
                  else
                    for (final b in _boosts) _campaignCard(b),
                ],
              ),
      ),
    );
  }

  Widget _sum(String label, double v, Color color) => Expanded(
        child: Column(
          children: [
            Text(label,
                style:
                    const TextStyle(fontSize: 11, color: GwColors.inkSoft)),
            const SizedBox(height: 2),
            Text(money(v, "Ks"),
                style: TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14, color: color)),
          ],
        ),
      );

  Widget _campaignCard(Map<String, dynamic> b) {
    final id = b["id"].toString();
    final status = (b["status"] ?? "").toString();
    final active = status == "active";
    final paused = status == "paused";
    final budget = _n(b["budget_mmk"]);
    final spent = _n(b["spent_mmk"]);
    final views = (b["impressions"] as num?)?.toInt() ?? 0;
    final clicks = (b["clicks"] as num?)?.toInt() ?? 0;
    final ctr = views > 0 ? clicks / views * 100 : 0.0;
    final headline = (b["headline"] ?? "").toString();

    final statusLabel = switch (status) {
      "active" => tr(context, "Running", "လည်ပတ်နေသည်"),
      "paused" => tr(context, "Paused", "ခေတ္တရပ်ထား"),
      "completed" => tr(context, "Completed", "ပြီးဆုံး"),
      "cancelled" => tr(context, "Cancelled", "ရပ်ထား"),
      _ => status,
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  headline.isEmpty
                      ? tr(context, "📝 Post boost", "📝 Post ကြော်ငြာ")
                      : headline,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15),
                ),
              ),
              if (active || paused) ...[
                IconButton(
                  tooltip: active
                      ? tr(context, "Pause", "ခေတ္တရပ်")
                      : tr(context, "Resume", "ပြန်စ"),
                  icon: Icon(active ? Icons.pause : Icons.play_arrow,
                      color: GwColors.primary),
                  onPressed: _busy
                      ? null
                      : () => _setStatus(id, active ? "paused" : "active"),
                ),
                IconButton(
                  tooltip: tr(context, "Cancel", "ရပ်မည်"),
                  icon: const Icon(Icons.close, color: GwColors.live),
                  onPressed: _busy ? null : () => _cancel(id),
                ),
              ],
            ],
          ),
          GwPill(
            label: statusLabel,
            color: active
                ? GwColors.primary
                : paused
                    ? GwColors.gold
                    : GwColors.inkSoft,
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("${tr(context, "Spent", "သုံးပြီး")} ${money(spent, "Ks")}",
                  style: const TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoft)),
              Text(
                  "${tr(context, "Budget", "ဘတ်ဂျက်")} ${money(budget, "Ks")}",
                  style: const TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoft)),
            ],
          ),
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(
              value: budget > 0 ? (spent / budget).clamp(0.0, 1.0) : 0,
              minHeight: 8,
              backgroundColor: GwColors.surfaceMuted,
              valueColor: const AlwaysStoppedAnimation(GwColors.primary),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _stat(Icons.visibility_outlined,
                  tr(context, "Views", "ကြည့်ရှုမှု"), "$views"),
              const SizedBox(width: 8),
              _stat(Icons.touch_app_outlined, "Click", "$clicks"),
              const SizedBox(width: 8),
              _stat(Icons.percent, "CTR", "${ctr.toStringAsFixed(1)}%"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(IconData icon, String label, String value) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: GwColors.surfaceMuted,
            borderRadius: BorderRadius.circular(GwRadius.sm),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 13, color: GwColors.inkSoft),
                  const SizedBox(width: 4),
                  Text(label,
                      style: const TextStyle(
                          fontSize: 11, color: GwColors.inkSoft)),
                ],
              ),
              const SizedBox(height: 2),
              Text(value,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
            ],
          ),
        ),
      );
}
