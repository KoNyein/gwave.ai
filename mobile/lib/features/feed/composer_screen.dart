import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../live/go_live_screen.dart';

class ComposerScreen extends StatefulWidget {
  const ComposerScreen({super.key});

  @override
  State<ComposerScreen> createState() => _ComposerScreenState();
}

class _ComposerScreenState extends State<ComposerScreen> {
  final _text = TextEditingController();
  final _location = TextEditingController();
  bool _busy = false;
  bool _showLocation = false;
  String? _feeling; // e.g. "😊 feeling happy"

  final List<_PickedImage> _images = [];

  @override
  void dispose() {
    _text.dispose();
    _location.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 2000,
        imageQuality: 82,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final ext = file.name.contains(".")
          ? file.name.split(".").last.toLowerCase()
          : "jpg";
      setState(() => _images.add(_PickedImage(bytes, ext)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't pick a photo — $e")),
        );
      }
    }
  }

  /// Native Go-Live pre-flight; the broadcast itself hands off to the web
  /// publisher from there (no native WebRTC SDK yet).
  void _goLive() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const GoLiveScreen()),
    );
  }

  Future<void> _pickFeeling() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: GwColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(GwRadius.lg)),
      ),
      builder: (_) => const _FeelingSheet(),
    );
    if (picked != null) {
      setState(() => _feeling = picked.isEmpty ? null : picked);
    }
  }

  Future<void> _post() async {
    final typed = _text.text.trim();
    // Lead the post with the feeling line, Facebook-style, if one is set.
    final content =
        _feeling != null ? "$_feeling\n$typed".trim() : typed;
    if (content.isEmpty && _images.isEmpty) return;
    setState(() => _busy = true);
    final api = context.read<AppState>().api;
    final repo = context.read<AppState>().repo;
    try {
      final media = <PostMedia>[];
      for (final img in _images) {
        final path = await api.uploadBytes(
          img.bytes,
          ext: img.ext == "png" ? "png" : "jpg",
          contentType: img.ext == "png" ? "image/png" : "image/jpeg",
        );
        media.add(PostMedia(storagePath: path, mediaType: "image"));
      }
      await repo.createPost(
        content,
        locationName: _showLocation ? _location.text.trim() : null,
        media: media,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't post — $e")),
        );
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AppState>().me;
    return Scaffold(
      appBar: AppBar(
        title: const Text("New Post"),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 10),
            child: ElevatedButton(
              onPressed: _busy ? null : _post,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        valueColor: AlwaysStoppedAnimation(Colors.white),
                      ),
                    )
                  : const Text("Post"),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              GwAvatar(
                url: resolveMedia(me?.avatarUrl),
                name: me?.displayName ?? "Me",
                size: 44,
              ),
              const SizedBox(width: 10),
              Text(
                me?.displayName ?? "Me",
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _text,
            autofocus: true,
            maxLines: null,
            minLines: 5,
            style: const TextStyle(fontSize: 17, height: 1.4),
            decoration: const InputDecoration(
              hintText: "What's on your mind?",
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: false,
            ),
          ),
          if (_feeling != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Chip(
                  avatar: const Icon(Icons.emoji_emotions,
                      size: 16, color: GwColors.gold),
                  label: Text(_feeling!),
                  backgroundColor: GwColors.gold.withValues(alpha: 0.12),
                  side: BorderSide.none,
                  onDeleted: () => setState(() => _feeling = null),
                ),
              ],
            ),
          ],
          if (_showLocation) ...[
            const SizedBox(height: 10),
            TextField(
              controller: _location,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.place_outlined),
                hintText: "📍 Location",
              ),
            ),
          ],
          if (_images.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (var i = 0; i < _images.length; i++)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(GwRadius.sm),
                        child: Image.memory(
                          _images[i].bytes,
                          width: 100,
                          height: 100,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        top: 2,
                        right: 2,
                        child: GestureDetector(
                          onTap: () => setState(() => _images.removeAt(i)),
                          child: Container(
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            padding: const EdgeInsets.all(3),
                            child: const Icon(Icons.close,
                                color: Colors.white, size: 15),
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          const Divider(),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _chip(Icons.place_outlined, "Location", () {
                setState(() => _showLocation = !_showLocation);
              }, active: _showLocation),
              _chip(Icons.photo_outlined, "Photo", _pickImage),
              _chip(Icons.emoji_emotions_outlined, "Feeling", _pickFeeling,
                  active: _feeling != null),
              _chip(Icons.videocam_outlined, "Go Live", _goLive,
                  color: GwColors.live),
            ],
          ),
        ],
      ),
    );
  }

  Widget _chip(IconData icon, String label, VoidCallback onTap,
      {bool active = false, Color color = GwColors.primary}) {
    return ActionChip(
      avatar: Icon(icon, size: 18, color: active ? Colors.white : color),
      label: Text(label),
      labelStyle: TextStyle(
        color: active ? Colors.white : color,
        fontWeight: FontWeight.w600,
      ),
      backgroundColor: active ? color : color.withValues(alpha: 0.1),
      side: BorderSide.none,
      onPressed: onTap,
    );
  }
}

/// A bottom-sheet grid of feelings, Facebook-style. Returns the chosen line
/// (e.g. "😊 feeling happy") or an empty string to clear.
class _FeelingSheet extends StatelessWidget {
  const _FeelingSheet();

  static const _feelings = <(String, String)>[
    ("😊", "happy"),
    ("🥰", "loved"),
    ("😎", "cool"),
    ("😴", "sleepy"),
    ("😢", "sad"),
    ("😡", "angry"),
    ("🤒", "sick"),
    ("🙏", "blessed"),
    ("😌", "relaxed"),
    ("🤩", "excited"),
    ("😋", "hungry"),
    ("🌱", "grateful"),
    ("💪", "motivated"),
    ("😂", "amused"),
    ("😍", "in love"),
    ("🎉", "celebrating"),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text("How are you feeling?",
                    style:
                        TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                const Spacer(),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(""),
                  child: const Text("Clear"),
                ),
              ],
            ),
            const SizedBox(height: 6),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.95,
              children: [
                for (final f in _feelings)
                  InkWell(
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    onTap: () =>
                        Navigator.of(context).pop("${f.$1} feeling ${f.$2}"),
                    child: Container(
                      decoration: BoxDecoration(
                        color: GwColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(GwRadius.md),
                        border: Border.all(color: GwColors.line),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(f.$1, style: const TextStyle(fontSize: 26)),
                          const SizedBox(height: 4),
                          Text(f.$2,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: GwColors.inkSoft)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PickedImage {
  _PickedImage(this.bytes, this.ext);
  final Uint8List bytes;
  final String ext;
}
