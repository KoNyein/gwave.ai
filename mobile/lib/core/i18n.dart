import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App language. **English is the default**; Burmese and Thai are opt-in from
/// Settings → Language. Kept deliberately tiny: screens call
/// `tr(context, "English text", "မြန်မာစာ")` inline, so there are no key
/// files to maintain and missing translations simply fall back to English.
///
/// Thai (`th`) exists because a large part of the user base grows and trades
/// in Thailand. Screens that have Thai copy call [tr3]; everything else falls
/// back to English under Thai, which is honest — an English label beats a
/// machine-mangled Thai one, and the fallback is visible so it can be fixed
/// screen by screen.
class GwLang extends ChangeNotifier {
  static const _prefKey = "gw_lang";

  static const supported = ["en", "my", "th"];

  String _code = "en";
  String get code => _code;
  bool get isMyanmar => _code == "my";
  bool get isThai => _code == "th";

  GwLang() {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      if (saved != null && supported.contains(saved)) {
        _code = saved;
        notifyListeners();
      }
    } catch (_) {
      // Keep the English default.
    }
  }

  Future<void> setCode(String code) async {
    if (!supported.contains(code)) return;
    _code = code;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, code);
    } catch (_) {}
  }
}

/// Pick the string for the active language — English unless Burmese is
/// selected. Inside build it watches [GwLang] so switching re-renders live;
/// in event handlers (where watch is not allowed) it falls back to read.
String tr(BuildContext context, String en, String my) {
  return _lang(context).isMyanmar ? my : en;
}

/// Three-language variant for screens that carry Thai copy. Thai falls back
/// to English when [th] is empty, so a partially-translated screen still
/// reads rather than showing blanks.
String tr3(BuildContext context, String en, String my, String th) {
  final lang = _lang(context);
  if (lang.isThai) return th.isEmpty ? en : th;
  return lang.isMyanmar ? my : en;
}

GwLang _lang(BuildContext context) {
  try {
    return context.watch<GwLang>();
  } catch (_) {
    return context.read<GwLang>();
  }
}
