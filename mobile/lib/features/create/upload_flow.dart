import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';

/// Shared media-create helpers: pick from the gallery, upload to the media
/// bucket through the app's upload proxy while a blocking spinner shows, and
/// return the stored path (or null on cancel/failure).

class UploadedMedia {
  UploadedMedia(this.path, this.mediaType);
  final String path;
  final String mediaType; // image | video
}

Future<UploadedMedia?> pickAndUploadVideo(BuildContext context) async {
  final picker = ImagePicker();
  final file = await picker.pickVideo(
    source: ImageSource.gallery,
    maxDuration: const Duration(minutes: 3),
  );
  if (file == null || !context.mounted) return null;
  final path = await _uploadWithSpinner(
    context,
    file,
    fallbackExt: "mp4",
    contentType: "video/mp4",
  );
  return path == null ? null : UploadedMedia(path, "video");
}

Future<UploadedMedia?> pickAndUploadImage(BuildContext context) async {
  final picker = ImagePicker();
  final file = await picker.pickImage(
    source: ImageSource.gallery,
    maxWidth: 2000,
    imageQuality: 82,
  );
  if (file == null || !context.mounted) return null;
  final isPng = file.name.toLowerCase().endsWith(".png");
  final path = await _uploadWithSpinner(
    context,
    file,
    fallbackExt: isPng ? "png" : "jpg",
    contentType: isPng ? "image/png" : "image/jpeg",
  );
  return path == null ? null : UploadedMedia(path, "image");
}

Future<String?> _uploadWithSpinner(
  BuildContext context,
  XFile file, {
  required String fallbackExt,
  required String contentType,
}) async {
  final api = context.read<AppState>().api;
  showDialog(
    context: context,
    barrierDismissible: false,
    builder: (_) => const Center(
      child: CircularProgressIndicator(color: GwColors.primary),
    ),
  );
  try {
    final bytes = await file.readAsBytes();
    final ext = file.name.contains(".")
        ? file.name.split(".").last.toLowerCase()
        : fallbackExt;
    final path = await api.uploadBytes(
      bytes,
      ext: ext,
      contentType: contentType,
    );
    return path;
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Upload failed — $e")),
      );
    }
    return null;
  } finally {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
  }
}

/// Small caption input dialog; returns the text (possibly empty) or null on cancel.
Future<String?> askCaption(BuildContext context, {String title = "Caption"}) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 200,
        maxLines: 3,
        minLines: 1,
        decoration: const InputDecoration(hintText: "Write a caption (optional)"),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text("Cancel"),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(ctx).pop(controller.text),
          child: const Text("Post"),
        ),
      ],
    ),
  );
}
