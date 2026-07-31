import 'package:flutter/foundation.dart';
import 'package:video_player/video_player.dart';

import '../features/audio/audio_service.dart';

/// Audio focus for video, in one place.
///
/// Android gives audio focus to whoever starts a player, and takes it away
/// from everyone else. `video_player` requests it unconditionally — including
/// for a **silent** video — so a muted autoplaying clip scrolling past in the
/// feed paused the user's music. Nothing was audible from the video; the music
/// just stopped, for no reason the user could see.
///
/// A video that makes no sound has no claim on the audio. Only sound
/// interrupts sound.

/// A controller for video that plays **silently**: feed previews, live
/// thumbnails, muted autoplay. `mixWithOthers` keeps it out of the audio focus
/// fight entirely, so whatever the user is listening to keeps playing.
VideoPlayerController silentVideoController(Uri uri) =>
    VideoPlayerController.networkUrl(
      uri,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );

/// The user just turned a video's sound on.
///
/// Now there is a real conflict — two things want the speaker — and the video
/// is the one they asked for, so the music yields. Called explicitly rather
/// than left to audio focus, because a `mixWithOthers` player never takes
/// focus and would otherwise play over the top of the music.
Future<void> videoTookTheSound() async {
  final audio = GwAudio.instance;
  if (audio.playing) await audio.pause();
}

/// Which feed video, if any, is allowed to make sound — identified by its URL.
///
/// Mute is a property of *the feed*, not of one card. Each video used to own
/// its own mute flag, so silencing one left the next one to shout at you a
/// scroll later; there was no way to say "quiet, all of you" short of turning
/// the phone down.
///
/// Null — where it starts, and where muting anything returns it — means the
/// whole feed is silent. A non-null value names the single video that may
/// speak. Sound is exclusive because several cards autoplay at once: a plain
/// global unmute would have every visible video talking over the others.
final ValueNotifier<String?> feedSoundHolder = ValueNotifier<String?>(null);

/// This video, and only this video, now has the sound.
Future<void> feedUnmute(String id) async {
  feedSoundHolder.value = id;
  await videoTookTheSound();
}

/// Silence the feed. Called from any video's mute button — one tap quiets all
/// of them, which is what a mute button is for.
void feedMuteAll() => feedSoundHolder.value = null;
