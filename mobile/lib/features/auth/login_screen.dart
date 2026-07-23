import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import 'google_auth_screen.dart';
import 'phone_auth_screen.dart';

/// One-story auth screen in a single deep-green look: a Sign in / Sign up
/// switch up top, and the sign-up form collects everything the account needs
/// (name, phone/email, password, birth date, gender) in one pass. Phone
/// identifiers hand over to the SMS-code flow; Google stays one tap.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _name = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  bool _obscureConfirm = true;
  bool _register = false;
  DateTime? _dob;
  String? _gender; // male | female | other
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    FocusScope.of(context).unfocus();
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 20, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: "မွေးနေ့ ရွေးပါ",
    );
    if (picked != null) setState(() => _dob = picked);
  }

  String _fmtDob(DateTime d) => "${d.day}/${d.month}/${d.year}";

  /// A bare number (with optional +, spaces, dashes) is treated as a phone.
  static bool _isPhone(String t) =>
      t.isNotEmpty &&
      !t.contains("@") &&
      RegExp(r'^\+?[0-9 \-]{6,16}$').hasMatch(t);

  Future<void> _submit() async {
    final id = _email.text.trim();
    final phoneMode = _isPhone(id);

    if (!_formKey.currentState!.validate()) return;
    if (_register && _dob == null) {
      setState(() => _error = "မွေးနေ့ ရွေးပေးပါ။");
      return;
    }
    if (_register && _gender == null) {
      setState(() => _error = "ကျား/မ ရွေးပေးပါ။");
      return;
    }
    FocusScope.of(context).unfocus();

    // Phone numbers sign in / sign up with an SMS code (no password) — hand
    // over to the OTP screen, carrying the signup details so they're applied
    // right after verification.
    if (phoneMode) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => PhoneAuthScreen(
          initialPhone: id.replaceAll(RegExp(r'[ \-]'), ""),
          fullName: _register ? _name.text : null,
          gender: _register ? _gender : null,
          birthDate: _register ? _dob : null,
        ),
      ));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = context.read<AppState>();
      if (_register) {
        await state.register(
          id,
          _password.text,
          birthDate: _dob,
          fullName: _name.text,
          gender: _gender,
        );
      } else {
        await state.login(id, _password.text);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Open the Cognito Hosted UI straight into the Google flow (in-app).
  Future<void> _google() async {
    if (!AppConfig.googleEnabled) {
      setState(() => _error = "Google sign-in isn't configured on this build.");
      return;
    }
    final code = await GoogleAuthScreen.run(context);
    if (!mounted || code == null || code.isEmpty) return;
    await context.read<AppState>().completeGoogleSignIn(code);
  }

  // ---- Green-glass form styling ---------------------------------------------

  InputDecoration _dec(String label, IconData icon, {Widget? suffix}) {
    OutlineInputBorder border(Color c, [double w = 1.2]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: c, width: w),
        );
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white70, fontSize: 14),
      prefixIcon: Icon(icon, color: Colors.white70, size: 21),
      suffixIcon: suffix,
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.12),
      enabledBorder: border(Colors.white24),
      focusedBorder: border(Colors.white, 1.6),
      errorBorder: border(const Color(0xFFFFCDD2)),
      focusedErrorBorder: border(const Color(0xFFFFCDD2), 1.6),
      errorStyle: const TextStyle(color: Color(0xFFFFE082), fontSize: 12),
      isDense: true,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
    );
  }

  static const _fieldText = TextStyle(color: Colors.white, fontSize: 15.5);

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final googleBusy = appState.googleBusy;
    final googleError = appState.googleError;
    final phoneId = _isPhone(_email.text.trim());

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [GwColors.primaryBright, GwColors.primary, GwColors.primaryDark],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Brand.
                      Center(
                        child: Container(
                          width: 84,
                          height: 84,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.18),
                                blurRadius: 18,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: Image.asset("assets/icon-512.png",
                              fit: BoxFit.contain),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        "Gwave",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -1,
                        ),
                      ),
                      Text(
                        "Learning & smart-life platform",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 13.5),
                      ),
                      const SizedBox(height: 22),

                      // Sign in / Sign up switch — one story, one place.
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            _modeTab("ဝင်မည်", false),
                            _modeTab("အကောင့်ဖွင့်မည်", true),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),

                      if (!AppConfig.isConfigured) ...[
                        _notice(
                            "Backend not configured — build with --dart-define "
                            "SUPABASE_URL and SUPABASE_ANON_KEY."),
                        const SizedBox(height: 12),
                      ],

                      // ---- Sign-up collects everything in one pass ----
                      if (_register) ...[
                        TextFormField(
                          controller: _name,
                          style: _fieldText,
                          cursorColor: Colors.white,
                          textCapitalization: TextCapitalization.words,
                          autofillHints: const [AutofillHints.name],
                          decoration:
                              _dec("နာမည် (Profile name)", Icons.person_outline),
                          validator: (v) =>
                              (_register && (v == null || v.trim().length < 2))
                                  ? "နာမည် ထည့်ပါ"
                                  : null,
                        ),
                        const SizedBox(height: 12),
                      ],

                      TextFormField(
                        controller: _email,
                        style: _fieldText,
                        cursorColor: Colors.white,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [
                          AutofillHints.email,
                          AutofillHints.telephoneNumber,
                        ],
                        decoration: _dec("ဖုန်းနံပါတ် သို့မဟုတ် Email",
                            Icons.person_pin_outlined),
                        validator: (v) {
                          final t = (v ?? "").trim();
                          if (t.contains("@")) return null;
                          if (_isPhone(t)) return null;
                          return "ဖုန်းနံပါတ် သို့မဟုတ် email ထည့်ပါ";
                        },
                        onChanged: (_) => setState(() {}),
                      ),
                      if (phoneId) ...[
                        const SizedBox(height: 8),
                        Text(
                          "📱 ဖုန်းနံပါတ်ဆိုရင် SMS ကုဒ်နဲ့ ဝင်ရမှာမို့ password မလိုပါ။",
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 12),
                        ),
                      ],

                      if (!phoneId) ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _password,
                          style: _fieldText,
                          cursorColor: Colors.white,
                          obscureText: _obscure,
                          autofillHints: const [AutofillHints.password],
                          decoration: _dec(
                            "Password",
                            Icons.lock_outline,
                            suffix: IconButton(
                              icon: Icon(
                                  _obscure
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  color: Colors.white70,
                                  size: 20),
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) => (v == null || v.length < 6)
                              ? "အနည်းဆုံး စာလုံး ၆ လုံး"
                              : null,
                          onFieldSubmitted: (_) => _register ? null : _submit(),
                        ),
                      ],

                      if (_register && !phoneId) ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _confirm,
                          style: _fieldText,
                          cursorColor: Colors.white,
                          obscureText: _obscureConfirm,
                          decoration: _dec(
                            "Password အတည်ပြု",
                            Icons.lock_outline,
                            suffix: IconButton(
                              icon: Icon(
                                  _obscureConfirm
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  color: Colors.white70,
                                  size: 20),
                              onPressed: () => setState(
                                  () => _obscureConfirm = !_obscureConfirm),
                            ),
                          ),
                          validator: (v) =>
                              (v != _password.text) ? "Password မတူပါ" : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                      ],

                      if (_register) ...[
                        const SizedBox(height: 12),
                        InkWell(
                          onTap: _busy ? null : _pickDob,
                          borderRadius: BorderRadius.circular(14),
                          child: InputDecorator(
                            decoration: _dec("မွေးနေ့", Icons.cake_outlined),
                            child: Text(
                              _dob == null ? "မွေးနေ့ ရွေးပါ" : _fmtDob(_dob!),
                              style: TextStyle(
                                  color: _dob == null
                                      ? Colors.white54
                                      : Colors.white,
                                  fontSize: 15.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _genderChip("male", "ကျား", Icons.male),
                            const SizedBox(width: 8),
                            _genderChip("female", "မ", Icons.female),
                            const SizedBox(width: 8),
                            _genderChip("other", "အခြား", Icons.transgender),
                          ],
                        ),
                      ],

                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        _errorBox(_error!),
                      ],

                      const SizedBox(height: 18),
                      SizedBox(
                        height: 52,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: GwColors.primaryDark,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(15)),
                          ),
                          onPressed: _busy ? null : _submit,
                          child: _busy
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                      color: GwColors.primary),
                                )
                              : Text(
                                  _register
                                      ? "အကောင့်ဖွင့်မည်"
                                      : "ဝင်မည်",
                                  style: const TextStyle(
                                      fontSize: 16.5,
                                      fontWeight: FontWeight.w800),
                                ),
                        ),
                      ),

                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(child: Divider(color: Colors.white24)),
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 10),
                            child: Text("သို့မဟုတ်",
                                style: TextStyle(
                                    color: Colors.white70, fontSize: 12.5)),
                          ),
                          Expanded(child: Divider(color: Colors.white24)),
                        ],
                      ),
                      const SizedBox(height: 14),

                      if (AppConfig.googleEnabled) ...[
                        SizedBox(
                          height: 50,
                          child: OutlinedButton.icon(
                            onPressed: (googleBusy || _busy) ? null : _google,
                            icon: googleBusy
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                        color: Colors.white),
                                  )
                                : const Icon(Icons.g_mobiledata,
                                    size: 30, color: Colors.white),
                            label: const Text("Google နဲ့ ဆက်လုပ်မည်",
                                style: TextStyle(
                                    fontSize: 15, color: Colors.white)),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.white38),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(15)),
                            ),
                          ),
                        ),
                        if (googleError != null) ...[
                          const SizedBox(height: 12),
                          _errorBox(googleError),
                        ],
                        const SizedBox(height: 10),
                      ],

                      if (!_register)
                        _notice(
                            "အရင်သုံးခဲ့တဲ့ နည်းလမ်း (email / ဖုန်း / Google) "
                            "အတိုင်းပဲ ပြန်ဝင်ပါ — မတူရင် အကောင့်အသစ် ဖြစ်သွားနိုင်ပါတယ်။"),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _modeTab(String label, bool register) {
    final selected = _register == register;
    return Expanded(
      child: InkWell(
        onTap: _busy
            ? null
            : () => setState(() {
                  _register = register;
                  _error = null;
                }),
        borderRadius: BorderRadius.circular(13),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: selected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(13),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: selected ? GwColors.primaryDark : Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 14.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _genderChip(String value, String label, IconData icon) {
    final selected = _gender == value;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: _busy ? null : () => setState(() => _gender = value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            color: selected
                ? Colors.white
                : Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? Colors.white : Colors.white24,
              width: 1.2,
            ),
          ),
          child: Column(
            children: [
              Icon(icon,
                  size: 21,
                  color: selected ? GwColors.primaryDark : Colors.white70),
              const SizedBox(height: 3),
              Text(label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? GwColors.primaryDark : Colors.white,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _errorBox(String msg) => Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: const Color(0xFFB71C1C).withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFFCDD2), width: 0.8),
        ),
        child: Row(
          children: [
            const Icon(Icons.error_outline,
                color: Color(0xFFFFCDD2), size: 19),
            const SizedBox(width: 8),
            Expanded(
              child: Text(msg,
                  style:
                      const TextStyle(color: Colors.white, fontSize: 13)),
            ),
          ],
        ),
      );

  Widget _notice(String msg) => Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, size: 16, color: Colors.white70),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                msg,
                style: TextStyle(
                    fontSize: 11.5,
                    height: 1.4,
                    color: Colors.white.withValues(alpha: 0.85)),
              ),
            ),
          ],
        ),
      );
}
