import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// Native G-Pay KYC form — opens the wallet without leaving the app. Mirrors
/// the web registration: name, NRC, phone, email, one messenger contact
/// (Telegram or Viber) and address. A new account starts `pending` until an
/// admin approves it. Pops `true` after a successful submit.
class GpayRegisterScreen extends StatefulWidget {
  const GpayRegisterScreen({super.key});

  @override
  State<GpayRegisterScreen> createState() => _GpayRegisterScreenState();
}

class _GpayRegisterScreenState extends State<GpayRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _nrc = TextEditingController();
  final _phone = TextEditingController();
  late final _email = TextEditingController(
      text: context.read<AppState>().api.session?.email ?? "");
  final _telegram = TextEditingController();
  final _viber = TextEditingController();
  final _address = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _fullName.dispose();
    _nrc.dispose();
    _phone.dispose();
    _email.dispose();
    _telegram.dispose();
    _viber.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_telegram.text.trim().isEmpty && _viber.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Add a Telegram or Viber contact.",
            "Telegram သို့မဟုတ် Viber တစ်ခုခု ထည့်ပါ။")),
      ));
      return;
    }
    setState(() => _busy = true);
    try {
      await context.read<AppState>().api.gpayRegister(
            fullName: _fullName.text.trim(),
            nrcNumber: _nrc.text.trim(),
            phone: _phone.text.trim(),
            email: _email.text.trim(),
            telegram: _telegram.text.trim(),
            viber: _viber.text.trim(),
            address: _address.text.trim(),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(
            context,
            "Registered! Your wallet is pending approval.",
            "အကောင့်ဖွင့်ပြီးပါပြီ! အတည်ပြုချက် စောင့်နေပါသည်။")),
      ));
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Couldn't register. Try again.",
              "အကောင့်ဖွင့်လို့မရပါ။ ပြန်ကြိုးစားပါ။")),
        ));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _required(String? v, String message) =>
      (v == null || v.trim().isEmpty) ? message : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Open G-Pay wallet", "G-Pay အကောင့်ဖွင့်ရန်")),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(GwRadius.md),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified_user_outlined,
                      color: GwColors.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      tr(
                          context,
                          "Fill in your KYC details once — an admin reviews and activates your wallet.",
                          "KYC အချက်အလက် တစ်ကြိမ်ဖြည့်ရုံပါ — admin စစ်ဆေးပြီး wallet ကို အတည်ပြုပေးပါမည်။"),
                      style: const TextStyle(
                          fontSize: 12.5, color: GwColors.inkSoft, height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _fullName,
              textCapitalization: TextCapitalization.words,
              validator: (v) => _required(
                  v, tr(context, "Enter your full name.", "နာမည်အပြည့်အစုံ ထည့်ပါ။")),
              decoration: InputDecoration(
                labelText: tr(context, "Full name", "နာမည်အပြည့်အစုံ"),
                prefixIcon: const Icon(Icons.badge_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _nrc,
              validator: (v) => _required(
                  v, tr(context, "Enter your NRC number.", "မှတ်ပုံတင်နံပါတ် ထည့်ပါ။")),
              decoration: InputDecoration(
                labelText: tr(context, "NRC number", "မှတ်ပုံတင်နံပါတ်"),
                prefixIcon: const Icon(Icons.credit_card_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              validator: (v) => _required(
                  v,
                  tr(context, "Enter your KPay/mobile-money phone.",
                      "KPay/ငွေလွှဲဖုန်းနံပါတ် ထည့်ပါ။")),
              decoration: InputDecoration(
                labelText: tr(context, "Phone (KPay / mobile money)",
                    "ဖုန်း (KPay / ငွေလွှဲနံပါတ်)"),
                prefixIcon: const Icon(Icons.phone_outlined),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              validator: (v) =>
                  _required(v, tr(context, "Enter your email.", "Email ထည့်ပါ။")),
              decoration: InputDecoration(
                labelText: "Email",
                prefixIcon: const Icon(Icons.alternate_email),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _telegram,
                    decoration: const InputDecoration(
                      labelText: "Telegram",
                      prefixIcon: Icon(Icons.send_outlined),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: _viber,
                    decoration: const InputDecoration(
                      labelText: "Viber",
                      prefixIcon: Icon(Icons.chat_outlined),
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 4),
              child: Text(
                tr(context, "At least one messenger contact is required.",
                    "Messenger contact အနည်းဆုံး တစ်ခု လိုအပ်ပါသည်။"),
                style: const TextStyle(fontSize: 11.5, color: GwColors.inkSoft),
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _address,
              maxLines: 2,
              validator: (v) => _required(
                  v, tr(context, "Enter your address.", "နေရပ်လိပ်စာ ထည့်ပါ။")),
              decoration: InputDecoration(
                labelText: tr(context, "Address", "နေရပ်လိပ်စာ"),
                prefixIcon: const Icon(Icons.home_outlined),
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 52,
              child: FilledButton.icon(
                onPressed: _busy ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: GwColors.primary,
                ),
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.account_balance_wallet_outlined),
                label: Text(
                  tr(context, "Open my wallet", "ကျွန်ုပ်၏ wallet ဖွင့်မယ်"),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
