import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import 'audio_models.dart';
import 'audio_service.dart';
import 'audio_track_screen.dart';

/// The bar that sits above the bottom navigation whenever something is loaded.
///
/// Playback surviving the player screen is only half the job: if nothing on
/// screen shows what is playing, a user who backs out has no way to pause,
/// skip or get back to it, and the only remaining control is the notification
/// shade.
///
/// It is deliberately small and quiet — 48dp, one line of text, a hairline of
/// progress along the bottom edge. It is a status bar with three buttons, not
/// a player. Tap it to open the real one.
class GwMiniPlayer extends StatelessWidget {
  const GwMiniPlayer({super.key, this.visible = true});

  /// False on immersive surfaces — the Reels tab is edge-to-edge video and a
  /// bar floating over it is exactly the kind of chrome that tab exists to get
  /// rid of. Playback carries on; only the bar goes away.
  final bool visible;

  /// 48dp: Material's minimum comfortable touch row, and about half the height
  /// of the old layout.
  static const double height = 48;

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    final audio = GwAudio.instance;
    return AnimatedBuilder(
      animation: audio,
      builder: (context, _) {
        final track = audio.current;
        if (track == null) return const SizedBox.shrink();
        return _Bar(audio: audio, track: track);
      },
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.audio, required this.track});

  final GwAudio audio;
  final AudioTrack track;

  double get _progress {
    final d = audio.duration.inMilliseconds;
    if (d <= 0) return 0;
    return (audio.position.inMilliseconds / d).clamp(0.0, 1.0);
  }

  void _open(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => AudioTrackScreen(
          track: track,
          queue: audio.queue.isEmpty ? null : audio.queue,
          startIndex: audio.index,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cover = resolveMedia(track.coverUrl, bucket: "media");
    final line = GwColors.lineOf(context);
    return Material(
      color: GwColors.surfaceOf(context),
      child: InkWell(
        onTap: () => _open(context),
        child: SizedBox(
          height: GwMiniPlayer.height,
          child: Stack(
            children: [
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(height: 1, color: line),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 5, 2, 6),
                child: Row(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: SizedBox(
                        width: 36,
                        height: 36,
                        child: cover != null
                            ? CachedNetworkImage(
                                imageUrl: cover,
                                fit: BoxFit.cover,
                                placeholder: (_, __) => const _Art(),
                                errorWidget: (_, __, ___) => const _Art(),
                              )
                            : const _Art(),
                      ),
                    ),
                    const SizedBox(width: 9),
                    // One line, not two. At this height a second line of
                    // 11px grey text is noise, and the title is what
                    // identifies the track anyway.
                    Expanded(
                      child: Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: GwColors.inkOf(context),
                        ),
                      ),
                    ),
                    _tap(
                      icon: audio.playing ? Icons.pause : Icons.play_arrow,
                      size: 26,
                      color: GwColors.primary,
                      tooltip: audio.playing
                          ? tr(context, "Pause", "ခဏရပ်")
                          : tr(context, "Play", "ဖွင့်"),
                      onTap: audio.toggle,
                    ),
                    if (audio.hasQueue)
                      _tap(
                        icon: Icons.skip_next,
                        size: 22,
                        color: GwColors.inkOf(context),
                        tooltip: tr(context, "Next", "နောက်တစ်ပုဒ်"),
                        onTap: audio.next,
                      ),
                    _tap(
                      icon: Icons.close,
                      size: 17,
                      color: GwColors.inkSoftOf(context),
                      tooltip: tr(context, "Stop", "ရပ်"),
                      onTap: audio.stop,
                    ),
                  ],
                ),
              ),
              // Progress along the bottom edge — the one thing worth glancing
              // at, and the only place it costs no height.
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  value: _progress,
                  minHeight: 2,
                  backgroundColor: line,
                  valueColor:
                      const AlwaysStoppedAnimation<Color>(GwColors.primary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// A tap target that is 40dp wide without an IconButton's 48dp of padding —
  /// three of those would not fit in a 48dp bar.
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
        radius: 22,
        child: SizedBox(
          width: 38,
          height: 38,
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
