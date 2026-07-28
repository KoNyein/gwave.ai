import 'dart:async';
import 'dart:math';

import 'package:audioplayers/audioplayers.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Local music player — pick songs already on the phone (any format the
/// device decodes: mp3, m4a, aac, wav, ogg, flac, opus…) and play them as a
/// playlist with the full transport: play/pause, seek, next/prev, shuffle,
/// repeat (one/all) and speed. Fully offline; nothing is uploaded.
class LocalMusicScreen extends StatefulWidget {
  const LocalMusicScreen({super.key});

  @override
  State<LocalMusicScreen> createState() => _LocalMusicScreenState();
}

class _LocalMusicScreenState extends State<LocalMusicScreen> {
  final _player = AudioPlayer();
  final _rand = Random();

  List<PlatformFile> _files = [];
  int _idx = -1;
  bool _playing = false;
  bool _shuffle = false;
  int _repeat = 0; // 0 off · 1 all · 2 one
  final _speeds = const [1.0, 1.25, 1.5, 0.75];
  int _speedIdx = 0;

  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;

  StreamSubscription<Duration>? _posSub;
  StreamSubscription<Duration>? _durSub;
  StreamSubscription<void>? _doneSub;
  StreamSubscription<PlayerState>? _stateSub;

  @override
  void initState() {
    super.initState();
    _posSub = _player.onPositionChanged
        .listen((d) => mounted ? setState(() => _pos = d) : null);
    _durSub = _player.onDurationChanged
        .listen((d) => mounted ? setState(() => _dur = d) : null);
    _stateSub = _player.onPlayerStateChanged.listen((s) =>
        mounted ? setState(() => _playing = s == PlayerState.playing) : null);
    _doneSub = _player.onPlayerComplete.listen((_) => _onDone());
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _durSub?.cancel();
    _doneSub?.cancel();
    _stateSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const [
          "mp3", "m4a", "aac", "wav", "ogg", "oga", "flac", "opus", "mid"
        ],
        allowMultiple: true,
      );
      final picked = res?.files.where((f) => f.path != null).toList() ?? [];
      if (picked.isEmpty) return;
      setState(() => _files = [..._files, ...picked]);
      if (_idx < 0) _play(_files.length - picked.length);
    } catch (e) {
      _snack("File pick failed — $e");
    }
  }

  Future<void> _play(int i) async {
    if (i < 0 || i >= _files.length) return;
    final path = _files[i].path;
    if (path == null) return;
    setState(() {
      _idx = i;
      _pos = Duration.zero;
      _dur = Duration.zero;
    });
    try {
      await _player.stop();
      await _player.play(DeviceFileSource(path));
      await _player.setPlaybackRate(_speeds[_speedIdx]);
    } catch (e) {
      _snack(tr(context, "Can't play this file — $e",
          "ဒီဖိုင်ကို ဖွင့်၍မရပါ — $e"));
    }
  }

  void _onDone() {
    if (!mounted || _files.isEmpty) return;
    if (_repeat == 2) {
      _play(_idx);
      return;
    }
    int next;
    if (_shuffle) {
      next = _rand.nextInt(_files.length);
      if (next == _idx && _files.length > 1) next = (next + 1) % _files.length;
    } else {
      next = _idx + 1;
      if (next >= _files.length) {
        if (_repeat != 1) {
          setState(() => _playing = false);
          return;
        }
        next = 0;
      }
    }
    _play(next);
  }

  Future<void> _toggle() async {
    if (_idx < 0) {
      if (_files.isNotEmpty) _play(0);
      return;
    }
    _playing ? await _player.pause() : await _player.resume();
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  String _clock(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, "0");
    final s = (d.inSeconds % 60).toString().padLeft(2, "0");
    return "$m:$s";
  }

  @override
  Widget build(BuildContext context) {
    final cur = _idx >= 0 && _idx < _files.length ? _files[_idx] : null;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "My device music", "စက်ထဲက သီချင်း")),
        actions: [
          IconButton(
            tooltip: tr(context, "Add songs", "သီချင်း ထည့်ရန်"),
            icon: const Icon(Icons.playlist_add),
            onPressed: _pick,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _files.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: GwEmpty(
                        icon: Icons.library_music_outlined,
                        title: tr(context, "Pick songs from your phone",
                            "ဖုန်းထဲက သီချင်းများ ရွေးပါ"),
                        subtitle: tr(
                            context,
                            "MP3, M4A, AAC, WAV, OGG, FLAC… all play offline.",
                            "MP3, M4A, AAC, WAV, OGG, FLAC… အားလုံး အော့ဖ်လိုင်း ဖွင့်နိုင်ပါတယ်။"),
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                    itemCount: _files.length,
                    itemBuilder: (_, i) {
                      final f = _files[i];
                      final active = i == _idx;
                      return ListTile(
                        dense: true,
                        leading: Icon(
                          active
                              ? (_playing
                                  ? Icons.graphic_eq
                                  : Icons.pause_circle_outline)
                              : Icons.music_note_outlined,
                          color: active
                              ? GwColors.primary
                              : GwColors.inkSoftOf(context),
                        ),
                        title: Text(
                          f.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight:
                                active ? FontWeight.w800 : FontWeight.w600,
                            color: active
                                ? GwColors.primary
                                : GwColors.inkOf(context),
                            fontSize: 14,
                          ),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.close, size: 17),
                          color: GwColors.inkSoftOf(context),
                          onPressed: () => setState(() {
                            _files.removeAt(i);
                            if (_idx == i) {
                              _player.stop();
                              _idx = -1;
                            } else if (_idx > i) {
                              _idx--;
                            }
                          }),
                        ),
                        onTap: () => _play(i),
                      );
                    },
                  ),
          ),
          // Transport bar.
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 18),
            decoration: BoxDecoration(
              color: GwColors.surfaceOf(context),
              border: Border(top: BorderSide(color: GwColors.lineOf(context))),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (cur != null)
                    Text(cur.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                            color: GwColors.inkOf(context))),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 3,
                      thumbShape:
                          const RoundSliderThumbShape(enabledThumbRadius: 6),
                    ),
                    child: Slider(
                      min: 0,
                      max: max(_dur.inSeconds, 1).toDouble(),
                      value: _pos.inSeconds
                          .clamp(0, max(_dur.inSeconds, 1))
                          .toDouble(),
                      onChanged: (v) =>
                          _player.seek(Duration(seconds: v.round())),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_clock(_pos),
                          style: TextStyle(
                              fontSize: 11,
                              color: GwColors.inkSoftOf(context))),
                      Text(_clock(_dur),
                          style: TextStyle(
                              fontSize: 11,
                              color: GwColors.inkSoftOf(context))),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.shuffle, size: 22),
                        color: _shuffle
                            ? GwColors.primary
                            : GwColors.inkSoftOf(context),
                        onPressed: () =>
                            setState(() => _shuffle = !_shuffle),
                      ),
                      IconButton(
                        icon: const Icon(Icons.skip_previous, size: 30),
                        color: GwColors.inkOf(context),
                        onPressed: _files.isEmpty
                            ? null
                            : () => _play(
                                _idx <= 0 ? _files.length - 1 : _idx - 1),
                      ),
                      GestureDetector(
                        onTap: _toggle,
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: const BoxDecoration(
                            color: GwColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                              _playing ? Icons.pause : Icons.play_arrow,
                              color: Colors.white,
                              size: 32),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.skip_next, size: 30),
                        color: GwColors.inkOf(context),
                        onPressed: _files.isEmpty
                            ? null
                            : () => _play((_idx + 1) % _files.length),
                      ),
                      IconButton(
                        icon: Icon(
                            _repeat == 2 ? Icons.repeat_one : Icons.repeat,
                            size: 22),
                        color: _repeat > 0
                            ? GwColors.primary
                            : GwColors.inkSoftOf(context),
                        onPressed: () =>
                            setState(() => _repeat = (_repeat + 1) % 3),
                      ),
                      TextButton(
                        onPressed: () async {
                          setState(() =>
                              _speedIdx = (_speedIdx + 1) % _speeds.length);
                          await _player
                              .setPlaybackRate(_speeds[_speedIdx]);
                        },
                        child: Text("${_speeds[_speedIdx]}×",
                            style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: GwColors.inkOf(context))),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
