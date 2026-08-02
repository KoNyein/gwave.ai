import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'skins.dart';

/// The user's appearance choices, persisted in SharedPreferences:
///  - colour MODE: follow the system, or force light/dark (default System);
///  - design SKIN: which [GwSkin] the whole app is dressed in
///    (Gwave / Sky / Liberty / Tactical — default Gwave).
class GwThemePref extends ChangeNotifier {
  static const _prefKey = "gw_theme_mode";
  static const _skinKey = "gw_theme_skin";

  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  GwSkin _skin = GwSkins.gwave;
  GwSkin get skin => _skin;

  GwThemePref() {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      switch (prefs.getString(_prefKey)) {
        case "light":
          _mode = ThemeMode.light;
        case "dark":
          _mode = ThemeMode.dark;
        default:
          break; // keep system
      }
      final skinId = prefs.getString(_skinKey);
      if (skinId != null) _skin = GwSkins.byId(skinId);
      notifyListeners();
    } catch (_) {
      // Keep the defaults.
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

  Future<void> setSkin(GwSkin skin) async {
    if (skin.id == _skin.id) return;
    _skin = skin;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_skinKey, skin.id);
    } catch (_) {}
  }
}
