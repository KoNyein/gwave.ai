import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'offline_tiles.dart';

/// Bottom sheet to download the current map view for offline use, and manage
/// the tile cache. Pass the map's current visible bounds and active layer.
class OfflineAreaSheet extends StatefulWidget {
  const OfflineAreaSheet({
    super.key,
    required this.bounds,
    required this.centerZoom,
    required this.layerKey,
    required this.urlTemplate,
    required this.userAgent,
  });

  final LatLngBounds bounds;
  final double centerZoom;
  final String layerKey;
  final String urlTemplate;
  final String userAgent;

  @override
  State<OfflineAreaSheet> createState() => _OfflineAreaSheetState();
}

class _OfflineAreaSheetState extends State<OfflineAreaSheet> {
  // How much extra detail to grab beyond the current zoom.
  int _extraZoom = 2;
  bool _downloading = false;
  double _progress = 0;
  int _done = 0, _total = 0;
  int _cacheBytes = 0;
  final ValueNotifier<bool> _cancel = ValueNotifier(false);

  int get _minZoom => widget.centerZoom.floor().clamp(2, 18);
  int get _maxZoom => (_minZoom + _extraZoom).clamp(2, 18);

  @override
  void initState() {
    super.initState();
    _refreshCache();
  }

  @override
  void dispose() {
    _cancel.dispose();
    super.dispose();
  }

  Future<void> _refreshCache() async {
    final b = await OfflineTiles.cacheBytes();
    if (mounted) setState(() => _cacheBytes = b);
  }

  int get _estimate =>
      OfflineTiles.estimateTileCount(widget.bounds, _minZoom, _maxZoom);

  Future<void> _download() async {
    _cancel.value = false;
    setState(() {
      _downloading = true;
      _progress = 0;
      _done = 0;
      _total = _estimate;
    });
    final saved = await OfflineTiles.downloadRegion(
      bounds: widget.bounds,
      minZoom: _minZoom,
      maxZoom: _maxZoom,
      layerKey: widget.layerKey,
      urlTemplate: widget.urlTemplate,
      userAgent: widget.userAgent,
      cancel: _cancel,
      onProgress: (p, done, total) {
        if (mounted) {
          setState(() {
            _progress = p;
            _done = done;
            _total = total;
          });
        }
      },
    );
    if (!mounted) return;
    setState(() => _downloading = false);
    await _refreshCache();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(_cancel.value
            ? tr(context, "Download stopped.", "ဒေါင်းလုဒ် ရပ်လိုက်ပြီ။")
            : tr(context, "Saved $saved tiles for offline use.",
                "Offline အတွက် tile $saved ခု သိမ်းပြီး။")),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final big = _estimate > 2500;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.download_for_offline, color: GwColors.primary),
              const SizedBox(width: 8),
              Text(tr(context, "Offline map", "Offline မြေပုံ"),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 18)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            tr(context,
                "Download the area you're viewing so the map works with no internet. Your GPS location always works offline.",
                "ကြည့်နေတဲ့ ဧရိယာကို ဒေါင်းထားရင် အင်တာနက်မရှိလည်း မြေပုံ အလုပ်လုပ်ပါမယ်။ GPS တည်နေရာက offline အမြဲ အလုပ်လုပ်ပါတယ်။"),
            style: TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5),
          ),
          const SizedBox(height: 16),

          if (_downloading) ...[
            LinearProgressIndicator(
              value: _progress,
              minHeight: 8,
              backgroundColor: GwColors.surfaceMutedOf(context),
              color: GwColors.primary,
            ),
            const SizedBox(height: 8),
            Text("$_done / $_total tiles",
                style: TextStyle(
                    color: GwColors.inkSoftOf(context), fontSize: 12)),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _cancel.value = true,
                icon: const Icon(Icons.stop),
                label: Text(tr(context, "Stop", "ရပ်မည်")),
              ),
            ),
          ] else ...[
            Text(tr(context, "Detail level", "အသေးစိတ်အဆင့်"),
                style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            SegmentedButton<int>(
              segments: [
                ButtonSegment(
                    value: 1, label: Text(tr(context, "Basic", "အခြေခံ"))),
                ButtonSegment(
                    value: 2, label: Text(tr(context, "Standard", "ပုံမှန်"))),
                ButtonSegment(
                    value: 3, label: Text(tr(context, "Detailed", "အသေးစိတ်"))),
              ],
              selected: {_extraZoom},
              onSelectionChanged: (s) =>
                  setState(() => _extraZoom = s.first),
            ),
            const SizedBox(height: 10),
            Text(
              "${tr(context, "About", "ခန့်မှန်း")} $_estimate tiles · ${tr(context, "zoom", "zoom")} $_minZoom–$_maxZoom",
              style:
                  TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5),
            ),
            if (big)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  tr(context,
                      "Large area — zoom in a bit or pick a lower detail level to save storage/data.",
                      "ဧရိယာ ကြီးနေတယ် — နည်းနည်း zoom ချ ဒါမှမဟုတ် အဆင့်လျှော့ပါ။"),
                  style: const TextStyle(color: GwColors.gold, fontSize: 12),
                ),
              ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _download,
                icon: const Icon(Icons.download),
                label: Text(tr(context, "Download this area",
                    "ဒီဧရိယာ ဒေါင်းမည်")),
              ),
            ),
          ],

          const Divider(height: 28),
          Row(
            children: [
              Icon(Icons.sd_storage_outlined,
                  color: GwColors.inkSoftOf(context), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  "${tr(context, "Cached", "သိမ်းထား")}: ${OfflineTiles.prettySize(_cacheBytes)}",
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              TextButton(
                onPressed: _cacheBytes == 0
                    ? null
                    : () async {
                        await OfflineTiles.clearCache();
                        await _refreshCache();
                      },
                child: Text(tr(context, "Clear", "ရှင်း"),
                    style: const TextStyle(color: GwColors.live)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
