import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'health_store.dart';

/// Women's health: log the start (and optionally end) of each period, and get
/// a simple prediction of the next period and fertile window from the average
/// cycle length. Entirely on-device.
class CycleScreen extends StatefulWidget {
  const CycleScreen({super.key});

  @override
  State<CycleScreen> createState() => _CycleScreenState();
}

class _CycleScreenState extends State<CycleScreen> {
  List<CycleEntry> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final e = await HealthStore.cycles();
    if (mounted) setState(() {
          _entries = e;
          _loading = false;
        });
  }

  /// Average gap between consecutive period starts (defaults to 28 days).
  int get _avgCycle {
    if (_entries.length < 2) return 28;
    final sorted = [..._entries]..sort((a, b) => a.start.compareTo(b.start));
    var total = 0, n = 0;
    for (var i = 1; i < sorted.length; i++) {
      final d = sorted[i].start.difference(sorted[i - 1].start).inDays;
      if (d > 10 && d < 60) {
        total += d;
        n++;
      }
    }
    return n == 0 ? 28 : (total / n).round();
  }

  DateTime? get _nextPeriod =>
      _entries.isEmpty ? null : _entries.first.start.add(Duration(days: _avgCycle));

  /// Fertile window ≈ 5 days before to 1 day after ovulation (cycle − 14).
  (DateTime, DateTime)? get _fertileWindow {
    if (_entries.isEmpty) return null;
    final ovulation =
        _entries.first.start.add(Duration(days: _avgCycle - 14));
    return (
      ovulation.subtract(const Duration(days: 5)),
      ovulation.add(const Duration(days: 1))
    );
  }

  Future<void> _logToday() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
      helpText: tr(context, "Period start date", "ရာသီစ ရက်စွဲ"),
    );
    if (picked == null) return;
    await HealthStore.addCycle(CycleEntry(start: picked));
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final next = _nextPeriod;
    final fertile = _fertileWindow;
    final df = DateFormat("MMM d");
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Cycle tracking", "ရာသီစက်ဝန်း"))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _logToday,
        backgroundColor: const Color(0xFFD6467E),
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Log period", "ရာသီ မှတ်ရန်")),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: GwColors.primary))
          : ListView(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 90),
              children: [
                // Prediction card
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFD6467E), Color(0xFFF07AA6)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(GwRadius.lg),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                          tr(context, "Next period (estimated)",
                              "နောက်ရာသီ (ခန့်မှန်း)"),
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.85),
                              fontSize: 13)),
                      const SizedBox(height: 4),
                      Text(
                        next == null
                            ? tr(context, "Log a period to start",
                                "ရာသီတစ်ခု မှတ်ပါ")
                            : df.format(next),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w900),
                      ),
                      if (next != null)
                        Text(
                          "${tr(context, "in", "နောက်")} ${next.difference(DateTime.now()).inDays} ${tr(context, "days", "ရက်")} · ${tr(context, "avg cycle", "ပျမ်းမျှ")} $_avgCycle ${tr(context, "days", "ရက်")}",
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.9),
                              fontSize: 13),
                        ),
                      if (fertile != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            "${tr(context, "Fertile window", "ကိုယ်ဝန်ရနိုင်ချိန်")}: ${df.format(fertile.$1)} – ${df.format(fertile.$2)}",
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Text(
                    tr(context,
                        "Estimates only — many factors affect your cycle. Not contraception advice.",
                        "ခန့်မှန်းချက်သာ — အချက်များစွာ သက်ရောက်နိုင်သည်။ တားဆီးရေး အကြံဉာဏ် မဟုတ်ပါ။"),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 11),
                  ),
                ),
                const SizedBox(height: 8),
                Text(tr(context, "History", "မှတ်တမ်း"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: 8),
                if (_entries.isEmpty)
                  GwEmpty(
                      icon: Icons.calendar_month,
                      title: tr(context, "No entries yet",
                          "မှတ်တမ်း မရှိသေးပါ"))
                else
                  ..._entries.map((e) => Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: GwColors.surfaceOf(context),
                          borderRadius: BorderRadius.circular(GwRadius.md),
                          boxShadow: GwShadow.card,
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.water_drop,
                                color: Color(0xFFD6467E), size: 20),
                            const SizedBox(width: 12),
                            Text(DateFormat("MMM d, yyyy").format(e.start),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                      )),
              ],
            ),
    );
  }
}
