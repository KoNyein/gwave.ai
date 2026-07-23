import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/call_service.dart';
import '../../core/config.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../create/upload_flow.dart';

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
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
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
              child: Text(widget.conversation.displayTitle,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
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
          color: mine ? GwColors.primary : GwColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(18),
            topRight: const Radius.circular(18),
            bottomLeft: Radius.circular(mine ? 18 : 4),
            bottomRight: Radius.circular(mine ? 4 : 18),
          ),
          border: mine ? null : Border.all(color: GwColors.line),
        ),
        child: m.imagePath != null && m.imagePath!.isNotEmpty
            ? ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: CachedNetworkImage(
                  imageUrl: resolveMedia(m.imagePath, bucket: "media") ?? "",
                  fit: BoxFit.cover,
                  placeholder: (_, __) => const SizedBox(
                    height: 160,
                    child: Center(
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: GwColors.primary)),
                  ),
                  errorWidget: (_, __, ___) => const SizedBox(
                    height: 120,
                    child: Icon(Icons.broken_image_outlined,
                        color: GwColors.inkSoft),
                  ),
                ),
              )
            : Text(
                m.content,
                style: TextStyle(
                  color: mine ? Colors.white : GwColors.ink,
                  fontSize: 15,
                  height: 1.3,
                ),
              ),
      ),
    );
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        decoration: const BoxDecoration(
          color: GwColors.surface,
          border: Border(top: BorderSide(color: GwColors.line)),
        ),
        child: Row(
          children: [
            IconButton(
                icon: const Icon(Icons.add_photo_alternate_outlined,
                    color: GwColors.primary),
                onPressed: _sendPhoto),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: GwColors.surfaceMuted,
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
