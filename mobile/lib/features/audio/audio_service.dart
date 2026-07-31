import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/repository.dart';
import 'audio_api.dart';
import 'audio_models.dart';

/// The app's one and only audio engine.
///
/// It used to live inside `AudioTrackScreen`'s state, with a second copy inside
/// `LocalMusicScreen`. Both called `player.dispose()` from `dispose()`, so
/// walking back out of the player killed the song — and two screens could each
/// hold a player, so device songs and catalogue songs could play over the top
/// of each other.
///
/// A music player is not a screen. It is a thing the phone is doing, which the
/// user started deliberately and expects to keep happening until they stop it:
/// through a back tap, a tab switch, another app, a locked screen, a pocket.
/// So the player lives here, outside the widget tree, for the life of the
/// process, and screens are views onto it.
///
/// **Nothing in this class stops playback except [stop], [pause] and the sleep
/// timer.** If you are adding a `dispose()` that touches [_player], stop.
class GwAudio extends ChangeNotifier {
  GwAudio._();

  static final GwAudio instance = GwAudio._();

  final AudioPlayer _player = AudioPlayer();

  /// Set the first time a screen attaches. Used for entitlement, resume points
  /// and progress saving; null until someone signs in and opens audio.
  AudioApi? _api;

  bool _wired = false;

  // ── Queue ─────────────────────────────────────────────────────────────────

  List<AudioTrack> _queue = const [];
  int _index = 0;
  AudioTrack? _current;
  bool _entitled = false;
  bool _preparing = false;

  // ── Transport state, mirrored for cheap synchronous reads by the UI ───────

  Duration _pos = Duration.zero;
  Duration _dur = Duration.zero;
  bool _playing = false;

  /// Playback speeds, in cycle order. 1.0 first because most listening is at
  /// 1.0 and the button should start where people already are.
  static const List<double> speeds = [1.0, 1.25, 1.5, 1.75, 2.0, 0.75];
  int _speedIdx = 0;

  bool _shuffle = false;

  /// 0 off · 1 repeat all · 2 repeat one.
  int _repeat = 0;
  final Random _rand = Random();

  Timer? _sleepTimer;
  DateTime? _sleepAt;

  int _lastSavedS = -1;
  File? _localFile;

  /// Supplied by the player screen, which is the only thing that knows an
  /// audiobook's chapter list. Null when no screen is open — a saved position
  /// without a chapter index is still a correct saved position.
  int? Function()? _chapterIndex;

  // ── Reads ────────────────────────────────────────────────────────────────

  AudioPlayer get player => _player;
  AudioTrack? get current => _current;
  List<AudioTrack> get queue => _queue;
  int get index => _index;
  bool get hasQueue => _queue.length > 1;
  bool get playing => _playing;
  bool get entitled => _entitled;
  bool get preparing => _preparing;
  Duration get position => _pos;
  Duration get duration => _dur;
  double get speed => speeds[_speedIdx];
  int get speedIndex => _speedIdx;
  bool get shuffle => _shuffle;
  int get repeat => _repeat;
  File? get localFile => _localFile;

  /// Something is loaded — the mini player should be on screen.
  bool get active => _current != null;

  /// When the sleep timer will pause playback, if it is armed.
  DateTime? get sleepAt => _sleepAt;

  /// Minutes left on the sleep timer, rounded up. Null when it is off.
  int? get sleepMinutesLeft {
    final at = _sleepAt;
    if (at == null) return null;
    final left = at.difference(DateTime.now());
    if (left.isNegative) return null;
    return (left.inSeconds / 60).ceil();
  }

  // ── Wiring ───────────────────────────────────────────────────────────────

  /// Give the service an API client. Idempotent, and safe to call from every
  /// screen's `initState`.
  void attach(AudioApi api) {
    _api ??= api;
    _wire();
  }

  /// Let the open player screen tell us which chapter the playhead is in, so
  /// an audiobook resumes on the right chapter and not just the right second.
  /// Screens must clear it (pass null) when they close.
  void setChapterIndexResolver(int? Function()? f) => _chapterIndex = f;

  void _wire() {
    if (_wired) return;
    _wired = true;
    _player.positionStream.listen((d) {
      _pos = d;
      _maybeSave(d);
      notifyListeners();
    });
    _player.durationStream.listen((d) {
      if (d != null && d > Duration.zero) {
        _dur = d;
        notifyListeners();
      }
    });
    _player.playerStateStream.listen((s) async {
      _playing = s.playing;
      notifyListeners();
      if (s.processingState == ProcessingState.completed) await _onComplete();
    });
  }

  // ── Starting playback ────────────────────────────────────────────────────

  /// Play [queue] from [index].
  ///
  /// Tapping the track that is already loaded resumes it rather than starting
  /// it over — coming back to the player from somewhere else and pressing play
  /// should not lose your place.
  Future<void> playQueue(
    List<AudioTrack> queue,
    int index, {
    bool autoplay = true,
  }) async {
    if (queue.isEmpty) return;
    final i = index.clamp(0, queue.length - 1).toInt();
    final same = _current?.id == queue[i].id;
    _queue = List<AudioTrack>.unmodifiable(queue);
    _index = i;
    if (same) {
      if (autoplay && !_playing) await play();
      notifyListeners();
      return;
    }
    await _load(i, autoplay: autoplay);
  }

  /// Swap to another entry in the current queue.
  Future<void> _load(int idx, {bool autoplay = true}) async {
    if (idx < 0 || idx >= _queue.length) return;
    await _flushProgress();
    await _player.stop();

    _index = idx;
    _current = _queue[idx];
    _pos = Duration.zero;
    _dur = Duration.zero;
    _playing = false;
    _entitled = false;
    _localFile = null;
    _lastSavedS = -1;
    _preparing = true;
    notifyListeners();

    final track = _current!;
    int resumeAt = 0;

    if (track.isLocalFile) {
      // The user's own file: nothing to be entitled to and nothing to report.
      _entitled = true;
    } else {
      final api = _api;
      if (api == null) {
        _entitled = track.isFree;
      } else {
        try {
          final results = await Future.wait([
            api.isEntitled(track.id),
            api.resume(track.id),
          ]);
          _entitled = results[0] as bool;
          final resume = results[1] as AudioResume?;
          if (!autoplay) resumeAt = resume?.positionS ?? 0;
          final savedSpeed = resume?.speed;
          if (savedSpeed != null) {
            final si = speeds.indexOf(savedSpeed);
            if (si >= 0) _speedIdx = si;
          }
        } catch (_) {
          // Offline, or the call failed. A free track still plays.
          _entitled = track.isFree;
        }
      }
      _localFile = await _findLocal(track);
    }

    _preparing = false;
    notifyListeners();

    if (_entitled) {
      await _prepare(seekTo: resumeAt);
      if (autoplay) await play();
    }
  }

  /// Point the player at the audio and hang the media-notification metadata on
  /// it. Called again after a purchase, when the source did not exist before.
  Future<void> _prepare({int seekTo = 0}) async {
    final track = _current;
    if (track == null) return;

    final local = _localFile;
    final localPath = track.localPath;
    final url = resolveMedia(track.audioUrl, bucket: "media");
    // Offline copy wins — a downloaded track plays with no network at all.
    final Uri? uri = localPath != null
        ? Uri.file(localPath)
        : local != null
            ? Uri.file(local.path)
            : (url != null ? Uri.parse(url) : null);
    if (uri == null) return;

    final cover = resolveMedia(track.coverUrl, bucket: "media");
    try {
      await _player.setAudioSource(
        AudioSource.uri(
          uri,
          // This tag is what the notification and the lock screen display.
          // Without it the controls appear blank and the OS may not treat the
          // app as a media session at all.
          tag: MediaItem(
            id: track.id,
            title: track.title,
            artist: bylineOf(track),
            album: track.album,
            duration: track.durationS != null
                ? Duration(seconds: track.durationS!)
                : null,
            artUri: cover != null ? Uri.tryParse(cover) : null,
          ),
        ),
        initialPosition: seekTo > 0 ? Duration(seconds: seekTo) : null,
      );
      await _player.setSpeed(speeds[_speedIdx]);
      if (seekTo > 0) {
        _pos = Duration(seconds: seekTo);
        notifyListeners();
      }
    } catch (_) {
      // Some sources only fail on first play; let play() surface it.
    }
  }

  /// The artist / author line, computed without a BuildContext because it is
  /// read while the app is in the background.
  static String bylineOf(AudioTrack t) {
    if (t.isLocalFile) return t.artist ?? "On this phone";
    switch (t.kind) {
      case AudioKind.music:
        return t.artist ?? "Gwave";
      case AudioKind.audiobook:
        return t.author ?? "Gwave";
      case AudioKind.podcast:
        return t.episodeNo != null ? "Episode ${t.episodeNo}" : "Podcast";
    }
  }

  // ── Transport ────────────────────────────────────────────────────────────

  Future<void> play() async {
    if (_current == null) return;
    if (_player.audioSource == null) await _prepare();
    await _player.play();
  }

  Future<void> pause() async {
    await _player.pause();
    await _flushProgress();
  }

  Future<void> toggle() async => _playing ? await pause() : await play();

  /// Stop, forget the queue and take the notification down.
  ///
  /// The only thing in the app that ends playback outright. Everything else —
  /// leaving the screen, switching tabs, locking the phone — leaves it running.
  Future<void> stop() async {
    _clearSleep();
    await _flushProgress();
    await _player.stop();
    _current = null;
    _queue = const [];
    _index = 0;
    _pos = Duration.zero;
    _dur = Duration.zero;
    _playing = false;
    _localFile = null;
    _lastSavedS = -1;
    notifyListeners();
  }

  Future<void> seekTo(int seconds) async {
    final target = Duration(seconds: seconds < 0 ? 0 : seconds);
    await _player.seek(_dur > Duration.zero && target > _dur ? _dur : target);
    _pos = target;
    notifyListeners();
  }

  /// Jump by ±[seconds], clamped to the track.
  Future<void> skip(int seconds) async =>
      seekTo((_pos.inSeconds + seconds).clamp(
        0,
        _dur > Duration.zero ? _dur.inSeconds : 1 << 30,
      ).toInt());

  Future<void> cycleSpeed() async {
    _speedIdx = (_speedIdx + 1) % speeds.length;
    notifyListeners();
    await _player.setSpeed(speeds[_speedIdx]);
    await _flushProgress();
  }

  void toggleShuffle() {
    _shuffle = !_shuffle;
    notifyListeners();
  }

  void cycleRepeat() {
    _repeat = (_repeat + 1) % 3;
    notifyListeners();
  }

  Future<void> next() => _advance(1);
  Future<void> previous() => _advance(-1);

  /// Move through the queue. Shuffle picks a random other entry; repeat-all
  /// wraps. An automatic advance at the end of the last track stops when
  /// neither shuffle nor repeat is on; a manual Next always wraps, because a
  /// button that does nothing reads as broken.
  Future<void> _advance(int dir, {bool auto = false}) async {
    if (_queue.length <= 1) return;
    int next;
    if (_shuffle) {
      next = _rand.nextInt(_queue.length);
      if (next == _index) next = (next + 1) % _queue.length;
    } else {
      next = _index + dir;
      if (next >= _queue.length) {
        if (_repeat == 1 || !auto) {
          next = 0;
        } else {
          return;
        }
      }
      if (next < 0) next = _queue.length - 1;
    }
    await _load(next, autoplay: true);
  }

  /// Jump straight to a queue entry (tapping a row in the queue sheet).
  Future<void> playIndex(int idx) => _load(idx, autoplay: true);

  Future<void> _onComplete() async {
    await _flushProgress(completed: true);
    if (_repeat == 2) {
      await _player.seek(Duration.zero);
      await _player.play();
      return;
    }
    final hasNext = _queue.length > 1 &&
        (_shuffle || _repeat == 1 || _index + 1 < _queue.length);
    if (hasNext) {
      await _advance(1, auto: true);
    } else {
      await _player.pause();
      await _player.seek(Duration.zero);
    }
  }

  // ── Sleep timer ──────────────────────────────────────────────────────────

  /// Pause after [minutes]; 0 turns it off.
  ///
  /// Lives here rather than on the screen so it survives closing the player,
  /// which is the whole point of a sleep timer — you set it and put the phone
  /// down.
  void setSleep(int minutes) {
    _clearSleep();
    if (minutes <= 0) {
      notifyListeners();
      return;
    }
    _sleepAt = DateTime.now().add(Duration(minutes: minutes));
    _sleepTimer = Timer(Duration(minutes: minutes), () async {
      _sleepTimer = null;
      _sleepAt = null;
      await pause();
      notifyListeners();
    });
    notifyListeners();
  }

  void _clearSleep() {
    _sleepTimer?.cancel();
    _sleepTimer = null;
    _sleepAt = null;
  }

  // ── Entitlement / downloads ──────────────────────────────────────────────

  /// After a successful purchase: the track is ours now, so load and play it.
  Future<void> grantEntitlement() async {
    _entitled = true;
    notifyListeners();
    await _prepare();
  }

  /// Tell the service a download appeared or was deleted, so the next prepare
  /// picks the right source.
  void setLocalFile(File? f) {
    _localFile = f;
    notifyListeners();
  }

  static Future<Directory> downloadsDir() async {
    final base = await getApplicationDocumentsDirectory();
    final d = Directory("${base.path}/audio");
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  static String extOf(String ref) {
    final m = RegExp(r"\.([A-Za-z0-9]{2,4})(?:\?|$)").firstMatch(ref);
    return m?.group(1)?.toLowerCase() ?? "mp3";
  }

  static Future<File?> _findLocal(AudioTrack track) async {
    final ref = track.audioUrl;
    if (ref == null) return null;
    try {
      final f = File("${(await downloadsDir()).path}/${track.id}.${extOf(ref)}");
      return await f.exists() ? f : null;
    } catch (_) {
      return null;
    }
  }

  // ── Progress ─────────────────────────────────────────────────────────────

  void _maybeSave(Duration d) {
    final s = d.inSeconds;
    if (s > 0 && (s - _lastSavedS).abs() >= 10) {
      _lastSavedS = s;
      unawaited(_flushProgress());
    }
  }

  /// Save the listening position. Never throws — a lost position is not worth
  /// interrupting playback for.
  Future<void> _flushProgress({bool completed = false}) async {
    final track = _current;
    final api = _api;
    if (track == null || api == null) return;
    if (track.isLocalFile || !_entitled || _pos <= Duration.zero) return;
    try {
      await api.saveProgress(
        track.id,
        positionS: _pos.inSeconds,
        durationS: _dur.inSeconds > 0 ? _dur.inSeconds : track.durationS,
        chapterIdx: _chapterIndex?.call(),
        speed: speeds[_speedIdx],
        completed: completed ||
            (_dur > Duration.zero && _pos >= _dur - const Duration(seconds: 2)),
      );
    } catch (_) {}
  }

  /// Save now — for the moments where losing the position would be noticed
  /// (leaving the player screen, the app going to the background).
  Future<void> saveNow() => _flushProgress();
}

/// Wrap a file the user picked off their own phone as a playable track, so
/// device songs and catalogue songs share one queue, one notification and one
/// set of controls.
AudioTrack localTrack({required String path, required String name}) {
  return AudioTrack(
    id: "local:$path",
    kind: AudioKind.music,
    title: name,
    localPath: path,
  );
}
