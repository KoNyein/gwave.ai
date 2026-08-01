import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// The speaker, and who is allowed to use it.
///
/// The app has a dozen things that can make noise — a live broadcast, a reel,
/// an unmuted feed video, a CCTV camera, a chat video, a podcast, a call, a
/// push-to-talk message. Each used to start playing on its own and stop only
/// when its own widget was disposed, which produced two bugs users actually
/// hit:
///
///   * **Sound that outlives the screen.** Opening anything on top of a Live —
///     a profile, the shop sheet, the in-app browser — left the broadcast
///     playing behind it, and backgrounding the app left it playing in the
///     user's pocket. Nothing was watching the video; the audio just kept
///     going with no visible way to stop it.
///   * **Two things talking at once.** `video_player` requests Android audio
///     focus even for a silent video, and a `mixWithOthers` player never takes
///     focus at all — so depending on which player started, either the music
///     was killed by a muted clip or a live played on top of a podcast.
///
/// Audio focus alone cannot express what we want, because what we want is a
/// product rule, not an OS rule: *one feature owns the speaker at a time, and
/// it stops the moment its screen is no longer the thing the user is looking
/// at.* So ownership is tracked here, explicitly, by the feature that holds
/// it.

/// A feature's claim on the speaker.
///
/// [onSilence] must stop the sound and is called for every reason it can stop:
/// someone else claimed, the screen was covered, the app went to the
/// background. [onRestore] is optional and is only called for the reasons that
/// can be undone — the covering screen was popped, the app came back.
class SoundClaim {
  SoundClaim({
    required this.tag,
    required this.onSilence,
    this.onRestore,
    this.priority = media,
    this.survivesBackground = false,
  });

  /// Background listening: music, audiobooks, podcasts. Yields to anything.
  static const int background = 0;

  /// Watching something: live, reels, feed video, CCTV, chat clips.
  static const int media = 10;

  /// A conversation: calls and push-to-talk. Never interrupted by media —
  /// a Live opened during a call must not take the other person's voice away.
  static const int conversation = 100;

  /// For debugging and for [GwSound.holder]; not shown to users.
  final String tag;
  final VoidCallback onSilence;
  final VoidCallback? onRestore;
  final int priority;

  /// True only for the two things a user expects to keep playing with the
  /// screen off: the audio player (which has a media notification) and calls.
  final bool survivesBackground;
}

/// Tracks the single current owner of the speaker.
class GwSound with WidgetsBindingObserver {
  GwSound._();
  static final GwSound instance = GwSound._();

  SoundClaim? _holder;
  SoundClaim? _suspended;
  bool _installed = false;

  /// Called once from `main()`. Without it, background silencing does nothing
  /// and the rest of the class still works.
  void install() {
    if (_installed) return;
    _installed = true;
    WidgetsBinding.instance.addObserver(this);
  }

  /// The tag of whatever currently owns the speaker, or null.
  String? get holder => _holder?.tag;

  /// True while [claimant] is the one allowed to make sound.
  bool holds(SoundClaim claimant) => identical(_holder, claimant);

  /// Take the speaker. Whoever had it is silenced.
  ///
  /// Returns false when something more important is already speaking (a call);
  /// the caller must then stay silent — play muted, or not at all — rather than
  /// talking over it.
  bool claim(SoundClaim claimant) {
    final previous = _holder;
    if (previous != null &&
        !identical(previous, claimant) &&
        previous.priority > claimant.priority) {
      return false;
    }
    _holder = claimant;
    if (identical(_suspended, previous) || identical(_suspended, claimant)) {
      _suspended = null;
    }
    if (previous != null && !identical(previous, claimant)) {
      previous.onSilence();
    }
    return true;
  }

  /// Give the speaker back. Safe to call from `dispose()`, twice, or by
  /// something that never held it.
  void release(SoundClaim claimant) {
    if (identical(_holder, claimant)) _holder = null;
    if (identical(_suspended, claimant)) _suspended = null;
  }

  /// Silence the current owner without taking the speaker — used when a screen
  /// is covered, so it can pick up again when it is uncovered.
  void silence(SoundClaim claimant) {
    if (!identical(_holder, claimant)) return;
    claimant.onSilence();
  }

  /// The user moved to a different part of the app — a bottom-nav tab, which
  /// is not a route push and so is invisible to [gwRouteObserver].
  ///
  /// Anything being *watched* stops, because the user left it behind. Music
  /// and calls carry on, because carrying on is the whole point of them.
  void silenceMedia() {
    final held = _holder;
    if (held == null || held.priority != SoundClaim.media) return;
    _holder = null;
    _suspended = null;
    held.onSilence();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final held = _holder;
    if (state == AppLifecycleState.resumed) {
      final resuming = _suspended;
      _suspended = null;
      if (resuming != null && identical(_holder, resuming)) {
        resuming.onRestore?.call();
      }
      return;
    }
    // `paused` only: `inactive` also fires for a permission dialog or the
    // notification shade, and stopping a Live because the user glanced at
    // their notifications would be worse than the bug this fixes.
    if (state == AppLifecycleState.paused) {
      if (held != null && !held.survivesBackground) {
        _suspended = held;
        held.onSilence();
      }
    }
  }
}

/// Subscribed to by every screen that makes sound, so it can tell when another
/// screen has been pushed over the top of it. Registered on `MaterialApp`.
final RouteObserver<PageRoute<dynamic>> gwRouteObserver =
    RouteObserver<PageRoute<dynamic>>();

/// A screen that makes sound.
///
/// Mix into the `State` of any full-screen player: it subscribes to the route
/// observer, goes quiet when another screen covers it, and picks up again when
/// that screen is popped. Combined with [GwSound]'s lifecycle handling, this
/// covers every way a player can stop being the thing on screen.
mixin SoundScreen<T extends StatefulWidget> on State<T> implements RouteAware {
  /// The screen's claim, or null before it starts playing.
  SoundClaim? get soundClaim;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    if (route is PageRoute) gwRouteObserver.subscribe(this, route);
  }

  @override
  void dispose() {
    gwRouteObserver.unsubscribe(this);
    super.dispose();
  }

  @override
  void didPush() {}

  @override
  void didPop() {}

  /// Something was pushed on top of us — stop making noise.
  @override
  void didPushNext() {
    final claim = soundClaim;
    if (claim != null) GwSound.instance.silence(claim);
  }

  /// We are back on top — carry on.
  @override
  void didPopNext() {
    final claim = soundClaim;
    if (claim != null && GwSound.instance.holds(claim)) {
      claim.onRestore?.call();
    }
  }
}

/// A controller for video that plays **silently**: feed previews, live
/// thumbnails, muted autoplay. `mixWithOthers` keeps it out of the audio focus
/// fight entirely, so whatever the user is listening to keeps playing.
VideoPlayerController silentVideoController(Uri uri) =>
    VideoPlayerController.networkUrl(
      uri,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );

/// A controller for video the user is **here to watch** — a camera feed, a
/// clip opened from a chat. This one takes Android audio focus, deliberately:
/// [GwSound] can only quiet Gwave's own players, and someone who taps play on
/// a video expects the podcast in their other app to stop too.
VideoPlayerController watchVideoController(Uri uri) =>
    VideoPlayerController.networkUrl(uri);

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

/// The feed's single claim on the speaker. The feed lives in a tab rather than
/// a route of its own, so it needs one shared claim that survives scrolling
/// between cards: leaving the tab or the app silences the feed as a whole.
final SoundClaim _feedClaim = SoundClaim(
  tag: "feed-video",
  onSilence: () => feedSoundHolder.value = null,
);

/// This video, and only this video, now has the sound.
void feedUnmute(String id) {
  if (!GwSound.instance.claim(_feedClaim)) return; // a call is speaking
  feedSoundHolder.value = id;
}

/// Silence the feed. Called from any video's mute button — one tap quiets all
/// of them, which is what a mute button is for.
void feedMuteAll() {
  feedSoundHolder.value = null;
  GwSound.instance.release(_feedClaim);
}
