import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/call_service.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';
import 'video_view_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.conversation});
  final Conversation conversation;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  List<Message> _messages = [];
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _load();
    _pollPresence();
    _presenceTimer =
        Timer.periodic(const Duration(seconds: 45), (_) => _pollPresence());
  }

  @override
  void dispose() {
    _presenceTimer?.cancel();
    _voiceRecorder.dispose();
    _voicePlayer.dispose();
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  // ---- Voice messages ------------------------------------------------------
  final _voiceRecorder = AudioRecorder();
  final _voicePlayer = AudioPlayer();
  bool _recordingVoice = false;
  bool _sendingVoice = false;
  DateTime? _voiceStart;
  String? _playingMessageId;

  /// Tap the mic to start, tap the stop button to send. FB Messenger-style
  /// voice notes, stored like the web's (file_kind 'audio').
  Future<void> _toggleVoice() async {
    if (_sendingVoice) return;
    if (_recordingVoice) {
      final path = await _voiceRecorder.stop();
      final started = _voiceStart;
      setState(() => _recordingVoice = false);
      if (path == null || started == null) return;
      final secs = DateTime.now().difference(started).inSeconds;
      setState(() => _sendingVoice = true);
      try {
        final bytes = await File(path).readAsBytes();
        final api = context.read<AppState>().api;
        final storagePath = await api.uploadBytes(bytes,
            ext: "m4a", contentType: "audio/mp4", bucket: "chat-media");
        final msg = await context
            .read<AppState>()
            .repo
            .sendVoiceMessage(widget.conversation.id, storagePath,
                secs.clamp(1, 600).toInt());
        if (msg != null && mounted) {
          setState(() => _messages.add(msg));
          _jumpToBottom();
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text("Couldn't send voice — $e")));
        }
      } finally {
        if (mounted) setState(() => _sendingVoice = false);
      }
      return;
    }
    if (!await _voiceRecorder.hasPermission()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text("Microphone permission is required.")));
      }
      return;
    }
    final dir = await getTemporaryDirectory();
    await _voiceRecorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
      ),
      path: "${dir.path}/voice_${DateTime.now().millisecondsSinceEpoch}.m4a",
    );
    if (mounted) {
      setState(() {
        _recordingVoice = true;
        _voiceStart = DateTime.now();
      });
    }
  }

  Future<void> _playVoice(Message m) async {
    final url = resolveMedia(m.filePath, bucket: "chat-media");
    if (url == null) return;
    if (_playingMessageId == m.id) {
      await _voicePlayer.stop();
      setState(() => _playingMessageId = null);
      return;
    }
    await _voicePlayer.stop();
    setState(() => _playingMessageId = m.id);
    await _voicePlayer.play(UrlSource(url));
    _voicePlayer.onPlayerComplete.first.then((_) {
      if (mounted && _playingMessageId == m.id) {
        setState(() => _playingMessageId = null);
      }
    });
  }

  /// Messenger-style presence for the chat header ("Active now").
  DateTime? _peerSeen;
  Timer? _presenceTimer;

  bool get _peerOnline =>
      _peerSeen != null &&
      DateTime.now().difference(_peerSeen!) < const Duration(minutes: 2);

  Future<void> _pollPresence() async {
    final other = widget.conversation.other;
    if (other == null || !mounted) return;
    final p =
        await context.read<AppState>().repo.presenceFor([other.id]);
    if (mounted) setState(() => _peerSeen = p[other.id]);
  }

  Future<void> _load() async {
    try {
      final m = await context
          .read<AppState>()
          .repo
          .messages(widget.conversation.id);
      setState(() {
        _messages = m;
        _loading = false;
      });
      _jumpToBottom();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  void _jumpToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.jumpTo(_scroll.position.maxScrollExtent);
      }
    });
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    final repo = context.read<AppState>().repo;
    _input.clear();
    try {
      final msg = await repo.sendMessage(widget.conversation.id, text);
      if (msg != null) {
        setState(() => _messages = [..._messages, msg]);
        _jumpToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send — $e")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _sendPhoto() async {
    final media = await pickAndUploadImage(context);
    if (media == null || !mounted) return;
    final repo = context.read<AppState>().repo;
    try {
      final msg = await repo.sendImageMessage(widget.conversation.id, media.path);
      if (msg != null && mounted) {
        setState(() => _messages = [..._messages, msg]);
        _jumpToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send photo — $e")),
        );
      }
    }
  }

  Future<void> _sendVideo() async {
    final media = await pickAndUploadVideo(context);
    if (media == null || !mounted) return;
    final repo = context.read<AppState>().repo;
    try {
      final msg = await repo.sendVideoMessage(widget.conversation.id, media.path);
      if (msg != null && mounted) {
        setState(() => _messages = [..._messages, msg]);
        _jumpToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send video — $e")),
        );
      }
    }
  }

  Future<void> _sendFile() async {
    FilePickerResult? res;
    try {
      res = await FilePicker.platform.pickFiles(withData: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("Couldn't pick file — $e")));
      }
      return;
    }
    if (res == null || res.files.isEmpty || !mounted) return;
    final f = res.files.first;
    final bytes = f.bytes;
    if (bytes == null) return;
    if (bytes.lengthInBytes > 100 * 1024 * 1024) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(tr(context, "That file is too large (max 100 MB).",
                "ဖိုင် အရမ်းကြီးနေသည် (အများဆုံး 100 MB)။"))));
      }
      return;
    }
    final ext = (f.extension ?? "bin").toLowerCase();
    final api = context.read<AppState>().api;
    final repo = context.read<AppState>().repo;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          const Center(child: CircularProgressIndicator(color: GwColors.primary)),
    );
    try {
      final path = await api.uploadBytes(bytes,
          ext: ext, contentType: "application/octet-stream", bucket: "chat-media");
      final msg =
          await repo.sendFileMessage(widget.conversation.id, path, f.name);
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      if (msg != null && mounted) {
        setState(() => _messages = [..._messages, msg]);
        _jumpToBottom();
      }
    } catch (e) {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send file — $e")),
        );
      }
    }
  }

  /// Facebook-Messenger-style attachment sheet: Photo / Video / File.
  Future<void> _attachSheet() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: GwColors.lineOf(ctx),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            _attachTile(ctx, Icons.image_outlined, const Color(0xFF2E9E5B),
                tr(ctx, "Photo", "ဓာတ်ပုံ"), "photo"),
            _attachTile(ctx, Icons.videocam_outlined, const Color(0xFF2E7DB1),
                tr(ctx, "Video", "ဗီဒီယို"), "video"),
            _attachTile(ctx, Icons.insert_drive_file_outlined,
                const Color(0xFF7A4DD6), tr(ctx, "File", "ဖိုင်"), "file"),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (!mounted) return;
    switch (choice) {
      case "photo":
        await _sendPhoto();
        break;
      case "video":
        await _sendVideo();
        break;
      case "file":
        await _sendFile();
        break;
    }
  }

  Widget _attachTile(BuildContext ctx, IconData icon, Color color, String label,
      String value) {
    return ListTile(
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, color: color),
      ),
      title: Text(label,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
      onTap: () => Navigator.of(ctx).pop(value),
    );
  }

  Future<void> _openFile(Message m) async {
    final url = resolveMedia(m.filePath, bucket: "chat-media");
    if (url == null) return;
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  /// Native WebRTC calling has no Flutter SDK wired yet, so calls run in the web
  /// messenger. Explain that up front (rather than silently jumping to the
  /// browser) and let the user choose.
  Future<void> _confirmWebCall(String label) async {
    final go = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(label),
        content: const Text(
          "In-app calling is coming soon. For now, calls open in the Gwave web "
          "app. Open it now?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text("Cancel"),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text("Open web"),
          ),
        ],
      ),
    );
    if (go != true) return;
    if (mounted) await openWeb(context, "/messages", title: "Messenger");
  }

  /// Native 1:1 audio/video call. Group calls still fall back to the web room.
  Future<void> _startCall({required bool withVideo}) async {
    final other = widget.conversation.other;
    if (widget.conversation.isGroup || other == null) {
      await _confirmWebCall(withVideo ? "Video call" : "Audio call");
      return;
    }
    final ok = await context
        .read<CallService>()
        .startCall(other, widget.conversation.id, withVideo: withVideo);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text("Microphone / camera permission is required to call."),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final myId = context.read<AppState>().api.session?.profileId;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            GwAvatar(name: widget.conversation.displayTitle, size: 36),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(widget.conversation.displayTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w800)),
                  if (!widget.conversation.isGroup)
                    _peerOnline
                        ? Text(tr(context, "Active now", "အွန်လိုင်းရှိသည်"),
                            style: const TextStyle(
                                fontSize: 11.5,
                                color: Color(0xFF31A24C),
                                fontWeight: FontWeight.w600))
                        : _peerSeen != null
                            ? Text(
                                tr(context, "Active ${timeAgo(_peerSeen!)}",
                                    "${timeAgo(_peerSeen!)} က"),
                                style: TextStyle(
                                    fontSize: 11.5,
                                    color: GwColors.inkSoftOf(context)))
                            : const SizedBox.shrink(),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
              icon: const Icon(Icons.call),
              onPressed: () => _startCall(withVideo: false)),
          IconButton(
              icon: const Icon(Icons.videocam),
              onPressed: () => _startCall(withVideo: true)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: GwColors.primary))
                : _messages.isEmpty
                    ? const GwEmpty(
                        icon: Icons.waving_hand_outlined,
                        title: "Start the conversation")
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(14),
                        itemCount: _messages.length,
                        itemBuilder: (_, i) {
                          final m = _messages[i];
                          return _bubble(m, m.senderId == myId);
                        },
                      ),
          ),
          _composer(),
        ],
      ),
    );
  }

  Widget _bubble(Message m, bool mine) {
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 3),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.72),
        decoration: BoxDecoration(
          color: mine ? GwColors.primary : GwColors.surfaceOf(context),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(mine ? 18 : 4),
            bottomRight: Radius.circular(mine ? 4 : 18),
          ),
          border: mine ? null : Border.all(color: GwColors.lineOf(context)),
        ),
        child: m.isVideo
            ? _videoBubble(m, mine)
            : m.isFile
            ? _fileBubble(m, mine)
            : m.isVoice
            ? InkWell(
                onTap: () => _playVoice(m),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _playingMessageId == m.id
                          ? Icons.stop_circle
                          : Icons.play_circle_fill,
                      color: mine ? Colors.white : GwColors.primary,
                      size: 32,
                    ),
                    const SizedBox(width: 8),
                    Icon(Icons.graphic_eq,
                        color: mine ? Colors.white70 : GwColors.inkSoftOf(context),
                        size: 20),
                    const SizedBox(width: 6),
                    Text(
                      "${(m.durationSeconds ?? 0) ~/ 60}:${((m.durationSeconds ?? 0) % 60).toString().padLeft(2, '0')}",
                      style: TextStyle(
                          color: mine ? Colors.white : GwColors.inkOf(context),
                          fontWeight: FontWeight.w700,
                          fontSize: 13),
                    ),
                  ],
                ),
              )
            : m.imagePath != null && m.imagePath!.isNotEmpty
            ? ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: CachedNetworkImage(
                  imageUrl: resolveMedia(m.imagePath, bucket: "media") ?? "",
                  fit: BoxFit.cover,
                  filterQuality: FilterQuality.medium,
                  placeholder: (_, __) => const SizedBox(
                    height: 160,
                    child: Center(
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: GwColors.primary)),
                  ),
                  errorWidget: (_, __, ___) => SizedBox(
                    height: 120,
                    child: Icon(Icons.broken_image_outlined,
                        color: GwColors.inkSoftOf(context)),
                  ),
                ),
              )
            : Text(
                m.content,
                style: TextStyle(
                  color: mine ? Colors.white : GwColors.inkOf(context),
                  fontSize: 15,
                  height: 1.3,
                ),
              ),
      ),
    );
  }

  Widget _videoBubble(Message m, bool mine) {
    return InkWell(
      onTap: () {
        final url = resolveMedia(m.filePath, bucket: "media");
        if (url == null) return;
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => VideoViewScreen(url: url, title: "Video"),
        ));
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 200,
          height: 130,
          color: Colors.black,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(Icons.movie_creation_outlined,
                  color: Colors.white.withValues(alpha: 0.25), size: 46),
              const CircleAvatar(
                radius: 22,
                backgroundColor: Colors.black45,
                child: Icon(Icons.play_arrow, color: Colors.white, size: 28),
              ),
              Positioned(
                left: 8,
                bottom: 6,
                child: Row(
                  children: [
                    Icon(Icons.videocam,
                        color: Colors.white.withValues(alpha: 0.9), size: 14),
                    const SizedBox(width: 4),
                    Text(tr(context, "Video", "ဗီဒီယို"),
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.9),
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fileBubble(Message m, bool mine) {
    final fg = mine ? Colors.white : GwColors.inkOf(context);
    return InkWell(
      onTap: () => _openFile(m),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.description,
              color: mine ? Colors.white : GwColors.primary, size: 30),
          const SizedBox(width: 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  m.fileName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      color: fg, fontWeight: FontWeight.w700, fontSize: 14),
                ),
                Text(tr(context, "Tap to open", "ဖွင့်ရန် နှိပ်ပါ"),
                    style: TextStyle(
                        color: mine
                            ? Colors.white70
                            : GwColors.inkSoftOf(context),
                        fontSize: 11.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          border: Border(top: BorderSide(color: GwColors.lineOf(context))),
        ),
        child: Row(
          children: [
            IconButton(
                icon: const Icon(Icons.add_circle_outline,
                    color: GwColors.primary),
                tooltip: tr(context, "Attach", "ပူးတွဲ"),
                onPressed: _attachSheet),
            IconButton(
              icon: _sendingVoice
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: GwColors.primary))
                  : Icon(
                      _recordingVoice ? Icons.stop_circle : Icons.mic_none,
                      color:
                          _recordingVoice ? GwColors.live : GwColors.primary),
              onPressed: _toggleVoice,
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: GwColors.surfaceMutedOf(context),
                  borderRadius: BorderRadius.circular(22),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _input,
                  minLines: 1,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    hintText: "Message...",
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                  ),
                  onSubmitted: (_) => _send(),
                ),
              ),
            ),
            IconButton(
              icon: _sending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: GwColors.primary))
                  : const Icon(Icons.send, color: GwColors.primary),
              onPressed: _send,
            ),
          ],
        ),
      ),
    );
  }
}
