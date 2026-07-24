import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'wellness_common.dart';
import 'wellness_video.dart';

/// Myanmar Theravāda Buddhist meditation — history & theory, a guided sit timer
/// with an interval singing bowl and optional spoken guidance, an in-app video
/// library, the core suttas/texts and a help section. Bilingual (en/my).
class MeditationScreen extends StatefulWidget {
  const MeditationScreen({super.key});

  @override
  State<MeditationScreen> createState() => _MeditationScreenState();
}

class _MeditationScreenState extends State<MeditationScreen> {
  static const _durations = [5, 10, 15, 20, 30, 45];
  static const _intervals = [0, 5, 10, 15];

  int _minutes = 10;
  int _intervalMin = 5;
  bool _sound = true;
  bool _voice = true;

  bool _running = false;
  bool _paused = false;
  int _elapsed = 0; // seconds
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
      await _tts.setSpeechRate(0.42);
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    _tts.stop();
    _audio.dispose();
    super.dispose();
  }

  int get _total => _minutes * 60;

  void _start() {
    _audio.enabled = _sound;
    setState(() {
      _running = true;
      _paused = false;
      _elapsed = 0;
    });
    HapticFeedback.mediumImpact();
    _audio.bell();
    if (_voice) {
      _tts.stop();
      _tts.speak(tr(
          context,
          "Sit comfortably. Close your eyes, and gently rest your attention on the breath at the tip of the nose.",
          "သက်တောင့်သက်သာ ထိုင်ပါ။ မျက်စိမှိတ်ပြီး နှာသီးဖျားက ဝင်လေထွက်လေကို ဖြည်းညှင်းစွာ သတိထားပါ။"));
    }
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_paused) return;
      setState(() => _elapsed++);
      // Interval bell
      if (_intervalMin > 0 &&
          _elapsed > 0 &&
          _elapsed < _total &&
          _elapsed % (_intervalMin * 60) == 0) {
        _audio.bell();
        HapticFeedback.selectionClick();
      }
      if (_elapsed >= _total) _finish();
    });
  }

  void _finish() {
    _timer?.cancel();
    _timer = null;
    HapticFeedback.heavyImpact();
    _audio.bell();
    if (_voice) {
      _tts.stop();
      _tts.speak(tr(
          context,
          "The sitting is complete. Slowly open your eyes, and carry this calm with you.",
          "တရားထိုင်ခြင်း ပြီးဆုံးပါပြီ။ ဖြည်းဖြည်းချင်း မျက်စိဖွင့်ပြီး ဤတည်ငြိမ်မှုကို သယ်ဆောင်သွားပါ။"));
    }
    setState(() {
      _running = false;
      _paused = false;
    });
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
    _tts.stop();
    setState(() {
      _running = false;
      _paused = false;
      _elapsed = 0;
    });
  }

  String _clock(int secs) {
    final m = (secs ~/ 60).toString().padLeft(2, "0");
    final s = (secs % 60).toString().padLeft(2, "0");
    return "$m:$s";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Buddhist meditation", "ဗုဒ္ဓဘာသာ တရားထိုင်")),
        actions: const [LangToggle()],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
        children: [
          wellnessHero(
            context,
            icon: Icons.spa,
            title: tr(context, "Ānāpāna · Vipassanā · Mettā",
                "အာနာပါန · ဝိပဿနာ · မေတ္တာ"),
            subtitle: tr(
                context,
                "The Myanmar Theravāda path of mindfulness and insight, as taught by Mahāsi, Ledi and Pa-Auk lineages.",
                "မဟာစည်၊ လယ်တီနှင့် ဖားအောက် ဆရာတော်ကြီးများ သွန်သင်ခဲ့သည့် မြန်မာ ထေရဝါဒ သတိပဋ္ဌာန်နှင့် ဝိပဿနာ လမ်းစဉ်။"),
            colors: const [Color(0xFFB45309), Color(0xFF7C2D12)],
          ),
          const SizedBox(height: 16),

          // Guided sit timer
          _timerCard(),
          const SizedBox(height: 4),

          // History & theory
          wellnessSection(
            context,
            icon: Icons.auto_stories,
            title: tr(context, "History & the path", "သမိုင်းနှင့် လမ်းစဉ်"),
            accent: const Color(0xFFB45309),
            children: [
              wellnessPara(
                  context,
                  tr(
                      context,
                      "About 2,600 years ago in northern India, the Buddha taught meditation (bhāvanā) as the direct way to end suffering. Two wings support the path: samatha (calm) and vipassanā (insight).",
                      "လွန်ခဲ့သော နှစ်ပေါင်း ၂၆၀၀ ခန့်က မြောက်ပိုင်း အိန္ဒိယတွင် မြတ်စွာဘုရားသည် ဒုက္ခချုပ်ငြိမ်းရာ တိုက်ရိုက်လမ်းအဖြစ် တရားဘာဝနာကို ဟောကြားခဲ့သည်။ လမ်းစဉ်ကို သမထ (တည်ငြိမ်ခြင်း) နှင့် ဝိပဿနာ (ထိုးထွင်းသိမြင်ခြင်း) ဟူသော အတောင်နှစ်ဖက်က ထောက်ပံ့သည်။")),
              wellnessPara(
                  context,
                  tr(
                      context,
                      "Myanmar became a heartland of this practice. Ledi Sayadaw (1846–1923) opened insight meditation to lay people; Mahāsi Sayadaw systematised noting (\"rising… falling\"); and Sayagyi U Ba Khin's line reached the world through S. N. Goenka.",
                      "မြန်မာနိုင်ငံသည် ဤအကျင့်၏ အချက်အချာ ဖြစ်လာခဲ့သည်။ လယ်တီဆရာတော် (၁၈၄၆–၁၉၂၃) က ဝိပဿနာကို လူပုဂ္ဂိုလ်များထံ ဖွင့်ပေးခဲ့; မဟာစည်ဆရာတော်က မှတ်သားနည်း (\"ဖောင်း… ပျက်\") ကို စနစ်တကျ ပြုစုခဲ့; ဆရာကြီး ဦးဘခင်၏ အနွယ်သည် ဂိုအင်ကာမှတစ်ဆင့် ကမ္ဘာသို့ ရောက်ရှိခဲ့သည်။")),
              const SizedBox(height: 4),
              _pillar(
                  tr(context, "Ānāpānasati", "အာနာပါနသတိ"),
                  tr(context, "Mindfulness of in-and-out breathing — steadies the mind.",
                      "ဝင်လေထွက်လေကို သတိထားခြင်း — စိတ်ကို တည်ငြိမ်စေသည်။")),
              _pillar(
                  tr(context, "Vipassanā", "ဝိပဿနာ"),
                  tr(context, "Insight into impermanence (anicca), unsatisfactoriness (dukkha) and non-self (anattā).",
                      "အနိစ္စ၊ ဒုက္ခနှင့် အနတ္တကို ထိုးထွင်းသိမြင်ခြင်း။")),
              _pillar(
                  tr(context, "Mettā", "မေတ္တာ"),
                  tr(context, "Loving-kindness radiated to oneself and all beings.",
                      "မိမိနှင့် သတ္တဝါအားလုံးအပေါ် ပျံ့နှံ့စေသော မေတ္တာစိတ်။")),
            ],
          ),

          // Video library (in-app)
          wellnessSection(
            context,
            icon: Icons.ondemand_video,
            title: tr(context, "Guided talks & sittings", "လမ်းညွှန် တရားတော်များ"),
            accent: const Color(0xFFB45309),
            children: [
              wellnessPara(
                  context,
                  tr(context,
                      "Watch guided sessions and dhamma talks — they play right here in the app.",
                      "လမ်းညွှန် တရားထိုင်ခြင်းများနှင့် ဓမ္မဟောကြားချက်များကို ကြည့်ပါ — app ထဲမှာပဲ ဖွင့်ပါသည်။")),
              const SizedBox(height: 4),
              VideoLibraryCard(
                query: tr(context, "guided vipassana meditation dhamma talk",
                    "ဝိပဿနာ တရားထိုင် လမ်းညွှန် တရားတော်"),
                label: tr(context, "Open guided video library",
                    "လမ်းညွှန် ဗီဒီယို စာကြည့်တိုက်"),
                note: tr(context, "Plays in-app · Vipassanā, Ānāpāna, Mettā",
                    "app ထဲဖွင့် · ဝိပဿနာ၊ အာနာပါန၊ မေတ္တာ"),
              ),
            ],
          ),

          // Texts
          wellnessSection(
            context,
            icon: Icons.menu_book,
            title: tr(context, "Core texts", "အခြေခံ ကျမ်းဂန်များ"),
            accent: const Color(0xFFB45309),
            children: [
              _text(
                  tr(context, "Satipaṭṭhāna Sutta", "သတိပဋ္ဌာနသုတ်"),
                  tr(context, "The four foundations of mindfulness: body, feelings, mind and mind-objects.",
                      "သတိပဋ္ဌာန် လေးပါး — ကာယ၊ ဝေဒနာ၊ စိတ်နှင့် ဓမ္မ။")),
              _text(
                  tr(context, "Ānāpānasati Sutta", "အာနာပါနသတိသုတ်"),
                  tr(context, "Sixteen steps of breath meditation that fulfil the seven factors of awakening.",
                      "ဗောဇ္ဈင်ခုနစ်ပါးကို ဖြည့်ဆည်းပေးသော အသက်ရှူ ဘာဝနာ ၁၆ ဆင့်။")),
              _text(
                  tr(context, "Mettā Sutta", "မေတ္တသုတ်"),
                  tr(context, "The Buddha's teaching on radiating boundless loving-kindness.",
                      "အတိုင်းအဆမဲ့ မေတ္တာ ပျံ့နှံ့စေခြင်းအကြောင်း မြတ်စွာဘုရား ဟောကြားချက်။")),
            ],
          ),

          // Guide
          wellnessFoldout(
            context,
            icon: Icons.checklist,
            title: tr(context, "How to sit — step by step", "တရားထိုင်နည်း — အဆင့်လိုက်"),
            defaultOpen: true,
            children: [
              wellnessStep(context, "1",
                  tr(context, "Posture", "ကိုယ်ဟန်"),
                  tr(context, "Sit upright but relaxed — cross-legged, on a cushion or a chair. Hands resting, spine easy.",
                      "မတ်မတ်ဖြေဖြေ ထိုင်ပါ — ခေါက်၍ (သို့) ခုံပေါ်။ လက်ကို ဖြေထား၊ ကျောရိုးကို သက်တောင့်သက်သာ။")),
              wellnessStep(context, "2",
                  tr(context, "Settle", "တည်ငြိမ်"),
                  tr(context, "Take three slow breaths. Let the body soften and the eyes close.",
                      "နှေးနှေး သုံးချက် အသက်ရှူပါ။ ခန္ဓာကို ပျော့ပြောင်းစေ၊ မျက်စိမှိတ်ပါ။")),
              wellnessStep(context, "3",
                  tr(context, "Know the breath", "လေကို သိ"),
                  tr(context, "Feel the natural breath at the nose. Don't control it — just know each in-breath and out-breath.",
                      "နှာသီးက သဘာဝ ဝင်လေထွက်လေကို ခံစားပါ။ မထိန်းပါနှင့် — ဝင်တိုင်း ထွက်တိုင်း သိရုံသာ။")),
              wellnessStep(context, "4",
                  tr(context, "Note & return", "မှတ်၍ ပြန်လာ"),
                  tr(context, "When the mind wanders, gently note \"thinking\" and return to the breath. This returning is the practice.",
                      "စိတ်လွင့်သွားရင် \"တွေးနေတယ်\" ဟု ဖြည်းညှင်းစွာ မှတ်ပြီး လေဆီ ပြန်လာပါ။ ဤပြန်လာခြင်းသည်ပင် အကျင့်ဖြစ်သည်။")),
              wellnessStep(context, "5",
                  tr(context, "Close with mettā", "မေတ္တာဖြင့် နိဂုံး"),
                  tr(context, "End by wishing yourself and all beings to be well, happy and peaceful.",
                      "မိမိနှင့် သတ္တဝါအားလုံး ကျန်းမာ၊ ချမ်းသာ၊ ငြိမ်းချမ်းပါစေဟု ဆုတောင်း၍ အဆုံးသတ်ပါ။")),
            ],
          ),

          // Help
          wellnessFoldout(
            context,
            icon: Icons.help_outline,
            title: tr(context, "Help & FAQ", "အကူအညီ + FAQ"),
            children: [
              wellnessFaq(
                  context,
                  tr(context, "My mind won't stop. Am I doing it wrong?",
                      "စိတ်က မငြိမ်ဘူး။ မှားနေတာလား?"),
                  tr(context, "No. Noticing the mind has wandered IS mindfulness. Every gentle return strengthens it.",
                      "မဟုတ်ပါ။ စိတ်လွင့်သွားမှန်း သိလိုက်ခြင်းသည်ပင် သတိဖြစ်သည်။ ဖြည်းညှင်းစွာ ပြန်လာတိုင်း သတိ ခိုင်မာလာသည်။")),
              wellnessFaq(
                  context,
                  tr(context, "How long should I sit?", "ဘယ်လောက်ကြာ ထိုင်ရမလဲ?"),
                  tr(context, "Start with 10 minutes daily. Consistency matters far more than length.",
                      "နေ့စဉ် ၁၀ မိနစ်နဲ့ စပါ။ ကြာချိန်ထက် ပုံမှန်ဖြစ်ခြင်းက ပိုအရေးကြီးသည်။")),
              wellnessFaq(
                  context,
                  tr(context, "Do I need to be Buddhist?", "ဗုဒ္ဓဘာသာ ဖြစ်ဖို့ လိုလား?"),
                  tr(context, "The breath and mindfulness practices are open to everyone, of any faith or none.",
                      "အသက်ရှူနှင့် သတိအကျင့်များသည် မည်သည့်ဘာသာ မဆို၊ ဘာသာမဲ့ ဖြစ်စေ လူတိုင်းအတွက် ဖွင့်ထားသည်။")),
            ],
          ),

          const SizedBox(height: 8),
          Text(
            tr(context,
                "Offered with respect for the Dhamma, for study and personal practice. Not a substitute for a qualified teacher (kammaṭṭhāna sayadaw).",
                "ဓမ္မကို လေးစားစွာဖြင့် လေ့လာမှုနှင့် ကိုယ်တိုင်ကျင့်ကြံရန် တင်ဆက်ထားခြင်း ဖြစ်သည်။ ကမ္မဋ္ဌာန်း ဆရာတော်ကို အစားထိုး၍ မရပါ။"),
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _timerCard() {
    final remaining = _running ? _total - _elapsed : _total;
    final progress = _running && _total > 0 ? _elapsed / _total : 0.0;
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
          SizedBox(
            width: 190,
            height: 190,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 190,
                  height: 190,
                  child: CircularProgressIndicator(
                    value: _running ? progress : 0,
                    strokeWidth: 8,
                    backgroundColor: GwColors.lineOf(context),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFFB45309)),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_clock(remaining),
                        style: const TextStyle(
                            fontSize: 40, fontWeight: FontWeight.w900)),
                    Text(
                        _running
                            ? tr(context, "remaining", "ကျန်")
                            : tr(context, "$_minutes min sit", "$_minutes မိနစ် ထိုင်"),
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 12.5)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (!_running) ...[
            _chooser(
                tr(context, "Duration", "ကြာချိန်"),
                _durations,
                _minutes,
                (v) => setState(() => _minutes = v),
                (v) => "$v${tr(context, "m", "မိ")}"),
            const SizedBox(height: 10),
            _chooser(
                tr(context, "Interval bell", "ကြားခေါင်းလောင်း"),
                _intervals,
                _intervalMin,
                (v) => setState(() => _intervalMin = v),
                (v) => v == 0
                    ? tr(context, "Off", "ပိတ်")
                    : "$v${tr(context, "m", "မိ")}"),
            const SizedBox(height: 14),
            Row(
              children: [
                _toggleChip(Icons.volume_up, tr(context, "Bell", "ခေါင်းလောင်း"),
                    _sound, () => setState(() => _sound = !_sound)),
                const SizedBox(width: 8),
                _toggleChip(
                    Icons.record_voice_over,
                    tr(context, "Voice", "အသံ"),
                    _voice,
                    () => setState(() => _voice = !_voice)),
              ],
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _start,
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFB45309),
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                icon: const Icon(Icons.play_arrow),
                label: Text(tr(context, "Begin sitting", "စတင် ထိုင်ရန်")),
              ),
            ),
          ] else
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _paused = !_paused),
                    icon: Icon(_paused ? Icons.play_arrow : Icons.pause),
                    label: Text(_paused
                        ? tr(context, "Resume", "ဆက်")
                        : tr(context, "Pause", "ခဏရပ်")),
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
        ],
      ),
    );
  }

  Widget _chooser(String label, List<int> options, int value,
      ValueChanged<int> onChange, String Function(int) fmt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: TextStyle(
                color: GwColors.inkSoftOf(context),
                fontSize: 12,
                fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            for (final o in options)
              GestureDetector(
                onTap: () => onChange(o),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: value == o
                        ? const Color(0xFFB45309)
                        : GwColors.bgOf(context),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: GwColors.lineOf(context)),
                  ),
                  child: Text(fmt(o),
                      style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: value == o
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
            color: on
                ? const Color(0xFFB45309).withValues(alpha: 0.12)
                : GwColors.bgOf(context),
            borderRadius: BorderRadius.circular(GwRadius.md),
            border: Border.all(
                color: on
                    ? const Color(0xFFB45309).withValues(alpha: 0.5)
                    : GwColors.lineOf(context)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 17,
                  color: on
                      ? const Color(0xFFB45309)
                      : GwColors.inkSoftOf(context)),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: on
                          ? const Color(0xFFB45309)
                          : GwColors.inkSoftOf(context))),
            ],
          ),
        ),
      ),
    );
  }

  Widget _pillar(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 2, right: 8),
            child: Icon(Icons.brightness_7,
                size: 16, color: Color(0xFFB45309)),
          ),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                    color: GwColors.inkSoftOf(context),
                    fontSize: 13,
                    height: 1.4),
                children: [
                  TextSpan(
                      text: "$title — ",
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: GwColors.inkOf(context))),
                  TextSpan(text: body),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _text(String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 13.5)),
          const SizedBox(height: 2),
          Text(body,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  fontSize: 12.5,
                  height: 1.4)),
        ],
      ),
    );
  }
}
