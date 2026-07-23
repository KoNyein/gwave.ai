import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'subject_comments_sheet.dart';

const _typeColors = <String, Color>{
  "indica": Color(0xFF7A4DD6),
  "sativa": Color(0xFFCB6D1E),
  "hybrid": Color(0xFF2E9E5B),
};

/// Native Strains — Leafly-style browse over the public `strains` table:
/// search, type filter, THC/CBD at a glance, and a full detail screen.
class StrainsScreen extends StatefulWidget {
  const StrainsScreen({super.key});

  @override
  State<StrainsScreen> createState() => _StrainsScreenState();
}

class _StrainsScreenState extends State<StrainsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String? _type;
  List<Strain> _strains = [];
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
    try {
      final s = await context
          .read<AppState>()
          .repo
          .strains(q: _search.text, type: _type);
      if (mounted) setState(() => _strains = s);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Strains")),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _search,
              onChanged: _onSearch,
              decoration: const InputDecoration(
                hintText: "မျိုးကွဲ ရှာရန်…",
                prefixIcon: Icon(Icons.search),
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
                  child: ChoiceChip(
                    selected: _type == null,
                    onSelected: (_) {
                      setState(() => _type = null);
                      _load();
                    },
                    label: const Text("All"),
                    selectedColor: GwColors.primary.withValues(alpha: 0.15),
                  ),
                ),
                for (final t in const ["indica", "sativa", "hybrid"])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _type == t,
                      onSelected: (_) {
                        setState(() => _type = _type == t ? null : t);
                        _load();
                      },
                      label: Text(t[0].toUpperCase() + t.substring(1)),
                      selectedColor:
                          (_typeColors[t] ?? GwColors.primary).withValues(alpha: 0.18),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: GwColors.primary,
              onRefresh: _load,
              child: _loading && _strains.isEmpty
                  ? Center(
                      child:
                          CircularProgressIndicator(color: GwColors.primary))
                  : _error != null && _strains.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 80),
                          GwEmpty(
                              icon: Icons.cloud_off,
                              title: "Couldn't load strains",
                              subtitle: _error),
                        ])
                      : _strains.isEmpty
                          ? ListView(children: const [
                              SizedBox(height: 80),
                              GwEmpty(
                                  icon: Icons.eco_outlined,
                                  title: "မတွေ့ပါ"),
                            ])
                          : ListView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 6, 16, 40),
                              itemCount: _strains.length,
                              itemBuilder: (_, i) => _card(_strains[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(Strain s) {
    final color = _typeColors[s.type] ?? GwColors.primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => StrainDetailScreen(strain: s)),
        ),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              _thumb(s, color, 64),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(s.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 15.5)),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        GwPill(label: s.type.toUpperCase(), color: color),
                        const SizedBox(width: 8),
                        if (s.thc != null)
                          Text("THC ${s.thc}%",
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: GwColors.inkSoft)),
                        if (s.cbd != null) ...[
                          const SizedBox(width: 8),
                          Text("CBD ${s.cbd}%",
                              style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: GwColors.inkSoft)),
                        ],
                      ],
                    ),
                    if (s.effects.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(s.effects.take(3).join(" · "),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                              fontSize: 12, color: GwColors.inkSoft)),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: GwColors.inkSoft),
            ],
          ),
        ),
      ),
    );
  }

  Widget _thumb(Strain s, Color color, double size) => ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          width: size,
          height: size,
          child: s.imageUrl != null && s.imageUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: s.imageUrl!,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => _ph(color),
                  placeholder: (_, __) => _ph(color),
                )
              : _ph(color),
        ),
      );

  Widget _ph(Color color) => Container(
        color: color.withValues(alpha: 0.12),
        child: Icon(Icons.eco, color: color, size: 28),
      );
}

class StrainDetailScreen extends StatelessWidget {
  const StrainDetailScreen({super.key, required this.strain});
  final Strain strain;

  @override
  Widget build(BuildContext context) {
    final s = strain;
    final color = _typeColors[s.type] ?? GwColors.primary;
    return Scaffold(
      appBar: AppBar(title: Text(s.name)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 40),
        children: [
          // Header card with potency bars
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    GwPill(label: s.type.toUpperCase(), color: color),
                    const Spacer(),
                    if (s.growDifficulty != null)
                      GwPill(
                          label: "Grow: ${s.growDifficulty}",
                          color: GwColors.inkSoft),
                  ],
                ),
                const SizedBox(height: 14),
                if (s.thc != null) _bar("THC", s.thc!, 30, GwColors.live),
                if (s.cbd != null) _bar("CBD", s.cbd!, 20, GwColors.primary),
                if (s.floweringWeeks != null ||
                    s.yieldIndoor != null ||
                    s.yieldOutdoor != null) ...[
                  const Divider(height: 24),
                  if (s.floweringWeeks != null)
                    _fact("🌸 ပန်းပွင့်ချိန်", "${s.floweringWeeks} ပတ်"),
                  if (s.yieldIndoor != null)
                    _fact("🏠 အထွက် (အတွင်း)", s.yieldIndoor!),
                  if (s.yieldOutdoor != null)
                    _fact("🌤 အထွက် (အပြင်)", s.yieldOutdoor!),
                ],
              ],
            ),
          ),
          if (s.description != null && s.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section("အကြောင်းအရာ",
                Text(s.description!, style: const TextStyle(height: 1.5))),
          ],
          if (s.effects.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section("Effects", _chips(s.effects, color)),
          ],
          if (s.flavors.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section("Flavors", _chips(s.flavors, GwColors.gold)),
          ],
          if (s.terpenes.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section("Terpenes", _chips(s.terpenes, GwColors.primary)),
          ],
          const SizedBox(height: 12),
          _commentsButton(context, "strain", s.id, s.name),
        ],
      ),
    );
  }

  Widget _commentsButton(
          BuildContext context, String type, String id, String title) =>
      GestureDetector(
        onTap: () => SubjectCommentsSheet.show(context,
            subjectType: type, subjectId: id, title: title),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(Icons.forum_outlined,
                    color: GwColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tr(context, "Comments & experience", "မှတ်ချက် နှင့် အတွေ့အကြုံ"),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 14.5)),
                    const SizedBox(height: 2),
                    Text(
                        tr(context, "Share a photo, voice note or video",
                            "ဓာတ်ပုံ၊ အသံ သို့မဟုတ် ဗီဒီယို မျှဝေရန်"),
                        style: TextStyle(
                            color: GwColors.inkSoft, fontSize: 12)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: GwColors.inkSoft),
            ],
          ),
        ),
      );

  Widget _bar(String label, double v, double max, Color color) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: [
            SizedBox(
                width: 44,
                child: Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 13))),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: (v / max).clamp(0, 1),
                  minHeight: 9,
                  backgroundColor: GwColors.surfaceMuted,
                  valueColor: AlwaysStoppedAnimation(color),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text("$v%",
                style:
                    const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          ],
        ),
      );

  Widget _fact(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k, style: TextStyle(color: GwColors.inkSoft, fontSize: 13)),
            Text(v,
                style:
                    const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
      );

  Widget _section(String title, Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5)),
            const SizedBox(height: 10),
            child,
          ],
        ),
      );

  Widget _chips(List<String> items, Color color) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final it in items)
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(it,
                  style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12.5)),
            ),
        ],
      );
}
