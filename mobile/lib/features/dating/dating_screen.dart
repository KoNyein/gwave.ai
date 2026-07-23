import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../messenger/chat_screen.dart';
import 'dating_setup_screen.dart';

/// Gwave Dating: an opt-in swipe deck. First visit sets up the dating
/// profile; after that it's matches up top and like/pass cards below. A
/// mutual like celebrates and can jump straight into a messenger chat.
class DatingScreen extends StatefulWidget {
  const DatingScreen({super.key});

  @override
  State<DatingScreen> createState() => _DatingScreenState();
}

class _DatingScreenState extends State<DatingScreen> {
  Map<String, dynamic>? _me;
  List<Map<String, dynamic>> _deck = [];
  List<Map<String, dynamic>> _matches = [];
  bool _loading = true;
  bool _swiping = false;
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
      final api = context.read<AppState>().api;
      final me = await api.datingMe();
      if (me == null) {
        if (mounted) {
          setState(() {
            _me = null;
            _loading = false;
          });
        }
        return;
      }
      final results = await Future.wait([
        api.datingCandidates(),
        api.datingMatches(),
      ]);
      if (!mounted) return;
      setState(() {
        _me = me;
        _deck = results[0];
        _matches = results[1];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = tr(context, "Couldn't load dating.",
              "Dating ကို ဖွင့်လို့မရပါ။");
          _loading = false;
        });
      }
    }
  }

  Future<void> _openSetup() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => DatingSetupScreen(existing: _me)),
    );
    if (saved == true) _load();
  }

  Future<void> _swipe(bool liked) async {
    if (_deck.isEmpty || _swiping) return;
    final candidate = _deck.first;
    setState(() {
      _swiping = true;
      _deck = _deck.sublist(1);
    });
    try {
      final matched = await context.read<AppState>().api.datingSwipe(
            candidate["user_id"].toString(),
            liked: liked,
          );
      if (matched && mounted) {
        _matchesRefresh();
        _celebrate(candidate);
      }
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _swiping = false);
    }
  }

  Future<void> _matchesRefresh() async {
    try {
      final m = await context.read<AppState>().api.datingMatches();
      if (mounted) setState(() => _matches = m);
    } catch (_) {}
  }

  Future<void> _chatWith(Map<String, dynamic>? account) async {
    if (account == null) return;
    try {
      final repo = context.read<AppState>().repo;
      final convo =
          await repo.openConversationWith(Profile.fromJson(account));
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ChatScreen(conversation: convo)),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Couldn't open the chat.",
              "စကားပြောခန်း ဖွင့်လို့မရပါ။")),
        ));
      }
    }
  }

  void _celebrate(Map<String, dynamic> candidate) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(GwRadius.lg)),
        title: Column(
          children: [
            const Icon(Icons.favorite, color: GwColors.heart, size: 48),
            const SizedBox(height: 8),
            Text(
              tr(ctx, "It's a match!", "Match ဖြစ်ပါပြီ! 💚"),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        content: Text(
          tr(
            ctx,
            "You and ${candidate["display_name"]} like each other.",
            "သင်နှင့် ${candidate["display_name"]} တစ်ယောက်ကိုတစ်ယောက် နှစ်သက်ကြပါတယ်။",
          ),
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(tr(ctx, "Keep swiping", "ဆက်ကြည့်မယ်")),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: GwColors.heart),
            onPressed: () {
              Navigator.of(ctx).pop();
              // The candidate map is a dating profile, whose user_id doubles
              // as the account profile id.
              _chatWith({"id": candidate["user_id"]});
            },
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text(tr(ctx, "Say hi", "နှုတ်ဆက်မယ်")),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Dating", "Dating")),
        actions: [
          if (_me != null)
            IconButton(
              tooltip: tr(context, "Edit profile", "Profile ပြင်မယ်"),
              icon: const Icon(Icons.manage_accounts_outlined),
              onPressed: _openSetup,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? GwEmpty(
                  icon: Icons.wifi_off,
                  title: _error!,
                  subtitle: tr(context, "Check your connection and retry.",
                      "ချိတ်ဆက်မှုစစ်ပြီး ပြန်ကြိုးစားပါ။"),
                )
              : _me == null
                  ? _intro()
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 24),
                        children: [
                          if (_matches.isNotEmpty) _matchesRow(),
                          _deckArea(),
                        ],
                      ),
                    ),
    );
  }

  /// First-run: what dating is + the opt-in button.
  Widget _intro() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: GwColors.heart.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.favorite, color: GwColors.heart, size: 44),
            ),
            const SizedBox(height: 18),
            Text(
              tr(context, "Find your match", "အဖော်မွန် ရှာမယ်"),
              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              tr(
                context,
                "Create a dating profile, swipe through people near you, and chat when you match. Adults (18+) only.",
                "Dating profile ဖွင့်ပြီး တခြားသူတွေကို ကြည့်ရှုပါ — နှစ်ဦးနှစ်သက်ရင် စကားပြောလို့ရပါတယ်။ အသက် ၁၈ နှစ်ပြည့်ပြီးသူများသာ။",
              ),
              textAlign: TextAlign.center,
              style: const TextStyle(color: GwColors.inkSoft, height: 1.5),
            ),
            const SizedBox(height: 22),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: GwColors.heart,
                padding:
                    const EdgeInsets.symmetric(horizontal: 26, vertical: 14),
              ),
              onPressed: _openSetup,
              icon: const Icon(Icons.favorite_outline),
              label: Text(tr(context, "Create dating profile",
                  "Dating profile ဖွင့်မယ်")),
            ),
          ],
        ),
      ),
    );
  }

  Widget _matchesRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Text(
            tr(context, "Matches", "Match များ"),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ),
        SizedBox(
          height: 96,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              for (final m in _matches)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: _matchAvatar(m),
                ),
            ],
          ),
        ),
        const Divider(height: 22, color: GwColors.line),
      ],
    );
  }

  Widget _matchAvatar(Map<String, dynamic> m) {
    final dating = m["dating"] is Map
        ? (m["dating"] as Map).cast<String, dynamic>()
        : null;
    final account = m["account"] is Map
        ? (m["account"] as Map).cast<String, dynamic>()
        : null;
    final photos = (dating?["photos"] as List?)?.cast<String>() ?? const [];
    final name = dating?["display_name"]?.toString() ??
        (account == null ? "?" : Profile.fromJson(account).displayName);
    final photoUrl = photos.isNotEmpty
        ? resolveMedia(photos.first, bucket: "media")
        : resolveMedia(account?["avatar_url"]?.toString());
    return InkWell(
      borderRadius: BorderRadius.circular(40),
      onTap: () => _chatWith(account ?? {"id": m["other_id"]}),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: GwColors.heart, width: 2),
            ),
            child: GwAvatar(url: photoUrl, name: name, size: 56),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: 68,
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _deckArea() {
    if (_deck.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 40),
        child: GwEmpty(
          icon: Icons.favorite_outline,
          title: tr(context, "No more people right now",
              "လောလောဆယ် ကြည့်စရာ မကျန်တော့ပါ"),
          subtitle: tr(context, "Pull down to refresh, or check back later.",
              "အောက်ဆွဲပြီး ပြန်စစ်ပါ (နောက်မှ ထပ်လာကြည့်ပါ)။"),
        ),
      );
    }
    final c = _deck.first;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: Column(
        children: [
          Dismissible(
            key: ValueKey(c["user_id"]),
            direction: DismissDirection.horizontal,
            onDismissed: (dir) => _swipe(dir == DismissDirection.startToEnd),
            child: _CandidateCard(candidate: c),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _roundButton(
                icon: Icons.close,
                color: GwColors.inkSoft,
                onTap: () => _swipe(false),
              ),
              const SizedBox(width: 30),
              _roundButton(
                icon: Icons.favorite,
                color: GwColors.heart,
                big: true,
                onTap: () => _swipe(true),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            tr(context, "Swipe right to like, left to pass",
                "ညာဘက်ပွတ်ဆွဲ = နှစ်သက်၊ ဘယ်ဘက် = ကျော်"),
            style: const TextStyle(fontSize: 12, color: GwColors.inkSoft),
          ),
        ],
      ),
    );
  }

  Widget _roundButton({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    bool big = false,
  }) {
    final size = big ? 68.0 : 56.0;
    return InkWell(
      borderRadius: BorderRadius.circular(size),
      onTap: _swiping ? null : onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: GwColors.surface,
          shape: BoxShape.circle,
          border: Border.all(color: color.withValues(alpha: 0.4), width: 2),
          boxShadow: GwShadow.card,
        ),
        child: Icon(icon, color: color, size: big ? 32 : 26),
      ),
    );
  }
}

class _CandidateCard extends StatelessWidget {
  const _CandidateCard({required this.candidate});
  final Map<String, dynamic> candidate;

  @override
  Widget build(BuildContext context) {
    final photos = (candidate["photos"] as List?)?.cast<String>() ?? const [];
    final name = (candidate["display_name"] ?? "").toString();
    final birthYear = (candidate["birth_year"] as num?)?.toInt();
    final age = birthYear == null ? null : DateTime.now().year - birthYear;
    final city = (candidate["city"] ?? "").toString();
    final bio = (candidate["bio"] ?? "").toString();

    return Container(
      height: 480,
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.xl),
        boxShadow: GwShadow.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (photos.isEmpty)
            Container(
              color: GwColors.heart.withValues(alpha: 0.08),
              child: Center(
                child: GwAvatar(url: null, name: name, size: 120),
              ),
            )
          else
            PageView(
              children: [
                for (final p in photos)
                  CachedNetworkImage(
                    imageUrl: resolveMedia(p, bucket: "media") ?? "",
                    fit: BoxFit.cover,
                    placeholder: (_, __) =>
                        const ColoredBox(color: GwColors.surfaceMuted),
                    errorWidget: (_, __, ___) => const ColoredBox(
                      color: GwColors.surfaceMuted,
                      child: Icon(Icons.broken_image_outlined,
                          color: GwColors.inkSoft),
                    ),
                  ),
              ],
            ),
          // Bottom gradient with the essentials.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(18, 40, 18, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black87],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    age == null ? name : "$name, $age",
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (city.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(
                        children: [
                          const Icon(Icons.place_outlined,
                              size: 15, color: Colors.white70),
                          const SizedBox(width: 3),
                          Text(city,
                              style: const TextStyle(
                                  color: Colors.white70, fontSize: 14)),
                        ],
                      ),
                    ),
                  if (bio.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        bio,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 13.5, height: 1.35),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
