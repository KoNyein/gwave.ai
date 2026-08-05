import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as c;

/// Camera Bridge relay engine — RTSP in, RTSP out, no transcoding.
///
/// Pulls a local camera's RTSP over TCP-interleaved transport and republishes
/// the same RTP packets to the server's MediaMTX (ANNOUNCE → SETUP mode=record
/// → RECORD). Because both legs are interleaved TCP with identical channel
/// numbers, forwarding is a verbatim byte pipe — the phone never touches the
/// codec, so a mid-range phone relays HD video with little CPU.
///
/// Deliberately pure Dart (dart:io sockets + package:crypto for Digest MD5):
/// an ffmpeg plugin would add ~90 MB of native libs and a minSdk bump for
/// what is, for `-c copy`, just protocol plumbing.
class RtspRelay {
  RtspRelay({
    required this.cameraUrl,
    required this.publishUrl,
    required this.publishUser,
    required this.publishPassword,
    required this.onLog,
    this.onStats,
  });

  /// rtsp://user:pass@ip:554/stream — credentials stay on this phone.
  final String cameraUrl;
  final String publishUrl;
  final String publishUser;
  final String publishPassword;
  final void Function(String msg) onLog;
  final void Function(int bytesRelayed, Duration uptime)? onStats;

  _RtspSession? _camera;
  _RtspSession? _server;
  bool _running = false;
  int _bytes = 0;
  DateTime? _startedAt;
  Timer? _statsTimer;

  bool get isRunning => _running;

  /// Connect both legs and start piping. Throws with a readable message when
  /// either side refuses; the caller owns retry policy.
  Future<void> start() async {
    if (_running) return;
    _running = true;
    _bytes = 0;
    _startedAt = DateTime.now();
    try {
      final cam = Uri.parse(cameraUrl);
      onLog("ကင်မရာကို ချိတ်နေသည် (${cam.host})…");
      final camera = await _RtspSession.connect(cam, onLog: onLog);
      _camera = camera;

      final sdp = await camera.describe();
      final tracks = _SdpTrack.parse(sdp, camera.contentBase);
      if (tracks.isEmpty) {
        throw RelayException("ကင်မရာ SDP ထဲမှာ video track မတွေ့ပါ");
      }
      for (final t in tracks) {
        onLog("track: ${t.kind} ${t.codecName ?? ''}".trim());
        if ((t.codecName ?? "").toUpperCase().contains("H265")) {
          onLog("⚠️ H.265 — browser မှာ မပြနိုင်တတ်ပါ။ ကင်မရာကို H.264 "
              "ပြောင်းထားပါ (Tapo: SD/stream2 က H.264 ဖြစ်တတ်သည်)");
        }
      }
      await camera.setupPlay(tracks);

      final pub = Uri.parse(publishUrl);
      onLog("Server ကို ချိတ်နေသည် (${pub.host})…");
      final server = await _RtspSession.connect(
        pub,
        onLog: onLog,
        user: publishUser,
        password: publishPassword,
      );
      _server = server;
      await server.announceRecord(_SdpTrack.publishSdp(tracks), tracks);

      // The pipe: every interleaved frame from the camera goes to the server
      // untouched (channel numbers were assigned identically on both legs).
      camera.onFrame = (Uint8List frame) {
        _bytes += frame.length;
        server.sendRaw(frame);
      };
      camera.onDead = (why) => _die("ကင်မရာဘက် ပြတ်သွားသည်: $why");
      server.onDead = (why) => _die("Server ဘက် ပြတ်သွားသည်: $why");

      await camera.play();
      onLog("✅ တိုက်ရိုက် ကူးလွှဲနေပါပြီ");
      _statsTimer = Timer.periodic(const Duration(seconds: 2), (_) {
        final s = _startedAt;
        if (s != null) onStats?.call(_bytes, DateTime.now().difference(s));
      });
    } catch (e) {
      await stop();
      rethrow;
    }
  }

  void _die(String why) {
    if (!_running) return;
    onLog(why);
    // Surface as a dead relay; the screen's supervisor loop restarts us.
    _running = false;
    _statsTimer?.cancel();
    unawaited(_camera?.close());
    unawaited(_server?.close());
  }

  Future<void> stop() async {
    _running = false;
    _statsTimer?.cancel();
    await _camera?.close();
    await _server?.close();
    _camera = null;
    _server = null;
  }
}

class RelayException implements Exception {
  RelayException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// One RTSP TCP connection: request/response plumbing, Basic/Digest auth,
/// interleaved-frame demux, keepalives. Used for both legs.
class _RtspSession {
  _RtspSession._(this._socket, this.url, this.onLog, this._user, this._pass);

  static Future<_RtspSession> connect(
    Uri url, {
    required void Function(String) onLog,
    String? user,
    String? password,
  }) async {
    final host = url.host;
    final port = url.hasPort ? url.port : 554;
    final Socket socket;
    try {
      socket = await Socket.connect(host, port,
          timeout: const Duration(seconds: 10));
    } on SocketException catch (e) {
      throw RelayException(
          "$host:$port ကို ချိတ်လို့မရပါ (${e.osError?.message ?? e.message})");
    }
    socket.setOption(SocketOption.tcpNoDelay, true);
    // Credentials may live in the URL (camera leg) or arrive explicitly
    // (publish leg). Requests always use the credential-free URL.
    final u = user ?? (url.userInfo.isNotEmpty
        ? Uri.decodeComponent(url.userInfo.split(":").first)
        : null);
    final p = password ?? (url.userInfo.contains(":")
        ? Uri.decodeComponent(url.userInfo.split(":").sublist(1).join(":"))
        : null);
    final clean = url.replace(userInfo: "");
    final s = _RtspSession._(socket, clean, onLog, u, p);
    s._listen();
    return s;
  }

  final Socket _socket;
  final Uri url;
  final void Function(String) onLog;
  final String? _user;
  final String? _pass;

  void Function(Uint8List frame)? onFrame;
  void Function(String why)? onDead;

  int _cseq = 0;
  String? sessionId;
  String? contentBase;
  bool _closed = false;
  Timer? _keepalive;
  String _keepaliveMethod = "OPTIONS";

  // Digest state (RFC 2617); null until the peer sends a 401 challenge.
  Map<String, String>? _digest;
  bool _useBasic = false;
  int _nc = 0;

  final List<Completer<_RtspResponse>> _pending = [];
  final BytesBuilder _buf = BytesBuilder(copy: false);

  void _listen() {
    _socket.listen(
      (data) {
        _buf.add(data);
        _drain();
      },
      onError: (Object e) => _dead("socket error: $e"),
      onDone: () => _dead("connection closed"),
    );
  }

  void _dead(String why) {
    if (_closed) return;
    _closed = true;
    _keepalive?.cancel();
    for (final p in _pending) {
      if (!p.isCompleted) {
        p.completeError(RelayException(why));
      }
    }
    _pending.clear();
    onDead?.call(why);
  }

  /// Demux the byte stream: `$`-prefixed interleaved frames vs RTSP messages.
  void _drain() {
    var bytes = _buf.takeBytes();
    var off = 0;
    while (true) {
      if (off >= bytes.length) return;
      if (bytes[off] == 0x24 /* $ */) {
        if (bytes.length - off < 4) break;
        final len = (bytes[off + 2] << 8) | bytes[off + 3];
        if (bytes.length - off < 4 + len) break;
        onFrame?.call(Uint8List.sublistView(bytes, off, off + 4 + len));
        off += 4 + len;
      } else {
        final headerEnd = _indexOfCrlfCrlf(bytes, off);
        if (headerEnd < 0) break;
        final head = ascii.decode(
            Uint8List.sublistView(bytes, off, headerEnd),
            allowInvalid: true);
        final m = RegExp(r"Content-Length:\s*(\d+)", caseSensitive: false)
            .firstMatch(head);
        final bodyLen = m == null ? 0 : int.parse(m.group(1)!);
        if (bytes.length - (headerEnd + 4) < bodyLen) break;
        final body = ascii.decode(
            Uint8List.sublistView(
                bytes, headerEnd + 4, headerEnd + 4 + bodyLen),
            allowInvalid: true);
        _onMessage(_RtspResponse.parse(head, body));
        off = headerEnd + 4 + bodyLen;
      }
    }
    // Keep the unconsumed tail for the next chunk.
    _buf.add(Uint8List.sublistView(bytes, off));
  }

  static int _indexOfCrlfCrlf(Uint8List b, int from) {
    for (var i = from; i + 3 < b.length; i++) {
      if (b[i] == 13 && b[i + 1] == 10 && b[i + 2] == 13 && b[i + 3] == 10) {
        return i;
      }
    }
    return -1;
  }

  void _onMessage(_RtspResponse res) {
    // Servers may send requests (e.g. OPTIONS pings) — answer 200 and move on.
    if (res.isRequest) {
      final cseq = res.headers["cseq"];
      _socket.add(ascii.encode(
          "RTSP/1.0 200 OK\r\n${cseq == null ? "" : "CSeq: $cseq\r\n"}\r\n"));
      return;
    }
    if (_pending.isEmpty) return; // unsolicited; ignore
    final p = _pending.removeAt(0);
    if (!p.isCompleted) p.complete(res);
  }

  Future<_RtspResponse> request(
    String method,
    String target, {
    Map<String, String> headers = const {},
    String? body,
    bool retryAuth = true,
  }) async {
    if (_closed) throw RelayException("connection closed");
    final cseq = ++_cseq;
    final h = StringBuffer()
      ..write("$method $target RTSP/1.0\r\n")
      ..write("CSeq: $cseq\r\n")
      ..write("User-Agent: GwaveBridge/1.0\r\n");
    final auth = _authHeader(method, target);
    if (auth != null) h.write("Authorization: $auth\r\n");
    if (sessionId != null) h.write("Session: $sessionId\r\n");
    headers.forEach((k, v) => h.write("$k: $v\r\n"));
    if (body != null) h.write("Content-Length: ${body.length}\r\n");
    h.write("\r\n");
    final completer = Completer<_RtspResponse>();
    _pending.add(completer);
    _socket.add(ascii.encode(h.toString() + (body ?? "")));
    final res = await completer.future
        .timeout(const Duration(seconds: 12), onTimeout: () {
      throw RelayException("$method ကို server က မဖြေပါ (timeout)");
    });
    if (res.status == 401 && retryAuth && (_user != null || _pass != null)) {
      _absorbChallenge(res);
      return request(method, target,
          headers: headers, body: body, retryAuth: false);
    }
    if (res.status >= 400) {
      throw RelayException("$method ${res.status} ${res.reason}".trim());
    }
    final sess = res.headers["session"];
    if (sess != null) sessionId = sess.split(";").first.trim();
    return res;
  }

  void _absorbChallenge(_RtspResponse res) {
    final all = res.wwwAuthenticate;
    // Prefer Basic when offered: MediaMTX's http-auth mode NEEDS the plain
    // password to forward to the webhook, and cameras that offer Basic are on
    // the phone's own LAN anyway. Digest is the fallback for cameras that
    // disable Basic.
    if (all.any((v) => v.toLowerCase().startsWith("basic"))) {
      _useBasic = true;
      _digest = null;
      return;
    }
    final digest = all.firstWhere((v) => v.toLowerCase().startsWith("digest"),
        orElse: () => "");
    if (digest.isNotEmpty) {
      final params = <String, String>{};
      for (final m in RegExp(r'(\w+)=(?:"([^"]*)"|([^,\s]+))')
          .allMatches(digest.substring(6))) {
        params[m.group(1)!.toLowerCase()] = m.group(2) ?? m.group(3) ?? "";
      }
      _digest = params;
      _useBasic = false;
      _nc = 0;
      return;
    }
    throw RelayException("စကားဝှက် မှားနေပါသည် (auth ${res.status})");
  }

  String? _authHeader(String method, String uri) {
    final user = _user;
    final pass = _pass ?? "";
    if (user == null) return null;
    if (_useBasic) {
      return "Basic ${base64.encode(utf8.encode("$user:$pass"))}";
    }
    final d = _digest;
    if (d == null) return null;
    final realm = d["realm"] ?? "";
    final nonce = d["nonce"] ?? "";
    String md5(String s) => c.md5.convert(utf8.encode(s)).toString();
    final ha1 = md5("$user:$realm:$pass");
    final ha2 = md5("$method:$uri");
    final qop = (d["qop"] ?? "").split(",").map((s) => s.trim());
    final sb = StringBuffer('Digest username="$user", realm="$realm", '
        'nonce="$nonce", uri="$uri"');
    if (qop.contains("auth")) {
      _nc++;
      final nc = _nc.toRadixString(16).padLeft(8, "0");
      final cnonce =
          List.generate(8, (_) => Random().nextInt(16).toRadixString(16))
              .join();
      final response = md5("$ha1:$nonce:$nc:$cnonce:auth:$ha2");
      sb.write(', qop=auth, nc=$nc, cnonce="$cnonce", response="$response"');
    } else {
      sb.write(', response="${md5("$ha1:$nonce:$ha2")}"');
    }
    if (d.containsKey("opaque")) sb.write(', opaque="${d["opaque"]}"');
    return sb.toString();
  }

  // ---- Camera (pull) leg ---------------------------------------------------

  Future<String> describe() async {
    // A first OPTIONS lets the camera issue its auth challenge cheaply and
    // tells us whether GET_PARAMETER keepalives are supported.
    final opts = await request("OPTIONS", url.toString());
    if ((opts.headers["public"] ?? "").contains("GET_PARAMETER")) {
      _keepaliveMethod = "GET_PARAMETER";
    }
    final res = await request("DESCRIBE", url.toString(),
        headers: {"Accept": "application/sdp"});
    contentBase = res.headers["content-base"] ??
        res.headers["content-location"] ??
        url.toString();
    return res.body;
  }

  Future<void> setupPlay(List<_SdpTrack> tracks) async {
    for (var i = 0; i < tracks.length; i++) {
      final ch = i * 2;
      await request("SETUP", tracks[i].controlUrl, headers: {
        "Transport": "RTP/AVP/TCP;unicast;interleaved=$ch-${ch + 1}",
      });
    }
  }

  Future<void> play() async {
    await request("PLAY", contentBase ?? url.toString(),
        headers: {"Range": "npt=0.000-"});
    _startKeepalive();
  }

  // ---- Server (publish) leg ------------------------------------------------

  Future<void> announceRecord(String sdp, List<_SdpTrack> tracks) async {
    await request("ANNOUNCE", url.toString(),
        headers: {"Content-Type": "application/sdp"}, body: sdp);
    for (var i = 0; i < tracks.length; i++) {
      final ch = i * 2;
      await request("SETUP", "${url.toString()}/streamid=$i", headers: {
        "Transport":
            "RTP/AVP/TCP;unicast;interleaved=$ch-${ch + 1};mode=record",
      });
    }
    await request("RECORD", url.toString(),
        headers: {"Range": "npt=0.000-"});
    _startKeepalive();
  }

  void _startKeepalive() {
    _keepalive?.cancel();
    _keepalive = Timer.periodic(const Duration(seconds: 20), (_) {
      if (_closed) return;
      request(_keepaliveMethod, url.toString())
          .catchError((Object _) => _RtspResponse.parse("RTSP/1.0 0 x", ""));
    });
  }

  void sendRaw(Uint8List frame) {
    if (_closed) return;
    _socket.add(frame);
  }

  Future<void> close() async {
    if (_closed) {
      return;
    }
    try {
      // Best-effort TEARDOWN so the camera stops streaming promptly.
      final cseq = ++_cseq;
      _socket.add(ascii.encode("TEARDOWN ${url.toString()} RTSP/1.0\r\n"
          "CSeq: $cseq\r\n"
          "${sessionId == null ? "" : "Session: $sessionId\r\n"}\r\n"));
      await _socket.flush().timeout(const Duration(seconds: 2));
    } catch (_) {}
    _closed = true;
    _keepalive?.cancel();
    _socket.destroy();
  }
}

class _RtspResponse {
  _RtspResponse(this.status, this.reason, this.headers, this.body,
      this.wwwAuthenticate, this.isRequest);

  final int status;
  final String reason;
  final Map<String, String> headers; // lower-cased keys, last wins
  final String body;
  final List<String> wwwAuthenticate; // every challenge line, order kept
  final bool isRequest;

  static _RtspResponse parse(String head, String body) {
    final lines = head.split("\r\n");
    final start = lines.first;
    var status = 0;
    var reason = "";
    var isRequest = false;
    if (start.startsWith("RTSP/")) {
      final parts = start.split(" ");
      status = int.tryParse(parts.length > 1 ? parts[1] : "") ?? 0;
      reason = parts.length > 2 ? parts.sublist(2).join(" ") : "";
    } else {
      isRequest = true;
    }
    final headers = <String, String>{};
    final challenges = <String>[];
    for (final line in lines.skip(1)) {
      final idx = line.indexOf(":");
      if (idx <= 0) continue;
      final key = line.substring(0, idx).trim().toLowerCase();
      final value = line.substring(idx + 1).trim();
      if (key == "www-authenticate") {
        challenges.add(value);
      } else {
        headers[key] = value;
      }
    }
    return _RtspResponse(status, reason, headers, body, challenges, isRequest);
  }
}

/// One media section of the camera's SDP, with just enough retained to
/// re-declare the identical codec to MediaMTX.
class _SdpTrack {
  _SdpTrack({
    required this.kind,
    required this.mLine,
    required this.attrs,
    required this.controlUrl,
    required this.codecName,
  });

  final String kind; // video | audio
  final String mLine; // "m=video 0 RTP/AVP 96"
  final List<String> attrs; // a=rtpmap / a=fmtp lines, verbatim
  final String controlUrl;
  final String? codecName;

  static List<_SdpTrack> parse(String sdp, String? contentBase) {
    final base = (contentBase ?? "").replaceAll(RegExp(r"/+$"), "");
    final tracks = <_SdpTrack>[];
    String? kind;
    String? mLine;
    var attrs = <String>[];
    String? control;
    String? codec;

    void flush() {
      if (kind == null || mLine == null) return;
      // Only audio/video relay; ONVIF metadata tracks would just confuse the
      // HLS muxer and waste hotspot bandwidth.
      if (kind != "video" && kind != "audio") return;
      final ctl = control ?? "";
      final url = ctl.startsWith("rtsp://")
          ? ctl
          : ctl.isEmpty
              ? base
              : "$base/$ctl";
      tracks.add(_SdpTrack(
        kind: kind!,
        mLine: mLine!,
        attrs: List.of(attrs),
        controlUrl: url,
        codecName: codec,
      ));
    }

    for (final raw in sdp.split(RegExp(r"\r?\n"))) {
      final line = raw.trim();
      if (line.startsWith("m=")) {
        flush();
        final parts = line.substring(2).split(" ");
        kind = parts.first;
        // Zero the port — interleaved TCP ignores it and MediaMTX expects 0.
        mLine = "m=$kind 0 ${parts.sublist(2).join(" ")}";
        attrs = [];
        control = null;
        codec = null;
      } else if (kind != null && line.startsWith("a=rtpmap:")) {
        attrs.add(line);
        final m = RegExp(r"a=rtpmap:\d+\s+([^/]+)").firstMatch(line);
        codec ??= m?.group(1);
      } else if (kind != null && line.startsWith("a=fmtp:")) {
        attrs.add(line);
      } else if (kind != null && line.startsWith("a=control:")) {
        control = line.substring("a=control:".length).trim();
      }
    }
    flush();
    // Video first: MediaMTX keys the HLS muxer off the leading track, and
    // the channel numbering (0-1 video) matches what ops expect in logs.
    tracks.sort((a, b) => a.kind == b.kind ? 0 : (a.kind == "video" ? -1 : 1));
    return tracks;
  }

  /// Minimal SDP re-declaring the camera's tracks for the ANNOUNCE.
  static String publishSdp(List<_SdpTrack> tracks) {
    final sb = StringBuffer()
      ..write("v=0\r\n")
      ..write("o=- 0 0 IN IP4 127.0.0.1\r\n")
      ..write("s=GwaveBridge\r\n")
      ..write("t=0 0\r\n");
    for (var i = 0; i < tracks.length; i++) {
      sb.write("${tracks[i].mLine}\r\n");
      for (final a in tracks[i].attrs) {
        sb.write("$a\r\n");
      }
      sb.write("a=control:streamid=$i\r\n");
    }
    return sb.toString();
  }
}
