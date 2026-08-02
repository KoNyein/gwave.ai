import 'dart:math' as math;
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';

/// A gradient hero header used at the top of each wellness discipline screen.
Widget wellnessHero(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String subtitle,
  List<Color> colors = const [Color(0xFF16351F), Color(0xFF0F2A16)],
}) {
  return Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        colors: colors,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(GwRadius.lg),
      boxShadow: GwShadow.card,
    ),
    child: Row(
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: Colors.white, size: 28),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              const SizedBox(height: 3),
              Text(subtitle,
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 12.5,
                      height: 1.35)),
            ],
          ),
        ),
      ],
    ),
  );
}

/// A bordered content card with a bold heading and an accent icon.
Widget wellnessSection(
  BuildContext context, {
  required IconData icon,
  required String title,
  required List<Widget> children,
  Color? accent,
}) {
  final a = accent ?? GwColors.primary;
  return Container(
    width: double.infinity,
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: GwColors.surfaceOf(context),
      borderRadius: BorderRadius.circular(GwRadius.lg),
      border: Border.all(color: GwColors.lineOf(context)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, color: a, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 15)),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...children,
      ],
    ),
  );
}

/// A collapsible section (guide / help / extra reading).
Widget wellnessFoldout(
  BuildContext context, {
  required IconData icon,
  required String title,
  required List<Widget> children,
  bool defaultOpen = false,
}) {
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
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    ),
  );
}

Widget wellnessPara(BuildContext context, String text) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text,
        style: TextStyle(
            color: GwColors.inkSoftOf(context), fontSize: 13, height: 1.45)),
  );
}

Widget wellnessBullet(BuildContext context, String text) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 6, right: 8),
          child: Container(
            width: 5,
            height: 5,
            decoration: const BoxDecoration(
                color: GwColors.primary, shape: BoxShape.circle),
          ),
        ),
        Expanded(
          child: Text(text,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  fontSize: 13,
                  height: 1.4)),
        ),
      ],
    ),
  );
}

/// A numbered step for a practice guide.
Widget wellnessStep(BuildContext context, String n, String title, String body) {
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

/// A question/answer pair for a help section.
Widget wellnessFaq(BuildContext context, String q, String a) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(q,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
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

/// An honest, disclaimered "what practitioners say" review row.
Widget wellnessReview(
  BuildContext context, {
  required String name,
  required int stars,
  required String text,
}) {
  return Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: GwColors.bgOf(context),
      borderRadius: BorderRadius.circular(GwRadius.md),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            CircleAvatar(
              radius: 13,
              backgroundColor: GwColors.primary.withValues(alpha: 0.15),
              child: Text(name.isNotEmpty ? name[0] : "?",
                  style: const TextStyle(
                      color: GwColors.primary,
                      fontWeight: FontWeight.w800,
                      fontSize: 12)),
            ),
            const SizedBox(width: 8),
            Text(name,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 12.5)),
            const Spacer(),
            Row(
              children: List.generate(
                5,
                (i) => Icon(
                  i < stars ? Icons.star : Icons.star_border,
                  size: 13,
                  color: const Color(0xFFF5A623),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(text,
            style: TextStyle(
                color: GwColors.inkSoftOf(context),
                fontSize: 12.5,
                height: 1.4)),
      ],
    ),
  );
}

/// The language switch shown in every wellness AppBar — one tap flips the whole
/// app between English and Burmese (persisted via [GwLang]).
class LangToggle extends StatelessWidget {
  const LangToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final my = tr(context, "en", "my") == "my";
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: TextButton.icon(
        onPressed: () => setAppLanguage(context, my ? "en" : "my"),
        icon: const Icon(Icons.translate, size: 18),
        label: Text(my ? "EN" : "မြန်မာ",
            style: const TextStyle(fontWeight: FontWeight.w800)),
        style: TextButton.styleFrom(foregroundColor: GwColors.primary),
      ),
    );
  }
}

/// A small, asset-free sound engine for wellness sessions: a soft singing-bowl
/// "bell" and a low breathing "whoosh", both synthesised to a WAV in memory and
/// played through audioplayers (no bundled files, works offline / CSP-safe).
class WellnessAudio {
  final AudioPlayer _player = AudioPlayer();
  bool enabled = true;

  Future<void> _play(Uint8List bytes) async {
    if (!enabled) return;
    try {
      await _player.stop();
      await _player.play(BytesSource(bytes, mimeType: "audio/wav"));
    } catch (_) {/* audio unavailable — visuals still guide the practice */}
  }

  Future<void> bell() => _play(bellWav());

  Future<void> breath(bool inhale, int ms) => _play(breathWav(inhale, ms));

  void dispose() => _player.dispose();

  /// A warm singing-bowl tone (two partials, slow decay).
  static Uint8List bellWav() {
    const sampleRate = 22050;
    const ms = 2200;
    final frames = (sampleRate * ms / 1000).round();
    final s = Int16List(frames);
    for (var i = 0; i < frames; i++) {
      final t = i / sampleRate;
      final env = math.exp(-2.2 * (i / frames));
      final tone = math.sin(2 * math.pi * 432 * t) +
          0.45 * math.sin(2 * math.pi * 648 * t) +
          0.2 * math.sin(2 * math.pi * 864 * t);
      final v = (tone * env * 0.24 * 32767).clamp(-32767.0, 32767.0);
      s[i] = v.toInt();
    }
    return _wav(s, sampleRate);
  }

  /// A breath "whoosh": filtered noise that swells on the inhale, fades on the
  /// exhale.
  static Uint8List breathWav(bool inhale, int ms) {
    const sampleRate = 22050;
    final frames = (sampleRate * ms / 1000).round();
    final s = Int16List(frames);
    final rnd = math.Random();
    var lp = 0.0;
    for (var i = 0; i < frames; i++) {
      final t = i / frames;
      final white = rnd.nextDouble() * 2 - 1;
      final alpha = inhale ? 0.10 + 0.20 * t : 0.30 - 0.20 * t;
      lp += alpha * (white - lp);
      final env = inhale
          ? math.sin(math.pi * t).clamp(0.0, 1.0) * (0.4 + 0.6 * t)
          : (1 - t) * (1 - t);
      final v = (lp * env * 0.6 * 32767).clamp(-32767.0, 32767.0);
      s[i] = v.toInt();
    }
    return _wav(s, sampleRate);
  }

  static Uint8List _wav(Int16List samples, int sampleRate) {
    final data = samples.buffer.asUint8List();
    final byteRate = sampleRate * 2;
    final b = BytesBuilder();
    void str(String x) => b.add(x.codeUnits);
    void u32(int v) =>
        b.add([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
    void u16(int v) => b.add([v & 0xff, (v >> 8) & 0xff]);
    str("RIFF");
    u32(36 + data.length);
    str("WAVE");
    str("fmt ");
    u32(16);
    u16(1);
    u16(1);
    u32(sampleRate);
    u32(byteRate);
    u16(2);
    u16(16);
    str("data");
    u32(data.length);
    b.add(data);
    return b.toBytes();
  }
}

/// Flip the app language from an event handler (where `context.watch` is
/// disallowed). Safe no-op if the provider isn't found.
void setAppLanguage(BuildContext context, String code) {
  try {
    context.read<GwLang>().setCode(code);
  } catch (_) {}
}
