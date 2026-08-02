import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/i18n.dart';
import '../../core/theme.dart';
import '../messenger/conversations_screen.dart';
import '../settings/settings_screen.dart';
import '../web/web_screen.dart';

/// Native Help & Guide.
///
/// ★ This used to open the web /help page in a WebView. Inside the app that
///   looked wrong twice over: the site's own header and bottom bar rendered
///   underneath the app's, and the answers told people to press Ctrl+Shift+R
///   or "Add to Home screen" — instructions for a browser, given to someone
///   already holding the app. The copy here is rewritten for the app, and the
///   web page stays as-is for people on a desktop.
/// ★ Every answer that names a screen carries a button that actually goes
///   there. A guide that says "go to Settings" and leaves the reader to find
///   it is half a guide.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

/// Where an answer's action button leads.
enum _Go { settings, messenger, notifications, web }

class _Faq {
  const _Faq(this.q, this.a, {this.go, this.goLabel, this.webPath});

  final String q;
  final String a;
  final _Go? go;
  final String? goLabel;
  final String? webPath;
}

class _Section {
  const _Section(this.title, this.icon, this.color, this.items);

  final String title;
  final IconData icon;
  final Color color;
  final List<_Faq> items;
}

class _HelpScreenState extends State<HelpScreen> {
  final _search = TextEditingController();
  String _query = "";

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  // ── Content ───────────────────────────────────────────────────────────
  List<_Section> _sections(BuildContext c) => [
        _Section(
          tr(c, "Account & password", "အကောင့်နှင့် စကားဝှက်"),
          Icons.key_outlined,
          const Color(0xFFF4B740),
          [
            _Faq(
              tr(c, "How do I create an account?", "အကောင့် အသစ် ဘယ်လိုဖွင့်မလဲ?"),
              tr(
                c,
                "On the sign-up screen enter an email and a password of at least "
                    "6 characters — or tap Continue with Google to do it in one "
                    "step. You then pick a name and a username.",
                "စာရင်းသွင်းတဲ့ မျက်နှာပြင်မှာ email နဲ့ စကားဝှက် (အနည်းဆုံး ၆ လုံး) "
                    "ထည့်ပါ — ဒါမှမဟုတ် “Google နဲ့ ဆက်လုပ်ရန်” နဲ့ တစ်ချက်တည်း "
                    "ဖွင့်နိုင်ပါတယ်။ ပြီးရင် နာမည်နဲ့ username ရွေးတဲ့ အဆင့် ဆက်သွားပါမယ်။",
              ),
            ),
            _Faq(
              tr(c, "I forgot my password", "စကားဝှက် မေ့သွားရင် ဘယ်လို ပြန်ရမလဲ?"),
              tr(
                c,
                "1. On the login screen tap “Forgot your password?”.\n"
                    "2. Enter the email the account was opened with and tap Send "
                    "reset link.\n"
                    "3. Open the link in your email and set a new password twice.\n\n"
                    "If the email never arrives: check Spam/Junk, wait about five "
                    "minutes, and make sure the address really is the one the "
                    "account was opened with. Still nothing — message the admin "
                    "using Contact below.",
                "၁။ Login မျက်နှာပြင်က “စကားဝှက် မေ့နေပါသလား?” ကို နှိပ်ပါ။\n"
                    "၂။ အကောင့်ဖွင့်ထားတဲ့ email ရိုက်ထည့်ပြီး “Reset link ပို့မည်” နှိပ်ပါ။\n"
                    "၃။ Email ထဲရောက်လာတဲ့ link ကို နှိပ်ပြီး စကားဝှက်အသစ် ၂ ခါရိုက် "
                    "သတ်မှတ်ပါ။\n\n"
                    "⏳ Email မရောက်ရင် — (က) Spam/Junk folder စစ်ပါ၊ (ခ) ၅ မိနစ်လောက် "
                    "စောင့်ပါ၊ (ဂ) ရိုက်ထည့်တဲ့ email က အကောင့်ဖွင့်တုန်းက email "
                    "ဟုတ်/မဟုတ် ပြန်စစ်ပါ။ ဒါတွေ အကုန်လုပ်လည်း မရရင် အောက်က "
                    "“ဆက်သွယ်ရန်” ကနေ admin ကို အကြောင်းကြားပါ။",
              ),
            ),
            _Faq(
              tr(c, "Change my password while logged in",
                  "Login ဝင်ထားရင်း စကားဝှက် ပြောင်းချင်ရင်?"),
              tr(
                c,
                "Settings → Security. Type the new password twice — the old one "
                    "is not needed.",
                "Settings → 🔐 Security မှာ စကားဝှက်အသစ် ၂ ခါရိုက်ပြီး "
                    "ပြောင်းနိုင်ပါတယ် — စကားဝှက်အဟောင်း မလိုပါ။",
              ),
              go: _Go.settings,
              goLabel: tr(c, "Open Settings", "Settings ဖွင့်ရန်"),
            ),
            _Faq(
              tr(c, "Google sign-in is not working", "Google နဲ့ ဝင်လို့ မရဖြစ်နေရင်?"),
              tr(
                c,
                "Sign in with your email and password instead, then set a "
                    "password in Settings so you always have a second way in. If "
                    "Google keeps failing, tell the admin which account you are "
                    "trying to use.",
                "Email နဲ့ စကားဝှက် သုံးပြီး ဝင်ကြည့်ပါ၊ ပြီးရင် Settings မှာ "
                    "စကားဝှက် သတ်မှတ်ထားပါ — ဝင်လမ်း ၂ ခု ရှိအောင်။ Google က "
                    "ဆက်မရရင် ဘယ်အကောင့်နဲ့ ဝင်ဖို့ ကြိုးစားနေတာလဲ admin ကို "
                    "ပြောပြပါ။",
              ),
              go: _Go.settings,
              goLabel: tr(c, "Open Settings", "Settings ဖွင့်ရန်"),
            ),
          ],
        ),
        _Section(
          tr(c, "Posts & photos", "Post နှင့် ဓာတ်ပုံ"),
          Icons.edit_outlined,
          const Color(0xFF139C9C),
          [
            _Faq(
              tr(c, "How do I post?", "Post ဘယ်လိုတင်မလဲ?"),
              tr(
                c,
                "Tap the box at the top of the feed, write your text, add up to "
                    "10 photos or one video, choose who can see it (everyone / "
                    "friends / only me) and tap Post. You can add a check-in too.",
                "Feed ထိပ်က “ဘာတွေ စိတ်ကူးနေလဲ…” အကွက်ကို နှိပ်ပြီး စာရေး၊ "
                    "ဓာတ်ပုံ (၁၀ ပုံအထိ) / video (၁ ခု) ထည့်၊ မြင်နိုင်သူ "
                    "(အများ/မိတ်ဆွေ/ကိုယ်တိုင်) ရွေးပြီး “တင်မည်” နှိပ်ပါ။ တည်နေရာ "
                    "check-in လည်း ထည့်လို့ရပါတယ်။",
              ),
            ),
            _Faq(
              tr(c, "My photo will not upload", "ဓာတ်ပုံ တင်လို့ မရရင်?"),
              tr(
                c,
                "Photos are shrunk automatically, so size is not the problem. "
                    "Videos have to be under 100 MB. If an error appears, check "
                    "your connection and try again; if it keeps happening send a "
                    "screenshot to the admin.",
                "ပုံဆိုရင် အလိုအလျောက် ချုံ့ပေးလို့ အရွယ်အစား ပူစရာမလိုပါ။ Video "
                    "ကတော့ 100 MB အောက် ဖြစ်ရပါမယ်။ Error စာသား ပေါ်ရင် — "
                    "internet ပြန်စစ်ပြီး ထပ်စမ်းပါ၊ ဆက်မရရင် screenshot နဲ့ admin "
                    "ကို ပို့ပေးပါ။",
              ),
            ),
            _Faq(
              tr(c, "Edit or delete a post", "Post ပြင်/ဖျက် ချင်ရင်?"),
              tr(
                c,
                "Tap ⋯ at the top right of the post and choose Edit or Delete. "
                    "You can only edit or delete your own posts.",
                "Post ရဲ့ ညာဘက်အပေါ် ⋯ ကို နှိပ်ပြီး ပြင်ရန်/ဖျက်ရန် ရွေးပါ — "
                    "ကိုယ့် post ကိုသာ ပြင်/ဖျက် လို့ရပါတယ်။",
              ),
            ),
          ],
        ),
        _Section(
          tr(c, "The app", "App အသုံးပြုခြင်း"),
          Icons.phone_android_outlined,
          const Color(0xFF4C7DF0),
          [
            _Faq(
              tr(c, "Turning on notifications", "Notification (အသိပေးချက်) ဖွင့်နည်း"),
              tr(
                c,
                "Settings → Notifications, then allow the permission Android "
                    "asks for. If you said No earlier, Android will not ask "
                    "again — open the system app settings and turn Notifications "
                    "on there.",
                "Settings → 🔔 Notifications မှာ ဖွင့်ပြီး Android တောင်းတဲ့ ခွင့်ကို "
                    "“Allow” ပေးပါ။ အရင်က “No” လုပ်ထားရင် Android က ထပ်မမေးတော့ဘူး "
                    "— ဖုန်းရဲ့ app settings ထဲ ဝင်ပြီး Notifications ကို ဖွင့်ပေးပါ။",
              ),
              go: _Go.notifications,
              goLabel: tr(c, "Open app settings", "App settings ဖွင့်ရန်"),
            ),
            _Faq(
              tr(c, "How do I update the app?", "App ကို ဘယ်လို update လုပ်မလဲ?"),
              tr(
                c,
                "When a newer build exists a banner appears at the top of the "
                    "app — tap it to download. You can also get the latest APK "
                    "from gwave.cc/welcome. Your build number is at the bottom of "
                    "the Settings screen; always quote it when reporting a "
                    "problem.",
                "Build အသစ် ရှိရင် app ထိပ်မှာ banner ပေါ်လာပါမယ် — နှိပ်ပြီး "
                    "download လုပ်ပါ။ gwave.cc/welcome ကနေလည်း APK အသစ် ယူလို့ "
                    "ရပါတယ်။ ကိုယ့် build နံပါတ်က Settings အောက်ဆုံးမှာ ရှိတယ် — "
                    "ပြဿနာ တင်ပြတဲ့အခါ အဲဒီနံပါတ်ကို အမြဲ ထည့်ပြောပေးပါ။",
              ),
              go: _Go.web,
              webPath: "/welcome",
              goLabel: tr(c, "Download page", "Download စာမျက်နှာ"),
            ),
            _Faq(
              tr(c, "A screen is blank or stuck on old data",
                  "မျက်နှာပြင် ဗလာဖြစ်နေ/အဟောင်း ပြနေရင်"),
              tr(
                c,
                "Pull down to refresh first. If that does not help, close the "
                    "app completely (swipe it out of recents) and open it again. "
                    "A screen that stays broken after that is a bug — please "
                    "report it.",
                "အရင်ဆုံး အောက်ကို ဆွဲပြီး refresh လုပ်ပါ။ မရရင် app ကို "
                    "လုံးဝပိတ် (recents ကနေ ဖယ်ထုတ်) ပြီး ပြန်ဖွင့်ပါ။ ဒါလုပ်ပြီးလည်း "
                    "မကောင်းရင် bug ဖြစ်လို့ တိုင်ကြားပေးပါ။",
              ),
            ),
          ],
        ),
        _Section(
          tr(c, "Safety & reporting", "ဘေးကင်းရေးနှင့် တိုင်ကြားခြင်း"),
          Icons.shield_outlined,
          const Color(0xFFE23B3B),
          [
            _Faq(
              tr(c, "Report a post or a person",
                  "မသင့်တော်တဲ့ post/user ကို တိုင်ကြားချင်ရင်"),
              tr(
                c,
                "Use ⋯ → Report on the post. Admins review every report. To stop "
                    "seeing someone entirely, open their profile and tap Block.",
                "Post ရဲ့ ⋯ → Report ကို သုံးပါ။ Admin တွေ စစ်ဆေးပြီး လိုအပ်သလို "
                    "ဆောင်ရွက်ပါမယ်။ မမြင်ချင်တဲ့သူဆိုရင် သူ့ profile မှာ Block "
                    "လုပ်နိုင်ပါတယ်။",
              ),
            ),
            _Faq(
              tr(c, "Who can see what I post?", "ကိုယ်တင်တာကို ဘယ်သူတွေ မြင်ရလဲ?"),
              tr(
                c,
                "Every post has a visibility setting you choose before posting — "
                    "everyone, friends only, or only you. You can change it later "
                    "from ⋯ → Edit.",
                "Post တစ်ခုချင်းစီမှာ မတင်ခင် ရွေးထားတဲ့ မြင်နိုင်သူ setting ရှိတယ် "
                    "— အများ / မိတ်ဆွေများ / ကိုယ်တိုင်သာ။ နောက်မှလည်း ⋯ → ပြင်ရန် "
                    "ကနေ ပြောင်းလို့ရပါတယ်။",
              ),
            ),
          ],
        ),
      ];

  // ── Actions ───────────────────────────────────────────────────────────
  void _go(_Faq f) {
    switch (f.go) {
      case _Go.settings:
        Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const SettingsScreen()));
      case _Go.messenger:
        Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ConversationsScreen()));
      case _Go.notifications:
        // ★ Android ရဲ့ app settings ကို ဖွင့်တယ် — permission ကို တစ်ခါ "No"
        //   ပေးပြီးရင် app ထဲကနေ ထပ်တောင်းလို့ မရတော့လို့ ဒါက တစ်ခုတည်းသော လမ်း။
        openAppSettings();
      case _Go.web:
        openWeb(context, f.webPath ?? "/help", title: f.q);
      case null:
        break;
    }
  }

  Future<void> _email() async {
    final uri = Uri.parse("mailto:hello@gwave.ai?subject=Gwave%20help");
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(tr(context, "No email app found — hello@gwave.ai",
            "Email app မတွေ့ပါ — hello@gwave.ai")),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _query.trim().toLowerCase();
    // ★ ရှာလိုက်ရင် ရလဒ်မရှိတဲ့ section ကို လုံးဝ ဖျောက်တယ် — ခေါင်းစဉ်ချည်း
    //   ကျန်နေရင် "ရှာလို့ မတွေ့ဘူး" ဆိုတာ မထင်ရှားဘူး။
    final sections = [
      for (final s in _sections(context))
        if (q.isEmpty)
          s
        else
          _Section(
            s.title,
            s.icon,
            s.color,
            s.items
                .where((f) =>
                    f.q.toLowerCase().contains(q) || f.a.toLowerCase().contains(q))
                .toList(),
          )
    ].where((s) => s.items.isNotEmpty).toList();

    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(
        title: Text(tr(context, "Help & guide", "အကူအညီနှင့် လမ်းညွှန်")),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
            GwSpace.md, GwSpace.md, GwSpace.md, GwSpace.xl),
        children: [
          Text(
            tr(
              context,
              "Step-by-step answers for when something in Gwave does not work.",
              "Gwave သုံးရာမှာ အခက်ခဲရှိရင် အဆင့်လိုက် ဖြေရှင်းနည်းများ။",
            ),
            style: TextStyle(
                fontSize: 13, height: 1.5, color: GwColors.inkSoftOf(context)),
          ),
          const SizedBox(height: GwSpace.md),

          TextField(
            controller: _search,
            onChanged: (v) => setState(() => _query = v),
            decoration: InputDecoration(
              hintText: tr(context, "Search help…", "အကူအညီ ရှာရန်…"),
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _search.clear();
                        setState(() => _query = "");
                      },
                    ),
              filled: true,
              fillColor: GwColors.surfaceMutedOf(context),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(GwRadius.lg),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 4),
            ),
          ),
          const SizedBox(height: GwSpace.md),

          if (sections.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Column(children: [
                Icon(Icons.search_off,
                    size: 40, color: GwColors.inkSoftOf(context)),
                const SizedBox(height: 10),
                Text(
                  tr(context, "Nothing matched — try another word, or contact us below.",
                      "မတွေ့ပါ — တခြားစကားလုံးနဲ့ ရှာကြည့်ပါ၊ ဒါမှမဟုတ် အောက်က ဆက်သွယ်ပါ။"),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 12, color: GwColors.inkSoftOf(context)),
                ),
              ]),
            ),

          for (final s in sections) ...[
            _sectionCard(s, expandAll: q.isNotEmpty),
            const SizedBox(height: GwSpace.md),
          ],

          _contactCard(),
        ],
      ),
    );
  }

  Widget _sectionCard(_Section s, {required bool expandAll}) {
    return Container(
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          color: s.color.withValues(alpha: 0.10),
          child: Row(children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: s.color.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(s.icon, size: 17, color: s.color),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(s.title,
                  style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: GwColors.inkOf(context))),
            ),
          ]),
        ),
        for (var i = 0; i < s.items.length; i++)
          _faqTile(s.items[i], s.color,
              first: i == 0, expanded: expandAll),
      ]),
    );
  }

  Widget _faqTile(_Faq f, Color accent,
      {required bool first, required bool expanded}) {
    return Theme(
      // ExpansionTile ရဲ့ default divider ကို ဖျောက်ပြီး ကိုယ်တိုင် ထိန်းတယ်
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: Column(children: [
        if (!first)
          Divider(height: 1, thickness: 1, color: GwColors.lineOf(context)),
        ExpansionTile(
          // ★ ရှာထားချိန်မှာ ဖွင့်ပြီးသား ပြတယ် — ရလဒ်ကို ထပ်နှိပ်ပြီးမှ
          //   ဖတ်ရတာ ရှာတာရဲ့ အဓိပ္ပာယ် ပျက်တယ်။
          key: ValueKey("${f.q}-$expanded"),
          initiallyExpanded: expanded,
          tilePadding: const EdgeInsets.symmetric(horizontal: 14),
          childrenPadding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          iconColor: accent,
          collapsedIconColor: GwColors.inkSoftOf(context),
          title: Text(f.q,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  height: 1.45,
                  color: GwColors.inkOf(context))),
          children: [
            Text(f.a,
                style: TextStyle(
                    fontSize: 13,
                    height: 1.65,
                    color: GwColors.inkSoftOf(context))),
            if (f.go != null) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _go(f),
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: Text(f.goLabel ?? tr(context, "Open", "ဖွင့်ရန်")),
                  style: TextButton.styleFrom(
                    foregroundColor: accent,
                    backgroundColor: accent.withValues(alpha: 0.10),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(GwRadius.md)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ]),
    );
  }

  Widget _contactCard() {
    final accent = GwColors.accentOf(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(GwRadius.lg),
        boxShadow: GwShadow.card,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.forum_outlined, size: 18, color: accent),
          const SizedBox(width: 8),
          Text(tr(context, "Contact us", "ဆက်သွယ်ရန်"),
              style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w700,
                  color: GwColors.inkOf(context))),
        ]),
        const SizedBox(height: 8),
        Text(
          tr(
            context,
            "If this guide did not solve it, email us or message the admin "
                "(Ko Nyein) in Messenger. A screenshot of the problem gets you "
                "helped much faster.",
            "ဒီလမ်းညွှန်နဲ့ မဖြေရှင်းနိုင်တဲ့ ပြဿနာရှိရင် email ပို့ပါ၊ ဒါမှမဟုတ် "
                "Messenger ကနေ admin (Ko Nyein) ကို တိုက်ရိုက် စာပို့ပါ။ ဖြစ်နေတဲ့ "
                "ပြဿနာရဲ့ screenshot ပါ တွဲပို့ပေးရင် ပိုမြန်မြန် ကူညီပေးနိုင်ပါတယ်။",
          ),
          style: TextStyle(
              fontSize: 13, height: 1.65, color: GwColors.inkSoftOf(context)),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: _email,
              icon: const Icon(Icons.mail_outline, size: 17),
              label: Text(tr(context, "Email", "Email ပို့ရန်")),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => const ConversationsScreen())),
              icon: const Icon(Icons.chat_bubble_outline, size: 17),
              label: Text(tr(context, "Messenger", "Messenger")),
            ),
          ),
        ]),
      ]),
    );
  }
}
