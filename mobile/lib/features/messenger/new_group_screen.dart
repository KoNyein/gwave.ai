import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';

/// Name a group and pick who's in it. Pops the created [Conversation] so the
/// caller can push straight into the chat.
class NewGroupScreen extends StatefulWidget {
  const NewGroupScreen({super.key});

  @override
  State<NewGroupScreen> createState() => _NewGroupScreenState();
}

class _NewGroupScreenState extends State<NewGroupScreen> {
  final _name = TextEditingController();
  final _search = TextEditingController();
  final _picked = <String, Profile>{};
  List<Profile> _friends = [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await context.read<AppState>().repo.friends();
      if (!mounted) return;
      setState(() => _friends = rows.map((f) => f.other).toList());
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Profile> get _visible {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return _friends;
    return _friends
        .where((f) =>
            f.displayName.toLowerCase().contains(q) ||
            (f.username ?? "").toLowerCase().contains(q))
        .toList();
  }

  Future<void> _create() async {
    final title = _name.text.trim();
    if (title.isEmpty) {
      _toast(tr(context, "Name the group first.", "အုပ်စုအမည် အရင်ဖြည့်ပါ။"));
      return;
    }
    if (_picked.isEmpty) {
      _toast(tr(context, "Pick at least one friend.",
          "သူငယ်ချင်း အနည်းဆုံး တစ်ယောက် ရွေးပါ။"));
      return;
    }
    setState(() => _saving = true);
    try {
      final convo = await context
          .read<AppState>()
          .repo
          .createGroupConversation(title, _picked.values.toList());
      if (mounted) Navigator.of(context).pop(convo);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _toast("$e");
      }
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "New group", "အုပ်စုအသစ်")),
        actions: [
          TextButton(
            onPressed: _saving ? null : _create,
            child: _saving
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Text(tr(context, "Create", "ဖွဲ့မည်"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        color: GwColors.primary)),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
            child: TextField(
              controller: _name,
              textCapitalization: TextCapitalization.sentences,
              maxLength: 80,
              decoration: InputDecoration(
                labelText: tr(context, "Group name", "အုပ်စုအမည်"),
                prefixIcon: const Icon(Icons.groups),
                counterText: "",
              ),
            ),
          ),
          if (_picked.isNotEmpty)
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                children: _picked.values
                    .map((p) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Chip(
                            label: Text(p.displayName),
                            onDeleted: () =>
                                setState(() => _picked.remove(p.id)),
                          ),
                        ))
                    .toList(),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: tr(context, "Search friends", "သူငယ်ချင်း ရှာရန်"),
                prefixIcon: const Icon(Icons.search),
                isDense: true,
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(color: GwColors.primary))
                : _friends.isEmpty
                    ? GwEmpty(
                        icon: Icons.person_add_alt,
                        title: tr(context, "No friends yet",
                            "သူငယ်ချင်း မရှိသေးပါ"),
                        subtitle: _error)
                    : ListView.builder(
                        itemCount: _visible.length,
                        itemBuilder: (_, i) {
                          final f = _visible[i];
                          final on = _picked.containsKey(f.id);
                          return CheckboxListTile(
                            value: on,
                            activeColor: GwColors.primary,
                            controlAffinity: ListTileControlAffinity.trailing,
                            onChanged: (_) => setState(() {
                              if (on) {
                                _picked.remove(f.id);
                              } else {
                                _picked[f.id] = f;
                              }
                            }),
                            secondary: GwAvatar(
                                url: resolveMedia(f.avatarUrl),
                                name: f.displayName,
                                size: 44),
                            title: Text(f.displayName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: f.username != null
                                ? Text("@${f.username}",
                                    style: const TextStyle(
                                        color: GwColors.inkSoft, fontSize: 12))
                                : null,
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
