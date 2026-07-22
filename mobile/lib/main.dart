import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/app_state.dart';
import 'core/call_service.dart';
import 'core/i18n.dart';
import 'core/theme.dart';
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
        ChangeNotifierProvider(create: (_) => GwTheme()),
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

class GwaveApp extends StatefulWidget {
  const GwaveApp({super.key});

  @override
  State<GwaveApp> createState() => _GwaveAppState();
}

class _GwaveAppState extends State<GwaveApp> {
  Brightness? _painted;

  /// Screens paint with the bare `GwColors` tokens rather than
  /// `Theme.of(context)`, so they have no `InheritedWidget` dependency on the
  /// theme — and a `const` widget (`const FeedScreen()`, say) short-circuits
  /// `Element.updateChild`, so its subtree would never rebuild and would keep
  /// painting the old palette after a switch.
  ///
  /// Marking every element dirty once, only on an actual brightness change,
  /// guarantees each `build()` re-reads the tokens. `State` objects survive
  /// (unlike re-keying the app), so scroll offsets, the navigation stack and
  /// half-typed forms are all preserved.
  void _rebuildEverything(Element el) {
    el.markNeedsBuild();
    el.visitChildren(_rebuildEverything);
  }

  @override
  Widget build(BuildContext context) {
    // Resolve System/Light/Dark to one brightness here, then build the single
    // matching theme. `buildGwTheme` also flips the global `GwColors` palette
    // that the screens paint with, so it must run exactly once per frame —
    // handing MaterialApp both `theme:` and `darkTheme:` would build both and
    // leave the tokens on whichever finished last.
    final brightness = context.watch<GwTheme>().brightness;
    final theme = buildGwTheme(brightness);
    // Keep the status/navigation bar readable against the new background.
    SystemChrome.setSystemUIOverlayStyle(gwOverlayStyle());

    if (_painted != null && _painted != brightness) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.visitChildElements(_rebuildEverything);
      });
    }
    _painted = brightness;

    return MaterialApp(
      title: "Gwave",
      debugShowCheckedModeBanner: false,
      theme: theme,
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
