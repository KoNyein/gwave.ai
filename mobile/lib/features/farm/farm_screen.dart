import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'device_detail_screen.dart';

/// Native Farm dashboard: each device as a card with its online status and its
/// latest sensor metrics, read from `devices` + `sensor_readings`.
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
      appBar: AppBar(title: const Text("Farm — Manage")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? Center(
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
                            subtitle: "Add a device on gwave.cc"),
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

  Widget _deviceCard(Device d) {
    final metrics = _readings[d.id] ?? [];
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => DeviceDetailScreen(device: d)),
      ),
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
                        style: TextStyle(
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
              style: TextStyle(color: GwColors.inkSoft, fontSize: 11)),
          Text(
            _fmt(r.value),
            style: TextStyle(
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
