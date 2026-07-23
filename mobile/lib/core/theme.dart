import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Gwave "Green Wave" design system — the brand palette from the web app
/// (`themeColor #3B6D11`, `backgroundColor #EAF3DE`) turned into a full
/// Material 3 theme so every native screen shares one consistent look.
///
/// ## Why these are getters and not `const`
///
/// 640-odd call sites across ~53 screens paint with bare `GwColors.x` values
/// rather than reading `Theme.of(context)`. Swapping only [ThemeData] would
/// therefore darken almost nothing — the screens would keep painting white
/// cards on a black scaffold. So the *tokens themselves* are theme-aware:
/// each one is a `static` getter that resolves against [isDark].
///
/// The trade-off is that a colour token is no longer a compile-time constant,
/// so widgets holding one cannot be `const`. That is the intended cost — a
/// `const` widget would cache the light colour and never repaint on a theme
/// switch, which is exactly the bug we are avoiding.
///
/// [applyBrightness] must be called once per frame *above* the `MaterialApp`
/// (see `GwaveApp`), before any descendant reads a token. Because the flag is
/// global, never hand both `theme:` and `darkTheme:` to `MaterialApp` — build
/// the one resolved theme instead, or the two will disagree.
class GwColors {
  GwColors._();

  // ---------------------------------------------------------------- light
  // The original palette, unchanged — light mode renders byte-identically.
  static const Color _lPrimary = Color(0xFF3B6D11); // deep leaf green
  static const Color _lPrimaryBright = Color(0xFF7AC943); // fresh sprout
  static const Color _lPrimaryDark = Color(0xFF264808);
  static const Color _lBg = Color(0xFFEEF5E7); // pale field (matches web)
  static const Color _lSurface = Color(0xFFFFFFFF);
  static const Color _lSurfaceMuted = Color(0xFFF3F8EE);
  static const Color _lInk = Color(0xFF12160E);
  static const Color _lInkSoft = Color(0xFF5B6650);
  static const Color _lLine = Color(0xFFE1EAD6);
  static const Color _lLive = Color(0xFFE23B3B);
  static const Color _lGold = Color(0xFFF4B740);
  static const Color _lHeart = Color(0xFFFF5C8A);
  static const Color _lDarkBg = Color(0xFF0B0F08);
  static const Color _lOnPrimary = Color(0xFFFFFFFF);

  // ----------------------------------------------------------- dark/AMOLED
  // Pure black, so OLED pixels are switched off rather than lit dim grey.
  // Every value below was picked against measured WCAG contrast (ratios in
  // the doc comments) rather than by eye.
  static const Color _dBg = Color(0xFF000000);

  /// Cards/sheets sit ~16% above pure black so elevation still reads without
  /// giving up the AMOLED win on the (much larger) background area.
  static const Color _dSurface = Color(0xFF161616);

  /// Input fills and nested chips, one further step up so they separate from
  /// the card they sit on.
  static const Color _dSurfaceMuted = Color(0xFF242424);

  /// Body text. Deliberately off-white rather than #FFFFFF: 17.8:1 is still
  /// far past AA and it glares much less during long night sessions.
  static const Color _dInk = Color(0xFFECECEC);

  /// Secondary text — 8.0:1 on black, 5.9:1 even on the muted fill, so it
  /// clears AA everywhere it lands. Keeps a faint green-grey cast so it reads
  /// as the same family as light mode's #5B6650.
  static const Color _dInkSoft = Color(0xFF9AA394);

  /// Borders and dividers, 3.2:1 on black. The classic AMOLED failure is a
  /// #1A1A1A hairline that simply vanishes (1.2:1); this clears the WCAG
  /// 1.4.11 non-text threshold instead.
  static const Color _dLine = Color(0xFF566150);

  /// **Re-tinted for dark.** The light brand green #3B6D11 manages only
  /// 3.38:1 on black — it fails AA outright and reads as a muddy smear. This
  /// is the existing brand "sprout" green, so the hue is unchanged: 10.3:1.
  static const Color _dPrimary = Color(0xFF7AC943);
  static const Color _dPrimaryBright = Color(0xFFA3E27A);
  static const Color _dPrimaryDark = Color(0xFF55A32A);

  /// **Re-tinted for dark.** #E23B3B lands at 4.39:1 on the card surface —
  /// just under AA. Lifted to 7.1:1 on black.
  static const Color _dLive = Color(0xFFFF5F5F);

  /// Foreground for anything painted *on top of* a [primary] fill. Light mode
  /// keeps white; dark mode must not, because white on the bright green is
  /// only 2.05:1. Near-black gives 9.2:1.
  static const Color _dOnPrimary = Color(0xFF0B140A);

  static bool _dark = false;

  /// Whether the app is currently painting its dark/AMOLED palette.
  static bool get isDark => _dark;

  /// Point every token at one palette. Called once per frame from `GwaveApp`.
  static void applyBrightness(Brightness brightness) {
    _dark = brightness == Brightness.dark;
  }

  static Color get primary => _dark ? _dPrimary : _lPrimary;
  static Color get primaryBright => _dark ? _dPrimaryBright : _lPrimaryBright;
  static Color get primaryDark => _dark ? _dPrimaryDark : _lPrimaryDark;
  static Color get bg => _dark ? _dBg : _lBg;
  static Color get surface => _dark ? _dSurface : _lSurface;
  static Color get surfaceMuted => _dark ? _dSurfaceMuted : _lSurfaceMuted;
  static Color get ink => _dark ? _dInk : _lInk;
  static Color get inkSoft => _dark ? _dInkSoft : _lInkSoft;
  static Color get line => _dark ? _dLine : _lLine;
  static Color get live => _dark ? _dLive : _lLive;

  /// Gold and heart already clear AA on black (11.7:1 and 7.2:1), so they are
  /// shared rather than re-tinted.
  static Color get gold => _lGold;
  static Color get heart => _lHeart;

  /// Text/icons drawn on a [primary] or [primaryGradient] fill.
  static Color get onPrimary => _dark ? _dOnPrimary : _lOnPrimary;

  /// The de-emphasised partner to [onPrimary] (timestamps, sub-labels on a
  /// green fill). Light mode returns exactly `Colors.white70`, so the sites
  /// that used to hardcode it are unchanged.
  static Color get onPrimarySoft =>
      _dark ? const Color(0xB30B140A) : Colors.white70;

  /// Backdrop for immersive screens (Live watch, camera, reels). Already dark
  /// in light mode; goes fully black in dark mode for the OLED saving, since
  /// these are the screens that stay open longest.
  static Color get darkBg => _dark ? _dBg : _lDarkBg;

  /// The hero-card / balance-card fill.
  ///
  /// Dark mode deliberately does **not** reuse the bright [primary] pair. Two
  /// reasons: a full-width bright-green card is a glare bomb on an OLED panel
  /// at night, which is the opposite of what this theme is for; and the ~50
  /// call sites that paint `Colors.white` on this gradient would drop to
  /// 2.05:1 against #7AC943. Deepening the stops instead keeps every one of
  /// those white labels legible (7.1:1 on the light stop, 10.7:1 on the dark)
  /// with no edit at the call site.
  static LinearGradient get primaryGradient => _dark
      ? const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2F6410), Color(0xFF204709)],
        )
      : LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primaryBright, primary],
        );

  static LinearGradient get liveGradient => const LinearGradient(
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
  ///
  /// Dark mode drops it entirely: a black shadow on a black background is
  /// invisible, and faking a glow just muddies the panel. Elevation there is
  /// carried by [GwColors.surface] sitting above pure black instead.
  static List<BoxShadow> get card => GwColors.isDark
      ? const <BoxShadow>[]
      : [
          BoxShadow(
            color: const Color(0xFF264808).withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ];
}

/// The status/navigation bar styling that matches the active palette. Screens
/// that take over the system chrome (Live watch) must restore *this* rather
/// than a hardcoded `SystemUiOverlayStyle.dark`, or the status bar text goes
/// invisible in one of the two themes.
SystemUiOverlayStyle gwOverlayStyle() => GwColors.isDark
    ? const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Color(0xFF000000),
        systemNavigationBarIconBrightness: Brightness.light,
      )
    : const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
        systemNavigationBarColor: Color(0xFFEEF5E7),
        systemNavigationBarIconBrightness: Brightness.dark,
      );

/// Theme preference — System / Light / Dark (AMOLED), persisted so the choice
/// survives a restart. Mirrors [GwLang]'s shape (ChangeNotifier +
/// SharedPreferences) so Settings can drive both the same way.
///
/// Also watches the OS for light/dark changes, so "System" tracks the phone's
/// night schedule without a restart.
class GwTheme extends ChangeNotifier with WidgetsBindingObserver {
  static const _prefKey = "gw_theme";

  ThemeMode _mode = ThemeMode.system;
  ThemeMode get mode => _mode;

  GwTheme() {
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// The OS changed between light and dark; only matters in System mode.
  @override
  void didChangePlatformBrightness() {
    if (_mode == ThemeMode.system) notifyListeners();
  }

  /// The brightness to actually paint, folding in the OS setting.
  Brightness get brightness => switch (_mode) {
        ThemeMode.light => Brightness.light,
        ThemeMode.dark => Brightness.dark,
        ThemeMode.system => PlatformDispatcher.instance.platformBrightness,
      };

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      switch (prefs.getString(_prefKey)) {
        case "light":
          _mode = ThemeMode.light;
        case "dark":
          _mode = ThemeMode.dark;
        case "system":
          _mode = ThemeMode.system;
        default:
          return; // Nothing saved — keep the System default.
      }
      notifyListeners();
    } catch (_) {
      // Keep the System default.
    }
  }

  Future<void> setMode(ThemeMode mode) async {
    if (mode == _mode) return;
    _mode = mode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_prefKey, mode.name);
    } catch (_) {}
  }
}

/// Build the one theme for [brightness].
///
/// This also flips the global [GwColors] palette, because the bare tokens and
/// the [ThemeData] have to agree. That is why the app resolves a single
/// brightness and calls this once — handing `theme:`/`darkTheme:` to
/// `MaterialApp` would call it twice per frame and leave the tokens on
/// whichever palette happened to build last.
ThemeData buildGwTheme([Brightness brightness = Brightness.light]) {
  GwColors.applyBrightness(brightness);
  final dark = brightness == Brightness.dark;

  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
    scaffoldBackgroundColor: GwColors.bg,
    // The extra roles are pinned in dark mode only. Light mode keeps exactly
    // the four overrides it shipped with, so its generated scheme — and every
    // pixel that depends on it — is unchanged.
    colorScheme: ColorScheme.fromSeed(
      seedColor: GwColors.primary,
      primary: GwColors.primary,
      secondary: GwColors.primaryBright,
      surface: GwColors.surface,
      onPrimary: dark ? GwColors.onPrimary : null,
      onSurface: dark ? GwColors.ink : null,
      error: dark ? GwColors.live : null,
      brightness: brightness,
    ),
    fontFamily: 'Roboto',
  );

  return base.copyWith(
    appBarTheme: AppBarTheme(
      backgroundColor: GwColors.bg,
      foregroundColor: GwColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      // Dark only: M3 would otherwise tint the scrolled-under bar off-black.
      surfaceTintColor: dark ? Colors.transparent : null,
      centerTitle: false,
      systemOverlayStyle: dark ? gwOverlayStyle() : null,
      titleTextStyle: TextStyle(
        color: GwColors.ink,
        fontSize: 20,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
      ),
    ),
    cardTheme: CardThemeData(
      color: GwColors.surface,
      elevation: dark ? 0 : 6,
      shadowColor: GwColors.primaryDark.withValues(alpha: 0.10),
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(GwRadius.lg),
      ),
    ),
    // Sheets, dialogs and menus default to a Material surface that is not our
    // black; pin them so nothing pops up white on a dark app. Dark only —
    // passing null to `copyWith` leaves light mode on the stock M3 values it
    // has always used.
    bottomSheetTheme: dark
        ? BottomSheetThemeData(
            backgroundColor: GwColors.surface,
            surfaceTintColor: Colors.transparent,
          )
        : null,
    dialogTheme: dark
        ? DialogThemeData(
            backgroundColor: GwColors.surface,
            surfaceTintColor: Colors.transparent,
          )
        : null,
    popupMenuTheme: dark
        ? PopupMenuThemeData(
            color: GwColors.surface,
            surfaceTintColor: Colors.transparent,
          )
        : null,
    bottomNavigationBarTheme: dark
        ? BottomNavigationBarThemeData(
            backgroundColor: GwColors.surface,
            selectedItemColor: GwColors.primary,
            unselectedItemColor: GwColors.inkSoft,
          )
        : null,
    snackBarTheme: SnackBarThemeData(
      backgroundColor: dark ? GwColors.surfaceMuted : null,
      contentTextStyle: dark ? TextStyle(color: GwColors.ink) : null,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: GwColors.primary,
        // Dark mode's primary is a bright green; white on it is 2.05:1, so
        // filled buttons flip to near-black text instead (9.2:1).
        foregroundColor: GwColors.onPrimary,
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
      hintStyle: TextStyle(color: GwColors.inkSoft, fontSize: 16),
      labelStyle: TextStyle(
        color: GwColors.inkSoft,
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      floatingLabelStyle: TextStyle(
        color: GwColors.primary,
        fontSize: 14,
        fontWeight: FontWeight.w700,
      ),
      prefixIconColor: GwColors.inkSoft,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: GwColors.line, width: 1.4),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: GwColors.line, width: 1.4),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: GwColors.primary, width: 1.8),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: GwColors.live, width: 1.4),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(GwRadius.md),
        borderSide: BorderSide(color: GwColors.live, width: 1.8),
      ),
    ),
    dividerTheme: DividerThemeData(color: GwColors.line, thickness: 1),
    // NOTE: this used to also pass `fontSizeFactor: 1.06`, meaning to bump the
    // whole app one notch larger for comfortable reading (Burmese script
    // especially benefits — "ကကြီး"). It never did anything. `ThemeData`'s
    // own `textTheme` carries colour only: every `fontSize` on it is null, and
    // the real sizes are merged in later by `ThemeData.localize` from
    // `Typography.englishLike`. Scaling nulls yields nulls, so the factor was
    // dropped on the floor in release — and in debug it tripped an assert
    // inside `TextStyle.apply`, so `flutter run` and any widget test that
    // built this theme crashed outright.
    //
    // Removing it is behaviour-identical in release and un-breaks debug. To
    // actually get the intended bump, scale after localisation (e.g. a
    // `MediaQuery` textScaler around the app) — deliberately not done here,
    // because it would change how light mode looks.
    textTheme: base.textTheme
        .apply(
          bodyColor: GwColors.ink,
          displayColor: GwColors.ink,
        )
        .copyWith(
          titleLarge: base.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
  );
}
