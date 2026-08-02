import 'package:flutter/material.dart';

/// A design skin — the complete color-token set (light + dark) plus shape
/// language for one app-wide theme. The user picks a skin in Settings →
/// Appearance; [GwThemePref] persists it and the whole MaterialApp rebuilds.
///
/// Four skins ship:
///
/// ── Gwave (default) ─ the Green Wave brand: leaf green accent on a
///    Facebook-style neutral shell (gray canvas / white cards).
///
/// ── Sky ─ Twitter/X language: pure white canvas, near-black ink,
///    #1D9BF0 azure accent, stadium (fully round) buttons, "Dim" navy dark
///    mode (#15202B) instead of pure black.
///
/// ── Liberty ─ Truth-style language: violet #5448EE accent, soft
///    off-white canvas with airy cards, deep-navy dark mode, gold reserved
///    for badges.
///
/// ── Tactical ─ military language: army-olive #4B5320 accent, khaki
///    canvas, sage highlights, ANGULAR corners (8px buttons — no pills),
///    "night-ops" near-black green dark mode with amber warnings.
class GwSkin {
  const GwSkin({
    required this.id,
    required this.nameEn,
    required this.nameMy,
    required this.primary,
    required this.primaryBright,
    required this.primaryDark,
    required this.primaryOnDark,
    required this.bg,
    required this.surface,
    required this.surfaceMuted,
    required this.ink,
    required this.inkSoft,
    required this.line,
    required this.link,
    required this.dBg,
    required this.dSurface,
    required this.dSurfaceMuted,
    required this.dInk,
    required this.dInkSoft,
    required this.dLine,
    required this.dLink,
    this.buttonRadius = 12,
    this.stadiumButtons = false,
  });

  final String id;
  final String nameEn;
  final String nameMy;

  // Accent family.
  final Color primary; // main accent (buttons, links, focus)
  final Color primaryBright; // lighter companion (gradients, highlights)
  final Color primaryDark; // pressed/deep accents
  final Color primaryOnDark; // accent tuned for dark surfaces

  // Light tokens.
  final Color bg; // page canvas
  final Color surface; // cards / app bar
  final Color surfaceMuted; // input fills, pills
  final Color ink; // primary text
  final Color inkSoft; // secondary text
  final Color line; // hairlines / dividers
  final Color link; // hyperlink

  // Dark tokens.
  final Color dBg;
  final Color dSurface;
  final Color dSurfaceMuted;
  final Color dInk;
  final Color dInkSoft;
  final Color dLine;
  final Color dLink;

  // Shape language (applied via ThemeData, so const call-sites stay valid).
  final double buttonRadius;
  final bool stadiumButtons; // Twitter/X-style fully-round buttons
}

class GwSkins {
  /// Gwave — Green Wave brand on the Facebook-style neutral shell.
  static const GwSkin gwave = GwSkin(
    id: "gwave",
    nameEn: "Gwave Green",
    nameMy: "Gwave အစိမ်း",
    primary: Color(0xFF3B6D11), // deep leaf green
    primaryBright: Color(0xFF7AC943), // fresh sprout
    primaryDark: Color(0xFF264808),
    primaryOnDark: Color(0xFF8BD84F),
    bg: Color(0xFFF0F2F5), // FB canvas gray
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF0F2F5),
    ink: Color(0xFF050505),
    inkSoft: Color(0xFF65676B),
    line: Color(0xFFE4E6EB),
    link: Color(0xFF1B74E4),
    dBg: Color(0xFF18191A),
    dSurface: Color(0xFF242526),
    dSurfaceMuted: Color(0xFF3A3B3C),
    dInk: Color(0xFFE4E6EB),
    dInkSoft: Color(0xFFB0B3B8),
    dLine: Color(0xFF393A3B),
    dLink: Color(0xFF5AA7FF),
  );

  /// Sky — Twitter/X: azure #1D9BF0, white canvas, ink #0F1419, stadium
  /// buttons, "Dim" #15202B dark mode.
  static const GwSkin sky = GwSkin(
    id: "sky",
    nameEn: "Sky (X style)",
    nameMy: "Sky (Twitter ပုံစံ)",
    primary: Color(0xFF1D9BF0),
    primaryBright: Color(0xFF6BC9FF),
    primaryDark: Color(0xFF1A8CD8),
    primaryOnDark: Color(0xFF1D9BF0),
    bg: Color(0xFFFFFFFF), // X keeps the whole page white
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEFF3F4), // search pill gray
    ink: Color(0xFF0F1419),
    inkSoft: Color(0xFF536471),
    line: Color(0xFFE1E8ED),
    link: Color(0xFF1D9BF0),
    dBg: Color(0xFF15202B), // "Dim" navy, not pure black
    dSurface: Color(0xFF1E2732),
    dSurfaceMuted: Color(0xFF273340),
    dInk: Color(0xFFF7F9F9),
    dInkSoft: Color(0xFF8B98A5),
    dLine: Color(0xFF38444D),
    dLink: Color(0xFF1D9BF0),
    buttonRadius: 22,
    stadiumButtons: true,
  );

  /// Liberty — Truth-style: violet #5448EE, airy off-white canvas, deep navy
  /// dark mode.
  static const GwSkin liberty = GwSkin(
    id: "liberty",
    nameEn: "Liberty (Truth style)",
    nameMy: "Liberty (Truth ပုံစံ)",
    primary: Color(0xFF5448EE),
    primaryBright: Color(0xFF7A6FF3),
    primaryDark: Color(0xFF3F35C4),
    primaryOnDark: Color(0xFF8F86FF),
    bg: Color(0xFFF7F8FC),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFEEF0F8),
    ink: Color(0xFF16182D),
    inkSoft: Color(0xFF6A6F85),
    line: Color(0xFFE3E6F0),
    link: Color(0xFF5448EE),
    dBg: Color(0xFF10122B), // deep navy
    dSurface: Color(0xFF191C3A),
    dSurfaceMuted: Color(0xFF242850),
    dInk: Color(0xFFECEEF8),
    dInkSoft: Color(0xFF9BA0BC),
    dLine: Color(0xFF2E325A),
    dLink: Color(0xFF9C94FF),
    buttonRadius: 14,
  );

  /// Tactical — military: army olive #4B5320, khaki canvas, sage highlight,
  /// angular 8px corners, night-ops dark mode.
  static const GwSkin tactical = GwSkin(
    id: "tactical",
    nameEn: "Tactical (Military)",
    nameMy: "Tactical (စစ်သုံးပုံစံ)",
    primary: Color(0xFF4B5320), // army olive drab
    primaryBright: Color(0xFF8A9A5B), // sage
    primaryDark: Color(0xFF33390F),
    primaryOnDark: Color(0xFFA8B860),
    bg: Color(0xFFE8EADF), // khaki canvas
    surface: Color(0xFFF4F5EC),
    surfaceMuted: Color(0xFFDDE0CE),
    ink: Color(0xFF1B2114),
    inkSoft: Color(0xFF56604A),
    line: Color(0xFFC9CDB6),
    link: Color(0xFF6B8E23), // olive-drab link
    dBg: Color(0xFF0B0E09), // night ops
    dSurface: Color(0xFF141910),
    dSurfaceMuted: Color(0xFF1F2617),
    dInk: Color(0xFFD8DEC8),
    dInkSoft: Color(0xFF93A184),
    dLine: Color(0xFF2A3220),
    dLink: Color(0xFFA8B860),
    buttonRadius: 8, // angular, no pills
  );

  static const List<GwSkin> all = [gwave, sky, liberty, tactical];

  static GwSkin byId(String? id) {
    for (final s in all) {
      if (s.id == id) return s;
    }
    return gwave;
  }
}
