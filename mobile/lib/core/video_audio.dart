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
