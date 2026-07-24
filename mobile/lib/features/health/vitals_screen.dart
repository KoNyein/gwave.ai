import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'health_store.dart';

IconData vitalIcon(String key) {
  switch (key) {
    case "heart_rate":
      return Icons.favorite;
    case "bp":
      return Icons.monitor_heart;
    case "spo2":
      return Icons.spa;
    case "temp":
      return Icons.thermostat;
    case "weight":
      return Icons.monitor_weight;
    case "glucose":
      return Icons.water_drop;
    case "respiratory":
      return Icons.air;
    case "steps":
      return Icons.directions_walk;
    default:
      return Icons.favorite;
  }
}

/// Log any vital sign and browse its history. Fully manual entry — pair it with
/// the Heart-wave screen (which writes a heart-rate reading automatically).
class VitalsScreen extends StatefulWidget {
  const VitalsScreen({super.key, this.focusType});
  final VitalType? focusType;

  @override
  State<VitalsScreen> createState() => _VitalsScreenState();
}

class _VitalsScreenState extends State<VitalsScreen> {
  List<VitalReading> _all = [];
  bool _loading = true;
  late VitalType _filter = widget.focusType ?? VitalType.heartRate;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final v = await HealthStore.vitals();
    if (mounted) setState(() {
          _all = v;
          _loading = false;
        });
  }

  List<VitalReading> get _filtered =>
      _all.where((r) => r.type == _filter.key).toList();

  Future<void> _addDialog() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddVitalSheet(initial: _filter),
    );
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Vitals", "ကျန်းမာရေးတိုင်းတာမှု"))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addDialog,
        backgroundColor: GwColors.primary,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Log", "မှတ်တမ်းတင်")),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : Column(
              children: [
                SizedBox(
                  height: 46,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      for (final t in VitalType.all)
                        Padding(
                          padding: const EdgeInsets.only(right: 8, top: 6),
                          child: ChoiceChip(
                            label: Text(tr(context, t.en, t.my)),
                            selected: _filter.key == t.key,
                            onSelected: (_) => setState(() => _filter = t),
                          ),
                        ),
                    ],
                  ),
                ),
                _trendCard(),
                Expanded(
                  child: _filtered.isEmpty
                      ? GwEmpty(
                          icon: vitalIcon(_filter.key),
                          title: tr(context, "No readings yet",
                              "မှတ်တမ်း မရှိသေးပါ"),
                          subtitle: tr(context, "Tap Log to add one.",
                              "Log ကိုနှိပ်ပြီး ထည့်ပါ။"))
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(14, 4, 14, 90),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) => _row(_filtered[i]),
                        ),
                ),
              ],
            ),
    );
  }

  /// A tiny inline sparkline of the last readings for the selected vital.
  Widget _trendCard() {
    final data = _filtered.take(20).toList().reversed.toList();
    if (data.length < 2) return const SizedBox.shrink();
    final latest = data.last;
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 8, 14, 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(vitalIcon(_filter.key), color: GwColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(tr(context, _filter.en, _filter.my),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              const Spacer(),
              Text("${latest.display} ${_filter.unit}",
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: GwColors.primary)),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 56,
            child: CustomPaint(
              size: Size.infinite,
              painter: _SparkPainter(data.map((e) => e.value).toList()),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(VitalReading r) {
    final t = VitalType.byKey(r.type);
    return Dismissible(
      key: ValueKey(r.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: GwColors.live.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: const Icon(Icons.delete, color: GwColors.live),
      ),
      onDismissed: (_) async {
        await HealthStore.deleteVital(r.id);
        _load();
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Icon(vitalIcon(r.type), color: GwColors.primary, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("${r.display} ${t.unit}",
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
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values);
  final List<double> values;

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
      final y = size.height - ((values[i] - lo) / span) * size.height;
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
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

class _AddVitalSheet extends StatefulWidget {
  const _AddVitalSheet({required this.initial});
  final VitalType initial;

  @override
  State<_AddVitalSheet> createState() => _AddVitalSheetState();
}

class _AddVitalSheetState extends State<_AddVitalSheet> {
  late VitalType _type = widget.initial;
  final _v1 = TextEditingController();
  final _v2 = TextEditingController();
  final _note = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _v1.dispose();
    _v2.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v1 = double.tryParse(_v1.text.trim());
    if (v1 == null) return;
    setState(() => _saving = true);
    final reading = VitalReading(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      type: _type.key,
      value: v1,
      value2: _type.hasSecond ? double.tryParse(_v2.text.trim()) : null,
      at: DateTime.now(),
      note: _note.text.trim().isEmpty ? null : _note.text.trim(),
    );
    await HealthStore.addVital(reading);
    if (mounted) {
      // Mirror to the user's cloud database (best-effort).
      await pushVitalToServer(context.read<AppState>().api, reading);
    }
    if (mounted) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(18, 18, 18, 18 + pad),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "Log a reading", "မှတ်တမ်းတင်ရန်"),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _type.key,
            decoration: InputDecoration(
                labelText: tr(context, "Type", "အမျိုးအစား")),
            items: [
              for (final t in VitalType.all)
                DropdownMenuItem(
                    value: t.key, child: Text(tr(context, t.en, t.my))),
            ],
            onChanged: (k) =>
                setState(() => _type = VitalType.byKey(k ?? _type.key)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _v1,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true),
                  decoration: InputDecoration(
                    labelText: _type.hasSecond
                        ? tr(context, "Systolic", "အပေါ်")
                        : "${tr(context, _type.en, _type.my)} (${_type.unit})",
                  ),
                ),
              ),
              if (_type.hasSecond) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _v2,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                        labelText: tr(context, "Diastolic", "အောက်")),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            decoration: InputDecoration(
                labelText: tr(context, "Note (optional)", "မှတ်ချက် (optional)")),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(tr(context, "Save", "သိမ်းမည်")),
            ),
          ),
        ],
      ),
    );
  }
}
