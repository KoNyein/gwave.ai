import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:nearby_connections/nearby_connections.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Offline nearby chat — Google Nearby Connections (Bluetooth + WiFi-Direct),
/// no internet or SIM needed. Phones within ~100m discover each other, connect,
/// and exchange text and GPS positions; a received location opens in maps.
/// Built for blackout/disaster use alongside the SOS map.
class OfflineTalkScreen extends StatefulWidget {
  const OfflineTalkScreen({super.key});

  @override
  State<OfflineTalkScreen> createState() => _OfflineTalkScreenState();
}

class _Peer {
  _Peer(this.id, this.name);
  final String id;
  final String name;
  bool connected = false;
}

class _Msg {
  _Msg(this.from, this.text, {this.mine = false});
  final String from;
  final String text;
  final bool mine;
}

class _OfflineTalkScreenState extends State<OfflineTalkScreen> {
  static const _serviceId = "cc.gwave.offline";
  static const _strategy = Strategy.P2P_CLUSTER;

  final Map<String, _Peer> _peers = {};
  final List<_Msg> _messages = [];
  final _input = TextEditingController();
  final _scroll = ScrollController();
  bool _running = false;
  String _status = "";
  String _myName = "Gwave";

  @override
  void initState() {
    super.initState();
    _myName = context.read<AppState>().me?.displayName ?? "Gwave";
    _start();
  }

  @override
  void dispose() {
    _input.dispose();
    Nearby().stopAdvertising();
    Nearby().stopDiscovery();
    Nearby().stopAllEndpoints();
    super.dispose();
  }

  Future<bool> _permissions() async {
    final wanted = <Permission>[
      Permission.bluetoothAdvertise,
      Permission.bluetoothConnect,
      Permission.bluetoothScan,
      Permission.locationWhenInUse,
      Permission.nearbyWifiDevices,
    ];
    final res = await wanted.request();
    // nearbyWifiDevices doesn't exist before Android 13 — ignore its result.
    return res[Permission.bluetoothConnect]?.isGranted != false &&
        res[Permission.locationWhenInUse]?.isGranted != false;
  }

  Future<void> _start() async {
    if (!await _permissions()) {
      setState(() =>
          _status = "Bluetooth/တည်နေရာ ခွင့်ပြုချက် လိုအပ်ပါသည်။");
      return;
    }
    setState(() {
      _running = true;
      _status = "အနီးအနားက ဖုန်းများကို ရှာနေသည်…";
    });
    try {
      await Nearby().startAdvertising(
        _myName,
        _strategy,
        serviceId: _serviceId,
        onConnectionInitiated: _onConnectionInitiated,
        onConnectionResult: _onConnectionResult,
        onDisconnected: _onDisconnected,
      );
      await Nearby().startDiscovery(
        _myName,
        _strategy,
        serviceId: _serviceId,
        onEndpointFound: (id, name, serviceId) {
          if (!mounted) return;
          setState(() => _peers.putIfAbsent(id, () => _Peer(id, name)));
        },
        onEndpointLost: (id) {
          if (!mounted || id == null) return;
          setState(() {
            final p = _peers[id];
            if (p != null && !p.connected) _peers.remove(id);
          });
        },
      );
    } catch (e) {
      if (mounted) setState(() => _status = "စတင်မရပါ — $e");
    }
  }

  void _onConnectionInitiated(String id, ConnectionInfo info) {
    _peers.putIfAbsent(id, () => _Peer(id, info.endpointName));
    // Auto-accept: offline emergencies shouldn't stall on a confirm dialog.
    Nearby().acceptConnection(
      id,
      onPayLoadRecieved: (endId, payload) {
        final bytes = payload.bytes;
        if (bytes == null || !mounted) return;
        final text = utf8.decode(bytes, allowMalformed: true);
        final from = _peers[endId]?.name ?? "Nearby";
        setState(() => _messages.add(_Msg(from, text)));
        _autoScroll();
      },
      onPayloadTransferUpdate: (endId, update) {},
    );
  }

  void _onConnectionResult(String id, Status status) {
    if (!mounted) return;
    setState(() {
      if (status == Status.CONNECTED) {
        _peers[id]?.connected = true;
        _status =
            "ချိတ်ဆက်ပြီး — ${_peers.values.where((p) => p.connected).length} လုံး";
      } else {
        _peers.remove(id);
      }
    });
  }

  void _onDisconnected(String id) {
    if (!mounted) return;
    setState(() {
      _peers.remove(id);
      _status = _peers.values.any((p) => p.connected)
          ? "ချိတ်ဆက်ပြီး — ${_peers.values.where((p) => p.connected).length} လုံး"
          : "အနီးအနားက ဖုန်းများကို ရှာနေသည်…";
    });
  }

  Future<void> _connect(_Peer p) async {
    try {
      await Nearby().requestConnection(
        _myName,
        p.id,
        onConnectionInitiated: _onConnectionInitiated,
        onConnectionResult: _onConnectionResult,
        onDisconnected: _onDisconnected,
      );
    } catch (_) {
      // Both sides may request at once — one side's request just fails.
    }
  }

  void _broadcast(String text) {
    final connected = _peers.values.where((p) => p.connected).toList();
    if (connected.isEmpty) return;
    final bytes = Uint8List.fromList(utf8.encode(text));
    for (final p in connected) {
      Nearby().sendBytesPayload(p.id, bytes);
    }
    setState(() => _messages.add(_Msg("me", text, mine: true)));
    _autoScroll();
  }

  void _sendText() {
    final t = _input.text.trim();
    if (t.isEmpty) return;
    _input.clear();
    _broadcast(t);
  }

  Future<void> _sendLocation() async {
    try {
      final pos = await Geolocator.getCurrentPosition();
      _broadcast(
          "📍 ကျွန်တော့်တည်နေရာ: https://maps.google.com/?q=${pos.latitude},${pos.longitude}");
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text("GPS ဖွင့်ထားပြီး ထပ်စမ်းကြည့်ပါ။")));
      }
    }
  }

  void _autoScroll() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final found = _peers.values.where((p) => !p.connected).toList();
    final connected = _peers.values.where((p) => p.connected).toList();
    return Scaffold(
      appBar: AppBar(title: const Text("📡 Offline စကားပြော")),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(14, 10, 14, 4),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              gradient: GwColors.primaryGradient,
              borderRadius: BorderRadius.circular(GwRadius.md),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("အင်တာနက် / SIM မလိုပါ",
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 14.5)),
                const SizedBox(height: 2),
                Text(
                  _status.isEmpty
                      ? "Bluetooth + WiFi နဲ့ အနီးအနား (~၁၀၀ မီတာ) ဖုန်းချင်း တိုက်ရိုက်ပြောနိုင်သည်။"
                      : _status,
                  style: const TextStyle(
                      color: Colors.white70, fontSize: 12),
                ),
              ],
            ),
          ),
          if (found.isNotEmpty)
            SizedBox(
              height: 46,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                children: [
                  for (final p in found)
                    Padding(
                      padding: const EdgeInsets.only(right: 8, top: 6),
                      child: ActionChip(
                        avatar: const Icon(Icons.person_add_alt,
                            size: 16, color: GwColors.primary),
                        label: Text("${p.name} ချိတ်မည်",
                            style: const TextStyle(fontSize: 12.5)),
                        onPressed: () => _connect(p),
                      ),
                    ),
                ],
              ),
            ),
          Expanded(
            child: _messages.isEmpty
                ? Center(
                    child: GwEmpty(
                      icon: _running
                          ? Icons.wifi_tethering
                          : Icons.portable_wifi_off,
                      title: connected.isEmpty
                          ? "အနီးအနားက Gwave ဖုန်းကို စောင့်နေသည်"
                          : "ချိတ်ဆက်ပြီးပါပြီ — စကားစပြောပါ",
                      subtitle:
                          "တစ်ဖက်ဖုန်းမှာလည်း ဒီစာမျက်နှာ ဖွင့်ထားရပါမယ်။",
                    ),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(14),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
                      final m = _messages[i];
                      final loc = m.text.contains("maps.google.com");
                      return Align(
                        alignment: m.mine
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: loc
                              ? () {
                                  final match = RegExp(r'https\S+')
                                      .firstMatch(m.text);
                                  if (match != null) {
                                    launchUrl(Uri.parse(match.group(0)!),
                                        mode: LaunchMode
                                            .externalApplication);
                                  }
                                }
                              : null,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 13, vertical: 9),
                            constraints:
                                const BoxConstraints(maxWidth: 290),
                            decoration: BoxDecoration(
                              color: m.mine
                                  ? GwColors.primary
                                  : GwColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: GwShadow.card,
                            ),
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                if (!m.mine)
                                  Text(m.from,
                                      style: const TextStyle(
                                          color: GwColors.primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800)),
                                Text(
                                  m.text,
                                  style: TextStyle(
                                    color: m.mine
                                        ? Colors.white
                                        : GwColors.ink,
                                    fontSize: 14,
                                    decoration: loc
                                        ? TextDecoration.underline
                                        : null,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 4, 10, 10),
              child: Row(
                children: [
                  IconButton(
                    tooltip: "တည်နေရာ ပို့မည်",
                    onPressed: connected.isEmpty ? null : _sendLocation,
                    icon: const Icon(Icons.my_location,
                        color: GwColors.primary),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _input,
                      onSubmitted: (_) => _sendText(),
                      decoration: InputDecoration(
                        hintText: connected.isEmpty
                            ? "ချိတ်ဆက်ပြီးမှ စာပို့နိုင်ပါမယ်"
                            : "စာရိုက်ပါ…",
                        filled: true,
                        fillColor: GwColors.surface,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(22),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton(
                    onPressed: connected.isEmpty ? null : _sendText,
                    icon:
                        const Icon(Icons.send, color: GwColors.primary),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
