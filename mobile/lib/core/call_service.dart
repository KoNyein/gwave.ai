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

  /// True while [_teardown] is running, so overlapping end-of-call events
  /// cannot each write their own call-log message.
  bool _tearingDown = false;

  /// The last call whose log message was written, so a late duplicate event
  /// cannot append a second one.
  String? _lastLoggedCallId;

  /// Set when Android reports the mic/camera permission as permanently
  /// denied — the request dialog will never appear again, so the UI has to
  /// send the user to app settings instead of repeating the same snackbar.
  bool permissionPermanentlyDenied = false;
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
  /// Kept only as a fallback for a fetch that fails; it is NOT a cache. It
  /// used to be one, for the whole process lifetime, so a TURN fix deployed
  /// on the server never reached a running app — the user had to force-close
  /// it to pick up new relay credentials, which is not something anyone can
  /// be expected to know.
  Map<String, dynamic>? _lastGoodIce;

  /// Candidate types this call has produced (host / srflx / relay) and the
  /// ICE states it went through — reported to /api/mobile/diag when a call
  /// ends without connecting, so "stuck on Connecting" says WHY in the server
  /// log instead of needing another round of manual testing.
  final Set<String> _candTypes = {};
  final List<String> _iceStates = [];
  int _iceServerCount = 0;
  bool _iceHadTurn = false;

  /// Signalling events actually RECEIVED on the call channel, and the last
  /// SDP error. Together these separate "the peer's answer never arrived"
  /// from "it arrived but we couldn't apply it" — indistinguishable from the
  /// server log, which only proves the relay accepted the broadcast.
  final List<String> _sigRx = [];
  String _sdpError = "";

  Future<Map<String, dynamic>> _iceConfig() async {
    try {
      final servers = await api.iceServers();
      if (servers.isNotEmpty) {
        _iceServerCount = servers.length;
        _iceHadTurn = servers.any((s) {
          final u = s["urls"];
          final text = u is List ? u.join(",") : "${u ?? ""}";
          return text.contains("turn:") && "${s["credential"] ?? ""}".isNotEmpty;
        });
        _lastGoodIce = {"iceServers": servers};
        return _lastGoodIce!;
      }
    } catch (_) {
      // offline or unreachable — reuse the last good config, else STUN only
    }
    return _lastGoodIce ?? _fallbackIce;
  }

  /// One line describing why the media plane did or didn't come up.
  void _reportIceDiag(String reason) {
    api.sendDiag({
      "kind": "call-ice",
      "reason": reason,
      "iceServers": _iceServerCount,
      "turnWithCreds": _iceHadTurn,
      "candTypes": _candTypes.toList()..sort(),
      "iceStates": _iceStates.join(">"),
      "sigRx": _sigRx.join(","),
      "remoteDescSet": _remoteDescSet,
      "sdpError": _sdpError,
      "isCaller": _isCaller,
      "video": video,
    });
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
        // Same envelope caveat as the per-call channel: the server relays the
        // ring too, so unwrap before reading the caller's fields.
        ..onBroadcast(event: "ring", callback: (p) => _onRing(_sigBody(p)))
        ..onBroadcast(event: "cancel", callback: (p) => _onCancel(_sigBody(p)));
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
      // Server-relayed signals (unlike socket broadcasts with self:false)
      // echo back to their sender too — dropping our own `_from` tag here
      // stops the callee from applying its own answer/ICE to itself.
      ..onBroadcast(
          event: "accept",
          callback: (p) {
            final b = _sigBody(p);
            if (_ownSignal(b)) return;
            _sigRx.add("accept");
            _onAccept();
          })
      ..onBroadcast(
          event: "offer",
          callback: (p) {
            final b = _sigBody(p);
            if (_ownSignal(b)) return;
            _sigRx.add("offer");
            _onOffer(b);
          })
      ..onBroadcast(
          event: "answer",
          callback: (p) {
            final b = _sigBody(p);
            if (_ownSignal(b)) return;
            _sigRx.add("answer");
            _onAnswer(b);
          })
      ..onBroadcast(
          event: "ice",
          callback: (p) {
            final b = _sigBody(p);
            if (_ownSignal(b)) return;
            // Only the first few, so one line stays readable in the log.
            if (_sigRx.where((e) => e == "ice").length < 3) _sigRx.add("ice");
            _onIce(b);
          })
      // These two used to take every event, including the one this device had
      // just sent — the server relay echoes back to the sender, which is why a
      // single hang-up wrote two or three call-log messages. They now drop
      // their own echo exactly like accept/offer/answer/ice above.
      ..onBroadcast(
          event: "decline",
          callback: (p) {
            if (_ownSignal(_sigBody(p))) return;
            _teardown(log: true);
          })
      ..onBroadcast(
          event: "hangup",
          callback: (p) {
            if (_ownSignal(_sigBody(p))) return;
            _teardown(log: true);
          });
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
  /// Unwrap a broadcast callback argument to the sender's own payload.
  ///
  /// The two delivery paths do NOT hand us the same shape. A broadcast sent
  /// over a client websocket arrives unwrapped, but one published through the
  /// server relay (Realtime's HTTP /api/broadcast, which is how every web
  /// signal travels since the socket-send fix) arrives inside an envelope:
  /// `{event: "offer", payload: {...}, type: "broadcast"}`.
  ///
  /// Reading the envelope as if it were the payload made every data-carrying
  /// signal silently useless: `sdp` and `candidate` came back null, so no
  /// remote description was ever applied and ICE never started — a call that
  /// gathered host/srflx/relay candidates and then sat on "Connecting"
  /// forever. It also defeated the echo guard (`_from` was unreadable), so a
  /// callee processed its own accept. `accept` was the one signal that
  /// carries no data, which is why that leg alone appeared to work.
  Map<String, dynamic> _sigBody(Map<String, dynamic> p) {
    final inner = p["payload"];
    return inner is Map ? Map<String, dynamic>.from(inner) : p;
  }

  /// True when a relayed signal originated from THIS device (see `_from`).
  bool _ownSignal(Map<String, dynamic> p) =>
      p["_from"]?.toString() == _myId;

  Future<void> _signal(String event, Map<String, dynamic> payload) async {
    final id = _callId;
    // `_from` lets receivers (including ourselves — server relays echo back
    // to every subscriber) identify and drop the sender's own messages.
    final tagged = {...payload, "_from": _myId};
    if (id != null) {
      try {
        await api.callSignal(id, event, tagged);
        return;
      } catch (_) {
        // Server unreachable — fall back to the raw channel broadcast.
      }
    }
    await _awaitCallChannel();
    _callChannel?.sendBroadcastMessage(event: event, payload: tagged);
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
    if (sdp is! Map) {
      _sdpError = "offer payload not a map: ${payload["sdp"].runtimeType}";
      return;
    }
    final body = sdp["sdp"]?.toString();
    if (body == null || body.isEmpty) {
      _sdpError = "offer sdp empty (keys: ${sdp.keys.join('|')})";
      _reportIceDiag("bad-offer");
      return;
    }
    try {
      await _pc!.setRemoteDescription(
          RTCSessionDescription(body, sdp["type"]?.toString()));
      _remoteDescSet = true;
      await _drainIce();
      final answer = await _pc!.createAnswer();
      await _pc!.setLocalDescription(answer);
      await _signal("answer", {
        "sdp": {"type": answer.type, "sdp": answer.sdp},
      });
    } catch (e) {
      _sdpError = "answering offer: $e";
      _reportIceDiag("offer-apply-failed");
    }
  }

  Future<void> _onAnswer(Map<String, dynamic> payload) async {
    if (_pc == null) return;
    final sdp = payload["sdp"];
    if (sdp is! Map) {
      _sdpError = "answer payload not a map: ${payload["sdp"].runtimeType}";
      return;
    }
    final body = sdp["sdp"]?.toString();
    if (body == null || body.isEmpty) {
      // An answer that arrived with an empty SDP is the silent killer: ICE
      // never starts and the call sits on "Connecting" with no error anywhere.
      _sdpError = "answer sdp empty (keys: ${sdp.keys.join('|')})";
      _reportIceDiag("bad-answer");
      return;
    }
    try {
      await _pc!.setRemoteDescription(
          RTCSessionDescription(body, sdp["type"]?.toString()));
      _remoteDescSet = true;
      await _drainIce();
    } catch (e) {
      _sdpError = "setRemoteDescription(answer): $e";
      _reportIceDiag("answer-apply-failed");
    }
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
    volume = speakerOn ? _speakerVolume : _earpieceVolume;
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
      // Remember which kinds of candidate this phone can actually produce.
      // "relay" missing here means the TURN allocation failed (bad/absent
      // credentials, unreachable relay) — the single most useful fact when a
      // call sticks on Connecting, and previously invisible without a rebuild.
      final m = RegExp(r" typ (\w+)").firstMatch(cand.candidate ?? "");
      if (m != null) _candTypes.add(m.group(1)!);
      // Route ICE through the SAME server relay as offer/answer. This used to
      // send on the raw socket, whose sends silently vanish on some phones —
      // so offer/answer arrived (call reached "Connecting") but no ICE ever
      // did, no candidate pair formed, and the call hung on Connecting forever.
      _signal("ice", {
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
        _applyVolume();
        notifyListeners();
      }
    };
    _pc!.onIceConnectionState = (s) {
      _iceStates.add(s.name.replaceFirst("RTCIceConnectionState", ""));
      // A failed ICE negotiation is the moment we know the media plane lost —
      // report it while the candidate/state history is still in hand.
      if (s == RTCIceConnectionState.RTCIceConnectionStateFailed) {
        _reportIceDiag("ice-failed");
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

  /// In-call earpiece/speaker level, 0..1. The loudspeaker plus the mic's
  /// automatic gain made video calls come through painfully loud even at a low
  /// system volume, and Android's hardware keys move the whole voice-call
  /// stream rather than this stream alone — so the call gets its own control,
  /// starting lower on speakerphone than on the earpiece.
  double volume = _speakerVolume;
  static const double _speakerVolume = 0.65;
  static const double _earpieceVolume = 1.0;

  void _applyVolume() {
    final tracks = _remoteRenderer.srcObject?.getAudioTracks() ??
        const <MediaStreamTrack>[];
    if (tracks.isEmpty) return;
    try {
      Helper.setVolume(volume.clamp(0.0, 1.0), tracks.first);
    } catch (_) {
      // Older engines don't expose per-track volume — routing still applies.
    }
  }

  /// Set the in-call volume (0..1) from the call screen's slider.
  void setVolume(double value) {
    volume = value.clamp(0.0, 1.0);
    _applyVolume();
    notifyListeners();
  }

  void toggleSpeaker() {
    speakerOn = !speakerOn;
    Helper.setSpeakerphoneOn(speakerOn);
    // Follow the route: the loudspeaker is far closer to the ear's limit than
    // the earpiece, so keep its default lower instead of blasting the user.
    volume = speakerOn ? _speakerVolume : _earpieceVolume;
    _applyVolume();
    notifyListeners();
  }

  // ---- Teardown -------------------------------------------------------------

  Future<void> _teardown({required bool log}) async {
    // Re-entrancy guard. Several paths can end one call at nearly the same
    // moment — a local hang-up, the peer's hangup broadcast, the relay, the
    // ring watchdog — and this method awaits before it clears the fields the
    // log is built from. Two overlapping runs therefore both saw a live
    // conversation id and both wrote a message. One call, one teardown.
    if (_tearingDown) return;
    _tearingDown = true;

    final wasCaller = _isCaller;
    final convo = _conversationId;
    final wasVideo = video;
    final connected = _connectedAt;
    final endedCallId = _callId;

    // A call that had a peer connection but never reached "connected" is the
    // failure we keep chasing — say why in the server log before the evidence
    // is cleared below.
    if (_pc != null && connected == null) {
      _reportIceDiag("ended-before-connect");
    }

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
    _candTypes.clear();
    _iceStates.clear();
    _sigRx.clear();
    _sdpError = "";

    // One call-log message per call, written by the caller (mirrors the web).
    // Keyed on the call id as well as the guard above, so even a teardown that
    // arrives long after the first one cannot append a duplicate.
    final alreadyLogged =
        endedCallId != null && endedCallId == _lastLoggedCallId;
    if (log && wasCaller && convo != null && !alreadyLogged) {
      _lastLoggedCallId = endedCallId;
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
    _tearingDown = false;
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
    // "Permanently denied" is the state that traps people: Android stops
    // showing the dialog, so request() returns denied instantly and the user
    // sees the same refusal forever with no way to fix it. Flag it so the UI
    // can offer app settings rather than repeating itself.
    permissionPermanentlyDenied =
        result.values.any((s) => s.isPermanentlyDenied);
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
