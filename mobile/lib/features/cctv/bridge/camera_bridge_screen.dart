import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../../core/api_client.dart';
import '../../../core/app_state.dart';
import '../../../core/theme.dart';
import 'rtsp_relay.dart';

/// Camera Bridge — the phone pulls a WiFi camera's RTSP on the local network
/// and relays it out to the server, so a router-less camera (phone hotspot,
/// carrier CGNAT) still shows up live on gwave.cc/cameras and in CCTV.
///
/// The phone is the bridge: it must stay on the camera's WiFi with this
/// screen running. Wakelock keeps the screen alive; a supervisor loop
/// reconnects with backoff and re-mints the publish token on every attempt.
class CameraBridgeScreen extends StatefulWidget {
  const CameraBridgeScreen({super.key});

  @override
  State<CameraBridgeScreen> createState() => _CameraBridgeScreenState();
}

class _CameraBridgeScreenState extends State<CameraBridgeScreen> {
  final _name = TextEditingController(text: "အိမ်ကင်မရာ");
  final _ip = TextEditingController();
  final _user = TextEditingController();
  final _pass = TextEditingController();
  bool _hd = false; // SD (stream2) default: H.264-safe + hotspot-friendly
  bool _busy = false;
  bool _running = false;
  String? _cameraId;
  final List<String> _log = [];
  String _stats = "";
  RtspRelay? _relay;
  int _generation = 0;

  static const _secure = FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final p = await SharedPreferences.getInstance();
    setState(() {
      _name.text = p.getString("bridge_name") ?? _name.text;
      _ip.text = p.getString("bridge_ip") ?? "";
      _user.text = p.getString("bridge_user") ?? "";
      _hd = p.getBool("bridge_hd") ?? false;
      _cameraId = p.getString("bridge_camera_id");
    });
    final pw = await _secure.read(key: "bridge_pass");
    if (pw != null && mounted) setState(() => _pass.text = pw);
  }

  Future<void> _persist() async {
    final p = await SharedPreferences.getInstance();
    await p.setString("bridge_name", _name.text.trim());
    await p.setString("bridge_ip", _ip.text.trim());
    await p.setString("bridge_user", _user.text.trim());
    await p.setBool("bridge_hd", _hd);
    if (_cameraId != null) {
      await p.setString("bridge_camera_id", _cameraId!);
    }
    await _secure.write(key: "bridge_pass", value: _pass.text);
  }

  void _say(String msg) {
    if (!mounted) return;
    setState(() {
      _log.add(msg);
      if (_log.length > 60) _log.removeAt(0);
    });
  }

  String get _cameraUrl {
    final u = Uri.encodeComponent(_user.text.trim());
    final p = Uri.encodeComponent(_pass.text);
    final ip = _ip.text.trim();
    final stream = _hd ? "stream1" : "stream2";
    return "rtsp://$u:$p@$ip:554/$stream";
  }

  Future<void> _start() async {
    if (_ip.text.trim().isEmpty ||
        _user.text.trim().isEmpty ||
        _pass.text.isEmpty) {
      _say("⚠️ IP၊ အကောင့်နာမည်၊ စကားဝှက် အကုန်ဖြည့်ပါ");
      return;
    }
    setState(() {
      _busy = true;
      _running = true;
      _log.clear();
      _stats = "";
    });
    await _persist();
    await WakelockPlus.enable();
    final gen = ++_generation;
    unawaited(_supervise(gen));
  }

  /// Reconnect-forever loop: each round re-mints the publish token (they
  /// expire in 24 h) and rebuilds both legs. Stopped by bumping _generation.
  Future<void> _supervise(int gen) async {
    var backoff = 3;
    while (mounted && _running && gen == _generation) {
      try {
        final api = context.read<AppState>().repo.api;
        final session = await api.cctvBridgeSession(
          cameraId: _cameraId,
          title: _name.text.trim().isEmpty ? null : _name.text.trim(),
        );
        _cameraId = (session["cameraId"] ?? "").toString();
        await _persist();

        final relay = RtspRelay(
          cameraUrl: _cameraUrl,
          publishUrl: (session["publishUrl"] ?? "").toString(),
          publishUser: (session["username"] ?? "").toString(),
          publishPassword: (session["password"] ?? "").toString(),
          onLog: _say,
          onStats: (bytes, up) {
            if (!mounted) return;
            final mb = (bytes / (1024 * 1024)).toStringAsFixed(1);
            final mins = up.inMinutes;
            setState(() =>
                _stats = "⏱ ${mins}m ${up.inSeconds % 60}s • ⬆️ $mb MB");
          },
        );
        _relay = relay;
        await relay.start();
        if (mounted) setState(() => _busy = false);
        backoff = 3;
        // Park here while the relay lives; RtspRelay flips isRunning off
        // when either leg dies, which drops us into the retry path.
        while (relay.isRunning && _running && gen == _generation) {
          await Future<void>.delayed(const Duration(seconds: 1));
        }
        await relay.stop();
        if (!_running || gen != _generation) return;
        _say("🔁 ${backoff}s အတွင်း ပြန်ချိတ်မည်…");
      } catch (e) {
        if (mounted) setState(() => _busy = false);
        if (!_running || gen != _generation) return;
        // The saved camera row can vanish (deleted on the web) — mint a fresh
        // one next round instead of 404-ing forever.
        if (e is ApiException && e.status == 404) _cameraId = null;
        _say("❌ $e");
        _say("🔁 ${backoff}s အတွင်း ပြန်ချိတ်မည်…");
      }
      await Future<void>.delayed(Duration(seconds: backoff));
      backoff = backoff >= 30 ? 30 : backoff * 2;
    }
  }

  Future<void> _stop() async {
    _generation++;
    setState(() {
      _running = false;
      _busy = false;
    });
    await _relay?.stop();
    _relay = null;
    await WakelockPlus.disable();
    _say("⏹ ရပ်လိုက်ပါပြီ");
  }

  @override
  void dispose() {
    _generation++;
    _relay?.stop();
    WakelockPlus.disable();
    _name.dispose();
    _ip.dispose();
    _user.dispose();
    _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("📡 ကင်မရာတံတား")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            "Router မရှိတဲ့ WiFi ကင်မရာအတွက် — ဒီဖုန်းက ကင်မရာနဲ့ WiFi "
            "တူတူပေါ်မှာ ရှိနေရပြီး ကင်မရာပုံရိပ်ကို server ဆီ ကူးလွှဲပေးပါတယ်။ "
            "ဖုန်းကို အားသွင်းထားပြီး app ဖွင့်ထားပါ။",
            style: TextStyle(color: GwColors.inkSoft, fontSize: 13),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _name,
            enabled: !_running,
            decoration: const InputDecoration(labelText: "ကင်မရာနာမည်"),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _ip,
            enabled: !_running,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: "ကင်မရာ IP (ဥပမာ 192.168.43.37)",
              helperText: "Tapo app → Settings → Device Info ထဲမှာ ကြည့်ပါ",
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _user,
            enabled: !_running,
            decoration: const InputDecoration(
              labelText: "Camera Account နာမည်",
              helperText:
                  "Tapo app → Advanced Settings → Camera Account (cloud email မဟုတ်ပါ)",
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _pass,
            enabled: !_running,
            obscureText: true,
            decoration:
                const InputDecoration(labelText: "Camera Account စကားဝှက်"),
          ),
          const SizedBox(height: 6),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _hd,
            onChanged: _running ? null : (v) => setState(() => _hd = v),
            title: const Text("HD (stream1)"),
            subtitle: const Text(
              "ပိတ်ထားရင် SD (stream2) — data သက်သာပြီး H.264 သေချာတယ်",
              style: TextStyle(fontSize: 12),
            ),
          ),
          const SizedBox(height: 8),
          _running
              ? FilledButton.icon(
                  style: FilledButton.styleFrom(
                      backgroundColor: Colors.red.shade700),
                  onPressed: _stop,
                  icon: const Icon(Icons.stop),
                  label: const Text("ရပ်မည်"),
                )
              : FilledButton.icon(
                  style:
                      FilledButton.styleFrom(backgroundColor: GwColors.primary),
                  onPressed: _busy ? null : _start,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.podcasts),
                  label: const Text("စတင်ကူးလွှဲမည်"),
                ),
          if (_stats.isNotEmpty) ...[
            const SizedBox(height: 10),
            Center(
                child: Text(_stats,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13))),
          ],
          const SizedBox(height: 14),
          if (_log.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: GwColors.darkBg,
                borderRadius: BorderRadius.circular(GwRadius.md),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final line in _log.reversed.take(12))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(line,
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 12)),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
