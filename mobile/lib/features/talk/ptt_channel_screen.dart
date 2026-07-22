import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native walkie-talkie console for one channel. Hold the big mic button to
/// record; releasing uploads the clip and posts it to the channel. New clips
/// from other members arrive on a short poll and play automatically — true
/// walkie-talkie behaviour — and the whole history stays tappable to replay.
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
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _fetchNew());
    _player.onPlayerComplete.listen((_) {
      if (!mounted) return;
      setState(() => _playingId = null);
      _drainQueue();
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    _recordTicker?.cancel();
    _pulse.dispose();
    _recorder.dispose();
    _player.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String get _myId => context.read<AppState>().api.session!.profileId;

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
      backgroundColor: GwColors.bg,
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
            Text(
              tr(context, "${widget.channel.memberCount} members",
                  "အဖွဲ့ဝင် ${widget.channel.memberCount} ဦး"),
              style: const TextStyle(
                  fontSize: 12,
                  color: GwColors.inkSoft,
                  fontWeight: FontWeight.w500),
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
                        : GwColors.surface),
                borderRadius: BorderRadius.circular(16),
                border: isMine ? null : Border.all(color: GwColors.line),
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
                          color: isMine ? Colors.white70 : GwColors.inkSoft),
                      const SizedBox(width: 6),
                      Text(
                        "${secs}s",
                        style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: isMine ? Colors.white : GwColors.ink),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        timeAgo(m.createdAt),
                        style: TextStyle(
                            fontSize: 10.5,
                            color:
                                isMine ? Colors.white70 : GwColors.inkSoft),
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
        decoration: const BoxDecoration(
          color: GwColors.surface,
          border: Border(top: BorderSide(color: GwColors.line)),
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
                color: _recording ? GwColors.live : GwColors.inkSoft,
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
