import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../core/video_audio.dart';
import 'reaction_channel.dart';
import '../../widgets/share_sheet.dart';
import '../../widgets/common.dart';
import '../web/web_screen.dart';
import 'live_sale.dart';

/// Full-screen, one-screen TikTok-style Live watch. The video fills the screen;
/// host/title, LIVE + viewer badge, the right action rail, and the overlay chat
/// float on top of it. HLS playback covers IVS Low-Latency live streams and
/// finished replays (recording HLS / Mux VOD).
///
/// Live functions (all native, backed by `live_chat_messages` / `live_reactions`):
///   • real chat — send + poll every few seconds so viewers see each other
///   • emoji reactions — tap to send, and everyone's reactions float up
///   • live viewer count that refreshes while you watch
///   • live sale — the host pins shop products, viewers buy from a card over
///     the video without leaving the broadcast
class LiveWatchScreen extends StatefulWidget {
  const LiveWatchScreen({super.key, required this.stream, this.onEnded});
  final LiveStream stream;

  /// Fired once when a REPLAY finishes playing (never for live broadcasts).
  /// The vertical swipe pager passes this to auto-advance to the next video;
  /// without it (standalone open) the replay loops like before.
  final VoidCallback? onEnded;

  @override
  State<LiveWatchScreen> createState() => _LiveWatchScreenState();
}

class _LiveWatchScreenState extends State<LiveWatchScreen>
    with SoundScreen<LiveWatchScreen> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _muted = false; // viewers can mute; audio is on by default
  String? _error;

  /// A Live owns the speaker while it is the screen you are looking at — and
  /// only while. Watching one used to keep playing behind whatever was opened
  /// on top of it, and kept playing when the app went to the background, so a
  /// broadcast carried on talking in the user's pocket with nothing on screen
  /// to stop it. [SoundScreen] and [GwSound] deliver both events; this claim is
  /// what they act on.
  late final SoundClaim _sound = SoundClaim(
    tag: "live:${widget.stream.id}",
    onSilence: _silenceSound,
    onRestore: _restoreSound,
  );

  @override
  SoundClaim? get soundClaim => _sound;

  /// Stop making noise — the screen is covered, the app is in the background,
  /// or something more important is speaking. Playback pauses rather than
  /// stopping so returning picks the broadcast back up.
  void _silenceSound() {
    _controller?.pause();
    unawaited(_setRoomAudio(false));
  }

  void _restoreSound() {
    if (!mounted || _muted) return;
    _controller?.play();
    unawaited(_setRoomAudio(true));
  }

  /// Browser broadcasts arrive over the LiveKit SFU, where the audio is played
  /// by the SDK rather than by a controller we hold — disabling the remote
  /// publication is how a subscriber stops receiving it.
  Future<void> _setRoomAudio(bool on) async {
    final room = _room;
    if (room == null) return;
    for (final p in room.remoteParticipants.values) {
      for (final pub in p.audioTrackPublications) {
        try {
          // `enabled` is read-only; enable()/disable() tell the server to stop
          // sending this track, which stops the sound and the bandwidth.
          if (on) {
            await pub.enable();
          } else {
            await pub.disable();
          }
        } catch (_) {}
      }
    }
  }

  // Browser Go Live broadcasts publish over the LiveKit SFU (WebRTC) and have
  // no HLS URL — the app joins the room as a subscriber like the web viewer.
  lk.Room? _room;
  lk.EventsListener<lk.RoomEvent>? _lkListener;
  lk.VideoTrack? _lkVideo;
  bool _lkConnected = false;

  bool get _useLivekit =>
      widget.stream.isLive &&
      (widget.stream.livekitRoom != null &&
          widget.stream.livekitRoom!.isNotEmpty);
  final _chat = TextEditingController();
  final _chatScroll = ScrollController();
  final List<LiveChatMessage> _lines = [];
  final List<_FloatingReaction> _floats = [];

  Timer? _poll;
  Timer? _heartbeat;
  late final LiveReactions _reactions;
  String? _lastChatAt;
  bool _endedFired = false;

  /// Auto-advance hook: a replay that reached its end fires [LiveWatchScreen.
  /// onEnded] exactly once, so the swipe pager can move to the next video.
  void _maybeFireEnded() {
    if (_endedFired) return;
    final v = _controller?.value;
    if (v == null || !v.isInitialized) return;
    if (v.duration > Duration.zero &&
        !v.isPlaying &&
        v.position >= v.duration) {
      _endedFired = true;
      widget.onEnded?.call();
    }
  }
  int _viewers = 0;
  bool _sending = false;

  /// Products the host has pinned to this stream. Refreshed on the same poll
  /// as chat so a product pinned mid-broadcast appears without a reload.
  List<ShopProduct> _forSale = [];

  /// Resolved once: the rail is rebuilt on every poll tick and provider's
  /// read() doesn't belong in build.
  late final bool _isHost;

  static const _emojis = ["❤️", "👍", "😂", "😮", "👏", "🔥"];

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    _isHost = context.read<AppState>().me?.id == widget.stream.hostId;
    _viewers = widget.stream.viewerCount;
    // Everyone watching this broadcast — phone or browser — is in the same
    // reaction channel, so a heart tapped on either side floats on both.
    _reactions = LiveReactions(context.read<AppState>().api)
      ..onEmoji = (emoji) {
        if (mounted) _spawnHeart(emoji);
      };
    unawaited(_reactions.join(widget.stream.id));
    if (_useLivekit) {
      _initLivekit();
    } else {
      _initVideo();
    }
    _loadChat();
    _loadProducts();
    // Poll chat, reactions and viewer count while the stream is live.
    if (widget.stream.isLive) {
      _poll = Timer.periodic(const Duration(seconds: 3), (_) => _tick());
      // Persist this viewer so the host dashboard's "Peak viewers" is non-zero.
      // The RPC counts viewers seen in the last ~25s, so beat inside that window.
      _sendHeartbeat();
      _heartbeat =
          Timer.periodic(const Duration(seconds: 15), (_) => _sendHeartbeat());
    }
  }

  /// Best-effort — a failed heartbeat must never disrupt playback or chat.
  void _sendHeartbeat() {
    if (!mounted) return;
    context.read<AppState>().repo.liveHeartbeat(widget.stream.id).catchError(
      (_) {},
    );
  }

  String? _playbackUrl() {
    final s = widget.stream;
    if (s.isLive && s.ivsPlaybackUrl != null && s.ivsPlaybackUrl!.isNotEmpty) {
      return s.ivsPlaybackUrl;
    }
    // Replay: an IVS/LiveKit recording HLS path, or a Mux VOD playback id.
    if (s.recordingPath != null && s.recordingPath!.isNotEmpty) {
      final rp = s.recordingPath!;
      if (rp.startsWith("http")) return rp;
      // Served by the web server's /recordings proxy (streams from the
      // private IVS recordings bucket via the instance role).
      return "${AppConfig.apiBase}/recordings/$rp";
    }
    if (s.vodPlaybackId != null && s.vodPlaybackId!.isNotEmpty) {
      return "https://stream.mux.com/${s.vodPlaybackId}.m3u8";
    }
    return null;
  }

  /// Join the LiveKit room as a subscriber and show the host's video track.
  /// Audio tracks play automatically once subscribed.
  Future<void> _initLivekit() async {
    try {
      final t = await context.read<AppState>().api.liveToken(widget.stream.id);
      final room = lk.Room(
        roomOptions: const lk.RoomOptions(adaptiveStream: true, dynacast: true),
      );
      _room = room;
      final listener = room.createListener();
      _lkListener = listener;
      listener
        ..on<lk.TrackSubscribedEvent>((e) {
          final track = e.track;
          if (track is lk.VideoTrack && mounted) {
            setState(() => _lkVideo = track);
          }
        })
        ..on<lk.TrackUnsubscribedEvent>((e) {
          if (e.track == _lkVideo && mounted) {
            setState(() => _lkVideo = null);
          }
        })
        ..on<lk.RoomDisconnectedEvent>((_) {
          if (mounted) setState(() => _lkVideo = null);
        });
      await room.connect(t.url, t.token);
      // Pick up a video track the host already published before we joined.
      for (final p in room.remoteParticipants.values) {
        for (final pub in p.videoTrackPublications) {
          final track = pub.track;
          if (track is lk.VideoTrack) _lkVideo = track;
        }
      }
      // Same rule as the HLS path: the broadcast owns the speaker while it is
      // on screen, and receives no audio at all when it is not.
      final gotSound = GwSound.instance.claim(_sound);
      await _setRoomAudio(gotSound && !_muted);
      if (mounted) setState(() => _lkConnected = true);
    } catch (e) {
      if (mounted) {
        setState(() => _error = e is ApiException
            ? e.message
            : "Couldn't connect to the live stream.");
      }
    }
  }

  Future<void> _initVideo() async {
    final url = _playbackUrl();
    if (url == null) {
      // A *live* with no native (HLS/LiveKit) source is a browser WebRTC
      // broadcast (IVS Real-Time stage) — the app can't decode the stage
      // directly, so hand off to the authenticated in-app web player, which
      // plays it. App broadcasts always carry an HLS URL, so this fires only
      // for browser lives. Replays with no source keep the error.
      if (widget.stream.isLive) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => WebScreen(
                path: "/live/${widget.stream.id}",
                title: widget.stream.title,
              ),
            ),
          );
        });
        return;
      }
      setState(() => _error = "No video for this Live yet.");
      return;
    }
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(url));
      _controller = c;
      await c.initialize();
      // Inside the swipe pager a finished replay advances instead of looping.
      await c.setLooping(!widget.stream.isLive && widget.onEnded == null);
      if (widget.onEnded != null && !widget.stream.isLive) {
        c.addListener(_maybeFireEnded);
      }
      // Watching a Live is a listening experience, so it takes the speaker:
      // whatever was playing — a podcast, a reel left running, an unmuted feed
      // video — is paused rather than talked over. A call outranks a broadcast,
      // and then the Live plays silently until the call ends.
      final gotSound = GwSound.instance.claim(_sound);
      await c.setVolume(gotSound && !_muted ? 1.0 : 0);
      await c.play();
      if (mounted) setState(() => _ready = true);
    } catch (e) {
      if (!mounted) return;
      // A "live" whose HLS won't play is usually a broadcast that died
      // without ending — ask the server to check the channel for real.
      if (widget.stream.isLive) {
        try {
          final st = await context
              .read<AppState>()
              .api
              .liveVerify(widget.stream.id);
          if (mounted && st == "ended") {
            setState(() => _error = "This broadcast has ended.");
            return;
          }
        } catch (_) {}
      }
      if (mounted) setState(() => _error = "Couldn't play the video.");
    }
  }

  Future<void> _loadChat() async {
    try {
      final repo = context.read<AppState>().repo;
      final msgs = await repo.liveChat(widget.stream.id);
      if (!mounted) return;
      setState(() {
        _lines
          ..clear()
          ..addAll(msgs);
        if (msgs.isNotEmpty) {
          _lastChatAt = msgs.last.createdAt.toUtc().toIso8601String();
        }
      });
      _scrollChat();
    } catch (_) {
      // Chat is best-effort; the video keeps playing.
    }
  }

  /// One polling cycle: pull new chat, count fresh reactions, refresh viewers.
  /// Best-effort — a stream with no products, or a failed lookup, simply
  /// shows no buy card rather than an error over the video.
  Future<void> _loadProducts() async {
    try {
      final rows =
          await context.read<AppState>().repo.liveProducts(widget.stream.id);
      if (mounted) setState(() => _forSale = rows);
    } catch (_) {}
  }

  /// Host-only: pick which listings are on sale in this broadcast.
  Future<void> _manageProducts() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => LiveProductPicker(
          streamId: widget.stream.id,
          pinned: _forSale,
        ),
      ),
    );
    await _loadProducts();
  }

  Future<void> _tick() async {
    final repo = context.read<AppState>().repo;
    // A product pinned mid-broadcast should appear without a reload; this
    // rides the existing poll rather than adding a timer of its own.
    unawaited(_loadProducts());
    try {
      final msgs = await repo.liveChat(widget.stream.id, sinceIso: _lastChatAt);
      if (mounted && msgs.isNotEmpty) {
        setState(() {
          _lines.addAll(msgs);
          _lastChatAt = msgs.last.createdAt.toUtc().toIso8601String();
        });
        _scrollChat();
      }
    } catch (_) {}
    try {
      final s = await repo.refreshStream(widget.stream.id);
      if (mounted && s != null) setState(() => _viewers = s.viewerCount);
    } catch (_) {}
  }

  void _scrollChat() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScroll.hasClients) {
        _chatScroll.animateTo(
          _chatScroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    GwSound.instance.release(_sound);
    _poll?.cancel();
    _heartbeat?.cancel();
    unawaited(_reactions.dispose());
    _lkListener?.dispose();
    final room = _room;
    if (room != null) {
      room.disconnect().then((_) => room.dispose());
    }
    _controller?.dispose();
    _chat.dispose();
    _chatScroll.dispose();
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    super.dispose();
  }

  Future<void> _send() async {
    final t = _chat.text.trim();
    if (t.isEmpty || _sending) return;
    setState(() => _sending = true);
    _chat.clear();
    try {
      final msg = await context
          .read<AppState>()
          .repo
          .sendLiveChat(widget.stream.id, t);
      if (msg != null && mounted) {
        setState(() {
          _lines.add(msg);
          _lastChatAt = msg.createdAt.toUtc().toIso8601String();
        });
        _scrollChat();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't send — $e")),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _react(String emoji) async {
    // Out over the channel first, and let the float come back with everyone
    // else's — one tap, one heart, whichever way round it arrives. Spawning
    // locally as well would show the sender two.
    _reactions.send(emoji);
    if (_reactions.connected) {
      // Nothing to do: the echo will spawn it.
    } else {
      _spawnHeart(emoji);
    }
    try {
      await context.read<AppState>().repo.sendLiveReaction(widget.stream.id, emoji);
    } catch (_) {
      // Reaction send is best-effort — the float already gave feedback.
    }
  }

  void _spawnHeart(String emoji) {
    final key = UniqueKey();
    final float = _FloatingReaction(
      key: key,
      emoji: emoji,
      startX: 0.45 + Random().nextDouble() * 0.5,
      onDone: () {
        setState(() => _floats.removeWhere((f) => f.key == key));
      },
    );
    setState(() => _floats.add(float));
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.stream;
    final host = s.host?.displayName ?? "Host";
    return Scaffold(
      backgroundColor: GwColors.darkBg,
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Double-tap anywhere on the video to send a heart (TikTok-style).
          GestureDetector(
            onDoubleTap: () => _react("❤️"),
            child: _video(),
          ),
          // Top + bottom scrims for legibility.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Colors.black54, Colors.transparent, Colors.black87],
                stops: [0, 0.35, 1],
              ),
            ),
          ),
          // Floating reactions rise along the right edge.
          Positioned(
            right: 8,
            bottom: 90,
            top: 80,
            width: 120,
            child: Stack(children: _floats),
          ),
          SafeArea(
            child: Column(
              children: [
                _topBar(host, s),
                const Spacer(),
                _bottomArea(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _video() {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(30),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.videocam_off, color: Colors.white38, size: 54),
              const SizedBox(height: 12),
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70)),
            ],
          ),
        ),
      );
    }
    if (_useLivekit) {
      if (_lkVideo != null) {
        return lk.VideoTrackRenderer(_lkVideo!, fit: lk.VideoViewFit.cover);
      }
      if (_lkConnected) {
        return const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 14),
              Text("Waiting for the host's video...",
                  style: TextStyle(color: Colors.white70)),
            ],
          ),
        );
      }
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }
    if (!_ready || _controller == null) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }
    // Match the source's shape (like TikTok/Facebook): a portrait video fills
    // the screen (cover); a landscape one (laptop/OBS) is letterboxed (contain)
    // so nothing important is cropped off the sides.
    final size = _controller!.value.size;
    final isPortrait = size.height >= size.width;
    return Center(
      child: FittedBox(
        fit: isPortrait ? BoxFit.cover : BoxFit.contain,
        child: SizedBox(
          width: size.width,
          height: size.height,
          child: VideoPlayer(_controller!),
        ),
      ),
    );
  }

  Widget _topBar(String host, LiveStream s) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(30),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GwAvatar(url: s.host?.avatarUrl, name: host, size: 34),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(host,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13)),
                    Text(s.isLive ? "🔴 Live" : "Replay",
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 11)),
                  ],
                ),
                const SizedBox(width: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    gradient: GwColors.primaryGradient,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text("+ Follow",
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12)),
                ),
              ],
            ),
          ),
          const Spacer(),
          if (s.isLive)
            const GwPill(
                label: "LIVE",
                color: GwColors.live,
                filled: true,
                icon: Icons.circle),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.visibility, size: 13, color: Colors.white),
                const SizedBox(width: 4),
                Text("$_viewers",
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: const Icon(Icons.close, color: Colors.white, size: 26),
          ),
        ],
      ),
    );
  }

  Widget _bottomArea() {
    return Padding(
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        bottom: 12 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The buy card sits directly above the chat, where Shopee and TikTok
          // put it: closest to the thumb, furthest from the host's face.
          LiveSaleCard(products: _forSale, onChanged: _loadProducts),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Overlay chat column (left).
              Expanded(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 220),
                  child: _lines.isEmpty
                      ? const SizedBox.shrink()
                      : ListView.builder(
                          controller: _chatScroll,
                          shrinkWrap: true,
                          padding: EdgeInsets.zero,
                          itemCount: _lines.length,
                          itemBuilder: (_, i) => _chatBubble(_lines[i]),
                        ),
                ),
              ),
              const SizedBox(width: 10),
              _actionRail(),
            ],
          ),
          const SizedBox(height: 10),
          _reactionBar(),
          const SizedBox(height: 8),
          _chatInput(),
        ],
      ),
    );
  }

  Widget _reactionBar() {
    return SizedBox(
      height: 40,
      child: Row(
        children: [
          for (final e in _emojis)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => _react(e),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.32),
                    shape: BoxShape.circle,
                  ),
                  child: Text(e, style: const TextStyle(fontSize: 20)),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chatBubble(LiveChatMessage l) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.32),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text.rich(
            TextSpan(children: [
              TextSpan(
                text: "${l.senderName}  ",
                style: const TextStyle(
                    color: GwColors.primaryBright,
                    fontWeight: FontWeight.w700,
                    fontSize: 13),
              ),
              TextSpan(
                text: l.content,
                style: const TextStyle(color: Colors.white, fontSize: 13),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _chatInput() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(24),
      ),
      padding: const EdgeInsets.only(left: 16, right: 6),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _chat,
              style: const TextStyle(color: Colors.white),
              cursorColor: Colors.white,
              textInputAction: TextInputAction.send,
              decoration: const InputDecoration(
                hintText: "Say something...",
                hintStyle: TextStyle(color: Colors.white54),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
          IconButton(
            icon: _sending
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.2, color: GwColors.primaryBright))
                : const Icon(Icons.send, color: GwColors.primaryBright),
            onPressed: _send,
          ),
        ],
      ),
    );
  }

  Widget _actionRail() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _railButton(
          _muted ? Icons.volume_off : Icons.volume_up,
          _muted ? "Muted" : "Sound",
          _muted ? Colors.white54 : Colors.white,
          onTap: () {
            final muting = !_muted;
            setState(() => _muted = muting);
            if (muting) {
              // Muting a Live hands the speaker back, so a podcast paused when
              // the broadcast opened is free to be resumed.
              _controller?.setVolume(0);
              unawaited(_setRoomAudio(false));
              GwSound.instance.release(_sound);
            } else {
              final gotSound = GwSound.instance.claim(_sound);
              _controller?.setVolume(gotSound ? 1 : 0);
              unawaited(_setRoomAudio(gotSound));
            }
          },
        ),
        const SizedBox(height: 16),
        _railButton(Icons.favorite, "Like", GwColors.heart,
            onTap: () => _react("❤️")),
        const SizedBox(height: 16),
        _railButton(Icons.card_giftcard, "Gift", GwColors.gold,
            onTap: () => _react("🔥")),
        const SizedBox(height: 16),
        _railButton(Icons.share, "Share", Colors.white, onTap: () {
          showShareSheet(
            context,
            url: "https://gwave.cc/live/${widget.stream.id}",
            title: widget.stream.title,
          );
        }),
        // The host manages what's on sale; viewers get the same button only
        // when there's more than one product, to reach the full list.
        if (_isHost) ...[
          const SizedBox(height: 16),
          _railButton(Icons.sell, tr(context, "Sell", "ရောင်း"), GwColors.gold,
              onTap: _manageProducts),
        ] else if (_forSale.length > 1) ...[
          const SizedBox(height: 16),
          _railButton(Icons.shopping_bag, tr(context, "Shop", "ဈေးဝယ်"),
              Colors.white,
              onTap: () => showLiveSaleSheet(context, _forSale, _loadProducts)),
        ],
      ],
    );
  }

  Widget _railButton(IconData icon, String label, Color color,
      {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.35),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// A single emoji that floats up, drifts sideways and fades — the TikTok/IG
/// "heart burst" you see when viewers react.
class _FloatingReaction extends StatefulWidget {
  const _FloatingReaction({
    super.key,
    required this.emoji,
    required this.startX,
    required this.onDone,
  });

  final String emoji;
  final double startX; // 0..1 within the float column
  final VoidCallback onDone;

  @override
  State<_FloatingReaction> createState() => _FloatingReactionState();
}

class _FloatingReactionState extends State<_FloatingReaction>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final double _drift;

  @override
  void initState() {
    super.initState();
    _drift = (Random().nextDouble() - 0.5) * 40;
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..forward().whenComplete(widget.onDone);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final t = _c.value;
        final opacity = t < 0.15 ? t / 0.15 : (1 - (t - 0.15) / 0.85);
        return Positioned(
          right: 8 + widget.startX * 40 + _drift * t,
          bottom: t * 240,
          child: Opacity(
            opacity: opacity.clamp(0, 1),
            child: Transform.scale(
              scale: 0.8 + 0.4 * sin(t * pi),
              child: Text(widget.emoji, style: const TextStyle(fontSize: 30)),
            ),
          ),
        );
      },
    );
  }
}
