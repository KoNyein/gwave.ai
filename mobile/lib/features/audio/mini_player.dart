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
/// This is the visible half of the fix for "the music stops when I leave the
/// player". Playback surviving is not enough on its own: if nothing on screen
/// shows what is playing, a user who backs out has no way to pause, skip or
/// get back to it, and the only remaining control is the notification shade.
///
/// Tap it to reopen the full player. ✕ is the one control in the app that
/// actually stops playback.
class GwMiniPlayer extends StatelessWidget {
  const GwMiniPlayer({super.key});

  @override
  Widget build(BuildContext context) {
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
    return Material(
      color: GwColors.surfaceOf(context),
      child: InkWell(
        onTap: () => _open(context),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Divider(height: 1, color: GwColors.lineOf(context)),
            // A hairline of progress rather than a full bar: at this size it
            // is the only thing that fits, and it is the thing you glance at.
            LinearProgressIndicator(
              value: _progress,
              minHeight: 2,
              backgroundColor: GwColors.lineOf(context),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(GwColors.primary),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 6, 4, 6),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 40,
                      height: 40,
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
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 13.5,
                            color: GwColors.inkOf(context),
                          ),
                        ),
                        Text(
                          GwAudio.bylineOf(track),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11.5,
                            color: GwColors.inkSoftOf(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    iconSize: 30,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 40),
                    icon: Icon(
                      audio.playing
                          ? Icons.pause_circle_filled
                          : Icons.play_circle_filled,
                      color: GwColors.primary,
                    ),
                    tooltip: audio.playing
                        ? tr(context, "Pause", "ခဏရပ်")
                        : tr(context, "Play", "ဖွင့်"),
                    onPressed: audio.toggle,
                  ),
                  if (audio.hasQueue)
                    IconButton(
                      iconSize: 24,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 36),
                      icon: const Icon(Icons.skip_next),
                      color: GwColors.inkOf(context),
                      tooltip: tr(context, "Next", "နောက်တစ်ပုဒ်"),
                      onPressed: audio.next,
                    ),
                  IconButton(
                    iconSize: 20,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 36),
                    icon: const Icon(Icons.close),
                    color: GwColors.inkSoftOf(context),
                    tooltip: tr(context, "Stop", "ရပ်"),
                    onPressed: audio.stop,
                  ),
                ],
              ),
            ),
          ],
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
      child: Icon(Icons.music_note_rounded, color: Colors.white, size: 20),
    );
  }
}
