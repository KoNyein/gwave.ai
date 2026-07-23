import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native Finance — the business-expense tracker from the web `/finance`,
/// fully on-device: this-month summary by category, unpaid-first list with
/// paid/unpaid toggle, and an add-expense sheet. All rows live in
/// `business_expenses` under the caller's own RLS.
class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

const _categories = <(String, String, IconData)>[
  ("salary", "Salary", Icons.people_outline),
  ("rent", "Rent", Icons.home_work_outlined),
  ("utility", "Utilities", Icons.bolt_outlined),
  ("tax", "Tax", Icons.receipt_long_outlined),
  ("other", "Other", Icons.category_outlined),
];

String _catLabel(String slug) {
  for (final c in _categories) {
    if (c.$1 == slug) return c.$2;
  }
  return slug;
}

IconData _catIcon(String slug) {
  for (final c in _categories) {
    if (c.$1 == slug) return c.$3;
  }
  return Icons.category_outlined;
}

class _FinanceScreenState extends State<FinanceScreen> {
  List<Expense> _expenses = [];
  bool _loading = true;
  String? _error;

  /// Which month the dashboard shows (‹ › arrows move it).
  DateTime _view = DateTime(DateTime.now().year, DateTime.now().month, 1);

  /// Monthly budget, kept on-device (shared_preferences).
  double? _budget;

  // List filters.
  String _filterCat = "all";
  bool _unpaidOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
    _loadBudget();
  }

  Future<void> _loadBudget() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final v = prefs.getDouble("finance_budget");
      if (mounted && v != null && v > 0) setState(() => _budget = v);
    } catch (_) {}
  }

  Future<void> _editBudget() async {
    final ctl = TextEditingController(
        text: _budget == null ? "" : _budget!.toStringAsFixed(0));
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Monthly budget", "လစဉ် ဘတ်ဂျက်")),
        content: TextField(
          controller: ctl,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: tr(ctx, "Budget (Ks) — 0 to remove",
                "ဘတ်ဂျက် (ကျပ်) — ဖျက်ရန် 0"),
            prefixIcon: const Icon(Icons.savings_outlined),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "Save", "သိမ်းမည်"))),
        ],
      ),
    );
    if (saved != true) return;
    final v = double.tryParse(ctl.text.trim().replaceAll(",", "")) ?? 0;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (v > 0) {
        await prefs.setDouble("finance_budget", v);
      } else {
        await prefs.remove("finance_budget");
      }
    } catch (_) {}
    if (mounted) setState(() => _budget = v > 0 ? v : null);
  }

  void _shiftMonth(int delta) => setState(
      () => _view = DateTime(_view.year, _view.month + delta, 1));

  String get _monthLabel {
    const names = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return "${names[_view.month - 1]} ${_view.year}";
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final e = await context.read<AppState>().repo.expenses();
      if (mounted) setState(() => _expenses = e);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Totals for the viewed month, matching the web's summariseMonth: a
  /// recurring cost counts every month from its start; a one-off only in its
  /// own month.
  ({double total, double unpaid, Map<String, double> byCat}) _month() {
    final now = _view;
    final nextMonth = DateTime(now.year, now.month + 1, 1);
    final byCat = <String, double>{};
    double total = 0, unpaid = 0;
    for (final e in _expenses) {
      final start = e.dueDate ?? e.createdAt;
      final counts = e.recurring
          ? start.isBefore(nextMonth)
          : start.year == now.year && start.month == now.month;
      if (!counts) continue;
      byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
      total += e.amount;
      if (!e.isPaid) unpaid += e.amount;
    }
    return (total: total, unpaid: unpaid, byCat: byCat);
  }

  Future<void> _togglePaid(Expense e) async {
    try {
      await context.read<AppState>().repo.setExpensePaid(e.id, !e.isPaid);
      await _load();
    } catch (err) {
      _snack("${tr(context, "Failed", "မအောင်မြင်ပါ")} — $err");
    }
  }

  Future<void> _delete(Expense e) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(context, "Delete this?", "ဖျက်မလား?")),
        content: Text(e.title),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(context, "Keep", "မဖျက်ပါ"))),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: GwColors.live),
            child: Text(tr(context, "Delete", "ဖျက်မည်")),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await context.read<AppState>().repo.deleteExpense(e.id);
      await _load();
    } catch (err) {
      _snack("${tr(context, "Couldn't delete", "မဖျက်နိုင်ပါ")} — $err");
    }
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  /// Print the viewed month as an A4 report (Padauk font, so Burmese expense
  /// names render) via the system print dialog — printer, save as PDF, share.
  Future<void> _printReport() async {
    try {
      final m = _month();
      final fontData = await rootBundle.load("assets/Padauk-Regular.ttf");
      final font = pw.Font.ttf(fontData);
      final h1 = pw.TextStyle(
          font: font, fontSize: 18, fontWeight: pw.FontWeight.bold);
      final bold = pw.TextStyle(
          font: font, fontSize: 11, fontWeight: pw.FontWeight.bold);
      final normal = pw.TextStyle(font: font, fontSize: 10.5);

      final nextMonth = DateTime(_view.year, _view.month + 1, 1);
      final rows = _expenses.where((e) {
        final start = e.dueDate ?? e.createdAt;
        return e.recurring
            ? start.isBefore(nextMonth)
            : start.year == _view.year && start.month == _view.month;
      }).toList();

      final doc = pw.Document();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text("Finance report — $_monthLabel", style: h1),
              pw.SizedBox(height: 4),
              pw.Text("Gwave Finance", style: normal),
              pw.SizedBox(height: 14),
              pw.Row(children: [
                pw.Text("Total: ${money(m.total, "Ks")}   ", style: bold),
                pw.Text("Unpaid: ${money(m.unpaid, "Ks")}", style: bold),
              ]),
              pw.SizedBox(height: 10),
              pw.TableHelper.fromTextArray(
                headerStyle: bold,
                cellStyle: normal,
                headerDecoration:
                    const pw.BoxDecoration(color: PdfColors.grey200),
                columnWidths: {
                  0: const pw.FlexColumnWidth(3),
                  1: const pw.FlexColumnWidth(1.6),
                  2: const pw.FlexColumnWidth(1.6),
                  3: const pw.FlexColumnWidth(1.2),
                },
                headers: ["Expense", "Category", "Amount", "Paid"],
                data: [
                  for (final e in rows)
                    [
                      e.title + (e.recurring ? "  (monthly)" : ""),
                      _catLabel(e.category),
                      money(e.amount, "Ks"),
                      e.isPaid ? "Yes" : "No",
                    ],
                ],
              ),
            ],
          ),
        ),
      );
      await Printing.layoutPdf(
        onLayout: (_) => doc.save(),
        name: "finance-$_monthLabel.pdf",
      );
    } catch (e) {
      _snack("Couldn't print — $e");
    }
  }

  Future<void> _addSheet() async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: GwColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(GwRadius.lg)),
      ),
      builder: (_) => const _AddExpenseSheet(),
    );
    if (added == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final m = _month();
    return Scaffold(
      appBar: AppBar(
        title: const Text("Finance"),
        actions: [
          IconButton(
            tooltip: tr(context, "Monthly budget", "လစဉ် ဘတ်ဂျက်"),
            icon: const Icon(Icons.savings_outlined),
            onPressed: _editBudget,
          ),
          IconButton(
            tooltip: tr(context, "Print report", "Report ထုတ်ရန်"),
            icon: const Icon(Icons.print_outlined),
            onPressed: _expenses.isEmpty ? null : _printReport,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _addSheet,
        backgroundColor: GwColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: Text(tr(context, "Add expense", "ကုန်ကျစရိတ် ထည့်ရန်")),
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _expenses.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                children: [
                  // This-month summary card
                  Container(
                    padding: const EdgeInsets.all(18),
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
                            Expanded(
                              child: Text(
                                  tr(context, "Total spend", "စုစုပေါင်း ကုန်ကျစရိတ်"),
                                  style: TextStyle(
                                      color:
                                          Colors.white.withValues(alpha: 0.85),
                                      fontSize: 13)),
                            ),
                            // Month navigation ‹ Jul 2026 ›
                            InkWell(
                              onTap: () => _shiftMonth(-1),
                              child: const Icon(Icons.chevron_left,
                                  color: Colors.white, size: 24),
                            ),
                            Text(_monthLabel,
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 14)),
                            InkWell(
                              onTap: () => _shiftMonth(1),
                              child: const Icon(Icons.chevron_right,
                                  color: Colors.white, size: 24),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(money(m.total, "Ks"),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 30,
                                fontWeight: FontWeight.w900)),
                        if (m.unpaid > 0) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                                "${tr(context, "Unpaid", "မပေးရသေး")} ${money(m.unpaid, "Ks")}",
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13)),
                          ),
                        ],
                        // Budget progress (kept on-device).
                        if (_budget != null && _budget! > 0) ...[
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: (m.total / _budget!).clamp(0.0, 1.0),
                              minHeight: 8,
                              backgroundColor:
                                  Colors.white.withValues(alpha: 0.25),
                              valueColor: AlwaysStoppedAnimation(
                                  m.total > _budget!
                                      ? const Color(0xFFFFC0C0)
                                      : Colors.white),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            m.total > _budget!
                                ? tr(
                                    context,
                                    "⚠️ Over budget by ${money(m.total - _budget!, "Ks")}",
                                    "⚠️ ဘတ်ဂျက်ထက် ${money(m.total - _budget!, "Ks")} ကျော်နေပြီ")
                                : tr(
                                    context,
                                    "Budget ${money(_budget, "Ks")} — ${money(_budget! - m.total, "Ks")} left",
                                    "ဘတ်ဂျက် ${money(_budget, "Ks")} — ${money(_budget! - m.total, "Ks")} ကျန်သည်"),
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Category breakdown — proportional bars.
                  if (m.byCat.isNotEmpty && m.total > 0)
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: GwColors.surface,
                        borderRadius: BorderRadius.circular(GwRadius.lg),
                        boxShadow: GwShadow.card,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              tr(context, "By category",
                                  "အမျိုးအစားအလိုက်"),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14)),
                          const SizedBox(height: 10),
                          for (final entry in (m.byCat.entries.toList()
                            ..sort((a, b) => b.value.compareTo(a.value))))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(_catIcon(entry.key),
                                          size: 15,
                                          color: GwColors.primary),
                                      const SizedBox(width: 6),
                                      Expanded(
                                          child: Text(_catLabel(entry.key),
                                              style: const TextStyle(
                                                  fontSize: 12.5,
                                                  fontWeight:
                                                      FontWeight.w600))),
                                      Text(
                                          "${money(entry.value, "Ks")} · ${(entry.value / m.total * 100).toStringAsFixed(0)}%",
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: GwColors.inkSoft,
                                              fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: (entry.value / m.total)
                                          .clamp(0.0, 1.0),
                                      minHeight: 6,
                                      backgroundColor: GwColors.surfaceMuted,
                                      valueColor:
                                          const AlwaysStoppedAnimation(
                                              GwColors.primary),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 16),
                  Text(tr(context, "Expenses", "ကုန်ကျစရိတ် စာရင်း"),
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  // Filters: category + unpaid-only.
                  SizedBox(
                    height: 40,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            label: Text(
                                tr(context, "Unpaid only", "မပေးရသေးသာ")),
                            selected: _unpaidOnly,
                            selectedColor:
                                GwColors.gold.withValues(alpha: 0.2),
                            onSelected: (v) =>
                                setState(() => _unpaidOnly = v),
                          ),
                        ),
                        for (final c in [
                          ("all", tr(context, "All", "အားလုံး")),
                          for (final cat in _categories)
                            (cat.$1, _catLabel(cat.$1)),
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(c.$2),
                              selected: _filterCat == c.$1,
                              selectedColor:
                                  GwColors.primary.withValues(alpha: 0.15),
                              onSelected: (_) =>
                                  setState(() => _filterCat = c.$1),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_error != null && _expenses.isEmpty)
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error)
                  else if (_expenses.isEmpty)
                    GwEmpty(
                      icon: Icons.account_balance_wallet_outlined,
                      title: tr(context, "Nothing yet", "စာရင်း မရှိသေးပါ"),
                      subtitle: tr(context, "Add your first expense with the + button.", "အောက်က + ခလုတ်နဲ့ စတင်ထည့်ပါ။"),
                    )
                  else
                    ..._expenses
                        .where((e) =>
                            (!_unpaidOnly || !e.isPaid) &&
                            (_filterCat == "all" ||
                                e.category == _filterCat))
                        .map(_row),
                ],
              ),
      ),
    );
  }

  Widget _row(Expense e) {
    final overdue = !e.isPaid &&
        e.dueDate != null &&
        e.dueDate!.isBefore(DateTime.now());
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
          border: overdue
              ? Border.all(color: GwColors.live.withValues(alpha: 0.4))
              : null,
        ),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          onLongPress: () => _delete(e),
          leading: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: (e.isPaid ? GwColors.primary : GwColors.gold)
                  .withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(_catIcon(e.category),
                color: e.isPaid ? GwColors.primary : GwColors.gold, size: 21),
          ),
          title: Text(e.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                decoration: e.isPaid ? TextDecoration.lineThrough : null,
                color: e.isPaid ? GwColors.inkSoft : GwColors.ink,
              )),
          subtitle: Text(
            [
              _catLabel(e.category),
              if (e.recurring) tr(context, "monthly", "လစဉ်"),
              if (e.dueDate != null)
                "due ${e.dueDate!.day}/${e.dueDate!.month}",
              if (overdue) tr(context, "⚠️ overdue", "⚠️ ကျော်နေပြီ"),
            ].join(" · "),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
                fontSize: 12,
                color: overdue ? GwColors.live : GwColors.inkSoft),
          ),
          trailing: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(money(e.amount, "Ks"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 14)),
              InkWell(
                onTap: () => _togglePaid(e),
                child: Text(
                  e.isPaid ? tr(context, "Paid ✓", "ပေးပြီး ✓") : tr(context, "Mark paid", "ပေးပြီးလို့ မှတ်ရန်"),
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color:
                          e.isPaid ? GwColors.inkSoft : GwColors.primary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddExpenseSheet extends StatefulWidget {
  const _AddExpenseSheet();

  @override
  State<_AddExpenseSheet> createState() => _AddExpenseSheetState();
}

class _AddExpenseSheetState extends State<_AddExpenseSheet> {
  final _title = TextEditingController();
  final _amount = TextEditingController();
  String _category = "other";
  DateTime? _due;
  bool _recurring = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    final amount = double.tryParse(_amount.text.trim()) ?? 0;
    if (title.isEmpty || amount <= 0) {
      setState(() => _error = tr(context, "Enter a name and amount.", "အမည်နဲ့ ပမာဏ ထည့်ပါ။"));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().repo.addExpense(
            title: title,
            amount: amount,
            category: _category,
            dueDate: _due,
            recurring: _recurring,
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "New expense", "ကုန်ကျစရိတ် အသစ်"),
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          TextField(
            controller: _title,
            decoration: InputDecoration(
              labelText: tr(context, "Name (e.g. shop rent)", "အမည် (ဥပမာ — ဆိုင်ခန်းခ)"),
              prefixIcon: Icon(Icons.edit_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: InputDecoration(
              labelText: tr(context, "Amount", "ပမာဏ"),
              prefixIcon: Icon(Icons.payments_outlined),
              suffixText: "Ks",
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final c in _categories)
                ChoiceChip(
                  selected: _category == c.$1,
                  onSelected: (_) => setState(() => _category = c.$1),
                  avatar: Icon(c.$3,
                      size: 16,
                      color: _category == c.$1
                          ? GwColors.primary
                          : GwColors.inkSoft),
                  label: Text(c.$2),
                  selectedColor: GwColors.primary.withValues(alpha: 0.15),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _due ?? now,
                      firstDate: DateTime(now.year - 1),
                      lastDate: DateTime(now.year + 2),
                    );
                    if (picked != null) setState(() => _due = picked);
                  },
                  icon: const Icon(Icons.event_outlined, size: 18),
                  label: Text(_due == null
                      ? "Due date (optional)"
                      : "${_due!.day}/${_due!.month}/${_due!.year}"),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: GwColors.ink,
                    side: const BorderSide(color: GwColors.line),
                  ),
                ),
              ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _recurring,
            onChanged: (v) => setState(() => _recurring = v),
            activeColor: GwColors.primary,
            title: Text(tr(context, "Recurring monthly (rent/salary)", "လစဉ် ထပ်ကျတဲ့ စရိတ် (rent/လစာ)"),
                style: const TextStyle(fontSize: 14)),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_error!,
                  style:
                      const TextStyle(color: GwColors.live, fontSize: 13)),
            ),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          valueColor: AlwaysStoppedAnimation(Colors.white)))
                  : Text(tr(context, "Save", "သိမ်းမည်")),
            ),
          ),
        ],
      ),
    );
  }
}
