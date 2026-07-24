import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/app_state.dart';
import 'core/call_service.dart';
import 'core/i18n.dart';
import 'core/theme.dart';
import 'core/theme_pref.dart';
import 'features/auth/login_screen.dart';
import 'features/messenger/call_screen.dart';
import 'features/shell/home_shell.dart';
import 'widgets/splash.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
    return MaterialApp(
      title: "Gwave",
      debugShowCheckedModeBanner: false,
      theme: buildGwTheme(),
      darkTheme: buildGwDarkTheme(),
      themeMode: context.watch<GwThemePref>().mode,
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
        context.read<CallService>().connect();
        return const CallOverlay(child: HomeShell());
    }
  }
}
