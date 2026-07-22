import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:video_player/video_player.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Comments on a knowledge entry — a strain or a mineral. Supports text plus a
/// photo, a voice note or a video, so farmers can share experience on a variety
/// or a fertiliser right on its detail page. Reads/writes go through the mobile
/// API (service role) via [ApiClient.subjectComments] / subjectCommentCreate.
class SubjectCommentsSheet extends StatefulWidget {
  const SubjectCommentsSheet({
    super.key,
    required this.subjectType,
    required this.subjectId,
    required this.title,
  });

  final String subjectType; // 'strain' | 'mineral'
  final String subjectId;
  final String title;

  static Future<void> show(
    BuildContext context, {
    required String subjectType,
    required String subjectId,
    required String title,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: GwColors.bg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SubjectCommentsSheet(
        subjectType: subjectType,
        subjectId: subjectId,
        title: title,
      ),
    );
  }

  @override
  State<SubjectCommentsSheet> createState() => _SubjectCommentsSheetState();
}

class _SubjectCommentsSheetState extends State<SubjectCommentsSheet> {
  final _input = TextEditingController();
  final _recorder = AudioRecorder();

  List<Map<String, dynamic>> _comments = [];
  bool _loading = true;
  bool _sending = false;
  String? _error;

  // Staged attachment (only one per comment), not yet uploaded.
  Uint8List? _mediaBytes;
  String? _mediaType; // image | audio | video
  String _mediaExt = "jpg";
  String _mediaContentType = "image/jpeg";

  // Audio recording state.
  bool _recording = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    _recorder.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await context
          .read<AppState>()
          .api
          .subjectComments(widget.subjectType, widget.subjectId);
      if (mounted) {
        setState(() {
          _comments = rows;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  void _clearAttachment() => setState(() {
        _mediaBytes = null;
        _mediaType = null;
      });

  Future<void> _pickImage(ImageSource source) async {
    try {
      final file = await ImagePicker()
          .pickImage(source: source, maxWidth: 2000, imageQuality: 82);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final png = file.name.toLowerCase().endsWith(".png");
      setState(() {
        _mediaBytes = bytes;
        _mediaType = "image";
        _mediaExt = png ? "png" : "jpg";
        _mediaContentType = png ? "image/png" : "image/jpeg";
      });
    } catch (e) {
      _toast("Couldn't pick a photo — $e");
    }
  }

  Future<void> _pickVideo(ImageSource source) async {
    try {
      final file = await ImagePicker().pickVideo(
        source: source,
        maxDuration: const Duration(minutes: 2),
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() {
        _mediaBytes = bytes;
        _mediaType = "video";
        _mediaExt = "mp4";
        _mediaContentType = "video/mp4";
      });
    } catch (e) {
      _toast("Couldn't pick a video — $e");
    }
  }

  Future<void> _toggleRecording() async {
    if (_recording) {
      String? path;
      try {
        path = await _recorder.stop();
      } catch (_) {}
      setState(() => _recording = false);
      if (path == null) return;
      try {
        final bytes = await XFile(path).readAsBytes();
        setState(() {
          _mediaBytes = bytes;
          _mediaType = "audio";
          _mediaExt = "m4a";
          _mediaContentType = "audio/mp4";
        });
      } catch (e) {
        _toast("Couldn't read the recording — $e");
      }
      return;
    }
    // Start recording.
    try {
      if (!await _recorder.hasPermission()) {
        _toast(tr(context, "Microphone permission is required.",
            "မိုက်ခရိုဖုန်း ခွင့်ပြုချက် လိုအပ်ပါသည်။"));
        return;
      }
      final dir = await getTemporaryDirectory();
      final path =
          "${dir.path}/cmt_${DateTime.now().millisecondsSinceEpoch}.m4a";
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 44100,
          numChannels: 1,
        ),
        path: path,
      );
      setState(() => _recording = true);
    } catch (e) {
      _toast("Couldn't start recording — $e");
    }
  }

  void _chooseAttachment() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: GwColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "Photo from gallery", "ဓာတ်ပုံ ရွေးရန်")),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "Take a photo", "ဓာတ်ပုံရိုက်ရန်")),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.video_library_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "Video from gallery", "ဗီဒီယို ရွေးရန်")),
              onTap: () {
                Navigator.pop(ctx);
                _pickVideo(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.videocam_outlined,
                  color: GwColors.primary),
              title: Text(tr(ctx, "Record a video", "ဗီဒီယို ရိုက်ရန်")),
              onTap: () {
                Navigator.pop(ctx);
                _pickVideo(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    final media = _mediaBytes;
    if ((text.isEmpty && media == null) || _sending) return;
    setState(() => _sending = true);
    final api = context.read<AppState>().api;
    try {
      String? mediaPath;
      if (media != null) {
        mediaPath = await api.uploadBytes(
          media,
          ext: _mediaExt,
          contentType: _mediaContentType,
        );
      }
      final row = await api.subjectCommentCreate(
        type: widget.subjectType,
        id: widget.subjectId,
        content: text,
        mediaPath: mediaPath,
        mediaType: media != null ? _mediaType : null,
      );
      if (mounted) {
        _input.clear();
        setState(() {
          _comments = [..._comments, row];
          _mediaBytes = null;
          _mediaType = null;
        });
      }
    } catch (e) {
      _toast("Couldn't post the comment — $e");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _toast(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.75,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 42,
                height: 5,
                decoration: BoxDecoration(
                  color: GwColors.line,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                child: Row(
                  children: [
                    const Icon(Icons.forum_outlined,
                        color: GwColors.primary, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        "${tr(context, "Comments", "မှတ်ချက်များ")} · ${widget.title}",
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(child: _list(scrollController)),
              _composer(),
            ],
          );
        },
      ),
    );
  }

  Widget _list(ScrollController controller) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: GwColors.primary));
    }
    if (_error != null && _comments.isEmpty) {
      return ListView(controller: controller, children: [
        const SizedBox(height: 60),
        GwEmpty(
            icon: Icons.cloud_off,
            title: tr(context, "Couldn't load comments", "မှတ်ချက်များ မဖွင့်နိုင်ပါ"),
            subtitle: _error),
      ]);
    }
    if (_comments.isEmpty) {
      return ListView(controller: controller, children: [
        const SizedBox(height: 70),
        GwEmpty(
          icon: Icons.chat_bubble_outline,
          title: tr(context, "No comments yet", "မှတ်ချက် မရှိသေးပါ"),
          subtitle: tr(context, "Be the first to share your experience.",
              "သင့်အတွေ့အကြုံကို ပထမဆုံး မျှဝေလိုက်ပါ။"),
        ),
      ]);
    }
    return ListView.builder(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      itemCount: _comments.length,
      itemBuilder: (_, i) => _commentTile(_comments[i]),
    );
  }

  Widget _commentTile(Map<String, dynamic> c) {
    final author = c["author"] is Map ? c["author"] as Map : const {};
    final name = (author["full_name"] ?? author["username"] ?? "Gwave user")
        .toString();
    final avatar = resolveMedia(author["avatar_url"]?.toString());
    final content = (c["content"] ?? "").toString();
    final mediaPath = c["media_path"]?.toString();
    final mediaType = c["media_type"]?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GwAvatar(url: avatar, name: name, size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: GwColors.surface,
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    boxShadow: GwShadow.card,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 13)),
                      if (content.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(content,
                            style: const TextStyle(fontSize: 14, height: 1.35)),
                      ],
                      if (mediaPath != null && mediaType != null) ...[
                        const SizedBox(height: 8),
                        _media(mediaType, resolveMedia(mediaPath, bucket: "media")!),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _media(String type, String url) {
    switch (type) {
      case "image":
        return ClipRRect(
          borderRadius: BorderRadius.circular(GwRadius.sm),
          child: CachedNetworkImage(
            imageUrl: url,
            fit: BoxFit.cover,
            width: double.infinity,
            placeholder: (_, __) => Container(
              height: 160,
              color: GwColors.surfaceMuted,
              child: const Center(
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: GwColors.primary)),
            ),
            errorWidget: (_, __, ___) => Container(
              height: 120,
              color: GwColors.surfaceMuted,
              child: const Icon(Icons.broken_image_outlined,
                  color: GwColors.inkSoft),
            ),
          ),
        );
      case "audio":
        return _AudioBubble(url: url);
      case "video":
        return _VideoBubble(url: url);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
        decoration: const BoxDecoration(
          color: GwColors.surface,
          border: Border(top: BorderSide(color: GwColors.line)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_mediaBytes != null) _attachmentPreview(),
            if (_recording) _recordingBar(),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                IconButton(
                  onPressed: _sending ? null : _chooseAttachment,
                  icon: const Icon(Icons.add_photo_alternate_outlined,
                      color: GwColors.primary),
                  tooltip: tr(context, "Attach", "ပူးတွဲရန်"),
                ),
                IconButton(
                  onPressed: _sending ? null : _toggleRecording,
                  icon: Icon(_recording ? Icons.stop_circle : Icons.mic_none,
                      color: _recording ? GwColors.live : GwColors.primary),
                  tooltip: tr(context, "Voice note", "အသံမှတ်ချက်"),
                ),
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 4,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText:
                          tr(context, "Write a comment…", "မှတ်ချက် ရေးရန်…"),
                      filled: true,
                      fillColor: GwColors.surfaceMuted,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(22),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 4),
                _sending
                    ? const Padding(
                        padding: EdgeInsets.all(10),
                        child: SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.4, color: GwColors.primary),
                        ),
                      )
                    : IconButton(
                        onPressed: _send,
                        icon: const Icon(Icons.send, color: GwColors.primary),
                      ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _attachmentPreview() {
    IconData icon;
    String label;
    switch (_mediaType) {
      case "video":
        icon = Icons.videocam;
        label = tr(context, "Video attached", "ဗီဒီယို ပူးတွဲပြီး");
        break;
      case "audio":
        icon = Icons.mic;
        label = tr(context, "Voice note ready", "အသံမှတ်ချက် အသင့်");
        break;
      default:
        icon = Icons.image;
        label = tr(context, "Photo attached", "ဓာတ်ပုံ ပူးတွဲပြီး");
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: GwColors.primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(GwRadius.sm),
      ),
      child: Row(
        children: [
          Icon(icon, color: GwColors.primary, size: 20),
          const SizedBox(width: 8),
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      color: GwColors.primary, fontWeight: FontWeight.w600))),
          if (_mediaType == "image")
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.memory(_mediaBytes!,
                  width: 34, height: 34, fit: BoxFit.cover),
            ),
          IconButton(
            onPressed: _clearAttachment,
            icon: const Icon(Icons.close, size: 18, color: GwColors.inkSoft),
          ),
        ],
      ),
    );
  }

  Widget _recordingBar() {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: GwColors.live.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(GwRadius.sm),
      ),
      child: Row(
        children: [
          const Icon(Icons.fiber_manual_record, color: GwColors.live, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tr(context, "Recording… tap ⏹ to stop", "အသံဖမ်းနေသည်… ရပ်ရန် ⏹ နှိပ်ပါ"),
              style: const TextStyle(
                  color: GwColors.live, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// An inline voice-note player (play / pause) for an audio comment.
class _AudioBubble extends StatefulWidget {
  const _AudioBubble({required this.url});
  final String url;

  @override
  State<_AudioBubble> createState() => _AudioBubbleState();
}

class _AudioBubbleState extends State<_AudioBubble> {
  final _player = AudioPlayer();
  bool _playing = false;

  @override
  void initState() {
    super.initState();
    _player.onPlayerComplete.listen((_) {
      if (mounted) setState(() => _playing = false);
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    try {
      if (_playing) {
        await _player.pause();
        setState(() => _playing = false);
      } else {
        await _player.play(UrlSource(widget.url));
        setState(() => _playing = true);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _toggle,
      borderRadius: BorderRadius.circular(30),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: GwColors.primary.withValues(alpha: 0.09),
          borderRadius: BorderRadius.circular(30),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_playing ? Icons.pause_circle : Icons.play_circle,
                color: GwColors.primary, size: 26),
            const SizedBox(width: 8),
            Text(tr(context, "Voice note", "အသံမှတ်ချက်"),
                style: const TextStyle(
                    color: GwColors.primary, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

/// A tappable video thumbnail that opens a full-screen player.
class _VideoBubble extends StatelessWidget {
  const _VideoBubble({required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.sm),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => _VideoPage(url: url)),
      ),
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: GwColors.ink,
          borderRadius: BorderRadius.circular(GwRadius.sm),
        ),
        child: const Center(
          child: Icon(Icons.play_circle_fill, color: Colors.white, size: 46),
        ),
      ),
    );
  }
}

class _VideoPage extends StatefulWidget {
  const _VideoPage({required this.url});
  final String url;

  @override
  State<_VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends State<_VideoPage> {
  late final VideoPlayerController _controller;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        if (mounted) {
          setState(() => _ready = true);
          _controller.play();
        }
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: _ready
            ? AspectRatio(
                aspectRatio: _controller.value.aspectRatio == 0
                    ? 16 / 9
                    : _controller.value.aspectRatio,
                child: VideoPlayer(_controller),
              )
            : const CircularProgressIndicator(color: Colors.white),
      ),
      floatingActionButton: _ready
          ? FloatingActionButton(
              backgroundColor: GwColors.primary,
              onPressed: () => setState(() {
                _controller.value.isPlaying
                    ? _controller.pause()
                    : _controller.play();
              }),
              child: Icon(
                  _controller.value.isPlaying ? Icons.pause : Icons.play_arrow),
            )
          : null,
    );
  }
}
