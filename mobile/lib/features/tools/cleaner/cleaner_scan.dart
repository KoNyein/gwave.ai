/// Storage cleaner — scanning and classification, kept away from any widget
/// so the rules can be read (and argued with) on their own.
///
/// What this deliberately does **not** do: kill background processes, "free
/// RAM", or clear other apps' data. Android reclaims memory better than any
/// app can, force-stopping apps makes the phone slower and the battery worse,
/// and since Android 11 a normal app simply cannot touch another app's data.
/// A button that pretends otherwise is a lie with an animation on it.
///
/// What it does do is find files that are genuinely taking space and show
/// them — every byte is listed before anything is deleted.
library;

import 'dart:io';

import 'package:crypto/crypto.dart';

/// A category in the storage breakdown.
class StorageCategory {
  const StorageCategory(this.id, this.labelEn, this.labelMy, this.bytes, this.files);
  final String id;
  final String labelEn;
  final String labelMy;
  final int bytes;
  final int files;
}

/// One deletable item found by a scan.
class FoundFile {
  FoundFile(this.path, this.bytes, this.modified, {this.selected = false});
  final String path;
  final int bytes;
  final DateTime modified;
  bool selected;

  String get name => path.split("/").last;
}

/// A group of byte-identical files. [keepIndex] is never offered for deletion.
class DuplicateGroup {
  DuplicateGroup(this.files, {this.keepIndex = 0});
  final List<FoundFile> files;

  /// Which copy to keep — the oldest, because it is the one other things are
  /// most likely to reference (an album, a chat thread, a backup index).
  final int keepIndex;

  int get reclaimable => files
      .asMap()
      .entries
      .where((e) => e.key != keepIndex)
      .fold(0, (a, e) => a + e.value.bytes);
}

/// A class of junk with a plain-language explanation of what is being lost.
class JunkRule {
  const JunkRule(this.id, this.labelEn, this.labelMy, this.explainEn,
      this.explainMy, this.safe);
  final String id;
  final String labelEn;
  final String labelMy;
  final String explainEn;
  final String explainMy;

  /// Whether this class may be pre-ticked. Anything a user might still want
  /// is `false` and stays unticked until they say so.
  final bool safe;
}

const junkRules = <JunkRule>[
  JunkRule("thumbnails", "Thumbnails", "ပုံသေးများ",
      "Gallery previews. They rebuild automatically.",
      "ဓာတ်ပုံ preview များ — သူ့ဘာသာ ပြန်ဆောက်ပါလိမ့်မယ်။", true),
  JunkRule("trashed", "Already-deleted files", "အမှိုက်ပုံးရှိဖိုင်",
      "Files you already deleted, still on disk.",
      "ဖျက်ပြီးသားဖိုင်များ — disk ပေါ်မှာ ကျန်နေသေးတယ်။", true),
  JunkRule("tmp", "Temporary files", "ယာယီဖိုင်",
      "Scratch files apps forgot to remove.",
      "app တွေ ဖျက်ဖို့ မေ့ကျန်ခဲ့တဲ့ ခေတ္တသုံးဖိုင်များ။", true),
  JunkRule("log", "Log files", "မှတ်တမ်းဖိုင်",
      "App logs. Useful only for debugging.",
      "app မှတ်တမ်းများ — ချွတ်ယွင်းချက်ရှာတဲ့အခါမှသာ အသုံးဝင်တယ်။", true),
  JunkRule("cache", "App cache", "App cache",
      "Cached downloads. Apps will fetch them again when needed.",
      "သိမ်းထားတဲ့ download များ — လိုအပ်ရင် ပြန်ဆွဲပါလိမ့်မယ်။", true),
  JunkRule("apk", "Installer files (.apk)", "Install ဖိုင် (.apk)",
      "Only needed if you plan to reinstall without internet.",
      "အင်တာနက်မရှိဘဲ ပြန် install လုပ်မယ်ဆိုမှသာ လိုပါတယ်။", false),
];

/// Folders that are never pre-selected and never swept by a bulk action.
///
/// `DCIM/Camera` holds photos that exist nowhere else; `Android/obb` holds
/// multi-gigabyte game data that takes hours to re-download on a phone
/// connection. Both look like "big files taking space" to a scanner, and
/// deleting either is the kind of mistake a user never forgives.
const protectedPaths = <String>[
  "/DCIM/Camera",
  "/Android/obb",
  "/Pictures/Screenshots",
  "/Download/keep",
];

bool isProtected(String path) =>
    protectedPaths.any((p) => path.contains(p));

/// Messaging apps auto-download every photo and video from every group. On a
/// phone in a dozen family and trading groups this is regularly the single
/// biggest use of storage, and almost none of it is worth keeping.
const mediaFolders = <String>[
  "WhatsApp/Media/WhatsApp Images",
  "WhatsApp/Media/WhatsApp Video",
  "WhatsApp/Media/WhatsApp Documents",
  "WhatsApp/Media/WhatsApp Audio",
  "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images",
  "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video",
  "Telegram/Telegram Images",
  "Telegram/Telegram Video",
  "Telegram/Telegram Documents",
  "Viber/media",
  "Android/media/com.viber.voip/Viber/media",
];

/// File extensions grouped for the storage breakdown.
const _photoExt = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".bmp"};
const _videoExt = {".mp4", ".mkv", ".3gp", ".avi", ".mov", ".webm"};
const _audioExt = {".mp3", ".m4a", ".aac", ".ogg", ".wav", ".opus"};
const _docExt = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".epub"};

String categoryOf(String path) {
  final dot = path.lastIndexOf(".");
  final ext = dot < 0 ? "" : path.substring(dot).toLowerCase();
  if (_photoExt.contains(ext)) return "photo";
  if (_videoExt.contains(ext)) return "video";
  if (_audioExt.contains(ext)) return "audio";
  if (_docExt.contains(ext)) return "doc";
  if (ext == ".apk") return "apk";
  return "other";
}

/// Which junk rule a path matches, or null.
String? junkKindOf(String path) {
  final lower = path.toLowerCase();
  if (lower.contains("/.thumbnails/")) return "thumbnails";
  if (lower.contains("/.trashed") || lower.contains(".trashed-")) {
    return "trashed";
  }
  if (lower.endsWith(".tmp") || lower.endsWith(".temp")) return "tmp";
  if (lower.endsWith(".log")) return "log";
  if (lower.contains("/android/data/") && lower.contains("/cache/")) {
    return "cache";
  }
  if (lower.endsWith(".apk")) return "apk";
  return null;
}

String formatBytes(int bytes) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  var v = bytes.toDouble();
  var i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return "${v.toStringAsFixed(v >= 100 || i == 0 ? 0 : 1)} ${units[i]}";
}

/// Walks a directory tree, calling [onFile] for each file.
///
/// Bounded on purpose: a runaway symlink or a 200,000-file WhatsApp folder
/// should slow the scan, not hang the phone. [maxFiles] and [maxDepth] cap
/// both, and every filesystem error is swallowed — a single unreadable
/// folder must not abort the whole scan.
Future<void> walk(
  Directory root, {
  required void Function(File file, int bytes) onFile,
  int maxFiles = 60000,
  int maxDepth = 12,
  bool Function()? cancelled,
}) async {
  var seen = 0;
  Future<void> step(Directory dir, int depth) async {
    if (depth > maxDepth || seen >= maxFiles) return;
    if (cancelled?.call() == true) return;
    List<FileSystemEntity> entries;
    try {
      entries = dir.listSync(followLinks: false);
    } catch (_) {
      return;
    }
    for (final e in entries) {
      if (seen >= maxFiles) return;
      if (cancelled?.call() == true) return;
      if (e is File) {
        try {
          final len = e.lengthSync();
          seen++;
          onFile(e, len);
        } catch (_) {}
      } else if (e is Directory) {
        await step(e, depth + 1);
      }
    }
  }

  await step(root, 0);
}

/// Two-pass duplicate detection.
///
/// Hashing every photo on a phone would take minutes; files of different
/// sizes cannot be identical, so size buckets come first and only collisions
/// get hashed. [maxHashBytes] caps how much of a large video is read — the
/// first 8 MB plus the exact size is enough to be confident, and reading a
/// 2 GB file to confirm a duplicate is not worth the wait.
Future<List<DuplicateGroup>> findDuplicates(
  List<FoundFile> files, {
  int maxHashBytes = 8 * 1024 * 1024,
  bool Function()? cancelled,
}) async {
  final bySize = <int, List<FoundFile>>{};
  for (final f in files) {
    if (f.bytes <= 0) continue;
    bySize.putIfAbsent(f.bytes, () => []).add(f);
  }

  final groups = <DuplicateGroup>[];
  for (final bucket in bySize.values) {
    if (bucket.length < 2) continue;
    if (cancelled?.call() == true) break;
    final byHash = <String, List<FoundFile>>{};
    for (final f in bucket) {
      final h = await _hashPrefix(f.path, maxHashBytes);
      if (h == null) continue;
      byHash.putIfAbsent(h, () => []).add(f);
    }
    for (final same in byHash.values) {
      if (same.length < 2) continue;
      same.sort((a, b) => a.modified.compareTo(b.modified));
      groups.add(DuplicateGroup(same));
    }
  }
  groups.sort((a, b) => b.reclaimable.compareTo(a.reclaimable));
  return groups;
}

Future<String?> _hashPrefix(String path, int maxBytes) async {
  try {
    final f = File(path);
    final len = await f.length();
    final raf = await f.open();
    try {
      final take = len < maxBytes ? len : maxBytes;
      final bytes = await raf.read(take);
      return "${len}_${md5.convert(bytes)}";
    } finally {
      await raf.close();
    }
  } catch (_) {
    return null;
  }
}

/// Total of the selected items — what the confirm dialog quotes.
int selectedBytes(Iterable<FoundFile> files) =>
    files.where((f) => f.selected).fold(0, (a, f) => a + f.bytes);

/// Whether a found file may start out ticked.
///
/// Two independent guards: the rule itself has to be marked safe, and the
/// path must not be protected. Either one alone has failed before in other
/// cleaners — a "safe" rule matching a path inside DCIM is how people lose
/// photos.
bool defaultSelected(FoundFile f) {
  if (isProtected(f.path)) return false;
  final kind = junkKindOf(f.path);
  if (kind == null) return false;
  final rule = junkRules.where((r) => r.id == kind);
  return rule.isNotEmpty && rule.first.safe;
}

/// An installed app the user has not opened in a while.
class UnusedApp {
  const UnusedApp(this.packageName, this.name, this.lastUsed);
  final String packageName;
  final String name;
  final DateTime? lastUsed;

  int get daysIdle => lastUsed == null
      ? 9999
      : DateTime.now().difference(lastUsed!).inDays;
}
