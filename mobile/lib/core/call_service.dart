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
  // Completes when the per-call channel is actually subscribed. Realtime
  // broadcast is ephemeral, so sending accept/offer/answer/ice before the
  // socket has joined silently drops them — which used to leave the caller
  // stuck on "Connecting…". Every signaling send now awaits this first.
  Completer<void>? _callChannelReady;

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

  /// Last call-setup failure, surfaced to the UI so a broken video call shows
  /// *why* instead of a silent missed call. Consumed (shown then cleared) by
  /// the call overlay.
  String? lastError;

  DateTime? _connectedAt;
  Timer? _durationTimer;
  Timer? _ringTimer;
  Timer? _reRing; // re-broadcasts the ring so a callee who reconnects catches it
  Profile? _me; // caller identity attached to the ring, so the callee sees who
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
  ///
  /// [force] rebuilds even when we still *think* we're "ready": Android can
  /// silently drop the websocket in the background without firing onClose, so
  /// the inbox reads "ready" while it's actually dead and no call ever rings.
  /// The resume path forces a rebuild to guarantee a live inbox.
  Future<void> ensureConnected({bool force = false}) async {
    if (api.session == null || inCall) return;
    if (!force && ringStatus == "ready") return;
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

  // A watchdog that keeps the ring inbox genuinely alive. Android can drop the
  // websocket without firing onClose, leaving `ringStatus` a stale "ready" while
  // no call ever rings (→ every call lands as "Missed"). The resume handler only
  // heals on app-resume; this heals while the app sits idle in the foreground.
  Timer? _ringWatchdog;
  int _watchdogTicks = 0;

  void _startRingWatchdog() {
    _ringWatchdog ??= Timer.periodic(const Duration(seconds: 25), (_) {
      if (api.session == null || inCall) return;
      _watchdogTicks++;
      // Heal immediately if the inbox is not confirmed ready; otherwise rebuild
      // on a slow backstop cadence (~100s) to shake off a silently-dead socket.
      if (ringStatus != "ready" || _watchdogTicks % 4 == 0) {
        ensureConnected(force: true);
      }
      // Diagnostics beacon (~every 100s): make this phone's call-stack state
      // visible in the server logs (`docker logs gwave-web | grep diag`), so
      // "calls don't ring" is debuggable without screenshots of the footer.
      if (_watchdogTicks % 4 == 1) {
        api.sendDiag({
          "build": AppConfig.appBuild,
          "ring": ringStatus,
          "cfgLoaded": AppConfig.runtimeLoaded,
          "hbError": Repository.lastHeartbeatError,
        });
      }
    });
  }

  Future<void> connect() async {
    _startRingWatchdog();
    if (_ringInbox != null || api.session == null) return;
    try {
      _setRing("connecting");
      // Never build the socket against the build-time fallback URL when the
      // live config is one fetch away: a stale gateway "connects" and joins
      // fine — the footer even says ready — but rings broadcast to a server
      // no other client is on, so calls die silently in both directions.
      if (!AppConfig.runtimeLoaded) await api.loadRuntimeConfig();
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
          // "cfg!" = still on the baked fallback data-plane URL — the socket
          // may be on the wrong server entirely; support can see it at a
          // glance in the Settings footer.
          _setRing(AppConfig.runtimeLoaded ? "ready" : "ready·cfg!");
        } else if (status == RealtimeSubscribeStatus.channelError ||
            status == RealtimeSubscribeStatus.timedOut) {
          _setRing("error: ${error ?? status.name}");
          _scheduleReconnect();
        } else if (status == RealtimeSubscribeStatus.closed) {
          _setRing("closed");
        }
      });
      _ringInbox = inbox;

      // Cache our own profile so the ring we send carries a name/avatar and the
      // callee's incoming screen shows who's calling. Best-effort.
      if (_me == null) {
        try {
          _me = await repo.myProfile();
        } catch (_) {
          // no cached profile — the ring still works, just without a name
        }
      }

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

  /// Re-authorise the Realtime socket with a freshly-minted token right before a
  /// call joins a channel. The data token lives on the socket from connect time;
  /// if it lapsed since (server rejects the join as `InvalidJWTToken`), the ring
  /// or the offer/answer would silently drop and the call lands as "Missed".
  Future<void> _refreshAuth() async {
    try {
      await api.freshToken();
      final t = api.session?.token;
      if (t != null) _rt?.setAuth(t);
    } catch (_) {
      // Offline or refresh failed — the join will use the current token.
    }
  }

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

  /// An incoming-call FCM data push. Field debugging (build 177) showed the
  /// realtime inbox can go deaf while still reporting "ready" — a server-side
  /// broadcast straight to this phone's inbox topic never surfaced. So the
  /// push is a ring-delivery path of its own, not just a socket wake-up: when
  /// it carries the full payload (callId — new servers), ring the UI directly.
  /// The socket is force-rebuilt first because accept/offer/answer/ice still
  /// travel over it.
  Future<void> handleCallPush(Map<String, dynamic> data) async {
    try {
      await ensureConnected(force: true);
    } catch (_) {
      // Still ring — the rebuild retries in the background.
    }
    if (inCall) return; // already ringing (realtime beat the push) or busy
    final callId = data["callId"]?.toString() ?? "";
    final convo = data["conversationId"]?.toString() ?? "";
    if (callId.isEmpty || convo.isEmpty) return; // old server: wake-up only
    _onRing({
      "callId": callId,
      "conversationId": convo,
      "video": data["video"]?.toString() == "1",
      "from": {
        "id": data["callerId"]?.toString() ?? "",
        "username": data["caller"]?.toString() ?? "",
        "full_name": data["caller"]?.toString(),
        "avatar_url": data["callerAvatar"]?.toString(),
      },
    });
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
    lastError = null;
    if (!await _grantPermissions(withVideo)) {
      lastError = withVideo
          ? "Video call needs Camera + Microphone permission (enable them in Settings › Apps › Gwave › Permissions)."
          : "Microphone permission is needed to call.";
      notifyListeners();
      return false;
    }

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
    try {
      await _openMedia();
    } catch (e) {
      // Couldn't open the camera/mic — abort cleanly so the caller sees the
      // permission snackbar instead of an uncaught error and a dead call.
      debugPrint("call: openMedia failed on start: $e");
      lastError = "Couldn't open the camera/mic: $e";
      notifyListeners();
      await _teardown(log: false);
      return false;
    }

    // Web-push/FCM the callee too, and hand the server our callId so it can
    // relay the realtime ring itself — reaches a callee whose tab/app can't
    // get OUR broadcast (closed, backgrounded, stale JS, or our own socket
    // failing to join their inbox). Best-effort. Deliberately AFTER our
    // call:{callId} channel is subscribed: a relayed ring that lands before
    // we can hear the callee's one-shot "accept" strands both sides.
    unawaited(_awaitCallChannel().then((_) => api
        .callNotify(conversationId, withVideo, callId: _callId)
        .catchError((_) {})));

    // The ring payload — carries our identity so the callee sees who's calling.
    Map<String, dynamic> ringPayload() => {
          "callId": _callId,
          "conversationId": conversationId,
          "video": withVideo,
          "from": {
            "id": _myId,
            "username": _me?.username,
            "full_name": _me?.fullName,
            "avatar_url": _me?.avatarUrl,
          },
        };

    // Ring the callee's inbox. Realtime broadcast is ephemeral — only clients
    // subscribed at that instant receive it — so we re-broadcast every 3s while
    // ringing. That way a callee whose socket was mid-reconnect, or who opens
    // the app a moment later, still catches the ring instead of the caller
    // hanging on "Ringing…". Re-auth first so the channel join is accepted.
    await _refreshAuth();
    _peerRing = _rt!.channel("calls:${target.id}");
    _peerRing!.subscribe((status, [error]) {
      if (status == RealtimeSubscribeStatus.subscribed) {
        _peerRing!.sendBroadcastMessage(event: "ring", payload: ringPayload());
      }
    });
    _reRing?.cancel();
    _reRing = Timer.periodic(const Duration(seconds: 3), (_) {
      if (phase == CallPhase.outgoing) {
        _peerRing?.sendBroadcastMessage(event: "ring", payload: ringPayload());
      } else {
        _reRing?.cancel();
        _reRing = null;
      }
    });

    // Give up after 45s of ringing (logs a missed call).
    _ringTimer?.cancel();
    _ringTimer = Timer(const Duration(seconds: 45), () {
      if (phase == CallPhase.outgoing) {
        // Relay + socket, so the callee's ringing UI clears even when this
        // socket's sends are being dropped.
        if (_callId != null) {
          api
              .callSignal(_callId!, "cancel", {"callId": _callId},
                  ringUserId: peer?.id)
              .catchError((_) {});
        }
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
    lastError = null;
    if (!await _grantPermissions(video)) {
      lastError = video
          ? "Video call needs Camera + Microphone permission (enable them in Settings › Apps › Gwave › Permissions)."
          : "Microphone permission is needed to answer.";
      notifyListeners();
      decline();
      return;
    }
    await _ensureRenderers();
    _ringTimer?.cancel();
    phase = CallPhase.connecting;
    notifyListeners();

    await _refreshAuth();
    _joinCallChannel(_callId!);
    try {
      await _openMedia();
    } catch (e) {
      // Camera/mic acquisition failed (denied camera, or the device rejected
      // the video track). Without this the "accept" below was never sent, so
      // the caller rang out to a silent missed call — the exact video-call
      // symptom. Decline cleanly so the caller stops ringing immediately.
      debugPrint("call: openMedia failed on accept: $e");
      lastError = "Couldn't open the camera/mic: $e";
      notifyListeners();
      decline();
      return;
    }
    // Tell the caller we picked up — they create and send the offer. Wait for
    // the channel to actually join first, or the accept is dropped and the
    // caller hangs on "Connecting…".
    await _signal("accept", {});
  }

  void decline() {
    // Server relay first (reliable), socket second (duplicate declines are
    // harmless — teardown on the peer is idempotent).
    if (_callId != null) {
      api.callSignal(_callId!, "decline", {}).catchError((_) {});
    }
    _callChannel?.sendBroadcastMessage(event: "decline", payload: {});
    _teardown(log: false);
  }

  void hangUp() {
    // Dual-send: hangup/cancel are idempotent on the receiver, so the relay
    // guarantees delivery even when this socket's sends are being dropped.
    if (_callId != null) {
      api
          .callSignal(_callId!, "hangup", {}, ringUserId: peer?.id)
          .catchError((_) {});
    }
    _callChannel?.sendBroadcastMessage(event: "hangup", payload: {});
    _peerRing?.sendBroadcastMessage(event: "cancel", payload: {"callId": _callId});
    _teardown(log: true);
  }

  // ---- Call channel wiring --------------------------------------------------

  void _joinCallChannel(String callId) {
    final ch = _rt!.channel("call:$callId");
    final ready = Completer<void>();
    _callChannelReady = ready;
    ch
      ..onBroadcast(event: "accept", callback: (_) => _onAccept())
      ..onBroadcast(event: "offer", callback: _onOffer)
      ..onBroadcast(event: "answer", callback: _onAnswer)
      ..onBroadcast(event: "ice", callback: _onIce)
      ..onBroadcast(event: "decline", callback: (_) => _teardown(log: true))
      ..onBroadcast(event: "hangup", callback: (_) => _teardown(log: true));
    ch.subscribe((status, [error]) {
      if (status == RealtimeSubscribeStatus.subscribed &&
          !ready.isCompleted) {
        ready.complete();
      }
    });
    _callChannel = ch;
  }

  /// Wait until the per-call channel has joined, so a broadcast we send next
  /// actually reaches the peer (with a safety timeout so we never hang).
  Future<void> _awaitCallChannel() async {
    final ready = _callChannelReady;
    if (ready == null || ready.isCompleted) return;
    try {
      await ready.future.timeout(const Duration(seconds: 8));
    } catch (_) {
      // Timed out — send anyway; better a possibly-dropped message than a hang.
    }
  }

  /// Send a signaling message through the SERVER relay (HTTP up, Realtime
  /// broadcast out). Field debugging (build 183) showed this phone's socket
  /// sends can silently vanish while receives work — the callee's accept
  /// arrived but our offer/hangup never reached them. The relay is the
  /// delivery path proven to reach web and app subscribers; the socket send
  /// remains only as an offline-edge fallback. Receiving stays on the socket.
  Future<void> _signal(String event, Map<String, dynamic> payload) async {
    final id = _callId;
    if (id != null) {
      try {
        await api.callSignal(id, event, payload);
        return;
      } catch (_) {
        // Server unreachable — fall back to the raw channel broadcast.
      }
    }
    await _awaitCallChannel();
    _callChannel?.sendBroadcastMessage(event: event, payload: payload);
  }

  Future<void> _onAccept() async {
    // Caller side: the callee picked up → create and send the offer.
    if (!_isCaller || _pc == null) return;
    _reRing?.cancel(); // stop re-broadcasting the ring; they answered
    _reRing = null;
    phase = CallPhase.connecting;
    notifyListeners();
    final offer = await _pc!.createOffer();
    await _pc!.setLocalDescription(offer);
    await _signal("offer", {
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
    await _signal("answer", {
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
    // International-standard adaptive video: ask for a 16:9 720p/30fps ideal so
    // the encoder negotiates a sane resolution and WebRTC scales it down
    // automatically on weak networks (instead of the unconstrained default that
    // produced stretched / wrong-sized frames). Audio is echo/noise-processed.
    _localStream = await navigator.mediaDevices.getUserMedia({
      "audio": {
        "echoCancellation": true,
        "noiseSuppression": true,
        "autoGainControl": true,
      },
      "video": video
          ? {
              "facingMode": "user",
              "width": {"ideal": 1280},
              "height": {"ideal": 720},
              "frameRate": {"ideal": 30},
            }
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
    _reRing?.cancel();
    _durationTimer?.cancel();
    _ringTimer = null;
    _reRing = null;
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
    _callChannelReady = null;
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
    _ringWatchdog?.cancel();
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
