import 'dart:async';
import 'dart:math';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import 'audio_models.dart';
import 'audio_service.dart';
import 'audio_track_screen.dart';

/// The floating player: a small draggable bubble that stays out of the way and
/// opens into controls only when asked.
///
/// The first version was a full-width bar pinned above the bottom navigation.
/// It worked, but it took a permanent 48dp strip off every screen and sat
/// across the bottom of whatever the user was actually looking at — a status
/// line for one feature, charged to all of them.
///
/// A bubble costs nothing when ignored. It floats over the content instead of
/// pushing it, it can be dragged anywhere on the screen, and it shows a title
/// and transport only for as long as someone is using it. What is playing is
/// still one tap away, and stopping is a drag onto the ✕ — the gesture people
/// already know from every chat head they have ever had on this phone.
class GwFloatingPlayer extends StatefulWidget {
  const GwFloatingPlayer({super.key, this.visible = true});

  /// False on immersive surfaces — the Reels tab is edge-to-edge video and
  /// even a bubble is chrome there. Playback carries on; only the bubble goes.
  final bool visible;

  @override
  State<GwFloatingPlayer> createState() => _GwFloatingPlayerState();
}

class _GwFloatingPlayerState extends State<GwFloatingPlayer> {
  static const double _bubble = 54;
  static const double _height = 54;
  static const double _maxPill = 300;

  /// How long the expanded form stays up with nobody touching it. Long enough
  /// to read a title and hit pause, short enough that it is gone before it
  /// becomes furniture.
  static const Duration _idle = Duration(seconds: 4);

  /// Where the user last parked it, kept across tab switches and rebuilds.
  static Offset? _parked;

  final _audio = GwAudio.instance;

  Offset? _pos;
  bool _expanded = false;
  bool _dragging = false;
  bool _overClose = false;
  Timer? _collapse;
  String? _lastTrackId;

  @override
  void initState() {
    super.initState();
    _audio.addListener(_onAudio);
    _lastTrackId = _audio.current?.id;
  }

  @override
  void dispose() {
    _collapse?.cancel();
    _audio.removeListener(_onAudio);
    super.dispose();
  }

  void _onAudio() {
    if (!mounted) return;
    final id = _audio.current?.id;
    // A new track is the one moment the bubble should speak up unasked: the
    // song changed and the natural question is "what is this now?".
    if (id != null && id != _lastTrackId) {
      _lastTrackId = id;
      _open();
    } else {
      _lastTrackId = id;
      setState(() {});
    }
  }

  void _open() {
    setState(() => _expanded = true);
    _collapse?.cancel();
    _collapse = Timer(_idle, () {
      if (mounted) setState(() => _expanded = false);
    });
  }

  /// Any touch on the expanded form buys it more time — a user reaching for
  /// Next should not have it vanish mid-reach.
  void _keepOpen() {
    if (_expanded) _open();
  }

  void _openFullPlayer() {
    final track = _audio.current;
    if (track == null) return;
    _collapse?.cancel();
    setState(() => _expanded = false);
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AudioTrackScreen(
          track: track,
          queue: _audio.queue.isEmpty ? null : _audio.queue,
          startIndex: _audio.index,
        ),
      ),
    );
  }

  // ── Geometry ─────────────────────────────────────────────────────────────

  double _pillWidth(Size screen) => min(_maxPill, screen.width - 24);

  Rect _bounds(Size screen, EdgeInsets pad, double width) {
    return Rect.fromLTRB(
      8,
      pad.top + 8,
      screen.width - width - 8,
      // Clear of the bottom navigation, which is the one place a bubble would
      // sit on top of controls the user needs constantly.
      screen.height - _height - pad.bottom - 76,
    );
  }

  Offset _resolve(Size screen, EdgeInsets pad, double width) {
    final b = _bounds(screen, pad, width);
    final start = _pos ?? _parked ?? Offset(b.right, b.bottom);
    return Offset(
      start.dx.clamp(b.left, max(b.left, b.right)),
      start.dy.clamp(b.top, max(b.top, b.bottom)),
    );
  }

  Offset _closeCentre(Size screen, EdgeInsets pad) =>
      Offset(screen.width / 2, screen.height - pad.bottom - 116);

  // ── Drag ─────────────────────────────────────────────────────────────────

  void _onPanStart(Size screen, EdgeInsets pad, double width) {
    _collapse?.cancel();
    setState(() {
      _pos = _resolve(screen, pad, width);
      _dragging = true;
      _expanded = false;
    });
  }

  void _onPanUpdate(DragUpdateDetails d, Size screen, EdgeInsets pad) {
    final b = _bounds(screen, pad, _bubble);
    final next = (_pos ?? Offset(b.right, b.bottom)) + d.delta;
    final centre = next + const Offset(_bubble / 2, _bubble / 2);
    setState(() {
      _pos = next;
      _overClose = (centre - _closeCentre(screen, pad)).distance < 76;
    });
  }

  Future<void> _onPanEnd(Size screen, EdgeInsets pad) async {
    final wasOverClose = _overClose;
    setState(() {
      _dragging = false;
      _overClose = false;
    });
    if (wasOverClose) {
      // Dropped on the ✕. This is the one gesture in the app that ends
      // playback outright, so it takes a deliberate drag to reach.
      _pos = null;
      _parked = null;
      await _audio.stop();
      return;
    }
    // Snap to whichever side it is nearest, so it never sits marooned in the
    // middle of what the user is reading.
    final b = _bounds(screen, pad, _bubble);
    final p = _resolve(screen, pad, _bubble);
    final snapped = Offset(
      (p.dx + _bubble / 2) < screen.width / 2 ? b.left : b.right,
      p.dy.clamp(b.top, max(b.top, b.bottom)),
    );
    setState(() {
      _pos = snapped;
      _parked = snapped;
    });
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (!widget.visible) return const SizedBox.shrink();
    final track = _audio.current;
    if (track == null) return const SizedBox.shrink();

    final media = MediaQuery.of(context);
    final screen = media.size;
    final pad = media.padding;
    final width = _expanded ? _pillWidth(screen) : _bubble;
    final pos = _resolve(screen, pad, width);

    return Positioned.fill(
      child: Stack(
        children: [
          if (_dragging) _closeTarget(screen, pad),
          AnimatedPositioned(
            duration: _dragging
                ? Duration.zero
                : const Duration(milliseconds: 220),
            curve: Curves.easeOutCubic,
            left: pos.dx,
            top: pos.dy,
            child: GestureDetector(
              onPanStart: (_) => _onPanStart(screen, pad, width),
              onPanUpdate: (d) => _onPanUpdate(d, screen, pad),
              onPanEnd: (_) => _onPanEnd(screen, pad),
              onLongPress: _openFullPlayer,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOutCubic,
                width: width,
                height: _height,
                decoration: BoxDecoration(
                  color: GwColors.surfaceOf(context),
                  borderRadius: BorderRadius.circular(_height / 2),
                  border: Border.all(color: GwColors.lineOf(context)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.22),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(_height / 2),
                  child: _expanded
                      ? _pill(context, track)
                      : _collapsed(context, track),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Collapsed: artwork, a progress ring, and a play state you can read at a
  /// glance without touching anything.
  Widget _collapsed(BuildContext context, AudioTrack track) {
    return GestureDetector(
      onTap: _open,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Padding(
            padding: const EdgeInsets.all(4),
            child: ClipOval(child: _art(track, 46)),
          ),
          // A dark scrim so the little play glyph reads over any cover.
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.28),
            ),
          ),
          Icon(
            _audio.playing ? Icons.graphic_eq : Icons.play_arrow,
            color: Colors.white,
            size: 20,
          ),
          Positioned.fill(
            child: CircularProgressIndicator(
              value: _progress,
              strokeWidth: 2.5,
              backgroundColor: Colors.white.withValues(alpha: 0.18),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(GwColors.primaryBright),
            ),
          ),
        ],
      ),
    );
  }

  /// Expanded: what is playing, and the three controls worth reaching for
  /// without opening the full screen.
  Widget _pill(BuildContext context, AudioTrack track) {
    return Row(
      children: [
        const SizedBox(width: 4),
        GestureDetector(
          onTap: _openFullPlayer,
          child: Padding(
            padding: const EdgeInsets.all(4),
            child: ClipOval(child: _art(track, 44)),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: GestureDetector(
            onTap: _openFullPlayer,
            behavior: HitTestBehavior.opaque,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  track.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12.5,
                    color: GwColors.inkOf(context),
                  ),
                ),
                Text(
                  GwAudio.bylineOf(track),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10.5,
                    color: GwColors.inkSoftOf(context),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_audio.hasQueue)
          _tap(
            icon: Icons.skip_previous,
            size: 20,
            color: GwColors.inkOf(context),
            tooltip: tr(context, "Previous", "ရှေ့တစ်ပုဒ်"),
            onTap: () {
              _keepOpen();
              _audio.previous();
            },
          ),
        _tap(
          icon: _audio.playing ? Icons.pause : Icons.play_arrow,
          size: 26,
          color: GwColors.primary,
          tooltip: _audio.playing
              ? tr(context, "Pause", "ခဏရပ်")
              : tr(context, "Play", "ဖွင့်"),
          onTap: () {
            _keepOpen();
            _audio.toggle();
          },
        ),
        if (_audio.hasQueue)
          _tap(
            icon: Icons.skip_next,
            size: 20,
            color: GwColors.inkOf(context),
            tooltip: tr(context, "Next", "နောက်တစ်ပုဒ်"),
            onTap: () {
              _keepOpen();
              _audio.next();
            },
          ),
        _tap(
          icon: Icons.close,
          size: 16,
          color: GwColors.inkSoftOf(context),
          tooltip: tr(context, "Stop", "ရပ်"),
          onTap: () {
            _collapse?.cancel();
            _audio.stop();
          },
        ),
        const SizedBox(width: 2),
      ],
    );
  }

  /// The drop target, shown only while dragging. Nothing on screen the rest of
  /// the time — a permanent ✕ hovering over the app would be worse than the
  /// bar this replaced.
  Widget _closeTarget(Size screen, EdgeInsets pad) {
    final c = _closeCentre(screen, pad);
    final d = _overClose ? 78.0 : 62.0;
    return Positioned(
      left: c.dx - d / 2,
      top: c.dy - d / 2,
      child: IgnorePointer(
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          width: d,
          height: d,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: (_overClose ? GwColors.live : Colors.black)
                .withValues(alpha: _overClose ? 0.92 : 0.55),
          ),
          child: const Icon(Icons.close, color: Colors.white, size: 26),
        ),
      ),
    );
  }

  double get _progress {
    final d = _audio.duration.inMilliseconds;
    if (d <= 0) return 0;
    return (_audio.position.inMilliseconds / d).clamp(0.0, 1.0);
  }

  Widget _art(AudioTrack track, double size) {
    final cover = resolveMedia(track.coverUrl, bucket: "media");
    return SizedBox(
      width: size,
      height: size,
      child: cover != null
          ? CachedNetworkImage(
              imageUrl: cover,
              fit: BoxFit.cover,
              placeholder: (_, __) => const _Art(),
              errorWidget: (_, __, ___) => const _Art(),
            )
          : const _Art(),
    );
  }

  Widget _tap({
    required IconData icon,
    required double size,
    required Color color,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onTap,
        radius: 20,
        child: SizedBox(
          width: 34,
          height: 40,
          child: Icon(icon, size: size, color: color),
        ),
      ),
    );
  }
}

class _Art extends StatelessWidget {
  const _Art();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [GwColors.primaryBright, GwColors.primary],
        ),
      ),
      child: Icon(Icons.music_note_rounded, color: Colors.white, size: 18),
    );
  }
}
