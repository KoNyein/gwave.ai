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

  // ── Semantic status colours ────────────────────────────────────────────
  // ★ These carry MEANING, not brand — "too high" has to read as danger in
  //   every skin, so they deliberately do not follow the accent. They live
  //   here so the same green/amber/red is used everywhere instead of each
  //   screen inventing its own hex.
  static const Color ok = Color(0xFF2E9E5B);
  static const Color warn = Color(0xFFE0A81F);
  static const Color bad = Color(0xFFD84343);

  /// Instrument readouts (light meter, storage scan) — an amber that stays
  /// legible in the dark-adapted night mode as well as on white.
  static const Color meter = Color(0xFFE07A1F);
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
  /// Bottom sheets and full-bleed panels — a deliberately larger curve so a
  /// sheet reads as a surface sliding over the page, not another card.
  static const double sheet = 26;
}

/// One spacing scale for the whole app.
///
/// Screens had been picking 6 / 8 / 10 / 12 / 14 / 16 by feel, which is why
/// two lists next to each other never quite lined up. These are the only
/// gaps new code should use.
class GwSpace {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;

  /// The standard page gutter — content should breathe the same distance
  /// from the screen edge everywhere.
  static const EdgeInsets page = EdgeInsets.symmetric(horizontal: 16);
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

  /// Two-layer lift for anything that floats above the page — sheets, menus,
  /// the mini player. A tight dark shadow for the edge plus a wide soft one
  /// for the ambient falloff reads far better than one big blur.
  static List<BoxShadow> get raised => [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.10),
          blurRadius: 3,
          offset: const Offset(0, 1),
        ),
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.08),
          blurRadius: 24,
          offset: const Offset(0, 8),
        ),
      ];

  /// Coloured glow for primary/live call-to-action buttons.
  static List<BoxShadow> glow(Color color) => [
        BoxShadow(
          color: color.withValues(alpha: 0.35),
          blurRadius: 16,
          offset: const Offset(0, 6),
        ),
      ];
}

OutlinedBorder _buttonShape(GwSkin s) => s.stadiumButtons
    ? const StadiumBorder()
    : RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(s.buttonRadius));

// Component themes shared by light and dark, parameterised by the colours
// that differ. Both builders call these, so a tweak lands in both — the two
// theme functions had already drifted apart once.

/// Rounded, floating snack bars instead of the full-width square default.
SnackBarThemeData _snackBar(Color surface, Color ink) => SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: surface,
      contentTextStyle: TextStyle(
        color: ink,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
      ),
    );

/// Sheets get a big top curve and the M3 drag handle, so "swipe me down" is
/// visible rather than something the user has to guess.
BottomSheetThemeData _sheet(Color surface, Color line) => BottomSheetThemeData(
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: line,
      dragHandleSize: const Size(36, 4),
      elevation: 0,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(GwRadius.sheet),
        ),
      ),
    );

/// Chips read as soft tinted pills; the selected state is the accent at low
/// opacity rather than a filled block, which is quieter next to content.
ChipThemeData _chips(Color muted, Color ink, Color accent) => ChipThemeData(
      backgroundColor: muted,
      selectedColor: accent.withValues(alpha: 0.16),
      checkmarkColor: accent,
      side: BorderSide.none,
      labelStyle: TextStyle(
        color: ink,
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
      secondaryLabelStyle: TextStyle(
        color: accent,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: const StadiumBorder(),
    );

/// Bottom navigation: taller for thumbs, a pill indicator behind the active
/// icon, and labels that only bold when selected.
NavigationBarThemeData _navBar(Color surface, Color ink, Color soft, Color accent) =>
    NavigationBarThemeData(
      height: 68,
      backgroundColor: surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: accent.withValues(alpha: 0.16),
      indicatorShape: const StadiumBorder(),
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 11.5,
          fontWeight:
              states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? accent : soft,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          size: 24,
          color: states.contains(WidgetState.selected) ? accent : soft,
        ),
      ),
    );

/// List rows: consistent gutters and a rounded highlight, so a tapped row
/// looks like a target rather than a full-bleed grey band.
ListTileThemeData _listTile(Color ink, Color soft) => ListTileThemeData(
      iconColor: soft,
      textColor: ink,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
      ),
      titleTextStyle: TextStyle(
        color: ink,
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
      subtitleTextStyle: TextStyle(color: soft, fontSize: 13),
    );

TooltipThemeData _tooltip(Color ink, Color surface) => TooltipThemeData(
      decoration: BoxDecoration(
        color: ink.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(GwRadius.sm),
      ),
      textStyle: TextStyle(color: surface, fontSize: 12.5),
      waitDuration: const Duration(milliseconds: 400),
    );

/// Burmese script needs more line height than Latin to stay legible — the
/// stacked marks collide at Material's default 1.2. This applies a comfortable
/// leading across body text without touching the size scale.
TextTheme _text(TextTheme base, Color ink) => base
    .apply(bodyColor: ink, displayColor: ink, fontSizeFactor: 1.06)
    .copyWith(
      titleLarge: base.titleLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
        height: 1.3,
      ),
      titleMedium: base.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
        height: 1.35,
      ),
      bodyLarge: base.bodyLarge?.copyWith(height: 1.45),
      bodyMedium: base.bodyMedium?.copyWith(height: 1.45),
      bodySmall: base.bodySmall?.copyWith(height: 1.4),
      labelLarge: base.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    );

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
    snackBarTheme: _snackBar(s.ink, s.surface),
    bottomSheetTheme: _sheet(s.surface, s.line),
    chipTheme: _chips(s.surfaceMuted, s.ink, s.primary),
    navigationBarTheme: _navBar(s.surface, s.ink, s.inkSoft, s.primary),
    listTileTheme: _listTile(s.ink, s.inkSoft),
    tooltipTheme: _tooltip(s.ink, s.surface),
    iconTheme: IconThemeData(color: s.inkSoft, size: 22),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: s.primary,
      linearTrackColor: s.surfaceMuted,
      circularTrackColor: Colors.transparent,
    ),
    // The default Android page slide feels heavy next to the rest of this
    // shell; the zoom transition is the one Material 3 ships for a reason.
    // Android only: this app has no iOS target, and naming the Cupertino
    // builder here broke the release compile on the CI Flutter channel.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: ZoomPageTransitionsBuilder()},
    ),
    // Bump the whole app one notch larger for comfortable reading — Burmese
    // script especially benefits from the extra size ("ကကြီး") and the extra
    // line height (see _text).
    textTheme: _text(base.textTheme, s.ink),
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
    // On dark, the snack bar inverts: a light sheet on the dark canvas is the
    // Material behaviour and stays readable over video screens.
    snackBarTheme: _snackBar(s.dSurfaceMuted, s.dInk),
    bottomSheetTheme: _sheet(s.dSurface, s.dLine),
    chipTheme: _chips(s.dSurfaceMuted, s.dInk, s.primaryOnDark),
    navigationBarTheme:
        _navBar(s.dSurface, s.dInk, s.dInkSoft, s.primaryOnDark),
    listTileTheme: _listTile(s.dInk, s.dInkSoft),
    tooltipTheme: _tooltip(s.dSurfaceMuted, s.dInk),
    iconTheme: IconThemeData(color: s.dInkSoft, size: 22),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: s.primaryOnDark,
      linearTrackColor: s.dSurfaceMuted,
      circularTrackColor: Colors.transparent,
    ),
    // Android only: this app has no iOS target, and naming the Cupertino
    // builder here broke the release compile on the CI Flutter channel.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: ZoomPageTransitionsBuilder()},
    ),
    textTheme: _text(base.textTheme, s.dInk),
  );
}
