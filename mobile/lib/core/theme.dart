import 'package:flutter/material.dart';

import 'skins.dart';

/// Gwave design system. The brand constants below stay `const` (dozens of
/// call-sites use them in const expressions); the ACTIVE look of the app is
/// driven by [GwColors.skin] — a switchable [GwSkin] (Gwave / Sky / Liberty /
/// Tactical) that feeds the MaterialApp themes and every `*Of(context)`
/// helper, so picking a skin in Settings restyles the whole shell: canvas,
/// cards, app bar, inputs, buttons, text and dividers, in light AND dark.
class GwColors {
  /// The active design skin. Set by GwaveApp from [GwThemePref] before the
  /// themes are built; defaults to the Gwave brand.
  static GwSkin skin = GwSkins.gwave;

  static const Color primary = Color(0xFF3B6D11); // deep leaf green
  static const Color primaryBright = Color(0xFF7AC943); // fresh sprout
  static const Color primaryDark = Color(0xFF264808);
  // Facebook-style neutral shell: light gray canvas, pure white cards, near-
  // black text — the green stays as the brand accent (where FB uses blue).
  static const Color bg = Color(0xFFF0F2F5); // FB canvas gray
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF0F2F5); // pill/input fill
  static const Color ink = Color(0xFF050505);
  static const Color inkSoft = Color(0xFF65676B);
  static const Color line = Color(0xFFE4E6EB);
  static const Color live = Color(0xFFE23B3B);
  static const Color gold = Color(0xFFF4B740);
  static const Color heart = Color(0xFFFF5C8A);

  // Dark surfaces for immersive screens (Live watch, camera).
  static const Color darkBg = Color(0xFF0B0F08);

  // Facebook-style dark theme palette (used by buildGwDarkTheme()).
  static const Color dBg = Color(0xFF18191A); // dark canvas
  static const Color dSurface = Color(0xFF242526); // dark card
  static const Color dSurfaceMuted = Color(0xFF3A3B3C); // pill/input fill
  static const Color dInk = Color(0xFFE4E6EB); // light text
  static const Color dInkSoft = Color(0xFFB0B3B8);
  static const Color dLine = Color(0xFF393A3B);
  // A brighter green reads better on dark surfaces than the deep leaf green.
  static const Color primaryOnDark = Color(0xFF8BD84F);

  static bool _dark(BuildContext c) =>
      Theme.of(c).brightness == Brightness.dark;

  /// The right "surface"/"ink"/etc. for the active SKIN + brightness — custom
  /// widgets that read these restyle automatically when the skin changes.
  static Color surfaceOf(BuildContext c) =>
      _dark(c) ? skin.dSurface : skin.surface;
  static Color bgOf(BuildContext c) => _dark(c) ? skin.dBg : skin.bg;
  static Color surfaceMutedOf(BuildContext c) =>
      _dark(c) ? skin.dSurfaceMuted : skin.surfaceMuted;
  static Color inkOf(BuildContext c) => _dark(c) ? skin.dInk : skin.ink;
  static Color inkSoftOf(BuildContext c) =>
      _dark(c) ? skin.dInkSoft : skin.inkSoft;
  static Color lineOf(BuildContext c) => _dark(c) ? skin.dLine : skin.line;

  /// Hyperlink colour for the active skin/brightness.
  static Color linkOf(BuildContext c) => _dark(c) ? skin.dLink : skin.link;

  /// The skin's accent, tuned per brightness — new code should prefer this
  /// over the const [primary] so it follows the chosen skin.
  static Color accentOf(BuildContext c) =>
      _dark(c) ? skin.primaryOnDark : skin.primary;

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
  // Tighter, Facebook-like corner radii.
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
}

class GwShadow {
  /// Barely-there lift, Facebook style — cards read as flat white sheets on
  /// the gray canvas with just enough shadow to separate on scroll.
  static List<BoxShadow> get card => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 6,
          offset: const Offset(0, 1),
        ),
      ];
}

OutlinedBorder _buttonShape(GwSkin s) => s.stadiumButtons
    ? const StadiumBorder()
    : RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(s.buttonRadius));

ThemeData buildGwTheme() {
  final s = GwColors.skin;
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: s.bg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: s.primary,
      primary: s.primary,
      secondary: s.primaryBright,
      surface: s.surface,
      brightness: Brightness.light,
    ),
    fontFamily: 'Roboto',
  );

  return base.copyWith(
    appBarTheme: AppBarTheme(
      // Flat top bar in the skin's card colour, content canvas below it.
      backgroundColor: s.surface,
      foregroundColor: s.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: s.ink,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: CardThemeData(
      color: s.surface,
      elevation: 0.5,
      shadowColor: Colors.black.withValues(alpha: 0.25),
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: s.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        shape: _buttonShape(s),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: s.primary,
        foregroundColor: Colors.white,
        shape: _buttonShape(s),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: s.primary,
        shape: _buttonShape(s),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: s.primary),
    ),
    inputDecorationTheme: InputDecorationTheme(
      // Soft skin-tinted fill makes each field read as a distinct rounded
      // "card" against the surface — clearer than a hairline outline.
      filled: true,
      fillColor: s.surfaceMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 19),
      // Larger, calmer label + text so forms are easy to read.
      hintStyle: TextStyle(color: s.inkSoft, fontSize: 16),
      labelStyle: TextStyle(
        color: s.inkSoft,
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      floatingLabelStyle: TextStyle(
        color: s.primary,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
      prefixIconColor: s.inkSoft,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.line, width: 1.4),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.line, width: 1.4),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.primary, width: 1.8),
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
    dividerTheme: DividerThemeData(color: s.line, thickness: 1),
    // Bump the whole app one notch larger for comfortable reading — Burmese
    // script especially benefits from the extra size ("ကကြီး").
    textTheme: base.textTheme
        .apply(
          bodyColor: s.ink,
          displayColor: s.ink,
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

/// The dark counterpart of [buildGwTheme] — same structure with the active
/// skin's dark canvas/cards and light text. Material surfaces (Scaffold,
/// AppBar, Card, ListTile, Dialog, inputs) adapt automatically; custom widgets
/// should read GwColors.*Of(context) so they flip too.
ThemeData buildGwDarkTheme() {
  final s = GwColors.skin;
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: s.dBg,
    colorScheme: ColorScheme.fromSeed(
      seedColor: s.primary,
      primary: s.primaryOnDark,
      secondary: s.primaryBright,
      surface: s.dSurface,
      brightness: Brightness.dark,
    ),
    fontFamily: 'Roboto',
  );

  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: s.dSurface,
      foregroundColor: s.dInk,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: s.dInk,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: CardThemeData(
      color: s.dSurface,
      elevation: 0.5,
      shadowColor: Colors.black.withValues(alpha: 0.4),
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: s.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        shape: _buttonShape(s),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: s.primary,
        foregroundColor: Colors.white,
        shape: _buttonShape(s),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: s.primaryOnDark,
        shape: _buttonShape(s),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: s.primaryOnDark),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: s.dSurfaceMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 19),
      hintStyle: TextStyle(color: s.dInkSoft, fontSize: 16),
      labelStyle: TextStyle(
        color: s.dInkSoft,
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      floatingLabelStyle: TextStyle(
        color: s.primaryOnDark,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
      prefixIconColor: s.dInkSoft,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.dLine, width: 1.4),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.dLine, width: 1.4),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: s.primaryOnDark, width: 1.8),
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
    dividerTheme: DividerThemeData(color: s.dLine, thickness: 1),
    textTheme: base.textTheme
        .apply(
          bodyColor: s.dInk,
          displayColor: s.dInk,
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
