import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Native "Send money" — the G-Pay transfer flow. Recipient number + amount +
/// note, gated by the transaction PIN when the sender has one. Everything goes
/// through the `gpay_transfer` server RPC, which does the real validation and
/// moves the money atomically; the client only collects input and shows the
/// result. Pops `true` on a successful transfer so the wallet refreshes.
class GpaySendScreen extends StatefulWidget {
  const GpaySendScreen({super.key, required this.account, this.initialPhone});
  final GpayAccount account;

  /// Pre-fills the recipient (e.g. from a scanned `gpay:` QR).
  final String? initialPhone;

  @override
  State<GpaySendScreen> createState() => _GpaySendScreenState();
}

class _GpaySendScreenState extends State<GpaySendScreen> {
  late final _to = TextEditingController(text: widget.initialPhone ?? "");
  final _amount = TextEditingController();
  final _note = TextEditingController();
  final _pin = TextEditingController();

  bool _hasPin = false;
  bool _loadingPin = true;
  bool _obscurePin = true;
  bool _busy = false;
  String? _error;

  // Stable per-attempt idempotency key: a genuine success can't be double-spent
  // by a retry, but a failed attempt (wrong PIN) can be retried safely.
  late final String _clientRef;

  @override
  void initState() {
    super.initState();
    final rand = Random().nextInt(0x7fffffff).toRadixString(16);
    _clientRef =
        "${widget.account.id}-${DateTime.now().millisecondsSinceEpoch}-$rand";
    _loadPin();
  }

  Future<void> _loadPin() async {
    try {
      final has = await context.read<AppState>().repo.gpayHasPin();
      if (mounted) setState(() => _hasPin = has);
    } catch (_) {
      // Treat as no PIN; the RPC still enforces the real rule.
    } finally {
      if (mounted) setState(() => _loadingPin = false);
    }
  }

  @override
  void dispose() {
    _to.dispose();
    _amount.dispose();
    _note.dispose();
    _pin.dispose();
    super.dispose();
  }

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;

  Future<void> _send() async {
    final to = _to.text.trim();
    final amount = _amountValue;
    if (to.isEmpty) {
      setState(() => _error = tr(context, "Enter the recipient's G-Pay number.", "လက်ခံမည့်သူ၏ G-Pay နံပါတ် ထည့်ပါ။"));
      return;
    }
    if (amount < 1) {
      setState(() => _error = tr(context, "Enter a valid amount.", "မှန်ကန်သော ပမာဏ ထည့်ပါ။"));
      return;
    }
    if (amount > widget.account.balance) {
      setState(() => _error = tr(context, "Insufficient balance.", "လက်ကျန်ငွေ မလုံလောက်ပါ။"));
      return;
    }
    if (_hasPin && _pin.text.trim().length < 4) {
      setState(() => _error = tr(context, "Enter your PIN (4–6 digits).", "PIN (၄–၆ လုံး) ထည့်ပါ။"));
      return;
    }

    final ok = await _confirm(to, amount);
    if (ok != true) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().repo.gpayTransfer(
            toPhone: to,
            amount: amount,
            note: _note.text,
            pin: _hasPin ? _pin.text.trim() : null,
            clientRef: _clientRef,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("${money(amount, "Ks")} ${tr(context, "sent to", "ကို ပို့ပြီးပါပြီ →")} $to ✓"),
            backgroundColor: GwColors.primary,
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<bool?> _confirm(String to, double amount) {
    return showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(tr(context, "Confirm transfer", "ငွေလွှဲရန် အတည်ပြုပါ")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _confirmRow(tr(context, "Amount", "ပမာဏ"), money(amount, "Ks"), bold: true),
            const SizedBox(height: 6),
            _confirmRow(tr(context, "To", "ဆီသို့"), to),
            if (_note.text.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              _confirmRow(tr(context, "Note", "မှတ်ချက်"), _note.text.trim()),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(tr(context, "Cancel", "မလုပ်တော့ပါ")),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(tr(context, "Send", "ပို့မည်")),
          ),
        ],
      ),
    );
  }

  Widget _confirmRow(String k, String v, {bool bold = false}) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(k, style: const TextStyle(color: GwColors.inkSoft)),
          const SizedBox(width: 16),
          Flexible(
            child: Text(v,
                textAlign: TextAlign.right,
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                    fontSize: bold ? 16 : 14)),
          ),
        ],
      );

  Future<void> _setPin() async {
    final controller = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(context, "Set a transaction PIN", "Transaction PIN သတ်မှတ်ပါ")),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 6,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            labelText: tr(context, "PIN (4–6 digits)", "PIN (၄–၆ လုံး)"),
            prefixIcon: Icon(Icons.lock_outline),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(context, "Cancel", "မလုပ်တော့ပါ"))),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(tr(context, "Save", "သိမ်းမည်")),
          ),
        ],
      ),
    );
    if (saved == true && controller.text.trim().length >= 4) {
      try {
        await context.read<AppState>().repo.gpaySetPin(controller.text.trim());
        if (mounted) {
          setState(() => _hasPin = true);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(tr(context, "PIN set ✓", "PIN သတ်မှတ်ပြီးပါပြီ ✓"))),
          );
        }
      } catch (e) {
        if (mounted) setState(() => _error = e.toString());
      }
    }
    controller.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Send money", "ငွေလွှဲမည်"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
        children: [
          // Available balance
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: GwColors.primaryGradient,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Row(
              children: [
                const Icon(Icons.account_balance_wallet,
                    color: Colors.white, size: 22),
                const SizedBox(width: 10),
                Text(tr(context, "Balance ", "လက်ကျန် "),
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontSize: 14)),
                const Spacer(),
                Text(money(widget.account.balance, "Ks"),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900)),
              ],
            ),
          ),
          const SizedBox(height: 18),

          TextField(
            controller: _to,
            keyboardType: TextInputType.phone,
            decoration: InputDecoration(
              labelText: tr(context, "Recipient G-Pay number", "လက်ခံမည့်သူ၏ G-Pay နံပါတ်"),
              prefixIcon: Icon(Icons.person_outline),
              hintText: "09xxxxxxxxx",
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r"[0-9.]")),
            ],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: tr(context, "Amount", "ပမာဏ"),
              prefixIcon: Icon(Icons.payments_outlined),
              suffixText: "Ks",
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLength: 200,
            decoration: InputDecoration(
              labelText: tr(context, "Note (optional)", "မှတ်ချက် (optional)"),
              prefixIcon: Icon(Icons.notes_outlined),
            ),
          ),

          // PIN — required when the sender has one.
          if (_loadingPin)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Center(
                  child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.2))),
            )
          else if (_hasPin) ...[
            const SizedBox(height: 4),
            TextField(
              controller: _pin,
              obscureText: _obscurePin,
              keyboardType: TextInputType.number,
              maxLength: 6,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: InputDecoration(
                labelText: "Transaction PIN",
                prefixIcon: const Icon(Icons.lock_outline),
                suffixIcon: IconButton(
                  icon: Icon(_obscurePin
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined),
                  onPressed: () => setState(() => _obscurePin = !_obscurePin),
                ),
              ),
            ),
          ] else ...[
            const SizedBox(height: 4),
            InkWell(
              onTap: _setPin,
              borderRadius: BorderRadius.circular(GwRadius.sm),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GwColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(GwRadius.sm),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.shield_outlined,
                        color: GwColors.gold, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        tr(context,
                            "Set a transaction PIN for security (recommended)",
                            "လုံခြုံမှုအတွက် transaction PIN သတ်မှတ်ပါ (အကြံပြု)"),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    Text(tr(context, "Set", "သတ်မှတ်ရန်"),
                        style: const TextStyle(
                            color: GwColors.primary,
                            fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ),
          ],

          if (_error != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: GwColors.live.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(GwRadius.sm),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: GwColors.live, size: 19),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(_error!,
                        style: const TextStyle(
                            color: GwColors.live, fontSize: 13)),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _busy ? null : _send,
              icon: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          valueColor: AlwaysStoppedAnimation(Colors.white)))
                  : const Icon(Icons.send, size: 20),
              label: Text(_busy
                  ? tr(context, "Sending…", "ပို့နေသည်…")
                  : "${tr(context, "Send", "ပို့မည်")} ${money(_amountValue > 0 ? _amountValue : 0, "Ks")}"),
            ),
          ),
        ],
      ),
    );
  }
}
