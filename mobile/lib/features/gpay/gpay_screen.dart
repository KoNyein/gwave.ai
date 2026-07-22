import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import 'gpay_scan_screen.dart';
import 'gpay_send_screen.dart';
import 'gpay_topup_screen.dart';

/// Native G-Pay wallet. Balance + transaction history read natively; the money
/// actions (register / KYC, Send, Top-up, Scan) hand off to the secure web flow
/// where the transaction PIN and slip upload live — the balance is never
/// writable from the client, only through the server RPCs.
class GpayScreen extends StatefulWidget {
  const GpayScreen({super.key});

  @override
  State<GpayScreen> createState() => _GpayScreenState();
}

class _GpayScreenState extends State<GpayScreen> {
  GpayAccount? _account;
  List<GpayTransaction> _txns = [];
  bool _loading = true;
  bool _noAccount = false;
  String? _error;

  /// Human-readable "who am I signed in as" for the register-card hint.
  String? get _identity {
    final s = context.read<AppState>().api.session;
    if (s == null) return null;
    final id = s.profileId;
    final shortId = id.length > 8 ? id.substring(0, 8) : id;
    return s.email != null ? "${s.email} ($shortId…)" : "$shortId…";
  }

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
      final repo = context.read<AppState>().repo;
      final acc = await repo.myGpayAccount();
      List<GpayTransaction> txns = [];
      if (acc != null && acc.isActive) {
        txns = await repo.gpayTransactions(acc.id);
      }
      if (mounted) {
        setState(() {
          _account = acc;
          _txns = txns;
          _noAccount = acc == null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("G-Pay")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _account == null && !_noAccount
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                children: [
                  if (_error != null && _account == null)
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load wallet",
                        subtitle: _error)
                  else if (_noAccount)
                    _registerCard()
                  else if (_account!.status == "pending")
                    _statusCard(
                      Icons.hourglass_top,
                      GwColors.gold,
                      tr(context, "Under review", "စိစစ်နေဆဲ"),
                      tr(context, "An admin is reviewing your G-Pay account.", "သင့် G-Pay အကောင့်ကို admin မှ စစ်ဆေးနေပါသည်။"),
                    )
                  else if (_account!.status == "rejected" ||
                      _account!.status == "suspended")
                    _statusCard(
                      Icons.block,
                      GwColors.live,
                      _account!.status == "rejected"
                          ? tr(context, "Rejected", "ငြင်းပယ်ခံရသည်")
                          : tr(context, "Suspended", "ရပ်ဆိုင်းထားသည်"),
                      tr(context, "See the web wallet for details.", "အသေးစိတ်အတွက် web တွင် ကြည့်ပါ။"),
                    )
                  else ...[
                    _balanceCard(_account!),
                    const SizedBox(height: 16),
                    _actionGrid(),
                    const SizedBox(height: 20),
                    Text(tr(context, "History", "မှတ်တမ်း"),
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    if (_txns.isEmpty)
                      Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: GwEmpty(
                          icon: Icons.receipt_long_outlined,
                          title: tr(context, "No transactions yet", "မှတ်တမ်း မရှိသေးပါ"),
                        ),
                      )
                    else
                      _txnList(),
                  ],
                ],
              ),
      ),
    );
  }

  Widget _balanceCard(GpayAccount acc) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
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
              const Icon(Icons.account_balance_wallet,
                  color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(tr(context, "Balance", "လက်ကျန်ငွေ"),
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 14)),
            ],
          ),
          const SizedBox(height: 10),
          Text(money(acc.balance, "Ks"),
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          if (acc.phone != null)
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.qr_code, color: Colors.white, size: 15),
                      const SizedBox(width: 6),
                      Text(acc.phone!,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: acc.phone!));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(tr(context, "G-Pay ID copied", "G-Pay ID ကူးယူပြီး"))),
                    );
                  },
                  child: const Icon(Icons.copy,
                      color: Colors.white70, size: 17),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Future<void> _openSend({String? phone}) async {
    if (_account == null) return;
    final sent = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
          builder: (_) =>
              GpaySendScreen(account: _account!, initialPhone: phone)),
    );
    if (sent == true) _load(); // refresh balance + history after a transfer
  }

  /// Camera scan (or show my own QR). A scanned `gpay:<number>` opens Send
  /// pre-filled with that recipient.
  Future<void> _openScan() async {
    if (_account == null) return;
    final phone = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => GpayScanScreen(account: _account!)),
    );
    if (phone != null && phone.isNotEmpty) {
      await _openSend(phone: phone);
    }
  }

  Future<void> _openTopup() async {
    if (_account == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => GpayTopupScreen(account: _account!)),
    );
    _load(); // the Stripe webhook may have credited the wallet meanwhile
  }

  Widget _actionGrid() {
    // Send, Scan and Top-up are all native now; History is the transaction
    // list right below (the tile just links the web wallet for the full view).
    final actions = <(IconData, String, VoidCallback)>[
      (Icons.north_east, "Send", () => _openSend()),
      (Icons.qr_code_scanner, "Scan", _openScan),
      (Icons.add_card, "Top-up", _openTopup),
      (Icons.receipt_long, "History", () => _openWeb("/gpay")),
    ];
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 0.82,
      children: [
        for (final a in actions)
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: a.$3,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: GwColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(a.$1, color: GwColors.primary, size: 24),
                ),
                const SizedBox(height: 6),
                Text(a.$2,
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
      ],
    );
  }

  Widget _txnList() {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        children: [
          for (var i = 0; i < _txns.length; i++) ...[
            _txnRow(_txns[i]),
            if (i != _txns.length - 1) const Divider(height: 1, indent: 62),
          ],
        ],
      ),
    );
  }

  Widget _txnRow(GpayTransaction t) {
    final sign = t.outgoing ? "−" : "+";
    final color = t.outgoing ? GwColors.live : GwColors.primary;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(t.outgoing ? Icons.north_east : Icons.south_west,
            color: color, size: 20),
      ),
      title: Text(_kindLabel(t.kind),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      subtitle: Text(
        t.note?.isNotEmpty == true ? t.note! : timeAgo(t.createdAt),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text("$sign${money(t.amount, "Ks")}",
          style: TextStyle(
              color: color, fontWeight: FontWeight.w800, fontSize: 14)),
    );
  }

  String _kindLabel(String kind) {
    switch (kind) {
      case "topup":
        return tr(context, "Top-up", "ငွေဖြည့်");
      case "transfer":
        return tr(context, "Transfer", "လွှဲငွေ");
      case "withdrawal":
        return tr(context, "Withdrawal", "ငွေထုတ်");
      default:
        return kind;
    }
  }

  Widget _statusCard(
      IconData icon, Color color, String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 2),
                Text(subtitle,
                    style: const TextStyle(
                        color: GwColors.inkSoft, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _registerCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: GwColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.account_balance_wallet,
                color: GwColors.primary, size: 30),
          ),
          const SizedBox(height: 14),
          Text(tr(context, "Open your G-Pay wallet", "G-Pay ပိုက်ဆံအိတ် ဖွင့်ပါ"),
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(
            tr(
                context,
                "Fill in your KYC details to send, top up and scan QR. "
                    "For security the form runs on the web.",
                "ငွေလွှဲ၊ ငွေဖြည့်၊ QR scan အတွက် KYC အချက်အလက်ဖြည့်ပြီး "
                    "အကောင့်ဖွင့်ပါ။ လုံခြုံမှုအတွက် web တွင် ဖြည့်ရပါမည်။"),
            textAlign: TextAlign.center,
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _openWeb("/gpay"),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: Text(tr(context, "Register", "အကောင့်ဖွင့်ရန်")),
            ),
          ),
          const SizedBox(height: 14),
          // A wallet is tied to the login identity that registered it. If the
          // user registered on the web but signed into the app another way
          // (e.g. Google vs email), the wallet won't appear — make the active
          // identity visible so the mismatch is self-explanatory.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: GwColors.surfaceMuted,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(
                      context,
                      "Already registered on gwave.cc but no wallet here? "
                          "Your wallet belongs to the login you registered with — "
                          "sign in to the app the same way (same email/Google) as on the website.",
                      "Website မှာ အကောင့်ဖွင့်ပြီးသားဖြစ်ပြီး ဒီမှာ မပေါ်ဘူးလား? "
                          "ပိုက်ဆံအိတ်သည် အကောင့်ဖွင့်စဉ်က ဝင်ရောက်ခဲ့သော login နှင့် ချိတ်ဆက်ထားပါသည် — "
                          "website မှာသုံးသလို တူညီသော login (email/Google) ဖြင့် app ထဲ ပြန်ဝင်ပါ။"),
                  style: const TextStyle(
                      color: GwColors.inkSoft, fontSize: 11.5, height: 1.45),
                ),
                if (_identity != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    tr(context, "Signed in as: $_identity",
                        "လက်ရှိ ဝင်ရောက်ထားသည်: $_identity"),
                    style: const TextStyle(
                        color: GwColors.ink,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
