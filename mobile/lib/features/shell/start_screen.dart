import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// 🚪 ဝင်ရာ တံခါး — "ဘယ်ကို သွားမလဲ" ရွေးတဲ့ **ကိုယ်ပိုင် စာမျက်နှာ**。
///
/// user: "start page မှာ slide menu / floating menu မသုံးပါနဲ့ —
///        ကိုယ်ပိုင် page menu ခန့်ငြားစွာ ထားပါ"
///
/// အရင်က ဒါက `showModalBottomSheet` — အောက်ကနေ ပွတ်တက်လာတဲ့ sheet ဖြစ်ပြီး
/// ရွေးစရာ ၄ ခုပဲ ကျဉ်းကျဉ်းလေး ပါတယ်၊ မတော်တဆ ဆွဲချမိရင် ပျောက်သွားတယ်။
/// အခု စာမျက်နှာ တစ်ခုလုံး — website ရဲ့ `/start` နဲ့ **တစ်သားတည်း**
/// ရွေးစရာ ၈ ခု၊ တစ်ခုနဲ့တစ်ခု ကွာအောင် ခြားထား၊ ဘာမှ မဖုံးဘူး။
///
/// ★ `Navigator.pop` နဲ့ ရွေးလိုက်တဲ့ key ကို ပြန်ပေးတယ် — ဒီစာမျက်နှာက
///   ဘယ်ကို သွားရမလဲ ကိုယ်တိုင် မဆုံးဖြတ်ဘူး၊ ခေါ်တဲ့သူက ဆုံးဖြတ်တယ်။
/// ★ ကျော်လို့ ရတယ် (← back) — ကျော်ရင် Feed မှာ ဆက်နေမယ်။
class StartScreen extends StatefulWidget {
  const StartScreen({super.key, this.name});

  /// နှုတ်ဆက်ဖို့ နာမည် — မရှိရင် နှုတ်ဆက်စာကြောင်း ချန်ထားတယ်။
  final String? name;

  @override
  State<StartScreen> createState() => _StartScreenState();
}

/// website ရဲ့ `src/lib/home-choice.ts` နဲ့ **တစ်ထပ်တည်း** ဖြစ်ရမယ် —
/// တစ်ဖက်မှာ ပြင်ရင် နောက်တစ်ဖက်မှာပါ ပြင်ပါ။
const startChoices = <StartChoice>[
  StartChoice('metaverse', '🌍', 'Metaverse',
      '3D လောကထဲ ဝင် — အခန်း ၁၅ ခု, သူငယ်ချင်းများ, ပွဲကွင်း'),
  StartChoice('feed', '📰', 'Social',
      'သတင်းစာမျက်နှာ, သူငယ်ချင်း, အုပ်စု, Reels'),
  StartChoice('shop', '🛍️', 'Shop', 'ပစ္စည်းများ ဝယ်ယူ — Gwave ဆိုင်'),
  StartChoice('market', '🏪', 'Marketplace',
      'ရောင်းဝယ်ရေး — ကိုယ့်ပစ္စည်း တင်ရောင်း'),
  StartChoice('pos', '🧾', 'POS', 'ဆိုင်ရှင်များအတွက် ရောင်းအား စနစ်'),
  StartChoice('live', '📺', 'Live', 'တိုက်ရိုက်လွှင့် / ကြည့်'),
  StartChoice('games', '🎮', 'Games', 'ဂိမ်းများ — arcade, ပြိုင်ပွဲ'),
  StartChoice('dashboard', '📊', 'Dashboard',
      'ကိုယ့်စာရင်း — ငွေ, စိုက်ခင်း, ကျန်းမာရေး'),
];

class StartChoice {
  const StartChoice(this.key, this.emoji, this.title, this.blurb);
  final String key;
  final String emoji;
  final String title;
  final String blurb;
}

/// ရွေးလိုက်တဲ့ ရလဒ် — key နဲ့ "မှတ်ထားမလား"。
class StartResult {
  const StartResult(this.key, this.remember);
  final String key;
  final bool remember;
}

class _StartScreenState extends State<StartScreen> {
  bool _remember = true;

  @override
  Widget build(BuildContext context) {
    final name = widget.name?.trim();
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
          children: [
            // ── ခေါင်းစီး ─────────────────────────────────────────────
            if (name != null && name.isNotEmpty)
              Text('မင်္ဂလာပါ $name 👋',
                  style: const TextStyle(fontSize: 13.5, color: Colors.grey)),
            const SizedBox(height: 6),
            const Text('ဘယ်ကို သွားမလဲ?',
                style: TextStyle(fontSize: 27, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            const Text(
              'တစ်ခုကို ရွေးပါ — ရွေးပြီးရင် အဲဒီနေရာကို တိုက်ရိုက် ရောက်ပါမယ်။ '
              'နောက်ပိုင်း Profile ထဲက “ဝင်ရာနေရာ” ကနေ အမြဲ ပြောင်းလို့ရပါတယ်။',
              style: TextStyle(
                  fontSize: 13, height: 1.55, color: Colors.grey),
            ),
            const SizedBox(height: 22),

            // ── ရွေးစရာများ — တစ်ခုနဲ့တစ်ခု ၁၂px ခြားထားတယ် ──────────
            for (final c in startChoices) ...[
              _ChoiceCard(
                choice: c,
                onTap: () => Navigator.of(context)
                    .pop(StartResult(c.key, _remember)),
              ),
              const SizedBox(height: 12),
            ],

            const SizedBox(height: 8),
            // ── မှတ်ထားမလား ─────────────────────────────────────────
            Container(
              decoration: BoxDecoration(
                color: GwColors.surfaceOf(context),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: GwColors.lineOf(context)),
              ),
              child: SwitchListTile(
                value: _remember,
                onChanged: (v) => setState(() => _remember = v),
                title: const Text('နောက်တစ်ခါ ဝင်ရင် တိုက်ရိုက် သွားပါ',
                    style: TextStyle(fontSize: 14)),
                subtitle: const Text('ဒီစာမျက်နှာကို မဖြတ်တော့ဘူး',
                    style: TextStyle(fontSize: 12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({required this.choice, required this.onTap});
  final StartChoice choice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: GwColors.surfaceOf(context),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          // ★ ၉၆px — လက်မနဲ့ လွယ်လွယ် ထိရအောင်၊ စာသားလည်း မကျပ်အောင်။
          constraints: const BoxConstraints(minHeight: 96),
          padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: GwColors.lineOf(context)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(choice.emoji, style: const TextStyle(fontSize: 32)),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(choice.title,
                        style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 5),
                    Text(choice.blurb,
                        style: const TextStyle(
                            fontSize: 12.5, height: 1.5, color: Colors.grey)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Colors.grey),
            ],
          ),
        ),
      ),
    );
  }
}
