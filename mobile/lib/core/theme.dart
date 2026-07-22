import 'package:flutter/material.dart';

/// Gwave "Green Wave" design system — the brand palette from the web app
/// (`themeColor #3B6D11`, `backgroundColor #EAF3DE`) turned into a full
/// Material 3 theme so every native screen shares one consistent look.
class GwColors {
  static const Color primary = Color(0xFF3B6D11); // deep leaf green
  static const Color primaryBright = Color(0xFF7AC943); // fresh sprout
  static const Color primaryDark = Color(0xFF264808);
  static const Color bg = Color(0xFFEEF5E7); // pale field (airy, matches web)
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF3F8EE);
  static const Color ink = Color(0xFF12160E);
  static const Color inkSoft = Color(0xFF5B6650);
  static const Color line = Color(0xFFE1EAD6);
  static const Color live = Color(0xFFE23B3B);
  static const Color gold = Color(0xFFF4B740);
  static const Color heart = Color(0xFFFF5C8A);

  // Dark surfaces for immersive screens (Live watch, camera).
  static const Color darkBg = Color(0xFF0B0F08);

  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryBright, primary],
  );

  static const LinearGradient liveGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFF7A59), Color(0xFFE23B3B)],
  );
}

class GwRadius {
  static const double sm = 10;
  static const double md = 16;
  static const double lg = 22;
  static const double xl = 30;
}

class GwShadow {
  /// Soft, low drop shadow used to float white cards on the mint background —
  /// the same gentle lift the web app gives its content cards.
  static List<BoxShadow> get card => [
        BoxShadow(
          color: const Color(0xFF264808).withValues(alpha: 0.06),
          blurRadius: 18,
          offset: const Offset(0, 6),
        ),
      ];
}

ThemeData buildGwTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: GwColors.bg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: GwColors.primary,
      primary: GwColors.primary,
      secondary: GwColors.primaryBright,
      surface: GwColors.surface,
      brightness: Brightness.light,
    ),
    fontFamily: 'Roboto',
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: GwColors.bg,
      foregroundColor: GwColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: GwColors.ink,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: CardThemeData(
      color: GwColors.surface,
      elevation: 6,
      shadowColor: GwColors.primaryDark.withValues(alpha: 0.10),
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.lg),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: GwColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      // Soft mint-tinted fill makes each field read as a distinct rounded
      // "card" against a white surface — clearer than a hairline outline.
      filled: true,
      fillColor: GwColors.surfaceMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 19),
      // Larger, calmer label + text so forms are easy to read.
      hintStyle: const TextStyle(color: GwColors.inkSoft, fontSize: 16),
      labelStyle: const TextStyle(
        color: GwColors.inkSoft,
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      floatingLabelStyle: const TextStyle(
        color: GwColors.primary,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
      prefixIconColor: GwColors.inkSoft,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: const BorderSide(color: GwColors.line, width: 1.4),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: const BorderSide(color: GwColors.line, width: 1.4),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: const BorderSide(color: GwColors.primary, width: 1.8),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: const BorderSide(color: GwColors.live, width: 1.4),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: const BorderSide(color: GwColors.live, width: 1.8),
      ),
    ),
    dividerTheme: const DividerThemeData(color: GwColors.line, thickness: 1),
    // Bump the whole app one notch larger for comfortable reading — Burmese
    // script especially benefits from the extra size ("ကကြီး").
    textTheme: base.textTheme
        .apply(
          bodyColor: GwColors.ink,
          displayColor: GwColors.ink,
          fontSizeFactor: 1.06,
        )
        .copyWith(
          titleLarge: base.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
  );
}
