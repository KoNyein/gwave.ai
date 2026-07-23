import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Native G-Pay top-up (cash-in). Collects the MMK amount here, then asks the
/// server (`/api/mobile/gpay/topup`) for a Stripe Checkout URL and opens it in
/// the browser — card entry always stays on Stripe's page, and the existing
/// webhook credits the wallet when the payment succeeds.
class GpayTopupScreen extends StatefulWidget {
  const GpayTopupScreen({super.key, required this.account});
  final GpayAccount account;

  @override
  State<GpayTopupScreen> createState() => _GpayTopupScreenState();
}

class _GpayTopupScreenState extends State<GpayTopupScreen> {
  final _amount = TextEditingController(text: "10000");
  bool _busy = false;
  bool _launched = false;
  String? _error;

  static const _quick = [5000, 10000, 50000, 100000, 500000];

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  int get _value => int.tryParse(_amount.text.replaceAll(",", "").trim()) ?? 0;

  Future<void> _start() async {
    final amount = _value;
    if (amount < 1000 || amount > 10000000) {
      setState(() => _error = tr(context, "Enter between 1,000 and 10,000,000 Ks.", "၁,၀၀၀ Ks မှ ၁၀,၀၀၀,၀၀၀ Ks အတွင်း ထည့်ပါ။"));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final url = await context.read<AppState>().api.gpayTopup(amount);
      if (mounted) {
        setState(() => _launched = true);
        await openWeb(context, url, title: "Top-up");
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Top-up", "ငွေဖြည့်မည်"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
        children: [
          // Current balance
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
            controller: _amount,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: tr(context, "Amount to add", "ဖြည့်မည့် ပမာဏ"),
              prefixIcon: Icon(Icons.add_card),
              suffixText: "Ks",
              helperText: tr(context, "Minimum 1,000 Ks", "အနည်းဆုံး 1,000 Ks"),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final q in _quick)
                ChoiceChip(
                  selected: _value == q,
                  onSelected: (_) =>
                      setState(() => _amount.text = q.toString()),
                  label: Text(money(q.toDouble(), "Ks")),
                  selectedColor: GwColors.primary.withValues(alpha: 0.15),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // How it works
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: GwColors.surfaceMuted,
              borderRadius: BorderRadius.circular(GwRadius.sm),
              border: Border.all(color: GwColors.line),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline,
                    color: GwColors.primary, size: 19),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tr(
                        context,
                        "Tapping the button opens a secure Stripe payment page "
                            "(card/bank). Once paid, your balance is credited "
                            "automatically.",
                        "ခလုတ်နှိပ်ရင် လုံခြုံတဲ့ Stripe ငွေပေးချေစာမျက်နှာ "
                            "ပွင့်လာပါမယ် (ကတ်/bank)။ ငွေပေးချေပြီးတာနဲ့ "
                            "လက်ကျန်ထဲ အလိုအလျောက် ဝင်ပါမယ်။"),
                    style: const TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoft),
                  ),
                ),
              ],
            ),
          ),

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

          if (_launched) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(GwRadius.sm),
                border:
                    Border.all(color: GwColors.primary.withValues(alpha: 0.3)),
              ),
              child: Text(
                tr(
                    context,
                    "After paying, come back and pull to refresh the wallet — "
                        "your new balance will appear.",
                    "ငွေပေးချေမှု ပြီးသွားရင် ဒီစာမျက်နှာကို ပိတ်ပြီး wallet "
                        "ကို ဆွဲချ (refresh) လုပ်ပါ — လက်ကျန် အသစ် "
                        "ပေါ်လာပါမယ်။"),
                style: const TextStyle(fontSize: 13),
              ),
            ),
          ],

          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _busy ? null : _start,
              icon: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          valueColor: AlwaysStoppedAnimation(Colors.white)))
                  : const Icon(Icons.lock_outline, size: 20),
              label: Text(_busy
                  ? tr(context, "Preparing…", "ပြင်ဆင်နေသည်…")
                  : "${tr(context, "Top up", "ဖြည့်မည်")} ${money(_value > 0 ? _value.toDouble() : 0, "Ks")}"),
            ),
          ),
        ],
      ),
    );
  }
}
