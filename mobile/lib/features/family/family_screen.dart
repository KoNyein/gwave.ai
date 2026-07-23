import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:nfc_manager/nfc_manager.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/app_state.dart';
import '../../core/i18n.dart';
import '../../core/models.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../map/map_screen.dart';

/// Native Family locator — replaces the web /family hand-off. Create a family
/// circle or join one with an invite code; each circle card lists its members
/// with their live-location status, a copyable invite code, your own sharing
/// switch, and a jump to the GPS map where everyone appears.
class FamilyScreen extends StatefulWidget {
  const FamilyScreen({super.key});

  @override
  State<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends State<FamilyScreen> {
  final _name = TextEditingController();
  final _code = TextEditingController();
  List<Map<String, dynamic>> _circles = [];
  final Map<String, List<Map<String, dynamic>>> _members = {};
  Map<String, Map<String, dynamic>> _locations = {}; // user_id → row
  bool _loading = true;
  bool _busy = false;
  String? _error;

  // GPS auto-sharing: push my location on open + every 2 minutes while the
  // screen is up, remembered across launches.
  Timer? _autoTimer;
  bool _autoShare = false;
  DateTime? _lastShared;

  @override
  void initState() {
    super.initState();
    _load();
    _initAutoShare();
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _initAutoShare() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() => _autoShare = prefs.getBool("family_auto_share") ?? false);
    if (_autoShare) {
      _pushLocation(silent: true);
      _startAutoTimer();
    }
  }

  void _startAutoTimer() {
    _autoTimer?.cancel();
    _autoTimer = Timer.periodic(
        const Duration(minutes: 2), (_) => _pushLocation(silent: true));
  }

  Future<void> _setAutoShare(bool v) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool("family_auto_share", v);
    if (!mounted) return;
    setState(() => _autoShare = v);
    if (v) {
      await _pushLocation();
      _startAutoTimer();
    } else {
      _autoTimer?.cancel();
    }
  }

  /// Read the GPS once and publish it to member_locations.
  Future<void> _pushLocation({bool silent = false}) async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        if (!silent && mounted) {
          _toast(tr(context, "Location permission denied",
              "တည်နေရာ ခွင့်ပြုချက် မရပါ"));
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      await context.read<AppState>().repo.shareMyLocation(
          pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() => _lastShared = DateTime.now());
      if (!silent) {
        _toast(tr(context, "📍 Location shared", "📍 တည်နေရာ မျှဝေပြီးပါပြီ"));
        _load();
      }
    } catch (e) {
      if (!silent && mounted) _toast("$e");
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = context.read<AppState>().repo;
      final circles = await repo.familyCircles();
      final locs = await repo.familyLocations();
      final byUser = <String, Map<String, dynamic>>{
        for (final l in locs) l["user_id"].toString(): l,
      };
      final members = <String, List<Map<String, dynamic>>>{};
      for (final row in circles) {
        final c = row["circle"];
        if (c is Map && c["id"] != null) {
          final id = c["id"].toString();
          try {
            members[id] = await repo.familyCircleMembers(id);
          } catch (_) {
            members[id] = [];
          }
        }
      }
      if (!mounted) return;
      setState(() {
        _circles = circles;
        _locations = byUser;
        _members
          ..clear()
          ..addAll(members);
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _create() async {
    final name = _name.text.trim();
    if (name.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().repo.createFamilyCircle(name);
      _name.clear();
      await _load();
      _toast(tr(context, "Circle created 👨‍👩‍👧", "မိသားစုအဖွဲ့ ဖွဲ့ပြီးပါပြီ 👨‍👩‍👧"));
    } catch (e) {
      _toast("${tr(context, "Couldn't create", "မဖွဲ့နိုင်ပါ")} — $e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    final code = _code.text.trim();
    if (code.isEmpty || _busy) return;
    setState(() => _busy = true);
    try {
      await context.read<AppState>().repo.joinFamilyCircle(code);
      _code.clear();
      await _load();
      _toast(tr(context, "Joined!", "ဝင်ရောက်ပြီးပါပြီ!"));
    } catch (e) {
      _toast("${tr(context, "Couldn't join", "မဝင်နိုင်ပါ")} — $e");
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleSharing(String circleId, bool enabled) async {
    try {
      await context.read<AppState>().repo.setFamilySharing(circleId, enabled);
      await _load();
    } catch (e) {
      _toast("$e");
    }
  }

  Future<void> _leave(String circleId, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, "Leave \"$name\"?", "\"$name\" မှ ထွက်မလား?")),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(tr(ctx, "Stay", "မထွက်ပါ"))),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: GwColors.live),
            child: Text(tr(ctx, "Leave", "ထွက်မည်")),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<AppState>().repo.leaveFamilyCircle(circleId);
      await _load();
    } catch (e) {
      _toast("$e");
    }
  }

  void _toast(String m) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
    }
  }

  // ---- NFC: write a circle's invite code to a tag / join by tapping one ----

  Future<bool> _nfcReady() async {
    final ok = await NfcManager.instance.isAvailable();
    if (!ok && mounted) {
      _toast(tr(context, "NFC is off or not supported on this phone.",
          "ဒီဖုန်းမှာ NFC ပိတ်ထား/မပါပါ။"));
    }
    return ok;
  }

  Future<void> _nfcWrite(String code) async {
    if (!await _nfcReady()) return;
    if (!mounted) return;
    _toast(tr(context, "Hold an NFC tag against the phone...",
        "NFC tag ကို ဖုန်းနောက်ကျောမှာ ကပ်ထားပါ..."));
    NfcManager.instance.startSession(onDiscovered: (tag) async {
      try {
        final ndef = Ndef.from(tag);
        if (ndef == null || !ndef.isWritable) {
          throw Exception("Tag can't be written");
        }
        await ndef.write(
            NdefMessage([NdefRecord.createText("gwave-family:$code")]));
        if (mounted) {
          _toast(tr(context, "✓ Tag written — family can tap it to join",
              "✓ Tag ရေးပြီးပါပြီ — မိသားစုက ကပ်ရုံနဲ့ ဝင်နိုင်ပါပြီ"));
        }
      } catch (e) {
        if (mounted) _toast("$e");
      } finally {
        NfcManager.instance.stopSession();
      }
    });
  }

  Future<void> _nfcJoin() async {
    if (!await _nfcReady()) return;
    if (!mounted) return;
    _toast(tr(context, "Tap the family NFC tag...",
        "မိသားစု NFC tag ကို ကပ်ပါ..."));
    NfcManager.instance.startSession(onDiscovered: (tag) async {
      try {
        final msg = await Ndef.from(tag)?.read();
        String? code;
        for (final r in msg?.records ?? const <NdefRecord>[]) {
          final text = _ndefText(r);
          if (text == null) continue;
          code = text.startsWith("gwave-family:")
              ? text.substring("gwave-family:".length)
              : (code ?? text.trim());
        }
        if (code == null || code.isEmpty) {
          throw Exception("No invite code on this tag");
        }
        if (!mounted) return;
        await context.read<AppState>().repo.joinFamilyCircle(code);
        if (mounted) {
          _toast(tr(context, "Joined!", "ဝင်ရောက်ပြီးပါပြီ!"));
          _load();
        }
      } catch (e) {
        if (mounted) _toast("$e");
      } finally {
        NfcManager.instance.stopSession();
      }
    });
  }

  /// Decode an NDEF well-known Text record ("T"): payload is
  /// [status byte][language code][text].
  String? _ndefText(NdefRecord r) {
    try {
      if (r.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
          r.type.length == 1 &&
          r.type.first == 0x54) {
        final langLen = r.payload.first & 0x3F;
        return String.fromCharCodes(r.payload.skip(1 + langLen));
      }
    } catch (_) {}
    return null;
  }

  void _openNearbyFinder() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: GwColors.surface,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      builder: (_) => const _NearbyFinderSheet(),
    );
  }

  String get _myId => context.read<AppState>().api.session!.profileId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Family locator", "မိသားစု တည်နေရာ")),
        actions: [
          IconButton(
            tooltip: tr(context, "GPS Map", "မြေပုံ"),
            icon: const Icon(Icons.map_outlined),
            onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const MapScreen())),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: GwColors.primary,
        onRefresh: _load,
        child: _loading && _circles.isEmpty
            ? const Center(
                child: CircularProgressIndicator(color: GwColors.primary))
            : ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
                children: [
                  if (_error != null && _circles.isEmpty)
                    GwEmpty(
                        icon: Icons.cloud_off,
                        title: "Couldn't load",
                        subtitle: _error),
                  _gpsCard(),
                  const SizedBox(height: 14),
                  for (final row in _circles) _circleCard(row),
                  if (_circles.isNotEmpty) const SizedBox(height: 6),
                  _createCard(),
                  const SizedBox(height: 14),
                  _joinCard(),
                  const SizedBox(height: 14),
                  _toolsCard(),
                ],
              ),
      ),
    );
  }

  Widget _circleCard(Map<String, dynamic> row) {
    final c = row["circle"];
    if (c is! Map) return const SizedBox.shrink();
    final id = c["id"].toString();
    final name = (c["name"] ?? "").toString();
    final code = (c["invite_code"] ?? "").toString();
    final sharing = row["sharing_enabled"] == true;
    final members = _members[id] ?? const [];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: GwColors.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.family_restroom,
                      color: GwColors.primary, size: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: 16)),
                      Text(
                        tr(context, "${members.length} members",
                            "အဖွဲ့ဝင် ${members.length} ဦး"),
                        style: const TextStyle(
                            fontSize: 12, color: GwColors.inkSoft),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  onSelected: (v) {
                    if (v == "leave") _leave(id, name);
                    if (v == "nfc") _nfcWrite(code);
                  },
                  itemBuilder: (ctx) => [
                    PopupMenuItem(
                        value: "nfc",
                        child: Text(tr(ctx, "Write code to NFC tag",
                            "ကုဒ်ကို NFC tag ထဲ ရေးရန်"))),
                    PopupMenuItem(
                        value: "leave",
                        child: Text(
                            tr(ctx, "Leave circle", "အဖွဲ့မှ ထွက်ရန်"))),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Copyable invite code.
            InkWell(
              onTap: () {
                Clipboard.setData(ClipboardData(text: code));
                _toast(tr(context, "Invite code copied: $code",
                    "ဖိတ်ခေါ်ကုဒ် ကူးပြီး — $code"));
              },
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: GwColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.key, size: 15, color: GwColors.primary),
                    const SizedBox(width: 6),
                    Text(
                      "${tr(context, "Invite code", "ဖိတ်ခေါ်ကုဒ်")}: $code",
                      style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          color: GwColors.primary,
                          fontSize: 13),
                    ),
                    const Spacer(),
                    const Icon(Icons.copy, size: 14, color: GwColors.inkSoft),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            // Members with live-location status.
            for (final m in members) _memberRow(m),
            const Divider(height: 18, color: GwColors.line),
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        sharing ? Icons.location_on : Icons.location_off,
                        size: 18,
                        color: sharing ? GwColors.primary : GwColors.inkSoft,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          tr(context, "Share my location",
                              "ကျွန်ုပ်တည်နေရာ မျှဝေမည်"),
                          style: const TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                      Switch(
                        value: sharing,
                        activeColor: GwColors.primary,
                        onChanged: (v) => _toggleSharing(id, v),
                      ),
                    ],
                  ),
                ),
                FilledButton.icon(
                  style:
                      FilledButton.styleFrom(backgroundColor: GwColors.primary),
                  onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const MapScreen())),
                  icon: const Icon(Icons.map_outlined, size: 17),
                  label: Text(tr(context, "Map", "မြေပုံ")),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _memberRow(Map<String, dynamic> m) {
    final person = m["person"] is Map
        ? Profile.fromJson((m["person"] as Map).cast<String, dynamic>())
        : null;
    final userId = m["user_id"].toString();
    final isMe = userId == _myId;
    final name = isMe
        ? tr(context, "You", "သင်")
        : (person?.displayName ?? "Gwave user");
    final loc = _locations[userId];
    final lat = (loc?["latitude"] as num?)?.toDouble();
    final lng = (loc?["longitude"] as num?)?.toDouble();
    final sharing = m["sharing_enabled"] == true;

    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: GwAvatar(
          url: resolveMedia(person?.avatarUrl),
          name: person?.displayName ?? "?",
          size: 36),
      title: Text(name,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      subtitle: Text(
        lat != null
            ? tr(context, "📍 Sharing live location", "📍 တည်နေရာ မျှဝေနေသည်")
            : sharing
                ? tr(context, "No location yet", "တည်နေရာ မရသေးပါ")
                : tr(context, "Sharing off", "မျှဝေမှု ပိတ်ထားသည်"),
        style: TextStyle(
            fontSize: 11.5,
            color: lat != null ? GwColors.primary : GwColors.inkSoft),
      ),
      trailing: lat != null && lng != null
          ? IconButton(
              icon: const Icon(Icons.map_outlined,
                  color: GwColors.primary, size: 20),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => MapScreen(
                      focusLat: lat,
                      focusLng: lng,
                      focusLabel: person?.displayName ?? name))),
            )
          : null,
    );
  }

  /// GPS sharing controls: auto-share switch + share-now, with the last time
  /// my location was published.
  Widget _gpsCard() {
    return Container(
      decoration: BoxDecoration(
        gradient: GwColors.primaryGradient,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.my_location, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr(context, "GPS location sharing", "GPS တည်နေရာ မျှဝေမှု"),
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 15),
                ),
              ),
              Switch(
                value: _autoShare,
                activeColor: Colors.white,
                activeTrackColor: Colors.white38,
                onChanged: _setAutoShare,
              ),
            ],
          ),
          Text(
            _autoShare
                ? tr(context,
                    "Auto — updates every 2 minutes while the app is open",
                    "အလိုအလျောက် — app ဖွင့်ထားစဉ် ၂ မိနစ်တိုင်း update လုပ်သည်")
                : tr(context, "Auto-sharing is off",
                    "အလိုအလျောက် မျှဝေမှု ပိတ်ထားသည်"),
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
          if (_lastShared != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                tr(context,
                    "Last shared ${TimeOfDay.fromDateTime(_lastShared!).format(context)}",
                    "နောက်ဆုံးမျှဝေချိန် ${TimeOfDay.fromDateTime(_lastShared!).format(context)}"),
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: GwColors.primary),
              onPressed: () => _pushLocation(),
              icon: const Icon(Icons.gps_fixed, size: 18),
              label: Text(
                  tr(context, "Share my location now", "အခုချက်ချင်း မျှဝေမည်"),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  /// Bluetooth + NFC tools.
  Widget _toolsCard() {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(tr(context, "Nearby tools", "အနီးအနား ကိရိယာများ"),
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 4),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.bluetooth_searching,
                  color: GwColors.primary, size: 22),
            ),
            title: Text(tr(context, "Bluetooth nearby finder",
                "Bluetooth အနီးအနား ရှာဖွေမှု")),
            subtitle: Text(
                tr(context,
                    "Find a family phone or tracker tag by signal strength",
                    "Signal အားဖြင့် မိသားစုဖုန်း/tag ရှာပါ"),
                style: const TextStyle(fontSize: 11.5)),
            trailing: const Icon(Icons.chevron_right),
            onTap: _openNearbyFinder,
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.nfc, color: GwColors.primary, size: 22),
            ),
            title: Text(tr(context, "Join by NFC tap", "NFC ကပ်၍ ဝင်မည်")),
            subtitle: Text(
                tr(context, "Tap a family tag with the invite code on it",
                    "ဖိတ်ခေါ်ကုဒ်ပါတဲ့ tag ကို ကပ်ပါ"),
                style: const TextStyle(fontSize: 11.5)),
            trailing: const Icon(Icons.chevron_right),
            onTap: _nfcJoin,
          ),
        ],
      ),
    );
  }

  Widget _createCard() => _formCard(
        icon: Icons.add,
        title: tr(context, "Create a family circle", "မိသားစုအဖွဲ့ ဖွဲ့မည်"),
        field: TextField(
          controller: _name,
          decoration: InputDecoration(
            hintText: tr(context, "e.g. Our family", "ဥပမာ — ကျွန်ုပ်တို့မိသားစု"),
          ),
        ),
        button: tr(context, "Create", "ဖွဲ့မည်"),
        onPressed: _create,
      );

  Widget _joinCard() => _formCard(
        icon: Icons.group_add_outlined,
        title: tr(context, "Join with a code", "ကုဒ်ဖြင့် ဝင်မည်"),
        field: TextField(
          controller: _code,
          textCapitalization: TextCapitalization.characters,
          decoration: InputDecoration(
            hintText: tr(context, "Invite code", "ဖိတ်ခေါ်ကုဒ်"),
          ),
        ),
        button: tr(context, "Join", "ဝင်မည်"),
        onPressed: _join,
      );

  Widget _formCard({
    required IconData icon,
    required String title,
    required Widget field,
    required String button,
    required VoidCallback onPressed,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surface,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: GwColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 10),
          field,
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: GwColors.primary),
              onPressed: _busy ? null : onPressed,
              child: Text(button,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }
}

/// BLE proximity scanner: lists nearby Bluetooth devices sorted by signal
/// strength so you can walk toward a family phone or tracker tag — the bar
/// fills as you get closer.
class _NearbyFinderSheet extends StatefulWidget {
  const _NearbyFinderSheet();

  @override
  State<_NearbyFinderSheet> createState() => _NearbyFinderSheetState();
}

class _NearbyFinderSheetState extends State<_NearbyFinderSheet> {
  StreamSubscription<List<ScanResult>>? _resultsSub;
  StreamSubscription<bool>? _scanningSub;
  List<ScanResult> _results = [];
  bool _scanning = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    FlutterBluePlus.stopScan();
    _resultsSub?.cancel();
    _scanningSub?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() {
      _error = null;
      _results = [];
    });
    try {
      // Android 12+: scan/connect runtime permissions; older Androids piggy-
      // back on location, which the app already requests for the map.
      await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
        Permission.locationWhenInUse,
      ].request();
      _resultsSub ??= FlutterBluePlus.scanResults.listen((rs) {
        if (!mounted) return;
        final list = rs.toList()..sort((a, b) => b.rssi.compareTo(a.rssi));
        setState(() => _results = list);
      });
      _scanningSub ??= FlutterBluePlus.isScanning.listen((v) {
        if (mounted) setState(() => _scanning = v);
      });
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 15));
    } catch (e) {
      if (mounted) setState(() => _error = "$e");
    }
  }

  String _label(int rssi, BuildContext context) {
    if (rssi >= -55) return tr(context, "Very close", "အလွန်နီး");
    if (rssi >= -70) return tr(context, "Near", "နီး");
    if (rssi >= -85) return tr(context, "In range", "အနီးအနားတွင်");
    return tr(context, "Far", "ဝေး");
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.bluetooth_searching,
                    color: GwColors.primary, size: 22),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    tr(context, "Nearby finder", "အနီးအနား ရှာဖွေမှု"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 17),
                  ),
                ),
                if (_scanning)
                  const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: GwColors.primary))
                else
                  TextButton.icon(
                    onPressed: _start,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: Text(tr(context, "Scan again", "ထပ်ရှာမည်")),
                  ),
              ],
            ),
            Text(
              tr(context,
                  "Walk toward the device — the bar fills as you get closer.",
                  "စက်ဆီ လျှောက်သွားပါ — နီးလာလေ bar ပြည့်လာလေဖြစ်သည်။"),
              style: const TextStyle(fontSize: 12, color: GwColors.inkSoft),
            ),
            const SizedBox(height: 8),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Text(_error!,
                    style: const TextStyle(color: GwColors.inkSoft)),
              )
            else if (_results.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 30),
                child: Center(
                  child: Text(
                    _scanning
                        ? tr(context, "Scanning...", "ရှာဖွေနေသည်...")
                        : tr(context, "No devices found nearby.",
                            "အနီးအနားတွင် စက်မတွေ့ပါ။"),
                    style: const TextStyle(color: GwColors.inkSoft),
                  ),
                ),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(context).size.height * 0.5),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _results.length,
                  itemBuilder: (_, i) {
                    final r = _results[i];
                    final name = r.device.platformName.isNotEmpty
                        ? r.device.platformName
                        : r.device.remoteId.str;
                    final strength = ((r.rssi + 100) / 60).clamp(0.0, 1.0);
                    return ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.bluetooth,
                          color: GwColors.primary, size: 20),
                      title: Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 13.5)),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: strength,
                            minHeight: 6,
                            backgroundColor: GwColors.surfaceMuted,
                            color: strength > 0.66
                                ? GwColors.primary
                                : strength > 0.33
                                    ? Colors.orange
                                    : GwColors.inkSoft,
                          ),
                        ),
                      ),
                      trailing: Text(
                        "${_label(r.rssi, context)}\n${r.rssi} dBm",
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                            fontSize: 10.5, color: GwColors.inkSoft),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
