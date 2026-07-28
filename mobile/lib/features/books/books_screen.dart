import 'dart:async';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Gwave Books — the online book store. Browse/search the catalogue (PDF /
/// EPUB), free books read instantly, premium books buy once with G-Pay (the
/// sale settles to the publishing author's wallet), reading progress saves,
/// and anyone can publish their own book from the ✚ button. Data flows
/// straight through PostgREST (`books`, `book_purchases`, `book_progress`,
/// `buy_book` RPC — see supabase/sql-editor-bundles/books-store.sql).
class BooksScreen extends StatefulWidget {
  const BooksScreen({super.key});

  @override
  State<BooksScreen> createState() => _BooksScreenState();
}

class _Book {
  _Book(this.j);
  final Map<String, dynamic> j;

  String get id => j["id"].toString();
  String get title => (j["title"] ?? "").toString();
  String get author => (j["author"] ?? "").toString();
  String? get description => j["description"]?.toString();
  String? get category => j["category"]?.toString();
  String? get coverUrl => j["cover_url"]?.toString();
  String? get fileUrl => j["file_url"]?.toString();
  String get format => (j["file_format"] ?? "pdf").toString();
  int? get pages => (j["pages"] as num?)?.toInt();
  double? get price => (j["price"] as num?)?.toDouble();
  bool get isPremium => j["is_premium"] == true && (price ?? 0) > 0;
}

class _BooksScreenState extends State<BooksScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  List<_Book> _books = [];
  Set<String> _owned = {};
  String? _category;
  bool _mineOnly = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = context.read<AppState>().api;
    try {
      final q = <String, String>{
        "select":
            "id,title,author,description,category,cover_url,file_url,file_format,pages,price,is_premium",
        "order": "published_at.desc",
        "limit": "60",
      };
      final needle = _search.text.trim();
      if (needle.isNotEmpty) q["title"] = "ilike.*$needle*";
      if (_category != null) q["category"] = "eq.$_category";
      final rows = await api.select("books", query: q);
      Set<String> owned = {};
      try {
        final uid = api.session?.profileId;
        if (uid != null) {
          final mine = await api.select("book_purchases", query: {
            "select": "book_id",
            "user_id": "eq.$uid",
          });
          owned = mine.map((r) => r["book_id"].toString()).toSet();
        }
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _books = rows.map(_Book.new).toList();
        _owned = owned;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<String> get _categories {
    final s = <String>{};
    for (final b in _books) {
      final c = b.category;
      if (c != null && c.isNotEmpty) s.add(c);
    }
    return s.toList()..sort();
  }

  @override
  Widget build(BuildContext context) {
    final visible =
        _mineOnly ? _books.where((b) => _owned.contains(b.id)).toList() : _books;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Books", "စာအုပ်ဆိုင်")),
        actions: [
          IconButton(
            tooltip: tr(context, "Publish a book", "စာအုပ် တင်ရန်"),
            icon: const Icon(Icons.add_circle_outline),
            onPressed: () async {
              await Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const BookPublishScreen()));
              _load();
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _search,
              onChanged: (_) {
                _debounce?.cancel();
                _debounce =
                    Timer(const Duration(milliseconds: 400), _load);
              },
              decoration: InputDecoration(
                hintText: tr(context, "Search books…", "စာအုပ် ရှာရန်…"),
                prefixIcon: const Icon(Icons.search),
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    selected: _mineOnly,
                    onSelected: (v) => setState(() => _mineOnly = v),
                    label: Text(tr(context, "My books", "ကိုယ့်စာအုပ်များ")),
                    selectedColor: GwColors.gold.withValues(alpha: 0.2),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    selected: _category == null,
                    onSelected: (_) {
                      setState(() => _category = null);
                      _load();
                    },
                    label: Text(tr(context, "All", "အားလုံး")),
                  ),
                ),
                for (final c in _categories)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _category == c,
                      onSelected: (_) {
                        setState(
                            () => _category = _category == c ? null : c);
                        _load();
                      },
                      label: Text(c),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: GwColors.primary,
              onRefresh: _load,
              child: _loading && _books.isEmpty
                  ? const Center(
                      child:
                          CircularProgressIndicator(color: GwColors.primary))
                  : _error != null && _books.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 70),
                          GwEmpty(
                              icon: Icons.cloud_off,
                              title: tr(context, "Couldn't load books",
                                  "စာအုပ်များ မဖွင့်နိုင်ပါ"),
                              subtitle: _error),
                        ])
                      : visible.isEmpty
                          ? ListView(children: [
                              const SizedBox(height: 70),
                              GwEmpty(
                                  icon: Icons.menu_book_outlined,
                                  title: tr(context, "No books yet",
                                      "စာအုပ် မရှိသေးပါ"),
                                  subtitle: tr(
                                      context,
                                      "Tap ＋ to publish the first one.",
                                      "＋ နှိပ်ပြီး ပထမဆုံး စာအုပ် တင်လိုက်ပါ။")),
                            ])
                          : GridView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 6, 16, 40),
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                mainAxisSpacing: 14,
                                crossAxisSpacing: 12,
                                childAspectRatio: 0.55,
                              ),
                              itemCount: visible.length,
                              itemBuilder: (_, i) =>
                                  _cover(visible[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cover(_Book b) {
    final url = resolveMedia(b.coverUrl, bucket: "media");
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) =>
                BookDetailScreen(book: b, owned: _owned.contains(b.id))));
        _load();
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: url != null
                        ? CachedNetworkImage(
                            imageUrl: url,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => _ph(),
                            placeholder: (_, __) => _ph(),
                          )
                        : _ph(),
                  ),
                ),
                if (b.isPremium && !_owned.contains(b.id))
                  Positioned(
                    right: 4,
                    top: 4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: GwColors.gold,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text("\$${b.price?.toStringAsFixed(2)}",
                          style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: Colors.black)),
                    ),
                  ),
                if (_owned.contains(b.id))
                  const Positioned(
                    right: 4,
                    top: 4,
                    child: Icon(Icons.check_circle,
                        color: GwColors.primary, size: 18),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(b.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                  height: 1.2,
                  color: GwColors.inkOf(context))),
          Text(b.author,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  fontSize: 10.5, color: GwColors.inkSoftOf(context))),
        ],
      ),
    );
  }

  Widget _ph() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [GwColors.primaryBright, GwColors.primaryDark],
          ),
        ),
        child: const Center(
            child: Icon(Icons.menu_book, color: Colors.white, size: 34)),
      );
}

/// Detail + read/buy. Free (or owned) books open the PDF/EPUB straight away;
/// premium books buy once through the buy_book G-Pay RPC.
class BookDetailScreen extends StatefulWidget {
  const BookDetailScreen({super.key, required this.book, required this.owned});
  final _Book book;
  final bool owned;

  @override
  State<BookDetailScreen> createState() => _BookDetailScreenState();
}

class _BookDetailScreenState extends State<BookDetailScreen> {
  late bool _owned = widget.owned;
  bool _buying = false;

  _Book get b => widget.book;
  bool get _readable => !b.isPremium || _owned;

  Future<void> _buy() async {
    setState(() => _buying = true);
    try {
      await context.read<AppState>().api.rpc("buy_book", {"p_book": b.id});
      if (!mounted) return;
      setState(() => _owned = true);
      _snack(tr(context, "Purchased — happy reading 📖",
          "ဝယ်ယူပြီးပါပြီ — ဖတ်ရှုနိုင်ပါပြီ 📖"));
    } catch (e) {
      _snack("$e");
    } finally {
      if (mounted) setState(() => _buying = false);
    }
  }

  Future<void> _read() async {
    final url = resolveMedia(b.fileUrl, bucket: "media");
    if (url == null) {
      _snack(tr(context, "This book has no file yet.",
          "ဒီစာအုပ်မှာ ဖိုင် မရှိသေးပါ။"));
      return;
    }
    // Save a "started reading" marker so it counts toward progress.
    final api = context.read<AppState>().api;
    final uid = api.session?.profileId;
    if (uid != null) {
      try {
        await api.upsert(
          "book_progress",
          {
            "user_id": uid,
            "book_id": b.id,
            "percent": 1,
            "updated_at": DateTime.now().toUtc().toIso8601String(),
          },
          onConflict: "user_id,book_id",
        );
      } catch (_) {
        // Progress is best-effort; reading continues regardless.
      }
    }
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      _snack(tr(context, "Couldn't open the file — $e",
          "ဖိုင်ဖွင့်၍မရပါ — $e"));
    }
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final cover = resolveMedia(b.coverUrl, bucket: "media");
    return Scaffold(
      appBar: AppBar(title: Text(b.title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 150,
                height: 210,
                child: cover != null
                    ? CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover)
                    : Container(
                        color: GwColors.primary.withValues(alpha: 0.15),
                        child: const Icon(Icons.menu_book,
                            size: 48, color: GwColors.primary)),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(b.title,
              textAlign: TextAlign.center,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(b.author,
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: GwColors.inkSoftOf(context), fontSize: 14)),
          const SizedBox(height: 10),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            children: [
              if (b.category != null) GwPill(label: b.category!, color: GwColors.primary),
              GwPill(label: b.format.toUpperCase(), color: const Color(0xFF2E7DB1)),
              if (b.pages != null)
                GwPill(
                    label: "${b.pages} ${tr(context, "pages", "မျက်နှာ")}",
                    color: GwColors.inkSoft),
            ],
          ),
          const SizedBox(height: 16),
          if (_readable)
            FilledButton.icon(
              onPressed: _read,
              icon: const Icon(Icons.auto_stories, size: 18),
              label: Text(tr(context, "Read / Download", "ဖတ်ရန် / ဒေါင်းရန်")),
            )
          else
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: GwColors.gold,
                  foregroundColor: Colors.black),
              onPressed: _buying ? null : _buy,
              icon: _buying
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2))
                  : const Icon(Icons.account_balance_wallet_outlined,
                      size: 18),
              label: Text(
                  "${tr(context, "Buy with G-Pay", "G-Pay ဖြင့် ဝယ်ရန်")} · \$${b.price?.toStringAsFixed(2)}"),
            ),
          if (b.description != null && b.description!.isNotEmpty) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: GwColors.surfaceOf(context),
                borderRadius: BorderRadius.circular(GwRadius.lg),
                boxShadow: GwShadow.card,
              ),
              child: Text(b.description!,
                  style: TextStyle(
                      height: 1.5, color: GwColors.inkOf(context))),
            ),
          ],
        ],
      ),
    );
  }
}

/// Publish a book — PDF/EPUB + cover + metadata, optional G-Pay price.
class BookPublishScreen extends StatefulWidget {
  const BookPublishScreen({super.key});

  @override
  State<BookPublishScreen> createState() => _BookPublishScreenState();
}

class _BookPublishScreenState extends State<BookPublishScreen> {
  final _title = TextEditingController();
  final _author = TextEditingController();
  final _desc = TextEditingController();
  final _cat = TextEditingController();
  final _price = TextEditingController();

  Uint8List? _fileBytes;
  String _fileExt = "pdf";
  String _fileName = "";
  Uint8List? _coverBytes;
  bool _premium = false;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    _author.dispose();
    _desc.dispose();
    _cat.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    try {
      final res = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ["pdf", "epub"],
        withData: true,
      );
      final f = res?.files.single;
      if (f == null || f.bytes == null) return;
      setState(() {
        _fileBytes = f.bytes;
        _fileExt = (f.extension ?? "pdf").toLowerCase();
        _fileName = f.name;
      });
    } catch (e) {
      _snack("File pick failed — $e");
    }
  }

  Future<void> _pickCover() async {
    try {
      final f = await ImagePicker().pickImage(
          source: ImageSource.gallery, maxWidth: 1000, imageQuality: 85);
      if (f == null) return;
      final bytes = await f.readAsBytes();
      setState(() => _coverBytes = bytes);
    } catch (e) {
      _snack("Cover pick failed — $e");
    }
  }

  Future<void> _publish() async {
    final title = _title.text.trim();
    final author = _author.text.trim();
    final file = _fileBytes;
    if (title.isEmpty || author.isEmpty || file == null) {
      _snack(tr(context, "Pick a PDF/EPUB and fill title + author.",
          "PDF/EPUB ရွေးပြီး ခေါင်းစဉ်နဲ့ စာရေးဆရာ ဖြည့်ပါ။"));
      return;
    }
    final price = double.tryParse(_price.text.trim());
    if (_premium && (price == null || price <= 0)) {
      _snack(tr(context, "Set a price for the premium book.",
          "Premium စာအုပ်အတွက် စျေးနှုန်း သတ်မှတ်ပါ။"));
      return;
    }
    setState(() => _busy = true);
    final api = context.read<AppState>().api;
    try {
      final filePath = await api.uploadBytes(
        file,
        ext: _fileExt,
        contentType:
            _fileExt == "pdf" ? "application/pdf" : "application/epub+zip",
      );
      String? coverPath;
      if (_coverBytes != null) {
        coverPath = await api.uploadBytes(_coverBytes!,
            ext: "jpg", contentType: "image/jpeg");
      }
      await api.booksPublish({
        "title": title,
        "author": author,
        "file_url": filePath,
        "file_format": _fileExt == "epub" ? "epub" : "pdf",
        if (coverPath != null) "cover_url": coverPath,
        if (_desc.text.trim().isNotEmpty) "description": _desc.text.trim(),
        if (_cat.text.trim().isNotEmpty) "category": _cat.text.trim(),
        if (_premium && price != null) ...{
          "is_premium": true,
          "price": price,
          "currency": "USD",
        },
      });
      if (!mounted) return;
      _snack(tr(context, "Published 📚", "တင်ပြီးပါပြီ 📚"));
      Navigator.of(context).pop();
    } catch (e) {
      _snack("$e");
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar:
          AppBar(title: Text(tr(context, "Publish a book", "စာအုပ် တင်ရန်"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          OutlinedButton.icon(
            onPressed: _busy ? null : _pickFile,
            icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
            label: Text(_fileBytes == null
                ? tr(context, "Pick PDF / EPUB", "PDF / EPUB ရွေးရန်")
                : _fileName),
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
                  isDense: true)),
          const SizedBox(height: 10),
          TextField(
              controller: _author,
              decoration: InputDecoration(
                  labelText: tr(context, "Author", "စာရေးဆရာ"),
                  isDense: true)),
          const SizedBox(height: 10),
          TextField(
              controller: _cat,
              decoration: InputDecoration(
                  labelText: tr(context, "Category (novel, history…)",
                      "အမျိုးအစား (ဝတ္ထု၊ သမိုင်း…)"),
                  isDense: true)),
          const SizedBox(height: 10),
          TextField(
              controller: _desc,
              minLines: 2,
              maxLines: 5,
              decoration: InputDecoration(
                  labelText:
                      tr(context, "Description", "စာအုပ် အကြောင်း"),
                  isDense: true)),
          SwitchListTile(
            value: _premium,
            contentPadding: EdgeInsets.zero,
            activeColor: GwColors.gold,
            title: Text(tr(context, "💰 Premium (paid book)", "💰 Premium (အခပေး)"),
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 14)),
            subtitle: Text(
                tr(context, "Buyers pay once with G-Pay; the sale settles to your wallet.",
                    "ဝယ်သူက G-Pay နဲ့ တစ်ကြိမ်ပေးဝယ်ပြီး ရောင်းရငွေ သင့် wallet ထဲ ဝင်ပါမယ်။"),
                style: TextStyle(
                    fontSize: 11.5, color: GwColors.inkSoftOf(context))),
            onChanged: (v) => setState(() => _premium = v),
          ),
          if (_premium)
            TextField(
                controller: _price,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                    labelText: tr(context, "Price (USD)", "စျေးနှုန်း (USD)"),
                    isDense: true)),
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
          const SizedBox(height: 10),
          Text(
            tr(context,
                "⚖️ Upload only books you wrote or are licensed to distribute.",
                "⚖️ ကိုယ်ရေးထားတဲ့ သို့မဟုတ် ဖြန့်ချိခွင့်ရှိတဲ့ စာအုပ်များကိုသာ တင်ပါ။"),
            style: TextStyle(
                fontSize: 12, height: 1.4, color: GwColors.inkSoftOf(context)),
          ),
        ],
      ),
    );
  }
}
