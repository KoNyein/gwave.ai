import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import 'phone_auth_screen.dart';

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
      helpText: "Select your date of birth",
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
      setState(() => _error = "Please select your date of birth.");
      return;
    }
    if (_register && _gender == null) {
      setState(() => _error = "Please choose your gender.");
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

  /// Open the Cognito Hosted UI straight into the Google flow. The redirect is
  /// the web's registered /auth/callback with `state=mobile` — the server
  /// bounces the code back into the app as `gwave://auth?code=...`, which
  /// AppState catches to finish sign-in (no Cognito console change needed).
  Future<void> _google() async {
    final url = Uri.parse("${AppConfig.cognitoDomain}/oauth2/authorize").replace(
      queryParameters: {
        "identity_provider": "Google",
        "response_type": "code",
        "client_id": AppConfig.cognitoClientId,
        "scope": "openid email",
        "redirect_uri": AppConfig.googleRedirectUri,
        "state": "mobile",
      },
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final googleBusy = appState.googleBusy;
    final googleError = appState.googleError;
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(gradient: GwColors.primaryGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 20),
                    Center(
                      child: Container(
                        width: 96,
                        height: 96,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(26),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.12),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Image.asset(
                          "assets/icon-512.png",
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      "Gwave",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 34,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "The super-app for farmers",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.9),
                          fontSize: 14),
                    ),
                    const SizedBox(height: 30),
                    Container(
                      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                      decoration: BoxDecoration(
                        // Was a hardcoded white slab; follows the theme so it
                        // does not stay white on the dark login page.
                        color: GwColors.surface,
                        borderRadius: BorderRadius.circular(GwRadius.lg),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.10),
                            blurRadius: 24,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              _register ? "Create your account" : "Welcome back",
                              style: const TextStyle(
                                  fontSize: 23,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.4),
                            ),
                            const SizedBox(height: 20),
                            if (!AppConfig.isConfigured) ...[
                              _configBanner(),
                              const SizedBox(height: 12),
                            ],
                            if (_register) ...[
                              TextFormField(
                                controller: _name,
                                textCapitalization: TextCapitalization.words,
                                autofillHints: const [AutofillHints.name],
                                decoration: const InputDecoration(
                                  labelText: "Profile name",
                                  prefixIcon: Icon(Icons.person_outline),
                                ),
                                validator: (v) =>
                                    (_register && (v == null || v.trim().length < 2))
                                        ? "Enter your name"
                                        : null,
                              ),
                              const SizedBox(height: 12),
                            ],
                            TextFormField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [
                                AutofillHints.email,
                                AutofillHints.telephoneNumber,
                              ],
                              decoration: const InputDecoration(
                                labelText: "Phone or Email",
                                hintText: "09xxxxxxxxx or you@example.com",
                                prefixIcon: Icon(Icons.person_pin_outlined),
                              ),
                              validator: (v) {
                                final t = (v ?? "").trim();
                                if (t.contains("@")) return null; // email
                                if (_isPhone(t)) return null; // phone number
                                return "Enter your phone number or email";
                              },
                              // Rebuild so the password fields hide/show as the
                              // identifier switches between phone and email.
                              onChanged: (_) => setState(() {}),
                            ),
                            if (_isPhone(_email.text.trim()) && _register) ...[
                              const SizedBox(height: 6),
                              Text(
                                "📱 Phone signup uses an SMS code — no password needed.",
                                style: TextStyle(
                                    color: GwColors.inkSoft, fontSize: 12),
                              ),
                            ],
                            const SizedBox(height: 12),
                            if (!_isPhone(_email.text.trim()))
                            TextFormField(
                              controller: _password,
                              obscureText: _obscure,
                              autofillHints: const [AutofillHints.password],
                              decoration: InputDecoration(
                                labelText: "Password",
                                prefixIcon: const Icon(Icons.lock_outline),
                                suffixIcon: IconButton(
                                  icon: Icon(_obscure
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => (v == null || v.length < 6)
                                  ? "At least 6 characters"
                                  : null,
                              onFieldSubmitted: (_) => _register ? null : _submit(),
                            ),
                            if (_register) ...[
                              if (!_isPhone(_email.text.trim())) ...[
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _confirm,
                                obscureText: _obscureConfirm,
                                decoration: InputDecoration(
                                  labelText: "Confirm password",
                                  prefixIcon: const Icon(Icons.lock_outline),
                                  suffixIcon: IconButton(
                                    icon: Icon(_obscureConfirm
                                        ? Icons.visibility_off_outlined
                                        : Icons.visibility_outlined),
                                    onPressed: () => setState(
                                        () => _obscureConfirm = !_obscureConfirm),
                                  ),
                                ),
                                validator: (v) => (v != _password.text)
                                    ? "Passwords don't match"
                                    : null,
                                onFieldSubmitted: (_) => _submit(),
                              ),
                              ],
                              const SizedBox(height: 12),
                              InkWell(
                                onTap: _busy ? null : _pickDob,
                                borderRadius:
                                    BorderRadius.circular(GwRadius.sm),
                                child: InputDecorator(
                                  decoration: const InputDecoration(
                                    labelText: "Date of birth",
                                    prefixIcon: Icon(Icons.cake_outlined),
                                  ),
                                  child: Text(
                                    _dob == null
                                        ? "Select your date of birth"
                                        : _fmtDob(_dob!),
                                    style: TextStyle(
                                      color: _dob == null
                                          ? GwColors.inkSoft
                                          : GwColors.ink,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text("Gender",
                                    style: TextStyle(
                                        color: GwColors.inkSoft, fontSize: 13)),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  _genderChip("male", "ကျား", Icons.male),
                                  const SizedBox(width: 8),
                                  _genderChip("female", "မ", Icons.female),
                                  const SizedBox(width: 8),
                                  _genderChip(
                                      "other", "အခြား", Icons.transgender),
                                ],
                              ),
                            ],
                            if (_error != null) ...[
                              const SizedBox(height: 12),
                              _errorBox(_error!),
                            ],
                            const SizedBox(height: 18),
                            SizedBox(
                              height: 50,
                              child: ElevatedButton(
                                onPressed: _busy ? null : _submit,
                                child: _busy
                                    ? const SizedBox(
                                        width: 22,
                                        height: 22,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2.4,
                                          valueColor: AlwaysStoppedAnimation(
                                              Colors.white),
                                        ),
                                      )
                                    : Text(
                                        _register ? "Sign up" : "Sign in",
                                        style: const TextStyle(fontSize: 16),
                                      ),
                              ),
                            ),
                            if (AppConfig.googleEnabled) ...[
                              const SizedBox(height: 14),
                              Row(
                                children: [
                                  Expanded(child: Divider(color: GwColors.line)),
                                  Padding(
                                    padding:
                                        EdgeInsets.symmetric(horizontal: 10),
                                    child: Text("or",
                                        style: TextStyle(
                                            color: GwColors.inkSoft,
                                            fontSize: 13)),
                                  ),
                                  Expanded(child: Divider(color: GwColors.line)),
                                ],
                              ),
                              const SizedBox(height: 14),
                              SizedBox(
                                height: 50,
                                child: OutlinedButton.icon(
                                  onPressed:
                                      (googleBusy || _busy) ? null : _google,
                                  icon: googleBusy
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2.2),
                                        )
                                      : const Icon(Icons.g_mobiledata,
                                          size: 30, color: Color(0xFF4285F4)),
                                  label: const Text("Continue with Google",
                                      style: TextStyle(fontSize: 15)),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: GwColors.ink,
                                    side:
                                        BorderSide(color: GwColors.line),
                                  ),
                                ),
                              ),
                              if (googleError != null) ...[
                                const SizedBox(height: 12),
                                _errorBox(googleError),
                              ],
                            ],
                            const SizedBox(height: 12),
                            SizedBox(
                              height: 50,
                              child: OutlinedButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () => Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (_) =>
                                                const PhoneAuthScreen(),
                                          ),
                                        ),
                                icon: const Icon(Icons.smartphone, size: 20),
                                label: const Text("Continue with phone",
                                    style: TextStyle(fontSize: 15)),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: GwColors.ink,
                                  side: BorderSide(color: GwColors.line),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  _register
                                      ? "Already have an account?"
                                      : "New to Gwave?",
                                  style: TextStyle(
                                      color: GwColors.inkSoft, fontSize: 13),
                                ),
                                TextButton(
                                  onPressed: _busy
                                      ? null
                                      : () => setState(() {
                                            _register = !_register;
                                            _error = null;
                                          }),
                                  child: Text(_register ? "Sign in" : "Sign up"),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
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
        borderRadius: BorderRadius.circular(GwRadius.sm),
        onTap: _busy ? null : () => setState(() => _gender = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: selected
                ? GwColors.primary.withValues(alpha: 0.12)
                : GwColors.surfaceMuted,
            borderRadius: BorderRadius.circular(GwRadius.md),
            border: Border.all(
              color: selected ? GwColors.primary : GwColors.line,
              width: selected ? 1.8 : 1.4,
            ),
          ),
          child: Column(
            children: [
              Icon(icon,
                  size: 22,
                  color: selected ? GwColors.primary : GwColors.inkSoft),
              const SizedBox(height: 3),
              Text(label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected ? GwColors.primary : GwColors.ink,
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
          color: GwColors.live.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(GwRadius.sm),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: GwColors.live, size: 19),
            const SizedBox(width: 8),
            Expanded(
              child: Text(msg,
                  style: TextStyle(color: GwColors.live, fontSize: 13)),
            ),
          ],
        ),
      );

  Widget _configBanner() => Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: GwColors.gold.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(GwRadius.sm),
        ),
        child: Text(
          "Backend not configured — build with --dart-define SUPABASE_URL and "
          "SUPABASE_ANON_KEY.",
          style: TextStyle(fontSize: 12, color: GwColors.primaryDark),
        ),
      );
}
