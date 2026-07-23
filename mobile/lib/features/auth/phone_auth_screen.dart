import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';

/// Two-step phone sign-in: enter a number → Cognito texts a code → enter it.
/// A number that already exists signs in on the first step. The signup form
/// can hand over the number plus profile details (name / birthday / gender),
/// which are applied right after the OTP succeeds.
class PhoneAuthScreen extends StatefulWidget {
  const PhoneAuthScreen({
    super.key,
    this.initialPhone,
    this.fullName,
    this.gender,
    this.birthDate,
  });

  final String? initialPhone;
  final String? fullName;
  final String? gender;
  final DateTime? birthDate;

  @override
  State<PhoneAuthScreen> createState() => _PhoneAuthScreenState();
}

class _PhoneAuthScreenState extends State<PhoneAuthScreen> {
  late final _phone = TextEditingController(text: widget.initialPhone ?? "");
  final _code = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  String? _error;

  /// Apply the signup form's profile details after a successful sign-in.
  Future<void> _applyBasics() async {
    if (widget.fullName == null &&
        widget.gender == null &&
        widget.birthDate == null) {
      return;
    }
    await context.read<AppState>().applyProfileBasics(
          fullName: widget.fullName,
          gender: widget.gender,
          birthDate: widget.birthDate,
        );
  }

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = _phone.text.trim();
    if (phone.length < 6) {
      setState(() => _error = "Enter your phone number.");
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final signedIn = await context.read<AppState>().startPhone(phone);
      if (!mounted) return;
      if (signedIn) {
        await _applyBasics();
        if (mounted) Navigator.of(context).pop(); // already signed in
      } else {
        setState(() => _codeSent = true);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final code = _code.text.trim();
    if (code.length < 4) {
      setState(() => _error = "Enter the code we texted you.");
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await context.read<AppState>().verifyPhone(_phone.text.trim(), code);
      if (!mounted) return;
      await _applyBasics();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_codeSent ? "Enter code" : "Phone sign-in")),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Icon(_codeSent ? Icons.sms_outlined : Icons.smartphone,
                  size: 48, color: GwColors.primary),
              const SizedBox(height: 16),
              Text(
                _codeSent
                    ? "We texted a code to ${_phone.text.trim()}"
                    : "We'll text you a one-time code",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 15, color: GwColors.inkSoft),
              ),
              const SizedBox(height: 22),
              if (!_codeSent)
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: "Phone number",
                    hintText: "09xxxxxxxxx",
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  onSubmitted: (_) => _sendCode(),
                )
              else
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  autofocus: true,
                  maxLength: 6,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: const InputDecoration(
                    labelText: "6-digit code",
                    prefixIcon: Icon(Icons.password_outlined),
                    counterText: "",
                  ),
                  onSubmitted: (_) => _verify(),
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(11),
                  decoration: BoxDecoration(
                    color: GwColors.live.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(GwRadius.sm),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline,
                          color: GwColors.live, size: 19),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_error!,
                            style: TextStyle(
                                color: GwColors.live, fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                height: 50,
                child: ElevatedButton(
                  onPressed: _busy ? null : (_codeSent ? _verify : _sendCode),
                  child: _busy
                      ? SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.4,
                              valueColor:
                                  AlwaysStoppedAnimation(GwColors.onPrimary)),
                        )
                      : Text(_codeSent ? "Verify" : "Send code",
                          style: const TextStyle(fontSize: 16)),
                ),
              ),
              if (_codeSent) ...[
                const SizedBox(height: 6),
                TextButton(
                  onPressed: _busy
                      ? null
                      : () => setState(() {
                            _codeSent = false;
                            _code.clear();
                            _error = null;
                          }),
                  child: const Text("Change number"),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
