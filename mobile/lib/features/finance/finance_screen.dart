import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

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
      final e = await context.read<AppState>().repo.expenses();
      if (mounted) setState(() => _expenses = e);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// This-month totals, matching the web's summariseMonth: a recurring cost
  /// counts every month from its start; a one-off only in its own month.
  ({double total, double unpaid, Map<String, double> byCat}) _month() {
    final now = DateTime.now();
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
      appBar: AppBar(title: const Text("Finance")),
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
                        Text(tr(context, "Total spend this month", "ဒီလ စုစုပေါင်း ကုန်ကျစရိတ်"),
                            style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 13)),
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
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Category breakdown chips
                  if (m.byCat.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final entry in m.byCat.entries)
                          Chip(
                            avatar: Icon(_catIcon(entry.key),
                                size: 16, color: GwColors.primary),
                            label: Text(
                                "${_catLabel(entry.key)} · ${money(entry.value, "Ks")}"),
                            labelStyle: const TextStyle(fontSize: 12),
                            backgroundColor: GwColors.surface,
                            side: const BorderSide(color: GwColors.line),
                          ),
                      ],
                    ),
                  const SizedBox(height: 16),
                  Text(tr(context, "Expenses", "ကုန်ကျစရိတ် စာရင်း"),
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w900)),
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
                    ..._expenses.map(_row),
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
