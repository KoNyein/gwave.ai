import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// Admin "Add audio" — grow the catalogue straight from the phone:
///  - Music: pick an MP3 you own the rights to (e.g. your licensed Myanmar
///    collection), tag artist/album — quick chips prefill the classic Myanmar
///    artists so entry is one tap.
///  - Audiobook: same upload with author/narrator (မြန်မာ အသံစာအုပ်).
///  - Podcast: paste a show's public RSS URL and import its episodes in one
///    tap (episodes keep streaming from the publisher's own servers), or
///    upload a single episode manually.
/// The server (POST /api/mobile/audio/publish, /import-rss) enforces admin.
class AudioPublishScreen extends StatefulWidget {
  const AudioPublishScreen({super.key});

  @override
  State<AudioPublishScreen> createState() => _AudioPublishScreenState();
}

class _AudioPublishScreenState extends State<AudioPublishScreen> {
  String _kind = "music"; // music | podcast | audiobook

  final _title = TextEditingController();
  final _artist = TextEditingController();
  final _album = TextEditingController();
  final _genre = TextEditingController();
  final _author = TextEditingController();
  final _narrator = TextEditingController();
  final _rss = TextEditingController();

  Uint8List? _audioBytes;
  String _audioExt = "mp3";
  String _audioName = "";
  Uint8List? _coverBytes;

  // Paid plan: premium tracks are bought once from the G-Pay wallet; artist
  // uploads settle to the artist, admin uploads to the platform.
  bool _premium = false;
  final _price = TextEditingController();

  bool _busy = false;
  bool _importing = false;

  static const _artists = [
    "ထူးအိမ်သင်",
    "စိုင်းထီးဆိုင်",
    "လွမ်းမိုး",
    "ခင်မောင်တိုး",
  ];

  @override
  void dispose() {
    _title.dispose();
    _artist.dispose();
    _album.dispose();
    _genre.dispose();
    _author.dispose();
    _narrator.dispose();
    _rss.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _pickAudio() async {
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ["mp3", "m4a", "aac", "wav"],
        withData: true,
      );
      final f = res?.files.single;
      if (f == null || f.bytes == null) return;
      setState(() {
        _audioBytes = f.bytes;
        _audioExt = (f.extension ?? "mp3").toLowerCase();
        _audioName = f.name;
        if (_title.text.trim().isEmpty) {
          // Prefill the title from the filename (sans extension).
          _title.text = f.name.replaceAll(RegExp(r"\.[A-Za-z0-9]+$"), "");
        }
      });
    } catch (e) {
      _toast("File pick failed — $e");
    }
  }

  Future<void> _pickCover() async {
    try {
      final f = await ImagePicker()
          .pickImage(source: ImageSource.gallery, maxWidth: 1200, imageQuality: 85);
      if (f == null) return;
      final bytes = await f.readAsBytes();
      setState(() => _coverBytes = bytes);
    } catch (e) {
      _toast("Cover pick failed — $e");
    }
  }

  Future<void> _publish() async {
    final title = _title.text.trim();
    final audio = _audioBytes;
    if (title.isEmpty || audio == null) {
      _toast(tr(context, "Pick an audio file and give it a title.",
          "အသံဖိုင်ရွေးပြီး ခေါင်းစဉ် ထည့်ပါ။"));
      return;
    }
    final price = double.tryParse(_price.text.trim());
    if (_premium && (price == null || price <= 0)) {
      _toast(tr(context, "Set a price for the premium track.",
          "Premium သီချင်းအတွက် စျေးနှုန်း သတ်မှတ်ပါ။"));
      return;
    }
    setState(() => _busy = true);
    final api = context.read<AppState>().api;
    try {
      final audioPath = await api.uploadBytes(
        audio,
        ext: _audioExt,
        contentType: _audioExt == "mp3" ? "audio/mpeg" : "audio/mp4",
      );
      String? coverPath;
      final cover = _coverBytes;
      if (cover != null) {
        coverPath = await api.uploadBytes(cover,
            ext: "jpg", contentType: "image/jpeg");
      }
      await api.audioPublish({
        "kind": _kind,
        "title": title,
        "audio_url": audioPath,
        if (coverPath != null) "cover_url": coverPath,
        if (_premium && price != null) ...{
          "is_premium": true,
          "price": price,
          "currency": "USD",
        },
        if (_kind == "music") ...{
          if (_artist.text.trim().isNotEmpty) "artist": _artist.text.trim(),
          if (_album.text.trim().isNotEmpty) "album": _album.text.trim(),
          if (_genre.text.trim().isNotEmpty) "genre": _genre.text.trim(),
        },
        if (_kind == "audiobook") ...{
          if (_author.text.trim().isNotEmpty) "author": _author.text.trim(),
          if (_narrator.text.trim().isNotEmpty)
            "narrator": _narrator.text.trim(),
        },
      });
      if (!mounted) return;
      _toast(tr(context, "Published 🎵 Pull to refresh the list.",
          "တင်ပြီးပါပြီ 🎵 စာရင်းကို ဆွဲချပြီး refresh လုပ်ပါ။"));
      setState(() {
        _audioBytes = null;
        _coverBytes = null;
        _audioName = "";
        _title.clear();
      });
    } catch (e) {
      _toast("$e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _importRss() async {
    final url = _rss.text.trim();
    if (!url.startsWith("https://")) {
      _toast(tr(context, "Paste a podcast RSS link (https://…).",
          "Podcast RSS လင့် (https://…) ထည့်ပါ။"));
      return;
    }
    setState(() => _importing = true);
    try {
      final res =
          await context.read<AppState>().api.audioImportRss(url);
      if (!mounted) return;
      _toast(
          "${res["show"]}: ${res["imported"]} ${tr(context, "episodes imported", "episode တင်ပြီးပါပြီ")}"
          " (${res["skipped"]} ${tr(context, "already there", "ရှိပြီးသား")})");
      _rss.clear();
    } catch (e) {
      _toast("$e");
    } finally {
      if (mounted) setState(() => _importing = false);
    }
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(tr(context, "Add audio", "အသံ ထည့်ရန်"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          Wrap(
            spacing: 8,
            children: [
              for (final (k, en, my) in const [
                ("music", "Music", "တေးဂီတ"),
                ("podcast", "Podcast", "ပို့ဒ်ကာစ့်"),
                ("audiobook", "Audiobook", "အသံစာအုပ်"),
              ])
                ChoiceChip(
                  selected: _kind == k,
                  onSelected: (_) => setState(() => _kind = k),
                  label: Text(tr(context, en, my)),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Podcast: RSS import is the fast path (catalogue-wide, so admin).
          if (_kind == "podcast" &&
              context.watch<AppState>().me?.role == "admin") ...[
            _card(
              context,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr(context, "Import a show from RSS",
                        "RSS ကနေ Podcast တင်သွင်းရန်"),
                    style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 14.5,
                        color: GwColors.inkOf(context)),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tr(
                        context,
                        "Paste any public podcast RSS link — Burmese shows included. Episodes play from the publisher's own servers.",
                        "Podcast ရဲ့ public RSS လင့်ကို ကူးထည့်ပါ — မြန်မာ podcast တွေလည်း ရပါတယ်။ Episode တွေက ထုတ်လွှင့်သူရဲ့ server ကနေ တိုက်ရိုက် ဖွင့်ပေးပါတယ်။"),
                    style: TextStyle(
                        fontSize: 12.5,
                        height: 1.4,
                        color: GwColors.inkSoftOf(context)),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _rss,
                    decoration: const InputDecoration(
                      hintText: "https://…/feed.xml",
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _importing ? null : _importRss,
                      icon: _importing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.2, color: Colors.white))
                          : const Icon(Icons.rss_feed, size: 18),
                      label: Text(tr(context, "Import episodes",
                          "Episode များ တင်သွင်းမည်")),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Center(
              child: Text(tr(context, "— or upload one episode —",
                  "— သို့မဟုတ် episode တစ်ခု ကိုယ်တိုင်တင် —"),
                  style: TextStyle(
                      color: GwColors.inkSoftOf(context), fontSize: 12.5)),
            ),
            const SizedBox(height: 10),
          ],

          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton.icon(
                  onPressed: _busy ? null : _pickAudio,
                  icon: const Icon(Icons.audio_file_outlined, size: 18),
                  label: Text(_audioBytes == null
                      ? tr(context, "Pick MP3 file", "MP3 ဖိုင် ရွေးရန်")
                      : _audioName),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _pickCover,
                  icon: const Icon(Icons.image_outlined, size: 18),
                  label: Text(_coverBytes == null
                      ? tr(context, "Cover photo (optional)",
                          "မျက်နှာဖုံးပုံ (မထည့်လည်းရ)")
                      : tr(context, "Cover ready ✓", "မျက်နှာဖုံး အသင့် ✓")),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _title,
                  decoration: InputDecoration(
                    labelText: tr(context, "Title", "ခေါင်းစဉ်"),
                    isDense: true,
                  ),
                ),
                if (_kind == "music") ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _artist,
                    decoration: InputDecoration(
                      labelText: tr(context, "Artist", "အဆိုတော်"),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Classic Myanmar artists as one-tap chips.
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final a in _artists)
                        ActionChip(
                          label: Text(a,
                              style: const TextStyle(fontSize: 12)),
                          onPressed: () =>
                              setState(() => _artist.text = a),
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _album,
                    decoration: InputDecoration(
                      labelText: tr(context, "Album", "အယ်လ်ဘမ်"),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _genre,
                    decoration: InputDecoration(
                      labelText: tr(context, "Genre", "အမျိုးအစား"),
                      isDense: true,
                    ),
                  ),
                ],
                if (_kind == "audiobook") ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _author,
                    decoration: InputDecoration(
                      labelText: tr(context, "Author", "စာရေးဆရာ"),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _narrator,
                    decoration: InputDecoration(
                      labelText: tr(context, "Narrator", "အသံဖတ်သူ"),
                      isDense: true,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                // Paid plan — premium tracks sell once from the G-Pay wallet;
                // artist uploads settle the sale to the artist's wallet.
                SwitchListTile(
                  value: _premium,
                  contentPadding: EdgeInsets.zero,
                  activeColor: GwColors.gold,
                  title: Text(
                      tr(context, "💰 Premium (paid track)",
                          "💰 Premium (အခပေး)"),
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: Text(
                      tr(
                          context,
                          "Buyers pay once with G-Pay; the sale settles to your wallet.",
                          "ဝယ်သူက G-Pay နဲ့ တစ်ကြိမ်ပေးဝယ်ပြီး ရောင်းရငွေ သင့် wallet ထဲ ဝင်ပါမယ်။"),
                      style: TextStyle(
                          fontSize: 11.5,
                          color: GwColors.inkSoftOf(context))),
                  onChanged: (v) => setState(() => _premium = v),
                ),
                if (_premium)
                  TextField(
                    controller: _price,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    decoration: InputDecoration(
                      labelText:
                          tr(context, "Price (USD)", "စျေးနှုန်း (USD)"),
                      isDense: true,
                    ),
                  ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _busy ? null : _publish,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2.2, color: Colors.white))
                      : const Icon(Icons.cloud_upload_outlined, size: 18),
                  label: Text(_busy
                      ? tr(context, "Uploading…", "တင်နေသည်…")
                      : tr(context, "Publish", "ထုတ်ဝေမည်")),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          // Rights reminder — the store must only carry licensed content.
          Text(
            tr(
                context,
                "⚖️ Upload only recordings you own or are licensed to distribute.",
                "⚖️ ကိုယ်ပိုင် သို့မဟုတ် ဖြန့်ချိခွင့် (license) ရှိတဲ့ သီချင်း/အသံဖိုင်များကိုသာ တင်ပါ။"),
            style: TextStyle(
                fontSize: 12,
                height: 1.4,
                color: GwColors.inkSoftOf(context)),
          ),
        ],
      ),
    );
  }

  Widget _card(BuildContext context, Widget child) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: child,
      );
}
