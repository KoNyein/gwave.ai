import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme.dart';

/// Native agriculture calculators — pure on-device math, so they work offline.
/// A chip selector switches between calculators; each renders its own inputs
/// and a live result card.
class ToolsScreen extends StatefulWidget {
  const ToolsScreen({super.key});

  @override
  State<ToolsScreen> createState() => _ToolsScreenState();
}

enum _Calc { ecPpm, vpd, units, currency, profit }

class _ToolsScreenState extends State<ToolsScreen> {
  _Calc _calc = _Calc.ecPpm;

  static const _labels = {
    _Calc.ecPpm: "EC ↔ PPM",
    _Calc.vpd: "VPD",
    _Calc.units: "Units",
    _Calc.currency: "Currency",
    _Calc.profit: "Profit",
  };
  static const _icons = {
    _Calc.ecPpm: Icons.bolt_outlined,
    _Calc.vpd: Icons.water_drop_outlined,
    _Calc.units: Icons.straighten_outlined,
    _Calc.currency: Icons.payments_outlined,
    _Calc.profit: Icons.trending_up,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Tools — Calculators")),
      body: Column(
        children: [
          SizedBox(
            height: 54,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              children: [
                for (final c in _Calc.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _calc == c,
                      onSelected: (_) => setState(() => _calc = c),
                      avatar: Icon(_icons[c],
                          size: 17,
                          color: _calc == c ? Colors.white : GwColors.primary),
                      label: Text(_labels[c]!),
                      labelStyle: TextStyle(
                        color: _calc == c ? Colors.white : GwColors.ink,
                        fontWeight: FontWeight.w600,
                      ),
                      selectedColor: GwColors.primary,
                      backgroundColor: GwColors.surface,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: const BorderSide(color: GwColors.line),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 30),
              child: switch (_calc) {
                _Calc.ecPpm => const _EcPpmCalc(),
                _Calc.vpd => const _VpdCalc(),
                _Calc.units => const _UnitCalc(),
                _Calc.currency => const _CurrencyCalc(),
                _Calc.profit => const _ProfitCalc(),
              },
            ),
          ),
        ],
      ),
    );
  }
}

// --- Shared building blocks ---------------------------------------------------

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    this.suffix,
    this.onChanged,
  });
  final String label;
  final TextEditingController controller;
  final String? suffix;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [
          FilteringTextInputFormatter.allow(RegExp(r"[0-9.]")),
        ],
        onChanged: onChanged,
        decoration: InputDecoration(
          labelText: label,
          suffixText: suffix,
          filled: true,
          fillColor: GwColors.surface,
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.rows});
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: GwColors.primaryGradient,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final r in rows) ...[
            Text(r.$1,
                style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
            const SizedBox(height: 2),
            Text(r.$2,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900)),
            if (r != rows.last) const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

String _fmt(double v, {int dp = 2}) {
  if (v.isNaN || v.isInfinite) return "—";
  return v.toStringAsFixed(dp);
}

double _d(TextEditingController c) => double.tryParse(c.text.trim()) ?? 0;

// --- EC ↔ PPM -----------------------------------------------------------------

class _EcPpmCalc extends StatefulWidget {
  const _EcPpmCalc();
  @override
  State<_EcPpmCalc> createState() => _EcPpmCalcState();
}

class _EcPpmCalcState extends State<_EcPpmCalc> {
  final _ec = TextEditingController(text: "2.0");
  int _factor = 500;

  @override
  void dispose() {
    _ec.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ec = _d(_ec);
    final ppm = ec * _factor;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Hint("Convert EC (mS/cm) to PPM. Pick your meter's scale."),
        _Field(
            label: "EC",
            controller: _ec,
            suffix: "mS/cm",
            onChanged: (_) => setState(() {})),
        Row(
          children: [
            for (final f in [500, 700])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  selected: _factor == f,
                  onSelected: (_) => setState(() => _factor = f),
                  label: Text("×$f scale"),
                  selectedColor: GwColors.primary.withValues(alpha: 0.15),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        _ResultCard(rows: [
          ("PPM (×$_factor)", _fmt(ppm, dp: 0)),
          ("PPM (×500 / ×700)", "${_fmt(ec * 500, dp: 0)} / ${_fmt(ec * 700, dp: 0)}"),
        ]),
      ],
    );
  }
}

// --- VPD ----------------------------------------------------------------------

class _VpdCalc extends StatefulWidget {
  const _VpdCalc();
  @override
  State<_VpdCalc> createState() => _VpdCalcState();
}

class _VpdCalcState extends State<_VpdCalc> {
  final _air = TextEditingController(text: "26");
  final _leaf = TextEditingController(text: "24");
  final _rh = TextEditingController(text: "60");

  @override
  void dispose() {
    _air.dispose();
    _leaf.dispose();
    _rh.dispose();
    super.dispose();
  }

  double _svp(double t) => 0.61078 * math.exp(17.27 * t / (t + 237.3));

  @override
  Widget build(BuildContext context) {
    final air = _d(_air), leaf = _d(_leaf), rh = _d(_rh);
    final avp = _svp(air) * (rh / 100);
    final vpd = _svp(leaf) - avp;
    final band = vpd < 0.4
        ? "Too humid"
        : vpd < 0.8
            ? "Propagation / early veg"
            : vpd < 1.2
                ? "Late veg / early flower"
                : vpd < 1.6
                    ? "Mid–late flower"
                    : "Too dry (stress)";
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Hint("Vapour Pressure Deficit from air/leaf temp and humidity."),
        _Field(label: "Air temp", controller: _air, suffix: "°C", onChanged: (_) => setState(() {})),
        _Field(label: "Leaf temp", controller: _leaf, suffix: "°C", onChanged: (_) => setState(() {})),
        _Field(label: "Humidity", controller: _rh, suffix: "%", onChanged: (_) => setState(() {})),
        _ResultCard(rows: [
          ("VPD", "${_fmt(vpd)} kPa"),
          ("Zone", band),
        ]),
      ],
    );
  }
}

// --- Units --------------------------------------------------------------------

class _UnitCalc extends StatefulWidget {
  const _UnitCalc();
  @override
  State<_UnitCalc> createState() => _UnitCalcState();
}

class _UnitCalcState extends State<_UnitCalc> {
  final _val = TextEditingController(text: "1");

  @override
  void dispose() {
    _val.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final v = _d(_val);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Hint("Common weight & temperature conversions."),
        _Field(label: "Value", controller: _val, onChanged: (_) => setState(() {})),
        _ResultCard(rows: [
          ("$v kg → lb", _fmt(v * 2.20462)),
          ("$v lb → kg", _fmt(v / 2.20462)),
          ("$v g → oz", _fmt(v * 0.035274)),
          ("$v °C → °F", _fmt(v * 9 / 5 + 32, dp: 1)),
        ]),
      ],
    );
  }
}

// --- Currency -----------------------------------------------------------------

class _CurrencyCalc extends StatefulWidget {
  const _CurrencyCalc();
  @override
  State<_CurrencyCalc> createState() => _CurrencyCalcState();
}

class _CurrencyCalcState extends State<_CurrencyCalc> {
  final _amount = TextEditingController(text: "100");
  // Editable approximate rates → 1 unit = X MMK.
  final _usd = TextEditingController(text: "4500");
  final _thb = TextEditingController(text: "125");

  @override
  void dispose() {
    _amount.dispose();
    _usd.dispose();
    _thb.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final usd = _d(_amount);
    final mmk = usd * _d(_usd);
    final thb = mmk / (_d(_thb) == 0 ? 1 : _d(_thb));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Hint("Edit the rates to match today's market."),
        _Field(label: "Amount (USD)", controller: _amount, onChanged: (_) => setState(() {})),
        Row(
          children: [
            Expanded(
                child: _Field(label: "1 USD = MMK", controller: _usd, onChanged: (_) => setState(() {}))),
            const SizedBox(width: 12),
            Expanded(
                child: _Field(label: "1 THB = MMK", controller: _thb, onChanged: (_) => setState(() {}))),
          ],
        ),
        _ResultCard(rows: [
          ("$usd USD → MMK", _fmt(mmk, dp: 0)),
          ("$usd USD → THB", _fmt(thb, dp: 0)),
        ]),
      ],
    );
  }
}

// --- Profit -------------------------------------------------------------------

class _ProfitCalc extends StatefulWidget {
  const _ProfitCalc();
  @override
  State<_ProfitCalc> createState() => _ProfitCalcState();
}

class _ProfitCalcState extends State<_ProfitCalc> {
  final _revenue = TextEditingController(text: "500000");
  final _cost = TextEditingController(text: "320000");

  @override
  void dispose() {
    _revenue.dispose();
    _cost.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rev = _d(_revenue), cost = _d(_cost);
    final profit = rev - cost;
    final margin = rev == 0 ? 0.0 : profit / rev * 100;
    final markup = cost == 0 ? 0.0 : profit / cost * 100;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _Hint("Profit, margin and markup for a crop or sale."),
        _Field(label: "Revenue", controller: _revenue, suffix: "Ks", onChanged: (_) => setState(() {})),
        _Field(label: "Cost", controller: _cost, suffix: "Ks", onChanged: (_) => setState(() {})),
        _ResultCard(rows: [
          ("Profit", "${_fmt(profit, dp: 0)} Ks"),
          ("Margin / Markup", "${_fmt(margin, dp: 1)}% / ${_fmt(markup, dp: 1)}%"),
        ]),
      ],
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 6, bottom: 14),
        child: Text(text,
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 13)),
      );
}
