import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nfc_manager/nfc_manager.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';

/// NFC read/write toolbox (Tools hub). All on-device via nfc_manager:
///  - Read: NDEF records (text/URI/MIME/external) decoded + tag hardware info
///    (UID, tech list, NDEF capacity, writable/locked).
///  - Write: text / URL / phone / SMS / plain payloads; overwrite-aware.
///  - Erase: writes an empty NDEF message.
///  - Lock: makes the tag permanently read-only (guarded by a confirm dialog).
/// Availability is checked up front so phones without NFC (or with it turned
/// off) get guidance instead of a dead screen.
class NfcToolBody extends StatefulWidget {
  const NfcToolBody({super.key});

  @override
  State<NfcToolBody> createState() => _NfcToolBodyState();
}

enum _WriteKind { text, url, phone, sms }

class _NfcToolBodyState extends State<NfcToolBody> {
  bool? _available; // null = checking
  bool _busy = false;
  String? _status; // live instruction / result banner
  _WriteKind _writeKind = _WriteKind.text;
  final _writeCtrl = TextEditingController();
  final _writeCtrl2 = TextEditingController(); // SMS body

  // Last read result.
  final List<String> _records = [];
  String? _uid;
  String? _tech;
  String? _ndefInfo;

  @override
  void initState() {
    super.initState();
    _checkAvailable();
  }

  @override
  void dispose() {
    NfcManager.instance.stopSession().catchError((_) {});
    _writeCtrl.dispose();
    _writeCtrl2.dispose();
    super.dispose();
  }

  Future<void> _checkAvailable() async {
    bool ok = false;
    try {
      ok = await NfcManager.instance.isAvailable();
    } catch (_) {}
    if (mounted) setState(() => _available = ok);
  }

  // ---- Read -----------------------------------------------------------------

  Future<void> _read() async {
    setState(() {
      _busy = true;
      _records.clear();
      _uid = null;
      _tech = null;
      _ndefInfo = null;
      _status = tr(context, "Hold a tag against the back of the phone…",
          "Tag ကို ဖုန်းနောက်ကျောမှာ ကပ်ထားပါ…");
    });
    NfcManager.instance.startSession(onDiscovered: (tag) async {
      try {
        _uid = _uidOf(tag);
        _tech = tag.data.keys.join(", ");
        final ndef = Ndef.from(tag);
        if (ndef != null) {
          _ndefInfo =
              "${ndef.maxSize} B · ${ndef.isWritable ? tr(context, "writable", "ရေးလို့ရ") : tr(context, "read-only (locked)", "ဖတ်ရုံသာ (လော့ခ်ကျ)")}";
          final msg = ndef.cachedMessage;
          if (msg == null || msg.records.isEmpty) {
            _records.add(tr(context, "(empty tag — no NDEF records)",
                "(tag ဗလာ — NDEF record မရှိ)"));
          } else {
            for (final r in msg.records) {
              _records.add(_decodeRecord(r));
            }
          }
        } else {
          _records.add(tr(context, "(not an NDEF tag — raw hardware only)",
              "(NDEF tag မဟုတ် — hardware အချက်အလက်သာ)"));
        }
        _status = tr(context, "✓ Tag read", "✓ Tag ဖတ်ပြီးပါပြီ");
      } catch (e) {
        _status = "$e";
      } finally {
        await NfcManager.instance.stopSession().catchError((_) {});
        if (mounted) setState(() => _busy = false);
      }
    });
  }

  String _uidOf(NfcTag tag) {
    for (final tech in ["nfca", "nfcb", "nfcf", "nfcv", "isodep", "mifareclassic", "mifareultralight"]) {
      final data = tag.data[tech];
      if (data is Map && data["identifier"] is List) {
        return (data["identifier"] as List)
            .map((b) => (b as int).toRadixString(16).padLeft(2, "0"))
            .join(":")
            .toUpperCase();
      }
    }
    return "—";
  }

  /// Decode common NDEF records (RTD Text, RTD URI, MIME, external) into a
  /// human-readable line; anything else falls back to a hex/utf8 preview.
  String _decodeRecord(NdefRecord r) {
    try {
      final type = r.type;
      // Well-known Text: [status(lang len)] [lang] [text]
      if (type.length == 1 && type[0] == 0x54 && r.payload.isNotEmpty) {
        final langLen = r.payload[0] & 0x3F;
        final text = utf8.decode(r.payload.sublist(1 + langLen));
        return "📝 $text";
      }
      // Well-known URI: [prefix index] [rest]
      if (type.length == 1 && type[0] == 0x55 && r.payload.isNotEmpty) {
        const prefixes = [
          "", "http://www.", "https://www.", "http://", "https://", "tel:",
          "mailto:", "ftp://anonymous:anonymous@", "ftp://ftp.", "ftps://",
          "sftp://", "smb://", "nfs://", "ftp://", "dav://", "news:",
          "telnet://", "imap:", "rtsp://", "urn:", "pop:", "sip:", "sips:",
          "tftp:", "btspp://", "btl2cap://", "btgoep://", "tcpobex://",
          "irdaobex://", "file://", "urn:epc:id:", "urn:epc:tag:",
          "urn:epc:pat:", "urn:epc:raw:", "urn:epc:", "urn:nfc:",
        ];
        final idx = r.payload[0];
        final prefix = idx < prefixes.length ? prefixes[idx] : "";
        return "🔗 $prefix${utf8.decode(r.payload.sublist(1))}";
      }
      final typeStr = ascii.decode(type, allowInvalid: true);
      final body = utf8.decode(r.payload, allowMalformed: true);
      return "📦 $typeStr: $body";
    } catch (_) {
      return "📦 ${r.payload.length} bytes";
    }
  }

  // ---- Write / erase / lock -------------------------------------------------

  NdefMessage? _buildMessage() {
    final v = _writeCtrl.text.trim();
    if (v.isEmpty) return null;
    switch (_writeKind) {
      case _WriteKind.text:
        return NdefMessage([NdefRecord.createText(v)]);
      case _WriteKind.url:
        final uri = v.contains("://") ? v : "https://$v";
        return NdefMessage([NdefRecord.createUri(Uri.parse(uri))]);
      case _WriteKind.phone:
        return NdefMessage([NdefRecord.createUri(Uri.parse("tel:$v"))]);
      case _WriteKind.sms:
        final body = Uri.encodeComponent(_writeCtrl2.text.trim());
        return NdefMessage(
            [NdefRecord.createUri(Uri.parse("sms:$v?body=$body"))]);
    }
  }

  Future<void> _write() async {
    final msg = _buildMessage();
    if (msg == null) {
      setState(() => _status =
          tr(context, "Type something to write first.", "ရေးမယ့်စာ အရင်ထည့်ပါ။"));
      return;
    }
    await _session((ndef) async {
      if (!ndef.isWritable) {
        throw Exception(tr(context, "This tag is locked (read-only).",
            "ဒီ tag က လော့ခ်ကျနေပြီ (ဖတ်ရုံသာ)။"));
      }
      await ndef.write(msg);
      return tr(context, "✓ Written to tag", "✓ Tag ထဲ ရေးပြီးပါပြီ");
    });
  }

  Future<void> _erase() async {
    await _session((ndef) async {
      if (!ndef.isWritable) {
        throw Exception(tr(context, "This tag is locked (read-only).",
            "ဒီ tag က လော့ခ်ကျနေပြီ (ဖတ်ရုံသာ)။"));
      }
      await ndef.write(NdefMessage([NdefRecord(
        typeNameFormat: NdefTypeNameFormat.empty,
        type: Uint8List(0),
        identifier: Uint8List(0),
        payload: Uint8List(0),
      )]));
      return tr(context, "✓ Tag erased", "✓ Tag ဖျက်ပြီးပါပြီ");
    });
  }

  Future<void> _lock() async {
    final sure = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Lock tag permanently?", "Tag ကို အပြီးတိုင် လော့ခ်ချမလား?")),
        content: Text(tr(
            ctx,
            "A locked tag becomes read-only FOREVER — it can never be written again. Continue?",
            "လော့ခ်ချပြီးရင် ဒီ tag ကို ဘယ်တော့မှ ပြန်ရေးလို့ မရတော့ပါ။ ဆက်လုပ်မလား?")),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: Text(tr(ctx, "Lock forever", "အပြီးတိုင် လော့ခ်ချမည်"))),
        ],
      ),
    );
    if (sure != true) return;
    await _session((ndef) async {
      await ndef.writeLock();
      return tr(context, "✓ Tag locked (read-only)", "✓ Tag လော့ခ်ချပြီးပါပြီ");
    });
  }

  /// Shared one-shot NDEF session wrapper.
  Future<void> _session(Future<String> Function(Ndef ndef) action) async {
    setState(() {
      _busy = true;
      _status = tr(context, "Hold a tag against the back of the phone…",
          "Tag ကို ဖုန်းနောက်ကျောမှာ ကပ်ထားပါ…");
    });
    NfcManager.instance.startSession(onDiscovered: (tag) async {
      try {
        final ndef = Ndef.from(tag);
        if (ndef == null) {
          throw Exception(tr(context, "This tag doesn't support NDEF.",
              "ဒီ tag က NDEF မထောက်ပံ့ပါ။"));
        }
        final done = await action(ndef);
        _status = done;
      } catch (e) {
        _status = "$e";
      } finally {
        await NfcManager.instance.stopSession().catchError((_) {});
        if (mounted) setState(() => _busy = false);
      }
    });
  }

  void _cancel() {
    NfcManager.instance.stopSession().catchError((_) {});
    setState(() {
      _busy = false;
      _status = tr(context, "Cancelled.", "ရပ်လိုက်ပါပြီ။");
    });
  }

  // ---- UI -------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    if (_available == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_available == false) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.nfc, size: 48, color: Colors.white38),
              const SizedBox(height: 12),
              Text(
                tr(
                    context,
                    "NFC is off or not supported on this phone. Turn NFC on in system settings, then come back.",
                    "ဒီဖုန်းမှာ NFC ပိတ်ထား (သို့) မပါပါ။ ဖုန်း Settings မှာ NFC ဖွင့်ပြီး ပြန်လာပါ။"),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: _checkAvailable,
                child: Text(tr(context, "Check again", "ပြန်စစ်မည်")),
              ),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        if (_status != null)
          Card(
            color: const Color(0xFF12251A),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.nfc, color: GwColors.primary, size: 20),
                const SizedBox(width: 10),
                Expanded(child: Text(_status!)),
                if (_busy)
                  TextButton(
                      onPressed: _cancel,
                      child: Text(tr(context, "Stop", "ရပ်မည်"))),
              ]),
            ),
          ),
        // ---- READ ----
        Text(tr(context, "Read a tag", "Tag ဖတ်ရန်"),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _busy ? null : _read,
          icon: const Icon(Icons.wifi_tethering),
          label: Text(tr(context, "Scan tag", "Tag စကင်ဖတ်မည်")),
        ),
        if (_uid != null) ...[
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _kv("UID", _uid!),
                  if (_tech != null) _kv("Tech", _tech!),
                  if (_ndefInfo != null) _kv("NDEF", _ndefInfo!),
                  const Divider(),
                  for (final rec in _records)
                    InkWell(
                      onLongPress: () {
                        Clipboard.setData(ClipboardData(text: rec));
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                            content:
                                Text(tr(context, "Copied", "ကူးပြီးပါပြီ"))));
                      },
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Text(rec),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        // ---- WRITE ----
        Text(tr(context, "Write a tag", "Tag ရေးရန်"),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final k in _WriteKind.values)
              ChoiceChip(
                selected: _writeKind == k,
                onSelected: (_) => setState(() => _writeKind = k),
                label: Text(switch (k) {
                  _WriteKind.text => tr(context, "Text", "စာသား"),
                  _WriteKind.url => "URL",
                  _WriteKind.phone => tr(context, "Phone", "ဖုန်း"),
                  _WriteKind.sms => "SMS",
                }),
              ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _writeCtrl,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: switch (_writeKind) {
              _WriteKind.text => tr(context, "Text to write", "ရေးမယ့် စာသား"),
              _WriteKind.url => "https://…",
              _WriteKind.phone =>
                tr(context, "Phone number", "ဖုန်းနံပါတ်"),
              _WriteKind.sms =>
                tr(context, "SMS number", "SMS ပို့မယ့် နံပါတ်"),
            },
          ),
        ),
        if (_writeKind == _WriteKind.sms) ...[
          const SizedBox(height: 8),
          TextField(
            controller: _writeCtrl2,
            decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: tr(context, "SMS message", "SMS စာသား"),
            ),
          ),
        ],
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _busy ? null : _write,
          icon: const Icon(Icons.edit),
          label: Text(tr(context, "Write to tag", "Tag ထဲ ရေးမည်")),
        ),
        const SizedBox(height: 18),
        // ---- ADVANCED ----
        Text(tr(context, "Advanced", "အဆင့်မြင့်"),
            style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : _erase,
                icon: const Icon(Icons.layers_clear_outlined),
                label: Text(tr(context, "Erase tag", "Tag ဖျက်မည်")),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy ? null : _lock,
                icon: const Icon(Icons.lock_outline),
                label: Text(tr(context, "Lock (read-only)", "လော့ခ်ချမည်")),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          tr(
              context,
              "Long-press a read record to copy it. Locking is permanent and cannot be undone.",
              "ဖတ်ထားတဲ့ record ကို ကြာကြာနှိပ်ရင် ကူးလို့ရသည်။ လော့ခ်ချတာ အပြီးတိုင်ဖြစ်ပြီး ပြန်ဖြေလို့ မရပါ။"),
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
                width: 56,
                child: Text(k,
                    style: const TextStyle(
                        color: Colors.white54, fontSize: 12.5))),
            Expanded(
                child:
                    Text(v, style: const TextStyle(fontSize: 13.5))),
          ],
        ),
      );
}
