import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/theme.dart';

/// Circular avatar with a Green Wave initials fallback.
///
/// [online] draws the presence dot every social surface was re-implementing
/// by hand, and [ring] draws the unseen-story style accent ring — both are
/// cheap here and stop each screen inventing its own.
class GwAvatar extends StatelessWidget {
  const GwAvatar({
    super.key,
    this.url,
    required this.name,
    this.size = 44,
    this.online = false,
    this.ring = false,
  });

  final String? url;
  final String name;
  final double size;
  final bool online;
  final bool ring;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    Widget avatar = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
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

    if (ring) {
      avatar = Container(
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: GwColors.primaryGradient,
        ),
        child: Container(
          padding: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: GwColors.surfaceOf(context),
          ),
          child: avatar,
        ),
      );
    }

    if (!online) return avatar;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        avatar,
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: size * 0.28,
            height: size * 0.28,
            decoration: BoxDecoration(
              color: const Color(0xFF31A24C),
              shape: BoxShape.circle,
              border: Border.all(color: GwColors.surfaceOf(context), width: 2),
            ),
          ),
        ),
      ],
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
  const GwPill({
    super.key,
    required this.label,
    this.color,
    this.filled = false,
    this.icon,
  });

  final String label;

  /// Defaults to the active skin's accent, so a pill follows the chosen
  /// theme instead of staying brand-green under Sky/Liberty/Tactical.
  final Color? color;
  final bool filled;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = color ?? GwColors.accentOf(context);
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
            Icon(icon, size: 14, color: filled ? Colors.white : c),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              color: filled ? Colors.white : c,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class GwEmpty extends StatelessWidget {
  const GwEmpty({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });
  final IconData icon;
  final String title;
  final String? subtitle;

  /// An empty state that only apologises is a dead end; when there is an
  /// obvious next step, pass it and the screen offers a way forward.
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final accent = GwColors.accentOf(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // A tinted disc behind the glyph reads as intentional artwork
            // rather than a lonely grey icon.
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: accent.withValues(alpha: 0.10),
              ),
              child: Icon(icon, size: 40, color: accent.withValues(alpha: 0.8)),
            ),
            const SizedBox(height: GwSpace.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16.5,
                color: GwColors.inkOf(context),
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: GwSpace.sm),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  height: 1.45,
                ),
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: GwSpace.lg),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// The standard content card.
///
/// Screens had each rebuilt `Container(decoration: BoxDecoration(color:
/// surfaceOf, borderRadius, boxShadow: GwShadow.card))` by hand, which is why
/// radii and padding never quite matched between tabs. One widget, one shape.
class GwCard extends StatelessWidget {
  const GwCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(GwSpace.md),
    this.margin,
    this.onTap,
    this.accent,
    this.raised = false,
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets? margin;
  final VoidCallback? onTap;

  /// Draws a coloured left edge — used to mark severity (alerts, quakes) or
  /// category without shouting.
  final Color? accent;
  final bool raised;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: raised ? GwShadow.raised : GwShadow.card,
        border: accent == null
            ? null
            : Border(left: BorderSide(color: accent!, width: 3)),
      ),
      child: child,
    );
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: onTap == null
          ? body
          : InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              child: body,
            ),
    );
  }
}

/// A section title with an optional trailing action — the "Title  ·  See all"
/// pattern every hub screen needs.
class GwSectionHeader extends StatelessWidget {
  const GwSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, GwSpace.lg, 8, GwSpace.sm),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: GwColors.accentOf(context)),
            const SizedBox(width: GwSpace.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    letterSpacing: -0.2,
                    color: GwColors.inkOf(context),
                  ),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: GwColors.inkSoftOf(context),
                    ),
                  ),
              ],
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

/// A compact number + label tile, for the stat strips at the top of hubs.
class GwStatTile extends StatelessWidget {
  const GwStatTile({
    super.key,
    required this.value,
    required this.label,
    this.color,
    this.icon,
  });

  final String value;
  final String label;
  final Color? color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = color ?? GwColors.accentOf(context);
    return GwCard(
      padding: const EdgeInsets.symmetric(
        horizontal: GwSpace.md,
        vertical: GwSpace.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: c),
            const SizedBox(height: GwSpace.sm),
          ],
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 20,
              color: c,
              height: 1.1,
            ),
          ),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11.5,
              color: GwColors.inkSoftOf(context),
            ),
          ),
        ],
      ),
    );
  }
}

/// A shimmering placeholder block.
///
/// Every list currently shows a centred spinner while it loads, which tells
/// the user nothing about what is coming and makes the app feel slower than
/// it is. A skeleton in the shape of the content reads as "almost there".
class GwSkeleton extends StatefulWidget {
  const GwSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = GwRadius.sm,
    this.circle = false,
  });

  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  State<GwSkeleton> createState() => _GwSkeletonState();
}

class _GwSkeletonState extends State<GwSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = GwColors.surfaceMutedOf(context);
    final highlight = GwColors.lineOf(context);
    return AnimatedBuilder(
      animation: _c,
      builder: (_, __) {
        // A band of lighter colour sweeps left→right; ±0.3 keeps a soft edge
        // at both ends of the travel instead of a hard cut.
        final t = _c.value * 2 - 1;
        return Container(
          width: widget.circle ? widget.height : widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
            borderRadius:
                widget.circle ? null : BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(t - 0.3, 0),
              end: Alignment(t + 0.3, 0),
              colors: [base, highlight, base],
            ),
          ),
        );
      },
    );
  }
}

/// A few skeleton rows shaped like a feed/list item — the standard "loading a
/// list" placeholder.
class GwSkeletonList extends StatelessWidget {
  const GwSkeletonList({super.key, this.count = 5, this.hasAvatar = true});

  final int count;
  final bool hasAvatar;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: count,
      itemBuilder: (_, __) => Padding(
        padding: const EdgeInsets.only(bottom: GwSpace.md),
        child: GwCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (hasAvatar) ...[
                const GwSkeleton(height: 44, circle: true),
                const SizedBox(width: GwSpace.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    GwSkeleton(height: 13, width: 140),
                    SizedBox(height: GwSpace.sm),
                    GwSkeleton(height: 11, width: double.infinity),
                    SizedBox(height: 6),
                    GwSkeleton(height: 11, width: 200),
                  ],
                ),
              ),
            ],
          ),
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
