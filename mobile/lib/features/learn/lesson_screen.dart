import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import 'code_playground.dart';

/// Fully native lesson reader — the app twin of `/learn/<track>/<lesson>`.
/// Fetches localized content from /api/mobile/learn/lesson and renders the
/// sections natively: rich text (bullets, callouts, inline code, bold),
/// copyable code blocks, images, a native quiz, and a completion action.
/// Only truly interactive playgrounds (code/python/sql/…) hand off to the web.
class LessonScreen extends StatefulWidget {
  const LessonScreen({
    super.key,
    required this.trackSlug,
    required this.lessonSlug,
    required this.color,
    this.completed = false,
  });

  final String trackSlug;
  final String lessonSlug;
  final Color color;
  final bool completed;

  @override
  State<LessonScreen> createState() => _LessonScreenState();
}

class _LessonScreenState extends State<LessonScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  late bool _done = widget.completed;
  bool _saving = false;

  // Quiz state: question index → chosen option, and whether results are shown.
  final Map<int, int> _answers = {};
  bool _quizChecked = false;

  Map<String, dynamic>? get _lesson =>
      _data?["lesson"] is Map<String, dynamic>
          ? _data!["lesson"] as Map<String, dynamic>
          : null;

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
      final state = context.read<AppState>();
      String lang = "en";
      try {
        lang = context.read<GwLang>().code;
      } catch (_) {}
      final data = await state.api.learnLesson(
        widget.trackSlug,
        widget.lessonSlug,
        lang: lang,
      );
      if (mounted) setState(() => _data = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markComplete({int? score}) async {
    if (_done || _saving) return;
    setState(() => _saving = true);
    try {
      await context.read<AppState>().repo.markLessonComplete(
            widget.trackSlug,
            widget.lessonSlug,
            score: score,
          );
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't save progress — $e")),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _openWeb() =>
      openWeb(context, "/learn/${widget.trackSlug}/${widget.lessonSlug}");

  Future<void> _openYouTube(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = _lesson;
    return Scaffold(
      appBar: AppBar(
        title: Text(l?["title"]?.toString() ?? "Lesson",
            maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
      body: _loading
          ? Center(
              child: CircularProgressIndicator(color: GwColors.primary))
          : _error != null || l == null
              ? ListView(children: [
                  const SizedBox(height: 100),
                  GwEmpty(
                      icon: Icons.cloud_off,
                      title: tr(context, "Couldn't load the lesson",
                          "သင်ခန်းစာ မဖွင့်နိုင်ပါ"),
                      subtitle: _error ??
                          tr(context,
                              "Server update pending — try again soon.",
                              "Server အသစ် မရောက်သေးပါ — ခဏနေ ပြန်စမ်းပါ။")),
                  Center(
                    child: TextButton(
                      onPressed: _openWeb,
                      child: Text(
                          tr(context, "Open on the web", "Web တွင် ဖွင့်ရန်")),
                    ),
                  ),
                ])
              : _content(l),
    );
  }

  Widget _content(Map<String, dynamic> l) {
    final kind = l["kind"]?.toString() ?? "reading";
    final sections = l["sections"] is List
        ? (l["sections"] as List).cast<Map<String, dynamic>>()
        : const <Map<String, dynamic>>[];
    final quiz = l["quiz"] is List
        ? (l["quiz"] as List).cast<Map<String, dynamic>>()
        : const <Map<String, dynamic>>[];
    final interactive = const {
      "code", "python", "sql", "scratch", "robot", "circuit", "game"
    }.contains(kind);
    // Starter code: HTML/CSS/JS runs natively in the in-app playground;
    // python/sql starters render as copyable blocks next to the web link.
    final codeStarter = l["code"] is Map<String, dynamic>
        ? l["code"] as Map<String, dynamic>
        : null;
    final textStarter = kind == "python"
        ? l["pythonCode"]?.toString()
        : kind == "sql"
            ? l["sqlCode"]?.toString()
            : null;
    final nativePlayground = kind == "code" && codeStarter != null;
    final position = _data?["position"];
    final total = _data?["total"];
    final next = _data?["next"] is Map<String, dynamic>
        ? _data!["next"] as Map<String, dynamic>
        : null;
    final youtubeId = l["youtubeId"]?.toString();
    final youtubeQuery = l["youtubeQuery"]?.toString();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
      children: [
        // Hero header
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                widget.color,
                Color.lerp(widget.color, Colors.black, 0.25)!,
              ],
            ),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _heroChip(_kindLabel(kind)),
                  const SizedBox(width: 6),
                  if (l["minutes"] != null) _heroChip("⏱ ${l["minutes"]} min"),
                  const SizedBox(width: 6),
                  if (position != null && total != null)
                    _heroChip("$position / $total"),
                  const Spacer(),
                  if (_done)
                    const Icon(Icons.verified, color: Colors.white, size: 20),
                ],
              ),
              const SizedBox(height: 10),
              Text(l["title"]?.toString() ?? "",
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900)),
              if ((l["summary"]?.toString() ?? "").isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(l["summary"].toString(),
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 13.5,
                        height: 1.35)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),

        if (youtubeId != null && youtubeId.isNotEmpty)
          _webChipButton(
            Icons.play_circle_outline,
            tr(context, "Watch the video", "ဗီဒီယို ကြည့်ရန်"),
            () => _openYouTube("https://www.youtube.com/watch?v=$youtubeId"),
          )
        else if (youtubeQuery != null && youtubeQuery.isNotEmpty)
          _webChipButton(
            Icons.play_circle_outline,
            tr(context, "Learn on YouTube", "YouTube တွင် လေ့လာရန်"),
            () => _openYouTube(
                "https://www.youtube.com/results?search_query=${Uri.encodeComponent(youtubeQuery)}"),
          ),

        // Sections
        for (var i = 0; i < sections.length; i++)
          _sectionCard(i + 1, sections[i]),

        // Web-dev lessons: a real playground inside the app — edit the
        // starters and Run to see the result, no browser needed.
        if (nativePlayground) ...[
          const SizedBox(height: 6),
          NativeCodePlayground(starter: codeStarter, accent: widget.color),
        ],

        // Other interactive lessons: the playground itself runs on the web.
        if (interactive && !nativePlayground) ...[
          const SizedBox(height: 6),
          if (textStarter != null && textStarter.trim().isNotEmpty) ...[
            _CodeBlock(code: textStarter),
            const SizedBox(height: 10),
          ],
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: widget.color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(GwRadius.lg),
              border: Border.all(color: widget.color.withValues(alpha: 0.35)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(context, "🧪 Hands-on practice",
                      "🧪 လက်တွေ့ လေ့ကျင့်ခန်း"),
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14.5,
                      color: widget.color),
                ),
                const SizedBox(height: 4),
                Text(
                  tr(
                      context,
                      "This lesson has an interactive playground (run code, build circuits). It opens in the browser.",
                      "ဒီသင်ခန်းစာမှာ code ရေး/စမ်းနိုင်တဲ့ playground ပါဝင်ပါတယ်။ Browser တွင် ဖွင့်ပါမည်။"),
                  style: TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoft, height: 1.4),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: widget.color,
                        foregroundColor: Colors.white),
                    onPressed: _openWeb,
                    icon: const Icon(Icons.science_outlined, size: 18),
                    label: Text(tr(context, "Open playground",
                        "Playground ဖွင့်ရန်")),
                  ),
                ),
              ],
            ),
          ),
        ],

        // Native quiz
        if (kind == "quiz" && quiz.isNotEmpty) _quizBlock(quiz),

        const SizedBox(height: 16),

        // Completion + next (native-playground code lessons complete in-app too)
        if ((!interactive || nativePlayground) && kind != "quiz")
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _done ? null : () => _markComplete(),
              icon: Icon(_done ? Icons.check_circle : Icons.check, size: 19),
              label: Text(_done
                  ? tr(context, "Completed ✓", "ပြီးပါပြီ ✓")
                  : tr(context, "Mark as complete", "ပြီးပြီဟု မှတ်မည်")),
            ),
          ),
        if (next != null) ...[
          const SizedBox(height: 10),
          InkWell(
            borderRadius: BorderRadius.circular(GwRadius.lg),
            onTap: () {
              Navigator.of(context).pushReplacement(MaterialPageRoute(
                builder: (_) => LessonScreen(
                  trackSlug: widget.trackSlug,
                  lessonSlug: next["slug"].toString(),
                  color: widget.color,
                ),
              ));
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: GwColors.surface,
                borderRadius: BorderRadius.circular(GwRadius.lg),
                boxShadow: GwShadow.card,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(tr(context, "Next lesson", "နောက်သင်ခန်းစာ"),
                            style: TextStyle(
                                color: GwColors.inkSoft, fontSize: 11.5)),
                        Text(next["title"]?.toString() ?? "",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 14.5)),
                      ],
                    ),
                  ),
                  Icon(Icons.arrow_forward, color: widget.color),
                ],
              ),
            ),
          ),
        ] else if (!_loading) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Text(
              tr(context, "🎉 You finished this track!",
                  "🎉 ဒီသင်တန်း ပြီးသွားပါပြီ!"),
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ],
    );
  }

  String _kindLabel(String kind) {
    switch (kind) {
      case "quiz":
        return "📝 Quiz";
      case "code":
        return "💻 Code";
      case "python":
        return "🐍 Python";
      case "sql":
        return "🗄️ SQL";
      case "scratch":
        return "🧩 Blocks";
      case "robot":
        return "🤖 Robot";
      case "circuit":
        return "🔌 Circuit";
      default:
        return "📖 ${tr(context, "Reading", "ဖတ်စာ")}";
    }
  }

  Widget _heroChip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: const TextStyle(
              color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }

  Widget _webChipButton(IconData icon, String label, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SizedBox(
        width: double.infinity,
        height: 44,
        child: OutlinedButton.icon(
          onPressed: onTap,
          icon: Icon(icon, size: 18),
          label: Text(label),
        ),
      ),
    );
  }

  Widget _sectionCard(int number, Map<String, dynamic> s) {
    final heading = s["heading"]?.toString() ?? "";
    final body = s["body"]?.toString() ?? "";
    final code = s["code"]?.toString();
    final image = s["image"] is Map<String, dynamic>
        ? s["image"] as Map<String, dynamic>
        : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 24,
                  height: 24,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    color: widget.color.withValues(alpha: 0.13),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text("$number",
                        style: TextStyle(
                            color: widget.color,
                            fontWeight: FontWeight.w900,
                            fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(heading,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            _RichLessonText(body: body),
            if (code != null && code.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              _CodeBlock(code: code),
            ],
            if (image != null &&
                (image["src"]?.toString() ?? "").startsWith("http")) ...[
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  image["src"].toString(),
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
              if ((image["caption"]?.toString() ?? "").isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Center(
                    child: Text(image["caption"].toString(),
                        style: TextStyle(
                            fontSize: 11.5, color: GwColors.inkSoft)),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  // ---- Quiz -----------------------------------------------------------------

  Widget _quizBlock(List<Map<String, dynamic>> quiz) {
    var correct = 0;
    for (var i = 0; i < quiz.length; i++) {
      final answer = (quiz[i]["answer"] as num?)?.toInt() ?? 0;
      if (_answers[i] == answer) correct++;
    }
    final scorePct = quiz.isEmpty ? 0 : ((correct / quiz.length) * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 4),
        for (var i = 0; i < quiz.length; i++) _quizQuestion(i, quiz[i]),
        const SizedBox(height: 8),
        if (!_quizChecked)
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: _answers.length == quiz.length
                  ? () {
                      setState(() => _quizChecked = true);
                      // Recompute after setState applies; store completion.
                      var ok = 0;
                      for (var i = 0; i < quiz.length; i++) {
                        final a = (quiz[i]["answer"] as num?)?.toInt() ?? 0;
                        if (_answers[i] == a) ok++;
                      }
                      final pct = quiz.isEmpty
                          ? 0
                          : ((ok / quiz.length) * 100).round();
                      _markComplete(score: pct);
                    }
                  : null,
              icon: const Icon(Icons.fact_check_outlined, size: 19),
              label: Text(tr(context, "Check answers", "အဖြေ စစ်မည်")),
            ),
          )
        else
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              // The "try again" panel used a hardcoded pale amber, which put
              // near-white body text on a cream fill (1.06:1) in dark mode.
              color: scorePct >= 60
                  ? GwColors.primary.withValues(alpha: 0.1)
                  : (GwColors.isDark
                      ? const Color(0xFF2E2508)
                      : const Color(0xFFFEF3C7)),
              borderRadius: BorderRadius.circular(GwRadius.lg),
            ),
            child: Text(
              scorePct >= 60
                  ? tr(context, "🎉 Score: $scorePct% — nice work!",
                      "🎉 ရမှတ် $scorePct% — အရမ်းကောင်းပါတယ်!")
                  : tr(context, "Score: $scorePct% — review and try again!",
                      "ရမှတ် $scorePct% — ပြန်လေ့လာပြီး ထပ်စမ်းကြည့်ပါ!"),
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
      ],
    );
  }

  Widget _quizQuestion(int index, Map<String, dynamic> q) {
    final options =
        q["options"] is List ? (q["options"] as List).cast<Object?>() : const [];
    final answer = (q["answer"] as num?)?.toInt() ?? 0;
    final explain = q["explain"]?.toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${index + 1}. ${q["q"] ?? ""}",
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5, height: 1.35)),
            const SizedBox(height: 8),
            for (var o = 0; o < options.length; o++)
              _quizOption(index, o, options[o]?.toString() ?? "", answer),
            if (_quizChecked && explain != null && explain.isNotEmpty) ...[
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: GwColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text("💡 $explain",
                    style: const TextStyle(fontSize: 12.5, height: 1.4)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _quizOption(int qIndex, int oIndex, String text, int answer) {
    final chosen = _answers[qIndex] == oIndex;
    Color border = GwColors.line;
    Color? fill;
    if (_quizChecked) {
      if (oIndex == answer) {
        border = GwColors.primary;
        fill = GwColors.primary.withValues(alpha: 0.08);
      } else if (chosen) {
        border = const Color(0xFFEF4444);
        fill = const Color(0xFFEF4444).withValues(alpha: 0.06);
      }
    } else if (chosen) {
      border = widget.color;
      fill = widget.color.withValues(alpha: 0.07);
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: _quizChecked
            ? null
            : () => setState(() => _answers[qIndex] = oIndex),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: border, width: chosen ? 1.6 : 1),
          ),
          child: Row(
            children: [
              Icon(
                _quizChecked
                    ? (oIndex == answer
                        ? Icons.check_circle
                        : chosen
                            ? Icons.cancel
                            : Icons.radio_button_unchecked)
                    : chosen
                        ? Icons.radio_button_checked
                        : Icons.radio_button_unchecked,
                size: 18,
                color: _quizChecked
                    ? (oIndex == answer
                        ? GwColors.primary
                        : chosen
                            ? const Color(0xFFEF4444)
                            : GwColors.inkSoft)
                    : chosen
                        ? widget.color
                        : GwColors.inkSoft,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(text,
                    style: const TextStyle(fontSize: 13.5, height: 1.35)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rich lesson body text — the native port of the web's lesson-rich-text:
/// splits the body into paragraphs, bullet/numbered lists and emoji callouts
/// (💡 ⚠️ ❗ 📌 ✅), and renders `inline code` and **bold** inside each line.
class _RichLessonText extends StatelessWidget {
  const _RichLessonText({required this.body});
  final String body;

  static const _callouts = ["💡", "⚠️", "❗", "📌", "✅"];

  @override
  Widget build(BuildContext context) {
    final lines = body.split("\n");
    final children = <Widget>[];
    final paragraph = StringBuffer();

    void flushParagraph() {
      final text = paragraph.toString().trim();
      paragraph.clear();
      if (text.isEmpty) return;
      children.add(Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: _inline(text),
      ));
    }

    for (final raw in lines) {
      final line = raw.trimRight();
      final trimmed = line.trim();
      final bullet = RegExp(r"^[-•*]\s+").firstMatch(trimmed);
      final numbered = RegExp(r"^(\d+)[.)]\s+").firstMatch(trimmed);
      final callout = _callouts.firstWhere(
        (c) => trimmed.startsWith(c),
        orElse: () => "",
      );

      if (trimmed.isEmpty) {
        flushParagraph();
      } else if (bullet != null) {
        flushParagraph();
        children.add(_listRow("•", trimmed.substring(bullet.end)));
      } else if (numbered != null) {
        flushParagraph();
        children.add(
            _listRow("${numbered.group(1)}.", trimmed.substring(numbered.end)));
      } else if (callout.isNotEmpty) {
        flushParagraph();
        children.add(Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: GwColors.surfaceMuted,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: GwColors.line),
          ),
          child: _inline(trimmed),
        ));
      } else {
        if (paragraph.isNotEmpty) paragraph.write(" ");
        paragraph.write(trimmed);
      }
    }
    flushParagraph();

    return Column(
        crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }

  Widget _listRow(String marker, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4, left: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 20,
            child: Text(marker,
                style: TextStyle(
                    color: GwColors.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5)),
          ),
          Expanded(child: _inline(text)),
        ],
      ),
    );
  }

  /// Renders `code` spans and **bold** inside a line.
  Widget _inline(String text) {
    final spans = <InlineSpan>[];
    final re = RegExp(r"`([^`]+)`|\*\*([^*]+)\*\*");
    var last = 0;
    for (final m in re.allMatches(text)) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      if (m.group(1) != null) {
        spans.add(TextSpan(
          text: " ${m.group(1)} ",
          style: TextStyle(
            fontFamily: "monospace",
            fontSize: 12.5,
            color: GwColors.primary,
            backgroundColor: GwColors.surfaceMuted,
            fontWeight: FontWeight.w700,
          ),
        ));
      } else {
        spans.add(TextSpan(
          text: m.group(2),
          style: const TextStyle(fontWeight: FontWeight.w800),
        ));
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return Text.rich(
      TextSpan(
        style: TextStyle(
            fontSize: 13.5, height: 1.5, color: GwColors.ink),
        children: spans,
      ),
    );
  }
}

/// Dark, copyable code block — the native twin of the web's CodeBlock.
class _CodeBlock extends StatefulWidget {
  const _CodeBlock({required this.code});
  final String code;

  @override
  State<_CodeBlock> createState() => _CodeBlockState();
}

class _CodeBlockState extends State<_CodeBlock> {
  bool _copied = false;

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.code));
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: double.infinity,
        color: const Color(0xFF1E293B),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              color: const Color(0xFF0F172A),
              child: Row(
                children: [
                  for (final c in const [
                    Color(0xFFEF4444),
                    Color(0xFFF59E0B),
                    Color(0xFF22C55E)
                  ])
                    Container(
                      width: 9,
                      height: 9,
                      margin: const EdgeInsets.only(right: 5),
                      decoration:
                          BoxDecoration(color: c, shape: BoxShape.circle),
                    ),
                  const Spacer(),
                  InkWell(
                    onTap: _copy,
                    child: Row(
                      children: [
                        Icon(_copied ? Icons.check : Icons.copy,
                            size: 13,
                            color: _copied
                                ? const Color(0xFF4ADE80)
                                : Colors.white60),
                        const SizedBox(width: 4),
                        Text(_copied ? "Copied" : "Copy",
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: _copied
                                    ? const Color(0xFF4ADE80)
                                    : Colors.white60)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.all(12),
              child: Text(
                widget.code,
                style: const TextStyle(
                  fontFamily: "monospace",
                  fontSize: 12,
                  height: 1.5,
                  color: Color(0xFFE2E8F0),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
