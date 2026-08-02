import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'health_store.dart';

/// A simple medication list: name, dose and the times of day to take it. Times
/// are shown as reminders in the list; scheduled push reminders are a planned
/// follow-up (needs a local-notification plugin).
class MedicationsScreen extends StatefulWidget {
  const MedicationsScreen({super.key});

  @override
  State<MedicationsScreen> createState() => _MedicationsScreenState();
}

class _MedicationsScreenState extends State<MedicationsScreen> {
  List<Medication> _meds = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final m = await HealthStore.meds();
    if (mounted) setState(() {
          _meds = m;
          _loading = false;
        });
  }

  Future<void> _add() async {
    final m = await showModalBottomSheet<Medication>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _MedSheet(),
    );
    if (m != null) {
      final all = [..._meds, m];
      await HealthStore.saveMeds(all);
      _load();
    }
  }

  Future<void> _remove(int i) async {
    final all = [..._meds]..removeAt(i);
    await HealthStore.saveMeds(all);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Medications", "ဆေးဝါးများ"))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        backgroundColor: GwColors.primary,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Add", "ထည့်ရန်")),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : _meds.isEmpty
              ? GwEmpty(
                  icon: Icons.medication,
                  title: tr(context, "No medications", "ဆေးဝါး မရှိသေးပါ"),
                  subtitle: tr(context, "Add the medicines you take.",
                      "သောက်နေတဲ့ ဆေးတွေ ထည့်ပါ။"))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
                  itemCount: _meds.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final m = _meds[i];
                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: GwColors.surfaceOf(context),
                        borderRadius: BorderRadius.circular(GwRadius.md),
                        boxShadow: GwShadow.card,
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.medication,
                              color: GwColors.primary, size: 22),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(m.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15)),
                                if (m.dose != null && m.dose!.isNotEmpty)
                                  Text(m.dose!,
                                      style: TextStyle(
                                          color: GwColors.inkSoftOf(context),
                                          fontSize: 13)),
                                if (m.times.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Wrap(
                                      spacing: 6,
                                      children: [
                                        for (final t in m.times)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: GwColors.primary
                                                  .withValues(alpha: 0.1),
                                              borderRadius:
                                                  BorderRadius.circular(8),
                                            ),
                                            child: Text("🕑 $t",
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    color: GwColors.primary,
                                                    fontWeight:
                                                        FontWeight.w600)),
                                          ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: GwColors.inkSoft),
                            onPressed: () => _remove(i),
                          ),
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}

class _MedSheet extends StatefulWidget {
  const _MedSheet();

  @override
  State<_MedSheet> createState() => _MedSheetState();
}

class _MedSheetState extends State<_MedSheet> {
  final _name = TextEditingController();
  final _dose = TextEditingController();
  final List<String> _times = [];

  @override
  void dispose() {
    _name.dispose();
    _dose.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(
        context: context, initialTime: TimeOfDay.now());
    if (t != null) {
      final label = t.format(context);
      setState(() {
        if (!_times.contains(label)) _times.add(label);
      });
    }
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
          Text(tr(context, "Add medication", "ဆေးဝါး ထည့်ရန်"),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          const SizedBox(height: 12),
          TextField(
            controller: _name,
            decoration:
                InputDecoration(labelText: tr(context, "Name", "အမည်")),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _dose,
            decoration: InputDecoration(
                labelText: tr(context, "Dose (e.g. 500 mg)", "ပမာဏ")),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final t in _times)
                Chip(
                  label: Text(t),
                  onDeleted: () => setState(() => _times.remove(t)),
                ),
              ActionChip(
                avatar: const Icon(Icons.add_alarm, size: 18),
                label: Text(tr(context, "Add time", "အချိန်ထည့်")),
                onPressed: _pickTime,
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {
                if (_name.text.trim().isEmpty) return;
                Navigator.pop(
                  context,
                  Medication(
                    name: _name.text.trim(),
                    dose: _dose.text.trim().isEmpty ? null : _dose.text.trim(),
                    times: _times,
                  ),
                );
              },
              child: Text(tr(context, "Save", "သိမ်းမည်")),
            ),
          ),
        ],
      ),
    );
  }
}
