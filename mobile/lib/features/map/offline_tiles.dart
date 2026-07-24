import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';

/// Offline-first map tiles. Every tile the map draws is saved to disk the first
/// time it's fetched, then served from disk afterwards — so panning back over
/// an area, or opening the map with no connection, works without the network.
/// A whole region can also be pre-downloaded for guaranteed offline use.
///
/// This is the standard "vector/raster tile cache + local storage" approach:
/// small per-tile files, namespaced per layer (street vs satellite), served by
/// the phone with no server round-trip once cached.
class OfflineTiles {
  static Directory? _root;

  /// Root cache dir: <appCache>/gwave_map_tiles.
  static Future<Directory> _dir() async {
    if (_root != null) return _root!;
    final base = await getApplicationCacheDirectory();
    final d = Directory("${base.path}/gwave_map_tiles");
    if (!await d.exists()) await d.create(recursive: true);
    _root = d;
    return d;
  }

  static Future<Directory> layerDir(String layerKey) async {
    final root = await _dir();
    final d = Directory("${root.path}/$layerKey");
    if (!await d.exists()) await d.create(recursive: true);
    return d;
  }

  /// Total bytes currently cached (for the "clear cache" UI).
  static Future<int> cacheBytes() async {
    final d = await _dir();
    var total = 0;
    if (!await d.exists()) return 0;
    await for (final e in d.list(recursive: true, followLinks: false)) {
      if (e is File) {
        try {
          total += await e.length();
        } catch (_) {}
      }
    }
    return total;
  }

  static Future<void> clearCache() async {
    final d = await _dir();
    if (await d.exists()) await d.delete(recursive: true);
    _root = null;
  }

  static String prettySize(int bytes) {
    if (bytes < 1024) return "$bytes B";
    if (bytes < 1024 * 1024) return "${(bytes / 1024).toStringAsFixed(0)} KB";
    return "${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB";
  }

  // ---- Slippy-tile math ----------------------------------------------------

  static int lonToTileX(double lon, int z) =>
      ((lon + 180.0) / 360.0 * (1 << z)).floor();

  static int latToTileY(double lat, int z) {
    final r = lat * math.pi / 180.0;
    return ((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) /
            2 *
            (1 << z))
        .floor();
  }

  /// Estimate how many tiles a region+zoom range download would be, so the UI
  /// can warn before a large download.
  static int estimateTileCount(LatLngBounds bounds, int minZoom, int maxZoom) {
    var count = 0;
    for (var z = minZoom; z <= maxZoom; z++) {
      final x1 = lonToTileX(bounds.west, z);
      final x2 = lonToTileX(bounds.east, z);
      final y1 = latToTileY(bounds.north, z);
      final y2 = latToTileY(bounds.south, z);
      count += ((x2 - x1).abs() + 1) * ((y2 - y1).abs() + 1);
    }
    return count;
  }

  /// Pre-download every tile covering [bounds] across [minZoom]..[maxZoom] into
  /// the cache. Reports progress 0..1 via [onProgress]. Skips tiles already
  /// cached; stops early if [cancel] flips true. Capped at [maxTiles] to keep
  /// storage/battery sane.
  static Future<int> downloadRegion({
    required LatLngBounds bounds,
    required int minZoom,
    required int maxZoom,
    required String layerKey,
    required String urlTemplate,
    required String userAgent,
    void Function(double progress, int done, int total)? onProgress,
    ValueListenable<bool>? cancel,
    int maxTiles = 4000,
  }) async {
    final dir = await layerDir(layerKey);
    final tiles = <(int, int, int)>[];
    for (var z = minZoom; z <= maxZoom; z++) {
      final x1 = math.min(lonToTileX(bounds.west, z), lonToTileX(bounds.east, z));
      final x2 = math.max(lonToTileX(bounds.west, z), lonToTileX(bounds.east, z));
      final y1 = math.min(latToTileY(bounds.north, z), latToTileY(bounds.south, z));
      final y2 = math.max(latToTileY(bounds.north, z), latToTileY(bounds.south, z));
      for (var x = x1; x <= x2; x++) {
        for (var y = y1; y <= y2; y++) {
          tiles.add((z, x, y));
          if (tiles.length >= maxTiles) break;
        }
        if (tiles.length >= maxTiles) break;
      }
      if (tiles.length >= maxTiles) break;
    }

    final total = tiles.length;
    var done = 0;
    var saved = 0;
    final client = http.Client();
    try {
      for (final t in tiles) {
        if (cancel?.value ?? false) break;
        final (z, x, y) = t;
        final file = File("${dir.path}/${z}_${x}_$y.png");
        if (!await file.exists()) {
          final url = urlTemplate
              .replaceAll("{z}", "$z")
              .replaceAll("{x}", "$x")
              .replaceAll("{y}", "$y");
          try {
            final res = await client
                .get(Uri.parse(url), headers: {"User-Agent": userAgent})
                .timeout(const Duration(seconds: 15));
            if (res.statusCode == 200 && res.bodyBytes.isNotEmpty) {
              await file.writeAsBytes(res.bodyBytes);
              saved++;
            }
          } catch (_) {
            // Skip a failed tile; the region is still usable.
          }
        }
        done++;
        onProgress?.call(total == 0 ? 1 : done / total, done, total);
      }
    } finally {
      client.close();
    }
    return saved;
  }
}

/// A flutter_map [TileProvider] that reads/writes the on-disk tile cache. On a
/// cache miss it fetches over the network and stores the tile; with no network
/// it serves whatever is cached and quietly shows nothing for missing tiles.
class CachingTileProvider extends TileProvider {
  CachingTileProvider({
    required this.layerKey,
    required this.userAgent,
    super.headers,
  });

  final String layerKey;
  final String userAgent;

  Directory? _dir;

  Future<Directory> _ensureDir() async =>
      _dir ??= await OfflineTiles.layerDir(layerKey);

  @override
  ImageProvider getImage(TileCoordinates coordinates, TileLayer options) {
    final url = getTileUrl(coordinates, options);
    return _CachedTileImage(
      url: url,
      z: coordinates.z,
      x: coordinates.x,
      y: coordinates.y,
      dirFuture: _ensureDir(),
      userAgent: userAgent,
    );
  }
}

class _CachedTileImage extends ImageProvider<_CachedTileImage> {
  _CachedTileImage({
    required this.url,
    required this.z,
    required this.x,
    required this.y,
    required this.dirFuture,
    required this.userAgent,
  });

  final String url;
  final int z, x, y;
  final Future<Directory> dirFuture;
  final String userAgent;

  @override
  Future<_CachedTileImage> obtainKey(ImageConfiguration configuration) =>
      SynchronousFuture(this);

  @override
  ImageStreamCompleter loadImage(
      _CachedTileImage key, ImageDecoderCallback decode) {
    return MultiFrameImageStreamCompleter(
      codec: _loadCodec(decode),
      scale: 1.0,
      debugLabel: url,
    );
  }

  Future<ui.Codec> _loadCodec(ImageDecoderCallback decode) async {
    final dir = await dirFuture;
    final file = File("${dir.path}/${z}_${x}_$y.png");
    Uint8List? bytes;
    if (await file.exists()) {
      try {
        bytes = await file.readAsBytes();
      } catch (_) {}
    }
    if (bytes == null || bytes.isEmpty) {
      // Cache miss → fetch and store for next time (offline).
      final res = await http
          .get(Uri.parse(url), headers: {"User-Agent": userAgent})
          .timeout(const Duration(seconds: 20));
      bytes = res.bodyBytes;
      if (res.statusCode == 200 && bytes.isNotEmpty) {
        try {
          await file.writeAsBytes(bytes);
        } catch (_) {}
      }
    }
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    return decode(buffer);
  }

  @override
  bool operator ==(Object other) =>
      other is _CachedTileImage &&
      other.url == url &&
      other.z == z &&
      other.x == x &&
      other.y == y;

  @override
  int get hashCode => Object.hash(url, z, x, y);
}
