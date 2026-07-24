import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// A full guided Wim Hof–style breathing trainer, native for the app.
///
/// Mirrors the browser trainer (`src/components/wellness/wim-hof-breathing.tsx`):
/// an animated breathing orb, real breath sounds synthesised on the fly (filtered
/// noise played through audioplayers), spoken coaching via the device TTS, a
/// per-round retention timer, a session summary, a server-saved practice history
/// (personal best + streak, `breath_sessions`), a 4-phase infographic, a guide,
/// a guided video link, the history/science, a safety notice and an FAQ.
///
/// Not medical advice. Never practise in or near water, while driving, or
/// standing up.
class BreathingScreen extends StatefulWidget {
  const BreathingScreen({super.key});

  @override
  State<BreathingScreen> createState() => _BreathingScreenState();
}

enum _Phase { idle, breathing, holdEmpty, holdFull, finished }

enum _Pace { slow, medium, fast }

const Map<_Pace, ({int inMs, int outMs})> _paceMs = {
  _Pace.slow: (inMs: 2200, outMs: 2200),
  _Pace.medium: (inMs: 1700, outMs: 1700),
  _Pace.fast: (inMs: 1300, outMs: 1300),
};

const int _recoverySeconds = 15;
const int _retentionCapSeconds = 180;
const String _videoUrl = "https://www.youtube.com/watch?v=tybOi4hjZFQ";

String _mmss(int total) {
  final m = (total ~/ 60).toString().padLeft(2, "0");
  final s = (total % 60).toString().padLeft(2, "0");
  return "$m:$s";
}

class _BreathingScreenState extends State<BreathingScreen> {
  // Settings
  int _rounds = 3;
  int _breaths = 30;
  _Pace _pace = _Pace.medium;
  bool _sound = true;
  bool _voice = true;

  // Live session state
  _Phase _phase = _Phase.idle;
  int _round = 1;
  int _breathNo = 0;
  double _orbScale = 0.5;
  int _orbMs = 1200;
  String _orbLabel = "";
  int _holdSecs = 0;
  final List<int> _retentions = [];

  // Server-saved practice history
  List<Map<String, dynamic>> _sessions = [];
  int _best = 0;
  int _count = 0;
  int _streak = 0;

  // Scheduling guards
  int _runId = 0;
  Timer? _timer;
  Timer? _ticker;

  // Audio
  final AudioPlayer _player = AudioPlayer();
  final FlutterTts _tts = FlutterTts();

  @override
  void initState() {
    super.initState();
    _orbLabel = "Ready";
    _initTts();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadProgress());
  }

  Future<void> _initTts() async {
    try {
      await _tts.awaitSpeakCompletion(false);
      await _tts.setVolume(1.0);
      await _tts.setSpeechRate(0.42);
    } catch (_) {/* TTS unavailable — visuals still guide the breath */}
  }

  @override
  void dispose() {
    _runId++;
    _timer?.cancel();
    _ticker?.cancel();
    _tts.stop();
    _player.dispose();
    super.dispose();
  }

  // ---- Server history --------------------------------------------------------
  Future<void> _loadProgress() async {
    try {
      final api = context.read<AppState>().api;
      final uid = api.session?.profileId;
      if (uid == null) return;
      final rows = await api.select("breath_sessions", query: {
        "user_id": "eq.$uid",
        "select": "id,rounds,breaths,pace,retentions,best_s,created_at",
        "order": "created_at.desc",
        "limit": "60",
      });
      if (!mounted) return;
      final best = rows.fold<int>(
          0, (m, r) => math.max(m, (r["best_s"] as num?)?.toInt() ?? 0));
      // Current streak: consecutive calendar days ending today/yesterday.
      final days = rows
          .map((r) => (r["created_at"] as String?)?.substring(0, 10))
          .whereType<String>()
          .toSet();
      var streak = 0;
      var d = DateTime.now().toUtc();
      String key(DateTime x) => x.toIso8601String().substring(0, 10);
      if (!days.contains(key(d))) d = d.subtract(const Duration(days: 1));
      while (days.contains(key(d))) {
        streak++;
        d = d.subtract(const Duration(days: 1));
      }
      setState(() {
        _sessions = rows.take(14).toList();
        _best = best;
        _count = rows.length;
        _streak = streak;
      });
    } catch (_) {/* offline / table not migrated — panel stays hidden */}
  }

  Future<void> _saveSession() async {
    try {
      final api = context.read<AppState>().api;
      final uid = api.session?.profileId;
      if (uid == null) return;
      final best = _retentions.isEmpty
          ? 0
          : _retentions.reduce((a, b) => math.max(a, b));
      await api.insert("breath_sessions", {
        "user_id": uid,
        "method": "wim_hof",
        "rounds": _rounds,
        "breaths": _breaths,
        "pace": _pace.name,
        "retentions": _retentions,
        "best_s": best,
        "total_s": _retentions.fold<int>(0, (a, b) => a + b),
      });
      await _loadProgress();
    } catch (_) {/* best-effort */}
  }

  // ---- Audio cues ------------------------------------------------------------
  Future<void> _playWav(Uint8List bytes) async {
    if (!_sound) return;
    try {
      await _player.stop();
      await _player.play(BytesSource(bytes, mimeType: "audio/wav"));
    } catch (_) {/* audio unavailable — visuals still guide the breath */}
  }

  void _breathSound(bool inhale, int ms) {
    HapticFeedback.selectionClick();
    _playWav(_breathWav(inhale, ms));
  }

  void _gong() {
    HapticFeedback.heavyImpact();
    _playWav(_gongWav());
  }

  Future<void> _speak(String text) async {
    if (!_voice) return;
    try {
      await _tts.stop();
      await _tts.speak(text);
    } catch (_) {/* speech unavailable */}
  }

  // ---- State machine ---------------------------------------------------------
  void _clearTimers() {
    _timer?.cancel();
    _ticker?.cancel();
    _timer = null;
    _ticker = null;
  }

  void _start() {
    _runId++;
    final myRun = _runId;
    _clearTimers();
    setState(() => _retentions.clear());
    _startBreathing(myRun, 1);
  }

  void _startBreathing(int myRun, int thisRound) {
    if (_runId != myRun) return;
    setState(() {
      _phase = _Phase.breathing;
      _round = thisRound;
      _breathNo = 0;
    });
    _speak(tr(context, "Round $thisRound. Begin.", "အဆင့် $thisRound။ စတင်ပါ။"));
    final p = _paceMs[_pace]!;

    void inhale(int n) {
      if (_runId != myRun) return;
      if (n > _breaths) {
        _startRetention(myRun, thisRound);
        return;
      }
      setState(() {
        _breathNo = n;
        _orbLabel = tr(context, "Breathe in", "ရှူသွင်း");
        _orbMs = p.inMs;
        _orbScale = 1.08;
      });
      _breathSound(true, p.inMs);
      _timer = Timer(Duration(milliseconds: p.inMs), () {
        if (_runId != myRun) return;
        setState(() {
          _orbLabel = tr(context, "Let go", "လွှတ်လိုက်");
          _orbMs = p.outMs;
          _orbScale = 0.45;
        });
        _breathSound(false, p.outMs);
        _timer = Timer(Duration(milliseconds: p.outMs), () => inhale(n + 1));
      });
    }

    inhale(1);
  }

  void _startRetention(int myRun, int thisRound) {
    if (_runId != myRun) return;
    setState(() {
      _phase = _Phase.holdEmpty;
      _orbLabel = tr(context, "Hold (empty)", "အသက်အောင့် (ဟာ)");
      _orbMs = 3000;
      _orbScale = 0.4;
      _holdSecs = 0;
    });
    _gong();
    _speak(tr(context, "Exhale, and hold.", "အသက်ထုတ်ပြီး အောင့်ထားပါ။"));
    var secs = 0;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_runId != myRun) return;
      secs++;
      setState(() => _holdSecs = secs);
      if (secs >= _retentionCapSeconds) _endRetention();
    });
  }

  void _endRetention() {
    final myRun = _runId;
    _ticker?.cancel();
    _ticker = null;
    setState(() => _retentions.add(_holdSecs));
    final nextRound = _round + 1;
    if (nextRound > _rounds) {
      _startRecovery(myRun, finishAfter: true);
    } else {
      _startRecovery(myRun, nextRound: nextRound);
    }
  }

  void _startRecovery(int myRun, {int? nextRound, bool finishAfter = false}) {
    if (_runId != myRun) return;
    setState(() {
      _phase = _Phase.holdFull;
      _orbLabel = tr(context, "Deep breath — hold", "အသက်ပြင်း — အောင့်");
      _orbMs = 2500;
      _orbScale = 1.1;
    });
    _gong();
    _speak(finishAfter
        ? tr(context, "Deep breath in, and hold. Last round.",
            "အသက်ပြင်းပြင်း ရှူသွင်းပြီး အောင့်ပါ။ နောက်ဆုံးအဆင့်။")
        : tr(context, "Deep breath in, and hold.",
            "အသက်ပြင်းပြင်း ရှူသွင်းပြီး အောင့်ပါ။"));
    var left = _recoverySeconds;
    setState(() => _holdSecs = left);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_runId != myRun) return;
      left--;
      setState(() => _holdSecs = left);
      if (left <= 0) {
        _ticker?.cancel();
        _ticker = null;
        if (finishAfter) {
          _finish(myRun);
        } else {
          _startBreathing(myRun, nextRound!);
        }
      }
    });
  }

  void _finish(int myRun) {
    if (_runId != myRun) return;
    _clearTimers();
    setState(() {
      _phase = _Phase.finished;
      _orbLabel = tr(context, "Complete", "ပြီးပါပြီ");
      _orbScale = 0.7;
    });
    _gong();
    _speak(tr(context, "Well done. Breathe normally.",
        "တော်ပါတယ်။ ပုံမှန်အသက်ရှူပါ။"));
    _saveSession();
  }

  void _stop() {
    _runId++;
    _clearTimers();
    _tts.stop();
    _player.stop();
    setState(() {
      _phase = _Phase.idle;
      _orbLabel = tr(context, "Ready", "အသင့်");
      _orbScale = 0.45;
      _breathNo = 0;
      _holdSecs = 0;
      _round = 1;
    });
  }

  // ---- UI --------------------------------------------------------------------
  @override
  Widget build(BuildContext context) {
    final active = _phase != _Phase.idle && _phase != _Phase.finished;
    final config = _phase == _Phase.idle || _phase == _Phase.finished;
    final p = _paceMs[_pace]!;
    return Scaffold(
      appBar: AppBar(
          title: Text(tr(context, "Breathing", "အသက်ရှူလေ့ကျင့်ခန်း"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.air, color: GwColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tr(context, "Wim Hof breathing",
                          "Wim Hof အသက်ရှူနည်း"),
                      style: const TextStyle(
                          fontWeight: FontWeight.w900, fontSize: 16),
                    ),
                    Text(
                      tr(context, "Guided power-breathing & retention",
                          "လမ်းညွှန်ပါ အသက်ရှူ + အသက်အောင့် လေ့ကျင့်ခန်း"),
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 12.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Safety notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(GwRadius.md),
              border: Border.all(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined,
                    color: Color(0xFFB45309), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tr(context,
                        "Safety: sit or lie down. Never practise in or near water, while driving, or standing. Stop if you feel faint.",
                        "လုံခြုံရေး — ထိုင်၍ (သို့) လှဲ၍သာ လုပ်ပါ။ ရေအနီး၊ ကားမောင်းစဉ်၊ မတ်တပ်ရပ်စဉ် ဘယ်တော့မှ မလုပ်ပါနှင့်။ မူးသလိုခံစားရရင် ရပ်ပါ။"),
                    style: const TextStyle(
                        color: Color(0xFFB45309), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Breathing stage
          Center(child: _orb()),
          const SizedBox(height: 16),

          if (_phase == _Phase.breathing) _breathDots(),
          if ((active || _phase == _Phase.finished) && _rounds > 1) ...[
            const SizedBox(height: 12),
            _roundPips(),
          ],

          const SizedBox(height: 12),
          Center(
            child: Text(
              _statusLine(),
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context), fontSize: 13.5),
            ),
          ),
          const SizedBox(height: 16),

          // Controls
          _controls(active),

          // Settings
          if (config) ...[
            const SizedBox(height: 18),
            _settings(p),
          ],

          // Session summary
          if (_phase == _Phase.finished && _retentions.isNotEmpty) ...[
            const SizedBox(height: 16),
            _summary(),
          ],

          // Server-saved history
          if (config && _count > 0) ...[
            const SizedBox(height: 16),
            _progressPanel(),
          ],

          // Infographic
          const SizedBox(height: 16),
          _infographic(),

          // Foldouts
          const SizedBox(height: 12),
          _guide(),
          _foldout(
            Icons.play_circle_outline,
            tr(context, "Guided video", "လမ်းညွှန် ဗီဒီယို"),
            [
              Text(
                tr(context,
                    "Prefer to follow along? Open Wim Hof's official guided session.",
                    "လိုက်လုပ်ချင်လား? Wim Hof ရဲ့ တရားဝင် လမ်းညွှန်ဗီဒီယိုကို ဖွင့်ပါ။"),
                style:
                    TextStyle(color: GwColors.inkSoftOf(context), fontSize: 13),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => launchUrl(Uri.parse(_videoUrl),
                    mode: LaunchMode.externalApplication),
                icon: const Icon(Icons.ondemand_video),
                label: Text(tr(context, "Watch on YouTube", "YouTube တွင်ကြည့်")),
              ),
            ],
          ),
          _foldout(
            Icons.history,
            tr(context, "History & science", "သမိုင်း + သိပ္ပံ"),
            [
              _para(tr(context,
                  "The method blends cyclic power-breathing (controlled hyperventilation) with breath retention and cold exposure.",
                  "ဤနည်းသည် စက်ဝန်းအသက်ရှူ (ထိန်းချုပ်ထားသော အသက်ပြင်းရှူ) ကို အသက်အောင့်ခြင်း + အအေးခံခြင်းနှင့် ပေါင်းစပ်ထားသည်။")),
              _para(tr(context,
                  "Wim Hof — 'The Iceman' — holds records for cold endurance and popularised the technique worldwide.",
                  "Wim Hof — 'The Iceman' — အအေးခံနိုင်စွမ်း စံချိန်များ ကိုင်ထားပြီး ဤနည်းကို ကမ္ဘာတဝှမ်း ကျော်ကြားစေခဲ့သည်။")),
              _para(tr(context,
                  "Studies suggest it can briefly raise adrenaline and influence the immune response, but effects vary. It is not a treatment.",
                  "လေ့လာမှုများအရ adrenaline ကို ခဏတာ မြှင့်တင်ပြီး ကိုယ်ခံအားကို လွှမ်းမိုးနိုင်သည်ဟု ဆိုသည်၊ သို့သော် ရလဒ်များ ကွဲပြားသည်။ ကုသနည်း မဟုတ်ပါ။")),
            ],
          ),
          _foldout(
            Icons.help_outline,
            tr(context, "Help & FAQ", "အကူအညီ + FAQ"),
            [
              _faq(
                  tr(context, "Is the tingling normal?", "ကျိန်းစိမ့်တာ ပုံမှန်လား?"),
                  tr(context,
                      "Light tingling or head-rush is common from the breathing. Ease off if it's strong.",
                      "အသက်ရှူခြင်းကြောင့် အနည်းငယ် ကျိန်းစိမ့်ခြင်း/ခေါင်းမူးခြင်း သာမန်ဖြစ်တတ်သည်။ ပြင်းရင် လျှော့ပါ။")),
              _faq(
                  tr(context, "How long do I hold?", "ဘယ်လောက်ကြာ အောင့်ရမလဲ?"),
                  tr(context,
                      "Only as long as comfortable. The timer caps at ${_retentionCapSeconds ~/ 60} minutes — tap 'Breathe in' whenever you need to.",
                      "သက်တောင့်သက်သာ ဖြစ်သလောက်သာ။ အချိန်တိုင်းသည် ${_retentionCapSeconds ~/ 60} မိနစ်တွင် ရပ်သည် — လိုတဲ့အခါ 'ရှူသွင်း' ကို နှိပ်ပါ။")),
              _faq(
                  tr(context, "Can I do this every day?", "နေ့တိုင်း လုပ်လို့ရလား?"),
                  tr(context,
                      "Many people practise daily, once in the morning. Listen to your body.",
                      "အများစုသည် နေ့တိုင်း မနက်ပိုင်း တစ်ကြိမ် လုပ်ကြသည်။ ကိုယ့်ခန္ဓာကို နားထောင်ပါ။")),
            ],
          ),

          const SizedBox(height: 14),
          Text(
            tr(context,
                "For wellness only. Not medical advice, and not a substitute for professional care.",
                "ကျန်းမာရေးအတွက်သာ။ ဆေးဘက်ဆိုင်ရာ အကြံဉာဏ် မဟုတ်ပါ။"),
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _orb() {
    final holding = _phase == _Phase.holdEmpty || _phase == _Phase.holdFull;
    return SizedBox(
      width: 240,
      height: 240,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft glow
          AnimatedScale(
            scale: _orbScale,
            duration: Duration(milliseconds: _orbMs),
            curve: Curves.easeInOut,
            child: Container(
              width: 190,
              height: 190,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: GwColors.primary.withValues(alpha: 0.22),
              ),
            ),
          ),
          // Static ring
          Container(
            width: 214,
            height: 214,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                  color: GwColors.primary.withValues(alpha: 0.22), width: 1.5),
            ),
          ),
          // Core orb
          AnimatedScale(
            scale: _orbScale,
            duration: Duration(milliseconds: _orbMs),
            curve: Curves.easeInOut,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF7AC943), GwColors.primary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: GwColors.primary.withValues(alpha: 0.4),
                    blurRadius: 24,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),
          ),
          // Label
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _orbLabel,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15),
              ),
              if (holding)
                Text(
                  "${_holdSecs}s",
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 30),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _breathDots() {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 260),
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: 5,
          runSpacing: 5,
          children: List.generate(_breaths, (i) {
            final on = i < _breathNo;
            return Container(
              width: 7,
              height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: on
                    ? GwColors.primary
                    : GwColors.inkSoftOf(context).withValues(alpha: 0.3),
              ),
            );
          }),
        ),
      ),
    );
  }

  Widget _roundPips() {
    return Center(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(_rounds, (i) {
          final done = i < _round - 1 || _phase == _Phase.finished;
          final current = i == _round - 1 && _phase != _Phase.finished;
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: done
                  ? GwColors.primary
                  : current
                      ? GwColors.primary.withValues(alpha: 0.6)
                      : GwColors.inkSoftOf(context).withValues(alpha: 0.3),
            ),
          );
        }),
      ),
    );
  }

  String _statusLine() {
    switch (_phase) {
      case _Phase.breathing:
        return tr(
            context,
            "Round $_round of $_rounds · breath $_breathNo / $_breaths",
            "အဆင့် $_round / $_rounds · အသက်ရှူ $_breathNo / $_breaths");
      case _Phase.holdEmpty:
        return tr(context, "Round $_round · hold with empty lungs",
            "အဆင့် $_round · အဆုတ်ဟာ အသက်အောင့်");
      case _Phase.holdFull:
        return tr(context, "Recovery hold · ${_holdSecs}s",
            "ပြန်လည်နာလန်ထူ အောင့် · ${_holdSecs}s");
      case _Phase.idle:
      case _Phase.finished:
        return tr(
            context,
            "$_rounds rounds · $_breaths breaths · ${_paceWord()}",
            "$_rounds အဆင့် · $_breaths ရှူ · ${_paceWord()}");
    }
  }

  String _paceWord() {
    switch (_pace) {
      case _Pace.slow:
        return tr(context, "slow", "နှေး");
      case _Pace.fast:
        return tr(context, "fast", "မြန်");
      case _Pace.medium:
        return tr(context, "medium", "အလယ်အလတ်");
    }
  }

  Widget _controls(bool active) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 10,
      runSpacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (_phase == _Phase.idle)
          FilledButton.icon(
            onPressed: _start,
            style: FilledButton.styleFrom(
                backgroundColor: GwColors.primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 14)),
            icon: const Icon(Icons.play_arrow),
            label: Text(tr(context, "Start session", "စတင်ရန်")),
          ),
        if (_phase == _Phase.holdEmpty)
          FilledButton.icon(
            onPressed: _endRetention,
            style: FilledButton.styleFrom(
                backgroundColor: GwColors.primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 14)),
            icon: const Icon(Icons.waves),
            label: Text(tr(context, "Breathe in", "ရှူသွင်းမည်")),
          ),
        if (_phase == _Phase.finished)
          FilledButton.icon(
            onPressed: _start,
            style: FilledButton.styleFrom(
                backgroundColor: GwColors.primary,
                padding:
                    const EdgeInsets.symmetric(horizontal: 22, vertical: 14)),
            icon: const Icon(Icons.refresh),
            label: Text(tr(context, "Go again", "ထပ်လုပ်")),
          ),
        if (active)
          OutlinedButton.icon(
            onPressed: _stop,
            icon: const Icon(Icons.stop),
            label: Text(tr(context, "Stop", "ရပ်")),
          ),
        if (_phase == _Phase.idle || _phase == _Phase.finished) ...[
          IconButton(
            onPressed: () => setState(() => _sound = !_sound),
            tooltip: _sound
                ? tr(context, "Sound on", "အသံ ဖွင့်")
                : tr(context, "Sound off", "အသံ ပိတ်"),
            icon: Icon(_sound ? Icons.volume_up : Icons.volume_off,
                color: _sound
                    ? GwColors.primary
                    : GwColors.inkSoftOf(context)),
          ),
          IconButton(
            onPressed: () => setState(() => _voice = !_voice),
            tooltip: _voice
                ? tr(context, "Voice on", "အသံ လမ်းညွှန် ဖွင့်")
                : tr(context, "Voice off", "အသံ လမ်းညွှန် ပိတ်"),
            icon: Icon(_voice ? Icons.record_voice_over : Icons.voice_over_off,
                color: _voice
                    ? GwColors.primary
                    : GwColors.inkSoftOf(context)),
          ),
        ],
      ],
    );
  }

  Widget _settings(({int inMs, int outMs}) p) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _stepper(tr(context, "Rounds", "အဆင့်"), _rounds, 1, 6,
              (v) => setState(() => _rounds = v)),
          const SizedBox(height: 12),
          _stepper(tr(context, "Breaths per round", "တစ်အဆင့်လျှင် အသက်ရှူ"),
              _breaths, 20, 50, (v) => setState(() => _breaths = v), step: 5),
          const SizedBox(height: 14),
          Text(tr(context, "Pace", "အမြန်နှုန်း"),
              style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final x in _Pace.values) ...[
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => _pace = x),
                    child: Container(
                      margin: const EdgeInsets.only(right: 6),
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _pace == x
                            ? GwColors.primary
                            : GwColors.bgOf(context),
                        borderRadius: BorderRadius.circular(GwRadius.sm),
                        border: Border.all(color: GwColors.lineOf(context)),
                      ),
                      child: Text(
                        _paceLabel(x),
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: _pace == x
                              ? Colors.white
                              : GwColors.inkSoftOf(context),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 6),
          Text(
            tr(context,
                "${((p.inMs + p.outMs) / 1000).toStringAsFixed(1)}s per breath",
                "တစ်ချက်လျှင် ${((p.inMs + p.outMs) / 1000).toStringAsFixed(1)}s"),
            style:
                TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  String _paceLabel(_Pace x) {
    switch (x) {
      case _Pace.slow:
        return tr(context, "Slow", "နှေး");
      case _Pace.medium:
        return tr(context, "Medium", "အလယ်");
      case _Pace.fast:
        return tr(context, "Fast", "မြန်");
    }
  }

  Widget _stepper(String label, int value, int min, int max,
      ValueChanged<int> onChange,
      {int step = 1}) {
    return Row(
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(
                  fontSize: 13.5, fontWeight: FontWeight.w600)),
        ),
        _roundBtn(Icons.remove, value > min,
            () => onChange(math.max(min, value - step))),
        Container(
          width: 44,
          alignment: Alignment.center,
          child: Text("$value",
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w800)),
        ),
        _roundBtn(Icons.add, value < max,
            () => onChange(math.min(max, value + step))),
      ],
    );
  }

  Widget _roundBtn(IconData icon, bool enabled, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: enabled ? onTap : null,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: GwColors.bgOf(context),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: Icon(icon,
            size: 18,
            color: enabled
                ? GwColors.inkOf(context)
                : GwColors.inkSoftOf(context).withValues(alpha: 0.4)),
      ),
    );
  }

  Widget _summary() {
    final best = _retentions.reduce((a, b) => math.max(a, b));
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border:
            Border.all(color: GwColors.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "Retention times", "အောင့်ချိန်များ"),
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < _retentions.length; i++)
                _chip("R${i + 1}: ${_mmss(_retentions[i])}", false),
              _chip(tr(context, "Best ${_mmss(best)}", "အကောင်းဆုံး ${_mmss(best)}"),
                  true),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            tr(context,
                "Retention naturally grows as your body adapts across rounds.",
                "အဆင့်များ ဖြတ်သန်းလာသည်နှင့်အမျှ အောင့်ချိန်သည် သဘာဝအတိုင်း တိုးလာသည်။"),
            style:
                TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  Widget _chip(String text, bool accent) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: accent
            ? GwColors.primary.withValues(alpha: 0.15)
            : GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Text(text,
          style: TextStyle(
              fontSize: 13,
              fontWeight: accent ? FontWeight.w800 : FontWeight.w600,
              color: accent ? GwColors.primary : GwColors.inkOf(context))),
    );
  }

  Widget _progressPanel() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "Your practice", "သင့်လေ့ကျင့်မှု"),
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 10),
          Row(
            children: [
              _stat(tr(context, "Streak", "ဆက်တိုက်"),
                  tr(context, "$_streak d", "$_streak ရက်")),
              _stat(tr(context, "Best", "အကောင်းဆုံး"), _mmss(_best)),
              _stat(tr(context, "Sessions", "ကြိမ်"), "$_count"),
            ],
          ),
          const SizedBox(height: 12),
          _trendBars(),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 3),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: GwColors.bgOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: GwColors.primary)),
            const SizedBox(height: 2),
            Text(label.toUpperCase(),
                style: TextStyle(
                    fontSize: 9,
                    letterSpacing: 0.5,
                    color: GwColors.inkSoftOf(context))),
          ],
        ),
      ),
    );
  }

  Widget _trendBars() {
    final rows = _sessions.reversed.toList(); // oldest → newest
    return SizedBox(
      height: 56,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final s in rows) ...[
            Expanded(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 1.5),
                height: _best > 0
                    ? (((s["best_s"] as num?)?.toDouble() ?? 0) /
                            _best *
                            56)
                        .clamp(6.0, 56.0)
                    : 6.0,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.7),
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(3)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _infographic() {
    final phases = [
      (
        n: "1",
        label: tr(context, "Power breaths", "အသက်ပြင်းရှူ"),
        icon: Icons.air,
        color: GwColors.primary,
      ),
      (
        n: "2",
        label: tr(context, "Hold empty", "ဟာ အောင့်"),
        icon: Icons.stop_circle_outlined,
        color: const Color(0xFF2E7DB1),
      ),
      (
        n: "3",
        label: tr(context, "Recover", "ပြန်နာလန်ထူ"),
        icon: Icons.waves,
        color: const Color(0xFF2E9E5B),
      ),
      (
        n: "4",
        label: tr(context, "Repeat", "ထပ်လုပ်"),
        icon: Icons.refresh,
        color: const Color(0xFFCB6D1E),
      ),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "The cycle", "စက်ဝန်း"),
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 10),
          Row(
            children: [
              for (final ph in phases)
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      color: GwColors.bgOf(context),
                      borderRadius: BorderRadius.circular(GwRadius.md),
                    ),
                    child: Column(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: ph.color.withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(ph.icon, color: ph.color, size: 18),
                        ),
                        const SizedBox(height: 6),
                        Text(ph.n,
                            style: TextStyle(
                                fontSize: 10,
                                color: GwColors.inkSoftOf(context))),
                        const SizedBox(height: 2),
                        Text(ph.label,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _guide() {
    return _foldout(
      Icons.info_outline,
      tr(context, "How it works", "လုပ်ဆောင်ပုံ"),
      [
        _guideStep(
            "1",
            tr(context, "Get comfortable.", "သက်တောင့်သက်သာ ထိုင်/လှဲပါ။"),
            tr(context, "Sit or lie down somewhere safe and relax.",
                "လုံခြုံတဲ့နေရာမှာ ထိုင်/လှဲပြီး ဖြေလျှော့ပါ။")),
        _guideStep(
            "2",
            tr(context, "$_breaths power breaths.", "$_breaths ချက် အသက်ပြင်းရှူ။"),
            tr(context,
                "Breathe in fully, let go without forcing — follow the orb.",
                "အပြည့်ရှူသွင်းပြီး အတင်းမလုပ်ဘဲ လွှတ်လိုက် — orb ကို လိုက်ပါ။")),
        _guideStep(
            "3",
            tr(context, "Exhale & hold.", "အသက်ထုတ်ပြီး အောင့်။"),
            tr(context,
                "After the last breath, exhale and hold with empty lungs.",
                "နောက်ဆုံးအသက်ပြီးရင် ထုတ်ပြီး အဆုတ်ဟာ အောင့်ထားပါ။")),
        _guideStep(
            "4",
            tr(context, "$_recoverySeconds-second recovery.",
                "$_recoverySeconds စက္ကန့် ပြန်နာလန်ထူ။"),
            tr(context,
                "Take a deep breath in and hold for about $_recoverySeconds seconds.",
                "အသက်ပြင်းပြင်း ရှူသွင်းပြီး $_recoverySeconds စက္ကန့်ခန့် အောင့်ပါ။")),
        _guideStep(
            "5",
            tr(context, "Repeat.", "ထပ်လုပ်။"),
            tr(context, "Do all $_rounds rounds, then rest and enjoy the calm.",
                "အဆင့် $_rounds ခု အားလုံးလုပ်ပြီး နားပြီး တည်ငြိမ်မှုကို ခံစားပါ။")),
      ],
      defaultOpen: _phase == _Phase.idle,
    );
  }

  Widget _guideStep(String n, String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: GwColors.primary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Text(n,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: GwColors.primary)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 13.5, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(body,
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _para(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: TextStyle(
              color: GwColors.inkSoftOf(context), fontSize: 12.5, height: 1.4)),
    );
  }

  Widget _faq(String q, String a) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(a,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  fontSize: 12.5,
                  height: 1.4)),
        ],
      ),
    );
  }

  Widget _foldout(IconData icon, String title, List<Widget> children,
      {bool defaultOpen = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: GwColors.lineOf(context)),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: defaultOpen,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          leading: Icon(icon, color: GwColors.primary, size: 20),
          title: Text(title,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      ),
    );
  }

  // ---- Audio synthesis -------------------------------------------------------
  /// A breath "whoosh": low-pass-filtered white noise whose amplitude swells on
  /// the inhale and fades on the exhale. Returned as a mono 16-bit PCM WAV so
  /// audioplayers can play it without any bundled asset (CSP-safe / offline).
  Uint8List _breathWav(bool inhale, int ms) {
    const sampleRate = 22050;
    final frames = (sampleRate * ms / 1000).round();
    final samples = Int16List(frames);
    final rnd = math.Random();
    var lp = 0.0; // one-pole low-pass state
    for (var i = 0; i < frames; i++) {
      final t = i / frames; // 0 → 1
      final white = rnd.nextDouble() * 2 - 1;
      // Brighter on inhale, darker on exhale.
      final alpha = inhale ? 0.10 + 0.20 * t : 0.30 - 0.20 * t;
      lp += alpha * (white - lp);
      // Amplitude envelope: rise-then-settle (inhale) vs. fall (exhale).
      final env = inhale
          ? math.sin(math.pi * t).clamp(0.0, 1.0) * (0.4 + 0.6 * t)
          : (1 - t) * (1 - t);
      final v = (lp * env * 0.6 * 32767).clamp(-32767.0, 32767.0);
      samples[i] = v.toInt();
    }
    return _wrapWav(samples, sampleRate);
  }

  /// A soft sine "gong" that marks phase changes (hold, recovery, done).
  Uint8List _gongWav() {
    const sampleRate = 22050;
    const ms = 1400;
    final frames = (sampleRate * ms / 1000).round();
    final samples = Int16List(frames);
    for (var i = 0; i < frames; i++) {
      final t = i / sampleRate;
      final env = math.exp(-3.0 * (i / frames)); // decay
      final tone = math.sin(2 * math.pi * 396 * t) +
          0.4 * math.sin(2 * math.pi * 528 * t);
      final v = (tone * env * 0.28 * 32767).clamp(-32767.0, 32767.0);
      samples[i] = v.toInt();
    }
    return _wrapWav(samples, sampleRate);
  }

  /// Wrap 16-bit mono PCM samples in a minimal WAV (RIFF) container.
  Uint8List _wrapWav(Int16List samples, int sampleRate) {
    final dataBytes = samples.buffer.asUint8List();
    final byteRate = sampleRate * 2; // mono, 16-bit
    final buf = BytesBuilder();
    void str(String s) => buf.add(s.codeUnits);
    void u32(int v) => buf.add([
          v & 0xff,
          (v >> 8) & 0xff,
          (v >> 16) & 0xff,
          (v >> 24) & 0xff,
        ]);
    void u16(int v) => buf.add([v & 0xff, (v >> 8) & 0xff]);

    str("RIFF");
    u32(36 + dataBytes.length);
    str("WAVE");
    str("fmt ");
    u32(16); // PCM chunk size
    u16(1); // PCM
    u16(1); // mono
    u32(sampleRate);
    u32(byteRate);
    u16(2); // block align
    u16(16); // bits per sample
    str("data");
    u32(dataBytes.length);
    buf.add(dataBytes);
    return buf.toBytes();
  }
}
