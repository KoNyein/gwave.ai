import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// In-app ebook reader. Downloads the book once into the app's documents dir
/// (so re-opening is instant and works offline), then renders the PDF page by
/// page with a page indicator, jump-to-page, night mode and swipe-horizontal
/// toggle. The last page read is stored in `book_progress` (page + percent),
/// so opening the book again resumes exactly where the reader stopped —
/// on any device.
///
/// EPUB has no native Flutter renderer we ship, so those books hand off to the
/// device's reader app (the download is reused).
class BookReaderScreen extends StatefulWidget {
  const BookReaderScreen({
    super.key,
    required this.bookId,
    required this.title,
    required this.fileUrl,
    required this.format,
  });

  final String bookId;
  final String title;

  /// Fully-resolved http(s) URL of the PDF/EPUB.
  final String fileUrl;
  final String format; // pdf | epub

  @override
  State<BookReaderScreen> createState() => _BookReaderScreenState();
}

class _BookReaderScreenState extends State<BookReaderScreen> {
  String? _path;
  String? _error;
  double _downloaded = 0; // 0..1 while fetching

  PDFViewController? _ctrl;
  int _page = 0;
  int _pages = 0;
  bool _night = false;
  bool _horizontal = false;
  int _resumePage = 0;
  Timer? _saveDebounce;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    _save(); // final position
    super.dispose();
  }

  Future<Directory> _dir() async {
    final base = await getApplicationDocumentsDirectory();
    final d = Directory("${base.path}/books");
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  Future<void> _open() async {
    try {
      // Resume point first, so the viewer can jump straight there.
      await _loadResume();

      final ext = widget.format == "epub" ? "epub" : "pdf";
      final f = File("${(await _dir()).path}/${widget.bookId}.$ext");
      if (!await f.exists()) {
        final req = http.Request("GET", Uri.parse(widget.fileUrl));
        final res = await http.Client().send(req).timeout(
              const Duration(minutes: 3),
            );
        if (res.statusCode >= 400) {
          throw Exception("HTTP ${res.statusCode}");
        }
        final total = res.contentLength ?? 0;
        final sink = f.openWrite();
        var got = 0;
        await for (final chunk in res.stream) {
          sink.add(chunk);
          got += chunk.length;
          if (total > 0 && mounted) {
            setState(() => _downloaded = got / total);
          }
        }
        await sink.close();
      }

      if (!mounted) return;
      if (widget.format == "epub") {
        // Hand EPUB to the device's reader, then close this screen.
        await launchUrl(Uri.file(f.path),
            mode: LaunchMode.externalApplication);
        if (mounted) Navigator.of(context).pop();
        return;
      }
      setState(() => _path = f.path);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _loadResume() async {
    final api = context.read<AppState>().api;
    final uid = api.session?.profileId;
    if (uid == null) return;
    try {
      final rows = await api.select("book_progress", query: {
        "select": "page,percent",
        "user_id": "eq.$uid",
        "book_id": "eq.${widget.bookId}",
        "limit": "1",
      });
      if (rows.isNotEmpty) {
        _resumePage = ((rows.first["page"] as num?)?.toInt() ?? 1) - 1;
        if (_resumePage < 0) _resumePage = 0;
      }
    } catch (_) {
      // No saved progress (or the table isn't deployed) — start at page 1.
    }
  }

  void _queueSave() {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(seconds: 2), _save);
  }

  Future<void> _save() async {
    if (_pages <= 0) return;
    final api = context.read<AppState>().api;
    final uid = api.session?.profileId;
    if (uid == null) return;
    final percent = ((_page + 1) / _pages * 100).clamp(0, 100);
    try {
      await api.upsert(
        "book_progress",
        {
          "user_id": uid,
          "book_id": widget.bookId,
          "page": _page + 1,
          "percent": double.parse(percent.toStringAsFixed(2)),
          "updated_at": DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: "user_id,book_id",
      );
    } catch (_) {
      // Progress is best-effort; reading continues regardless.
    }
  }

  Future<void> _jumpToPage() async {
    final ctrl = TextEditingController(text: "${_page + 1}");
    final target = await showDialog<int>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Go to page", "စာမျက်နှာ သွားရန်")),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          autofocus: true,
          decoration: InputDecoration(
            labelText: "1 – $_pages",
            isDense: true,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(tr(ctx, "Cancel", "မလုပ်တော့")),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(ctx, int.tryParse(ctrl.text.trim())),
            child: Text(tr(ctx, "Go", "သွားမည်")),
          ),
        ],
      ),
    );
    if (target == null || target < 1 || target > _pages) return;
    await _ctrl?.setPage(target - 1);
  }

  @override
  Widget build(BuildContext context) {
    final progress = _pages > 0 ? (_page + 1) / _pages : 0.0;
    return Scaffold(
      backgroundColor: _night ? Colors.black : GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(widget.title,
            maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          if (_path != null) ...[
            IconButton(
              tooltip: tr(context, "Night mode", "ညအမြင်"),
              icon: Icon(_night ? Icons.light_mode : Icons.dark_mode),
              onPressed: () => setState(() => _night = !_night),
            ),
            IconButton(
              tooltip: tr(context, "Page layout", "စာမျက်နှာ အပြင်အဆင်"),
              icon: Icon(_horizontal ? Icons.swap_horiz : Icons.swap_vert),
              onPressed: () => setState(() => _horizontal = !_horizontal),
            ),
            IconButton(
              tooltip: tr(context, "Go to page", "စာမျက်နှာ သွားရန်"),
              icon: const Icon(Icons.format_list_numbered),
              onPressed: _pages > 0 ? _jumpToPage : null,
            ),
          ],
        ],
        bottom: _pages > 0
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: LinearProgressIndicator(
                  value: progress,
                  minHeight: 3,
                  backgroundColor: GwColors.lineOf(context),
                  valueColor:
                      const AlwaysStoppedAnimation(GwColors.primary),
                ),
              )
            : null,
      ),
      body: _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 40, color: GwColors.live),
                    const SizedBox(height: 10),
                    Text(
                      tr(context, "Couldn't open this book",
                          "ဒီစာအုပ် မဖွင့်နိုင်ပါ"),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(_error!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 12,
                            color: GwColors.inkSoftOf(context))),
                  ],
                ),
              ),
            )
          : _path == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 42,
                        height: 42,
                        child: CircularProgressIndicator(
                          color: GwColors.primary,
                          value: _downloaded > 0 ? _downloaded : null,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _downloaded > 0
                            ? "${(_downloaded * 100).round()}%"
                            : tr(context, "Opening…", "ဖွင့်နေသည်…"),
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context),
                            fontSize: 13),
                      ),
                    ],
                  ),
                )
              : Stack(
                  children: [
                    PDFView(
                      filePath: _path!,
                      defaultPage: _resumePage,
                      swipeHorizontal: _horizontal,
                      autoSpacing: !_horizontal,
                      pageFling: _horizontal,
                      pageSnap: _horizontal,
                      nightMode: _night,
                      fitPolicy: FitPolicy.BOTH,
                      onRender: (pages) =>
                          setState(() => _pages = pages ?? 0),
                      onViewCreated: (c) => _ctrl = c,
                      onPageChanged: (page, total) {
                        setState(() {
                          _page = page ?? 0;
                          _pages = total ?? _pages;
                        });
                        _queueSave();
                      },
                      onError: (e) =>
                          setState(() => _error = e.toString()),
                    ),
                    if (_pages > 0)
                      Positioned(
                        bottom: 16,
                        left: 0,
                        right: 0,
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              "${_page + 1} / $_pages",
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
    );
  }
}
