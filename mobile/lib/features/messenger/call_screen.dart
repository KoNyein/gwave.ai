import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:provider/provider.dart';

import '../../core/call_service.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Full-screen active/outgoing call UI (audio or video). Pushed when a call
/// becomes non-idle and popped when it ends.
class CallScreen extends StatelessWidget {
  const CallScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final call = context.watch<CallService>();
    // The call ended elsewhere — leave the screen.
    if (call.phase == CallPhase.idle) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (Navigator.of(context).canPop()) Navigator.of(context).pop();
      });
    }

    final name = call.peer?.displayName ?? "Gwave user";
    final statusText = switch (call.phase) {
      CallPhase.outgoing => "Ringing…",
      CallPhase.connecting => "Connecting…",
      CallPhase.active => call.durationLabel,
      _ => "",
    };

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1F0B),
        body: Stack(
          children: [
            // Remote video fills the screen when it's a connected video call.
            if (call.video && call.remoteReady)
              Positioned.fill(
                child: RTCVideoView(
                  call.remoteRenderer,
                  objectFit:
                      RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  filterQuality: FilterQuality.medium,
                ),
              )
            // Before the remote arrives, fill the screen with our own camera so
            // a video call shows a correctly-sized picture right away instead of
            // a blank gradient.
            else if (call.video)
              Positioned.fill(
                child: RTCVideoView(
                  call.localRenderer,
                  mirror: true,
                  objectFit:
                      RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                  filterQuality: FilterQuality.medium,
                ),
              )
            else
              Positioned.fill(
                child: Container(
                  decoration: const BoxDecoration(
                      gradient: GwColors.primaryGradient),
                ),
              ),

            // Minimize: drop back into the app while the call keeps going.
            Positioned(
              top: 46,
              left: 12,
              child: SafeArea(
                child: InkWell(
                  onTap: () => Navigator.of(context).pop(),
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    padding: const EdgeInsets.all(9),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.35),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.keyboard_arrow_down,
                        color: Colors.white, size: 26),
                  ),
                ),
              ),
            ),

            // Local preview (video only), top-right.
            if (call.video)
              Positioned(
                top: 50,
                right: 16,
                width: 108,
                height: 152,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    color: Colors.black26,
                    child: RTCVideoView(
                      call.localRenderer,
                      mirror: true,
                      objectFit:
                          RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
                    ),
                  ),
                ),
              ),

            // Header: peer + status (hidden behind a scrim for readability).
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.45),
                      Colors.transparent,
                    ],
                  ),
                ),
                child: Column(
                  children: [
                    if (!call.video || !call.remoteReady) ...[
                      GwAvatar(
                          url: resolveMedia(call.peer?.avatarUrl),
                          name: name,
                          size: 96),
                      const SizedBox(height: 16),
                    ],
                    Text(name,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text(statusText,
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 14)),
                  ],
                ),
              ),
            ),

            // Controls
            Positioned(
              left: 0,
              right: 0,
              bottom: 40,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _round(
                    icon: call.muted ? Icons.mic_off : Icons.mic,
                    label: "Mute",
                    active: call.muted,
                    onTap: call.toggleMute,
                  ),
                  const SizedBox(width: 18),
                  _round(
                    icon: call.speakerOn
                        ? Icons.volume_up
                        : Icons.hearing,
                    label: "Speaker",
                    active: call.speakerOn,
                    onTap: call.toggleSpeaker,
                  ),
                  if (call.video) ...[
                    const SizedBox(width: 18),
                    _round(
                      icon: call.cameraOff
                          ? Icons.videocam_off
                          : Icons.videocam,
                      label: "Camera",
                      active: call.cameraOff,
                      onTap: call.toggleCamera,
                    ),
                    const SizedBox(width: 18),
                    _round(
                      icon: Icons.cameraswitch,
                      label: "Flip",
                      onTap: call.switchCamera,
                    ),
                  ],
                  const SizedBox(width: 18),
                  _round(
                    icon: Icons.call_end,
                    label: "End",
                    bg: GwColors.live,
                    onTap: call.hangUp,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _round({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool active = false,
    Color? bg,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(40),
          onTap: onTap,
          child: Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(
              color: bg ??
                  (active
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.22)),
              shape: BoxShape.circle,
            ),
            child: Icon(icon,
                color: bg != null
                    ? Colors.white
                    : (active ? GwColors.ink : Colors.white),
                size: 27),
          ),
        ),
        const SizedBox(height: 6),
        Text(label,
            style: const TextStyle(color: Colors.white70, fontSize: 11)),
      ],
    );
  }
}

/// Full-screen incoming-call ringer with accept / decline. Shown by the global
/// call overlay when a ring arrives.
class IncomingCallSheet extends StatelessWidget {
  const IncomingCallSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final call = context.watch<CallService>();
    final name = call.peer?.displayName ?? "Gwave user";
    return Scaffold(
      backgroundColor: const Color(0xFF0B1F0B),
      body: Container(
        decoration: const BoxDecoration(gradient: GwColors.primaryGradient),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(),
              GwAvatar(
                  url: resolveMedia(call.peer?.avatarUrl), name: name, size: 120),
              const SizedBox(height: 22),
              Text(name,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text(
                call.video ? "📹 Incoming video call…" : "📞 Incoming call…",
                style: const TextStyle(color: Colors.white70, fontSize: 15),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.only(bottom: 50),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _bigButton(
                      icon: Icons.call_end,
                      label: "Decline",
                      bg: GwColors.live,
                      onTap: call.decline,
                    ),
                    _bigButton(
                      icon: Icons.call,
                      label: "Accept",
                      bg: const Color(0xFF22C55E),
                      onTap: call.accept,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _bigButton({
    required IconData icon,
    required String label,
    required Color bg,
    required VoidCallback onTap,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(48),
          onTap: onTap,
          child: Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            child: Icon(icon, color: Colors.white, size: 34),
          ),
        ),
        const SizedBox(height: 10),
        Text(label,
            style: const TextStyle(color: Colors.white, fontSize: 13)),
      ],
    );
  }
}

/// Drives call navigation: pushes the incoming ringer / active call screen as
/// the call phase changes. Wrap the app body with this once.
class CallOverlay extends StatefulWidget {
  const CallOverlay({super.key, required this.child});
  final Widget child;

  @override
  State<CallOverlay> createState() => _CallOverlayState();
}

class _CallOverlayState extends State<CallOverlay>
    with WidgetsBindingObserver {
  CallPhase _last = CallPhase.idle;
  bool _routeOpen = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Android kills the Realtime socket in background; rebuild the ring inbox
    // the moment the app comes back so calls ring again.
    if (state == AppLifecycleState.resumed) {
      // Force a rebuild: a socket silently dropped in the background can still
      // read "ready", so trust nothing and re-establish the ring inbox.
      context.read<CallService>().ensureConnected(force: true);
    }
  }

  /// Looping ringtone (incoming) / ringback (outgoing) + vibration pulses.
  final AudioPlayer _ring = AudioPlayer();
  Timer? _vibrate;

  void _updateRing(CallPhase phase) {
    _vibrate?.cancel();
    _vibrate = null;
    if (phase == CallPhase.incoming) {
      _ring.setReleaseMode(ReleaseMode.loop);
      _ring.play(AssetSource("ringtone.wav"), volume: 1.0);
      HapticFeedback.vibrate();
      _vibrate = Timer.periodic(
          const Duration(milliseconds: 1200), (_) => HapticFeedback.vibrate());
    } else if (phase == CallPhase.outgoing) {
      _ring.setReleaseMode(ReleaseMode.loop);
      _ring.play(AssetSource("ringback.wav"), volume: 0.6);
    } else {
      _ring.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _vibrate?.cancel();
    _ring.dispose();
    super.dispose();
  }

  /// The user minimized the call screen to keep using the app; the media keeps
  /// flowing in CallService and a floating pill brings the screen back.
  bool _minimized = false;

  static bool _inCall(CallPhase p) =>
      p == CallPhase.outgoing ||
      p == CallPhase.connecting ||
      p == CallPhase.active;

  @override
  Widget build(BuildContext context) {
    final call = context.watch<CallService>();
    final phase = call.phase;
    if (phase != _last) {
      _last = phase;
      if (!_inCall(phase)) _minimized = false;
      _updateRing(phase);
      WidgetsBinding.instance.addPostFrameCallback((_) => _sync(phase));
    }
    return Stack(
      children: [
        widget.child,
        if (_minimized && _inCall(phase))
          Positioned(
            left: 12,
            right: 12,
            bottom: 92,
            child: SafeArea(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () {
                    setState(() => _minimized = false);
                    _sync(phase);
                  },
                  borderRadius: BorderRadius.circular(26),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 11),
                    decoration: BoxDecoration(
                      gradient: GwColors.primaryGradient,
                      borderRadius: BorderRadius.circular(26),
                      boxShadow: GwShadow.card,
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.phone_in_talk,
                            color: Colors.white, size: 19),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "${call.peer?.displayName ?? "Call"} · ${call.phase == CallPhase.active ? call.durationLabel : "Ringing…"} — ဖုန်းပြန်ဖွင့်ရန် နှိပ်ပါ",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13),
                          ),
                        ),
                        const Icon(Icons.open_in_full,
                            color: Colors.white70, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  void _sync(CallPhase phase) {
    if (!mounted) return;
    final nav = Navigator.of(context, rootNavigator: true);
    if (phase == CallPhase.incoming && !_routeOpen) {
      _minimized = false;
      _routeOpen = true;
      nav
          .push(MaterialPageRoute(
              fullscreenDialog: true,
              builder: (_) => const _CallRouter()))
          .then((_) {
        _routeOpen = false;
        _afterRouteClosed();
      });
    } else if (_inCall(phase) && !_routeOpen && !_minimized) {
      _routeOpen = true;
      nav
          .push(MaterialPageRoute(
              fullscreenDialog: true,
              builder: (_) => const _CallRouter()))
          .then((_) {
        _routeOpen = false;
        _afterRouteClosed();
      });
    }
  }

  /// The call route was popped. If the call is still running, the user chose
  /// to minimize — show the floating pill instead of re-opening the screen.
  void _afterRouteClosed() {
    if (!mounted) return;
    final phase = context.read<CallService>().phase;
    if (_inCall(phase)) {
      setState(() => _minimized = true);
    }
  }
}

/// Shows the ringer while incoming, otherwise the active call UI.
class _CallRouter extends StatelessWidget {
  const _CallRouter();

  @override
  Widget build(BuildContext context) {
    final phase = context.watch<CallService>().phase;
    if (phase == CallPhase.idle) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (Navigator.of(context).canPop()) Navigator.of(context).pop();
      });
      return const SizedBox.shrink();
    }
    return phase == CallPhase.incoming
        ? const IncomingCallSheet()
        : const CallScreen();
  }
}
