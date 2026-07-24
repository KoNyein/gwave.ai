import 'dart:math';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native language courses — the app twin of `/learn/languages`. Burmese
/// speakers learn English, Thai, Chinese, Japanese and Korean: themed units of
/// phrases with romanisation + Burmese meaning, spoken aloud by the device TTS
/// engine, plus a practice quiz per unit.
class LanguagesScreen extends StatefulWidget {
  const LanguagesScreen({super.key});

  @override
  State<LanguagesScreen> createState() => _LanguagesScreenState();
}

class _LanguagesScreenState extends State<LanguagesScreen> {
  List<Map<String, dynamic>> _courses = [];
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
      final c = await context.read<AppState>().api.learnLanguages();
      if (mounted) setState(() => _courses = c);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Languages", "ဘာသာစကားများ"))),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _courses.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _courses.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 100),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: tr(context, "Couldn't load the courses",
                            "သင်တန်းများ မဖွင့်နိုင်ပါ"),
                        subtitle: _error),
                  ])
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          gradient: GwColors.primaryGradient,
                          borderRadius: BorderRadius.circular(GwRadius.lg),
                          boxShadow: GwShadow.card,
                        ),
                        child: Row(
                          children: [
                            const Text("🌏", style: TextStyle(fontSize: 34)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                      tr(context, "Learn a language",
                                          "ဘာသာစကား လေ့လာမယ်"),
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900)),
                                  const SizedBox(height: 2),
                                  Text(
                                      tr(
                                          context,
                                          "Listen, repeat and practise — right in the app",
                                          "နားထောင်၊ လိုက်ဆို၊ လေ့ကျင့် — app ထဲမှာတင်"),
                                      style: const TextStyle(
                                          color: Colors.white70,
                                          fontSize: 12.5)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      for (final c in _courses) _courseCard(c),
                    ],
                  ),
      ),
    );
  }

  Widget _courseCard(Map<String, dynamic> c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => LangCourseScreen(
              slug: c["slug"].toString(),
              label: (c["label"] ?? "").toString(),
              flag: (c["flag"] ?? "🌏").toString(),
            ),
          ));
        },
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Center(
                  child: Text((c["flag"] ?? "🌏").toString(),
                      style: const TextStyle(fontSize: 26)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                        "${c["label"] ?? ""}"
                        "${c["nativeLabel"] != null && c["nativeLabel"] != c["label"] ? " · ${c["nativeLabel"]}" : ""}",
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    if ((c["description"] ?? "").toString().isNotEmpty)
                      Text(c["description"].toString(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              color: GwColors.inkSoftOf(context),
                              fontSize: 12,
                              height: 1.35)),
                    const SizedBox(height: 3),
                    Text(
                        "${c["unitCount"] ?? 0} ${tr(context, "units", "ခန်း")} · ${c["phraseCount"] ?? 0} ${tr(context, "phrases", "စကားစု")}",
                        style: const TextStyle(
                            color: GwColors.primary,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: GwColors.inkSoftOf(context)),
            ],
          ),
        ),
      ),
    );
  }
}

/// One language course: its themed units.
class LangCourseScreen extends StatefulWidget {
  const LangCourseScreen({
    super.key,
    required this.slug,
    required this.label,
    required this.flag,
  });
  final String slug;
  final String label;
  final String flag;

  @override
  State<LangCourseScreen> createState() => _LangCourseScreenState();
}

class _LangCourseScreenState extends State<LangCourseScreen> {
  Map<String, dynamic>? _course;
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
      final data =
          await context.read<AppState>().api.learnLanguage(widget.slug);
      if (mounted) {
        setState(() =>
            _course = data["course"] as Map<String, dynamic>?);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final units = _course?["units"] is List
        ? (_course!["units"] as List).cast<Map<String, dynamic>>()
        : const <Map<String, dynamic>>[];
    return Scaffold(
      appBar: AppBar(title: Text("${widget.flag} ${widget.label}")),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: GwColors.primary))
          : _error != null
              ? ListView(children: [
                  const SizedBox(height: 100),
                  GwEmpty(
                      icon: Icons.cloud_off,
                      title: tr(context, "Couldn't load the course",
                          "သင်တန်း မဖွင့်နိုင်ပါ"),
                      subtitle: _error),
                ])
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                  itemCount: units.length,
                  itemBuilder: (_, i) => _unitTile(i, units[i]),
                ),
    );
  }

  Widget _unitTile(int index, Map<String, dynamic> u) {
    final items =
        u["items"] is List ? (u["items"] as List).length : 0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.md),
        onTap: () {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => LangUnitScreen(
              course: _course!,
              unit: u,
            ),
          ));
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.md),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text((u["emoji"] ?? "📖").toString(),
                      style: const TextStyle(fontSize: 19)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((u["title"] ?? "").toString(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 14.5)),
                    Text(
                        "${u["subtitle"] ?? ""} · $items ${tr(context, "phrases", "စကားစု")}",
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 11.5)),
                  ],
                ),
              ),
              Text("${index + 1}",
                  style: TextStyle(
                      color: GwColors.inkSoftOf(context),
                      fontWeight: FontWeight.w700,
                      fontSize: 12)),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right,
                  color: GwColors.inkSoftOf(context), size: 20),
            ],
          ),
        ),
      ),
    );
  }
}

/// One unit: phrase cards with tap-to-listen, plus a practice quiz.
class LangUnitScreen extends StatefulWidget {
  const LangUnitScreen({super.key, required this.course, required this.unit});
  final Map<String, dynamic> course;
  final Map<String, dynamic> unit;

  @override
  State<LangUnitScreen> createState() => _LangUnitScreenState();
}

class _LangUnitScreenState extends State<LangUnitScreen> {
  // Primary voice: server audio played here (works on every phone). Device TTS
  // is only a fallback for when the network audio can't be fetched.
  final _player = AudioPlayer();
  final _tts = FlutterTts();
  bool _practice = false;

  // Playback speed the learner can pick — slow for repeating after the voice,
  // fast once they're confident. Index 1 = normal by default. Server audio uses
  // the playback rate; the device-TTS fallback uses the parallel speech rate.
  static const List<double> _playbackRates = [0.72, 1.0, 1.4];
  static const List<double> _ttsRates = [0.30, 0.48, 0.66];
  int _speedIndex = 1;
  double get _rate => _ttsRates[_speedIndex];

  // Practice quiz state.
  int _qIndex = 0;
  int? _chosen;
  int _score = 0;
  List<Map<String, dynamic>> _quizItems = [];
  List<List<String>> _quizOptions = [];

  List<Map<String, dynamic>> get _items => widget.unit["items"] is List
      ? (widget.unit["items"] as List).cast<Map<String, dynamic>>()
      : const [];

  bool _ttsWarned = false;

  @override
  void initState() {
    super.initState();
    _initTts();
  }

  Future<void> _initTts() async {
    try {
      await _tts.awaitSpeakCompletion(false);
      await _tts.setVolume(1.0);
      await _tts.setSpeechRate(_rate);
      final lang = (widget.course["bcp47"] ?? "en-US").toString();
      // Fall back to the base language ("th" for "th-TH") when the exact
      // regional voice isn't installed, so audio still plays.
      final ok = await _tts.setLanguage(lang);
      if (ok != 1 && lang.contains("-")) {
        await _tts.setLanguage(lang.split("-").first);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _tts.stop();
    _player.dispose();
    super.dispose();
  }

  /// Speak a phrase. Tries the server voice first (reliable on any device),
  /// then falls back to on-device TTS. [speedIndex] overrides the chosen speed
  /// for one playback (used by the 🐢 slow-replay buttons).
  Future<void> _speak(String text, {int? speedIndex}) async {
    if (text.trim().isEmpty) return;
    final idx = speedIndex ?? _speedIndex;
    final lang = (widget.course["bcp47"] ?? "en-US").toString();

    // 1) Server audio → plays through the media player with real speed control.
    try {
      final bytes = await context.read<AppState>().api.ttsBytes(text, lang);
      if (bytes != null && bytes.isNotEmpty) {
        await _player.stop();
        await _player.play(BytesSource(bytes, mimeType: "audio/mpeg"));
        await _player.setPlaybackRate(_playbackRates[idx]);
        return;
      }
    } catch (_) {
      // fall through to device TTS
    }

    // 2) On-device TTS fallback.
    try {
      await _tts.stop();
      await _tts.setSpeechRate(_ttsRates[idx]);
      final r = await _tts.speak(text);
      if (r != 1) _ttsHint();
    } catch (_) {
      _ttsHint();
    }
  }

  String _speedLabel(BuildContext context) => switch (_speedIndex) {
        0 => tr(context, "Slow", "နှေး"),
        2 => tr(context, "Fast", "မြန်"),
        _ => tr(context, "Normal", "ပုံမှန်"),
      };

  void _pickSpeed() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(GwRadius.lg)),
      ),
      builder: (sheetCtx) {
        Widget row(int i, String emoji, String label, String sub) {
          final selected = _speedIndex == i;
          return ListTile(
            leading: Text(emoji, style: const TextStyle(fontSize: 24)),
            title: Text(label,
                style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: selected ? GwColors.primary : GwColors.inkOf(context))),
            subtitle: Text(sub,
                style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12)),
            trailing: selected
                ? const Icon(Icons.check_circle, color: GwColors.primary)
                : null,
            onTap: () {
              setState(() => _speedIndex = i);
              _tts.setSpeechRate(_rate);
              Navigator.of(sheetCtx).pop();
            },
          );
        }

        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Text(tr(context, "Playback speed", "အသံ အမြန်နှုန်း"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              row(0, "🐢", tr(sheetCtx, "Slow", "နှေး"),
                  tr(sheetCtx, "Great for repeating each word",
                      "စကားလုံးတစ်လုံးချင်း လိုက်ဆိုရန်")),
              row(1, "🚶", tr(sheetCtx, "Normal", "ပုံမှန်"),
                  tr(sheetCtx, "Everyday speaking pace", "နေ့စဉ်ပြောသလို")),
              row(2, "🐇", tr(sheetCtx, "Fast", "မြန်"),
                  tr(sheetCtx, "Native-like speed", "မူရင်းသံ အမြန်")),
              const SizedBox(height: 6),
            ],
          ),
        );
      },
    );
  }

  /// One-time hint when neither the server voice nor an on-device voice could
  /// play — usually no internet and no TTS voice installed.
  void _ttsHint() {
    if (_ttsWarned || !mounted) return;
    _ttsWarned = true;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      duration: const Duration(seconds: 5),
      content: Text(tr(
          context,
          "Couldn't play audio — check your internet connection and try again.",
          "အသံ မဖွင့်နိုင်ပါ — အင်တာနက် ချိတ်ဆက်မှုကို စစ်ပြီး ထပ်စမ်းကြည့်ပါ။")),
    ));
  }

  void _startPractice() {
    final items = [..._items]..shuffle();
    final take = items.take(min(8, items.length)).toList();
    final rand = Random();
    final options = <List<String>>[];
    for (final item in take) {
      final correct = (item["my"] ?? "").toString();
      final wrong = _items
          .map((i) => (i["my"] ?? "").toString())
          .where((m) => m != correct)
          .toList()
        ..shuffle(rand);
      final opts = [correct, ...wrong.take(3)]..shuffle(rand);
      options.add(opts);
    }
    setState(() {
      _practice = true;
      _quizItems = take;
      _quizOptions = options;
      _qIndex = 0;
      _chosen = null;
      _score = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
            "${widget.unit["emoji"] ?? ""} ${widget.unit["title"] ?? ""}"),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: _pickSpeed,
              icon: const Icon(Icons.speed, size: 20, color: GwColors.primary),
              label: Text(_speedLabel(context),
                  style: const TextStyle(
                      color: GwColors.primary, fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
      body: _practice ? _practiceView() : _listView(),
      bottomNavigationBar: _practice
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _items.length >= 4 ? _startPractice : null,
                    icon: const Icon(Icons.psychology_outlined, size: 19),
                    label: Text(
                        tr(context, "Practice quiz", "လေ့ကျင့်ခန်း ဖြေမယ်")),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _listView() {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      itemCount: _items.length,
      itemBuilder: (_, i) {
        final p = _items[i];
        final target = (p["target"] ?? "").toString();
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: InkWell(
            borderRadius: BorderRadius.circular(GwRadius.md),
            onTap: () => _speak(target),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GwColors.surfaceOf(context),
                borderRadius: BorderRadius.circular(GwRadius.md),
                boxShadow: GwShadow.card,
              ),
              child: Row(
                children: [
                  Text((p["emoji"] ?? "💬").toString(),
                      style: const TextStyle(fontSize: 24)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(target,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 16)),
                        if ((p["roman"] ?? "").toString().isNotEmpty)
                          Text((p["roman"] ?? "").toString(),
                              style: const TextStyle(
                                  color: GwColors.primary,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600)),
                        Text((p["my"] ?? "").toString(),
                            style: TextStyle(
                                color: GwColors.inkSoftOf(context), fontSize: 13)),
                      ],
                    ),
                  ),
                  // Slow replay — always speaks at the slow rate, handy for
                  // catching a tricky word no matter the global speed.
                  InkWell(
                    onTap: () => _speak(target, speedIndex: 0),
                    borderRadius: BorderRadius.circular(19),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: GwColors.surfaceMutedOf(context),
                        shape: BoxShape.circle,
                        border: Border.all(color: GwColors.lineOf(context), width: 1.2),
                      ),
                      child: const Center(
                          child: Text("🐢", style: TextStyle(fontSize: 18))),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: GwColors.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.volume_up,
                        color: GwColors.primary, size: 20),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _practiceView() {
    if (_qIndex >= _quizItems.length) {
      final pct = ((_score / _quizItems.length) * 100).round();
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(pct >= 60 ? "🎉" : "💪", style: const TextStyle(fontSize: 52)),
              const SizedBox(height: 10),
              Text(
                "${tr(context, "Score", "ရမှတ်")}: $_score / ${_quizItems.length}",
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _startPractice,
                  child: Text(tr(context, "Try again", "ထပ်ဖြေမယ်")),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => setState(() => _practice = false),
                child:
                    Text(tr(context, "Back to phrases", "စကားစုများသို့ ပြန်သွားမည်")),
              ),
            ],
          ),
        ),
      );
    }

    final item = _quizItems[_qIndex];
    final target = (item["target"] ?? "").toString();
    final correct = (item["my"] ?? "").toString();
    final options = _quizOptions[_qIndex];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
      children: [
        Text(
          "${_qIndex + 1} / ${_quizItems.length}",
          textAlign: TextAlign.center,
          style: TextStyle(
              color: GwColors.inkSoftOf(context), fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            children: [
              Text((item["emoji"] ?? "💬").toString(),
                  style: const TextStyle(fontSize: 34)),
              const SizedBox(height: 6),
              Text(target,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    onPressed: () => _speak(target, speedIndex: 0),
                    icon: const Text("🐢", style: TextStyle(fontSize: 22)),
                    tooltip: tr(context, "Slow", "နှေး"),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: () => _speak(target),
                    icon: const Icon(Icons.volume_up,
                        color: GwColors.primary, size: 28),
                  ),
                ],
              ),
              Text(
                tr(context, "What does this mean?", "အဓိပ္ပာယ် ဘာလဲ?"),
                style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        for (var o = 0; o < options.length; o++) _option(o, options[o], correct),
        if (_chosen != null) ...[
          const SizedBox(height: 12),
          SizedBox(
            height: 48,
            child: ElevatedButton(
              onPressed: () {
                setState(() {
                  _qIndex += 1;
                  _chosen = null;
                });
              },
              child: Text(_qIndex + 1 >= _quizItems.length
                  ? tr(context, "See score", "ရမှတ် ကြည့်မယ်")
                  : tr(context, "Next", "ရှေ့ဆက်")),
            ),
          ),
        ],
      ],
    );
  }

  Widget _option(int index, String text, String correct) {
    final chosen = _chosen == index;
    final isCorrect = text == correct;
    Color border = GwColors.lineOf(context);
    Color? fill;
    if (_chosen != null) {
      if (isCorrect) {
        border = GwColors.primary;
        fill = GwColors.primary.withValues(alpha: 0.09);
      } else if (chosen) {
        border = const Color(0xFFEF4444);
        fill = const Color(0xFFEF4444).withValues(alpha: 0.07);
      }
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: _chosen != null
            ? null
            : () {
                setState(() {
                  _chosen = index;
                  if (isCorrect) _score += 1;
                });
              },
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            color: fill ?? GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: border, width: 1.4),
            boxShadow: GwShadow.card,
          ),
          child: Text(text,
              style:
                  const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600)),
        ),
      ),
    );
  }
}
