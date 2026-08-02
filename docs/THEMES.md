# Gwave app design themes (skins)

The Flutter app ships a skin-based theme system (`mobile/lib/core/skins.dart`).
A skin is the complete color-token set (light + dark) plus shape language for
one app-wide look. The user picks a skin in **Settings → Appearance → Design
theme**; `GwThemePref` persists it (`gw_theme_skin`) and the MaterialApp
rebuilds — canvas, cards, app bar, inputs, buttons, dividers, text and every
widget reading `GwColors.*Of(context)` restyle at once, in both light and dark
mode. `GwColors.accentOf(context)` is the skin's accent for new custom widgets
(the legacy `GwColors.primary` const stays the Gwave green where it appears in
const expressions).

## 1. Gwave Green (default)

Brand look: leaf-green accent on a Facebook-style neutral shell.

| Token | Light | Dark |
|---|---|---|
| accent | `#3B6D11` (leaf) | `#8BD84F` |
| accent bright / dark | `#7AC943` / `#264808` | — |
| canvas (bg) | `#F0F2F5` | `#18191A` |
| card (surface) | `#FFFFFF` | `#242526` |
| input/pill fill | `#F0F2F5` | `#3A3B3C` |
| text | `#050505` | `#E4E6EB` |
| secondary text | `#65676B` | `#B0B3B8` |
| hairline | `#E4E6EB` | `#393A3B` |
| link | `#1B74E4` | `#5AA7FF` |
| buttons | 12 px rounded | same |

## 2. Sky — Twitter/X style

Pure-white canvas, near-black ink, azure accent, **stadium (fully round)
buttons**, and a "Dim" navy dark mode instead of pure black.

| Token | Light | Dark ("Dim") |
|---|---|---|
| accent | `#1D9BF0` | `#1D9BF0` |
| accent bright / dark | `#6BC9FF` / `#1A8CD8` | — |
| canvas | `#FFFFFF` | `#15202B` |
| card | `#FFFFFF` | `#1E2732` |
| input/pill fill | `#EFF3F4` (search-pill gray) | `#273340` |
| text | `#0F1419` | `#F7F9F9` |
| secondary text | `#536471` | `#8B98A5` |
| hairline | `#E1E8ED` | `#38444D` |
| link | `#1D9BF0` | `#1D9BF0` |
| buttons | stadium (fully round) | same |

## 3. Liberty — Truth style

Violet accent on an airy off-white canvas; deep-navy dark mode; gold stays
reserved for badges/awards.

| Token | Light | Dark |
|---|---|---|
| accent | `#5448EE` | `#8F86FF` |
| accent bright / dark | `#7A6FF3` / `#3F35C4` | — |
| canvas | `#F7F8FC` | `#10122B` (deep navy) |
| card | `#FFFFFF` | `#191C3A` |
| input/pill fill | `#EEF0F8` | `#242850` |
| text | `#16182D` | `#ECEEF8` |
| secondary text | `#6A6F85` | `#9BA0BC` |
| hairline | `#E3E6F0` | `#2E325A` |
| link | `#5448EE` | `#9C94FF` |
| buttons | 14 px rounded | same |

## 4. Tactical — military use

Army-olive accent, khaki canvas, sage highlights, **angular 8 px corners (no
pills)**, and a "night-ops" near-black-green dark mode. Alert red and amber
(`GwColors.live` / `gold`) read as warning colors on this palette.

| Token | Light | Dark ("night ops") |
|---|---|---|
| accent | `#4B5320` (olive drab) | `#A8B860` |
| accent bright / dark | `#8A9A5B` (sage) / `#33390F` | — |
| canvas | `#E8EADF` (khaki) | `#0B0E09` |
| card | `#F4F5EC` | `#141910` |
| input/pill fill | `#DDE0CE` | `#1F2617` |
| text | `#1B2114` | `#D8DEC8` |
| secondary text | `#56604A` | `#93A184` |
| hairline | `#C9CDB6` | `#2A3220` |
| link | `#6B8E23` | `#A8B860` |
| buttons | 8 px angular | same |

## Adding a skin

1. Add a `GwSkin` const to `GwSkins` in `mobile/lib/core/skins.dart` and list
   it in `GwSkins.all` (unique `id` — it's the persisted key).
2. Nothing else: the Settings picker, theme builders and `*Of()` helpers all
   iterate/resolve through `GwSkins`.

Rules of thumb when picking tokens: keep text/canvas contrast ≥ WCAG AA
(4.5:1), give dark mode a *tinted* near-black rather than `#000`, and make the
input fill one visible step off the card color so fields read as fields.
