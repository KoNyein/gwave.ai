import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'market_screen.dart' show marketCategories;

/// Post a marketplace listing: up to 5 photos, title, price, category,
/// location and description.
class MarketCreateScreen extends StatefulWidget {
  const MarketCreateScreen({super.key});

  @override
  State<MarketCreateScreen> createState() => _MarketCreateScreenState();
}

class _MarketCreateScreenState extends State<MarketCreateScreen> {
  final _title = TextEditingController();
  final _price = TextEditingController();
  final _location = TextEditingController();
  final _description = TextEditingController();
  final List<Uint8List> _photos = [];
  String _category = "farm";
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _price.dispose();
    _location.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _addPhoto() async {
    if (_photos.length >= 5) return;
    try {
      final file = await ImagePicker()
          .pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 82);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (mounted) setState(() => _photos.add(bytes));
    } catch (_) {}
  }

  Future<void> _submit() async {
    final title = _title.text.trim();
    final price = num.tryParse(_price.text.trim().replaceAll(",", ""));
    if (title.length < 2 || price == null || price < 0) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "Add a title and a valid price.",
            "ခေါင်းစဉ်နှင့် စျေးနှုန်းမှန်မှန် ထည့်ပါ။")),
      ));
      return;
    }
    setState(() => _busy = true);
    try {
      final api = context.read<AppState>().api;
      final paths = <String>[];
      for (final bytes in _photos) {
        paths.add(await api.uploadBytes(
          bytes,
          ext: "jpg",
          contentType: "image/jpeg",
          bucket: "media",
        ));
      }
      await api.marketCreate(
        title: title,
        description: _description.text.trim(),
        price: price,
        category: _category,
        location: _location.text.trim(),
        photos: paths,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "Couldn't post the listing.",
              "တင်လို့မရပါ။ ပြန်ကြိုးစားပါ။")),
        ));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Sell something", "ပစ္စည်းရောင်းမယ်"))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _photoRow(),
          const SizedBox(height: 16),
          TextField(
            controller: _title,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: tr(context, "Title", "ခေါင်းစဉ်"),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _price,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: tr(context, "Price (Ks)", "စျေးနှုန်း (ကျပ်)"),
              prefixIcon: const Icon(Icons.payments_outlined),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: InputDecoration(
              labelText: tr(context, "Category", "အမျိုးအစား"),
            ),
            items: [
              for (final c in marketCategories.where((c) => c.$1 != "all"))
                DropdownMenuItem(
                  value: c.$1,
                  child: Text(tr(context, c.$2, c.$3)),
                ),
            ],
            onChanged: (v) => setState(() => _category = v ?? "other"),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _location,
            decoration: InputDecoration(
              labelText: tr(context, "Location", "တည်နေရာ"),
              prefixIcon: const Icon(Icons.place_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: tr(context, "Description", "အသေးစိတ်ဖော်ပြချက်"),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: GwColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 15),
            ),
            icon: _busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.storefront_outlined),
            label: Text(tr(context, "Post listing", "ဈေးကွက်ထဲ တင်မယ်")),
          ),
        ],
      ),
    );
  }

  Widget _photoRow() {
    return SizedBox(
      height: 96,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (var i = 0; i < _photos.length; i++)
            Padding(
              padding: const EdgeInsets.only(right: 10),
              child: Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(GwRadius.md),
                    child: Image.memory(
                      _photos[i],
                      width: 96,
                      height: 96,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 4,
                    right: 4,
                    child: GestureDetector(
                      onTap: () => setState(() => _photos.removeAt(i)),
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: Colors.black54,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close,
                            size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (_photos.length < 5)
            InkWell(
              borderRadius: BorderRadius.circular(GwRadius.md),
              onTap: _addPhoto,
              child: Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: GwColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(GwRadius.md),
                  border: Border.all(color: GwColors.line),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add_a_photo_outlined,
                        color: GwColors.primary),
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
}
