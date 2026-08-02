import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'health_store.dart';

/// Build and hand off a doctor-facing PDF health report. Only the sections the
/// user enabled in [ReportPrefs] are included, so they can leave out anything
/// they'd rather not share. Opens the Android print/share sheet (save as PDF,
/// print, or send to a doctor).
Future<void> exportHealthReport({String? patientName}) async {
  final prefs = await HealthStore.reportPrefs();
  final medId = await HealthStore.medicalId();
  final vitals = await HealthStore.vitals();
  final cycles = await HealthStore.cycles();
  final meds = await HealthStore.meds();

  final fontData = await rootBundle.load("assets/Padauk-Regular.ttf");
  final font = pw.Font.ttf(fontData);
  final h1 = pw.TextStyle(
      font: font, fontSize: 18, fontWeight: pw.FontWeight.bold);
  final h2 = pw.TextStyle(
      font: font, fontSize: 13, fontWeight: pw.FontWeight.bold);
  final normal = pw.TextStyle(font: font, fontSize: 10.5);
  final muted =
      pw.TextStyle(font: font, fontSize: 9, color: PdfColors.grey600);

  final df = DateFormat("MMM d, yyyy");
  final dfTime = DateFormat("MMM d, yyyy h:mm a");
  final now = DateTime.now();

  pw.Widget kv(String k, String? v) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 3),
        child: pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.SizedBox(
                width: 120,
                child: pw.Text(k,
                    style: pw.TextStyle(
                        font: font,
                        fontSize: 10.5,
                        color: PdfColors.grey700))),
            pw.Expanded(
                child: pw.Text(v == null || v.isEmpty ? "—" : v,
                    style: normal)),
          ],
        ),
      );

  pw.Widget section(String title, List<pw.Widget> children) => pw.Container(
        margin: const pw.EdgeInsets.only(bottom: 16),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(title, style: h2),
            pw.Divider(color: PdfColors.grey400, height: 10),
            ...children,
          ],
        ),
      );

  final doc = pw.Document();
  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (ctx) {
        final body = <pw.Widget>[];

        // Header
        body.add(pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text("Health Report", style: h1),
              pw.Text(patientName ?? medId.fullName ?? "Gwave user",
                  style: normal),
            ]),
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Text("Gwave Health", style: h2),
              pw.Text("Generated ${dfTime.format(now)}", style: muted),
            ]),
          ],
        ));
        body.add(pw.SizedBox(height: 16));

        // Medical ID
        if (prefs.medicalId) {
          body.add(section("Medical ID", [
            kv("Blood type", medId.bloodType),
            kv("Date of birth", medId.dob != null ? df.format(medId.dob!) : null),
            kv("Allergies", medId.allergies),
            kv("Conditions", medId.conditions),
            kv("Current medications", medId.medications),
            kv("Organ donor", medId.organDonor ? "Yes" : "No"),
            kv("Emergency contact",
                [medId.emergencyName, medId.emergencyPhone]
                    .where((e) => e != null && e.isNotEmpty)
                    .join(" · ")),
            if (medId.notes != null && medId.notes!.isNotEmpty)
              kv("Notes", medId.notes),
          ]));
        }

        // Vitals — latest per type + recent history table
        if (prefs.vitals && vitals.isNotEmpty) {
          final latest = <String, VitalReading>{};
          for (final r in vitals) {
            latest.putIfAbsent(r.type, () => r);
          }
          final summary = <pw.Widget>[];
          for (final t in VitalType.all) {
            final r = latest[t.key];
            if (r != null) {
              summary.add(kv(t.en, "${r.display} ${t.unit}  (${df.format(r.at)})"));
            }
          }
          final recent = vitals.take(20).toList();
          summary.add(pw.SizedBox(height: 8));
          summary.add(pw.Text("Recent readings", style: muted));
          summary.add(pw.SizedBox(height: 4));
          summary.add(
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
              columnWidths: {
                0: const pw.FlexColumnWidth(2),
                1: const pw.FlexColumnWidth(2),
                2: const pw.FlexColumnWidth(3),
              },
              children: [
                pw.TableRow(
                  decoration:
                      const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    _cell("Vital", font, bold: true),
                    _cell("Value", font, bold: true),
                    _cell("When", font, bold: true),
                  ],
                ),
                for (final r in recent)
                  pw.TableRow(children: [
                    _cell(VitalType.byKey(r.type).en, font),
                    _cell("${r.display} ${VitalType.byKey(r.type).unit}", font),
                    _cell(dfTime.format(r.at), font),
                  ]),
              ],
            ),
          );
          body.add(section("Vitals", summary));
        }

        // Cycle
        if (prefs.cycle && cycles.isNotEmpty) {
          final children = <pw.Widget>[];
          for (final c in cycles.take(12)) {
            children.add(kv("Period start", df.format(c.start)));
          }
          body.add(section("Menstrual cycle", children));
        }

        // Medications
        if (prefs.medications && meds.isNotEmpty) {
          final children = <pw.Widget>[];
          for (final m in meds) {
            final times = m.times.isEmpty ? "" : " · ${m.times.join(", ")}";
            children.add(kv(m.name, "${m.dose ?? ""}$times".trim()));
          }
          body.add(section("Medications", children));
        }

        body.add(pw.SizedBox(height: 10));
        body.add(pw.Text(
          "This report was self-recorded in the Gwave app for informational "
          "purposes and is not a medical diagnosis.",
          style: muted,
        ));
        return body;
      },
    ),
  );

  await Printing.layoutPdf(
    onLayout: (format) => doc.save(),
    name: "gwave-health-report",
  );
}

pw.Widget _cell(String text, pw.Font font, {bool bold = false}) => pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: pw.Text(text,
          style: pw.TextStyle(
              font: font,
              fontSize: 9,
              fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal)),
    );
