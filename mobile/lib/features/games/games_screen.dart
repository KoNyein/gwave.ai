import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../metaverse/metaverse_screen.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Native Games hub. Built-in games and the community catalog are HTML5, so
/// tapping one opens it in the web player; the browsing experience is native.
class GamesScreen extends StatefulWidget {
  const GamesScreen({super.key});

  @override
  State<GamesScreen> createState() => _GamesScreenState();
}

class _GamesScreenState extends State<GamesScreen> {
  List<Game> _community = [];
  bool _loading = true;

  /// ★ ဒါတွေက web ဂိမ်းတွေမို့ WebView နဲ့ ဖွင့်တယ်။ အသက်/အခွင့်အရေး
  ///   ဂိတ်တွေက **server မှာ** ရှိတယ် (`requireAdult()`) — app က ဂိတ်ကို
  ///   မကိုင်ဘူး၊ ကိုင်ရင်လည်း WebView ကို တိုက်ရိုက်ဖွင့်လို့ ကျော်လို့ရမယ်။
  ///   ၁၈+ မဟုတ်သူက အဲဒီစာမျက်နှာကနေ `/restricted` ကို ရောက်သွားမယ်။
  static const _builtins = <(String, String, String, String)>[
    ("🚁", "GWAVE DRONE", "FPV drone + FPS · online", "/drone/index.html"),
    ("🔫", "GWAVE STRIKE", "5v5 FPS · scan မျက်နှာနဲ့", "/strike/"),
    ("🧬", "3D Avatar", "မျက်နှာ + ကိုယ်ခန္ဓာ scan", "/profile/avatar"),
    ("🙈", "ဝှက်တမ်း", "ပုန်းတမ်း ရှာတမ်း · အားလုံး", "/games/arena"),
    ("🎯", "Assassin", "လျှို့ဝှက်ပစ်မှတ် · ၁၈+", "/games/assassin"),
    ("🚁", "Drone Champions", "FPV drone ပြိုင်ပွဲ", "/games/drone-sim"),
    ("🌻", "Grow-a-Garden", "စိုက်ပျိုးရေး ဂိမ်း", "/learn/game"),
    ("🤖", "Learn Games", "STEM သင်ခန်းစာ ဂိမ်းများ", "/learn"),
    ("🧩", "Edu Games", "ပညာပေး HTML5 ဂိမ်းများ", "/games"),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final g = await context.read<AppState>().repo.approvedGames();
      if (mounted) setState(() => _community = g);
    } catch (_) {
      // Non-fatal — built-ins still render.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Games"),
        actions: [
          TextButton.icon(
            onPressed: () => _openWeb("/games/submit"),
            icon: const Icon(Icons.upload_outlined, size: 18),
            label: const Text("တင်ရန်"),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            // ── 3D လောက ─────────────────────────────────────────────────
            // ★ ဂိမ်းစာရင်းရဲ့ ထိပ်မှာ ထားတယ် — အကြီးဆုံး feature ကို
            // အောက်ဆုံးမှာ ဝှက်ထားလို့ မဖြစ်ဘူး။
            _MetaverseBanner(onTap: () => openMetaverse(context)),
            const SizedBox(height: 18),
            const Text("ပါဝင်ပြီးသား ဂိမ်းများ",
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.82,
              children: [
                for (final b in _builtins)
                  _tileCard(
                    emoji: b.$1,
                    title: b.$2,
                    subtitle: b.$3,
                    onTap: () => _openWeb(b.$4),
                  ),
              ],
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                const Text("Community ဂိမ်းများ",
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                const Spacer(),
                TextButton(
                  onPressed: () => _openWeb("/games/creators"),
                  child: const Text("Creators"),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (_loading && _community.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                    child: CircularProgressIndicator(color: GwColors.primary)),
              )
            else if (_community.isEmpty)
              const GwEmpty(
                icon: Icons.sports_esports_outlined,
                title: "Community ဂိမ်း မရှိသေးပါ",
                subtitle: "ပထမဆုံး ဂိမ်းကို သင် တင်ကြည့်ပါ။",
              )
            else
              ..._community.map(_communityRow),
          ],
        ),
      ),
    );
  }

  Widget _tileCard({
    required String emoji,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 34)),
            const SizedBox(height: 6),
            Text(title,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 12.5)),
            const SizedBox(height: 2),
            Text(subtitle,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 10.5)),
          ],
        ),
      ),
    );
  }

  Widget _communityRow(Game g) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => _openWeb("/games/${g.id}"),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Text(g.emoji, style: const TextStyle(fontSize: 30)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(g.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    if (g.description != null && g.description!.isNotEmpty)
                      Text(g.description!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              color: GwColors.inkSoftOf(context), fontSize: 12.5)),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Icon(Icons.play_arrow,
                            size: 14, color: GwColors.inkSoftOf(context)),
                        const SizedBox(width: 2),
                        Text("${g.playsCount} plays",
                            style: TextStyle(
                                color: GwColors.inkSoftOf(context), fontSize: 11.5)),
                        if (g.author != null) ...[
                          const SizedBox(width: 8),
                          Text("·",
                              style: TextStyle(color: GwColors.inkSoftOf(context))),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(g.author!.displayName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                    color: GwColors.inkSoftOf(context), fontSize: 11.5)),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text("Play",
                    style: TextStyle(
                        color: GwColors.primary,
                        fontWeight: FontWeight.w800,
                        fontSize: 13)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Entry card for the 3D world (Phase 17).
///
/// ★ ခလုတ်ကို ကြီးကြီး ထားရမယ် — 3D လောကဆိုတာ စာသား link တစ်ခုနဲ့
/// ဖော်ပြလို့ရတဲ့ feature မဟုတ်ဘူး၊ ဘာလဲဆိုတာ မြင်ရမှ နှိပ်ကြည့်မယ်။
class _MetaverseBanner extends StatelessWidget {
  const _MetaverseBanner({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: BorderRadius.circular(18),
      clipBehavior: Clip.antiAlias,
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF14243A), Color(0xFF0B7A5A)],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
          child: Row(
            children: [
              const Text("🌐", style: TextStyle(fontSize: 34)),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "Gwave Metaverse",
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 17,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      "မြို့ · လယ် · နှင်းတောင် · ကောင်းကင် — သူငယ်ချင်းတွေနဲ့ 3D လောကထဲ",
                      style: TextStyle(color: Colors.white70, fontSize: 11.5),
                    ),
                    SizedBox(height: 3),
                    Text(
                      "ပြိုင်ပွဲ ၄ မျိုး · ဝင်ကြေး မရှိ",
                      style: TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.white70),
            ],
          ),
        ),
      ),
    );
  }
}
