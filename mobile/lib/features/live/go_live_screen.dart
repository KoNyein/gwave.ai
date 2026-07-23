import 'dart:async';
import 'dart:math';

import 'package:apivideo_live_stream/apivideo_live_stream.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Fully native Go Live — the phone camera streams RTMPS straight to the
/// backend's IVS channel; no browser hand-off.
///
/// Flow: title → (permissions) → camera preview → Start → the encoder
/// connects to the ingest URL from /api/mobile/live/create; on connect the
/// stream is flipped live server-side (feed announcement included). End stops
/// the encoder and closes the stream. Viewers watch the HLS playback in the
/// app's Live tab as usual.
class GoLiveScreen extends StatefulWidget {
  const GoLiveScreen({super.key});

  @override
  State<GoLiveScreen> createState() => _GoLiveScreenState();
}

enum _Stage { setup, preview, live }

class _GoLiveScreenState extends State<GoLiveScreen> {
  final _title = TextEditingController();
  ApiVideoLiveStreamController? _controller;

  _Stage _stage = _Stage.setup;
  bool _busy = false;
  bool _muted = false;
  bool _shareLocation = false; // tag the broadcast with GPS (📍 on the card)
  String? _error;

  String? _streamId;
  String? _ingestUrl;
  String? _streamKey;

  Timer? _ticker;
  Duration _elapsed = Duration.zero;

  // Live overlay: viewers' chat + reactions, so the host sees the room while
  // broadcasting (and can reply). Same tables/poll as the watch screen.
  final _chat = TextEditingController();
  final _chatScroll = ScrollController();
  final List<LiveChatMessage> _lines = [];
  final List<Widget> _floats = [];
  Timer? _chatPoll;
  String? _lastChatAt;
  String? _lastReactAt;
  int _viewers = 0;
  bool _sending = false;
  bool _chatOpen = false;

  static const _hostEmojis = ["❤️", "👍", "😂", "😮", "👏", "🔥"];

  @override
  void dispose() {
    _ticker?.cancel();
    _chatPoll?.cancel();
    _chat.dispose();
    _chatScroll.dispose();
    _title.dispose();
    _controller?.stop();
    super.dispose();
  }

  /// Title in → ask camera/mic permission → provision the stream → preview.
  Future<void> _prepare() async {
    if (_title.text.trim().isEmpty) {
      setState(() => _error =
          tr(context, "Give your broadcast a title.", "ခေါင်းစဉ် ထည့်ပါ။"));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final statuses =
          await [Permission.camera, Permission.microphone].request();
      if (statuses[Permission.camera] != PermissionStatus.granted ||
          statuses[Permission.microphone] != PermissionStatus.granted) {
        throw Exception(tr(
            context,
            "Camera and microphone permission are required to go live.",
            "Live လွှင့်ဖို့ ကင်မရာနဲ့ မိုက် ခွင့်ပြုချက် လိုပါတယ်။"));
      }

      // Optional location tag, captured once at setup.
      double? lat, lng;
      String? locName;
      if (_shareLocation) {
        try {
          var perm = await Geolocator.checkPermission();
          if (perm == LocationPermission.denied) {
            perm = await Geolocator.requestPermission();
          }
          if (perm != LocationPermission.denied &&
              perm != LocationPermission.deniedForever) {
            final pos = await Geolocator.getCurrentPosition(
              locationSettings:
                  const LocationSettings(accuracy: LocationAccuracy.high),
            ).timeout(const Duration(seconds: 12));
            lat = pos.latitude;
            lng = pos.longitude;
            locName = tr(context, "Live location", "Live တည်နေရာ");
          }
        } catch (_) {
          // Best-effort — the broadcast still starts without a tag.
        }
      }

      final api = context.read<AppState>().api;
      final s = await api.liveCreate(
        _title.text.trim(),
        locationName: locName,
        latitude: lat,
        longitude: lng,
      );
      _streamId = s.id;
      _ingestUrl = s.ingestUrl;
      _streamKey = s.streamKey;

      final controller = ApiVideoLiveStreamController(
        initialAudioConfig: AudioConfig(),
        initialVideoConfig: VideoConfig.withDefaultBitrate(
          resolution: Resolution.RESOLUTION_720,
        ),
        onConnectionSuccess: _onConnected,
        onConnectionFailed: (reason) => _onStreamError(reason),
        onDisconnection: () => _onStreamError(
            tr(context, "Connection lost.", "ချိတ်ဆက်မှု ပြတ်သွားသည်။")),
      );
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _controller = controller;
        _stage = _Stage.preview;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _start() async {
    final c = _controller;
    if (c == null || _streamKey == null || _ingestUrl == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await c.startStreaming(streamKey: _streamKey!, url: _ingestUrl!);
      // _onConnected fires when the RTMPS handshake completes.
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  void _onConnected() {
    if (!mounted) return;
    setState(() {
      _busy = false;
      _stage = _Stage.live;
      _elapsed = Duration.zero;
    });
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsed += const Duration(seconds: 1));
    });
    // Flip the row to live + feed announcement; best-effort (the encoder is
    // already pushing frames either way).
    final id = _streamId;
    if (id != null) {
      context.read<AppState>().api.liveStart(id).catchError((_) {});
    }
    // Start pulling viewers' chat + reactions for the host overlay.
    _lastReactAt = DateTime.now().toUtc().toIso8601String();
    _chatPoll?.cancel();
    _chatPoll = Timer.periodic(const Duration(seconds: 3), (_) => _pollRoom());
  }

  /// One overlay poll: new chat lines, fresh reactions (as floating emoji),
  /// and the live viewer count.
  Future<void> _pollRoom() async {
    final id = _streamId;
    if (id == null || !mounted) return;
    final repo = context.read<AppState>().repo;
    try {
      final msgs = await repo.liveChat(id, sinceIso: _lastChatAt);
      if (mounted && msgs.isNotEmpty) {
        final known = {for (final l in _lines) l.id};
        final news = [for (final m in msgs) if (!known.contains(m.id)) m];
        if (news.isNotEmpty) {
          setState(() {
            _lines.addAll(news);
            _lastChatAt = news.last.createdAt.toUtc().toIso8601String();
          });
          _scrollChat();
        }
      }
    } catch (_) {}
    try {
      final n = await repo.liveReactionCount(id, sinceIso: _lastReactAt);
      _lastReactAt = DateTime.now().toUtc().toIso8601String();
      if (mounted && n > 0) {
        for (var i = 0; i < min(n, 8); i++) {
          _spawnFloat(_hostEmojis[Random().nextInt(_hostEmojis.length)]);
        }
      }
    } catch (_) {}
    try {
      final s = await repo.refreshStream(id);
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

  Future<void> _sendChat() async {
    final id = _streamId;
    final t = _chat.text.trim();
    if (id == null || t.isEmpty || _sending) return;
    setState(() => _sending = true);
    _chat.clear();
    try {
      final msg = await context.read<AppState>().repo.sendLiveChat(id, t);
      if (msg != null && mounted) {
        setState(() {
          _lines.add(msg);
          _lastChatAt = msg.createdAt.toUtc().toIso8601String();
        });
        _scrollChat();
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _spawnFloat(String emoji) {
    final key = UniqueKey();
    setState(() {
      _floats.add(_HostFloatingReaction(
        key: key,
        emoji: emoji,
        startX: Random().nextDouble(),
        onDone: () {
          if (mounted) {
            setState(() => _floats.removeWhere((f) => f.key == key));
          }
        },
      ));
    });
  }

  void _onStreamError(String reason) {
    if (!mounted) return;
    setState(() {
      _busy = false;
      _error = reason;
      if (_stage == _Stage.live) _stage = _Stage.preview;
    });
    _ticker?.cancel();
  }

  Future<void> _end() async {
    setState(() => _busy = true);
    _ticker?.cancel();
    _chatPoll?.cancel();
    try {
      await _controller?.stopStreaming();
    } catch (_) {}
    final id = _streamId;
    if (id != null) {
      try {
        await context.read<AppState>().api.liveEnd(id);
      } catch (_) {}
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(tr(context, "Broadcast ended — replay saves shortly.",
              "Live ပြီးပါပြီ — replay ခဏအတွင်း တက်ပါမယ်။")),
          backgroundColor: GwColors.primary,
        ),
      );
      Navigator.of(context).pop();
    }
  }

  String get _clock {
    final m = _elapsed.inMinutes.toString().padLeft(2, "0");
    final s = (_elapsed.inSeconds % 60).toString().padLeft(2, "0");
    final h = _elapsed.inHours;
    return h > 0 ? "$h:$m:$s" : "$m:$s";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.darkBg,
      appBar: _stage == _Stage.live
          ? null
          : AppBar(
              backgroundColor: GwColors.darkBg,
              foregroundColor: Colors.white,
              title: const Text("Go Live"),
              titleTextStyle: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800),
            ),
      body: _stage == _Stage.setup ? _setupBody() : _cameraBody(),
    );
  }

  // --- Stage 1: title ---------------------------------------------------------

  Widget _setupBody() {
    final me = context.watch<AppState>().me;
    final name = me?.displayName ?? "Gwave user";
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                GwAvatar(url: resolveMedia(me?.avatarUrl), name: name, size: 46),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15)),
                ),
                const GwPill(
                    label: "LIVE",
                    color: GwColors.live,
                    filled: true,
                    icon: Icons.circle),
              ],
            ),
            const SizedBox(height: 24),
            TextField(
              controller: _title,
              maxLength: 120,
              style: const TextStyle(color: Colors.white, fontSize: 16),
              decoration: InputDecoration(
                labelText: tr(context, "Broadcast title", "Live ခေါင်းစဉ်"),
                labelStyle: const TextStyle(color: Colors.white70),
                counterStyle: const TextStyle(color: Colors.white38),
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.06),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(GwRadius.md),
                  borderSide:
                      BorderSide(color: Colors.white.withValues(alpha: 0.15)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(GwRadius.md),
                  borderSide: const BorderSide(color: GwColors.primaryBright),
                ),
              ),
            ),
            const SizedBox(height: 6),
            SwitchListTile(
              value: _shareLocation,
              activeColor: GwColors.primaryBright,
              contentPadding: EdgeInsets.zero,
              title: Text(
                tr(context, "📍 Share my location", "📍 တည်နေရာ တွဲပြမည်"),
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                tr(context, "Viewers see where you're broadcasting from.",
                    "ဘယ်နေရာက လွှင့်နေလဲ ကြည့်သူတွေ မြင်ရပါမယ်။"),
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              onChanged: (v) => setState(() => _shareLocation = v),
            ),
            const Spacer(),
            if (_error != null) ...[
              Text(_error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: GwColors.live, fontSize: 13)),
              const SizedBox(height: 10),
            ],
            SizedBox(
              height: 56,
              child: ElevatedButton.icon(
                onPressed: _busy ? null : _prepare,
                style: ElevatedButton.styleFrom(
                  backgroundColor: GwColors.live,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(GwRadius.md)),
                ),
                icon: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            valueColor:
                                AlwaysStoppedAnimation(Colors.white)))
                    : const Icon(Icons.videocam, size: 22),
                label: Text(
                    _busy
                        ? tr(context, "Preparing…", "ပြင်ဆင်နေသည်…")
                        : tr(context, "Open camera", "ကင်မရာ ဖွင့်မည်"),
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w800)),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              tr(
                  context,
                  "Streams from your phone camera — viewers watch in the Live "
                      "tab and on the web.",
                  "ဖုန်းကင်မရာကနေ တိုက်ရိုက် လွှင့်ပါမယ် — ကြည့်သူတွေ Live tab "
                      "နဲ့ web မှာ မြင်ရပါမယ်။"),
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }

  // --- Stage 2/3: camera preview + live -----------------------------------------

  Widget _cameraBody() {
    final c = _controller;
    if (c == null) return const SizedBox.shrink();
    final live = _stage == _Stage.live;
    return Stack(
      fit: StackFit.expand,
      children: [
        ApiVideoCameraPreview(controller: c),

        // Viewers' reactions float up along the right edge while live.
        if (live)
          Positioned(
            right: 8,
            bottom: 170,
            top: 80,
            width: 120,
            child: Stack(children: List.of(_floats)),
          ),

        // Top bar: LIVE badge + timer (or PREVIEW), close on preview.
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: live
                        ? GwColors.live
                        : Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(live ? Icons.circle : Icons.visibility_outlined,
                          color: Colors.white, size: 11),
                      const SizedBox(width: 6),
                      Text(
                        live
                            ? "LIVE · $_clock"
                            : tr(context, "PREVIEW", "PREVIEW"),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 13),
                      ),
                    ],
                  ),
                ),
                if (live) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.visibility,
                            color: Colors.white, size: 13),
                        const SizedBox(width: 4),
                        Text("$_viewers",
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 13)),
                      ],
                    ),
                  ),
                ],
                const Spacer(),
                if (!live)
                  InkWell(
                    onTap: _busy
                        ? null
                        : () async {
                            await _controller?.stop();
                            final id = _streamId;
                            if (id != null) {
                              context
                                  .read<AppState>()
                                  .api
                                  .liveEnd(id)
                                  .catchError((_) {});
                            }
                            if (mounted) Navigator.of(context).pop();
                          },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close,
                          color: Colors.white, size: 20),
                    ),
                  ),
              ],
            ),
          ),
        ),

        // Error banner
        if (_error != null)
          Positioned(
            left: 16,
            right: 16,
            top: 90,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(GwRadius.sm),
              ),
              child: Text(_error!,
                  textAlign: TextAlign.center,
                  style:
                      const TextStyle(color: GwColors.live, fontSize: 13)),
            ),
          ),

        // Bottom controls
        SafeArea(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The room: viewers' comments overlay while broadcasting.
                  if (live && _lines.isNotEmpty) ...[
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 190),
                      child: ListView.builder(
                        controller: _chatScroll,
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        itemCount: _lines.length,
                        itemBuilder: (_, i) => _chatBubble(_lines[i]),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _roundBtn(
                        icon: _muted ? Icons.mic_off : Icons.mic,
                        active: !_muted,
                        onTap: () async {
                          await _controller?.toggleMute();
                          if (mounted) setState(() => _muted = !_muted);
                        },
                      ),
                      if (live) ...[
                        const SizedBox(width: 40),
                        _roundBtn(
                          icon: _chatOpen
                              ? Icons.chat_bubble
                              : Icons.chat_bubble_outline,
                          active: true,
                          onTap: () =>
                              setState(() => _chatOpen = !_chatOpen),
                        ),
                      ],
                      const SizedBox(width: 40),
                      _roundBtn(
                        icon: Icons.cameraswitch_outlined,
                        active: true,
                        onTap: () => _controller?.switchCamera(),
                      ),
                    ],
                  ),
                  if (live && _chatOpen) ...[
                    const SizedBox(height: 12),
                    _hostChatInput(),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: live
                        ? ElevatedButton.icon(
                            onPressed: _busy ? null : _end,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: GwColors.live,
                              shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(GwRadius.md)),
                            ),
                            icon: const Icon(Icons.stop_circle_outlined,
                                size: 22),
                            label: Text(
                                tr(context, "End broadcast", "Live ရပ်မည်"),
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                          )
                        : ElevatedButton.icon(
                            onPressed: _busy ? null : _start,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: GwColors.live,
                              shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(GwRadius.md)),
                            ),
                            icon: _busy
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2.4,
                                        valueColor: AlwaysStoppedAnimation(
                                            Colors.white)))
                                : const Icon(Icons.sensors, size: 22),
                            label: Text(
                                _busy
                                    ? tr(context, "Connecting…",
                                        "ချိတ်ဆက်နေသည်…")
                                    : tr(context, "🔴 Start live",
                                        "🔴 Live စတင်မည်"),
                                style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800)),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
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

  Widget _hostChatInput() {
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
              decoration: InputDecoration(
                hintText: tr(context, "Reply to viewers…",
                    "ကြည့်သူများကို ပြန်ဖြေရန်…"),
                hintStyle: const TextStyle(color: Colors.white54),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: false,
                isDense: true,
              ),
              onSubmitted: (_) => _sendChat(),
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
            onPressed: _sendChat,
          ),
        ],
      ),
    );
  }

  Widget _roundBtn({
    required IconData icon,
    required bool active,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(30),
      onTap: onTap,
      child: Container(
        width: 54,
        height: 54,
        decoration: BoxDecoration(
          color: active
              ? Colors.white.withValues(alpha: 0.15)
              : GwColors.live.withValues(alpha: 0.8),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
    );
  }
}

/// A single emoji that floats up, drifts sideways and fades — the same
/// heart-burst effect viewers see, mirrored on the host's screen.
class _HostFloatingReaction extends StatefulWidget {
  const _HostFloatingReaction({
    super.key,
    required this.emoji,
    required this.startX,
    required this.onDone,
  });

  final String emoji;
  final double startX; // 0..1 within the float column
  final VoidCallback onDone;

  @override
  State<_HostFloatingReaction> createState() => _HostFloatingReactionState();
}

class _HostFloatingReactionState extends State<_HostFloatingReaction>
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
