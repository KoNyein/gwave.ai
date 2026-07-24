import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The user's colour-mode choice: follow the system, or force light/dark.
/// Persisted in SharedPreferences; defaults to System.
class GwThemePref extends ChangeNotifier {
  static const _prefKey = "gw_theme_mode";

  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  GwThemePref() {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      switch (prefs.getString(_prefKey)) {
        case "light":
          _mode = ThemeMode.light;
          notifyListeners();
        case "dark":
          _mode = ThemeMode.dark;
          notifyListeners();
        default:
          break; // keep system
      }
    } catch (_) {
      // Keep the system default.
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _prefKey,
        switch (mode) {
          ThemeMode.light => "light",
          ThemeMode.dark => "dark",
          ThemeMode.system => "system",
        },
      );
    } catch (_) {}
  }
}
