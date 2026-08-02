import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'health_store.dart';
import 'vitals_screen.dart' show vitalIcon;

/// "Saved data" — pulls every measured vital back from the database (local +
/// cloud, merged and de-duplicated), grouped by type with the latest value, a
/// trend sparkline and a full history you can re-view. This is the
/// pull-it-back-and-show-it side of the measure→save→review loop.
class VitalsHistoryScreen extends StatefulWidget {
  const VitalsHistoryScreen({super.key});

  @override
  State<VitalsHistoryScreen> createState() => _VitalsHistoryScreenState();
}

class _VitalsHistoryScreenState extends State<VitalsHistoryScreen> {
  List<VitalReading> _all = [];
  bool _loading = true;
  bool _cloud = false; // did any cloud rows come back?

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final local = await HealthStore.vitals();
    List<VitalReading> cloud = [];
    if (mounted) {
      try {
        cloud = await serverVitals(context.read<AppState>().api);
      } catch (_) {}
    }
    // Merge, de-dup by id (server id and local id differ, so also drop exact
    // type+value+minute duplicates that a best-effort mirror can create).
    final byId = <String, VitalReading>{};
    for (final r in [...local, ...cloud]) {
      byId[r.id] = r;
    }
    final seen = <String>{};
    final merged = <VitalReading>[];
    for (final r in byId.values) {
      final k =
          "${r.type}|${r.value}|${r.at.toUtc().toIso8601String().substring(0, 16)}";
      if (seen.add(k)) merged.add(r);
    }
    merged.sort((a, b) => b.at.compareTo(a.at));
    if (mounted) {
      setState(() {
        _all = merged;
        _cloud = cloud.isNotEmpty;
        _loading = false;
      });
    }
  }

  /// Types present, ordered by most-recent reading.
  List<String> get _types {
    final order = <String>[];
    for (final r in _all) {
      if (!order.contains(r.type)) order.add(r.type);
    }
    return order;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Saved data", "သိမ်းထားသော data")),
        actions: [
          if (_cloud)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Row(children: [
                Icon(Icons.cloud_done,
                    size: 18, color: GwColors.inkSoftOf(context)),
                const SizedBox(width: 4),
                Text(tr(context, "Synced", "sync ပြီး"),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12)),
              ]),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : _all.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Text(
                      tr(context,
                          "No saved readings yet. Measure something — it'll appear here.",
                          "မှတ်တမ်း မရှိသေးပါ။ တစ်ခုခု တိုင်းလိုက်ပါ — ဒီမှာ ပေါ်လာပါမယ်။"),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: GwColors.inkSoftOf(context)),
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
                    children: [
                      for (final t in _types) _typeCard(t),
                    ],
                  ),
                ),
    );
  }

  Widget _typeCard(String type) {
    final vt = VitalType.byKey(type);
    final readings = _all.where((r) => r.type == type).toList(); // newest first
    final latest = readings.first;
    // chronological values for the sparkline
    final series =
        readings.take(24).toList().reversed.map((e) => e.value).toList();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => _TypeDetailScreen(type: type, readings: readings))),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            border: Border.all(color: GwColors.lineOf(context)),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(vitalIcon(type), color: GwColors.primary, size: 20),
                  const SizedBox(width: 8),
                  Text(tr(context, vt.en, vt.my),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const Spacer(),
                  Text("${latest.display} ${vt.unit}",
                      style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                          color: GwColors.primary)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                "${readings.length} ${tr(context, "readings", "မှတ်တမ်း")} · ${tr(context, "last", "နောက်ဆုံး")} ${DateFormat("MMM d, h:mm a").format(latest.at)}",
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 12),
              ),
              if (series.length >= 2) ...[
                const SizedBox(height: 10),
                SizedBox(
                  height: 46,
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: _SparkPainter(series),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Full history of one vital type: a chart + every reading.
class _TypeDetailScreen extends StatelessWidget {
  const _TypeDetailScreen({required this.type, required this.readings});
  final String type;
  final List<VitalReading> readings; // newest first

  @override
  Widget build(BuildContext context) {
    final vt = VitalType.byKey(type);
    final chrono = readings.reversed.toList();
    final values = chrono.map((e) => e.value).toList();
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final avg = values.reduce((a, b) => a + b) / values.length;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, vt.en, vt.my))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GwColors.surfaceOf(context),
              borderRadius: BorderRadius.circular(GwRadius.lg),
              border: Border.all(color: GwColors.lineOf(context)),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _stat(context, tr(context, "Min", "အနိမ့်"),
                        "${lo.toStringAsFixed(0)}"),
                    _stat(context, tr(context, "Avg", "ပျမ်းမျှ"),
                        "${avg.toStringAsFixed(0)}"),
                    _stat(context, tr(context, "Max", "အမြင့်"),
                        "${hi.toStringAsFixed(0)}"),
                    _stat(context, tr(context, "Count", "အရေအတွက်"),
                        "${readings.length}"),
                  ],
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 130,
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: _SparkPainter(values, filled: true),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          for (final r in readings) _row(context, r, vt),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String k, String v) => Column(
        children: [
          Text(v,
              style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                  color: GwColors.primary)),
          Text(k,
              style:
                  TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11)),
        ],
      );

  Widget _row(BuildContext context, VitalReading r, VitalType vt) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${r.display} ${vt.unit}",
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                  Text(DateFormat("MMM d, yyyy · h:mm a").format(r.at),
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 12)),
                  if (r.note != null && r.note!.isNotEmpty)
                    Text(r.note!,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 12)),
                ],
              ),
            ),
          ],
        ),
      );
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, {this.filled = false});
  final List<double> values;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final span = (hi - lo).abs() < 0.001 ? 1.0 : hi - lo;
    final dx = size.width / (values.length - 1);
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = dx * i;
      final y = size.height - ((values[i] - lo) / span) * size.height * 0.9 -
          size.height * 0.05;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    if (filled) {
      final fill = Path.from(path)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        fill,
        Paint()..color = GwColors.primary.withValues(alpha: 0.12),
      );
    }
    canvas.drawPath(
      path,
      Paint()
        ..color = GwColors.primary
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) => old.values != values;
}
