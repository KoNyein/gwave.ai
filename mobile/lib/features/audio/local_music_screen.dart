import 'dart:math';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'audio_models.dart';
import 'audio_service.dart';

/// Local music player — pick songs already on the phone (any format the
/// device decodes: mp3, m4a, aac, wav, ogg, flac, opus…) and play them as a
/// playlist with the full transport: play/pause, seek, next/prev, shuffle,
/// repeat (one/all) and speed. Fully offline; nothing is uploaded.
///
/// Playback runs on the shared [GwAudio] engine, the same one the catalogue
/// uses. Two players meant device songs and store songs could play over each
/// other, and each screen's `dispose()` killed its own — so a picked song
/// stopped the moment you left this list.
class LocalMusicScreen extends StatefulWidget {
  const LocalMusicScreen({super.key});

  @override
  State<LocalMusicScreen> createState() => _LocalMusicScreenState();
}

class _LocalMusicScreenState extends State<LocalMusicScreen> {
  final _audio = GwAudio.instance;

  /// The picked files, in the order the user added them. Kept here because
  /// they are this screen's list; what is *playing* lives on the service.
  List<PlatformFile> _files = [];

  @override
  void initState() {
    super.initState();
    _audio.addListener(_onAudio);
  }

  void _onAudio() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    // Leaves playback running on purpose. The list closes; the song does not.
    _audio.removeListener(_onAudio);
    super.dispose();
  }

  bool get _playing => _audio.playing;
  Duration get _pos => _audio.position;
  Duration get _dur => _audio.duration;
  bool get _shuffle => _audio.shuffle;
  int get _repeat => _audio.repeat;

  /// Which row is playing — matched by path, since the queue is shared and may
  /// have moved on to a track this list doesn't contain.
  int get _idx {
    final id = _audio.current?.id;
    if (id == null || !id.startsWith("local:")) return -1;
    final path = id.substring(6);
    for (int i = 0; i < _files.length; i++) {
      if (_files[i].path == path) return i;
    }
    return -1;
  }

  List<AudioTrack> get _tracks => [
        for (final f in _files)
          if (f.path != null) localTrack(path: f.path!, name: f.name),
      ];

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
      final firstNew = _files.length;
      setState(() => _files = [..._files, ...picked]);
      if (_idx < 0) await _play(firstNew);
    } catch (e) {
      _snack("File pick failed — $e");
    }
  }

  /// Hand the whole list to the shared player so next/prev/shuffle/repeat and
  /// the notification controls all work on it.
  Future<void> _play(int i) async {
    final tracks = _tracks;
    if (i < 0 || i >= tracks.length) return;
    try {
      await _audio.playQueue(tracks, i);
    } catch (e) {
      if (mounted) {
        _snack(tr(context, "Can't play this file — $e",
            "ဒီဖိုင်ကို ဖွင့်၍မရပါ — $e"));
      }
    }
  }

  Future<void> _toggle() async {
    if (_idx < 0) {
      if (_files.isNotEmpty) await _play(0);
      return;
    }
    await _audio.toggle();
  }

  Future<void> _removeAt(int i) async {
    final wasPlaying = _idx == i;
    setState(() => _files.removeAt(i));
    if (wasPlaying) await _audio.stop();
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
                          onPressed: () => _removeAt(i),
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
                      onChanged: (v) => _audio.seekTo(v.round()),
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
                        onPressed: _audio.toggleShuffle,
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
                        onPressed: _audio.cycleRepeat,
                      ),
                      TextButton(
                        onPressed: _audio.cycleSpeed,
                        child: Text("${_audio.speed}×",
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
