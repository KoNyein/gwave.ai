import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/repository.dart';
import '../../core/theme.dart';
import '../web/web_screen.dart';
import '../../widgets/common.dart';

/// Native Settings — edit the profile (name, bio, avatar, cover) directly in
/// the app; account-level items (password, language, membership) still open
/// the web settings, and log out lives at the bottom.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _bio = TextEditingController();
  bool _saving = false;
  bool _uploadingAvatar = false;
  bool _uploadingCover = false;

  @override
  void initState() {
    super.initState();
    final me = context.read<AppState>().me;
    _name.text = me?.fullName ?? "";
    _username.text = me?.username ?? "";
    _bio.text = me?.bio ?? "";
  }

  @override
  void dispose() {
    _name.dispose();
    _username.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    // Validate the username before hitting the server (3–30 chars, a-z 0-9 _).
    final uname = _username.text.trim().toLowerCase();
    if (uname.isNotEmpty && !RegExp(r'^[a-z0-9_]{3,30}$').hasMatch(uname)) {
      _snack(tr(
          context,
          "Username: 3–30 letters, numbers or _ only.",
          "Username — အက္ခရာ/ဂဏန်း/_ ၃-၃၀ လုံးသာ ဖြစ်ရမည်။"));
      return;
    }
    setState(() => _saving = true);
    try {
      final state = context.read<AppState>();
      await state.repo.updateMyProfile(
        fullName: _name.text,
        username: uname.isEmpty ? null : uname,
        bio: _bio.text,
      );
      await state.refreshMe();
      if (mounted) {
        _snack(tr(context, "Saved ✓ — pull the feed to refresh",
            "သိမ်းပြီးပါပြီ ✓ — feed ကို ဆွဲ၍ refresh လုပ်ပါ"),
            ok: true);
      }
    } catch (e) {
      final msg = e.toString();
      // PostgREST returns a unique-violation when the handle is taken.
      final taken = msg.contains("duplicate") ||
          msg.contains("unique") ||
          msg.contains("23505");
      _snack(taken
          ? tr(context, "That username is already taken.",
              "ဒီ username ကို အသုံးပြုပြီးသားပါ။")
          : "${tr(context, "Couldn't save", "မသိမ်းနိုင်ပါ")} — $e");
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _changePhoto({required bool cover}) async {
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: cover ? 2000 : 1000,
        imageQuality: 85,
      );
      if (file == null) return;
      setState(() =>
          cover ? _uploadingCover = true : _uploadingAvatar = true);
      final bytes = await file.readAsBytes();
      final ext = file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
      final state = context.read<AppState>();
      final path = await state.api.uploadBytes(
        bytes,
        ext: ext,
        contentType: ext == "png" ? "image/png" : "image/jpeg",
      );
      await state.repo.updateMyProfile(
        avatarPath: cover ? null : path,
        coverPath: cover ? path : null,
      );
      await state.refreshMe();
      _snack(tr(context, "Updated ✓", "ပြောင်းပြီးပါပြီ ✓"), ok: true);
    } catch (e) {
      _snack("${tr(context, "Failed", "မအောင်မြင်ပါ")} — $e");
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAvatar = false;
          _uploadingCover = false;
        });
      }
    }
  }

  void _snack(String m, {bool ok = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(m),
        backgroundColor: ok ? GwColors.primary : null,
      ));
    }
  }

  /// Web features open in the signed-in in-app browser — never the external
  /// browser, where no session exists.
  Future<void> _openWeb(String path) => openWeb(context, path);

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final me = state.me;
    final name = me?.displayName ?? "Gwave user";
    return Scaffold(
      appBar: AppBar(title: const Text("Settings")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
        children: [
          // Avatar + cover editor
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              children: [
                Stack(
                  children: [
                    GwAvatar(
                        url: resolveMedia(me?.avatarUrl),
                        name: name,
                        size: 92),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: InkWell(
                        onTap: _uploadingAvatar
                            ? null
                            : () => _changePhoto(cover: false),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: GwColors.primary,
                            shape: BoxShape.circle,
                          ),
                          child: _uploadingAvatar
                              ? Padding(
                                  padding: const EdgeInsets.all(7),
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation(
                                          GwColors.onPrimary)),
                                )
                              : Icon(Icons.camera_alt,
                                  color: GwColors.onPrimary, size: 16),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 17)),
                if (me?.username != null)
                  Text("@${me!.username}",
                      style: TextStyle(color: GwColors.inkSoft)),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _uploadingCover
                      ? null
                      : () => _changePhoto(cover: true),
                  icon: _uploadingCover
                      ? const SizedBox(
                          width: 15,
                          height: 15,
                          child:
                              CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.image_outlined, size: 17),
                  label: Text(tr(context, "Change cover photo", "Cover ဓာတ်ပုံ ပြောင်းရန်")),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: GwColors.primary,
                    side: BorderSide(color: GwColors.line),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Profile fields
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tr(context, "Edit profile", "ပရိုဖိုင် ပြင်ရန်"),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: "Profile name",
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _username,
                  autocorrect: false,
                  decoration: InputDecoration(
                    labelText: tr(context, "Username", "အသုံးပြုသူအမည်"),
                    hintText: "yourname",
                    prefixText: "@",
                    prefixIcon: const Icon(Icons.alternate_email),
                    helperText: tr(
                        context,
                        "Shown as your name if you have no profile name",
                        "Profile name မရှိရင် ဒါကို နာမည်အဖြစ် ပြပါမည်"),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bio,
                  maxLines: 3,
                  maxLength: 300,
                  decoration: const InputDecoration(
                    labelText: "Bio",
                    alignLabelWithHint: true,
                    prefixIcon: Icon(Icons.notes_outlined),
                  ),
                ),
                SizedBox(
                  width: double.infinity,
                  height: 46,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _saveProfile,
                    child: _saving
                        ? SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                valueColor: AlwaysStoppedAnimation(
                                    GwColors.onPrimary)))
                        : Text(tr(context, "Save", "သိမ်းမည်")),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Account rows → web
          Container(
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: Column(
              children: [
                _row(Icons.lock_outline, "Password / Security",
                    () => _openWeb("/settings")),
                const Divider(height: 1, indent: 56),
                _languageRow(context),
                const Divider(height: 1, indent: 56),
                _themeRow(context),
                const Divider(height: 1, indent: 56),
                _row(Icons.workspace_premium_outlined, "Membership",
                    () => _openWeb("/membership")),
                const Divider(height: 1, indent: 56),
                _row(Icons.help_outline, tr(context, "Help", "အကူအညီ"), () => _openWeb("/help")),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Log out
          Container(
            decoration: BoxDecoration(
              color: GwColors.surface,
              borderRadius: BorderRadius.circular(GwRadius.lg),
              boxShadow: GwShadow.card,
            ),
            child: ListTile(
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: GwColors.live.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child:
                    Icon(Icons.logout, color: GwColors.live, size: 20),
              ),
              title: Text("Log out",
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: GwColors.live)),
              onTap: () => context.read<AppState>().logout(),
            ),
          ),
        ],
      ),
    );
  }

  /// App language — English is the default; Burmese is the opt-in choice.
  Widget _languageRow(BuildContext context) {
    final lang = context.watch<GwLang>();
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: GwColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(Icons.translate, color: GwColors.primary, size: 20),
      ),
      title: Text(tr(context, "Language", "ဘာသာစကား"),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
      trailing: SegmentedButton<String>(
        segments: const [
          ButtonSegment(value: "en", label: Text("EN")),
          ButtonSegment(value: "my", label: Text("မြန်မာ")),
        ],
        selected: {lang.code},
        showSelectedIcon: false,
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: GwColors.primary.withValues(alpha: 0.15),
          selectedForegroundColor: GwColors.primary,
          visualDensity: VisualDensity.compact,
        ),
        onSelectionChanged: (v) => lang.setCode(v.first),
      ),
    );
  }

  /// Appearance — System (follow the phone), Light, or Dark. Dark is a true
  /// AMOLED black, so on an OLED panel the background pixels are switched off
  /// rather than lit dim grey: easier at night and cheaper on battery.
  ///
  /// Icon-only segments because three word labels do not fit the trailing slot
  /// at Burmese text sizes; each carries a tooltip and the choice is spelled
  /// out in the subtitle underneath.
  Widget _themeRow(BuildContext context) {
    final theme = context.watch<GwTheme>();
    final label = switch (theme.mode) {
      ThemeMode.light => tr(context, "Light", "အလင်း"),
      ThemeMode.dark => tr(context, "Dark (AMOLED)", "အမှောင် (AMOLED)"),
      ThemeMode.system => tr(context, "Follow system", "စနစ်အတိုင်း"),
    };
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: GwColors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(Icons.dark_mode_outlined, color: GwColors.primary, size: 20),
      ),
      title: Text(tr(context, "Appearance", "အသွင်အပြင်"),
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
      subtitle: Text(label, style: TextStyle(color: GwColors.inkSoft)),
      trailing: SegmentedButton<ThemeMode>(
        segments: [
          ButtonSegment(
            value: ThemeMode.system,
            icon: const Icon(Icons.brightness_auto_outlined, size: 18),
            tooltip: tr(context, "Follow system", "စနစ်အတိုင်း"),
          ),
          ButtonSegment(
            value: ThemeMode.light,
            icon: const Icon(Icons.light_mode_outlined, size: 18),
            tooltip: tr(context, "Light", "အလင်း"),
          ),
          ButtonSegment(
            value: ThemeMode.dark,
            icon: const Icon(Icons.dark_mode_outlined, size: 18),
            tooltip: tr(context, "Dark (AMOLED)", "အမှောင် (AMOLED)"),
          ),
        ],
        selected: {theme.mode},
        showSelectedIcon: false,
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: GwColors.primary.withValues(alpha: 0.15),
          selectedForegroundColor: GwColors.primary,
          visualDensity: VisualDensity.compact,
        ),
        onSelectionChanged: (v) => theme.setMode(v.first),
      ),
    );
  }

  Widget _row(IconData icon, String label, VoidCallback onTap) => ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: GwColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: GwColors.primary, size: 20),
        ),
        title: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
        trailing:
            Icon(Icons.chevron_right, color: GwColors.inkSoft),
        onTap: onTap,
      );
}
