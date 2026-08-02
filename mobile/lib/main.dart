import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio_background/just_audio_background.dart';
import 'package:provider/provider.dart';

import 'core/app_state.dart';
import 'core/call_service.dart';
import 'core/i18n.dart';
import 'core/navigation.dart';
import 'core/push_service.dart';
import 'core/theme.dart';
import 'core/theme_pref.dart';
import 'core/video_audio.dart';
import 'features/auth/login_screen.dart';
import 'features/messenger/call_screen.dart';
import 'features/shell/home_shell.dart';
import 'widgets/splash.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Audio keeps playing when the app is minimised / the screen is off, and
  // shows a media notification + lock-screen controls. Never fatal: if the
  // media session can't start, playback just becomes foreground-only.
  try {
    await JustAudioBackground.init(
      androidNotificationChannelId: "cc.gwave.audio",
      androidNotificationChannelName: "Gwave Audio",
      androidNotificationOngoing: true,
      androidStopForegroundOnPause: true,
    );
  } catch (_) {}
  // One owner of the speaker at a time, and nothing keeps playing in the
  // background except the audio player and calls. Installing the observer here
  // is what makes "the app went to the background" reach whatever is playing.
  GwSound.instance.install();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AppState()..bootstrap()),
        ChangeNotifierProvider(create: (_) => GwLang()),
        ChangeNotifierProvider(create: (_) => GwThemePref()),
        // Built once from AppState's api/repo; stable across rebuilds.
        ChangeNotifierProxyProvider<AppState, CallService>(
          create: (ctx) {
            final app = ctx.read<AppState>();
            return CallService(app.api, app.repo);
          },
          update: (_, __, previous) => previous!,
        ),
      ],
      child: const GwaveApp(),
    ),
  );
}

class GwaveApp extends StatelessWidget {
  const GwaveApp({super.key});

  @override
  Widget build(BuildContext context) {
    final pref = context.watch<GwThemePref>();
    // The active skin feeds both theme builders AND GwColors.*Of() helpers;
    // watching the pref rebuilds the whole tree when the user switches.
    GwColors.skin = pref.skin;
    return MaterialApp(
      title: "Gwave",
      // Deep links (gwave://metaverse?room=city) arrive from outside the
      // widget tree, so they need a navigator they can reach without a
      // BuildContext.
      navigatorKey: gwNavigatorKey,
      debugShowCheckedModeBanner: false,
      theme: buildGwTheme(),
      darkTheme: buildGwDarkTheme(),
      themeMode: pref.mode,
      // Players subscribe to this so a screen pushed over a Live (profile,
      // shop sheet, in-app browser) silences it instead of leaving it playing
      // behind the new screen.
      navigatorObservers: [gwRouteObserver],
      home: const _Root(),
    );
  }
}

class _Root extends StatelessWidget {
  const _Root();

  @override
  Widget build(BuildContext context) {
    final status = context.watch<AppState>().status;
    switch (status) {
      case AuthStatus.loading:
        return const SplashScreen();
      case AuthStatus.signedOut:
        return const LoginScreen();
      case AuthStatus.signedIn:
        // Subscribe to the ring inbox so calls can arrive, and drive the
        // incoming/active call screens from the call phase.
        final call = context.read<CallService>();
        call.connect();
        // Register for push (FCM) so incoming calls can wake a closed app.
        // Self-disabling if Firebase isn't configured — never blocks sign-in.
        final api = context.read<AppState>().api;
        PushService.instance.init(
          onToken: (t) => api.registerPushToken(t),
          onCallPush: (data) => call.handleCallPush(data),
        );
        return const CallOverlay(child: HomeShell());
    }
  }
}
