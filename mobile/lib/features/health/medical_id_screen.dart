import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'health_store.dart';

/// Emergency Medical ID — the critical facts a first responder needs: blood
/// type, allergies, conditions, current medicines and an emergency contact.
/// Stored on-device and included in the doctor report / SOS if the user opts in.
class MedicalIdScreen extends StatefulWidget {
  const MedicalIdScreen({super.key});

  @override
  State<MedicalIdScreen> createState() => _MedicalIdScreenState();
}

class _MedicalIdScreenState extends State<MedicalIdScreen> {
  MedicalId _m = MedicalId.empty();
  bool _loading = true;

  final _name = TextEditingController();
  final _allergies = TextEditingController();
  final _conditions = TextEditingController();
  final _medications = TextEditingController();
  final _notes = TextEditingController();
  final _emName = TextEditingController();
  final _emPhone = TextEditingController();

  static const _bloodTypes = [
    "A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _allergies,
      _conditions,
      _medications,
      _notes,
      _emName,
      _emPhone
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final m = await HealthStore.medicalId();
    _name.text = m.fullName ?? "";
    _allergies.text = m.allergies ?? "";
    _conditions.text = m.conditions ?? "";
    _medications.text = m.medications ?? "";
    _notes.text = m.notes ?? "";
    _emName.text = m.emergencyName ?? "";
    _emPhone.text = m.emergencyPhone ?? "";
    if (mounted) setState(() {
          _m = m;
          _loading = false;
        });
  }

  Future<void> _save() async {
    _m
      ..fullName = _name.text.trim().isEmpty ? null : _name.text.trim()
      ..allergies =
          _allergies.text.trim().isEmpty ? null : _allergies.text.trim()
      ..conditions =
          _conditions.text.trim().isEmpty ? null : _conditions.text.trim()
      ..medications =
          _medications.text.trim().isEmpty ? null : _medications.text.trim()
      ..notes = _notes.text.trim().isEmpty ? null : _notes.text.trim()
      ..emergencyName =
          _emName.text.trim().isEmpty ? null : _emName.text.trim()
      ..emergencyPhone =
          _emPhone.text.trim().isEmpty ? null : _emPhone.text.trim();
    await HealthStore.saveMedicalId(_m);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Medical ID saved.", "Medical ID သိမ်းပြီး။"))));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Medical ID", "ဆေးဘက်ဆိုင်ရာ ကတ်")),
        actions: [
          TextButton(
            onPressed: _save,
            child: Text(tr(context, "Save", "သိမ်း")),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
              children: [
                _field(_name, tr(context, "Full name", "အမည်အပြည့်အစုံ")),
                const SizedBox(height: 12),
                Text(tr(context, "Blood type", "သွေးအမျိုးအစား"),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final b in _bloodTypes)
                      ChoiceChip(
                        label: Text(b),
                        selected: _m.bloodType == b,
                        onSelected: (_) => setState(() => _m.bloodType = b),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                _field(_allergies,
                    tr(context, "Allergies", "ဓာတ်မတည့်မှုများ"),
                    lines: 2),
                const SizedBox(height: 12),
                _field(_conditions,
                    tr(context, "Medical conditions", "ရောဂါအခံများ"),
                    lines: 2),
                const SizedBox(height: 12),
                _field(_medications,
                    tr(context, "Current medications", "လက်ရှိသောက်ဆေးများ"),
                    lines: 2),
                const SizedBox(height: 12),
                _field(_notes, tr(context, "Other notes", "အခြားမှတ်ချက်"),
                    lines: 2),
                const SizedBox(height: 20),
                Text(tr(context, "Emergency contact", "အရေးပေါ်ဆက်သွယ်ရန်"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 10),
                _field(_emName, tr(context, "Contact name", "အမည်")),
                const SizedBox(height: 12),
                _field(_emPhone, tr(context, "Contact phone", "ဖုန်းနံပါတ်"),
                    phone: true),
                const SizedBox(height: 16),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(tr(context, "Organ donor", "အင်္ဂါလှူဒါန်းသူ")),
                  value: _m.organDonor,
                  activeColor: GwColors.primary,
                  onChanged: (v) => setState(() => _m.organDonor = v),
                ),
                const SizedBox(height: 8),
                Text(
                  tr(context,
                      "Kept on this device. Shown in your doctor report and SOS only if you include it.",
                      "ဒီဖုန်းထဲမှာသာ သိမ်းသည်။ သင် ထည့်မှသာ doctor report / SOS မှာ ပါဝင်မည်။"),
                  style:
                      TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12),
                ),
              ],
            ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {int lines = 1, bool phone = false}) {
    return TextField(
      controller: c,
      maxLines: lines,
      keyboardType: phone ? TextInputType.phone : TextInputType.text,
      decoration: InputDecoration(labelText: label),
    );
  }
}
