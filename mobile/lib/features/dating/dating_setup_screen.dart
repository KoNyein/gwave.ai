import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';

/// Create/edit the opt-in dating profile: photos, name, birth year (18+),
/// gender, preference, city and bio. Saving returns `true` to the caller.
class DatingSetupScreen extends StatefulWidget {
  const DatingSetupScreen({super.key, this.existing});

  /// The saved dating profile row when editing (null on first setup).
  final Map<String, dynamic>? existing;

  @override
  State<DatingSetupScreen> createState() => _DatingSetupScreenState();
}

class _DatingSetupScreenState extends State<DatingSetupScreen> {
  late final _name =
      TextEditingController(text: widget.existing?["display_name"]?.toString());
  late final _year = TextEditingController(
      text: widget.existing?["birth_year"]?.toString() ?? "");
  late final _city =
      TextEditingController(text: widget.existing?["city"]?.toString());
  late final _bio =
      TextEditingController(text: widget.existing?["bio"]?.toString());

  /// Already-uploaded storage keys (editing) + freshly picked bytes.
  late final List<String> _photoPaths =
      ((widget.existing?["photos"] as List?)?.cast<String>() ?? []).toList();
  final List<Uint8List> _newPhotos = [];

  late String _gender = widget.existing?["gender"]?.toString() ?? "male";
  late String _lookingFor =
      widget.existing?["looking_for"]?.toString() ?? "any";
  late bool _active = widget.existing?["active"] != false;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _year.dispose();
    _city.dispose();
    _bio.dispose();
    super.dispose();
  }

  int get _photoCount => _photoPaths.length + _newPhotos.length;

  Future<void> _addPhoto() async {
    if (_photoCount >= 4) return;
    try {
      final file = await ImagePicker()
          .pickImage(source: ImageSource.gallery, maxWidth: 1600, imageQuality: 82);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (mounted) setState(() => _newPhotos.add(bytes));
    } catch (_) {}
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final year = int.tryParse(_year.text.trim());
    final adultYear = DateTime.now().year - 18;
    if (name.length < 2) {
      _toast(tr(context, "Add your name.", "နာမည် ထည့်ပါ။"));
      return;
    }
    if (year == null || year < 1920 || year > adultYear) {
      _toast(tr(context, "Dating is for adults (18+) only.",
          "Dating က အသက် ၁၈ နှစ်ပြည့်ပြီးသူများအတွက်သာ ဖြစ်ပါတယ်။"));
      return;
    }
    setState(() => _busy = true);
    try {
      final api = context.read<AppState>().api;
      for (final bytes in _newPhotos) {
        _photoPaths.add(await api.uploadBytes(
          bytes,
          ext: "jpg",
          contentType: "image/jpeg",
          bucket: "media",
        ));
      }
      _newPhotos.clear();
      await api.datingSave(
        displayName: name,
        birthYear: year,
        gender: _gender,
        lookingFor: _lookingFor,
        bio: _bio.text.trim(),
        city: _city.text.trim(),
        photos: _photoPaths,
        active: _active,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      _toast(e.message);
    } catch (_) {
      if (mounted) {
        _toast(tr(context, "Couldn't save the profile.",
            "Profile သိမ်းလို့မရပါ။ ပြန်ကြိုးစားပါ။"));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existing == null
            ? tr(context, "Create dating profile", "Dating profile ဖွင့်မယ်")
            : tr(context, "Edit dating profile", "Dating profile ပြင်မယ်")),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _photoRow(),
          const SizedBox(height: 16),
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              labelText: tr(context, "Display name", "ဖော်ပြမည့်နာမည်"),
              prefixIcon: const Icon(Icons.badge_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _year,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: tr(context, "Birth year (e.g. 1998)",
                  "မွေးသက္ကရာဇ်ခုနှစ် (ဥပမာ 1998)"),
              prefixIcon: const Icon(Icons.cake_outlined),
            ),
          ),
          const SizedBox(height: 16),
          _chipsRow(
            label: tr(context, "I am", "ကျွန်ုပ်သည်"),
            value: _gender,
            options: [
              ("male", tr(context, "Male", "ကျား")),
              ("female", tr(context, "Female", "မ")),
              ("other", tr(context, "Other", "အခြား")),
            ],
            onChanged: (v) => setState(() => _gender = v),
          ),
          const SizedBox(height: 12),
          _chipsRow(
            label: tr(context, "Looking for", "ရှာဖွေနေသည်မှာ"),
            value: _lookingFor,
            options: [
              ("male", tr(context, "Men", "အမျိုးသား")),
              ("female", tr(context, "Women", "အမျိုးသမီး")),
              ("any", tr(context, "Anyone", "မည်သူမဆို")),
            ],
            onChanged: (v) => setState(() => _lookingFor = v),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _city,
            decoration: InputDecoration(
              labelText: tr(context, "City / township", "မြို့ / မြို့နယ်"),
              prefixIcon: const Icon(Icons.place_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _bio,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: tr(context, "About me", "ကျွန်ုပ်အကြောင်း"),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 8),
          SwitchListTile(
            value: _active,
            activeColor: GwColors.primary,
            contentPadding: EdgeInsets.zero,
            title: Text(tr(context, "Show me in the deck",
                "အခြားသူများကို ကျွန်ုပ်အား ပြပါ")),
            subtitle: Text(
              tr(context, "Turn off to hide your profile.",
                  "ပိတ်ထားလျှင် သင့် profile ကို မမြင်ရပါ။"),
              style: const TextStyle(fontSize: 12.5),
            ),
            onChanged: (v) => setState(() => _active = v),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _busy ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: GwColors.heart,
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.favorite),
            label: Text(tr(context, "Save profile", "Profile သိမ်းမယ်")),
          ),
        ],
      ),
    );
  }

  Widget _chipsRow({
    required String label,
    required String value,
    required List<(String, String)> options,
    required ValueChanged<String> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: GwColors.inkSoft)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final (key, text) in options)
              ChoiceChip(
                label: Text(text),
                selected: value == key,
                selectedColor: GwColors.heart.withValues(alpha: 0.15),
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: value == key ? GwColors.heart : GwColors.inkSoft,
                ),
                onSelected: (_) => onChanged(key),
              ),
          ],
        ),
      ],
    );
  }

  Widget _photoRow() {
    return SizedBox(
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (var i = 0; i < _photoPaths.length; i++)
            _photoTile(
              child: CachedNetworkImage(
                imageUrl: resolveMedia(_photoPaths[i], bucket: "media") ?? "",
                width: 90,
                height: 110,
                fit: BoxFit.cover,
              ),
              onRemove: () => setState(() => _photoPaths.removeAt(i)),
            ),
          for (var i = 0; i < _newPhotos.length; i++)
            _photoTile(
              child: Image.memory(
                _newPhotos[i],
                width: 90,
                height: 110,
                fit: BoxFit.cover,
              ),
              onRemove: () => setState(() => _newPhotos.removeAt(i)),
            ),
          if (_photoCount < 4)
            InkWell(
              borderRadius: BorderRadius.circular(GwRadius.md),
              onTap: _addPhoto,
              child: Container(
                width: 90,
                height: 110,
                decoration: BoxDecoration(
                  color: GwColors.heart.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(GwRadius.md),
                  border: Border.all(
                      color: GwColors.heart.withValues(alpha: 0.3)),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add_a_photo_outlined,
                        color: GwColors.heart),
                    const SizedBox(height: 4),
                    Text(
                      tr(context, "Photo", "ဓာတ်ပုံ"),
                      style: const TextStyle(
                          fontSize: 12, color: GwColors.inkSoft),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _photoTile({required Widget child, required VoidCallback onRemove}) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(GwRadius.md),
            child: child,
          ),
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  color: Colors.black54,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
