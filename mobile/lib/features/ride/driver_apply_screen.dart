import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'ride_models.dart';

/// Apply to drive.
///
/// Three documents are mandatory, and the form says so before anything is
/// typed: an application that gets to the last screen and is then refused for a
/// missing photo wastes a driver's evening. The server checks them again at
/// approval time — a form is a courtesy, not a control.
class DriverApplyScreen extends StatefulWidget {
  const DriverApplyScreen({super.key, this.existing});

  /// A previous (pending or rejected) application, so a resubmission is an edit
  /// rather than a retype.
  final Map<String, dynamic>? existing;

  @override
  State<DriverApplyScreen> createState() => _DriverApplyScreenState();
}

class _DriverApplyScreenState extends State<DriverApplyScreen> {
  static const _docs = <({String key, String label, String hint})>[
    (
      key: "licencePhoto",
      label: "Driving licence",
      hint: "Front side, all text readable"
    ),
    (
      key: "vehiclePhoto",
      label: "Your vehicle",
      hint: "Whole vehicle with the plate visible"
    ),
    (
      key: "registrationPhoto",
      label: "Vehicle registration",
      hint: "The ownership book or card"
    ),
  ];

  late String _vehicle =
      widget.existing?["vehicle_type"]?.toString() ?? "bike";
  late final TextEditingController _plate = TextEditingController(
      text: widget.existing?["plate_number"]?.toString() ?? "");
  late final TextEditingController _phone = TextEditingController(
      text: widget.existing?["phone"]?.toString() ?? "");
  late final TextEditingController _make = TextEditingController(
      text: widget.existing?["vehicle_make"]?.toString() ?? "");
  late final TextEditingController _model = TextEditingController(
      text: widget.existing?["vehicle_model"]?.toString() ?? "");
  late final TextEditingController _colour = TextEditingController(
      text: widget.existing?["vehicle_color"]?.toString() ?? "");

  /// Newly picked bytes, keyed like the API field. A key absent here but
  /// present on the existing application means "keep the one already uploaded".
  final Map<String, Uint8List> _picked = {};
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _plate.dispose();
    _phone.dispose();
    _make.dispose();
    _model.dispose();
    _colour.dispose();
    super.dispose();
  }

  String? _existingDoc(String key) {
    final column = {
      "licencePhoto": "licence_photo",
      "vehiclePhoto": "vehicle_photo",
      "registrationPhoto": "registration_photo",
    }[key];
    final v = widget.existing?[column]?.toString();
    return (v == null || v.isEmpty) ? null : v;
  }

  bool _hasDoc(String key) =>
      _picked.containsKey(key) || _existingDoc(key) != null;

  Future<void> _pick(String key) async {
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 2000,
        imageQuality: 85,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (mounted) setState(() => _picked[key] = bytes);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't open that photo.");
    }
  }

  Future<void> _submit() async {
    final plate = _plate.text.trim();
    final phone = _phone.text.trim();
    if (plate.length < 2 || phone.length < 5) {
      setState(() => _error = "Plate number and phone number are required.");
      return;
    }
    final missing = _docs.where((d) => !_hasDoc(d.key)).toList();
    if (missing.isNotEmpty) {
      setState(() =>
          _error = "Still needed: ${missing.map((d) => d.label).join(", ")}.");
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = context.read<AppState>().api;
      final body = <String, dynamic>{
        "vehicleType": _vehicle,
        "plateNumber": plate,
        "phone": phone,
        if (_make.text.trim().isNotEmpty) "vehicleMake": _make.text.trim(),
        if (_model.text.trim().isNotEmpty) "vehicleModel": _model.text.trim(),
        if (_colour.text.trim().isNotEmpty) "vehicleColor": _colour.text.trim(),
      };
      for (final d in _docs) {
        final bytes = _picked[d.key];
        body[d.key] = bytes != null
            ? await api.uploadBytes(bytes,
                ext: "jpg", contentType: "image/jpeg", bucket: "media")
            : _existingDoc(d.key);
      }
      await api.rideDriverApply(body);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't submit your application.");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(title: const Text("Apply to drive")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: GwColors.live.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 18, color: GwColors.live),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Text(_error!,
                          style: const TextStyle(fontSize: 13))),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          _label("What do you drive?"),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final code in const ["bike", "three_wheeler", "car", "delivery"])
                _VehicleChip(
                  code: code,
                  selected: _vehicle == code,
                  onTap: () => setState(() => _vehicle = code),
                ),
            ],
          ),
          const SizedBox(height: 20),
          _label("Vehicle & contact"),
          const SizedBox(height: 8),
          _field(_plate, "Plate number", hint: "e.g. 1A/2345", caps: true),
          const SizedBox(height: 10),
          _field(_phone, "Phone number",
              hint: "Passengers see this once they're matched",
              keyboard: TextInputType.phone),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _field(_make, "Make", hint: "Honda")),
              const SizedBox(width: 10),
              Expanded(child: _field(_model, "Model", hint: "Wave")),
            ],
          ),
          const SizedBox(height: 10),
          _field(_colour, "Colour", hint: "Red"),
          const SizedBox(height: 20),
          _label("Documents"),
          const SizedBox(height: 4),
          Text(
            "All three are required. They're reviewed by a person and are never "
            "shown to passengers.",
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5),
          ),
          const SizedBox(height: 10),
          for (final d in _docs) ...[
            _DocTile(
              label: d.label,
              hint: d.hint,
              bytes: _picked[d.key],
              alreadyUploaded: _existingDoc(d.key) != null,
              onTap: () => _pick(d.key),
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _submit,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: GwColors.primary,
            ),
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text("Submit application",
                    style: TextStyle(fontWeight: FontWeight.w800)),
          ),
          const SizedBox(height: 10),
          Text(
            "By applying you confirm you hold a valid licence and insurance for "
            "the vehicle above, and that you meet the local rules for carrying "
            "passengers.",
            textAlign: TextAlign.center,
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 11.5),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Text(text,
      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15));

  Widget _field(
    TextEditingController c,
    String label, {
    String? hint,
    TextInputType? keyboard,
    bool caps = false,
  }) =>
      TextField(
        controller: c,
        keyboardType: keyboard,
        textCapitalization:
            caps ? TextCapitalization.characters : TextCapitalization.words,
        inputFormatters:
            caps ? [UpperCaseFormatter()] : const <TextInputFormatter>[],
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          filled: true,
          fillColor: GwColors.surfaceOf(context),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: GwColors.lineOf(context)),
          ),
        ),
      );
}

/// Plate numbers are written in capitals everywhere in Myanmar, and a plate
/// that reads differently in the app than on the vehicle is the thing a
/// passenger uses to decide whether to get in.
class UpperCaseFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) =>
      newValue.copyWith(text: newValue.text.toUpperCase());
}

class _VehicleChip extends StatelessWidget {
  const _VehicleChip({
    required this.code,
    required this.selected,
    required this.onTap,
  });

  final String code;
  final bool selected;
  final VoidCallback onTap;

  static const _labels = {
    "bike": "မော်တော်ဆိုင်ကယ်",
    "three_wheeler": "သုံးဘီး",
    "car": "ကား",
    "delivery": "ပစ္စည်းပို့",
  };

  @override
  Widget build(BuildContext context) {
    final style = vehicleStyle(code);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? GwColors.primary.withValues(alpha: 0.08)
              : GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? GwColors.primary : GwColors.lineOf(context),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(style.icon, size: 20, color: style.color),
            const SizedBox(width: 8),
            Text(_labels[code] ?? code,
                style: TextStyle(
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                  fontSize: 13.5,
                )),
          ],
        ),
      ),
    );
  }
}

class _DocTile extends StatelessWidget {
  const _DocTile({
    required this.label,
    required this.hint,
    required this.bytes,
    required this.alreadyUploaded,
    required this.onTap,
  });

  final String label;
  final String hint;
  final Uint8List? bytes;
  final bool alreadyUploaded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final done = bytes != null || alreadyUploaded;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: done ? GwColors.primaryBright : GwColors.lineOf(context),
          ),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: bytes != null
                  ? Image.memory(bytes!, width: 54, height: 54, fit: BoxFit.cover)
                  : Container(
                      width: 54,
                      height: 54,
                      color: GwColors.surfaceMutedOf(context),
                      child: Icon(
                        done ? Icons.check_circle : Icons.add_a_photo_outlined,
                        color: done
                            ? GwColors.primaryBright
                            : GwColors.inkSoftOf(context),
                      ),
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    alreadyUploaded && bytes == null ? "Uploaded — tap to replace" : hint,
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: GwColors.inkSoftOf(context)),
          ],
        ),
      ),
    );
  }
}
