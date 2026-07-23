import 'package:flutter/material.dart';

import '../core/theme.dart';

/// A tiny dependency-free line chart. Plots [values] left→right, auto-scaling to
/// their min/max, with an optional soft fill under the line. Used for sensor
/// history on the Farm device detail screen.
class Sparkline extends StatelessWidget {
  const Sparkline({
    super.key,
    required this.values,
    this.color = GwColors.primary,
    this.height = 64,
    this.fill = true,
    this.strokeWidth = 2,
  });

  final List<double> values;
  final Color color;
  final double height;
  final bool fill;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparkPainter(values, color, fill, strokeWidth),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color, this.fill, this.strokeWidth);

  final List<double> values;
  final Color color;
  final bool fill;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) {
      // A single point: draw a flat mid-line so the tile isn't blank.
      final y = size.height / 2;
      canvas.drawLine(
        Offset(0, y),
        Offset(size.width, y),
        Paint()
          ..color = color.withValues(alpha: 0.5)
          ..strokeWidth = strokeWidth,
      );
      return;
    }

    var min = values.first;
    var max = values.first;
    for (final v in values) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    final range = (max - min).abs() < 1e-9 ? 1.0 : (max - min);
    final dx = size.width / (values.length - 1);

    Offset pointAt(int i) {
      final norm = (values[i] - min) / range;
      // Leave a little vertical padding so the line doesn't touch the edges.
      final y = size.height * (1 - norm) * 0.86 + size.height * 0.07;
      return Offset(dx * i, y);
    }

    final path = Path()..moveTo(pointAt(0).dx, pointAt(0).dy);
    for (var i = 1; i < values.length; i++) {
      final p = pointAt(i);
      path.lineTo(p.dx, p.dy);
    }

    if (fill) {
      final fillPath = Path.from(path)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(
        fillPath,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [color.withValues(alpha: 0.22), color.withValues(alpha: 0)],
          ).createShader(Offset.zero & size),
      );
    }

    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );

    // Last point marker.
    final last = pointAt(values.length - 1);
    canvas.drawCircle(last, strokeWidth + 1.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.values != values || old.color != color;
}
