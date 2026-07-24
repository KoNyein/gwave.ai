import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'audio_api.dart';
import 'audio_models.dart';
import 'audio_track_screen.dart';

/// Native Gwave Audio store — Music / Podcasts / Audiobooks, played and bought
/// through the same G-Pay-backed catalogue as the web `/audio` page, but as a
/// first-class Flutter screen (no webview). Bilingual: shows Burmese when the
/// app language is Burmese.
class AudioHubScreen extends StatefulWidget {
  const AudioHubScreen({super.key});

  @override
  State<AudioHubScreen> createState() => _AudioHubScreenState();
}

class _AudioHubScreenState extends State<AudioHubScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.bg,
      appBar: AppBar(
        title: Text(tr(context, "Audio", "အသံ")),
        actions: [
          IconButton(
            tooltip: tr(context, "All-access", "အားလုံးဝင်ရောက်ခွင့်"),
            icon: const Icon(Icons.workspace_premium_outlined),
            onPressed: _openSubscribe,
          ),
          IconButton(
            tooltip: tr(context, "Share", "မျှဝေ"),
            icon: const Icon(Icons.ios_share),
            onPressed: () => Share.share("${AppConfig.apiBase}/audio"),
          ),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: GwColors.primary,
          unselectedLabelColor: GwColors.inkSoft,
          indicatorColor: GwColors.primary,
          tabs: [
            Tab(text: audioKindLabel(context, AudioKind.music)),
            Tab(text: audioKindLabel(context, AudioKind.podcast)),
            Tab(text: audioKindLabel(context, AudioKind.audiobook)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _BrowseList(kind: AudioKind.music),
          _BrowseList(kind: AudioKind.podcast),
          _BrowseList(kind: AudioKind.audiobook),
        ],
      ),
    );
  }

  Future<void> _openSubscribe() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const _SubscribeSheet(),
    );
  }
}

/// One format's scrollable catalogue with pull-to-refresh.
class _BrowseList extends StatefulWidget {
  const _BrowseList({required this.kind});
  final AudioKind kind;

  @override
  State<_BrowseList> createState() => _BrowseListState();
}

class _BrowseListState extends State<_BrowseList>
    with AutomaticKeepAliveClientMixin {
  List<AudioTrack> _tracks = [];
  bool _loading = true;
  String? _error;

  @override
  bool get wantKeepAlive => true;

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
      final api = context.read<AppState>().api;
      final rows = await AudioApi(api).browse(widget.kind);
      if (!mounted) return;
      setState(() => _tracks = rows);
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: GwColors.primary));
    }
    if (_error != null) {
      return _ErrorRetry(message: _error!, onRetry: _load);
    }
    if (_tracks.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.18),
            GwEmpty(
              icon: audioKindIcon(widget.kind),
              title: tr(context, "Nothing here yet", "ဒီမှာ ဘာမှမရှိသေးပါ"),
              subtitle: tr(context, "New releases land here — pull to refresh.",
                  "အသစ်များ ဒီနေရာမှာ ရောက်လာပါမယ် — ဆွဲချ၍ ပြန်လည်စစ်ဆေးပါ။"),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      color: GwColors.primary,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
        itemCount: _tracks.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _TrackCard(
          track: _tracks[i],
          onTap: () => _open(_tracks[i]),
        ),
      ),
    );
  }

  Future<void> _open(AudioTrack t) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => AudioTrackScreen(track: t)),
    );
    // A purchase or new progress made on the detail screen might change badges.
    if (mounted) _load();
  }
}

/// A modern catalogue card: cover art, title, format-specific subtitle, and a
/// price / Free / Premium badge.
class _TrackCard extends StatelessWidget {
  const _TrackCard({required this.track, required this.onTap});
  final AudioTrack track;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final cover = resolveMedia(track.coverUrl, bucket: "media");
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            _cover(cover),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    track.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                        color: GwColors.ink),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _subtitle(context),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        color: GwColors.inkSoft, fontSize: 13),
                  ),
                  const SizedBox(height: 7),
                  Row(children: _badges(context)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: GwColors.inkSoft),
          ],
        ),
      ),
    );
  }

  Widget _cover(String? url) {
    const size = 66.0;
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: (url != null)
          ? CachedNetworkImage(
              imageUrl: url,
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholder: (_, __) => _coverPh(size),
              errorWidget: (_, __, ___) => _coverPh(size),
            )
          : _coverPh(size),
    );
  }

  Widget _coverPh(double size) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [GwColors.primaryBright, GwColors.primary],
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(audioKindIcon(track.kind),
            color: Colors.white.withValues(alpha: 0.9), size: 28),
      );

  String _subtitle(BuildContext context) {
    switch (track.kind) {
      case AudioKind.music:
        final bits = [track.artist, track.album].where((s) => s != null && s.isNotEmpty);
        return bits.isEmpty ? tr(context, "Single", "တစ်ပုဒ်") : bits.join(" · ");
      case AudioKind.audiobook:
        final by = track.author;
        final nar = track.narrator;
        if (by != null && nar != null) {
          return tr(context, "$by · Narrated by $nar", "$by · အသံဖတ် $nar");
        }
        return by ?? tr(context, "Audiobook", "အသံစာအုပ်");
      case AudioKind.podcast:
        if (track.episodeNo != null) {
          return tr(context, "Episode ${track.episodeNo}", "အပိုင်း ${track.episodeNo}");
        }
        return tr(context, "Podcast", "ပို့တ်ကာစ်");
    }
  }

  List<Widget> _badges(BuildContext context) {
    final out = <Widget>[];
    if (track.isPurchasable) {
      out.add(_pill(money((track.price ?? 0).toDouble(), track.currency ?? "USD"),
          GwColors.primary));
    } else {
      out.add(_pill(tr(context, "Free", "အခမဲ့"), const Color(0xFF2E9E5B)));
    }
    if (track.durationS != null && track.durationS! > 0) {
      out.add(const SizedBox(width: 6));
      out.add(_pill(fmtClock(track.durationS!), GwColors.inkSoft, soft: true));
    }
    if (track.kind == AudioKind.music && track.musicKey != null) {
      out.add(const SizedBox(width: 6));
      out.add(_pill(track.musicKey!, const Color(0xFF7A4DD6), soft: true));
    }
    return out;
  }

  Widget _pill(String text, Color color, {bool soft = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: soft ? 0.10 : 0.14),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(text,
          style: TextStyle(
              color: color, fontWeight: FontWeight.w700, fontSize: 11.5)),
    );
  }
}

/// All-access subscription chooser — buys through `buy_audio_subscription`.
class _SubscribeSheet extends StatefulWidget {
  const _SubscribeSheet();

  @override
  State<_SubscribeSheet> createState() => _SubscribeSheetState();
}

class _SubscribeSheetState extends State<_SubscribeSheet> {
  List<Map<String, dynamic>> _plans = [];
  bool _loading = true;
  String? _busyPlan;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final api = context.read<AppState>().api;
      final rows = await AudioApi(api).plans();
      if (mounted) setState(() => _plans = rows);
    } catch (_) {
      // Sheet still shows an empty state.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _buy(String plan) async {
    setState(() => _busyPlan = plan);
    try {
      await AudioApi(context.read<AppState>().api).subscribe(plan);
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(tr(context, "You're all-access now 🎧",
              "အခုဆို အားလုံးနားဆင်နိုင်ပါပြီ 🎧"))));
    } catch (e) {
      if (mounted) {
        setState(() => _busyPlan = null);
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_msg(e))));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(
                  color: GwColors.line,
                  borderRadius: BorderRadius.circular(2)),
            ),
          ),
          Row(children: [
            const Icon(Icons.workspace_premium, color: GwColors.gold),
            const SizedBox(width: 8),
            Text(tr(context, "Audio All-Access", "အသံ အားလုံးဝင်ရောက်ခွင့်"),
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 18)),
          ]),
          const SizedBox(height: 4),
          Text(
            tr(context, "Play any premium track — paid from your Gwave wallet.",
                "ပရီမီယံ သီချင်းမှန်သမျှ နားဆင်ပါ — Gwave wallet မှ ပေးချေသည်။"),
            style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                  child: CircularProgressIndicator(color: GwColors.primary)),
            )
          else if (_plans.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                tr(context, "No plans available right now.",
                    "လောလောဆယ် အစီအစဉ် မရှိသေးပါ။"),
                style: const TextStyle(color: GwColors.inkSoft),
              ),
            )
          else
            for (final p in _plans) _planTile(p),
        ],
      ),
    );
  }

  Widget _planTile(Map<String, dynamic> p) {
    final plan = p["plan"] as String? ?? "";
    final price = (p["price"] as num?)?.toDouble() ?? 0;
    final ccy = p["currency"] as String? ?? "USD";
    final days = (p["days"] as num?)?.toInt() ?? 30;
    final label = p["label"] as String? ?? plan;
    final busy = _busyPlan == plan;
    final per = days >= 360
        ? tr(context, "per year", "တစ်နှစ်လျှင်")
        : tr(context, "per month", "တစ်လလျှင်");
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: GwColors.surfaceMuted,
        borderRadius: BorderRadius.circular(GwRadius.lg),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        title: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text("${money(price, ccy)} · $per",
            style: const TextStyle(color: GwColors.inkSoft)),
        trailing: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4))
            : ElevatedButton(
                onPressed: _busyPlan == null ? () => _buy(plan) : null,
                child: Text(tr(context, "Subscribe", "စာရင်းသွင်း")),
              ),
      ),
    );
  }
}

String _msg(Object e) {
  final s = e.toString();
  return s.startsWith("Exception: ") ? s.substring(11) : s;
}

/// A tidy inline error with a retry button, matching the app's other screens.
class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: GwColors.inkSoft),
            const SizedBox(height: 12),
            Text(
              tr(context, "Couldn't load the store.",
                  "စတိုးကို ဖွင့်၍မရပါ။"),
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: GwColors.inkSoft, fontSize: 12)),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(tr(context, "Retry", "ထပ်ကြိုးစား")),
            ),
          ],
        ),
      ),
    );
  }
}
