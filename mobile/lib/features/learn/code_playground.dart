import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';

/// In-app playground for web-dev lessons: edit the lesson's HTML / CSS / JS
/// starters in three tabs and run the result locally in a WebView — no
/// browser, no server, works offline. The document is assembled the same way
/// as the web CodePlayground (css in <style>, js at the end of <body>).
class NativeCodePlayground extends StatefulWidget {
  const NativeCodePlayground({
    super.key,
    required this.starter,
    required this.accent,
  });

  /// {html, css, js} starter files from the lesson.
  final Map<String, dynamic> starter;
  final Color accent;

  @override
  State<NativeCodePlayground> createState() => _NativeCodePlaygroundState();
}

class _NativeCodePlaygroundState extends State<NativeCodePlayground>
    with SingleTickerProviderStateMixin {
  late final TextEditingController _html =
      TextEditingController(text: (widget.starter["html"] ?? "").toString());
  late final TextEditingController _css =
      TextEditingController(text: (widget.starter["css"] ?? "").toString());
  late final TextEditingController _js =
      TextEditingController(text: (widget.starter["js"] ?? "").toString());
  late final TabController _tabs = TabController(length: 3, vsync: this);

  WebViewController? _web;
  bool _ran = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white);
  }

  @override
  void dispose() {
    _html.dispose();
    _css.dispose();
    _js.dispose();
    _tabs.dispose();
    super.dispose();
  }

  void _run() {
    final doc = """
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${_css.text}</style>
</head>
<body>
${_html.text}
<script>${_js.text}</script>
</body>
</html>
""";
    _web?.loadHtmlString(doc);
    setState(() => _ran = true);
    FocusScope.of(context).unfocus();
  }

  void _reset() {
    setState(() {
      _html.text = (widget.starter["html"] ?? "").toString();
      _css.text = (widget.starter["css"] ?? "").toString();
      _js.text = (widget.starter["js"] ?? "").toString();
    });
  }

  Widget _editor(TextEditingController c, String hint) {
    return Container(
      color: const Color(0xFF1E293B),
      child: TextField(
        controller: c,
        maxLines: null,
        expands: true,
        keyboardType: TextInputType.multiline,
        textAlignVertical: TextAlignVertical.top,
        style: const TextStyle(
          fontFamily: "monospace",
          fontSize: 12.5,
          height: 1.5,
          color: Color(0xFFE2E8F0),
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.white24),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          filled: false,
          contentPadding: const EdgeInsets.all(12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Row(
              children: [
                Text("🧪 ${tr(context, "Try it yourself", "ကိုယ်တိုင် စမ်းရေးကြည့်ပါ")}",
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 15)),
                const Spacer(),
                TextButton(
                  onPressed: _reset,
                  child: Text(tr(context, "Reset", "ပြန်စ"),
                      style: const TextStyle(fontSize: 12.5)),
                ),
              ],
            ),
          ),
          TabBar(
            controller: _tabs,
            labelColor: widget.accent,
            unselectedLabelColor: GwColors.inkSoft,
            indicatorColor: widget.accent,
            labelStyle:
                const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
            tabs: const [
              Tab(text: "HTML", height: 38),
              Tab(text: "CSS", height: 38),
              Tab(text: "JS", height: 38),
            ],
          ),
          SizedBox(
            height: 220,
            child: TabBarView(
              controller: _tabs,
              children: [
                _editor(_html, "<h1>Hello</h1>"),
                _editor(_css, "h1 { color: green; }"),
                _editor(_js, "console.log('hi')"),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                    backgroundColor: widget.accent,
                    foregroundColor: Colors.white),
                onPressed: _run,
                icon: const Icon(Icons.play_arrow, size: 20),
                label: Text(tr(context, "Run ▶", "Run ▶ (ရလဒ်ကြည့်)")),
              ),
            ),
          ),
          if (_ran) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 8, 14, 4),
              child: Text(tr(context, "Result", "ရလဒ်"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 12.5,
                      color: GwColors.inkSoft)),
            ),
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                  bottom: Radius.circular(GwRadius.lg)),
              child: SizedBox(
                height: 260,
                child: _web == null
                    ? const SizedBox.shrink()
                    : WebViewWidget(controller: _web!),
              ),
            ),
          ] else
            const SizedBox(height: 4),
        ],
      ),
    );
  }
}
