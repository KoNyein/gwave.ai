import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:realtime_client/realtime_client.dart';

import 'api_client.dart';
import 'config.dart';
import 'models.dart';
import 'repository.dart';

/// Native 1:1 messenger calls — WebRTC media with Supabase Realtime broadcast
/// signaling. The protocol matches the web client exactly, so an app user and
/// a browser user can call each other:
///
///   caller                                 callee
///   ── ring ──────────▶ calls:{calleeId}   (personal ring inbox)
///                       call:{callId} ◀── accept ──
///   ── offer ─────────▶
///                       ◀── answer ──
///   ◀─ ice ─▶  (trickle, both ways)
///   ── hangup ────────▶  (either side)
enum CallPhase { idle, incoming, outgoing, connecting, active }

class CallService extends ChangeNotifier {
  CallService(this.api, this.repo);

  final ApiClient api;
  final Repository repo;

  RealtimeClient? _rt;
  RealtimeChannel? _ringInbox;
  RealtimeChannel? _callChannel; // per-call `call:{callId}`
  RealtimeChannel? _peerRing; // caller → `calls:{peerId}`

  RTCPeerConnection? _pc;
  MediaStream? _localStream;
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();
  RTCVideoRenderer get localRenderer => _localRenderer;
  RTCVideoRenderer get remoteRenderer => _remoteRenderer;

  CallPhase phase = CallPhase.idle;
  Profile? peer;
  String? _callId;
  String? _conversationId;
  bool _isCaller = false;
  bool video = false;
  bool muted = false;
  bool cameraOff = false;
  bool remoteReady = false;

  DateTime? _connectedAt;
  Timer? _durationTimer;
  Timer? _ringTimer;
  int durationSecs = 0;
  final List<RTCIceCandidate> _pendingIce = [];
  bool _remoteDescSet = false;
  bool _renderersReady = false;

  String get _myId => api.session!.profileId;
  bool get inCall => phase != CallPhase.idle;

  static const _fallbackIce = {
    "iceServers": [
      {"urls": "stun:stun.l.google.com:19302"},
      {"urls": "stun:stun1.l.google.com:19302"},
    ],
  };

  /// Runtime ICE config from the server — carries the TURN relay both peers
  /// need behind carrier NAT (STUN-only calls connect but stay silent).
  Map<String, dynamic>? _fetchedIce;

  Future<Map<String, dynamic>> _iceConfig() async {
    if (_fetchedIce != null) return _fetchedIce!;
    try {
      final servers = await api.iceServers();
      if (servers.isNotEmpty) {
        _fetchedIce = {"iceServers": servers};
        return _fetchedIce!;
      }
    } catch (_) {
      // offline or old server — fall back to STUN only
    }
    return _fallbackIce;
  }

  // ---- Realtime connection --------------------------------------------------

  /// Connect to Realtime and subscribe to our personal ring inbox. Call once
  /// after sign-in; safe to call again (no-op if already connected).
  /// Ring-inbox health, shown in Settings so "calls never ring" is visible
  /// instead of a silent mystery: connecting → ready | error…
  String ringStatus = "off";
  Timer? _reconnect;

  void _setRing(String s) {
    if (ringStatus == s) return;
    ringStatus = s;
    notifyListeners();
  }

  void _scheduleReconnect() {
    _reconnect ??= Timer(const Duration(seconds: 8), () {
      _reconnect = null;
      if (!inCall) ensureConnected();
    });
  }

  /// Rebuild the socket + inbox unless they're already healthy. Called on app
  /// resume and after channel errors — Android kills sockets in background.
  Future<void> ensureConnected() async {
    if (api.session == null || inCall) return;
    if (ringStatus == "ready") return;
    try {
      if (_ringInbox != null) _rt?.removeChannel(_ringInbox!);
    } catch (_) {}
    try {
      _rt?.disconnect();
    } catch (_) {}
    _ringInbox = null;
    _rt = null;
    await connect();
  }

  Future<void> connect() async {
    if (_ringInbox != null || api.session == null) return;
    try {
      _setRing("connecting");
      await api.freshToken(); // ensure the JWT is valid before we auth realtime
      final token = api.session!.token;
      _rt = RealtimeClient(
        AppConfig.realtimeUrl,
        params: {"apikey": AppConfig.supabaseAnonKey},
      );
      _rt!.setAuth(token);
      _rt!.onClose((_) {
        _setRing("reconnecting");
        _scheduleReconnect();
      });
      _rt!.onError((e) {
        _setRing("socket error");
        _scheduleReconnect();
      });
      _rt!.connect();

      final inbox = _rt!.channel("calls:$_myId");
      inbox
        ..onBroadcast(event: "ring", callback: _onRing)
        ..onBroadcast(event: "cancel", callback: _onCancel);
      inbox.subscribe((status, [error]) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          _setRing("ready");
        } else if (status == RealtimeSubscribeStatus.channelError ||
            status == RealtimeSubscribeStatus.timedOut) {
          _setRing("error: ${error ?? status.name}");
          _scheduleReconnect();
        } else if (status == RealtimeSubscribeStatus.closed) {
          _setRing("closed");
        }
      });
      _ringInbox = inbox;

      // The data token expires; a reconnect with the stale token silently
      // kills the ring inbox until app restart. Refresh the socket auth well
      // inside the token lifetime.
      _authRefresh?.cancel();
      _authRefresh = Timer.periodic(const Duration(minutes: 20), (_) async {
        try {
          await api.freshToken();
          final t = api.session?.token;
          if (t != null) _rt?.setAuth(t);
        } catch (_) {
          // offline — the next tick retries
        }
      });
    } catch (e) {
      // Calls just won't ring; the rest of the app is unaffected.
      _setRing("error: $e");
      _scheduleReconnect();
    }
  }

  Timer? _authRefresh;

  Future<void> _ensureRenderers() async {
    if (_renderersReady) return;
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
    _renderersReady = true;
  }

  // ---- Incoming -------------------------------------------------------------

  void _onRing(Map<String, dynamic> payload) {
    if (inCall) return; // busy — let it ring out on the caller's side
    final from = payload["from"];
    final callId = payload["callId"]?.toString();
    final convo = payload["conversationId"]?.toString();
    if (from is! Map || callId == null || convo == null) return;
    if (from["id"]?.toString() == _myId) return; // our own broadcast

    _callId = callId;
    _conversationId = convo;
    video = payload["video"] == true;
    peer = Profile.fromJson(Map<String, dynamic>.from(from));
    _isCaller = false;
    phase = CallPhase.incoming;
    // Ring out if the caller vanishes without cancelling.
    _ringTimer?.cancel();
    _ringTimer = Timer(const Duration(seconds: 50), () {
      if (phase == CallPhase.incoming) _teardown(log: false);
    });
    notifyListeners();
  }

  void _onCancel(Map<String, dynamic> payload) {
    if (phase == CallPhase.incoming &&
        payload["callId"]?.toString() == _callId) {
      _teardown(log: false);
    }
  }

  // ---- Outgoing -------------------------------------------------------------

  /// Start a call to [target] in [conversationId]. Returns false if mic/camera
  /// permission was denied.
  Future<bool> startCall(
    Profile target,
    String conversationId, {
    required bool withVideo,
  }) async {
    if (inCall) return false;
    if (!await _grantPermissions(withVideo)) return false;

    await connect();
    await _ensureRenderers();
    _callId = "${DateTime.now().microsecondsSinceEpoch}-$_myId";
    _conversationId = conversationId;
    peer = target;
    video = withVideo;
    _isCaller = true;
    phase = CallPhase.outgoing;
    notifyListeners();

    // Our own per-call channel: listen for the callee's accept/answer/ice.
    _joinCallChannel(_callId!);
    await _openMedia();

    // Ring the callee's inbox.
    _peerRing = _rt!.channel("calls:${target.id}");
    _peerRing!.subscribe((status, [error]) {
      if (status == RealtimeSubscribeStatus.subscribed) {
        _peerRing!.sendBroadcastMessage(event: "ring", payload: {
          "callId": _callId,
          "conversationId": conversationId,
          "video": withVideo,
          "from": {
            "id": _myId,
            "username": null,
            "full_name": null,
            "avatar_url": null,
          },
        });
      }
    });

    // Give up after 45s of ringing (logs a missed call).
    _ringTimer?.cancel();
    _ringTimer = Timer(const Duration(seconds: 45), () {
      if (phase == CallPhase.outgoing) {
        _peerRing?.sendBroadcastMessage(
            event: "cancel", payload: {"callId": _callId});
        _teardown(log: true);
      }
    });
    return true;
  }

  // ---- Accept / decline -----------------------------------------------------

  Future<void> accept() async {
    if (phase != CallPhase.incoming) return;
    if (!await _grantPermissions(video)) {
      decline();
      return;
    }
    await _ensureRenderers();
    _ringTimer?.cancel();
    phase = CallPhase.connecting;
    notifyListeners();

    _joinCallChannel(_callId!);
    await _openMedia();
    // Tell the caller we picked up — they create and send the offer.
    _callChannel!.sendBroadcastMessage(event: "accept", payload: {});
  }

  void decline() {
    _callChannel?.sendBroadcastMessage(event: "decline", payload: {});
    // In the incoming state the call channel may not be joined yet — reply on a
    // freshly joined channel so the caller stops ringing.
    if (_callChannel == null && _callId != null) {
      final ch = _rt!.channel("call:$_callId");
      ch.subscribe((status, [_]) {
        if (status == RealtimeSubscribeStatus.subscribed) {
          ch.sendBroadcastMessage(event: "decline", payload: {});
        }
      });
    }
    _teardown(log: false);
  }

  void hangUp() {
    _callChannel?.sendBroadcastMessage(event: "hangup", payload: {});
    _peerRing?.sendBroadcastMessage(event: "cancel", payload: {"callId": _callId});
    _teardown(log: true);
  }

  // ---- Call channel wiring --------------------------------------------------

  void _joinCallChannel(String callId) {
    final ch = _rt!.channel("call:$callId");
    ch
      ..onBroadcast(event: "accept", callback: (_) => _onAccept())
      ..onBroadcast(event: "offer", callback: _onOffer)
      ..onBroadcast(event: "answer", callback: _onAnswer)
      ..onBroadcast(event: "ice", callback: _onIce)
      ..onBroadcast(event: "decline", callback: (_) => _teardown(log: true))
      ..onBroadcast(event: "hangup", callback: (_) => _teardown(log: true));
    ch.subscribe();
    _callChannel = ch;
  }

  Future<void> _onAccept() async {
    // Caller side: the callee picked up → create and send the offer.
    if (!_isCaller || _pc == null) return;
    phase = CallPhase.connecting;
    notifyListeners();
    final offer = await _pc!.createOffer();
    await _pc!.setLocalDescription(offer);
    _callChannel!.sendBroadcastMessage(event: "offer", payload: {
      "sdp": {"type": offer.type, "sdp": offer.sdp},
    });
  }

  Future<void> _onOffer(Map<String, dynamic> payload) async {
    if (_isCaller || _pc == null) return;
    final sdp = payload["sdp"];
    if (sdp is! Map) return;
    await _pc!.setRemoteDescription(
        RTCSessionDescription(sdp["sdp"]?.toString(), sdp["type"]?.toString()));
    _remoteDescSet = true;
    await _drainIce();
    final answer = await _pc!.createAnswer();
    await _pc!.setLocalDescription(answer);
    _callChannel!.sendBroadcastMessage(event: "answer", payload: {
      "sdp": {"type": answer.type, "sdp": answer.sdp},
    });
  }

  Future<void> _onAnswer(Map<String, dynamic> payload) async {
    if (_pc == null) return;
    final sdp = payload["sdp"];
    if (sdp is! Map) return;
    await _pc!.setRemoteDescription(
        RTCSessionDescription(sdp["sdp"]?.toString(), sdp["type"]?.toString()));
    _remoteDescSet = true;
    await _drainIce();
  }

  Future<void> _onIce(Map<String, dynamic> payload) async {
    final c = payload["candidate"];
    if (c is! Map) return;
    final cand = RTCIceCandidate(
      c["candidate"]?.toString(),
      c["sdpMid"]?.toString(),
      (c["sdpMLineIndex"] as num?)?.toInt(),
    );
    if (_remoteDescSet) {
      await _pc?.addCandidate(cand);
    } else {
      _pendingIce.add(cand);
    }
  }

  Future<void> _drainIce() async {
    for (final c in _pendingIce) {
      await _pc?.addCandidate(c);
    }
    _pendingIce.clear();
  }

  // ---- Media ----------------------------------------------------------------

  Future<void> _openMedia() async {
    _pc = await createPeerConnection(await _iceConfig());
    speakerOn = video; // video → loudspeaker, voice → earpiece
    Helper.setSpeakerphoneOn(speakerOn);
    _localStream = await navigator.mediaDevices.getUserMedia({
      "audio": true,
      "video": video
          ? {"facingMode": "user", "optional": []}
          : false,
    });
    _localRenderer.srcObject = _localStream;
    for (final track in _localStream!.getTracks()) {
      await _pc!.addTrack(track, _localStream!);
    }

    _pc!.onIceCandidate = (cand) {
      _callChannel?.sendBroadcastMessage(event: "ice", payload: {
        "candidate": {
          "candidate": cand.candidate,
          "sdpMid": cand.sdpMid,
          "sdpMLineIndex": cand.sdpMLineIndex,
        },
      });
    };
    _pc!.onTrack = (event) {
      if (event.streams.isNotEmpty) {
        _remoteRenderer.srcObject = event.streams.first;
        remoteReady = true;
        notifyListeners();
      }
    };
    _pc!.onConnectionState = (s) {
      if (s == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
        _connectedAt ??= DateTime.now();
        phase = CallPhase.active;
        _durationTimer ??= Timer.periodic(const Duration(seconds: 1), (_) {
          durationSecs =
              DateTime.now().difference(_connectedAt!).inSeconds;
          notifyListeners();
        });
        notifyListeners();
      } else if (s == RTCPeerConnectionState.RTCPeerConnectionStateFailed ||
          s == RTCPeerConnectionState.RTCPeerConnectionStateClosed) {
        _teardown(log: true);
      }
    };
    notifyListeners();
  }

  // ---- Controls -------------------------------------------------------------

  void toggleMute() {
    muted = !muted;
    for (final t in _localStream?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = !muted;
    }
    notifyListeners();
  }

  void toggleCamera() {
    cameraOff = !cameraOff;
    for (final t in _localStream?.getVideoTracks() ?? <MediaStreamTrack>[]) {
      t.enabled = !cameraOff;
    }
    notifyListeners();
  }

  void switchCamera() {
    final tracks = _localStream?.getVideoTracks() ?? [];
    if (tracks.isNotEmpty) Helper.switchCamera(tracks.first);
  }

  /// Speakerphone routing. Audio calls default to the earpiece (quiet, easy to
  /// mistake for silence); video calls default to the loudspeaker.
  bool speakerOn = false;

  void toggleSpeaker() {
    speakerOn = !speakerOn;
    Helper.setSpeakerphoneOn(speakerOn);
    notifyListeners();
  }

  // ---- Teardown -------------------------------------------------------------

  Future<void> _teardown({required bool log}) async {
    final wasCaller = _isCaller;
    final convo = _conversationId;
    final wasVideo = video;
    final connected = _connectedAt;

    _ringTimer?.cancel();
    _durationTimer?.cancel();
    _ringTimer = null;
    _durationTimer = null;

    try {
      await _localStream?.dispose();
    } catch (_) {}
    try {
      await _pc?.close();
    } catch (_) {}
    if (_callChannel != null) _rt?.removeChannel(_callChannel!);
    if (_peerRing != null) _rt?.removeChannel(_peerRing!);
    _pc = null;
    _localStream = null;
    _localRenderer.srcObject = null;
    _remoteRenderer.srcObject = null;
    _callChannel = null;
    _peerRing = null;
    _pendingIce.clear();
    _remoteDescSet = false;
    remoteReady = false;

    // One call-log message per call, written by the caller (mirrors the web).
    if (log && wasCaller && convo != null) {
      final kind = wasVideo ? "Video" : "Audio";
      final content = connected != null
          ? "📞 $kind call · ${_fmt(DateTime.now().difference(connected).inSeconds)}"
          : "📞 Missed $kind call";
      try {
        await repo.sendMessage(convo, content);
      } catch (_) {}
    }

    phase = CallPhase.idle;
    peer = null;
    _callId = null;
    _conversationId = null;
    _isCaller = false;
    video = false;
    muted = false;
    cameraOff = false;
    _connectedAt = null;
    durationSecs = 0;
    notifyListeners();
  }

  static String _fmt(int s) =>
      "${s ~/ 60}:${(s % 60).toString().padLeft(2, '0')}";

  String get durationLabel => _fmt(durationSecs);

  Future<bool> _grantPermissions(bool withVideo) async {
    final needed = <Permission>[Permission.microphone];
    if (withVideo) needed.add(Permission.camera);
    final result = await needed.request();
    return result.values.every((s) => s.isGranted);
  }

  @override
  void dispose() {
    _ringTimer?.cancel();
    _durationTimer?.cancel();
    _authRefresh?.cancel();
    _reconnect?.cancel();
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    if (_ringInbox != null) _rt?.removeChannel(_ringInbox!);
    _rt?.disconnect();
    super.dispose();
  }
}
