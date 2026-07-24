import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'cycle_screen.dart';
import 'full_scan_screen.dart';
import 'health_report.dart';
import 'health_store.dart';
import 'heart_wave_screen.dart';
import 'medical_id_screen.dart';
import 'medications_screen.dart';
import 'oximeter_screen.dart';
import 'vitals_history_screen.dart';
import 'vitals_screen.dart';

/// The Health hub — one place for every health function: measure a pulse, log
/// vitals, track a cycle, manage medications and an emergency Medical ID, and
/// export a PDF report to show a doctor. All data lives on the device.
class HealthHubScreen extends StatefulWidget {
  const HealthHubScreen({super.key});

  @override
  State<HealthHubScreen> createState() => _HealthHubScreenState();
}

class _HealthHubScreenState extends State<HealthHubScreen> {
  Map<String, VitalReading> _latest = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final l = await HealthStore.latestByType();
    if (mounted) setState(() => _latest = l);
  }

  Future<void> _go(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    _load(); // refresh the summary after returning
  }

  @override
  Widget build(BuildContext context) {
    final hr = _latest["heart_rate"];
    final spo2 = _latest["spo2"];
    final steps = _latest["steps"];
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Health", "ကျန်းမာရေး"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
        children: [
          // Quick summary strip
          Row(
            children: [
              _summary(Icons.favorite, GwColors.live,
                  hr != null ? "${hr.display}" : "--", "bpm"),
              const SizedBox(width: 10),
              _summary(Icons.spa, const Color(0xFF2E7DB1),
                  spo2 != null ? "${spo2.display}%" : "--", "SpO₂"),
              const SizedBox(width: 10),
              _summary(Icons.directions_walk, const Color(0xFF2E9E5B),
                  steps != null ? steps.display : "--",
                  tr(context, "steps", "ခြေလှမ်း")),
            ],
          ),
          const SizedBox(height: 16),

          // One-tap Full Scan — measure everything at once.
          InkWell(
            borderRadius: BorderRadius.circular(GwRadius.lg),
            onTap: () => _go(const FullScanScreen()),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F2A16), Color(0xFF16351F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(GwRadius.lg),
                border: Border.all(
                    color: const Color(0xFF39E67B).withValues(alpha: 0.35)),
                boxShadow: GwShadow.card,
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: const Color(0xFF39E67B).withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.monitor_heart,
                        color: Color(0xFF39E67B), size: 26),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tr(context, "Full scan — measure all",
                              "အပြည့်အစုံ တိုင်းတာ"),
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 16),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          tr(context,
                              "HR · SpO₂ · respiration · HRV · calmness · PI in one go",
                              "HR · SpO₂ · အသက်ရှူ · HRV · တည်ငြိမ်မှု · PI တစ်ကြိမ်တည်း"),
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.7),
                              fontSize: 12.5),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: Colors.white54),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          _tile(
            icon: Icons.monitor_heart_outlined,
            color: GwColors.live,
            title: tr(context, "Heart wave (pulse)", "နှလုံးလှိုင်း (pulse)"),
            subtitle: tr(context,
                "Measure your heart rate with the camera",
                "ကင်မရာနဲ့ နှလုံးခုန်နှုန်း တိုင်းပါ"),
            onTap: () => _go(const HeartWaveScreen()),
          ),
          _tile(
            icon: Icons.spa,
            color: const Color(0xFF2E7DB1),
            title: tr(context, "Oximeter (SpO₂)", "အောက်ဆီမီတာ (SpO₂)"),
            subtitle: tr(context,
                "Measure blood-oxygen & pulse with the camera",
                "ကင်မရာနဲ့ သွေးအောက်ဆီဂျင်နဲ့ pulse တိုင်းပါ"),
            onTap: () => _go(const OximeterScreen()),
          ),
          _tile(
            icon: Icons.favorite_border,
            color: const Color(0xFF3B6D11),
            title: tr(context, "Vitals log", "ကျန်းမာရေး မှတ်တမ်း"),
            subtitle: tr(context,
                "Heart rate, blood pressure, weight, SpO₂, sugar…",
                "နှလုံးခုန်နှုန်း၊ သွေးဖိအား၊ အလေးချိန်၊ SpO₂…"),
            onTap: () => _go(const VitalsScreen()),
          ),
          _tile(
            icon: Icons.female,
            color: const Color(0xFFD6467E),
            title: tr(context, "Cycle tracking", "ရာသီစက်ဝန်း"),
            subtitle: tr(context,
                "Log periods, predict the next one & fertile window",
                "ရာသီမှတ်၊ နောက်ရာသီ ခန့်မှန်း"),
            onTap: () => _go(const CycleScreen()),
          ),
          _tile(
            icon: Icons.medication_outlined,
            color: const Color(0xFF7A4DD6),
            title: tr(context, "Medications", "ဆေးဝါးများ"),
            subtitle: tr(context, "Your medicines and dose times",
                "သောက်ဆေးနဲ့ အချိန်များ"),
            onTap: () => _go(const MedicationsScreen()),
          ),
          _tile(
            icon: Icons.badge_outlined,
            color: const Color(0xFFCB6D1E),
            title: tr(context, "Medical ID", "ဆေးဘက်ဆိုင်ရာ ကတ်"),
            subtitle: tr(context,
                "Blood type, allergies, emergency contact",
                "သွေးအမျိုးအစား၊ ဓာတ်မတည့်မှု၊ အရေးပေါ်ဆက်သွယ်ရန်"),
            onTap: () => _go(const MedicalIdScreen()),
          ),
          _tile(
            icon: Icons.insights_outlined,
            color: const Color(0xFF2E7DB1),
            title: tr(context, "Saved data & history", "သိမ်းထားသော data"),
            subtitle: tr(context,
                "Re-view every reading, with trends & charts",
                "မှတ်တမ်းအားလုံး ပြန်ကြည့် — trend + chart နဲ့"),
            onTap: () => _go(const VitalsHistoryScreen()),
          ),

          const SizedBox(height: 16),
          // Doctor report
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: GwColors.primaryGradient,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.description, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tr(context, "Health report for your doctor",
                            "ဆရာဝန်အတွက် health report"),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 15),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  tr(context,
                      "Export a PDF of your records. Choose what to include — leave out anything you'd rather not share.",
                      "မှတ်တမ်းများကို PDF ထုတ်ပါ။ ဘာတွေထည့်မလဲ ရွေးနိုင်ပြီး၊ မပြချင်တာ ချန်ထားနိုင်သည်။"),
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _exportReport,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: GwColors.primary,
                    ),
                    icon: const Icon(Icons.picture_as_pdf),
                    label: Text(
                        tr(context, "Export report", "Report ထုတ်ရန်")),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: GwColors.surfaceOf(context),
              borderRadius: BorderRadius.circular(GwRadius.md),
              border: Border.all(color: GwColors.lineOf(context)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline,
                    color: GwColors.inkSoftOf(context), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tr(context,
                        "For wellness tracking only. Not a medical device and not a substitute for professional advice. In an emergency, call your local emergency number.",
                        "ကျန်းမာရေး စောင့်ကြည့်ရန်သာ။ ဆေးဘက်ဆိုင်ရာ ကိရိယာ မဟုတ်ပါ။ အရေးပေါ်တွင် အရေးပေါ်ဖုန်းကို ခေါ်ပါ။"),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _summary(IconData icon, Color color, String value, String unit) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(value,
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w900)),
            Text(unit,
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15)),
                    Text(subtitle,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 12.5)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: GwColors.inkSoftOf(context)),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _exportReport() async {
    final prefs = await HealthStore.reportPrefs();
    if (!mounted) return;
    final go = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr(context, "Include in report", "Report တွင် ထည့်ရန်"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 18)),
              const SizedBox(height: 6),
              _check(ctx, tr(context, "Medical ID", "Medical ID"),
                  prefs.medicalId, (v) => setSheet(() => prefs.medicalId = v)),
              _check(ctx, tr(context, "Vitals", "Vitals"), prefs.vitals,
                  (v) => setSheet(() => prefs.vitals = v)),
              _check(ctx, tr(context, "Cycle", "ရာသီ"), prefs.cycle,
                  (v) => setSheet(() => prefs.cycle = v)),
              _check(ctx, tr(context, "Medications", "ဆေးဝါး"),
                  prefs.medications, (v) => setSheet(() => prefs.medications = v)),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.pop(ctx, true),
                  icon: const Icon(Icons.picture_as_pdf),
                  label: Text(tr(context, "Generate PDF", "PDF ထုတ်ရန်")),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (go != true) return;
    await HealthStore.saveReportPrefs(prefs);
    try {
      await exportHealthReport();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("$e")));
      }
    }
  }

  Widget _check(BuildContext ctx, String label, bool value,
      ValueChanged<bool> onChanged) {
    return CheckboxListTile(
      contentPadding: EdgeInsets.zero,
      controlAffinity: ListTileControlAffinity.leading,
      activeColor: GwColors.primary,
      title: Text(label),
      value: value,
      onChanged: (v) => onChanged(v ?? false),
    );
  }
}
