import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../core/i18n.dart';
import '../core/theme.dart';

/// One reusable "share this" sheet for posts, reels, lives and videos.
/// Offers: system share, copy link, a scannable QR code of the link, and
/// writing the link to an NFC tag (tap-to-open). Any surface with a shareable
/// gwave.cc URL can call [showShareSheet].
Future<void> showShareSheet(
  BuildContext context, {
  required String url,
  String? title,
  String? message,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: GwColors.surfaceOf(context),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
    ),
    builder: (_) => _ShareSheet(url: url, title: title, message: message),
  );
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({required this.url, this.title, this.message});
  final String url;
  final String? title;
  final String? message;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  bool _showQr = false;
  String? _nfcStatus;

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.url));
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Link copied", "လင့်ခ် ကူးပြီးပါပြီ"))));
  }

  void _system() {
    final body = widget.message?.trim().isNotEmpty == true
        ? "${widget.message}\n\n${widget.url}"
        : widget.url;
    Share.share(body, subject: widget.title);
  }

  Future<void> _nfc() async {
    bool ok = false;
    try {
      ok = await NfcManager.instance.isAvailable();
    } catch (_) {}
    if (!ok) {
      setState(() => _nfcStatus = tr(context,
          "NFC is off or not supported on this phone.",
          "ဒီဖုန်းမှာ NFC ပိတ်ထား/မပါပါ။"));
      return;
    }
    setState(() => _nfcStatus = tr(context,
        "Hold a writable NFC tag against the phone…",
        "ရေးလို့ရတဲ့ NFC tag ကို ဖုန်းနောက်ကျောမှာ ကပ်ထားပါ…"));
    NfcManager.instance.startSession(onDiscovered: (tag) async {
      try {
        final ndef = Ndef.from(tag);
        if (ndef == null || !ndef.isWritable) {
          throw Exception(tr(context, "This tag can't be written.",
              "ဒီ tag ကို ရေးလို့ မရပါ။"));
        }
        // A URI record makes any phone open the link on tap.
        await ndef.write(NdefMessage([NdefRecord.createUri(Uri.parse(widget.url))]));
        if (mounted) {
          setState(() => _nfcStatus = tr(context,
              "✓ Tag written — tap it to open this link",
              "✓ Tag ရေးပြီးပါပြီ — ကပ်ရုံနဲ့ ဒီလင့်ခ် ပွင့်မယ်"));
        }
      } catch (e) {
        if (mounted) setState(() => _nfcStatus = "$e");
      } finally {
        await NfcManager.instance.stopSession().catchError((_) {});
      }
    });
  }

  @override
  void dispose() {
    NfcManager.instance.stopSession().catchError((_) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Text(
                widget.title?.trim().isNotEmpty == true
                    ? widget.title!
                    : tr(context, "Share", "မျှဝေရန်"),
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(height: 14),
            if (_showQr) ...[
              Center(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: QrImageView(
                    data: widget.url,
                    size: 220,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Center(
                child: Text(
                  tr(context, "Scan to open", "ဖတ်ရန် scan လုပ်ပါ"),
                  style: TextStyle(
                      fontSize: 12, color: GwColors.inkSoftOf(context)),
                ),
              ),
              const SizedBox(height: 10),
            ],
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _tile(Icons.ios_share, tr(context, "Share", "မျှဝေ"), _system),
                _tile(Icons.link, tr(context, "Copy", "ကူးမည်"), _copy),
                _tile(
                    _showQr ? Icons.qr_code_2 : Icons.qr_code,
                    "QR",
                    () => setState(() => _showQr = !_showQr),
                    active: _showQr),
                _tile(Icons.nfc, "NFC", _nfc),
              ],
            ),
            if (_nfcStatus != null) ...[
              const SizedBox(height: 12),
              Text(_nfcStatus!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12.5)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback onTap,
      {bool active = false}) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: active
                    ? GwColors.primary
                    : GwColors.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(icon,
                  color: active ? Colors.white : GwColors.primary, size: 22),
            ),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
