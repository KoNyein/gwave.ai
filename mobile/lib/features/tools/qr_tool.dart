import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';

/// QR code generator (Tools hub). Type any text/URL/phone/Wi-Fi string and it
/// renders a scannable QR live; quick-format chips prefill URL / phone / SMS /
/// Wi-Fi templates. All on-device — no network, works offline.
class QrTool extends StatefulWidget {
  const QrTool();

  @override
  State<QrTool> createState() => QrToolState();
}

enum _QrKind { text, url, phone, sms, wifi }

class QrToolState extends State<QrTool> {
  _QrKind _kind = _QrKind.text;
  final _main = TextEditingController();
  final _extra = TextEditingController(); // SMS body / Wi-Fi password

  String get _data {
    final v = _main.text.trim();
    if (v.isEmpty) return "";
    switch (_kind) {
      case _QrKind.text:
        return v;
      case _QrKind.url:
        return v.contains("://") ? v : "https://$v";
      case _QrKind.phone:
        return "tel:$v";
      case _QrKind.sms:
        return "smsto:$v:${_extra.text.trim()}";
      case _QrKind.wifi:
        // WIFI:T:WPA;S:<ssid>;P:<password>;;
        return "WIFI:T:WPA;S:$v;P:${_extra.text.trim()};;";
    }
  }

  @override
  void dispose() {
    _main.dispose();
    _extra.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = _data;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final k in _QrKind.values)
              ChoiceChip(
                selected: _kind == k,
                onSelected: (_) => setState(() => _kind = k),
                label: Text(switch (k) {
                  _QrKind.text => tr(context, "Text", "စာသား"),
                  _QrKind.url => "URL",
                  _QrKind.phone => tr(context, "Phone", "ဖုန်း"),
                  _QrKind.sms => "SMS",
                  _QrKind.wifi => "Wi-Fi",
                }),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _main,
          onChanged: (_) => setState(() {}),
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: switch (_kind) {
              _QrKind.text => tr(context, "Text", "စာသား"),
              _QrKind.url => "https://…",
              _QrKind.phone => tr(context, "Phone number", "ဖုန်းနံပါတ်"),
              _QrKind.sms => tr(context, "SMS number", "SMS နံပါတ်"),
              _QrKind.wifi => tr(context, "Wi-Fi name (SSID)", "Wi-Fi နာမည်"),
            },
          ),
        ),
        if (_kind == _QrKind.sms || _kind == _QrKind.wifi) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _extra,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: _kind == _QrKind.sms
                  ? tr(context, "Message", "စာသား")
                  : tr(context, "Wi-Fi password", "Wi-Fi စကားဝှက်"),
            ),
          ),
        ],
        const SizedBox(height: 18),
        if (data.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Text(
                tr(context, "Type something to make a QR code",
                    "QR ထုတ်ရန် စာတစ်ခုခု ရိုက်ထည့်ပါ"),
                style: TextStyle(color: GwColors.inkSoftOf(context)),
              ),
            ),
          )
        else ...[
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: QrImageView(
                data: data,
                size: 240,
                backgroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: data));
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(
                            tr(context, "Copied", "ကူးပြီးပါပြီ"))));
                  },
                  icon: const Icon(Icons.copy, size: 18),
                  label: Text(tr(context, "Copy data", "ဒေတာ ကူးမည်")),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => Share.share(data),
                  icon: const Icon(Icons.ios_share, size: 18),
                  label: Text(tr(context, "Share", "မျှဝေ")),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
