import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import 'drone_signatures.dart';

/// Browsable "Signal library": the whole reference database of drone/controller
/// signatures and RC radio links, with a clear detectable / not-detectable
/// badge on each — so the user can learn the landscape and understand what the
/// live radar can and cannot see.
class DroneLibraryScreen extends StatefulWidget {
  const DroneLibraryScreen({super.key});

  @override
  State<DroneLibraryScreen> createState() => _DroneLibraryScreenState();
}

class _DroneLibraryScreenState extends State<DroneLibraryScreen> {
  String _q = "";

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final devices = kDroneSignatures.where((s) {
      if (q.isEmpty) return true;
      return s.title.toLowerCase().contains(q) ||
          s.protocol.toLowerCase().contains(q) ||
          s.patterns.any((p) => p.contains(q));
    }).toList();
    final protocols = kRfProtocols.where((p) {
      if (q.isEmpty) return true;
      return p.name.toLowerCase().contains(q) ||
          p.bands.toLowerCase().contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(tr(context, "Signal library", "Signal စာကြည့်တိုက်")),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
            child: TextField(
              style: const TextStyle(color: Colors.white),
              onChanged: (v) => setState(() => _q = v),
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white.withValues(alpha: 0.06),
                prefixIcon: const Icon(Icons.search, color: Colors.white54),
                hintText: tr(context, "Search DJI, ELRS, Tello…",
                    "DJI, ELRS, Tello… ရှာရန်"),
                hintStyle: const TextStyle(color: Colors.white38),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 6, 14, 30),
              children: [
                _header(tr(context, "Drones & controllers", "ဒရုန်း & ကွန်ထရိုလာ"),
                    devices.length),
                for (final s in devices) _deviceCard(s),
                const SizedBox(height: 18),
                _header(tr(context, "Radio links & protocols",
                    "လှိုင်း link & protocol များ"), protocols.length),
                for (final p in protocols) _protocolCard(p),
                const SizedBox(height: 16),
                Text(
                  tr(context,
                      "“Detectable” means a normal phone (Wi-Fi + Bluetooth) can sense it. The rest need an external SDR receiver.",
                      "“ဖမ်းနိုင်” ဆိုသည်မှာ သာမန်ဖုန်း (Wi-Fi + Bluetooth) က တွေ့နိုင်ခြင်း။ ကျန်တာတွေက SDR receiver အပို လိုသည်။"),
                  style: const TextStyle(color: Colors.white38, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _header(String title, int count) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Row(
          children: [
            Text(title,
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16)),
            const SizedBox(width: 8),
            Text("$count",
                style: const TextStyle(color: Colors.white38, fontSize: 13)),
          ],
        ),
      );

  Widget _detectBadge(bool ok) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: (ok ? const Color(0xFF2E9E5B) : const Color(0xFFE23B54))
              .withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(ok ? Icons.check_circle : Icons.block,
                size: 13,
                color: ok ? const Color(0xFF7ED957) : const Color(0xFFE23B54)),
            const SizedBox(width: 4),
            Text(
                ok
                    ? tr(context, "Detectable", "ဖမ်းနိုင်")
                    : tr(context, "Needs SDR", "SDR လို"),
                style: TextStyle(
                    color:
                        ok ? const Color(0xFF7ED957) : const Color(0xFFE23B54),
                    fontSize: 11,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      );

  IconData _icon(DroneKind k) {
    switch (k) {
      case DroneKind.controller:
        return Icons.sports_esports;
      case DroneKind.goggles:
        return Icons.visibility;
      case DroneKind.drone:
      case DroneKind.remoteId:
        return Icons.airplanemode_active;
      case DroneKind.unknown:
        return Icons.memory;
    }
  }

  Widget _deviceCard(DroneSignature s) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_icon(s.kind), color: Colors.white70, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(s.title,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5)),
                ),
                _detectBadge(s.detectable),
              ],
            ),
            const SizedBox(height: 6),
            Text("${s.protocol}  ·  ${s.band}",
                style: const TextStyle(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 4),
            Text(tr(context, s.noteEn, s.noteMy),
                style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ),
      );

  Widget _protocolCard(RfProtocol p) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.podcasts, color: Colors.white70, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(p.name,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14.5)),
                ),
                _detectBadge(p.detectable),
              ],
            ),
            const SizedBox(height: 6),
            Text("${p.bands}  ·  ${p.freq}",
                style: const TextStyle(color: Colors.white54, fontSize: 12)),
            const SizedBox(height: 4),
            Text(tr(context, p.descEn, p.descMy),
                style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ),
      );
}
