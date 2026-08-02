import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// List something for sale, from the phone, in one screen.
///
/// Photos first and up to ten of them: a listing with one picture is the
/// reason a shop looks like a link dump. They are uploaded only when the
/// seller taps publish, so backing out costs nothing and a slow connection
/// doesn't block typing.
class SellScreen extends StatefulWidget {
  const SellScreen({super.key});

  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  static const _maxPhotos = 10;

  final _title = TextEditingController();
  final _price = TextEditingController();
  final _description = TextEditingController();
  final _category = TextEditingController();
  final _photos = <_Photo>[];
  String _currency = "THB";
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _price.dispose();
    _description.dispose();
    _category.dispose();
    super.dispose();
  }

  Future<void> _add(ImageSource source) async {
    if (_photos.length >= _maxPhotos) return;
    try {
      final picker = ImagePicker();
      if (source == ImageSource.camera) {
        final shot = await picker.pickImage(
          source: ImageSource.camera,
          maxWidth: 2000,
          imageQuality: 82,
        );
        if (shot == null) return;
        final bytes = await shot.readAsBytes();
        if (mounted) setState(() => _photos.add(_Photo(bytes, shot.name)));
        return;
      }
      // Gallery: take several at once — the whole point is a real gallery.
      final files = await picker.pickMultiImage(maxWidth: 2000, imageQuality: 82);
      if (files.isEmpty) return;
      final room = _maxPhotos - _photos.length;
      for (final f in files.take(room)) {
        _photos.add(_Photo(await f.readAsBytes(), f.name));
      }
      if (mounted) setState(() {});
    } catch (e) {
      if (mounted) {
        setState(() => _error = tr(context, "Couldn't add that photo — $e",
            "ဓာတ်ပုံ ထည့်၍ မရပါ — $e"));
      }
    }
  }

  Future<void> _publish() async {
    final title = _title.text.trim();
    final price = double.tryParse(_price.text.trim().replaceAll(",", ""));
    if (title.isEmpty) {
      setState(() => _error =
          tr(context, "Give it a name.", "ပစ္စည်းအမည် ဖြည့်ပါ။"));
      return;
    }
    if (price == null || price <= 0) {
      setState(() => _error =
          tr(context, "Enter a price.", "ဈေးနှုန်း ဖြည့်ပါ။"));
      return;
    }
    if (_photos.isEmpty) {
      setState(() => _error = tr(context, "Add at least one photo.",
          "ဓာတ်ပုံ အနည်းဆုံး တစ်ပုံ ထည့်ပါ။"));
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = context.read<AppState>();
      final paths = <String>[];
      for (final photo in _photos) {
        paths.add(await state.api.uploadBytes(
          photo.bytes,
          ext: photo.ext,
          contentType: photo.contentType,
        ));
      }
      final product = await state.repo.createProduct(
        title: title,
        price: price,
        currency: _currency,
        description: _description.text,
        category: _category.text,
        images: paths,
      );
      if (product == null) {
        throw Exception(tr(context, "The listing wasn't saved.",
            "ပစ္စည်း သိမ်း၍ မရပါ။"));
      }
      if (mounted) Navigator.of(context).pop(product);
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = "$e";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, "Sell something", "ပစ္စည်း ရောင်းရန်"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          _photoStrip(),
          const SizedBox(height: 18),
          TextField(
            controller: _title,
            maxLength: 160,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: tr(context, "What are you selling?", "ဘာရောင်းမလဲ"),
              counterText: "",
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _price,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: tr(context, "Price", "ဈေးနှုန်း"),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _currency,
                  decoration: InputDecoration(
                    labelText: tr(context, "Currency", "ငွေကြေး"),
                  ),
                  items: const ["THB", "MMK", "USD"]
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _currency = v ?? "THB"),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 6,
            maxLength: 2000,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              labelText: tr(context, "Description", "အသေးစိတ် ဖော်ပြချက်"),
              hintText: tr(
                context,
                "Condition, size, colour, what's included, how you deliver…",
                "အခြေအနေ၊ အရွယ်အစား၊ အရောင်၊ ပါဝင်ပစ္စည်း၊ ပို့ဆောင်ပုံ…",
              ),
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 4),
          TextField(
            controller: _category,
            maxLength: 40,
            decoration: InputDecoration(
              labelText: tr(context, "Category (optional)", "အမျိုးအစား (ရွေးချယ်)"),
              hintText: tr(context, "Phones, clothes, farm…", "ဖုန်း၊ အဝတ်၊ စိုက်ပျိုးရေး…"),
              counterText: "",
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: const TextStyle(color: GwColors.live, fontSize: 13)),
          ],
          const SizedBox(height: 18),
          ElevatedButton(
            onPressed: _busy ? null : _publish,
            style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50)),
            child: _busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(tr(context, "Publish", "ရောင်းမည်")),
          ),
          const SizedBox(height: 10),
          Text(
            tr(
              context,
              "Buyers order in the app and pay you on delivery. You'll see "
                  "their name, phone and address under My sales.",
              "ဝယ်သူများသည် app ထဲမှာ အော်ဒါတင်ပြီး ပစ္စည်းရောက်မှ ငွေချေပါမည်။ "
                  "သူတို့၏ အမည်၊ ဖုန်းနှင့် လိပ်စာကို “ကျွန်ုပ်၏ အရောင်း” တွင် "
                  "တွေ့ရပါမည်။",
            ),
            style: TextStyle(
                color: GwColors.inkSoftOf(context), fontSize: 12.5, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _photoStrip() {
    return SizedBox(
      height: 104,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _photos.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) {
          if (i == _photos.length) return _addTile();
          final photo = _photos[i];
          return Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(GwRadius.sm),
                child: Image.memory(photo.bytes,
                    width: 104, height: 104, fit: BoxFit.cover),
              ),
              // The first photo is the cover everywhere else in the app, so
              // say so rather than letting the seller guess.
              if (i == 0)
                Positioned(
                  left: 4,
                  bottom: 4,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(tr(context, "Cover", "မျက်နှာဖုံး"),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
              Positioned(
                right: 2,
                top: 2,
                child: InkWell(
                  onTap: () => setState(() => _photos.removeAt(i)),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close,
                        color: Colors.white, size: 15),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _addTile() {
    final full = _photos.length >= _maxPhotos;
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.sm),
      onTap: full ? null : _pickSource,
      child: Container(
        width: 104,
        height: 104,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(GwRadius.sm),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_a_photo_outlined,
                color: full ? GwColors.lineOf(context) : GwColors.primary),
            const SizedBox(height: 6),
            Text(
              full
                  ? tr(context, "Max $_maxPhotos", "အများဆုံး $_maxPhotos")
                  : "${_photos.length}/$_maxPhotos",
              style: TextStyle(
                  fontSize: 11, color: GwColors.inkSoftOf(context)),
            ),
          ],
        ),
      ),
    );
  }

  void _pickSource() {
    showModalBottomSheet(
      context: context,
      backgroundColor: GwColors.surfaceOf(context),
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(tr(context, "Choose photos", "ဓာတ်ပုံများ ရွေးရန်")),
              onTap: () {
                Navigator.of(sheet).pop();
                _add(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(tr(context, "Take a photo", "ဓာတ်ပုံ ရိုက်ရန်")),
              onTap: () {
                Navigator.of(sheet).pop();
                _add(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }
}

/// A picked photo held in memory until publish — nothing is uploaded while the
/// seller is still deciding.
class _Photo {
  _Photo(this.bytes, String name)
      : ext = name.contains(".") ? name.split(".").last.toLowerCase() : "jpg";

  final Uint8List bytes;
  final String ext;

  String get contentType => ext == "png"
      ? "image/png"
      : ext == "webp"
          ? "image/webp"
          : "image/jpeg";
}
