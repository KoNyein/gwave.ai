import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'device_detail_screen.dart';

/// Native Farm dashboard: each device as a card with its online status and its
/// latest sensor metrics, read from `devices` + `sensor_readings`. Devices can
/// be registered right here (credentials shown once for the controller),
/// switches toggle ON/OFF through the command queue, and long-press deletes.
class FarmScreen extends StatefulWidget {
  const FarmScreen({super.key});

  @override
  State<FarmScreen> createState() => _FarmScreenState();
}

class _FarmScreenState extends State<FarmScreen> {
  List<Device> _devices = [];
  Map<String, List<SensorReading>> _readings = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = context.read<AppState>().repo;
    try {
      final results = await Future.wait([repo.devices(), repo.latestReadings()]);
      setState(() {
        _devices = results[0] as List<Device>;
        _readings = results[1] as Map<String, List<SensorReading>>;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Farm — Manage"),
        actions: [
          IconButton(
            tooltip: tr(context, "How to connect", "ချိတ်ဆက်နည်း"),
            icon: const Icon(Icons.help_outline),
            onPressed: _showConnectGuide,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: GwColors.primary,
        foregroundColor: Colors.white,
        onPressed: _addDevice,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Add device", "စက်ထည့်ရန်")),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null && _devices.isEmpty
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  ])
                : _devices.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        GwEmpty(
                            icon: Icons.sensors_off,
                            title: "No devices yet",
                            subtitle:
                                "Tap + Add device to register your first sensor or switch."),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: _devices.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) =>
                            _deviceCard(_devices[i]),
                      ),
      ),
    );
  }

  /// Register a device: name + type + zone → devices row; then show the MQTT
  /// credentials once so they can be flashed onto the controller.
  Future<void> _addDevice() async {
    final name = TextEditingController();
    final zone = TextEditingController();
    String type = "sensor";
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          title: Text(tr(ctx, "Add device", "စက်ထည့်ရန်")),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: InputDecoration(
                  labelText: tr(ctx, "Device name", "စက်အမည်"),
                  prefixIcon: const Icon(Icons.sensors),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (final t in const [
                    ("sensor", "Sensor"),
                    ("switch", "Switch"),
                    ("camera", "Camera"),
                  ])
                    ChoiceChip(
                      label: Text(t.$2),
                      selected: type == t.$1,
                      selectedColor:
                          GwColors.primary.withValues(alpha: 0.15),
                      onSelected: (_) => setDlg(() => type = t.$1),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: zone,
                decoration: InputDecoration(
                  labelText: tr(ctx, "Zone (optional)", "ဇုန် (မဖြစ်မနေမဟုတ်)"),
                  prefixIcon: const Icon(Icons.grid_view_outlined),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
            ElevatedButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: Text(tr(ctx, "Register", "မှတ်ပုံတင်မည်"))),
          ],
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final n = name.text.trim();
    if (n.isEmpty) return;
    try {
      final creds = await context.read<AppState>().repo.registerDevice(
          name: n, type: type, zone: zone.text.trim());
      await _load();
      if (creds != null && mounted) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.key, color: GwColors.primary, size: 36),
            title: Text(tr(ctx, "Device credentials", "စက် အထောက်အထားများ")),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(
                      ctx,
                      "Flash these onto your controller. The secret is shown only once.",
                      "ဒါတွေကို controller ထဲ ထည့်ပါ။ Secret ကို ဒီတစ်ကြိမ်သာ ပြပါမည်။"),
                  style: const TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoft),
                ),
                const SizedBox(height: 10),
                SelectableText("MQTT topic: ${creds.topic}",
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 6),
                SelectableText("Secret: ${creds.secret}",
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 13)),
                const SizedBox(height: 10),
                InkWell(
                  onTap: () {
                    Navigator.of(ctx).pop();
                    _showConnectGuide();
                  },
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.help_outline,
                          color: GwColors.primary, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        tr(ctx, "How do I use these?", "ဒါတွေ ဘယ်လိုသုံးရမလဲ?"),
                        style: const TextStyle(
                            color: GwColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(
                      text:
                          "topic=${creds.topic}\nsecret=${creds.secret}"));
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Copied 📋")));
                },
                child: Text(tr(ctx, "Copy", "ကူးမည်")),
              ),
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text("OK")),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Couldn't register — $e")));
      }
    } finally {
      name.dispose();
      zone.dispose();
    }
  }

  /// A short, farmer-friendly walkthrough of how a controller connects: which
  /// MQTT broker to point at, the topics to publish/subscribe, and a copyable
  /// example telemetry payload. Opened from the AppBar help button and linked
  /// from the credentials dialog.
  void _showConnectGuide() {
    const example =
        '{\n  "secret": "<device secret>",\n  "metrics": { "temp": 27.4, "humidity": 68 }\n}';
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: GwColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.router, color: GwColors.primary, size: 24),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      tr(ctx, "Connect a device", "စက်တစ်ခု ချိတ်ဆက်ရန်"),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 18),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _step(
                ctx,
                "1",
                tr(ctx, "Add the device", "စက်ကို ထည့်ပါ"),
                tr(
                    ctx,
                    'Tap "Add device", pick sensor / switch / camera, and give it a name and zone. You\'ll get an MQTT topic and a secret — copy them (the secret shows only once).',
                    '"Add device" ကိုနှိပ်၊ sensor / switch / camera ရွေး၊ နာမည်နဲ့ zone ပေးပါ။ MQTT topic နဲ့ secret ရမယ် — ကူးထားပါ (secret ကို တစ်ကြိမ်သာ ပြပါမည်)။'),
              ),
              _step(
                ctx,
                "2",
                tr(ctx, "Point the controller at the broker",
                    "Controller ကို broker ဆီ ချိန်ပါ"),
                tr(
                    ctx,
                    "On your ESP32 / Raspberry Pi, connect its MQTT client to your farm's EMQX broker (e.g. mqtt://<your-broker>:1883) using the username & password your admin set.",
                    "ESP32 / Raspberry Pi မှာ MQTT client ကို သင့်ခြံရဲ့ EMQX broker (ဥပမာ mqtt://<broker>:1883) ဆီ၊ admin ပေးထားတဲ့ username/password နဲ့ ချိတ်ပါ။"),
              ),
              _step(
                ctx,
                "3",
                tr(ctx, "Publish telemetry", "Telemetry ပို့ပါ"),
                tr(
                    ctx,
                    "Every few seconds, publish a JSON message to <topic>/telemetry with your secret and metric readings:",
                    "စက္ကန့်အနည်းငယ်တိုင်း <topic>/telemetry သို့ သင့် secret နဲ့ metric တန်ဖိုးများ ပါတဲ့ JSON တစ်ခု ပို့ပါ —"),
              ),
              const SizedBox(height: 8),
              _codeBlock(ctx, "gwave/<id>/telemetry", example),
              const SizedBox(height: 12),
              _step(
                ctx,
                "4",
                tr(ctx, "Receive switch commands", "ဖွင့်/ပိတ် အမိန့် လက်ခံပါ"),
                tr(
                    ctx,
                    'For a switch, subscribe to <topic>/cmd. When you press ON/OFF in the app, the controller receives {"power": true/false}. Report the result back on <topic>/state.',
                    'Switch အတွက် <topic>/cmd ကို subscribe လုပ်ပါ။ App ထဲ ON/OFF နှိပ်ရင် controller က {"power": true/false} ရမယ်။ ရလဒ်ကို <topic>/state ပေါ်ပြန်ပို့ပါ။'),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GwColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.lightbulb_outline,
                        color: GwColors.primary, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tr(
                            ctx,
                            "Once telemetry arrives, the device turns green (online) and its readings show on the card automatically.",
                            "Telemetry ရောက်တာနဲ့ စက်က အစိမ်း (online) ဖြစ်ပြီး၊ တန်ဖိုးတွေ card ပေါ်မှာ အလိုအလျောက် ပေါ်လာမည်။"),
                        style: const TextStyle(
                            fontSize: 12, color: GwColors.inkSoft),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style:
                      FilledButton.styleFrom(backgroundColor: GwColors.primary),
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: Text(tr(ctx, "Got it", "ရပါပြီ")),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _step(BuildContext ctx, String n, String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
                color: GwColors.primary, shape: BoxShape.circle),
            child: Text(n,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14)),
                const SizedBox(height: 2),
                Text(body,
                    style: const TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoft, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _codeBlock(BuildContext ctx, String topic, String code) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: GwColors.darkBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(topic,
                    style: const TextStyle(
                        color: GwColors.primaryBright,
                        fontFamily: "monospace",
                        fontWeight: FontWeight.w700,
                        fontSize: 12)),
              ),
              InkWell(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: code));
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Copied 📋")));
                },
                child: const Icon(Icons.copy, color: Colors.white54, size: 16),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SelectableText(code,
              style: const TextStyle(
                  color: Colors.white,
                  fontFamily: "monospace",
                  fontSize: 12,
                  height: 1.4)),
        ],
      ),
    );
  }

  Future<void> _toggleSwitch(Device d, bool on) async {
    try {
      await context
          .read<AppState>()
          .repo
          .sendDeviceCommand(d.id, {"power": on});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(on
                ? tr(context, "Turn-ON command sent ⚡", "ဖွင့်ရန် အမိန့် ပို့ပြီး ⚡")
                : tr(context, "Turn-OFF command sent", "ပိတ်ရန် အမိန့် ပို့ပြီး"))));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  Future<void> _deleteDevice(Device d) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Delete \"${d.name}\"?", "\"${d.name}\" ဖျက်မလား?")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Keep", "မဖျက်ပါ"))),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: GwColors.live),
            child: Text(tr(ctx, "Delete", "ဖျက်မည်")),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<AppState>().repo.deleteDevice(d.id);
      await _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  Widget _deviceCard(Device d) {
    final metrics = _readings[d.id] ?? [];
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DeviceDetailScreen(device: d)),
      ),
      onLongPress: () => _deleteDevice(d),
      child: Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: GwColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(_iconFor(d.type), color: GwColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(d.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 15)),
                      Text(
                        [d.type, if (d.zone != null) d.zone].join(" · "),
                        style: const TextStyle(
                            color: GwColors.inkSoft, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                _statusDot(d.online),
              ],
            ),
            if (metrics.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: metrics.map(_metricTile).toList(),
              ),
            ],
            // Switches get one-tap ON/OFF straight from the dashboard.
            if (d.type == "switch" || d.type == "controller") ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                          backgroundColor: GwColors.primary),
                      onPressed: () => _toggleSwitch(d, true),
                      icon: const Icon(Icons.power_settings_new, size: 17),
                      label: const Text("ON"),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _toggleSwitch(d, false),
                      icon: const Icon(Icons.power_off_outlined, size: 17),
                      label: const Text("OFF"),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
      ),
    );
  }

  Widget _metricTile(SensorReading r) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: GwColors.surfaceMuted,
        borderRadius: BorderRadius.circular(GwRadius.sm),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(r.metric,
              style: const TextStyle(color: GwColors.inkSoft, fontSize: 11)),
          Text(
            _fmt(r.value),
            style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: GwColors.primaryDark),
          ),
        ],
      ),
    );
  }

  Widget _statusDot(bool online) => Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: online ? GwColors.primaryBright : GwColors.line,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(online ? "Online" : "Offline",
              style: TextStyle(
                  color: online ? GwColors.primary : GwColors.inkSoft,
                  fontSize: 12,
                  fontWeight: FontWeight.w600)),
        ],
      );

  IconData _iconFor(String type) {
    switch (type) {
      case "switch":
        return Icons.toggle_on;
      case "camera":
        return Icons.videocam;
      case "controller":
        return Icons.developer_board;
      default:
        return Icons.sensors;
    }
  }

  String _fmt(double v) {
    if (v == v.roundToDouble()) return v.toStringAsFixed(0);
    return v.toStringAsFixed(1);
  }
}
