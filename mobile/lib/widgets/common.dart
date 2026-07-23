import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Circular avatar with a Green Wave initials fallback.
class GwAvatar extends StatelessWidget {
  const GwAvatar({super.key, this.url, required this.name, this.size = 44});

  final String? url;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: GwColors.primaryGradient,
      ),
      clipBehavior: Clip.antiAlias,
      child: url != null && url!.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: url!,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => _initialsChild(initials),
              placeholder: (_, __) => _initialsChild(initials),
            )
          : _initialsChild(initials),
    );
  }

  Widget _initialsChild(String initials) => Center(
        child: Text(
          initials,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: size * 0.36,
          ),
        ),
      );

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r"\s+"));
    if (parts.isEmpty || parts.first.isEmpty) return "G";
    if (parts.length == 1) return parts.first.characters.first.toUpperCase();
    return (parts.first.characters.first + parts.last.characters.first)
        .toUpperCase();
  }
}

/// A pill/chip used across the app (categories, tags, LIVE badge).
class GwPill extends StatelessWidget {
  // Deliberately not `const`: this widget resolves theme-aware GwColors in
  // `build`, and a `const GwPill(...)` call site would be canonicalised, so
  // `Element.updateChild` would skip its rebuild and it would keep painting
  // the old palette after a theme switch.
  // ignore: prefer_const_constructors_in_immutables
  GwPill({
    super.key,
    required this.label,
    // Nullable rather than defaulted: GwColors tokens are theme-aware getters
    // and so cannot be const default values.
    this.color,
    this.filled = false,
    this.icon,
  });

  final String label;
  final Color? color;
  final bool filled;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = color ?? GwColors.primary;
    // A filled pill paints on the brand green, which is bright in dark mode —
    // `onPrimary` flips to near-black there so the label stays readable.
    final on = c == GwColors.primary ? GwColors.onPrimary : Colors.white;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: filled ? c : c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: filled ? on : c),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              color: filled ? on : c,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class GwEmpty extends StatelessWidget {
  const GwEmpty({super.key, required this.icon, required this.title, this.subtitle});
  final IconData icon;
  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: GwColors.primary.withValues(alpha: 0.4)),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: TextStyle(color: GwColors.inkSoft),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Compact relative time — "5m", "3h", "2d", or a date.
String timeAgo(DateTime t) {
  final d = DateTime.now().difference(t);
  if (d.inMinutes < 1) return "now";
  if (d.inMinutes < 60) return "${d.inMinutes}m";
  if (d.inHours < 24) return "${d.inHours}h";
  if (d.inDays < 7) return "${d.inDays}d";
  return "${t.day}/${t.month}/${t.year % 100}";
}

/// Format an amount with thousands separators + currency.
String money(double? amount, String currency) {
  if (amount == null) return "";
  final whole = amount.round().toString();
  final buf = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buf.write(",");
    buf.write(whole[i]);
  }
  return "$buf $currency";
}
