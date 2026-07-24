import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:realtime_client/realtime_client.dart';
import 'package:record/record.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native walkie-talkie console for one channel, Zello-style. Hold the big
/// mic button to record; releasing uploads the clip and pushes it to everyone
/// over a Realtime broadcast, where it plays instantly. While a member holds
/// the button the others see a live "on air" banner, and the header shows who
/// is online right now (lightweight ping presence). A slow poll remains as a
/// fallback so clips are never lost if the socket drops.
class PttChannelScreen extends StatefulWidget {
  const PttChannelScreen({super.key, required this.channel});
  final PttChannel channel;

  @override
  State<PttChannelScreen> createState() => _PttChannelScreenState();
}

class _PttChannelScreenState extends State<PttChannelScreen>
    with SingleTickerProviderStateMixin {
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();
  final _scroll = ScrollController();

  List<PttMessage> _messages = [];
  bool _loading = true;
  String? _error;

  bool _recording = false;
  bool _sending = false;
  DateTime? _recordStart;
  Timer? _recordTicker;
  Duration _recordElapsed = Duration.zero;

  Timer? _poll;
  String? _lastSeenIso; // UTC ISO of the newest message we've fetched
  String? _playingId;
  final List<PttMessage> _playQueue = [];

  // Realtime: instant clip delivery + live "on air" + who's-online pings.
  RealtimeClient? _rt;
  RealtimeChannel? _rtChannel;
  Timer? _pingTimer;
  final Map<String, DateTime> _onlineSeen = {}; // profile id -> last ping
  String? _talkingId; // who is holding the button right now
  String? _talkingName;
  Timer? _talkingClear; // safety: drop a stuck "on air" if talk_off was lost

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
    lowerBound: 0.92,
    upperBound: 1.06,
  );

  @override
  void initState() {
    super.initState();
    _load();
    // The Realtime broadcast is the fast path; this poll only backfills
    // anything missed while the socket was down.
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _fetchNew());
    _connectRealtime();
    _player.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() => _playingId = null);
      _drainQueue();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _pingTimer?.cancel();
    _talkingClear?.cancel();
    try {
      _rtChannel?.unsubscribe();
      _rt?.disconnect();
    } catch (_) {}
    _recordTicker?.cancel();
    _pulse.dispose();
    _recorder.dispose();
    _player.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String get _myId => context.read<AppState>().api.session!.profileId;

  /// My identity as broadcast payload (matches Profile.fromJson keys).
  Map<String, dynamic> get _fromPayload {
    final me = context.read<AppState>().me;
    return {
      "id": _myId,
      "username": me?.username,
      "full_name": me?.fullName,
      "avatar_url": me?.avatarUrl,
    };
  }

  // ---- Realtime (Zello-style instant delivery) ------------------------------

  Future<void> _connectRealtime() async {
    try {
      final api = context.read<AppState>().api;
      await api.freshToken();
      final token = api.session?.token;
      if (token == null) return;
      _rt = RealtimeClient(
        AppConfig.realtimeUrl,
        params: {"apikey": AppConfig.supabaseAnonKey},
      );
      _rt!.setAuth(token);
      _rt!.connect();
      final ch = _rt!.channel("ptt:${widget.channel.id}");
      ch
        ..onBroadcast(event: "clip", callback: _onClipEvent)
        ..onBroadcast(event: "talk", callback: _onTalkEvent)
        ..onBroadcast(event: "ping", callback: _onPingEvent);
      ch.subscribe();
      _rtChannel = ch;
      // Lightweight presence: everyone pings every 25s; entries older than
      // 70s count as offline.
      _sendPing();
      _pingTimer =
          Timer.periodic(const Duration(seconds: 25), (_) => _sendPing());
    } catch (_) {
      // Realtime is an accelerator — the poll still delivers everything.
    }
  }

  void _sendPing() {
    try {
      _rtChannel?.sendBroadcastMessage(
        event: "ping",
        payload: {"from": _fromPayload},
      );
    } catch (_) {}
  }

  void _markOnline(dynamic from) {
    if (from is! Map) return;
    final id = from["id"]?.toString();
    if (id == null || id.isEmpty) return;
    _onlineSeen[id] = DateTime.now();
  }

  int get _onlineCount {
    final cutoff = DateTime.now().subtract(const Duration(seconds: 70));
    _onlineSeen.removeWhere((_, t) => t.isBefore(cutoff));
    // Ourselves + everyone recently heard from.
    return {_myId, ..._onlineSeen.keys}.length;
  }

  void _onPingEvent(Map<String, dynamic> payload) {
    _markOnline(payload["from"]);
    if (mounted) setState(() {});
  }

  void _onTalkEvent(Map<String, dynamic> payload) {
    final from = payload["from"];
    _markOnline(from);
    if (from is! Map) return;
    final id = from["id"]?.toString();
    if (id == null || id == _myId || !mounted) return;
    final on = payload["on"] == true;
    setState(() {
      if (on) {
        _talkingId = id;
        _talkingName = Profile.fromJson(Map<String, dynamic>.from(from))
            .displayName;
      } else if (_talkingId == id) {
        _talkingId = null;
        _talkingName = null;
      }
    });
    _talkingClear?.cancel();
    if (on) {
      _talkingClear = Timer(const Duration(seconds: 30), () {
        if (mounted && _talkingId == id) {
          setState(() {
            _talkingId = null;
            _talkingName = null;
          });
        }
      });
    }
  }

  void _onClipEvent(Map<String, dynamic> payload) {
    final from = payload["from"];
    _markOnline(from);
    final raw = payload["message"];
    if (raw is! Map || from is! Map) return;
    if (from["id"]?.toString() == _myId) return; // our own broadcast
    if (!mounted) return;
    final m = PttMessage(
      id: raw["id"].toString(),
      userId: from["id"].toString(),
      audioPath: (raw["audio_path"] ?? "").toString(),
      durationMs: (raw["duration_ms"] as num?)?.toInt(),
      createdAt: DateTime.tryParse("${raw["created_at"]}")?.toLocal() ??
          DateTime.now(),
      person: Profile.fromJson(Map<String, dynamic>.from(from)),
    );
    if (_messages.any((x) => x.id == m.id)) return;
    setState(() {
      _messages = [..._messages, m];
      _lastSeenIso = m.createdAt.toUtc().toIso8601String();
      _talkingId = null;
      _talkingName = null;
    });
    _jumpToEnd();
    _playQueue.add(m);
    _drainQueue();
  }

  Future<void> _load() async {
    try {
      final list =
          await context.read<AppState>().repo.pttMessages(widget.channel.id);
      if (!mounted) return;
      setState(() {
        _messages = list;
        _loading = false;
        if (list.isNotEmpty) {
          _lastSeenIso = list.last.createdAt.toUtc().toIso8601String();
        }
      });
      _jumpToEnd();
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  Future<void> _fetchNew() async {
    if (_loading || !mounted) return;
    try {
      final fresh = await context
          .read<AppState>()
          .repo
          .pttMessages(widget.channel.id, sinceIso: _lastSeenIso);
      if (!mounted || fresh.isEmpty) return;
      final known = {for (final m in _messages) m.id};
      final news = [
        for (final m in fresh)
          if (!known.contains(m.id)) m,
      ];
      if (news.isEmpty) return;
      setState(() {
        _messages = [..._messages, ...news];
        _lastSeenIso = _messages.last.createdAt.toUtc().toIso8601String();
      });
      _jumpToEnd();
      // Walkie-talkie: play everyone else's new clips as they arrive.
      final me = _myId;
      _playQueue.addAll(news.where((m) => m.userId != me));
      _drainQueue();
    } catch (_) {
      // Polling hiccups are silent; the next tick retries.
    }
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  // ---- Playback -------------------------------------------------------------

  void _drainQueue() {
    if (_playingId != null || _playQueue.isEmpty) return;
    final next = _playQueue.removeAt(0);
    _play(next);
  }

  Future<void> _play(PttMessage m) async {
    final url = resolveMedia(m.audioPath, bucket: "media");
    if (url == null) return;
    try {
      await _player.stop();
      setState(() => _playingId = m.id);
      await _player.play(UrlSource(url));
    } catch (_) {
      if (mounted) setState(() => _playingId = null);
    }
  }

  Future<void> _togglePlay(PttMessage m) async {
    if (_playingId == m.id) {
      await _player.stop();
      if (mounted) setState(() => _playingId = null);
      return;
    }
    _playQueue.clear();
    await _play(m);
  }

  // ---- Recording ------------------------------------------------------------

  Future<void> _startRecording() async {
    if (_recording || _sending) return;
    try {
      if (!await _recorder.hasPermission()) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr(context, "Microphone permission is required.",
                "မိုက်ခရိုဖုန်း ခွင့်ပြုချက် လိုအပ်ပါသည်။")),
          ));
        }
        return;
      }
      final dir = await getTemporaryDirectory();
      final path =
          "${dir.path}/ptt_${DateTime.now().millisecondsSinceEpoch}.m4a";
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
        path: path,
      );
      _recordStart = DateTime.now();
      _recordTicker = Timer.periodic(const Duration(milliseconds: 200), (_) {
        if (mounted && _recordStart != null) {
          setState(
              () => _recordElapsed = DateTime.now().difference(_recordStart!));
        }
      });
      _pulse.repeat(reverse: true);
      setState(() {
        _recording = true;
        _recordElapsed = Duration.zero;
      });
      // Everyone in the channel sees "on air" the instant the button goes down.
      try {
        _rtChannel?.sendBroadcastMessage(
          event: "talk",
          payload: {"on": true, "from": _fromPayload},
        );
      } catch (_) {}
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't start recording — $e")),
        );
      }
    }
  }

  Future<void> _stopRecording({bool cancel = false}) async {
    if (!_recording) return;
    _recordTicker?.cancel();
    _pulse.stop();
    _pulse.value = 1;
    final startedAt = _recordStart;
    _recordStart = null;
    setState(() => _recording = false);
    try {
      _rtChannel?.sendBroadcastMessage(
        event: "talk",
        payload: {"on": false, "from": _fromPayload},
      );
    } catch (_) {}

    String? path;
    try {
      path = await _recorder.stop();
    } catch (_) {}
    if (cancel || path == null || startedAt == null) return;

    final durationMs = DateTime.now().difference(startedAt).inMilliseconds;
    // A tap rather than a hold — too short to be a real transmission.
    if (durationMs < 400) return;

    setState(() => _sending = true);
    try {
      final state = context.read<AppState>();
      final bytes = await File(path).readAsBytes();
      final audioPath = await state.api.uploadBytes(
        bytes,
        ext: "m4a",
        contentType: "audio/mp4",
      );
      final sent = await state.repo.sendPttMessage(
        widget.channel.id,
        audioPath,
        durationMs: durationMs,
      );
      if (sent != null && mounted) {
        setState(() {
          _messages = [..._messages, sent];
          _lastSeenIso = sent.createdAt.toUtc().toIso8601String();
        });
        _jumpToEnd();
        // Push the clip to everyone instantly — receivers play it on arrival
        // instead of waiting for their next poll.
        try {
          _rtChannel?.sendBroadcastMessage(event: "clip", payload: {
            "message": {
              "id": sent.id,
              "audio_path": sent.audioPath,
              "duration_ms": sent.durationMs,
              "created_at": sent.createdAt.toUtc().toIso8601String(),
            },
            "from": _fromPayload,
          });
        } catch (_) {}
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send — $e")),
        );
      }
    } finally {
      try {
        await File(path).delete();
      } catch (_) {}
      if (mounted) setState(() => _sending = false);
    }
  }

  // ---- Channel actions ------------------------------------------------------

  void _copyCode() {
    final code = widget.channel.joinCode;
    if (code == null) return;
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(tr(context, "Join code copied: $code",
          "Join code ကူးပြီးပါပြီ — $code")),
    ));
  }

  Future<void> _showMembers() async {
    List<Profile> members = [];
    try {
      members =
          await context.read<AppState>().repo.pttMembers(widget.channel.id);
    } catch (_) {}
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: GwColors.bgOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(14),
          children: [
            Text(tr(ctx, "Members (${members.length})",
                "အဖွဲ့ဝင်များ (${members.length})"),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 8),
            for (final p in members)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: GwAvatar(
                    url: resolveMedia(p.avatarUrl),
                    name: p.displayName,
                    size: 36),
                title: Text(p.displayName,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: p.username != null ? Text("@${p.username}") : null,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _leave() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Leave channel?", "Channel မှ ထွက်မလား?")),
        content: Text(tr(
            ctx,
            "You'll stop receiving transmissions from \"${widget.channel.name}\".",
            "\"${widget.channel.name}\" မှ အသံများ လက်ခံရရှိတော့မည် မဟုတ်ပါ။")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "Leave", "ထွက်မည်"),
                  style: const TextStyle(color: GwColors.live))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<AppState>().repo.leavePttChannel(widget.channel.id);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't leave — $e")),
        );
      }
    }
  }

  // ---- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.channel.name,
                maxLines: 1, overflow: TextOverflow.ellipsis),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2E9E5B),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  tr(
                      context,
                      "$_onlineCount online · ${widget.channel.memberCount} members",
                      "Online $_onlineCount ဦး · အဖွဲ့ဝင် ${widget.channel.memberCount} ဦး"),
                  style: TextStyle(
                      fontSize: 12,
                      color: GwColors.inkSoftOf(context),
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == "code") _copyCode();
              if (v == "members") _showMembers();
              if (v == "leave") _leave();
            },
            itemBuilder: (ctx) => [
              if (widget.channel.joinCode != null)
                PopupMenuItem(
                  value: "code",
                  child: Text(tr(ctx, "Copy join code", "Join code ကူးရန်")),
                ),
              PopupMenuItem(
                value: "members",
                child: Text(tr(ctx, "Members", "အဖွဲ့ဝင်များ")),
              ),
              PopupMenuItem(
                value: "leave",
                child: Text(tr(ctx, "Leave channel", "Channel မှ ထွက်ရန်")),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.channel.joinCode != null) _codeBanner(),
          if (_talkingName != null) _onAirBanner(),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: GwColors.primary))
                : _error != null && _messages.isEmpty
                    ? GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load the channel",
                        subtitle: _error)
                    : _messages.isEmpty
                        ? GwEmpty(
                            icon: Icons.settings_voice_outlined,
                            title: tr(context, "Quiet in here",
                                "တိတ်ဆိတ်နေပါသေးတယ်"),
                            subtitle: tr(
                                context,
                                "Hold the mic button to make the first transmission.",
                                "ပထမဆုံး အသံလွှင့်ရန် မိုက်ခလုတ်ကို ဖိထားပါ။"))
                        : ListView.builder(
                            controller: _scroll,
                            padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                            itemCount: _messages.length,
                            itemBuilder: (_, i) => _messageRow(_messages[i]),
                          ),
          ),
          _talkBar(),
        ],
      ),
    );
  }

  /// Live "on air" strip while another member is holding their mic button.
  Widget _onAirBanner() {
    return Container(
      width: double.infinity,
      color: GwColors.live.withValues(alpha: 0.10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.settings_voice, size: 16, color: GwColors.live),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr(context, "🔴 $_talkingName is talking…",
                  "🔴 $_talkingName ပြောနေသည်…"),
              style: const TextStyle(
                  fontSize: 13,
                  color: GwColors.live,
                  fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _codeBanner() {
    return InkWell(
      onTap: _copyCode,
      child: Container(
        width: double.infinity,
        color: GwColors.primary.withValues(alpha: 0.08),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.key, size: 15, color: GwColors.primary),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                tr(context,
                    "Join code: ${widget.channel.joinCode} — tap to copy",
                    "Join code: ${widget.channel.joinCode} — ကူးရန် နှိပ်ပါ"),
                style: const TextStyle(
                    fontSize: 12.5,
                    color: GwColors.primary,
                    fontWeight: FontWeight.w700),
              ),
            ),
            const Icon(Icons.copy, size: 14, color: GwColors.primary),
          ],
        ),
      ),
    );
  }

  Widget _messageRow(PttMessage m) {
    final isMine = m.userId == _myId;
    final name = isMine
        ? tr(context, "You", "သင်")
        : (m.person?.displayName ?? "Gwave user");
    final playing = _playingId == m.id;
    final secs = ((m.durationMs ?? 0) / 1000).clamp(0, 999).toStringAsFixed(1);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (!isMine) ...[
            GwAvatar(
                url: resolveMedia(m.person?.avatarUrl), name: name, size: 32),
            const SizedBox(width: 8),
          ],
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => _togglePlay(m),
            child: Container(
              constraints: const BoxConstraints(maxWidth: 250),
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: isMine
                    ? GwColors.primary
                    : (playing
                        ? GwColors.primary.withValues(alpha: 0.12)
                        : GwColors.surfaceOf(context)),
                borderRadius: BorderRadius.circular(16),
                border: isMine ? null : Border.all(color: GwColors.lineOf(context)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isMine)
                    Text(name,
                        style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
                            color: GwColors.primary)),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        playing
                            ? Icons.stop_circle_outlined
                            : Icons.play_circle_fill,
                        size: 28,
                        color: isMine ? Colors.white : GwColors.primary,
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.graphic_eq,
                          size: 18,
                          color: isMine ? Colors.white70 : GwColors.inkSoftOf(context)),
                      const SizedBox(width: 6),
                      Text(
                        "${secs}s",
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: isMine ? Colors.white : GwColors.inkOf(context)),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        timeAgo(m.createdAt),
                        style: TextStyle(
                            fontSize: 10.5,
                            color:
                                isMine ? Colors.white70 : GwColors.inkSoftOf(context)),
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

  Widget _talkBar() {
    final secs = (_recordElapsed.inMilliseconds / 1000).toStringAsFixed(1);
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          border: Border(top: BorderSide(color: GwColors.lineOf(context))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _sending
                  ? tr(context, "Sending…", "ပို့နေသည်…")
                  : _recording
                      ? tr(context, "🔴 On air — ${secs}s (release to send)",
                          "🔴 လွှင့်နေသည် — ${secs}s (လွှတ်လိုက်ရင် ပို့မည်)")
                      : tr(context, "Hold to talk", "ဖိထားပြီး ပြောပါ"),
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _recording ? GwColors.live : GwColors.inkSoftOf(context),
              ),
            ),
            const SizedBox(height: 10),
            GestureDetector(
              onTapDown: (_) => _startRecording(),
              onTapUp: (_) => _stopRecording(),
              onTapCancel: () => _stopRecording(),
              onLongPressEnd: (_) => _stopRecording(),
              child: ScaleTransition(
                scale: _pulse,
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: _recording
                        ? const LinearGradient(
                            colors: [Color(0xFFEF4444), Color(0xFFB91C1C)])
                        : GwColors.primaryGradient,
                    boxShadow: GwShadow.card,
                  ),
                  child: _sending
                      ? const Padding(
                          padding: EdgeInsets.all(26),
                          child: CircularProgressIndicator(
                              strokeWidth: 3, color: Colors.white),
                        )
                      : Icon(
                          _recording ? Icons.settings_voice : Icons.mic,
                          color: Colors.white,
                          size: 38,
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
