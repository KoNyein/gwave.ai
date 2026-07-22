import 'package:flutter/material.dart';

import '../../core/theme.dart';

/// The six reaction types, mirroring the web's REACTIONS map and the DB's
/// reaction_type enum — the native buttons must send exactly these values.
class GwReaction {
  const GwReaction(this.type, this.emoji, this.label, this.color);
  final String type;
  final String emoji;
  final String label;
  final Color color;
}

const List<GwReaction> kGwReactions = [
  GwReaction("like", "👍", "Like", GwColors.primary),
  GwReaction("love", "❤️", "Love", Color(0xFFEF4444)),
  GwReaction("haha", "😆", "Haha", Color(0xFFF59E0B)),
  GwReaction("wow", "😮", "Wow", Color(0xFFF59E0B)),
  GwReaction("sad", "😢", "Sad", Color(0xFFF59E0B)),
  GwReaction("angry", "😡", "Angry", Color(0xFFEA580C)),
];

GwReaction? gwReactionOf(String? type) {
  if (type == null) return null;
  for (final r in kGwReactions) {
    if (r.type == type) return r;
  }
  return null;
}

/// Facebook-style reaction chooser: a floating pill of the six emoji. Resolves
/// with the chosen type, or null when dismissed. The caller decides whether a
/// re-pick of [current] means "remove".
Future<String?> showGwReactionPicker(
  BuildContext context, {
  String? current,
}) {
  return showDialog<String>(
    context: context,
    barrierColor: Colors.black26,
    builder: (ctx) => Dialog(
      backgroundColor: GwColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final r in kGwReactions)
                InkWell(
                  borderRadius: BorderRadius.circular(24),
                  onTap: () => Navigator.of(ctx).pop(r.type),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: r.type == current
                        ? BoxDecoration(
                            color: GwColors.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(24),
                          )
                        : null,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(r.emoji, style: const TextStyle(fontSize: 30)),
                        const SizedBox(height: 2),
                        Text(
                          r.label,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: r.type == current
                                ? r.color
                                : GwColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}
