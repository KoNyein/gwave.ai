import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';

/// G-Pay QR — two modes in one screen:
///  • **Scan**: camera scanner that reads a payment QR (`gpay:<number>`, or a
///    bare number) and pops it back so the wallet opens Send pre-filled.
///  • **My QR**: the member's own `gpay:<number>` QR (same format the web
///    Receive panel renders) for others to scan and pay them.
class GpayScanScreen extends StatefulWidget {
  const GpayScanScreen({super.key, required this.account});
  final GpayAccount account;

  @override
  State<GpayScanScreen> createState() => _GpayScanScreenState();
}

class _GpayScanScreenState extends State<GpayScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _showMyQr = false;
  bool _handled = false; // one pop per visit, however fast frames arrive
  bool _torch = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Extract a G-Pay number from a scanned code. Accepts the canonical
  /// `gpay:<number>` payload and, as a convenience, a bare phone-looking
  /// string. Anything else is ignored so random QRs don't trigger a send.
  String? _parse(String? raw) {
    if (raw == null) return null;
    var v = raw.trim();
    if (v.toLowerCase().startsWith("gpay:")) {
      v = v.substring(5).trim();
    } else if (!RegExp(r"^\+?[0-9]{5,20}$").hasMatch(v)) {
      return null;
    }
    return RegExp(r"^\+?[0-9]{5,20}$").hasMatch(v) ? v : null;
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final phone = _parse(barcode.rawValue);
      if (phone != null) {
        _handled = true;
        Navigator.of(context).pop(phone);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.darkBg,
      appBar: AppBar(
        backgroundColor: GwColors.darkBg,
        foregroundColor: Colors.white,
        title: Text(_showMyQr ? tr(context, "My QR", "ကျွန်ုပ် QR") : tr(context, "Scan to pay", "Scan ဖတ်ပြီး ပေးမည်")),
        titleTextStyle: const TextStyle(
          color: Colors.white,
          fontSize: 20,
          fontWeight: FontWeight.w800,
        ),
        actions: [
          if (!_showMyQr)
            IconButton(
              icon: Icon(_torch ? Icons.flash_on : Icons.flash_off),
              onPressed: () async {
                await _controller.toggleTorch();
                setState(() => _torch = !_torch);
              },
            ),
        ],
      ),
      body: Column(
        children: [
          Expanded(child: _showMyQr ? _myQr() : _scanner()),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: _modeButton(tr(context, "Scan", "Scan"), Icons.qr_code_scanner, !_showMyQr,
                        () => setState(() => _showMyQr = false)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _modeButton(tr(context, "My QR", "ကျွန်ုပ် QR"), Icons.qr_code_2, _showMyQr,
                        () => setState(() => _showMyQr = true)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scanner() {
    return Stack(
      fit: StackFit.expand,
      children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error, child) => Center(
            child: Padding(
              padding: const EdgeInsets.all(30),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.no_photography_outlined,
                      color: Colors.white54, size: 52),
                  const SizedBox(height: 14),
                  Text(
                    tr(context, "Camera unavailable", "ကင်မရာ ဖွင့်လို့မရပါ"),
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    tr(context, "Allow Gwave to use the camera in Settings, then retry.", "Settings ထဲမှာ Gwave ကို Camera ခွင့်ပြုပြီး ပြန်စမ်းပါ။"),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Viewfinder frame + hint
        IgnorePointer(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 240,
                  height: 240,
                  decoration: BoxDecoration(
                    border: Border.all(color: GwColors.primaryBright, width: 3),
                    borderRadius: BorderRadius.circular(24),
                  ),
                ),
                const SizedBox(height: 18),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    tr(context, "Aim the G-Pay QR inside the frame",
                        "G-Pay QR ကို ဘောင်ထဲ ချိန်ပါ"),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _myQr() {
    final phone = widget.account.phone ?? "";
    return Center(
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(GwRadius.lg),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (phone.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(tr(context, "No G-Pay number yet",
                    "G-Pay နံပါတ် မရှိသေးပါ")),
              )
            else ...[
              QrImageView(
                data: "gpay:$phone",
                version: QrVersions.auto,
                size: 230,
                backgroundColor: Colors.white,
              ),
              const SizedBox(height: 14),
              Text(
                widget.account.fullName ?? "G-Pay",
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 2),
              Text(phone,
                  style: TextStyle(
                      color: GwColors.inkSoft,
                      fontWeight: FontWeight.w600,
                      fontSize: 14)),
              const SizedBox(height: 10),
              Text(
                tr(context, "Let others scan this QR to pay you",
                    "ဒီ QR ကို scan ခိုင်းပြီး ငွေလက်ခံပါ"),
                style:
                    TextStyle(color: GwColors.inkSoft, fontSize: 12.5),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _modeButton(
      String label, IconData icon, bool active, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.md),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: active
              ? GwColors.primary
              : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(GwRadius.md),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: active ? GwColors.onPrimary : Colors.white, size: 19),
            const SizedBox(width: 8),
            Text(label,
                style: TextStyle(
                    color: active ? GwColors.onPrimary : Colors.white,
                    fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
