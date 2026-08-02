import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';
import '../live/live_watch_screen.dart';

/// Teacher-hosted live classes — the app twin of `/learn/live`. Live classes
/// play natively (same player as Live); hosting a class and applying to teach
/// stay on the web where the teacher tools live.
class LiveClassesScreen extends StatefulWidget {
  const LiveClassesScreen({super.key});

  @override
  State<LiveClassesScreen> createState() => _LiveClassesScreenState();
}

class _LiveClassesScreenState extends State<LiveClassesScreen> {
  List<LiveStream> _classes = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final c = await context.read<AppState>().repo.learnClasses();
      if (mounted) setState(() => _classes = c);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    final live = _classes.where((c) => c.isLive).toList();
    final rest = _classes.where((c) => !c.isLive).toList();
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Live Classes", "Live အတန်းများ")),
        actions: [
          TextButton(
            onPressed: () => _openWeb("/learn/teach"),
            child: Text(tr(context, "Teach", "ဆရာလုပ်မယ်")),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _classes.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: GwColors.primaryGradient,
                      borderRadius: BorderRadius.circular(GwRadius.lg),
                      boxShadow: GwShadow.card,
                    ),
                    child: Row(
                      children: [
                        const Text("🎓", style: TextStyle(fontSize: 34)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                  tr(context, "Learn with a teacher",
                                      "ဆရာနှင့်အတူ သင်ယူမယ်"),
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 16,
                                      fontWeight: FontWeight.w900)),
                              const SizedBox(height: 2),
                              Text(
                                  tr(
                                      context,
                                      "Join live classes hosted by real teachers",
                                      "ဆရာအစစ်တွေ သင်ကြားပေးတဲ့ live အတန်းများ"),
                                  style: const TextStyle(
                                      color: Colors.white70, fontSize: 12.5)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Zoom-style class room runs on the web (WebRTC video grid).
                  InkWell(
                    borderRadius: BorderRadius.circular(GwRadius.lg),
                    onTap: () => _openWeb("/meet"),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: GwColors.surfaceOf(context),
                        borderRadius: BorderRadius.circular(GwRadius.lg),
                        border: Border.all(
                            color: GwColors.primary.withValues(alpha: 0.35)),
                        boxShadow: GwShadow.card,
                      ),
                      child: Row(
                        children: [
                          const Text("🎥", style: TextStyle(fontSize: 26)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    tr(context, "Live Class Room",
                                        "Live Class Room (Zoom ပုံစံ)"),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 14.5)),
                                Text(
                                    tr(
                                        context,
                                        "Video-grid classroom with screen share (opens in browser)",
                                        "Video grid + screen share (browser တွင် ဖွင့်မည်)"),
                                    style: TextStyle(
                                        color: GwColors.inkSoftOf(context),
                                        fontSize: 12)),
                              ],
                            ),
                          ),
                          Icon(Icons.open_in_new,
                              color: GwColors.inkSoftOf(context), size: 17),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  if (_error != null && _classes.isEmpty)
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: tr(context, "Couldn't load classes",
                            "အတန်းများ မဖွင့်နိုင်ပါ"),
                        subtitle: _error)
                  else if (_classes.isEmpty)
                    GwEmpty(
                      icon: Icons.school_outlined,
                      title: tr(context, "No classes yet", "အတန်း မရှိသေးပါ"),
                      subtitle: tr(
                          context,
                          "Teachers can start one from the web (Teach).",
                          "ဆရာများ web မှ အတန်းစတင်နိုင်ပါသည် (Teach)။"),
                    )
                  else ...[
                    if (live.isNotEmpty) ...[
                      Text(tr(context, "🔴 Live now", "🔴 ယခု လွင့်နေသည်"),
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      for (final c in live) _classTile(c),
                      const SizedBox(height: 12),
                    ],
                    if (rest.isNotEmpty) ...[
                      Text(tr(context, "Recent classes", "မကြာသေးမီက အတန်းများ"),
                          style: const TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      for (final c in rest) _classTile(c),
                    ],
                  ],
                ],
              ),
      ),
    );
  }

  Widget _classTile(LiveStream c) {
    final host = c.host?.displayName ?? "Teacher";
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.md),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => LiveWatchScreen(stream: c)),
          );
        },
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.md),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              GwAvatar(
                  url: resolveMedia(c.host?.avatarUrl), name: host, size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 14.5)),
                    Row(
                      children: [
                        Text(host,
                            style: TextStyle(
                                color: GwColors.inkSoftOf(context), fontSize: 12)),
                        if (c.createdAt != null) ...[
                          Text(" · ",
                              style: TextStyle(color: GwColors.inkSoftOf(context))),
                          Text(timeAgo(c.createdAt!),
                              style: TextStyle(
                                  color: GwColors.inkSoftOf(context), fontSize: 12)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (c.isLive)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: GwColors.live,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text("LIVE",
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w900)),
                )
              else
                Icon(Icons.play_circle_outline,
                    color: GwColors.inkSoftOf(context), size: 22),
            ],
          ),
        ),
      ),
    );
  }
}
