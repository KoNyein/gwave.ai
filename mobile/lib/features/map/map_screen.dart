import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';

/// Native Map hub. The live GPS map itself renders with Google Maps in the web
/// client, so the map view + SOS broadcast hand off there; this screen is the
/// native entry with the emergency action up front.
class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(BuildContext context, String path) =>
      openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("GPS Map")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
        children: [
          // Emergency SOS — the most important action, up top and unmissable.
          _sosCard(context),
          const SizedBox(height: 16),

          // Live map hand-off
          _bigCard(
            icon: Icons.map,
            gradient: GwColors.primaryGradient,
            title: tr(context, "Live map", "တိုက်ရိုက် မြေပုံ"),
            subtitle: tr(context, "See family, SOS and threat alerts on the map", "မိသားစုဝင်များ၊ SOS နှင့် သတိပေးချက်များကို မြေပုံပေါ်တွင် ကြည့်ရန်"),
            actionLabel: tr(context, "Open map", "မြေပုံ ဖွင့်ရန်"),
            onTap: () => _openWeb(context, "/map"),
          ),
          const SizedBox(height: 14),

          // Secondary links
          Row(
            children: [
              Expanded(
                child: _miniCard(
                  icon: Icons.groups_2_outlined,
                  color: const Color(0xFF2E7DB1),
                  label: tr(context, "Family", "မိသားစု"),
                  onTap: () => _openWeb(context, "/family"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _miniCard(
                  icon: Icons.share_location_outlined,
                  color: const Color(0xFF2E9E5B),
                  label: tr(context, "Share location", "တည်နေရာ မျှဝေ"),
                  onTap: () => _openWeb(context, "/map"),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              tr(
                  context,
                  "Note — allow location access so the map and live tracking "
                      "can work.",
                  "မှတ်ချက် — မြေပုံနှင့် တည်နေရာ ရွှေ့လျားမှုကို app ထဲမှာ "
                      "ဖွင့်ဖို့ ဖုန်း၏ location ကို ခွင့်ပြုပါ။"),
              style: TextStyle(color: GwColors.inkSoft, fontSize: 12.5),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sosCard(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: () => _openWeb(context, "/map"),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: GwColors.liveGradient,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(Icons.emergency, color: Colors.white, size: 28),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(tr(context, "🆘 Emergency SOS", "🆘 အရေးပေါ် SOS"),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 2),
                  Text(
                      tr(context, "Call for help with your location",
                          "တည်နေရာနှင့်အတူ အကူအညီတောင်းရန်"),
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 13)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white),
          ],
        ),
      ),
    );
  }

  Widget _bigCard({
    required IconData icon,
    required Gradient gradient,
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: Colors.white, size: 30),
          const SizedBox(height: 12),
          Text(title,
              style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(subtitle,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.9), fontSize: 13)),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: GwColors.primary,
              ),
              icon: const Icon(Icons.open_in_new, size: 18),
              label: Text(actionLabel),
            ),
          ),
        ],
      ),
    );
  }

  Widget _miniCard({
    required IconData icon,
    required Color color,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(GwRadius.lg),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: GwColors.surface,
          borderRadius: BorderRadius.circular(GwRadius.lg),
          boxShadow: GwShadow.card,
        ),
        child: Column(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(height: 8),
            Text(label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
