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
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Full-screen, one-screen TikTok-style Live watch. The video fills the screen;
/// host/title, LIVE + viewer badge, the right action rail, and the overlay chat
/// float on top of it. HLS playback covers IVS Low-Latency live streams and
/// finished replays (recording HLS / Mux VOD).
///
/// Live functions (all native, backed by `live_chat_messages` / `live_reactions`):
///   • real chat — send + poll every few seconds so viewers see each other
///   • emoji reactions — tap to send, and everyone's reactions float up
///   • live viewer count that refreshes while you watch
class LiveWatchScreen extends StatefulWidget {
  const LiveWatchScreen({super.key, required this.stream});
  final LiveStream stream;

  @override
  State<LiveWatchScreen> createState() => _LiveWatchScreenState();
}

class _LiveWatchScreenState extends State<LiveWatchScreen> {
  VideoPlayerController? _controller;
  bool _ready = false;
  String? _error;

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
  String? _lastChatAt;
  String? _lastReactAt;
  int _viewers = 0;
  bool _sending = false;

  static const _emojis = ["❤️", "👍", "😂", "😮", "👏", "🔥"];

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);
    _viewers = widget.stream.viewerCount;
    if (_useLivekit) {
      _initLivekit();
    } else {
      _initVideo();
    }
    _loadChat();
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
      setState(() => _error = "No video for this Live yet.");
      return;
    }
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(url));
      _controller = c;
      await c.initialize();
      await c.setLooping(!widget.stream.isLive);
      await c.play();
      if (mounted) setState(() => _ready = true);
    } catch (e) {
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
  Future<void> _tick() async {
    final repo = context.read<AppState>().repo;
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
      final n = await repo.liveReactionCount(widget.stream.id,
          sinceIso: _lastReactAt);
      _lastReactAt = DateTime.now().toUtc().toIso8601String();
      if (mounted && n > 0) {
        for (var i = 0; i < min(n, 8); i++) {
          _spawnHeart(_emojis[Random().nextInt(_emojis.length)]);
        }
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
    _poll?.cancel();
    _heartbeat?.cancel();
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
    _spawnHeart(emoji);
    try {
      await context.read<AppState>().repo.sendLiveReaction(widget.stream.id, emoji);
    } catch (_) {
      // Reaction send is best-effort — the local float already gave feedback.
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
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: _controller!.value.size.width,
        height: _controller!.value.size.height,
        child: VideoPlayer(_controller!),
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
        _railButton(Icons.favorite, "Like", GwColors.heart,
            onTap: () => _react("❤️")),
        const SizedBox(height: 16),
        _railButton(Icons.card_giftcard, "Gift", GwColors.gold,
            onTap: () => _react("🔥")),
        const SizedBox(height: 16),
        _railButton(Icons.share, "Share", Colors.white, onTap: () {}),
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
