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

/// Native Minerals — browse the public `minerals` reference table with search,
/// category chips and a fact-sheet detail screen (hardness, density, uses).
class MineralsScreen extends StatefulWidget {
  const MineralsScreen({super.key});

  @override
  State<MineralsScreen> createState() => _MineralsScreenState();
}

class _MineralsScreenState extends State<MineralsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String? _category;
  List<String> _categories = [];
  List<Mineral> _minerals = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    try {
      final cats = await context.read<AppState>().repo.mineralCategories();
      if (mounted) setState(() => _categories = cats);
    } catch (_) {}
    await _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final m = await context
          .read<AppState>()
          .repo
          .minerals(q: _search.text, category: _category);
      if (mounted) setState(() => _minerals = m);
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
      appBar: AppBar(title: const Text("Minerals")),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: TextField(
              controller: _search,
              onChanged: _onSearch,
              decoration: const InputDecoration(
                hintText: "သတ္တု / ဓာတ်သတ္တု ရှာရန်…",
                prefixIcon: Icon(Icons.search),
                isDense: true,
              ),
            ),
          ),
          if (_categories.isNotEmpty)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                children: [
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      selected: _category == null,
                      onSelected: (_) {
                        setState(() => _category = null);
                        _load();
                      },
                      label: const Text("All"),
                      selectedColor: GwColors.primary.withValues(alpha: 0.15),
                    ),
                  ),
                  for (final c in _categories)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        selected: _category == c,
                        onSelected: (_) {
                          setState(() =>
                              _category = _category == c ? null : c);
                          _load();
                        },
                        label: Text(c),
                        selectedColor:
                            GwColors.primary.withValues(alpha: 0.15),
                      ),
                    ),
                ],
              ),
            ),
          Expanded(
            child: RefreshIndicator(
              color: GwColors.primary,
              onRefresh: _load,
              child: _loading && _minerals.isEmpty
                  ? Center(
                      child:
                          CircularProgressIndicator(color: GwColors.primary))
                  : _error != null && _minerals.isEmpty
                      ? ListView(children: [
                          const SizedBox(height: 80),
                          GwEmpty(
                              icon: Icons.cloud_off,
                              title: "Couldn't load minerals",
                              subtitle: _error),
                        ])
                      : _minerals.isEmpty
                          ? ListView(children: const [
                              SizedBox(height: 80),
                              GwEmpty(
                                  icon: Icons.diamond_outlined,
                                  title: "မတွေ့ပါ"),
                            ])
                          : GridView.builder(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 6, 16, 40),
                              gridDelegate:
                                  const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                mainAxisSpacing: 12,
                                crossAxisSpacing: 12,
                                childAspectRatio: 1.05,
                              ),
                              itemCount: _minerals.length,
                              itemBuilder: (_, i) => _card(_minerals[i]),
                            ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card(Mineral m) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => MineralDetailScreen(mineral: m)),
      ),
      child: Container(
        padding: const EdgeInsets.all(12),
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
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF139C9C).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: m.imageUrl != null && m.imageUrl!.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: CachedNetworkImage(
                            imageUrl: m.imageUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Icon(
                                Icons.diamond,
                                color: Color(0xFF139C9C),
                                size: 20),
                          ),
                        )
                      : const Icon(Icons.diamond,
                          color: Color(0xFF139C9C), size: 20),
                ),
                const Spacer(),
                if (m.symbol != null && m.symbol!.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: GwColors.surfaceMuted,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(m.symbol!,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 12)),
                  ),
              ],
            ),
            const Spacer(),
            Text(m.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 14.5)),
            const SizedBox(height: 2),
            Text(m.category,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    TextStyle(color: GwColors.inkSoft, fontSize: 12)),
            if (m.hardnessMohs != null) ...[
              const SizedBox(height: 4),
              Text("Mohs ${m.hardnessMohs}",
                  style: TextStyle(
                      color: GwColors.primaryDark,
                      fontWeight: FontWeight.w700,
                      fontSize: 11.5)),
            ],
          ],
        ),
      ),
    );
  }
}

class MineralDetailScreen extends StatelessWidget {
  const MineralDetailScreen({super.key, required this.mineral});
  final Mineral mineral;

  @override
  Widget build(BuildContext context) {
    final m = mineral;
    return Scaffold(
      appBar: AppBar(title: Text(m.name)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 40),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    if (m.symbol != null && m.symbol!.isNotEmpty)
                      Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color:
                              const Color(0xFF139C9C).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Center(
                          child: Text(m.symbol!,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 18,
                                  color: Color(0xFF139C9C))),
                        ),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(m.name,
                              style: const TextStyle(
                                  fontSize: 19, fontWeight: FontWeight.w900)),
                          Text(m.category,
                              style: TextStyle(
                                  color: GwColors.inkSoft, fontSize: 13)),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 24),
                if (m.hardnessMohs != null)
                  _fact("💠 မာကျောမှု (Mohs)", "${m.hardnessMohs} / 10"),
                if (m.density != null)
                  _fact("⚖️ သိပ်သည်းဆ", "${m.density} g/cm³"),
              ],
            ),
          ),
          if (m.description != null && m.description!.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section("အကြောင်းအရာ",
                Text(m.description!, style: const TextStyle(height: 1.5))),
          ],
          if (m.uses.isNotEmpty) ...[
            const SizedBox(height: 12),
            _section(
              "အသုံးပြုပုံများ",
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final u in m.uses)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("• ",
                              style: TextStyle(
                                  color: GwColors.primary,
                                  fontWeight: FontWeight.w900)),
                          Expanded(
                              child: Text(u,
                                  style: const TextStyle(height: 1.4))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          _commentsButton(context, "mineral", m.id, m.name),
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
                    Text(
                        tr(context, "Comments & experience",
                            "မှတ်ချက် နှင့် အတွေ့အကြုံ"),
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

  Widget _fact(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(k,
                style:
                    TextStyle(color: GwColors.inkSoft, fontSize: 13)),
            Text(v,
                style:
                    const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
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
}
