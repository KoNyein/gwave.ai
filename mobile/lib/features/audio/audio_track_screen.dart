import 'dart:async';
import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
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
import 'audio_service.dart';

/// Native "now playing" screen: full-bleed cover, transport controls, a
/// scrubbable progress bar, ±10/30s, playback speed, queue with next/prev +
/// shuffle + repeat (one/all), offline downloads, sleep timer, chapters
/// (audiobooks), karaoke lyrics (music), rating, and G-Pay purchase for
/// premium tracks. Position auto-saves to `audio_progress` so playback
/// resumes on any device.
class AudioTrackScreen extends StatefulWidget {
  const AudioTrackScreen({
    super.key,
    required this.track,
    this.queue,
    this.startIndex,
  });
  final AudioTrack track;

  /// The browse list this track came from — powers next/prev/shuffle/repeat
  /// and auto-advance when a track ends. Falls back to a one-track queue.
  final List<AudioTrack>? queue;
  final int? startIndex;

  @override
  State<AudioTrackScreen> createState() => _AudioTrackScreenState();
}

class _AudioTrackScreenState extends State<AudioTrackScreen> {
  /// The player is [GwAudio], not this screen. Everything here reads from it
  /// and calls into it; nothing here starts, stops or disposes a player. That
  /// is what lets you walk out of this screen with the song still playing.
  final _audio = GwAudio.instance;
  late final AudioApi _api = AudioApi(context.read<AppState>().api);

  // Display-only state — the bits that belong to *looking at* a track rather
  // than to playing one.
  bool _dragging = false;
  double _dragValue = 0;
  bool _loading = true;
  bool _buying = false;
  int? _myRating;
  List<AudioChapter> _chapters = [];
  AudioLyrics? _lyrics;
  bool _downloading = false;

  /// Which track's metadata is on screen, so an auto-advance or a tap in the
  /// queue reloads chapters, lyrics and rating for the new one.
  String? _metaFor;

  // Everything below is the player's state, read live.
  AudioTrack get track => _audio.current ?? widget.track;
  Duration get _pos => _audio.position;
  Duration get _dur => _audio.duration;
  bool get _playing => _audio.playing;
  bool get _entitled => _audio.entitled;
  List<AudioTrack> get _queue => _audio.queue;
  int get _qIdx => _audio.index;
  bool get _shuffle => _audio.shuffle;
  int get _repeat => _audio.repeat;
  File? get _localFile => _audio.localFile;
  List<double> get _speeds => GwAudio.speeds;
  int get _speedIdx => _audio.speedIndex;

  @override
  void initState() {
    super.initState();
    _audio.attach(_api);
    _audio.addListener(_onAudio);
    _audio.setChapterIndexResolver(_currentChapterIdx);
    _start();
  }

  void _onAudio() {
    if (!mounted) return;
    setState(() {});
    final id = _audio.current?.id;
    if (id != null && id != _metaFor) _loadMeta();
  }

  /// Hand our queue to the shared player.
  ///
  /// `autoplay: false` on purpose: opening a track preloads it and moves to
  /// the saved position, and the user presses play. If this track is already
  /// the one playing, [GwAudio.playQueue] leaves it alone rather than
  /// restarting it from the top.
  Future<void> _start() async {
    await _audio.playQueue(
      widget.queue ?? [widget.track],
      widget.startIndex ?? 0,
      autoplay: false,
    );
    await _loadMeta();
  }

  /// Chapters, lyrics and my rating — none of which the player needs, all of
  /// which this screen shows.
  Future<void> _loadMeta() async {
    final t = track;
    _metaFor = t.id;
    if (t.isLocalFile) {
      if (mounted) {
        setState(() {
          _chapters = [];
          _lyrics = null;
          _myRating = null;
          _loading = false;
        });
      }
      return;
    }
    if (mounted) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.myRating(t.id),
        t.kind == AudioKind.audiobook
            ? _api.chapters(t.id)
            : Future.value(<AudioChapter>[]),
        t.kind == AudioKind.music ? _api.lyrics(t.id) : Future.value(null),
      ]);
      if (!mounted) return;
      setState(() {
        _myRating = results[0] as int?;
        _chapters = results[1] as List<AudioChapter>;
        _lyrics = results[2] as AudioLyrics?;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _audio.removeListener(_onAudio);
    _audio.setChapterIndexResolver(null);
    // Save the position and walk away. Closing the player is not stopping the
    // music — that is what the ✕ on the mini player is for.
    unawaited(_audio.saveNow());
    super.dispose();
  }

  // ── Transport (all of it delegated) ───────────────────────────────────────

  Future<void> _togglePlay() async {
    if (track.localPath == null &&
        _localFile == null &&
        resolveMedia(track.audioUrl, bucket: "media") == null) {
      _snack(tr(context, "This track has no audio yet.",
          "ဒီသီချင်းမှာ အသံ မရှိသေးပါ။"));
      return;
    }
    try {
      await _audio.toggle();
    } catch (e) {
      _snack(tr(context, "Playback failed — $e", "ဖွင့်၍မရပါ — $e"));
    }
  }

  Future<void> _skip(int seconds) => _audio.skip(seconds);

  Future<void> _cycleSpeed() => _audio.cycleSpeed();

  Future<void> _seekTo(int seconds) async {
    await _audio.seekTo(seconds);
    if (!_playing) await _audio.play();
  }

  // ── Offline downloads ─────────────────────────────────────────────────────

  Future<void> _download() async {
    final ref = track.audioUrl;
    final url = resolveMedia(ref, bucket: "media");
    if (ref == null || url == null || _downloading) return;
    setState(() => _downloading = true);
    try {
      final res =
          await http.get(Uri.parse(url)).timeout(const Duration(minutes: 3));
      if (res.statusCode >= 400) throw Exception("HTTP ${res.statusCode}");
      final dir = await GwAudio.downloadsDir();
      final f = File("${dir.path}/${track.id}.${GwAudio.extOf(ref)}");
      await f.writeAsBytes(res.bodyBytes);
      _audio.setLocalFile(f);
      if (mounted) {
        _snack(tr(context, "Downloaded — plays offline now 📥",
            "ဒေါင်းလုဒ်ပြီးပါပြီ — အော့ဖ်လိုင်း နားဆင်နိုင်ပါပြီ 📥"));
      }
    } catch (e) {
      _snack(tr(context, "Download failed — $e", "ဒေါင်းလုဒ် မအောင်မြင်ပါ — $e"));
    } finally {
      if (mounted) setState(() => _downloading = false);
    }
  }

  Future<void> _removeDownload() async {
    try {
      await _localFile?.delete();
    } catch (_) {}
    _audio.setLocalFile(null);
  }

  /// Which chapter the playhead is in — drives the ▶ marker in the list.
  int? _currentChapterIdx() {
    if (_chapters.isEmpty) return null;
    int idx = _chapters.first.idx;
    for (final c in _chapters) {
      if (_pos.inSeconds >= c.startS) idx = c.idx;
    }
    return idx;
  }

  Future<void> _buy() async {
    setState(() => _buying = true);
    try {
      await _api.buyTrack(track.id);
      if (!mounted) return;
      setState(() => _buying = false);
      _snack(tr(context, "Purchased — enjoy 🎧", "ဝယ်ယူပြီးပါပြီ — နားဆင်ပါ 🎧"));
      await _audio.grantEntitlement();
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
          // Offline download (free/owned tracks only).
          if (_entitled && track.audioUrl != null)
            IconButton(
              tooltip: _localFile != null
                  ? tr(context, "Remove download", "ဒေါင်းလုဒ် ဖျက်ရန်")
                  : tr(context, "Download for offline", "အော့ဖ်လိုင်း ဒေါင်းရန်"),
              icon: _downloading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2))
                  : Icon(_localFile != null
                      ? Icons.download_done
                      : Icons.download_outlined),
              onPressed: _downloading
                  ? null
                  : (_localFile != null ? _removeDownload : _download),
            ),
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
    final hasQueue = _queue.length > 1;
    return Column(
      children: [
        Row(
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
        ),
        // Queue row: shuffle · prev · next · repeat (off → all → one).
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            IconButton(
              iconSize: 24,
              icon: const Icon(Icons.shuffle),
              color: _shuffle ? GwColors.primary : GwColors.inkSoft,
              tooltip: tr(context, "Shuffle", "ရောသမ"),
              onPressed: hasQueue ? _audio.toggleShuffle : null,
            ),
            IconButton(
              iconSize: 32,
              icon: const Icon(Icons.skip_previous),
              color: hasQueue ? GwColors.ink : GwColors.inkSoft,
              onPressed: hasQueue ? _audio.previous : null,
            ),
            IconButton(
              iconSize: 32,
              icon: const Icon(Icons.skip_next),
              color: hasQueue ? GwColors.ink : GwColors.inkSoft,
              onPressed: hasQueue ? _audio.next : null,
            ),
            IconButton(
              iconSize: 24,
              icon: Icon(_repeat == 2 ? Icons.repeat_one : Icons.repeat),
              color: _repeat > 0 ? GwColors.primary : GwColors.inkSoft,
              tooltip: tr(context, "Repeat", "ထပ်ဖွင့်"),
              onPressed: _audio.cycleRepeat,
            ),
          ],
        ),
        if (hasQueue)
          Text(
            "${_qIdx + 1} / ${_queue.length}",
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 12),
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
    // The timer lives on the service: you set a sleep timer and put the phone
    // down, which is exactly when this screen stops existing.
    _audio.setSleep(mins);
    if (mins > 0) {
      _snack(tr(context, "Sleeping in $mins min", "$mins မိနစ်အကြာ ရပ်ပါမည်"));
    } else {
      _snack(tr(context, "Sleep timer off", "အိပ်ချိန် တိုင်မာ ပိတ်ပြီး"));
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
