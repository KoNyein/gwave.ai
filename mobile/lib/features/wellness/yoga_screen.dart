import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'wellness_common.dart';
import 'wellness_video.dart';

class _Pose {
  const _Pose(this.icon, this.sanskrit, this.en, this.my, this.cueEn,
      this.cueMy, this.seconds);
  final IconData icon;
  final String sanskrit;
  final String en;
  final String my;
  final String cueEn;
  final String cueMy;
  final int seconds;
}

/// Yoga — history & the eight limbs, a guided pose flow (a gentle Sun
/// Salutation) with per-pose voice cues and a bell, an in-app video library,
/// a step-by-step guide and a help section. Bilingual (en/my).
class YogaScreen extends StatefulWidget {
  const YogaScreen({super.key});

  @override
  State<YogaScreen> createState() => _YogaScreenState();
}

class _YogaScreenState extends State<YogaScreen> {
  static const _accent = Color(0xFF6D28D9);

  static const List<_Pose> _flow = [
    _Pose(Icons.accessibility_new, "Tāḍāsana", "Mountain", "တောင်ပုံ ဟန်",
        "Stand tall, feet grounded, breathe evenly.",
        "မတ်မတ်ရပ်၊ ခြေ မြေကိုစွဲ၊ ညီညာစွာ အသက်ရှူပါ။", 20),
    _Pose(Icons.arrow_downward, "Uttānāsana", "Forward fold", "ရှေ့ကိုင်း ဟန်",
        "Hinge from the hips and fold forward, soft knees.",
        "တင်ပါးဆစ်ကနေ ရှေ့ကိုကိုင်း၊ ဒူးအနည်းငယ်ကွေး။", 25),
    _Pose(Icons.fitness_center, "Phalakāsana", "Plank", "ပျဉ်ပြား ဟန်",
        "Strong straight line from head to heels.",
        "ခေါင်းကနေ ဖနောင့်အထိ တည့်မတ်တဲ့ မျဉ်းဖြစ်အောင်။", 20),
    _Pose(Icons.waves, "Bhujaṅgāsana", "Cobra", "မြွေဟောက် ဟန်",
        "Lift the chest, shoulders down, gentle backbend.",
        "ရင်ဘတ်ကိုမြှောက်၊ ပခုံးချ၊ ဖြည်းညှင်း ကျောကွေး။", 20),
    _Pose(Icons.change_history, "Adho Mukha", "Downward dog", "ခွေးငုံ့ ဟန်",
        "Hips high, heels reaching down, long spine.",
        "တင်ပါးမြင့်၊ ဖနောင့်အောက်ဆွဲ၊ ကျောရိုးရှည်။", 30),
    _Pose(Icons.self_improvement, "Bālāsana", "Child's pose", "ကလေး ဟန်",
        "Knees wide, forehead down, rest and breathe.",
        "ဒူးကားထား၊ နဖူးချ၊ နားပြီး အသက်ရှူပါ။", 35),
    _Pose(Icons.hotel, "Śavāsana", "Corpse pose", "အနားယူ ဟန်",
        "Lie still, let go completely, natural breath.",
        "ငြိမ်ငြိမ်လှဲ၊ လုံးဝ လွှတ်ချ၊ သဘာဝ အသက်ရှူ။", 60),
  ];

  int _rounds = 1;
  bool _voice = true;
  bool _sound = true;

  bool _running = false;
  int _round = 1;
  int _idx = 0;
  int _left = 0;
  Timer? _timer;

  final WellnessAudio _audio = WellnessAudio();
  final FlutterTts _tts = FlutterTts();

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  Future<void> _initTts() async {
    try {
      await _tts.awaitSpeakCompletion(false);
      await _tts.setSpeechRate(0.44);
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    _tts.stop();
    _audio.dispose();
    super.dispose();
  }

  void _start() {
    _audio.enabled = _sound;
    setState(() {
      _running = true;
      _round = 1;
      _idx = 0;
      _left = _flow[0].seconds;
    });
    _announce(_flow[0]);
    _audio.bell();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() => _left--);
      if (_left <= 0) _next();
    });
  }

  void _next() {
    if (_idx + 1 < _flow.length) {
      setState(() {
        _idx++;
        _left = _flow[_idx].seconds;
      });
      _audio.bell();
      HapticFeedback.selectionClick();
      _announce(_flow[_idx]);
    } else if (_round < _rounds) {
      setState(() {
        _round++;
        _idx = 0;
        _left = _flow[0].seconds;
      });
      _audio.bell();
      _announce(_flow[0]);
    } else {
      _finish();
    }
  }

  void _skip() {
    _left = 0;
    _next();
  }

  void _announce(_Pose p) {
    if (!_voice) return;
    _tts.stop();
    _tts.speak("${tr(context, p.en, p.my)}. ${tr(context, p.cueEn, p.cueMy)}");
  }

  void _finish() {
    _timer?.cancel();
    _timer = null;
    HapticFeedback.heavyImpact();
    _audio.bell();
    if (_voice) {
      _tts.stop();
      _tts.speak(tr(context, "Practice complete. Namaste.",
          "လေ့ကျင့်ခန်း ပြီးပါပြီ။ နမတ္တေ။"));
    }
    setState(() => _running = false);
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
    _tts.stop();
    setState(() => _running = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Yoga", "ယောဂ")),
        actions: const [LangToggle()],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
        children: [
          wellnessHero(
            context,
            icon: Icons.accessibility_new,
            title: tr(context, "Breath, body & stillness", "အသက်ရှူ၊ ခန္ဓာနှင့် တည်ငြိမ်မှု"),
            subtitle: tr(
                context,
                "A 5,000-year practice uniting movement, breath and awareness. Follow the guided flow below.",
                "လှုပ်ရှားမှု၊ အသက်ရှူခြင်းနှင့် သတိကို ပေါင်းစပ်ထားသော နှစ်ပေါင်း ၅၀၀၀ သက်တမ်းရှိ အကျင့်။ အောက်က လမ်းညွှန် flow ကို လိုက်ပါ။"),
            colors: const [Color(0xFF6D28D9), Color(0xFF4C1D95)],
          ),
          const SizedBox(height: 16),

          _flowCard(),
          const SizedBox(height: 4),

          wellnessSection(
            context,
            icon: Icons.auto_stories,
            title: tr(context, "History & theory", "သမိုင်းနှင့် သီအိုရီ"),
            accent: _accent,
            children: [
              wellnessPara(
                  context,
                  tr(
                      context,
                      "Yoga began in the Indus valley over 5,000 years ago and was systematised by the sage Patañjali (~200 BCE) in the Yoga Sūtras. \"Yoga\" means \"to yoke\" — uniting body, breath and mind.",
                      "ယောဂသည် လွန်ခဲ့သော နှစ်ပေါင်း ၅၀၀၀ ကျော်က အိန္ဒု မြစ်ဝှမ်းတွင် စတင်ခဲ့ပြီး ရသေ့ ပတဉ္စလိ (ဘီစီ ~၂၀၀ ခန့်) က ယောဂ သုတ္တန်တွင် စနစ်တကျ ပြုစုခဲ့သည်။ \"ယောဂ\" ဆိုသည်မှာ \"ချိတ်ဆက်ခြင်း\" — ခန္ဓာ၊ အသက်ရှူနှင့် စိတ်ကို ပေါင်းစည်းခြင်း ဖြစ်သည်။")),
              wellnessPara(
                  context,
                  tr(
                      context,
                      "Modern research links regular yoga with lower stress, better flexibility and balance, easier breathing and improved sleep. Move gently and never force a posture.",
                      "ခေတ်သစ် သုတေသနအရ ပုံမှန် ယောဂသည် စိတ်ဖိစီးမှု လျော့ခြင်း၊ ပြော့ပြောင်းမှုနှင့် ဟန်ချက် တိုးတက်ခြင်း၊ အသက်ရှူ ပိုလွယ်ခြင်းနှင့် အိပ်စက်မှု ကောင်းလာခြင်းတို့နှင့် ဆက်စပ်နေသည်။ ဖြည်းညှင်းစွာ လှုပ်ပြီး ကိုယ်ဟန်ကို ဘယ်တော့မှ အတင်းမလုပ်ပါနှင့်။")),
              const SizedBox(height: 4),
              Text(tr(context, "The eight limbs (Aṣṭāṅga)", "အင်္ဂါ ရှစ်ပါး (အဋ္ဌင်္ဂ)"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 13.5)),
              const SizedBox(height: 6),
              wellnessBullet(context, tr(context, "Yama — ethical restraints", "ယမ — ကျင့်ဝတ် ချုပ်တည်းမှု")),
              wellnessBullet(context, tr(context, "Niyama — personal observances", "နိယမ — ကိုယ်ကျင့်တရား")),
              wellnessBullet(context, tr(context, "Āsana — posture", "အာသန — ကိုယ်ဟန်")),
              wellnessBullet(context, tr(context, "Prāṇāyāma — breath control", "ပြာဏာယာမ — အသက်ရှူ ထိန်းချုပ်မှု")),
              wellnessBullet(context, tr(context, "Pratyāhāra — withdrawal of senses", "ပြတျာဟာရ — ဣန္ဒြေ ဆုတ်ခွာမှု")),
              wellnessBullet(context, tr(context, "Dhāraṇā — concentration", "ဓာရဏာ — တစ်ခုတည်း စူးစိုက်မှု")),
              wellnessBullet(context, tr(context, "Dhyāna — meditation", "ဓျာန — တရားထိုင်ခြင်း")),
              wellnessBullet(context, tr(context, "Samādhi — union / absorption", "သမာဓိ — ပေါင်းစည်းမှု")),
            ],
          ),

          wellnessSection(
            context,
            icon: Icons.ondemand_video,
            title: tr(context, "Guided classes", "လမ်းညွှန် သင်တန်းများ"),
            accent: _accent,
            children: [
              wellnessPara(
                  context,
                  tr(context,
                      "Follow along with full guided classes — they play right here in the app.",
                      "အပြည့်အစုံ လမ်းညွှန် သင်တန်းများနှင့်အတူ လိုက်လုပ်ပါ — app ထဲမှာပဲ ဖွင့်ပါသည်။")),
              const SizedBox(height: 4),
              VideoLibraryCard(
                query: tr(context, "yoga for beginners full class",
                    "ယောဂ အခြေခံ သင်တန်း"),
                label: tr(context, "Open guided class library",
                    "လမ်းညွှန် သင်တန်း စာကြည့်တိုက်"),
                note: tr(context, "Plays in-app · beginner to advanced",
                    "app ထဲဖွင့် · အခြေခံမှ အဆင့်မြင့်"),
              ),
            ],
          ),

          wellnessFoldout(
            context,
            icon: Icons.checklist,
            title: tr(context, "Practice safely", "ဘေးကင်းစွာ လေ့ကျင့်ပါ"),
            defaultOpen: true,
            children: [
              wellnessStep(context, "1", tr(context, "Warm up", "အနွေးခံ"),
                  tr(context, "Move gently first — never jump into deep stretches cold.",
                      "အရင် ဖြည်းညှင်းစွာ လှုပ်ပါ — အအေးနဲ့ အားစိုက် ဆန့်ခြင်း မလုပ်ပါနှင့်။")),
              wellnessStep(context, "2", tr(context, "Breathe", "အသက်ရှူ"),
                  tr(context, "Keep the breath slow and even; never hold it in a pose.",
                      "အသက်ကို နှေးညီစွာ ရှူပါ; ကိုယ်ဟန်ထဲမှာ ဘယ်တော့မှ မအောင့်ပါနှင့်။")),
              wellnessStep(context, "3", tr(context, "No pain", "နာကျင်မှု မရှိ"),
                  tr(context, "Stretch to a mild edge, not to pain. Ease off any sharp sensation.",
                      "အနည်းငယ် တင်းမာသည်အထိသာ ဆန့်ပါ၊ နာအောင် မလုပ်ပါနှင့်။ ချောင်းချောင်း နာရင် လျှော့ပါ။")),
              wellnessStep(context, "4", tr(context, "Rest", "အနားယူ"),
                  tr(context, "Always finish with Śavāsana — a minute of complete stillness.",
                      "အမြဲတမ်း သဝါသန (အနားယူ ဟန်) နဲ့ အဆုံးသတ်ပါ — တစ်မိနစ် လုံးဝ ငြိမ်သက်စွာ။")),
            ],
          ),

          wellnessFoldout(
            context,
            icon: Icons.help_outline,
            title: tr(context, "Help & FAQ", "အကူအညီ + FAQ"),
            children: [
              wellnessFaq(
                  context,
                  tr(context, "I'm not flexible. Can I still do yoga?",
                      "ကိုယ် မပျော့ဘူး။ ယောဂ လုပ်လို့ရမလား?"),
                  tr(context, "Yes — flexibility is a result of practice, not a requirement. Bend your knees and go gently.",
                      "ရပါတယ် — ပြော့ပြောင်းမှုက အကျင့်ရဲ့ ရလဒ်ဖြစ်တယ်၊ လိုအပ်ချက် မဟုတ်ဘူး။ ဒူးကွေးပြီး ဖြည်းညှင်းစွာ လုပ်ပါ။")),
              wellnessFaq(
                  context,
                  tr(context, "When should I not practise?", "ဘယ်အချိန် မလုပ်သင့်လဲ?"),
                  tr(context, "Avoid on a full stomach, and check with a doctor if pregnant, injured or with a heart condition.",
                      "ဗိုက်ပြည့်နေချိန် ရှောင်ပါ; ကိုယ်ဝန်ဆောင်၊ ဒဏ်ရာ (သို့) နှလုံးရောဂါ ရှိရင် ဆရာဝန်နဲ့ တိုင်ပင်ပါ။")),
              wellnessFaq(
                  context,
                  tr(context, "How often?", "ဘယ်နှစ်ကြိမ်?"),
                  tr(context, "Even 10–15 minutes a few times a week brings real benefit. Little and often wins.",
                      "တစ်ပတ်လျှင် အကြိမ်အနည်းငယ် ၁၀–၁၅ မိနစ်ပင် အကျိုးရှိသည်။ နည်းနည်း မကြာခဏက အနိုင်ရသည်။")),
            ],
          ),

          const SizedBox(height: 8),
          Text(
            tr(context,
                "For general wellbeing only. Not medical or physiotherapy advice. Stop and seek help if you feel pain, dizziness or breathlessness.",
                "ယေဘုယျ ကျန်းမာရေးအတွက်သာ။ ဆေးဘက် (သို့) ရုပ်ပိုင်းကုထုံး အကြံဉာဏ် မဟုတ်ပါ။ နာကျင်၊ မူးဝေ (သို့) အသက်ရှူကျပ်ရင် ရပ်ပြီး အကူအညီ ရှာပါ။"),
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _flowCard() {
    final pose = _flow[_idx];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        children: [
          Container(
            width: 130,
            height: 130,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [
                  _accent.withValues(alpha: 0.85),
                  _accent.withValues(alpha: 0.55),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                    color: _accent.withValues(alpha: 0.3),
                    blurRadius: 20,
                    spreadRadius: 2),
              ],
            ),
            child: Icon(pose.icon, color: Colors.white, size: 62),
          ),
          const SizedBox(height: 14),
          if (_running) ...[
            Text("${pose.en} · ${pose.my}",
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 17)),
            Text(pose.sanskrit,
                style: TextStyle(
                    color: GwColors.inkSoftOf(context),
                    fontSize: 12.5,
                    fontStyle: FontStyle.italic)),
            const SizedBox(height: 4),
            Text("$_left${tr(context, "s", "s")}",
                style: TextStyle(
                    color: _accent,
                    fontSize: 34,
                    fontWeight: FontWeight.w900)),
            Text(tr(context, pose.cueEn, pose.cueMy),
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 12.5)),
            const SizedBox(height: 6),
            Text(
                tr(context, "Round $_round of $_rounds · pose ${_idx + 1}/${_flow.length}",
                    "အဆင့် $_round / $_rounds · ဟန် ${_idx + 1}/${_flow.length}"),
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 11.5)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _skip,
                    icon: const Icon(Icons.skip_next),
                    label: Text(tr(context, "Next pose", "နောက်ဟန်")),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _stop,
                    icon: const Icon(Icons.stop),
                    label: Text(tr(context, "End", "ပြီးဆုံး")),
                  ),
                ),
              ],
            ),
          ] else ...[
            Text(tr(context, "Guided Sun Salutation flow", "လမ်းညွှန် နေဆုတောင်း flow"),
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 15)),
            const SizedBox(height: 2),
            Text(
                tr(context, "${_flow.length} poses · about ${_totalMin()} min",
                    "ဟန် ${_flow.length} ခု · ~${_totalMin()} မိနစ်"),
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 12.5)),
            const SizedBox(height: 12),
            _chooser(),
            const SizedBox(height: 12),
            Row(
              children: [
                _toggleChip(Icons.volume_up, tr(context, "Bell", "ခေါင်းလောင်း"),
                    _sound, () => setState(() => _sound = !_sound)),
                const SizedBox(width: 8),
                _toggleChip(Icons.record_voice_over, tr(context, "Voice", "အသံ"),
                    _voice, () => setState(() => _voice = !_voice)),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _start,
                style: FilledButton.styleFrom(
                    backgroundColor: _accent,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                icon: const Icon(Icons.play_arrow),
                label: Text(tr(context, "Start flow", "flow စတင်")),
              ),
            ),
          ],
        ],
      ),
    );
  }

  int _totalMin() {
    final secs =
        _flow.fold<int>(0, (a, p) => a + p.seconds) * _rounds;
    return (secs / 60).ceil();
  }

  Widget _chooser() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(tr(context, "Rounds", "အဆင့်"),
            style: TextStyle(
                color: GwColors.inkSoftOf(context),
                fontSize: 12,
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          children: [
            for (final r in [1, 2, 3])
              GestureDetector(
                onTap: () => setState(() => _rounds = r),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                  decoration: BoxDecoration(
                    color: _rounds == r ? _accent : GwColors.bgOf(context),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: GwColors.lineOf(context)),
                  ),
                  child: Text("$r",
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: _rounds == r
                              ? Colors.white
                              : GwColors.inkSoftOf(context))),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _toggleChip(
      IconData icon, String label, bool on, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color:
                on ? _accent.withValues(alpha: 0.12) : GwColors.bgOf(context),
            borderRadius: BorderRadius.circular(GwRadius.md),
            border: Border.all(
                color: on
                    ? _accent.withValues(alpha: 0.5)
                    : GwColors.lineOf(context)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 17,
                  color: on ? _accent : GwColors.inkSoftOf(context)),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: on ? _accent : GwColors.inkSoftOf(context))),
            ],
          ),
        ),
      ),
    );
  }
}
