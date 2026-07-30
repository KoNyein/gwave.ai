import 'package:flutter/material.dart';

import '../core/theme.dart';

/// A shared signal-strength indicator used by every scan screen (WiFi map,
/// drone radar, Bluetooth finder) so signal reads the same everywhere.
///
/// RSSI in dBm maps to a 0..1 quality: −40 dBm ≈ full, −95 dBm ≈ empty.
/// Green ≥ 66%, amber ≥ 33%, grey below — the universal near/mid/far read.

double signalQuality(int rssi) => ((rssi + 100) / 60).clamp(0.0, 1.0);

Color signalColor(double q, BuildContext context) => q > 0.66
    ? const Color(0xFF2E9E5B)
    : q > 0.33
        ? const Color(0xFFF0B429)
        : GwColors.inkSoftOf(context);

/// Four rising bars (cellular-style). Compact — for list-row trailings.
class SignalBars extends StatelessWidget {
  const SignalBars({super.key, required this.rssi, this.size = 16});

  final int rssi;
  final double size;

  @override
  Widget build(BuildContext context) {
    final q = signalQuality(rssi);
    final color = signalColor(q, context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (var b = 0; b < 4; b++)
          Padding(
            padding: const EdgeInsets.only(left: 2),
            child: Container(
              width: size * 0.24,
              height: size * (0.35 + b * 0.22),
              decoration: BoxDecoration(
                color: q * 4 > b
                    ? color
                    : GwColors.inkSoftOf(context).withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
      ],
    );
  }
}

/// A labelled horizontal strength bar + dBm read — for detail rows.
class SignalStrengthBar extends StatelessWidget {
  const SignalStrengthBar({
    super.key,
    required this.rssi,
    this.showDbm = true,
  });

  final int rssi;
  final bool showDbm;

  String _label(BuildContext context, double q) {
    if (q >= 0.75) return "Excellent";
    if (q >= 0.5) return "Good";
    if (q >= 0.25) return "Fair";
    return "Weak";
  }

  @override
  Widget build(BuildContext context) {
    final q = signalQuality(rssi);
    final color = signalColor(q, context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(_label(context, q),
                style: TextStyle(
                    color: color,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700)),
            const Spacer(),
            if (showDbm)
              Text("$rssi dBm",
                  style: TextStyle(
                      fontSize: 11.5, color: GwColors.inkSoftOf(context))),
          ],
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: q,
            minHeight: 6,
            backgroundColor: GwColors.surfaceMutedOf(context),
            color: color,
          ),
        ),
      ],
    );
  }
}
