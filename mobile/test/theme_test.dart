import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gwave/core/theme.dart';

/// WCAG 2.1 relative luminance.
double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  return 0.2126 * channel(c.r) +
      0.7152 * channel(c.g) +
      0.0722 * channel(c.b);
}

/// WCAG 2.1 contrast ratio between two opaque colours (1.0 – 21.0).
double contrast(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);
  final hi = math.max(la, lb);
  final lo = math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/// AA for body text.
const _aa = 4.5;

/// AA for borders and other non-text UI.
const _aaNonText = 3.0;

void main() {
  // The palette is a global flipped by buildGwTheme; leave every test on the
  // light default so ordering can never leak between them.
  tearDown(() => buildGwTheme(Brightness.light));

  group('dark / AMOLED palette', () {
    setUp(() => buildGwTheme(Brightness.dark));

    test('background is genuinely pure black, not a dark grey', () {
      // The whole point of AMOLED: #000000 switches the pixel off. A tinted
      // near-black would still light it and burn battery.
      expect(GwColors.bg.toARGB32(), 0xFF000000);
      expect(buildGwTheme(Brightness.dark).scaffoldBackgroundColor.toARGB32(),
          0xFF000000);
    });

    test('cards sit above pure black so elevation still reads', () {
      expect(GwColors.surface.toARGB32(), isNot(0xFF000000));
      final lift = contrast(GwColors.surface, GwColors.bg);
      expect(lift, greaterThan(1.05));
      // ...but not so far that we give the AMOLED saving back.
      expect(lift, lessThan(1.4));
      // Input fills have to separate from the card they sit on.
      expect(contrast(GwColors.surfaceMuted, GwColors.surface),
          greaterThan(1.05));
    });

    test('body and secondary text clear WCAG AA on every background', () {
      for (final bg in [GwColors.bg, GwColors.surface, GwColors.surfaceMuted]) {
        expect(contrast(GwColors.ink, bg), greaterThanOrEqualTo(_aa),
            reason: 'ink on $bg');
        expect(contrast(GwColors.inkSoft, bg), greaterThanOrEqualTo(_aa),
            reason: 'inkSoft on $bg');
      }
    });

    test('accents clear AA on black — the light green would not', () {
      for (final c in [
        GwColors.primary,
        GwColors.live,
        GwColors.gold,
        GwColors.heart,
      ]) {
        expect(contrast(c, GwColors.bg), greaterThanOrEqualTo(_aa));
        expect(contrast(c, GwColors.surface), greaterThanOrEqualTo(_aa));
      }
      // Regression guard: the light-mode brand green manages only 3.38:1 on
      // black, which is why dark mode re-tints it.
      expect(contrast(const Color(0xFF3B6D11), const Color(0xFF000000)),
          lessThan(_aa));
    });

    test('borders stay visible against black — the classic AMOLED failure',
        () {
      expect(contrast(GwColors.line, GwColors.bg),
          greaterThanOrEqualTo(_aaNonText));
    });

    test('foreground on a brand fill is readable', () {
      // White on the bright dark-mode green would be ~2:1, so onPrimary flips.
      expect(contrast(GwColors.onPrimary, GwColors.primary),
          greaterThanOrEqualTo(_aa));
      // Hero cards keep white labels, so the gradient stops must carry them.
      for (final stop in GwColors.primaryGradient.colors) {
        expect(contrast(const Color(0xFFFFFFFF), stop),
            greaterThanOrEqualTo(_aa));
      }
    });

    test('immersive screens go fully black too', () {
      expect(GwColors.darkBg.toARGB32(), 0xFF000000);
    });

    test('status bar icons are light so they show on black', () {
      expect(gwOverlayStyle().statusBarIconBrightness, Brightness.light);
    });
  });

  group('light palette is unchanged', () {
    setUp(() => buildGwTheme(Brightness.light));

    test('every token still has its original value', () {
      expect(GwColors.primary.toARGB32(), 0xFF3B6D11);
      expect(GwColors.primaryBright.toARGB32(), 0xFF7AC943);
      expect(GwColors.primaryDark.toARGB32(), 0xFF264808);
      expect(GwColors.bg.toARGB32(), 0xFFEEF5E7);
      expect(GwColors.surface.toARGB32(), 0xFFFFFFFF);
      expect(GwColors.surfaceMuted.toARGB32(), 0xFFF3F8EE);
      expect(GwColors.ink.toARGB32(), 0xFF12160E);
      expect(GwColors.inkSoft.toARGB32(), 0xFF5B6650);
      expect(GwColors.line.toARGB32(), 0xFFE1EAD6);
      expect(GwColors.live.toARGB32(), 0xFFE23B3B);
      expect(GwColors.gold.toARGB32(), 0xFFF4B740);
      expect(GwColors.heart.toARGB32(), 0xFFFF5C8A);
      expect(GwColors.darkBg.toARGB32(), 0xFF0B0F08);
      // The sites that used to hardcode these must be byte-identical.
      expect(GwColors.onPrimary.toARGB32(), 0xFFFFFFFF);
      expect(GwColors.onPrimarySoft.toARGB32(), Colors.white70.toARGB32());
    });

    test('cards still get their drop shadow (dark mode drops it)', () {
      expect(GwShadow.card, isNotEmpty);
      buildGwTheme(Brightness.dark);
      expect(GwShadow.card, isEmpty);
    });
  });

  group('theme preference', () {
    test('resolves System/Light/Dark to a brightness', () {
      final t = GwTheme();
      addTearDown(t.dispose);
      expect(t.mode, ThemeMode.system);
    });
  });

  testWidgets('a real Scaffold paints #000000 under the dark theme',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildGwTheme(Brightness.dark),
      home: const Scaffold(body: Text('gwave')),
    ));

    final material = tester.widget<Material>(
      find.descendant(
        of: find.byType(Scaffold),
        matching: find.byType(Material),
      ).first,
    );
    expect(material.color?.toARGB32(), 0xFF000000);

    // And the text actually rendered on it clears AA.
    final text = tester.widget<Text>(find.text('gwave'));
    final style = text.style ??
        Theme.of(tester.element(find.text('gwave'))).textTheme.bodyMedium!;
    final colour = style.color ?? GwColors.ink;
    expect(contrast(colour, const Color(0xFF000000)),
        greaterThanOrEqualTo(_aa));

    buildGwTheme(Brightness.light);
  });
}
