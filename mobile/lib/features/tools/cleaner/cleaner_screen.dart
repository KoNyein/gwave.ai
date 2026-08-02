import 'dart:io';

import 'package:app_usage/app_usage.dart';
import 'package:flutter/material.dart';
import 'package:installed_apps/app_info.dart';
import 'package:installed_apps/installed_apps.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/i18n.dart';
import '../../../core/theme.dart';
import 'cleaner_scan.dart';

/// Storage cleaner.
///
/// The whole design rests on one rule: **nothing is deleted that the user has
/// not seen listed first.** There is no one-tap "clean" and no undo, so the
/// confirm step quotes the exact size and says plainly that it is permanent.
///
/// There is also no "boost" button. Android manages memory better than an app
/// can, force-stopping apps makes the phone slower and the battery worse, and
/// Google Play rejects apps that advertise otherwise. The Help tab says so in
/// as many words rather than leaving a suspicious gap.
class CleanerScreen extends StatefulWidget {
  const CleanerScreen({super.key});

  @override
  State<CleanerScreen> createState() => _CleanerScreenState();
}

enum _Tab { overview, junk, duplicates, chat, apps, help }

class _CleanerScreenState extends State<CleanerScreen> {
  _Tab _tab = _Tab.overview;

  bool _granted = false;
  bool _scanning = false;
  bool _cancel = false;
  String _progress = "";

  final Map<String, int> _catBytes = {};
  final Map<String, int> _catFiles = {};
  final List<FoundFile> _junk = [];
  final List<FoundFile> _media = [];
  final List<FoundFile> _images = [];
  List<DuplicateGroup> _dupes = [];
  List<UnusedApp> _unused = [];
  bool _usageDenied = false;
  int _totalScanned = 0;

  @override
  void initState() {
    super.initState();
    _checkPermission();
  }

  @override
  void dispose() {
    _cancel = true;
    super.dispose();
  }

  Future<void> _checkPermission() async {
    var ok = false;
    try {
      ok = await Permission.manageExternalStorage.isGranted;
      if (!ok) ok = await Permission.storage.isGranted;
    } catch (_) {}
    if (mounted) setState(() => _granted = ok);
  }

  Future<void> _requestPermission() async {
    try {
      // Android 11+ routes this to a full-screen system settings page, so the
      // user leaves the app and comes back — re-check on return rather than
      // trusting the immediate result.
      var status = await Permission.manageExternalStorage.request();
      if (!status.isGranted) status = await Permission.storage.request();
      if (mounted) setState(() => _granted = status.isGranted);
    } catch (_) {
      if (mounted) setState(() => _granted = false);
    }
  }

  List<Directory> _roots() {
    final out = <Directory>[];
    for (final p in const [
      "/storage/emulated/0",
      "/sdcard",
    ]) {
      final d = Directory(p);
      try {
        if (d.existsSync()) {
          out.add(d);
          break; // the two are the same volume; scanning both doubles the work
        }
      } catch (_) {}
    }
    return out;
  }

  Future<void> _scan() async {
    if (_scanning) return;
    setState(() {
      _scanning = true;
      _cancel = false;
      _progress = tr(context, "Scanning…", "စစ်ဆေးနေသည်…");
      _catBytes.clear();
      _catFiles.clear();
      _junk.clear();
      _media.clear();
      _images.clear();
      _dupes = [];
      _totalScanned = 0;
    });

    for (final root in _roots()) {
      await walk(
        root,
        cancelled: () => _cancel,
        onProgress: (seen) {
          if (!mounted) return;
          setState(() => _progress = tr(context, "Scanning… $seen files",
              "စစ်ဆေးနေသည်… ဖိုင် $seen ခု"));
        },
        onFile: (file, bytes) {
          final path = file.path;
          _totalScanned++;
          final cat = categoryOf(path);
          _catBytes[cat] = (_catBytes[cat] ?? 0) + bytes;
          _catFiles[cat] = (_catFiles[cat] ?? 0) + 1;

          DateTime modified;
          try {
            modified = file.lastModifiedSync();
          } catch (_) {
            modified = DateTime.fromMillisecondsSinceEpoch(0);
          }
          final found = FoundFile(path, bytes, modified);

          final kind = junkKindOf(path);
          if (kind != null && !isProtected(path)) {
            found.selected = defaultSelected(found);
            _junk.add(found);
          }
          if (mediaFolders.any(path.contains)) _media.add(found);
          if (cat == "photo" && !isProtected(path)) _images.add(found);
        },
      );
    }

    if (!mounted) return;
    setState(() => _progress =
        tr(context, "Comparing photos…", "ဓာတ်ပုံများ နှိုင်းယှဉ်နေသည်…"));

    // Cap the duplicate pass — hashing 40,000 photos on a budget phone would
    // take longer than anyone will wait, and the biggest files are where the
    // space actually is.
    final candidates = [..._images]..sort((a, b) => b.bytes.compareTo(a.bytes));
    final dupes = await findDuplicates(
      candidates.take(4000).toList(),
      cancelled: () => _cancel,
    );

    if (!mounted) return;
    setState(() {
      _dupes = dupes;
      _scanning = false;
      _progress = "";
    });
  }

  Future<void> _loadApps() async {
    setState(() => _usageDenied = false);
    List<AppInfo> installed = [];
    try {
      installed = await InstalledApps.getInstalledApps(
        excludeSystemApps: true,
        excludeNonLaunchableApps: true,
      );
    } catch (_) {}

    final lastUsed = <String, DateTime>{};
    try {
      final now = DateTime.now();
      final stats = await AppUsage()
          .getAppUsage(now.subtract(const Duration(days: 60)), now);
      for (final s in stats) {
        lastUsed[s.packageName] = s.lastForeground;
      }
    } catch (_) {
      // Usage access is a separate, manually-granted permission. Without it
      // we can still list apps — just not say when they were last opened.
      if (mounted) setState(() => _usageDenied = true);
    }

    final out = <UnusedApp>[
      for (final a in installed)
        UnusedApp(a.packageName, a.name, lastUsed[a.packageName]),
    ]..sort((a, b) => b.daysIdle.compareTo(a.daysIdle));

    if (mounted) setState(() => _unused = out);
  }

  int get _reclaimable {
    final junk = _junk.fold(0, (a, f) => a + f.bytes);
    final dupe = _dupes.fold(0, (a, g) => a + g.reclaimable);
    final chat = _media.fold(0, (a, f) => a + f.bytes);
    return junk + dupe + chat;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(title: Text(tr(context, "Storage cleaner", "နေရာရှင်းလင်းရေး"))),
      body: switch (_tab) {
        _Tab.overview => _overview(context),
        _Tab.junk => _fileList(context, _junk,
            tr(context, "Junk files", "အလဟဿဖိုင်များ")),
        _Tab.duplicates => _duplicates(context),
        _Tab.chat => _fileList(context, _media,
            tr(context, "Chat media", "Chat မီဒီယာ")),
        _Tab.apps => _apps(context),
        _Tab.help => _help(context),
      },
      bottomNavigationBar: NavigationBar(
        selectedIndex: _Tab.values.indexOf(_tab),
        onDestinationSelected: (i) {
          setState(() => _tab = _Tab.values[i]);
          if (_Tab.values[i] == _Tab.apps && _unused.isEmpty) _loadApps();
        },
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.pie_chart_outline),
              label: tr(context, "Storage", "နေရာ")),
          NavigationDestination(
              icon: const Icon(Icons.delete_sweep_outlined),
              label: tr(context, "Junk", "အလဟဿ")),
          NavigationDestination(
              icon: const Icon(Icons.photo_library_outlined),
              label: tr(context, "Copies", "ထပ်နေ")),
          NavigationDestination(
              icon: const Icon(Icons.chat_outlined),
              label: tr(context, "Chat", "Chat")),
          NavigationDestination(
              icon: const Icon(Icons.apps_outlined),
              label: tr(context, "Apps", "Apps")),
          NavigationDestination(
              icon: const Icon(Icons.help_outline),
              label: tr(context, "Help", "အကူအညီ")),
        ],
      ),
    );
  }

  Widget _overview(BuildContext context) {
    if (!_granted) {
      return ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const SizedBox(height: 30),
          Icon(Icons.folder_open, size: 52, color: GwColors.inkSoftOf(context)),
          const SizedBox(height: 14),
          Text(
            tr(context, "File access is needed", "ဖိုင်ဖတ်ခွင့် လိုအပ်ပါသည်"),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(
            tr(
                context,
                "To find what is taking up space, this screen has to read the file list on your phone. It only reads — nothing is deleted until you tick it and confirm.",
                "နေရာဘာက ယူထားလဲ ရှာဖို့ ဖုန်းထဲက ဖိုင်စာရင်းကို ဖတ်ရပါမယ်။ ဖတ်ရုံပါပဲ — သင်ကိုယ်တိုင် ရွေးပြီး အတည်ပြုမှသာ ဖျက်ပါမယ်။"),
            textAlign: TextAlign.center,
            style: TextStyle(color: GwColors.inkSoftOf(context)),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _requestPermission,
            child: Text(tr(context, "Grant access", "ခွင့်ပြုမည်")),
          ),
          TextButton(
            onPressed: _checkPermission,
            child: Text(tr(context, "I granted it — check again",
                "ခွင့်ပြုပြီးပြီ — ပြန်စစ်ပါ")),
          ),
        ],
      );
    }

    final cats = <String, (String, String)>{
      "photo": ("Photos", "ဓာတ်ပုံ"),
      "video": ("Videos", "ဗီဒီယို"),
      "audio": ("Audio", "အသံ"),
      "doc": ("Documents", "စာရွက်စာတမ်း"),
      "apk": ("Installers", "Install ဖိုင်"),
      "other": ("Other", "အခြား"),
    };
    final total = _catBytes.values.fold(0, (a, b) => a + b);

    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
      children: [
        _card(
          context,
          Column(
            children: [
              Text(
                total == 0
                    ? tr(context, "Not scanned yet", "မစစ်ဆေးရသေးပါ")
                    : formatBytes(total),
                style: const TextStyle(
                    fontSize: 30, fontWeight: FontWeight.w800),
              ),
              if (total > 0)
                Text(
                  tr(context, "in $_totalScanned files",
                      "ဖိုင် $_totalScanned ခုအတွင်း"),
                  style: TextStyle(color: GwColors.inkSoftOf(context)),
                ),
              const SizedBox(height: 12),
              if (_scanning) ...[
                const LinearProgressIndicator(),
                const SizedBox(height: 6),
                Text(_progress,
                    style: TextStyle(
                        fontSize: 12, color: GwColors.inkSoftOf(context))),
                const SizedBox(height: 6),
                TextButton(
                  onPressed: () => setState(() => _cancel = true),
                  child: Text(tr(context, "Stop", "ရပ်ရန်")),
                ),
              ] else
                FilledButton.icon(
                  onPressed: _scan,
                  icon: const Icon(Icons.search),
                  label: Text(total == 0
                      ? tr(context, "Scan", "စစ်ဆေးမည်")
                      : tr(context, "Scan again", "ပြန်စစ်မည်")),
                ),
            ],
          ),
        ),
        if (total > 0) ...[
          const SizedBox(height: 8),
          _card(
            context,
            Column(
              children: [
                for (final e in cats.entries)
                  if ((_catBytes[e.key] ?? 0) > 0)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(
                        children: [
                          Expanded(
                              child: Text(tr(context, e.value.$1, e.value.$2))),
                          Text("${_catFiles[e.key]}",
                              style: TextStyle(
                                  fontSize: 12,
                                  color: GwColors.inkSoftOf(context))),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 78,
                            child: Text(formatBytes(_catBytes[e.key] ?? 0),
                                textAlign: TextAlign.right,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(tr(context, "Can be freed", "ရှင်းလင်းနိုင်သည်"),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    const Spacer(),
                    Text(formatBytes(_reclaimable),
                        style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: GwColors.ok)),
                  ],
                ),
                const SizedBox(height: 6),
                _row(context, Icons.delete_sweep_outlined,
                    tr(context, "Junk files", "အလဟဿဖိုင်"),
                    _junk.fold(0, (a, f) => a + f.bytes), () {
                  setState(() => _tab = _Tab.junk);
                }),
                _row(context, Icons.photo_library_outlined,
                    tr(context, "Duplicate photos", "ထပ်နေသောပုံ"),
                    _dupes.fold(0, (a, g) => a + g.reclaimable), () {
                  setState(() => _tab = _Tab.duplicates);
                }),
                _row(context, Icons.chat_outlined,
                    tr(context, "Chat media", "Chat မီဒီယာ"),
                    _media.fold(0, (a, f) => a + f.bytes), () {
                  setState(() => _tab = _Tab.chat);
                }),
              ],
            ),
          ),
        ],
        const SizedBox(height: 10),
        _card(
          context,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.info_outline, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  tr(
                      context,
                      "Deleting is permanent — there is no undo. Every file is listed before anything happens.",
                      "ဖျက်ပြီးရင် ပြန်မရနိုင်ပါ။ ဘာမလုပ်ခင် ဖိုင်တိုင်းကို စာရင်းပြပါမယ်။"),
                  style: TextStyle(
                      fontSize: 12, color: GwColors.inkSoftOf(context)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(BuildContext context, IconData icon, String label, int bytes,
          VoidCallback onTap) =>
      InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(
            children: [
              Icon(icon, size: 18, color: GwColors.inkSoftOf(context)),
              const SizedBox(width: 8),
              Expanded(child: Text(label)),
              Text(formatBytes(bytes),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const Icon(Icons.chevron_right, size: 18),
            ],
          ),
        ),
      );

  Widget _fileList(BuildContext context, List<FoundFile> files, String title) {
    if (files.isEmpty) {
      return _empty(context,
          tr(context, "Nothing found here.", "ဒီမှာ ဘာမှ မတွေ့ပါ။"));
    }
    final sorted = [...files]..sort((a, b) => b.bytes.compareTo(a.bytes));
    final picked = selectedBytes(files);
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
            itemCount: sorted.length,
            itemBuilder: (context, i) {
              final f = sorted[i];
              return CheckboxListTile(
                dense: true,
                value: f.selected,
                onChanged: (v) => setState(() => f.selected = v ?? false),
                title: Text(f.name,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  "${formatBytes(f.bytes)} · ${_stamp(f.modified)}"
                  "${isProtected(f.path) ? tr(context, " · protected folder", " · ကာကွယ်ထားသော folder") : ""}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 11, color: GwColors.inkSoftOf(context)),
                ),
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    tr(context, "$title — ${formatBytes(picked)} selected",
                        "$title — ${formatBytes(picked)} ရွေးထား"),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                FilledButton(
                  onPressed: picked == 0 ? null : () => _confirmDelete(files),
                  child: Text(tr(context, "Delete", "ဖျက်မည်")),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _duplicates(BuildContext context) {
    if (_dupes.isEmpty) {
      return _empty(
          context,
          tr(context, "No duplicate photos found.",
              "ထပ်နေသော ဓာတ်ပုံ မတွေ့ပါ။"));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        _card(
          context,
          Text(
            tr(
                context,
                "One copy in each group is always kept — the oldest, since that is the one albums and chats point at. Only the extra copies can be ticked.",
                "အုပ်စုတစ်ခုစီမှာ တစ်ခု အမြဲကျန်ပါတယ် — အဟောင်းဆုံးကို ထားပါတယ် (album နဲ့ chat တွေက အဲဒါကို ညွှန်းလို့)။ ပိုနေတဲ့ မိတ္တူတွေကိုသာ ရွေးလို့ရပါတယ်။"),
            style: TextStyle(fontSize: 12, color: GwColors.inkSoftOf(context)),
          ),
        ),
        for (final g in _dupes) ...[
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tr(
                      context,
                      "${g.files.length} copies · ${formatBytes(g.reclaimable)} can be freed",
                      "မိတ္တူ ${g.files.length} ခု · ${formatBytes(g.reclaimable)} ရှင်းနိုင်"),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                for (var i = 0; i < g.files.length; i++)
                  i == g.keepIndex
                      ? Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.lock_outline,
                                  size: 16, color: GwColors.ok),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  "${g.files[i].name}  ${tr(context, "(kept)", "(ထားခဲ့မည်)")}",
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        )
                      : CheckboxListTile(
                          dense: true,
                          contentPadding: EdgeInsets.zero,
                          value: g.files[i].selected,
                          onChanged: (v) =>
                              setState(() => g.files[i].selected = v ?? false),
                          title: Text(g.files[i].name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 12)),
                          subtitle: Text(formatBytes(g.files[i].bytes),
                              style: const TextStyle(fontSize: 11)),
                        ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 8),
        FilledButton(
          onPressed: () => _confirmDelete(
              [for (final g in _dupes) ...g.files.where((f) => f.selected)]),
          child: Text(tr(context, "Delete selected copies",
              "ရွေးထားသော မိတ္တူများ ဖျက်မည်")),
        ),
      ],
    );
  }

  Widget _apps(BuildContext context) {
    if (_unused.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 12),
            Text(tr(context, "Reading the app list…",
                "App စာရင်း ဖတ်နေသည်…")),
          ],
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      children: [
        _card(
          context,
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr(
                    context,
                    "This app cannot uninstall anything for you — Android does not allow it. Tapping an app opens its own settings page, where you can uninstall or clear its data yourself.",
                    "ဤ app က သင့်ကိုယ်စား ဘာမှ ဖြုတ်ပေးလို့ မရပါ — Android က ခွင့်မပြုပါ။ app တစ်ခုကို နှိပ်ရင် သူ့ရဲ့ setting စာမျက်နှာ ပွင့်ပါမယ်၊ အဲဒီကနေ သင်ကိုယ်တိုင် ဖြုတ်နိုင်/data ရှင်းနိုင်ပါတယ်။"),
                style:
                    TextStyle(fontSize: 12, color: GwColors.inkSoftOf(context)),
              ),
              if (_usageDenied) ...[
                const SizedBox(height: 8),
                Text(
                  tr(
                      context,
                      "Usage access is off, so last-opened dates are unknown. Turn it on in Settings → Special app access → Usage access.",
                      "အသုံးပြုမှု ခွင့်ပြုချက် ပိတ်ထားလို့ နောက်ဆုံးဖွင့်ခဲ့တဲ့ရက် မသိရပါ။ Settings → Special app access → Usage access မှာ ဖွင့်ပါ။"),
                  style: const TextStyle(
                      fontSize: 12, color: GwColors.meter),
                ),
                TextButton(
                  onPressed: () {
                    try {
                      openAppSettings();
                    } catch (_) {}
                  },
                  child: Text(tr(context, "Open settings", "Settings ဖွင့်ရန်")),
                ),
              ],
            ],
          ),
        ),
        for (final a in _unused)
          ListTile(
            dense: true,
            title: Text(a.name, maxLines: 1, overflow: TextOverflow.ellipsis),
            subtitle: Text(
              a.lastUsed == null
                  ? tr(context, "Last opened: unknown", "နောက်ဆုံးဖွင့်: မသိ")
                  : tr(context, "Last opened ${a.daysIdle} days ago",
                      "နောက်ဆုံးဖွင့် လွန်ခဲ့သော ${a.daysIdle} ရက်"),
              style: TextStyle(
                  fontSize: 11,
                  color: a.daysIdle >= 30
                      ? GwColors.meter
                      : GwColors.inkSoftOf(context)),
            ),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () {
              try {
                InstalledApps.openSettings(a.packageName);
              } catch (_) {}
            },
          ),
      ],
    );
  }

  Widget _help(BuildContext context) => ListView(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
        children: [
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    tr(context, "Why there is no \"boost\" button",
                        "\"Boost\" ခလုတ် ဘာလို့ မပါတာလဲ"),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(
                  tr(
                      context,
                      "Android keeps recently-used apps in memory on purpose, so they reopen instantly. Force-closing them makes the phone slower and drains more battery, because everything has to be loaded from scratch again. Apps that advertise a RAM boost are selling an animation.",
                      "Android က မကြာခင်က သုံးခဲ့တဲ့ app တွေကို memory ထဲ ရည်ရွယ်ချက်ရှိရှိ ထားတယ် — ပြန်ဖွင့်ရင် ချက်ချင်း တက်လာအောင်။ အတင်းပိတ်လိုက်ရင် အားလုံး အစကနေ ပြန်ဖွင့်ရလို့ ဖုန်းက ပိုနှေးပြီး ဘက်ထရီ ပိုကုန်တယ်။ RAM boost ကြော်ငြာတဲ့ app တွေက animation တစ်ခုကို ရောင်းနေတာပါ။"),
                  style: TextStyle(
                      fontSize: 12.5, color: GwColors.inkSoftOf(context)),
                ),
              ],
            ),
          ),
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, "How to actually free space",
                    "နေရာဘယ်လို လွတ်အောင်လုပ်မလဲ"),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                _bullet(
                    context,
                    tr(context,
                        "Delete duplicate photos — usually the biggest win. Sharing the same picture repeatedly makes copies.",
                        "ထပ်နေတဲ့ဓာတ်ပုံ ဖျက်ပါ — အများဆုံး နေရာလွတ်တာ ဒါပါ။ ပုံတစ်ပုံကို ခဏခဏ share လုပ်ရင် မိတ္တူတွေ ဖြစ်သွားတယ်။")),
                _bullet(
                    context,
                    tr(context,
                        "Clear chat media. WhatsApp and Telegram download every photo and video from every group automatically — in a few busy groups that is gigabytes a month.",
                        "Chat မီဒီယာ ရှင်းပါ။ WhatsApp နဲ့ Telegram က group တိုင်းက ပုံ/ဗီဒီယို အားလုံးကို အလိုအလျောက် ဒေါင်းတယ် — group အများကြီးဝင်ထားရင် တစ်လကို GB ချီ ဖြစ်တယ်။")),
                _bullet(
                    context,
                    tr(context,
                        "In WhatsApp: Settings → Storage → Auto-download → set to \"No media\". That stops the problem instead of cleaning up after it.",
                        "WhatsApp မှာ — Settings → Storage → Auto-download ကို \"No media\" ထားပါ။ ရှင်းနေရတာထက် အစကတည်းက မဖြစ်အောင် တားတာ ပိုကောင်းပါတယ်။")),
                _bullet(
                    context,
                    tr(context,
                        "Uninstall apps you have not opened in months — an app with its data can be hundreds of MB.",
                        "လအတန်ကြာ မဖွင့်ဖြစ်တဲ့ app တွေ ဖြုတ်ပါ — app တစ်ခုက data နဲ့ဆို ရာနဲ့ချီ MB ယူတယ်။")),
              ],
            ),
          ),
          _card(
            context,
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, "Common questions", "မေးလေ့ရှိသောမေးခွန်းများ"),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                _qa(
                    context,
                    tr(context, "Can I get deleted files back?",
                        "ဖျက်လိုက်တာ ပြန်ရနိုင်လား"),
                    tr(context, "No. Look at the list before you confirm.",
                        "မရနိုင်ပါ။ အတည်မပြုခင် စာရင်းကို ကြည့်ပါ။")),
                _qa(
                    context,
                    tr(context, "How often should I clean?",
                        "ဘယ်လောက်ကြာကြာ ရှင်းသင့်လဲ"),
                    tr(context, "Once a month is plenty.",
                        "တစ်လတစ်ခါ လုံလောက်ပါတယ်။")),
                _qa(
                    context,
                    tr(context, "Why is my phone slow?", "ဖုန်းနှေးနေတာ ဘာကြောင့်လဲ"),
                    tr(
                        context,
                        "Usually storage above 90% full, many apps running, or simply an older phone. This screen helps with the first one.",
                        "များသောအားဖြင့် နေရာ ၉၀% ကျော် ပြည့်နေတာ၊ app အများကြီး run နေတာ၊ ဒါမှမဟုတ် ဖုန်းအဟောင်း ဖြစ်နေတာပါ။ ဒီစာမျက်နှာက ပထမတစ်ခုကို ကူညီပေးနိုင်ပါတယ်။")),
              ],
            ),
          ),
        ],
      );

  Future<void> _confirmDelete(List<FoundFile> pool) async {
    final picked = pool.where((f) => f.selected && !isProtected(f.path)).toList();
    if (picked.isEmpty) return;
    final bytes = picked.fold(0, (a, f) => a + f.bytes);

    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr(c, "Delete ${picked.length} files?",
            "ဖိုင် ${picked.length} ခု ဖျက်မလား")),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr(c, "This frees ${formatBytes(bytes)}.",
                "${formatBytes(bytes)} လွတ်သွားပါမယ်။")),
            const SizedBox(height: 8),
            Text(
              tr(c, "This cannot be undone.", "ဖျက်ပြီးရင် ပြန်မရနိုင်ပါ။"),
              style: const TextStyle(
                  color: GwColors.bad, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: Text(tr(c, "Cancel", "မလုပ်တော့"))),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: Text(tr(c, "Delete", "ဖျက်မည်"))),
        ],
      ),
    );
    if (ok != true) return;

    var freed = 0;
    var failed = 0;
    for (final f in picked) {
      try {
        File(f.path).deleteSync();
        freed += f.bytes;
      } catch (_) {
        failed++;
      }
    }

    setState(() {
      _junk.removeWhere(picked.contains);
      _media.removeWhere(picked.contains);
      for (final g in _dupes) {
        g.files.removeWhere(picked.contains);
      }
      _dupes = _dupes.where((g) => g.files.length > 1).toList();
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(failed == 0
          ? tr(context, "Freed ${formatBytes(freed)}",
              "${formatBytes(freed)} လွတ်သွားပါပြီ")
          : tr(
              context,
              "Freed ${formatBytes(freed)} · $failed files could not be deleted",
              "${formatBytes(freed)} လွတ်သွားပြီး ဖိုင် $failed ခု ဖျက်၍ မရပါ")),
    ));
  }

  Widget _empty(BuildContext context, String text) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(text,
              textAlign: TextAlign.center,
              style: TextStyle(color: GwColors.inkSoftOf(context))),
        ),
      );

  Widget _card(BuildContext context, Widget child) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: GwColors.surfaceOf(context),
          borderRadius: BorderRadius.circular(GwRadius.lg),
          border: Border.all(color: GwColors.lineOf(context)),
        ),
        child: child,
      );

  Widget _bullet(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("· "),
            Expanded(
                child: Text(text,
                    style: TextStyle(
                        fontSize: 12.5, color: GwColors.inkSoftOf(context)))),
          ],
        ),
      );

  Widget _qa(BuildContext context, String q, String a) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(q, style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(a,
                style: TextStyle(
                    fontSize: 12.5, color: GwColors.inkSoftOf(context))),
          ],
        ),
      );

  String _stamp(DateTime d) {
    String two(int v) => v.toString().padLeft(2, "0");
    return "${d.year}-${two(d.month)}-${two(d.day)}";
  }
}
