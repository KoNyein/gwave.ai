import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'ptt_channel_screen.dart';

/// Native Walkie-talkie home: create a channel, join one with a code, and open
/// any of your channels in the fully native push-to-talk console.
class TalkScreen extends StatefulWidget {
  const TalkScreen({super.key});

  @override
  State<TalkScreen> createState() => _TalkScreenState();
}

class _TalkScreenState extends State<TalkScreen> {
  List<PttChannel> _channels = [];
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
      final c = await context.read<AppState>().repo.myPttChannels();
      if (mounted) setState(() => _channels = c);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openChannel(PttChannel c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => PttChannelScreen(channel: c)),
    );
    _load();
  }

  Future<void> _createChannel() async {
    final name = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "New channel", "Channel အသစ်")),
        content: TextField(
          controller: name,
          autofocus: true,
          maxLength: 80,
          decoration: InputDecoration(
            hintText: tr(ctx, "Channel name (e.g. Farm crew)",
                "Channel အမည် (ဥပမာ — လယ်သမားအဖွဲ့)"),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "Create", "ဖွင့်မည်"))),
        ],
      ),
    );
    final trimmed = name.text.trim();
    name.dispose();
    if (ok != true || trimmed.isEmpty || !mounted) return;
    try {
      final channel =
          await context.read<AppState>().repo.createPttChannel(trimmed);
      if (!mounted) return;
      await _load();
      if (mounted) _openChannel(channel);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't create the channel — $e")),
        );
      }
    }
  }

  Future<void> _joinByCode() async {
    final code = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Join with code", "Code ဖြင့် ဝင်ရန်")),
        content: TextField(
          controller: code,
          autofocus: true,
          maxLength: 12,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(hintText: "ABC123"),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Cancel", "မလုပ်တော့ပါ"))),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(tr(ctx, "Join", "ဝင်မည်"))),
        ],
      ),
    );
    final trimmed = code.text.trim().toUpperCase();
    code.dispose();
    if (ok != true || trimmed.isEmpty || !mounted) return;
    try {
      final id = await context.read<AppState>().api.pttJoin(trimmed);
      if (!mounted) return;
      await _load();
      if (!mounted) return;
      final joined = _channels.where((c) => c.id == id).toList();
      if (joined.isNotEmpty) {
        _openChannel(joined.first);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Couldn't join — $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Walkie-talkie")),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
          children: [
            // Hero: what PTT is, in one glance.
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: GwColors.primaryGradient,
                borderRadius: BorderRadius.circular(GwRadius.lg),
                boxShadow: GwShadow.card,
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.settings_voice,
                        color: Colors.white, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(tr(context, "🎙️ Push to talk", "🎙️ ခလုတ်ဖိပြီး ပြော"),
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w900)),
                        const SizedBox(height: 2),
                        Text(
                            tr(context, "Everyone in the channel hears you",
                                "Channel ထဲက အားလုံး ကြားရမယ်"),
                            style: const TextStyle(
                                color: Colors.white70, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _createChannel,
                      icon: const Icon(Icons.add, size: 18),
                      label: Text(tr(context, "New channel", "Channel အသစ်")),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _joinByCode,
                      icon: const Icon(Icons.key, size: 18),
                      label: Text(tr(context, "Join with code", "Code ဖြင့် ဝင်ရန်")),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            Text("${tr(context, "My channels", "ကျွန်တော့် Channel များ")}${_channels.isNotEmpty ? " (${_channels.length})" : ""}",
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (_loading && _channels.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(
                    child: CircularProgressIndicator(color: GwColors.primary)),
              )
            else if (_error != null && _channels.isEmpty)
              GwEmpty(
                  icon: Icons.cloud_off,
                  title: "Couldn't load channels",
                  subtitle: _error)
            else if (_channels.isEmpty)
              GwEmpty(
                icon: Icons.radio_outlined,
                title: tr(context, "No channels yet", "Channel မရှိသေးပါ"),
                subtitle: tr(
                    context,
                    "Create a channel and share its join code with your crew.",
                    "Channel အသစ်ဖွင့်ပြီး join code ကို အဖွဲ့သားများထံ ဝေမျှပါ။"),
              )
            else
              ..._channels.map(_channelTile),
          ],
        ),
      ),
    );
  }

  Widget _channelTile(PttChannel c) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: () => _openChannel(c),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: GwColors.surface,
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: GwColors.primary.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: const Icon(Icons.radio, color: GwColors.primary, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(c.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 15)),
                    if (c.joinCode != null)
                      Text("Code: ${c.joinCode}",
                          style: const TextStyle(
                              color: GwColors.inkSoft, fontSize: 11.5)),
                  ],
                ),
              ),
              const Icon(Icons.people_outline,
                  size: 16, color: GwColors.inkSoft),
              const SizedBox(width: 4),
              Text("${c.memberCount}",
                  style: const TextStyle(
                      color: GwColors.inkSoft, fontWeight: FontWeight.w600)),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, color: GwColors.inkSoft),
            ],
          ),
        ),
      ),
    );
  }
}
