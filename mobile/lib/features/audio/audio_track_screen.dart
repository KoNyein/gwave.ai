import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'audio_api.dart';
import 'audio_models.dart';

/// Native "now playing" screen: full-bleed cover, transport controls, a
/// scrubbable progress bar, ±15s, playback speed, chapters (audiobooks),
/// karaoke lyrics (music), rating, and G-Pay purchase for premium tracks.
/// Position auto-saves to `audio_progress` so playback resumes on any device.
class AudioTrackScreen extends StatefulWidget {
  const AudioTrackScreen({super.key, required this.track});
  final AudioTrack track;

  @override
  State<AudioTrackScreen> createState() => _AudioTrackScreenState();
}

class _AudioTrackScreenState extends State<AudioTrackScreen> {
  final _player = AudioPlayer();
  late final AudioApi _api = AudioApi(context.read<AppState>().api);

  final _speeds = const [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
  int _speedIdx = 0;

  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;
  bool _playing = false;
  bool _dragging = false;
  double _dragValue = 0;

  bool _loading = true;
  bool _entitled = false;
  bool _buying = false;
  int? _myRating;

  List<AudioChapter> _chapters = [];
  AudioLyrics? _lyrics;

  Timer? _saveTimer;
  int _lastSavedS = -1;

  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<void>? _completeSub;
  StreamSubscription<PlayerState>? _stateSub;

  AudioTrack get track => widget.track;

  @override
  void initState() {
    super.initState();
    _wirePlayer();
    _init();
  }

  void _wirePlayer() {
    _posSub = _player.onPositionChanged.listen((d) {
      if (mounted && !_dragging) setState(() => _pos = d);
      _maybeSave(d);
    });
    _durSub = _player.onDurationChanged.listen((d) {
      if (mounted && d > Duration.zero) setState(() => _dur = d);
    });
    _stateSub = _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _playing = s == PlayerState.playing);
    });
    _completeSub = _player.onPlayerComplete.listen((_) {
      _saveProgress(completed: true);
      if (mounted) setState(() => _playing = false);
    });
  }

  Future<void> _init() async {
    try {
      final results = await Future.wait([
        _api.isEntitled(track.id),
        _api.resume(track.id),
        _api.myRating(track.id),
        track.kind == AudioKind.audiobook
            ? _api.chapters(track.id)
            : Future.value(<AudioChapter>[]),
        track.kind == AudioKind.music
            ? _api.lyrics(track.id)
            : Future.value(null),
      ]);
      if (!mounted) return;
      final entitled = results[0] as bool;
      final resume = results[1] as AudioResume?;
      setState(() {
        _entitled = entitled;
        _myRating = results[2] as int?;
        _chapters = results[3] as List<AudioChapter>;
        _lyrics = results[4] as AudioLyrics?;
        if (resume?.speed != null) {
          final idx = _speeds.indexOf(resume!.speed!);
          if (idx >= 0) _speedIdx = idx;
        }
        _loading = false;
      });
      // Preload so the seek bar has a duration, and jump to the saved point.
      if (entitled && track.audioUrl != null) {
        await _prepare(seekTo: resume?.positionS ?? 0);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _prepare({int seekTo = 0}) async {
    final url = resolveMedia(track.audioUrl, bucket: "media");
    if (url == null) return;
    try {
      await _player.setSourceUrl(url);
      await _player.setPlaybackRate(_speeds[_speedIdx]);
      if (seekTo > 0) {
        await _player.seek(Duration(seconds: seekTo));
        if (mounted) setState(() => _pos = Duration(seconds: seekTo));
      }
    } catch (_) {
      // Source may load lazily on first play instead.
    }
  }

  void _maybeSave(Duration d) {
    // Throttle to once every ~10s of playback.
    final s = d.inSeconds;
    if (s > 0 && (s - _lastSavedS).abs() >= 10) {
      _lastSavedS = s;
      _saveProgress();
    }
  }

  Future<void> _saveProgress({bool completed = false}) async {
    if (!_entitled) return;
    await _api.saveProgress(
      track.id,
      positionS: _pos.inSeconds,
      durationS: _dur.inSeconds > 0 ? _dur.inSeconds : track.durationS,
      chapterIdx: _currentChapterIdx(),
      speed: _speeds[_speedIdx],
      completed: completed || (_dur > Duration.zero && _pos >= _dur - const Duration(seconds: 2)),
    );
  }

  int? _currentChapterIdx() {
    if (_chapters.isEmpty) return null;
    int idx = _chapters.first.idx;
    for (final c in _chapters) {
      if (_pos.inSeconds >= c.startS) idx = c.idx;
    }
    return idx;
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    _posSub?.cancel();
    _durSub?.cancel();
    _completeSub?.cancel();
    _stateSub?.cancel();
    // Best-effort final save before we tear the player down.
    if (_entitled && _pos > Duration.zero) {
      _api.saveProgress(
        track.id,
        positionS: _pos.inSeconds,
        durationS: _dur.inSeconds > 0 ? _dur.inSeconds : track.durationS,
        speed: _speeds[_speedIdx],
      );
    }
    _player.dispose();
    super.dispose();
  }

  Future<void> _togglePlay() async {
    final url = resolveMedia(track.audioUrl, bucket: "media");
    if (url == null) {
      _snack(tr(context, "This track has no audio yet.",
          "ဒီသီချင်းမှာ အသံ မရှိသေးပါ။"));
      return;
    }
    try {
      if (_playing) {
        await _player.pause();
        _saveProgress();
      } else {
        // If we've never started, play from the (possibly preloaded) source.
        if (_pos == Duration.zero && _dur == Duration.zero) {
          await _player.play(UrlSource(url));
          await _player.setPlaybackRate(_speeds[_speedIdx]);
        } else {
          await _player.resume();
        }
      }
    } catch (e) {
      _snack(tr(context, "Playback failed — $e", "ဖွင့်၍မရပါ — $e"));
    }
  }

  Future<void> _skip(int seconds) async {
    final target = _pos + Duration(seconds: seconds);
    final clamped = target < Duration.zero
        ? Duration.zero
        : (_dur > Duration.zero && target > _dur ? _dur : target);
    await _player.seek(clamped);
    if (mounted) setState(() => _pos = clamped);
  }

  Future<void> _cycleSpeed() async {
    setState(() => _speedIdx = (_speedIdx + 1) % _speeds.length);
    await _player.setPlaybackRate(_speeds[_speedIdx]);
  }

  Future<void> _seekTo(int seconds) async {
    await _player.seek(Duration(seconds: seconds));
    if (mounted) setState(() => _pos = Duration(seconds: seconds));
    if (!_playing) await _player.resume();
  }

  Future<void> _buy() async {
    setState(() => _buying = true);
    try {
      await _api.buyTrack(track.id);
      if (!mounted) return;
      setState(() {
        _entitled = true;
        _buying = false;
      });
      _snack(tr(context, "Purchased — enjoy 🎧", "ဝယ်ယူပြီးပါပြီ — နားဆင်ပါ 🎧"));
      await _prepare();
    } catch (e) {
      if (mounted) {
        setState(() => _buying = false);
        _snack(_msg(e));
      }
    }
  }

  Future<void> _rate(int stars) async {
    setState(() => _myRating = stars);
    try {
      await _api.rate(track.id, stars);
      _snack(tr(context, "Thanks for rating!", "အဆင့်သတ်မှတ်ပေးလို့ ကျေးဇူးပါ!"));
    } catch (e) {
      _snack(_msg(e));
    }
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final cover = resolveMedia(track.coverUrl, bucket: "media");
    return Scaffold(
      backgroundColor: GwColors.bg,
      appBar: AppBar(
        title: Text(audioKindLabel(context, track.kind)),
        actions: [
          IconButton(
            icon: const Icon(Icons.ios_share),
            tooltip: tr(context, "Share", "မျှဝေ"),
            onPressed: () => Share.share(
                "${track.title} · ${AppConfig.apiBase}/audio/${track.id}"),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: GwColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                _artwork(cover),
                const SizedBox(height: 18),
                Text(track.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text(_byline(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: GwColors.inkSoft, fontSize: 14.5)),
                const SizedBox(height: 12),
                _metaChips(),
                const SizedBox(height: 18),
                if (_entitled) ...[
                  _progressBar(),
                  const SizedBox(height: 8),
                  _transport(),
                ] else
                  _buyPanel(),
                if (_chapters.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  _chapterList(),
                ],
                if (_lyrics != null) ...[
                  const SizedBox(height: 22),
                  _lyricsView(),
                ],
                if (track.description != null &&
                    track.description!.isNotEmpty) ...[
                  const SizedBox(height: 22),
                  _section(tr(context, "About", "အကြောင်း")),
                  const SizedBox(height: 6),
                  Text(track.description!,
                      style: const TextStyle(
                          height: 1.45, color: GwColors.ink, fontSize: 14.5)),
                ],
                const SizedBox(height: 24),
                _ratingRow(),
              ],
            ),
    );
  }

  Widget _artwork(String? url) {
    return Center(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          width: 240,
          height: 240,
          child: (url != null)
              ? CachedNetworkImage(
                  imageUrl: url,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => _artPh(),
                  errorWidget: (_, __, ___) => _artPh(),
                )
              : _artPh(),
        ),
      ),
    );
  }

  Widget _artPh() => DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [GwColors.primaryBright, GwColors.primary],
          ),
        ),
        child: Center(
          child: Icon(audioKindIcon(track.kind),
              size: 72, color: Colors.white.withValues(alpha: 0.9)),
        ),
      );

  String _byline() {
    switch (track.kind) {
      case AudioKind.music:
        return track.artist ?? tr(context, "Unknown artist", "အနုပညာရှင် မသိ");
      case AudioKind.audiobook:
        final by = track.author ?? "";
        final nar = track.narrator;
        return nar != null && nar.isNotEmpty
            ? tr(context, "$by · Narrated by $nar", "$by · အသံဖတ် $nar")
            : by;
      case AudioKind.podcast:
        return track.episodeNo != null
            ? tr(context, "Episode ${track.episodeNo}", "အပိုင်း ${track.episodeNo}")
            : tr(context, "Podcast", "ပို့တ်ကာစ်");
    }
  }

  Widget _metaChips() {
    final chips = <Widget>[];
    void add(String? label, IconData icon, Color color) {
      if (label == null || label.isEmpty) return;
      chips.add(Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w700, fontSize: 12)),
        ]),
      ));
    }

    if (track.kind == AudioKind.music) {
      add(track.genre, Icons.category_outlined, const Color(0xFF2E7DB1));
      add(track.musicKey, Icons.piano, const Color(0xFF7A4DD6));
      if (track.bpm != null) {
        add("${track.bpm} BPM", Icons.speed, const Color(0xFFE07A00));
      }
      add(track.timeSig, Icons.straighten, GwColors.inkSoft);
      add(track.mood, Icons.auto_awesome, const Color(0xFF2E9E5B));
      if (track.releaseYear != null) {
        add("${track.releaseYear}", Icons.event, GwColors.inkSoft);
      }
    }
    if (track.durationS != null && track.durationS! > 0) {
      add(fmtClock(track.durationS!), Icons.schedule, GwColors.inkSoft);
    }
    if (chips.isEmpty) return const SizedBox.shrink();
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: chips,
    );
  }

  Widget _progressBar() {
    final durS = _dur.inSeconds > 0
        ? _dur.inSeconds
        : (track.durationS ?? 0);
    final posS = _pos.inSeconds.clamp(0, durS == 0 ? 1 : durS);
    return Column(
      children: [
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 3,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
            activeTrackColor: GwColors.primary,
            inactiveTrackColor: GwColors.line,
            thumbColor: GwColors.primary,
          ),
          child: Slider(
            min: 0,
            max: (durS == 0 ? 1 : durS).toDouble(),
            value: (_dragging ? _dragValue : posS.toDouble())
                .clamp(0.0, (durS == 0 ? 1 : durS).toDouble())
                .toDouble(),
            onChanged: durS == 0
                ? null
                : (v) => setState(() {
                      _dragging = true;
                      _dragValue = v;
                    }),
            onChangeEnd: durS == 0
                ? null
                : (v) {
                    setState(() => _dragging = false);
                    _seekTo(v.round());
                  },
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(fmtClock(_dragging ? _dragValue.round() : posS),
                  style: const TextStyle(
                      color: GwColors.inkSoft, fontSize: 12)),
              Text(fmtClock(durS),
                  style: const TextStyle(
                      color: GwColors.inkSoft, fontSize: 12)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _transport() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        TextButton(
          onPressed: _cycleSpeed,
          child: Text("${_speeds[_speedIdx]}×",
              style: const TextStyle(
                  fontWeight: FontWeight.w800, color: GwColors.ink)),
        ),
        IconButton(
          iconSize: 34,
          icon: const Icon(Icons.replay_10),
          color: GwColors.ink,
          onPressed: () => _skip(-10),
        ),
        GestureDetector(
          onTap: _togglePlay,
          child: Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              color: GwColors.primary,
              shape: BoxShape.circle,
            ),
            child: Icon(_playing ? Icons.pause : Icons.play_arrow,
                color: Colors.white, size: 40),
          ),
        ),
        IconButton(
          iconSize: 34,
          icon: const Icon(Icons.forward_30),
          color: GwColors.ink,
          onPressed: () => _skip(30),
        ),
        IconButton(
          iconSize: 26,
          icon: const Icon(Icons.bedtime_outlined),
          color: GwColors.inkSoft,
          tooltip: tr(context, "Sleep timer", "အိပ်ချိန် တိုင်မာ"),
          onPressed: _sleepTimer,
        ),
      ],
    );
  }

  Future<void> _sleepTimer() async {
    final mins = await showModalBottomSheet<int>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(tr(context, "Stop playing after…", "ဒီအချိန်ကြာရင် ရပ်ရန်…"),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
            for (final m in [10, 15, 30, 45, 60])
              ListTile(
                title: Text(tr(context, "$m minutes", "$m မိနစ်")),
                onTap: () => Navigator.pop(context, m),
              ),
            ListTile(
              title: Text(tr(context, "Off", "ပိတ်")),
              onTap: () => Navigator.pop(context, 0),
            ),
          ],
        ),
      ),
    );
    if (mins == null) return;
    _saveTimer?.cancel();
    if (mins > 0) {
      _saveTimer = Timer(Duration(minutes: mins), () async {
        await _player.pause();
        _saveProgress();
      });
      _snack(tr(context, "Sleeping in $mins min", "$mins မိနစ်အကြာ ရပ်ပါမည်"));
    }
  }

  Widget _buyPanel() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        children: [
          const Icon(Icons.lock_outline, color: GwColors.gold, size: 30),
          const SizedBox(height: 10),
          Text(
            tr(context, "Premium track", "ပရီမီယံ သီချင်း"),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
          const SizedBox(height: 4),
          Text(
            tr(context, "Buy once with your Gwave wallet to play anytime.",
                "Gwave wallet နဲ့ တစ်ကြိမ်ဝယ်ပြီး အချိန်မရွေး နားဆင်ပါ။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: (_buying || !track.isPurchasable) ? null : _buy,
              icon: _buying
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: Colors.white))
                  : const Icon(Icons.account_balance_wallet_outlined),
              label: Text(track.isPurchasable
                  ? tr(context, "Buy for ${money((track.price ?? 0).toDouble(), track.currency ?? 'USD')}",
                      "${money((track.price ?? 0).toDouble(), track.currency ?? 'USD')} ဖြင့် ဝယ်ရန်")
                  : tr(context, "Not for sale", "ရောင်းရန်မဟုတ်")),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chapterList() {
    final currentIdx = _currentChapterIdx();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _section(tr(context, "Chapters", "အခန်းများ")),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            children: [
              for (final c in _chapters)
                ListTile(
                  dense: true,
                  leading: Icon(
                    c.idx == currentIdx
                        ? Icons.play_circle
                        : Icons.play_circle_outline,
                    color: c.idx == currentIdx
                        ? GwColors.primary
                        : GwColors.inkSoft,
                  ),
                  title: Text(c.title,
                      style: TextStyle(
                          fontWeight: c.idx == currentIdx
                              ? FontWeight.w800
                              : FontWeight.w600,
                          fontSize: 14)),
                  trailing: Text(fmtClock(c.startS),
                      style: const TextStyle(
                          color: GwColors.inkSoft, fontSize: 12)),
                  onTap: _entitled ? () => _seekTo(c.startS) : null,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _lyricsView() {
    final lines = _activeLyricLines();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _section(tr(context, "Lyrics", "သီချင်းစာသား")),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final l in lines)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Text(
                    l.text,
                    style: TextStyle(
                      height: 1.5,
                      fontSize: l.active ? 16 : 14.5,
                      fontWeight:
                          l.active ? FontWeight.w800 : FontWeight.w500,
                      color: l.active ? GwColors.primary : GwColors.ink,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// Parse the lyrics into display lines. When the document is LRC ([mm:ss.xx]),
  /// strip the timestamps and mark the line matching the current position as
  /// active (a lightweight karaoke highlight).
  List<_LyricLine> _activeLyricLines() {
    final raw = _lyrics!.text;
    if (!_lyrics!.synced) {
      return raw
          .split("\n")
          .map((s) => _LyricLine(s, false))
          .toList();
    }
    final tsRe = RegExp(r'\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]');
    final parsed = <({int t, String text})>[];
    for (final line in raw.split("\n")) {
      final matches = tsRe.allMatches(line).toList();
      if (matches.isEmpty) {
        if (line.trim().isNotEmpty) parsed.add((t: -1, text: line.trim()));
        continue;
      }
      final text = line.replaceAll(tsRe, "").trim();
      for (final m in matches) {
        final mm = int.parse(m.group(1)!);
        final ss = int.parse(m.group(2)!);
        parsed.add((t: mm * 60 + ss, text: text));
      }
    }
    parsed.sort((a, b) => a.t.compareTo(b.t));
    final now = _pos.inSeconds;
    int activeAt = -1;
    for (int i = 0; i < parsed.length; i++) {
      if (parsed[i].t >= 0 && parsed[i].t <= now) activeAt = i;
    }
    return [
      for (int i = 0; i < parsed.length; i++)
        _LyricLine(parsed[i].text, i == activeAt),
    ];
  }

  Widget _ratingRow() {
    return Column(
      children: [
        Text(tr(context, "Rate this", "အဆင့်သတ်မှတ်ပါ"),
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: GwColors.inkSoft)),
        const SizedBox(height: 6),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (int i = 1; i <= 5; i++)
              IconButton(
                iconSize: 30,
                icon: Icon(
                  (_myRating ?? 0) >= i ? Icons.star : Icons.star_border,
                  color: GwColors.gold,
                ),
                onPressed: () => _rate(i),
              ),
          ],
        ),
      ],
    );
  }

  Widget _section(String title) => Text(title,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900));
}

class _LyricLine {
  _LyricLine(this.text, this.active);
  final String text;
  final bool active;
}

String _msg(Object e) {
  final s = e.toString();
  return s.startsWith("Exception: ") ? s.substring(11) : s;
}
