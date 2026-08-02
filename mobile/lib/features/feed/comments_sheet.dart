import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'reactions.dart';

/// Bottom sheet showing a post's comments with an inline composer. Supports
/// photo comments (attach from gallery or camera) and per-comment reactions
/// (tap Like, hold for the six-emoji chooser). Opened from the post card.
class CommentsSheet extends StatefulWidget {
  const CommentsSheet({super.key, required this.postId});
  final String postId;

  static Future<int?> show(BuildContext context, String postId) {
    return showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      backgroundColor: GwColors.bgOf(context),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => CommentsSheet(postId: postId),
    );
  }

  @override
  State<CommentsSheet> createState() => _CommentsSheetState();
}

class _CommentsSheetState extends State<CommentsSheet> {
  final _input = TextEditingController();
  List<Comment> _comments = [];

  /// Comment id → my reaction type.
  Map<String, String> _myReactions = {};

  /// Local reaction-count deltas so counts stay live without a refetch.
  final Map<String, int> _countDelta = {};
  bool _loading = true;
  bool _sending = false;

  /// Photo staged in the composer, not yet sent.
  Uint8List? _photoBytes;
  String _photoExt = "jpg";

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final repo = context.read<AppState>().repo;
      final c = await repo.comments(widget.postId);
      Map<String, String> mine = {};
      try {
        mine = await repo.myCommentReactions([for (final x in c) x.id]);
      } catch (_) {}
      setState(() {
        _comments = c;
        _myReactions = mine;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        maxWidth: 2000,
        imageQuality: 82,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      final ext = file.name.contains(".")
          ? file.name.split(".").last.toLowerCase()
          : "jpg";
      setState(() {
        _photoBytes = bytes;
        _photoExt = ext == "png" ? "png" : "jpg";
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't pick a photo — $e")),
        );
      }
    }
  }

  void _choosePhotoSource() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
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
              title: Text(tr(ctx, "Choose from gallery", "ဓာတ်ပုံထဲမှ ရွေးရန်")),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickPhoto(ImageSource.gallery);
              },
            ),
            ListTile(
              leading:
                  const Icon(Icons.photo_camera_outlined, color: GwColors.primary),
              title: Text(tr(ctx, "Take a photo", "ဓာတ်ပုံရိုက်ရန်")),
              onTap: () {
                Navigator.of(ctx).pop();
                _pickPhoto(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    final photo = _photoBytes;
    if ((text.isEmpty && photo == null) || _sending) return;
    setState(() => _sending = true);
    final state = context.read<AppState>();
    try {
      String? imagePath;
      if (photo != null) {
        imagePath = await state.api.uploadBytes(
          photo,
          ext: _photoExt,
          contentType: _photoExt == "png" ? "image/png" : "image/jpeg",
        );
      }
      final c = await state.repo
          .addComment(widget.postId, text, imagePath: imagePath);
      if (c != null) {
        _input.clear();
        setState(() {
          _comments = [..._comments, c];
          _photoBytes = null;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't post comment — $e")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  int _countOf(Comment c) => c.reactionCount + (_countDelta[c.id] ?? 0);

  /// Apply [next] (null = remove) as my reaction on comment [c].
  Future<void> _reactToComment(Comment c, String? next) async {
    final prev = _myReactions[c.id];
    if (next == prev) next = null; // re-pick clears
    setState(() {
      if (next == null) {
        _myReactions.remove(c.id);
        if (prev != null) _countDelta[c.id] = (_countDelta[c.id] ?? 0) - 1;
      } else {
        _myReactions[c.id] = next;
        if (prev == null) _countDelta[c.id] = (_countDelta[c.id] ?? 0) + 1;
      }
    });
    final repo = context.read<AppState>().repo;
    try {
      if (next == null) {
        await repo.removeCommentReaction(c.id);
      } else {
        await repo.setCommentReaction(c.id, next);
      }
    } catch (_) {
      // Revert on failure.
      setState(() {
        if (prev == null) {
          _myReactions.remove(c.id);
          if (next != null) _countDelta[c.id] = (_countDelta[c.id] ?? 0) - 1;
        } else {
          _myReactions[c.id] = prev;
          if (next == null) _countDelta[c.id] = (_countDelta[c.id] ?? 0) + 1;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: GwColors.lineOf(context),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 8),
              const Text("Comments",
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const Divider(),
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(color: GwColors.primary))
                    : _comments.isEmpty
                        ? const GwEmpty(
                            icon: Icons.mode_comment_outlined,
                            title: "No comments yet",
                            subtitle: "Be the first to comment")
                        : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            itemCount: _comments.length,
                            itemBuilder: (_, i) => _row(_comments[i]),
                          ),
              ),
              _composer(),
            ],
          );
        },
      ),
    );
  }

  Widget _row(Comment c) {
    final name = c.author?.displayName ?? "Gwave user";
    final mine = gwReactionOf(_myReactions[c.id]);
    final count = _countOf(c);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GwAvatar(url: resolveMedia(c.author?.avatarUrl), name: name, size: 36),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: GwColors.surfaceOf(context),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: GwColors.lineOf(context)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(name,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 13)),
                          const SizedBox(width: 6),
                          Text(timeAgo(c.createdAt),
                              style: TextStyle(
                                  color: GwColors.inkSoftOf(context), fontSize: 11)),
                        ],
                      ),
                      if (c.content.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(c.content,
                            style: const TextStyle(fontSize: 14, height: 1.3)),
                      ],
                      if (c.imagePath != null) ...[
                        const SizedBox(height: 6),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: CachedNetworkImage(
                            imageUrl:
                                resolveMedia(c.imagePath, bucket: "media")!,
                            fit: BoxFit.cover,
                            width: double.infinity,
                            placeholder: (_, __) => Container(
                              height: 140,
                              color: GwColors.surfaceMutedOf(context),
                            ),
                            errorWidget: (_, __, ___) =>
                                const SizedBox.shrink(),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                // Reaction row: tap Like toggles, hold opens the chooser.
                Padding(
                  padding: const EdgeInsets.only(left: 10, top: 3),
                  child: Row(
                    children: [
                      InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: () =>
                            _reactToComment(c, mine == null ? "like" : null),
                        onLongPress: () async {
                          final type = await showGwReactionPicker(context,
                              current: _myReactions[c.id]);
                          if (type != null) await _reactToComment(c, type);
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 4, vertical: 2),
                          child: Text(
                            mine != null
                                ? "${mine.emoji} ${mine.label}"
                                : "Like",
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: mine?.color ?? GwColors.inkSoftOf(context),
                            ),
                          ),
                        ),
                      ),
                      if (count > 0) ...[
                        const SizedBox(width: 8),
                        Text("👍 $count",
                            style: TextStyle(
                                color: GwColors.inkSoftOf(context), fontSize: 12)),
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

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          border: Border(top: BorderSide(color: GwColors.lineOf(context))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_photoBytes != null)
              Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.memory(
                          _photoBytes!,
                          height: 84,
                          width: 84,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        top: -8,
                        right: -8,
                        child: InkWell(
                          onTap: () => setState(() => _photoBytes = null),
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: BoxDecoration(
                              color: GwColors.inkOf(context),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close,
                                size: 13, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            Row(
              children: [
                IconButton(
                  onPressed: _choosePhotoSource,
                  icon: const Icon(Icons.add_photo_alternate_outlined,
                      color: GwColors.primary),
                  tooltip: "Photo",
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
                        hintText: "Write a comment...",
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
          ],
        ),
      ),
    );
  }
}
