import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../../widgets/sparkline.dart';

/// Device detail: a line chart per metric over the recent reading history, plus
/// the current value and min/max for the window.
class DeviceDetailScreen extends StatefulWidget {
  const DeviceDetailScreen({super.key, required this.device});
  final Device device;

  @override
  State<DeviceDetailScreen> createState() => _DeviceDetailScreenState();
}

class _DeviceDetailScreenState extends State<DeviceDetailScreen> {
  Map<String, List<SensorReading>> _history = {};
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
    try {
      final h = await context
          .read<AppState>()
          .repo
          .readingsHistory(widget.device.id);
      setState(() => _history = h);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final metrics = _history.keys.toList();
    return Scaffold(
      appBar: AppBar(title: Text(widget.device.name)),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : _error != null
                ? ListView(children: [
                    const SizedBox(height: 120),
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  ])
                : metrics.isEmpty
                    ? ListView(children: const [
                        SizedBox(height: 120),
                        GwEmpty(
                            icon: Icons.show_chart,
                            title: "No history yet",
                            subtitle: "This device hasn't sent readings yet"),
                      ])
                    : ListView.separated(
                        padding: const EdgeInsets.all(14),
                        itemCount: metrics.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) =>
                            _metricCard(metrics[i], _history[metrics[i]]!),
                      ),
      ),
    );
  }

  Widget _metricCard(String metric, List<SensorReading> series) {
    final values = series.map((r) => r.value).toList();
    final current = values.isNotEmpty ? values.last : 0.0;
    var min = values.isEmpty ? 0.0 : values.first;
    var max = min;
    for (final v in values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(metric,
                    style: const TextStyle(
                        color: GwColors.inkSoft,
                        fontWeight: FontWeight.w600,
                        fontSize: 13)),
                const Spacer(),
                Text(_fmt(current),
                    style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 26,
                        color: GwColors.primaryDark)),
              ],
            ),
            const SizedBox(height: 12),
            Sparkline(values: values, height: 72),
            const SizedBox(height: 10),
            Row(
              children: [
                _stat("Min", min),
                const SizedBox(width: 20),
                _stat("Max", max),
                const Spacer(),
                Text("${series.length} readings",
                    style: const TextStyle(
                        color: GwColors.inkSoft, fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _stat(String label, double v) => Row(
        children: [
          Text("$label ",
              style: const TextStyle(color: GwColors.inkSoft, fontSize: 12)),
          Text(_fmt(v),
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 13)),
        ],
      );

  String _fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
}
