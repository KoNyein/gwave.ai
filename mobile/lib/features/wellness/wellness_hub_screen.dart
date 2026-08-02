import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import 'breathing_screen.dart';
import 'meditation_screen.dart';
import 'wellness_common.dart';
import 'yoga_screen.dart';

/// The Wellness hub — a native launcher for the three guided practices:
/// Wim Hof breathing, Myanmar Theravada Buddhist meditation, and Yoga. Each
/// discipline is a full screen with its history & science, guided practice with
/// sound and voice, in-app videos, a step-by-step guide and a help section.
class WellnessHubScreen extends StatelessWidget {
  const WellnessHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(context, "Wellness", "ကျန်းမာကြံ့ခိုင်ရေး")),
        actions: const [LangToggle()],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 40),
        children: [
          wellnessHero(
            context,
            icon: Icons.self_improvement,
            title: tr(context, "Breathe, sit, move", "အသက်ရှူ၊ တရားထိုင်၊ လှုပ်ရှား"),
            subtitle: tr(
                context,
                "Guided breathing, Buddhist meditation and yoga — with history, science, video and voice guidance.",
                "လမ်းညွှန်ပါ အသက်ရှူ၊ ဗုဒ္ဓဘာသာ တရားထိုင်နှင့် ယောဂ — သမိုင်း၊ သိပ္ပံ၊ ဗီဒီယိုနှင့် အသံလမ်းညွှန်ဖြင့်။"),
          ),
          const SizedBox(height: 16),

          _card(
            context,
            icon: Icons.air,
            colors: const [Color(0xFF0E7490), Color(0xFF155E75)],
            title: tr(context, "Wim Hof breathing", "Wim Hof အသက်ရှူနည်း"),
            subtitle: tr(
                context,
                "Power-breathing, retention & the science of the method.",
                "အသက်ပြင်းရှူ၊ အသက်အောင့်နှင့် ၎င်းနည်း၏ သိပ္ပံ။"),
            tags: [
              tr(context, "Guided", "လမ်းညွှန်"),
              tr(context, "Science", "သိပ္ပံ"),
              tr(context, "Video", "ဗီဒီယို"),
            ],
            onTap: () => _go(context, const BreathingScreen()),
          ),
          _card(
            context,
            icon: Icons.spa,
            colors: const [Color(0xFFB45309), Color(0xFF92400E)],
            title: tr(context, "Buddhist meditation", "ဗုဒ္ဓဘာသာ တရားထိုင်"),
            subtitle: tr(
                context,
                "Ānāpāna, Vipassanā & Mettā — the Myanmar Theravāda path.",
                "အာနာပါန၊ ဝိပဿနာနှင့် မေတ္တာ — မြန်မာ ထေရဝါဒ လမ်းစဉ်။"),
            tags: [
              tr(context, "Dhamma", "ဓမ္မ"),
              tr(context, "Sit timer", "တရားထိုင် timer"),
              tr(context, "Talks", "တရားတော်"),
            ],
            onTap: () => _go(context, const MeditationScreen()),
          ),
          _card(
            context,
            icon: Icons.accessibility_new,
            colors: const [Color(0xFF6D28D9), Color(0xFF5B21B6)],
            title: tr(context, "Yoga", "ယောဂ"),
            subtitle: tr(
                context,
                "History, the eight limbs, guided pose flow & breathwork.",
                "သမိုင်း၊ အင်္ဂါရှစ်ပါး၊ လမ်းညွှန်ပါ ကိုယ်ဟန်စီးဆင်းမှုနှင့် အသက်ရှူနည်း။"),
            tags: [
              tr(context, "Asana", "အာဆန"),
              tr(context, "Flow timer", "flow timer"),
              tr(context, "Video", "ဗီဒီယို"),
            ],
            onTap: () => _go(context, const YogaScreen()),
          ),

          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: GwColors.surfaceOf(context),
              borderRadius: BorderRadius.circular(GwRadius.md),
              border: Border.all(color: GwColors.lineOf(context)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline,
                    color: GwColors.inkSoftOf(context), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tr(
                        context,
                        "For wellbeing and learning only. These practices are not medical or religious instruction and don't replace a qualified teacher or doctor.",
                        "ကျန်းမာရေးနှင့် လေ့လာရေးအတွက်သာ။ ဤအလေ့အကျင့်များသည် ဆေးဘက်ဆိုင်ရာ (သို့) ဘာသာရေး သွန်သင်ချက် မဟုတ်ပါ။ ကျွမ်းကျင်ဆရာ (သို့) ဆရာဝန်ကို အစားထိုး၍ မရပါ။"),
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _go(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  Widget _card(
    BuildContext context, {
    required IconData icon,
    required List<Color> colors,
    required String title,
    required String subtitle,
    required List<String> tags,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(GwRadius.lg),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: GwColors.surfaceOf(context),
            borderRadius: BorderRadius.circular(GwRadius.lg),
            boxShadow: GwShadow.card,
          ),
          child: Column(
            children: [
              Container(
                height: 76,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: colors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(GwRadius.lg)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Icon(icon, color: Colors.white, size: 26),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(title,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 16.5)),
                    ),
                    const Icon(Icons.chevron_right, color: Colors.white70),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(subtitle,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context),
                            fontSize: 13,
                            height: 1.35)),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final t in tags)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: GwColors.bgOf(context),
                              borderRadius: BorderRadius.circular(20),
                              border:
                                  Border.all(color: GwColors.lineOf(context)),
                            ),
                            child: Text(t,
                                style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: GwColors.inkSoftOf(context))),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
