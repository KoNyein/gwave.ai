import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'full_scan_screen.dart';
import 'health_store.dart';

/// Real Material icon for each event type (safer than raw codepoints).
IconData eventIcon(String key) {
  switch (key) {
    case "cannabis":
      return Icons.grass;
    case "medication":
      return Icons.medication;
    case "meal":
      return Icons.restaurant;
    case "exercise":
      return Icons.fitness_center;
    case "caffeine":
      return Icons.local_cafe;
    case "alcohol":
      return Icons.local_bar;
    case "symptom":
      return Icons.sick;
    default:
      return Icons.notes;
  }
}

/// Health activity journal: log when you used THC, took a medication, ate,
/// exercised, had caffeine/alcohol or felt a symptom — each stamped with the
/// time and tied to your nearest heart-rate reading, so you can see how things
/// affect you. Saved locally + to the cloud (public.health_events).
class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  State<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends State<ActivityLogScreen> {
  List<HealthEvent> _events = [];
  List<VitalReading> _hr = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final local = await HealthStore.events();
    final vitals = await HealthStore.vitals();
    List<HealthEvent> cloud = [];
    if (mounted) {
      try {
        cloud = await serverEvents(context.read<AppState>().api);
      } catch (_) {}
    }
    // Merge local + cloud, de-dup by type + minute.
    final seen = <String>{};
    final merged = <HealthEvent>[];
    for (final e in [...local, ...cloud]) {
      final k =
          "${e.type}|${e.at.toUtc().toIso8601String().substring(0, 16)}";
      if (seen.add(k)) merged.add(e);
    }
    merged.sort((a, b) => b.at.compareTo(a.at));
    if (mounted) {
      setState(() {
        _events = merged;
        _hr = vitals.where((v) => v.type == VitalType.heartRate.key).toList();
        _loading = false;
      });
    }
  }

  /// The heart-rate reading nearest an event time (within 45 min), if any.
  VitalReading? _nearestHr(DateTime when) {
    VitalReading? best;
    Duration bestGap = const Duration(minutes: 46);
    for (final r in _hr) {
      final gap = (r.at.difference(when)).abs();
      if (gap < bestGap) {
        bestGap = gap;
        best = r;
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Activity log", "လှုပ်ရှားမှု မှတ်တမ်း"))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addDialog,
        backgroundColor: GwColors.primary,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Log", "မှတ်တမ်းတင်")),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : _events.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 100),
                    children: _buildTimeline(),
                  ),
                ),
    );
  }

  Widget _empty() => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.event_note_outlined,
                  size: 56, color: GwColors.inkSoftOf(context)),
              const SizedBox(height: 12),
              Text(
                tr(context,
                    "No entries yet. Tap Log to record something — THC, a medicine, a meal, exercise…",
                    "မှတ်တမ်း မရှိသေးပါ။ Log ကိုနှိပ်ပြီး မှတ်ပါ — THC, ဆေး, အစားအစာ, လေ့ကျင့်ခန်း…"),
                textAlign: TextAlign.center,
                style: TextStyle(color: GwColors.inkSoftOf(context)),
              ),
            ],
          ),
        ),
      );

  List<Widget> _buildTimeline() {
    final out = <Widget>[];
    String? lastDay;
    for (final e in _events) {
      final day = DateFormat("EEEE, MMM d").format(e.at);
      if (day != lastDay) {
        lastDay = day;
        out.add(Padding(
          padding: const EdgeInsets.fromLTRB(4, 12, 4, 6),
          child: Text(day,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context),
                  fontWeight: FontWeight.w800,
                  fontSize: 13)),
        ));
      }
      out.add(_eventCard(e));
    }
    return out;
  }

  Widget _eventCard(HealthEvent e) {
    final t = EventType.byKey(e.type);
    final hr = _nearestHr(e.at);
    return Dismissible(
      key: ValueKey(e.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: GwColors.live.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: const Icon(Icons.delete, color: GwColors.live),
      ),
      onDismissed: (_) async {
        await HealthStore.deleteEvent(e.id);
        _load();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.md),
          border: Border.all(color: GwColors.lineOf(context)),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(eventIcon(t.key),
                  color: GwColors.primary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(context, t.en, t.my),
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 15)),
                  Text(DateFormat("h:mm a").format(e.at),
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 12)),
                  if (e.detail != null && e.detail!.isNotEmpty)
                    Text(e.detail!,
                        style: const TextStyle(fontSize: 13)),
                  if (e.note != null && e.note!.isNotEmpty)
                    Text(e.note!,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 13)),
                ],
              ),
            ),
            if (hr != null)
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.favorite, color: GwColors.live, size: 16),
                  Text("${hr.display}",
                      style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                          color: GwColors.live)),
                  Text("bpm",
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 10)),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _addDialog() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _AddEventSheet(),
    );
    if (saved == true) _load();
  }
}

class _AddEventSheet extends StatefulWidget {
  const _AddEventSheet();

  @override
  State<_AddEventSheet> createState() => _AddEventSheetState();
}

class _AddEventSheetState extends State<_AddEventSheet> {
  EventType _type = EventType.cannabis;
  DateTime _when = DateTime.now();
  final _detail = TextEditingController();
  final _note = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _detail.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _when,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (d == null || !mounted) return;
    final t = await showTimePicker(
        context: context, initialTime: TimeOfDay.fromDateTime(_when));
    if (t == null) return;
    setState(() =>
        _when = DateTime(d.year, d.month, d.day, t.hour, t.minute));
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final e = HealthEvent(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      type: _type.key,
      at: _when,
      detail: _detail.text.trim().isEmpty ? null : _detail.text.trim(),
      note: _note.text.trim().isEmpty ? null : _note.text.trim(),
    );
    await HealthStore.addEvent(e);
    if (mounted) await pushEventToServer(context.read<AppState>().api, e);
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
          Text(tr(context, "Log an activity", "လှုပ်ရှားမှု မှတ်တမ်းတင်"),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final t in EventType.all)
                ChoiceChip(
                  label: Text(tr(context, t.en, t.my)),
                  avatar: Icon(eventIcon(t.key),
                      size: 18,
                      color: _type.key == t.key
                          ? Colors.white
                          : GwColors.inkSoftOf(context)),
                  selected: _type.key == t.key,
                  selectedColor: GwColors.primary,
                  labelStyle: TextStyle(
                      color: _type.key == t.key
                          ? Colors.white
                          : GwColors.inkOf(context)),
                  onSelected: (_) => setState(() => _type = t),
                ),
            ],
          ),
          const SizedBox(height: 14),
          // Time picker row.
          InkWell(
            onTap: _pickTime,
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: GwColors.surfaceMutedOf(context),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: GwColors.lineOf(context)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.schedule, size: 18),
                  const SizedBox(width: 10),
                  Text(DateFormat("EEE, MMM d · h:mm a").format(_when),
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Text(tr(context, "Change", "ပြောင်း"),
                      style: const TextStyle(
                          color: GwColors.primary, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _detail,
            decoration: InputDecoration(
              labelText: tr(context, "Detail", "အသေးစိတ်"),
              hintText: tr(context, _type.detailHintEn, _type.detailHintMy),
            ),
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
          const SizedBox(height: 8),
          // Quick measure — capture a heart rate to pair with this moment.
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _saving
                  ? null
                  : () {
                      Navigator.of(context).pop(true);
                      Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const FullScanScreen()));
                    },
              icon: const Icon(Icons.monitor_heart),
              label: Text(tr(context, "Save & measure now",
                  "သိမ်းပြီး အခု တိုင်းမည်")),
            ),
          ),
        ],
      ),
    );
  }
}
