import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../../core/api_client.dart';

/// The driver's heartbeat, deliberately kept **outside** the screen that starts
/// it.
///
/// Being online is a property of the driver, not of a route on the navigation
/// stack. The first version owned the position stream inside `DriverScreen`'s
/// state, so `dispose()` cancelled it: a driver who tapped back to look at the
/// map, answer a message, or check their wallet stopped sending heartbeats, and
/// the sweeper marked them offline three minutes later. Nothing on the phone
/// said so — the switch was still on when they came back — and no offer ever
/// reached them.
///
/// So the heartbeat lives here, as one process-wide object, and runs until the
/// driver turns it off or the app is killed. `DriverScreen` starts and stops it
/// and reads its state; it does not own it.
///
/// Location is collected through geolocator's **foreground service** with a
/// persistent notification and NOT `ACCESS_BACKGROUND_LOCATION` — see the
/// compliance note in `driver_screen.dart`. Surviving a screen pop is not
/// background location: the app is still in the foreground, and the driver can
/// still see the notification saying so.
class DriverPresence {
  DriverPresence._();

  static final DriverPresence instance = DriverPresence._();

  StreamSubscription<Position>? _positions;
  Timer? _keepalive;
  Position? _lastPos;
  bool _running = false;

  /// Whether the heartbeat is currently running in this process.
  bool get running => _running;

  /// The last position we managed to read, if any.
  Position? get lastPosition => _lastPos;

  /// When the server last accepted a heartbeat. Shown on the driver screen:
  /// "online" with no recent beat is the exact state that used to fail
  /// silently, and it should be readable from the phone rather than only from
  /// the database.
  DateTime? get lastBeatAt => _lastBeatAt;

  /// Why the last heartbeat failed, if it did. Null while things are working.
  String? get lastBeatError => _lastBeatError;

  DateTime? _lastBeatAt;
  String? _lastBeatError;

  /// Start beating.
  ///
  /// Two signals travel on the same call and they need different triggers.
  /// *Where the driver is* only changes when they move, so the stream is
  /// distance-filtered — a car crawling in traffic does not need to resend the
  /// same coordinates, and battery is what ends a shift early.
  ///
  /// *That the driver still exists* has nothing to do with movement. With only
  /// the distance filter, a driver waiting at a rank sent one heartbeat and
  /// then nothing, so the driver most likely to take the next ride was the one
  /// guaranteed to stop receiving offers. The keepalive re-sends the last known
  /// position every 30s regardless of movement: one small POST a minute, and
  /// the only thing holding a stationary driver in the dispatch pool.
  Future<void> start(ApiClient api) async {
    await _positions?.cancel();
    _keepalive?.cancel();
    _running = true;

    _positions = Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 25,
        intervalDuration: const Duration(seconds: 5),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: "Gwave Driver",
          notificationText: "You're online and receiving ride requests.",
          notificationIcon:
              AndroidResource(name: "ic_launcher", defType: "mipmap"),
          enableWakeLock: true,
          setOngoing: true,
        ),
      ),
    ).listen((pos) {
      _lastPos = pos;
      _beat(api, pos);
    });

    // Send one immediately so going online does not depend on moving first.
    final now = await currentDriverPosition();
    if (now != null) {
      _lastPos = now;
      _beat(api, now);
    }

    _keepalive = Timer.periodic(const Duration(seconds: 30), (_) {
      final pos = _lastPos;
      if (pos != null) _beat(api, pos);
    });
  }

  Future<void> stop() async {
    _running = false;
    _keepalive?.cancel();
    _keepalive = null;
    await _positions?.cancel();
    _positions = null;
  }

  /// Send one heartbeat.
  ///
  /// `online: true` on **every** beat, not just when the switch is flipped.
  /// The heartbeat *is* the statement "I am here and taking rides", and the
  /// server sweeper marks stale drivers offline — so with the flag omitted,
  /// one missed window (a tunnel, a locked phone, an app the OS paused) set
  /// `is_online = false` and nothing could ever set it back. The app kept
  /// beating, the switch still read "online", the position kept updating, and
  /// the driver was invisible to dispatch until they noticed and toggled the
  /// switch by hand. Nobody notices that.
  ///
  /// The server still decides `is_available` — a driver mid-trip is online but
  /// not available — so this cannot put a busy driver back in the pool.
  void _beat(ApiClient api, Position pos) {
    if (!_running) return;
    api
        .rideHeartbeat(
          lat: pos.latitude,
          lng: pos.longitude,
          heading: pos.heading >= 0 ? pos.heading : null,
          speed: pos.speed >= 0 ? pos.speed : null,
          accuracy: pos.accuracy,
          online: true,
        )
        .then((_) {
          _lastBeatAt = DateTime.now();
          _lastBeatError = null;
        })
        // A dropped heartbeat is normal on a bad connection and the next one is
        // seconds away — never interrupt a shift with it. But do keep the
        // reason, so the driver screen can say why it has gone quiet.
        // ★ Return nothing. `catchError` type-checks the handler's result
        // against the future's type and throws a TypeError when it does not
        // match — so returning a Map here turned every dropped heartbeat into
        // an unhandled async error, on top of the failure it was meant to
        // swallow.
        .catchError((Object e) {
          _lastBeatError = e.toString();
        });
  }
}

/// One position, asking for permission if it has not been granted yet.
///
/// Returns null rather than throwing when permission is refused or the fix
/// times out, because every caller's answer to "no position" is the same: say
/// so and stop.
Future<Position?> currentDriverPosition() async {
  try {
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) {
      p = await Geolocator.requestPermission();
    }
    if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
      return null;
    }
    return await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    ).timeout(const Duration(seconds: 12));
  } catch (_) {
    return null;
  }
}
