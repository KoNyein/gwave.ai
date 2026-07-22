import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// App language. **English is the default**; Burmese is opt-in from
/// Settings → Language. Kept deliberately tiny: screens call
/// `tr(context, "English text", "မြန်မာစာ")` inline, so there are no key
/// files to maintain and missing translations simply fall back to English.
class GwLang extends ChangeNotifier {
  static const _prefKey = "gw_lang";

  String _code = "en";
  String get code => _code;
  bool get isMyanmar => _code == "my";

  GwLang() {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_prefKey);
      if (saved == "my" || saved == "en") {
        _code = saved!;
        notifyListeners();
      }
    } catch (_) {
      // Keep the English default.
    }
  }

  Future<void> setCode(String code) async {
    if (code != "en" && code != "my") return;
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
  GwLang lang;
  try {
    lang = context.watch<GwLang>();
  } catch (_) {
    lang = context.read<GwLang>();
  }
  return lang.isMyanmar ? my : en;
}
