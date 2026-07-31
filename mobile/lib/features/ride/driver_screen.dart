import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';
import 'package:realtime_client/realtime_client.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import 'driver_apply_screen.dart';
import 'ride_models.dart';

/// Driver Mode — go online, take offers, run the trip, see the money.
///
/// Not a second app. A second APK would mean a second signing key, a second
/// release channel and a second thing to keep in step with the server; a mode
/// behind an approved `ride_driver_profiles` row costs none of that. The
/// trade-off is that a driver carries the whole super-app on their phone, which
/// is fine — most of them already do.
///
/// ## Location, and the Play Store
///
/// While online the app runs a **foreground service** (geolocator's
/// `ForegroundNotificationConfig`) with a persistent notification, NOT
/// `ACCESS_BACKGROUND_LOCATION`. That is a deliberate compliance decision:
/// background location triggers Play Store's prominent-disclosure review, which
/// is the single most common reason ride apps get rejected or pulled. A
/// foreground service collects position only while Driver Mode is on and the
/// driver can see that it is. Do not "fix" a missed offer by adding the
/// background permission.
class DriverScreen extends StatefulWidget {
  const DriverScreen({super.key});

  @override
  State<DriverScreen> createState() => _DriverScreenState();
}

class _DriverScreenState extends State<DriverScreen> {
  bool _loading = true;
  Map<String, dynamic>? _me; // /api/ride/driver/apply GET
  bool _online = false;
  bool _toggling = false;
  String? _error;

  Ride? _trip;
  RideCounterpart? _rider;

  /// The offer currently on screen, and when it stops being valid.
  Map<String, dynamic>? _offer;
  DateTime? _offerExpires;

  StreamSubscription<Position>? _positions;
  Timer? _tick;
  Timer? _tripPoll;
  RealtimeClient? _rt;
  RealtimeChannel? _inbox;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _positions?.cancel();
    _tick?.cancel();
    _tripPoll?.cancel();
    _inbox?.unsubscribe();
    _rt?.disconnect();
    super.dispose();
  }

  ApiClient get _api => context.read<AppState>().api;

  Map<String, dynamic>? get _profile =>
      _me?["driver"] is Map ? Map<String, dynamic>.from(_me!["driver"]) : null;

  String get _status => _profile?["status"]?.toString() ?? "none";

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final me = await _api.rideDriverMe();
      if (!mounted) return;
      setState(() => _me = me);
      if (_status == "approved") {
        await _resumeTrip();
        _listen();
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// A driver whose app was killed mid-trip must come back to the trip, not to
  /// an idle home screen with a passenger sitting in their car.
  Future<void> _resumeTrip() async {
    try {
      final j = await _api.rideActive();
      if (!mounted) return;
      final row = j["asDriver"];
      final driver = j["driver"];
      setState(() {
        _trip = row is Map ? Ride.fromJson(Map<String, dynamic>.from(row)) : null;
        _online = driver is Map && driver["online"] == true;
      });
      final pending = j["pendingOffer"];
      if (pending is Map && _trip == null) {
        setState(() {
          _offer = Map<String, dynamic>.from(pending);
          _offerExpires = DateTime.tryParse(pending["expiresAt"]?.toString() ?? "");
        });
        _startTicking();
      }
      if (_trip != null) _watchTrip();
      if (_online) await _startLocation();
    } catch (_) {
      // Nothing to resume, or the server is briefly unreachable.
    }
  }

  // ---- Going online -------------------------------------------------------

  Future<void> _setOnline(bool value) async {
    if (_toggling) return;
    setState(() {
      _toggling = true;
      _error = null;
    });
    try {
      if (value) {
        final pos = await _currentPosition();
        if (pos == null) {
          setState(() => _error =
              "Location permission is needed to go online. Allow it in Settings.");
          return;
        }
        await _api.rideHeartbeat(
          lat: pos.latitude,
          lng: pos.longitude,
          heading: pos.heading >= 0 ? pos.heading : null,
          speed: pos.speed >= 0 ? pos.speed : null,
          accuracy: pos.accuracy,
          online: true,
        );
        await _startLocation();
      } else {
        await _positions?.cancel();
        _positions = null;
        final pos = await _currentPosition();
        await _api.rideHeartbeat(
          lat: pos?.latitude ?? 0,
          lng: pos?.longitude ?? 0,
          online: false,
        );
      }
      if (mounted) setState(() => _online = value);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't change your status.");
    } finally {
      if (mounted) setState(() => _toggling = false);
    }
  }

  Future<Position?> _currentPosition() async {
    try {
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) {
        p = await Geolocator.requestPermission();
      }
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) {
        return null;
      }
      return await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
    } catch (_) {
      return null;
    }
  }

  /// The heartbeat, as a distance-filtered position stream inside a foreground
  /// service.
  ///
  /// `distanceFilter` rather than a timer: a driver parked at a taxi rank does
  /// not need to send the same coordinates every four seconds, and the phone
  /// battery is the thing that ends their shift early. Movement is what the
  /// dispatcher cares about.
  Future<void> _startLocation() async {
    await _positions?.cancel();
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
      _api
          .rideHeartbeat(
            lat: pos.latitude,
            lng: pos.longitude,
            heading: pos.heading >= 0 ? pos.heading : null,
            speed: pos.speed >= 0 ? pos.speed : null,
            accuracy: pos.accuracy,
          )
          // A dropped heartbeat is normal on a bad connection and the next one
          // is seconds away — never surface it as an error mid-shift.
          .catchError((_) => <String, dynamic>{});
    });
  }

  // ---- Offers -------------------------------------------------------------

  Future<void> _listen() async {
    try {
      if (!AppConfig.runtimeLoaded) await _api.loadRuntimeConfig();
      await _api.freshToken();
      final token = _api.session?.token;
      final myId = _api.session?.profileId;
      if (token == null || myId == null) return;
      _rt = RealtimeClient(
        AppConfig.realtimeUrl,
        params: {"apikey": AppConfig.supabaseAnonKey},
      );
      _rt!.setAuth(token);
      _rt!.connect();
      _inbox = _rt!.channel("ride-driver:$myId");
      _inbox!
        ..onBroadcast(
          event: "ride_offer",
          callback: (p) {
            final b = p["payload"];
            final body = b is Map ? Map<String, dynamic>.from(b) : p;
            if (!mounted || _trip != null) return;
            setState(() {
              _offer = body;
              _offerExpires =
                  DateTime.tryParse(body["expiresAt"]?.toString() ?? "");
            });
            _startTicking();
          },
        )
        ..onBroadcast(
          event: "offer_expired",
          callback: (_) {
            if (mounted) _clearOffer();
          },
        );
      _inbox!.subscribe();
    } catch (_) {
      // Offers also arrive by FCM; the socket is the fast path, not the only one.
    }
  }

  /// Repaint the countdown once a second. Its other job is to drop the offer
  /// when the window closes, so a driver never taps Accept on something the
  /// dispatcher has already passed to somebody else.
  void _startTicking() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      final expires = _offerExpires;
      if (expires == null || DateTime.now().isAfter(expires)) {
        _clearOffer();
      } else if (mounted) {
        setState(() {});
      }
    });
  }

  void _clearOffer() {
    _tick?.cancel();
    if (!mounted) return;
    setState(() {
      _offer = null;
      _offerExpires = null;
    });
  }

  int get _secondsLeft {
    final e = _offerExpires;
    if (e == null) return 0;
    final s = e.difference(DateTime.now()).inSeconds;
    return s < 0 ? 0 : s;
  }

  Future<void> _respond(bool accept) async {
    final offer = _offer;
    final rideId = offer?["rideId"]?.toString();
    if (rideId == null) return;
    _clearOffer();
    try {
      final won = await _api.rideRespondOffer(rideId, accept: accept);
      if (!accept) return;
      if (!won) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Another driver took that one.")),
          );
        }
        return;
      }
      await _resumeTrip();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  // ---- Running the trip ---------------------------------------------------

  void _watchTrip() {
    _tripPoll?.cancel();
    _tripPoll = Timer.periodic(const Duration(seconds: 5), (_) async {
      final id = _trip?.id;
      if (id == null) return;
      try {
        final j = await _api.rideGet(id);
        if (!mounted) return;
        final ride = Ride.fromJson(Map<String, dynamic>.from(j["ride"] as Map));
        final other = j["counterpart"];
        setState(() {
          _trip = rideIsLive(ride.status) ? ride : null;
          _rider = other is Map
              ? RideCounterpart.fromJson(Map<String, dynamic>.from(other))
              : null;
        });
        if (!rideIsLive(ride.status)) {
          _tripPoll?.cancel();
          await _load();
        }
      } catch (_) {
        // Transient; the next tick retries.
      }
    });
  }

  Future<void> _advance(String status) async {
    final id = _trip?.id;
    if (id == null) return;
    setState(() => _error = null);
    try {
      final row = await _api.rideSetStatus(id, status);
      if (!mounted) return;
      final ride = Ride.fromJson(row);
      setState(() => _trip = rideIsLive(ride.status) ? ride : null);
      if (!rideIsLive(ride.status)) {
        _tripPoll?.cancel();
        if (mounted && ride.paymentMethod == "cash") {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                  "Collect ${formatKyat(ride.payable)} in cash from the passenger."),
              duration: const Duration(seconds: 6),
            ),
          );
        }
        await _load();
      } else {
        _watchTrip();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  // ---- Safety -------------------------------------------------------------

  /// The same Gwave SOS the passenger has, raised from the driver's side and
  /// carrying the trip: which ride, where it was going, and the current
  /// position. A driver alone in a car with a stranger is exposed in exactly
  /// the way a passenger is, and a safety feature only one side of the trip has
  /// is half a safety feature.
  Future<void> _sos() async {
    final trip = _trip;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Send emergency alert?"),
        content: const Text(
            "Your live position and this trip's details go out to nearby Gwave "
            "users and your family circle."),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text("Cancel")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: GwColors.live),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Send SOS"),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    final pos = await _currentPosition();
    if (pos == null) {
      if (mounted) {
        setState(() => _error = "Couldn't get your position for the SOS.");
      }
      return;
    }
    try {
      await context.read<AppState>().repo.sendSos(
            pos.latitude,
            pos.longitude,
            reason: "unsafe",
            message: [
              "SOS from a Gwave driver during a trip.",
              if (trip != null) "Heading to: ${trip.dropoffAddress}",
              if (_rider?.name != null) "Passenger: ${_rider!.name}",
            ].join(" · "),
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("🆘 SOS sent with your location."),
          duration: Duration(seconds: 5),
        ),
      );
    } catch (e) {
      if (mounted) setState(() => _error = "Couldn't send the SOS — $e");
    }
  }

  // ---- Build --------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      appBar: AppBar(title: const Text("Driver Mode")),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                children: [
                  if (_error != null) ...[
                    _ErrorCard(text: _error!),
                    const SizedBox(height: 12),
                  ],
                  ..._body(),
                ],
              ),
            ),
    );
  }

  List<Widget> _body() {
    switch (_status) {
      case "none":
        return [
          GwEmpty(
            icon: Icons.local_taxi_outlined,
            title: "Drive with Gwave",
            subtitle:
                "Earn on your own schedule. You'll need your driving licence, "
                "a photo of your vehicle and its registration.",
            actionLabel: "Apply to drive",
            onAction: _openApply,
          ),
        ];
      case "pending":
        return [
          const _StatusCard(
            icon: Icons.hourglass_top,
            colour: GwColors.gold,
            title: "Application under review",
            body: "We're checking your documents. This usually takes a day or two.",
          ),
        ];
      case "rejected":
        return [
          _StatusCard(
            icon: Icons.error_outline,
            colour: GwColors.live,
            title: "Application not approved",
            body: _profile?["review_note"]?.toString() ??
                "Your documents couldn't be verified.",
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _openApply,
            style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                backgroundColor: GwColors.primary),
            child: const Text("Apply again"),
          ),
        ];
      case "suspended":
        return const [
          _StatusCard(
            icon: Icons.block,
            colour: GwColors.live,
            title: "Account suspended",
            body: "Please contact Gwave support.",
          ),
        ];
      default:
        return _approvedBody();
    }
  }

  void _openApply() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => DriverApplyScreen(existing: _profile),
      ),
    );
    if (changed == true) _load();
  }

  List<Widget> _approvedBody() {
    final trip = _trip;
    final offer = _offer;
    final today = _me?["today"] is Map
        ? Map<String, dynamic>.from(_me!["today"])
        : const <String, dynamic>{};
    final balance = _me?["balance"] is Map
        ? Map<String, dynamic>.from(_me!["balance"])
        : const <String, dynamic>{};
    final owed = (balance["commission_owed"] as num?) ?? 0;

    return [
      // The offer takes over the top of the screen: it has a deadline and
      // everything else on this page can wait.
      if (offer != null) ...[
        _OfferCard(
          offer: offer,
          secondsLeft: _secondsLeft,
          onAccept: () => _respond(true),
          onDecline: () => _respond(false),
        ),
        const SizedBox(height: 14),
      ],
      if (trip != null) ...[
        _TripCard(
          ride: trip,
          rider: _rider,
          onAdvance: _advance,
          onSos: _sos,
        ),
        const SizedBox(height: 14),
      ],
      if (trip == null) _onlineCard(),
      const SizedBox(height: 14),
      Row(
        children: [
          Expanded(
            child: GwStatTile(
              label: "Trips today",
              value: "${today["trips"] ?? 0}",
              icon: Icons.route,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: GwStatTile(
              label: "Earned today",
              value: formatKyat((today["net"] as num?) ?? 0),
              icon: Icons.payments,
            ),
          ),
        ],
      ),
      // Debt is shown even at zero: a driver who only learns about it when
      // offers stop arriving assumes the app is broken.
      const SizedBox(height: 10),
      GwCard(
        accent: owed > 0 ? GwColors.gold : null,
        child: Row(
          children: [
            Icon(Icons.account_balance_wallet_outlined,
                color: owed > 0 ? GwColors.gold : GwColors.inkSoftOf(context)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Commission owed",
                      style: TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    owed > 0
                        ? "From cash trips. Settle it to keep receiving cash rides."
                        : "Nothing owed — you're all clear.",
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12.5),
                  ),
                ],
              ),
            ),
            Text(formatKyat(owed),
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 16)),
          ],
        ),
      ),
    ];
  }

  Widget _onlineCard() => GwCard(
        accent: _online ? GwColors.primaryBright : null,
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: (_online ? GwColors.primaryBright : GwColors.inkSoft)
                    .withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _online ? Icons.wifi_tethering : Icons.wifi_tethering_off,
                color: _online ? GwColors.primaryBright : GwColors.inkSoft,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_online ? "You're online" : "You're offline",
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 2),
                  Text(
                    _online
                        ? "Receiving ride requests nearby."
                        : "Turn this on to start receiving requests.",
                    style: TextStyle(
                        color: GwColors.inkSoftOf(context), fontSize: 12.5),
                  ),
                ],
              ),
            ),
            if (_toggling)
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Switch(value: _online, onChanged: _setOnline),
          ],
        ),
      );
}

// ---- Cards ----------------------------------------------------------------

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GwColors.live.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, size: 18, color: GwColors.live),
            const SizedBox(width: 8),
            Expanded(
                child: Text(text, style: const TextStyle(fontSize: 13))),
          ],
        ),
      );
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.icon,
    required this.colour,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final Color colour;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => GwCard(
        accent: colour,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: colour),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(body,
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 13)),
                ],
              ),
            ),
          ],
        ),
      );
}

/// An incoming ride, with the clock running.
///
/// The countdown is a bar rather than a number alone: a driver glances at this
/// while driving, and "how much time is left" reads faster as a shrinking bar
/// than as digits they have to focus on.
class _OfferCard extends StatelessWidget {
  const _OfferCard({
    required this.offer,
    required this.secondsLeft,
    required this.onAccept,
    required this.onDecline,
  });

  final Map<String, dynamic> offer;
  final int secondsLeft;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final fare = (offer["fare"] as num?) ?? 0;
    final toPickup = (offer["distanceToPickupM"] as num?)?.toInt() ?? 0;
    final tripM = (offer["distanceM"] as num?)?.toInt() ?? 0;
    final cash = offer["paymentMethod"] != "gpay";
    final pickup = offer["pickup"] is Map
        ? Map<String, dynamic>.from(offer["pickup"])
        : const {};
    final dropoff = offer["dropoff"] is Map
        ? Map<String, dynamic>.from(offer["dropoff"])
        : const {};
    // The bar assumes the standard 15s window; a longer configured timeout just
    // starts the bar further along, which is harmless.
    final fraction = (secondsLeft / 15).clamp(0.0, 1.0);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: GwColors.primaryBright, width: 2),
        boxShadow: const [
          BoxShadow(color: Color(0x22000000), blurRadius: 14),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Text("New ride request",
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              const Spacer(),
              Text("${secondsLeft}s",
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                      color: GwColors.live)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 5,
              backgroundColor: GwColors.lineOf(context),
              valueColor: AlwaysStoppedAnimation(
                fraction > 0.35 ? GwColors.primaryBright : GwColors.live,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Text(formatKyat(fare),
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w900)),
              const SizedBox(width: 10),
              GwPill(
                label: cash ? "Cash" : "G-Pay",
                icon: cash ? Icons.payments : Icons.account_balance_wallet,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            "${formatDistance(toPickup)} to pickup · ${formatDistance(tripM)} trip",
            style:
                TextStyle(color: GwColors.inkSoftOf(context), fontSize: 12.5),
          ),
          const SizedBox(height: 12),
          _Leg(
            colour: GwColors.primaryBright,
            text: pickup["address"]?.toString() ?? "Pickup",
          ),
          const SizedBox(height: 6),
          _Leg(
            colour: GwColors.live,
            text: dropoff["address"]?.toString() ?? "Destination",
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onDecline,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    foregroundColor: GwColors.inkSoftOf(context),
                  ),
                  child: const Text("Decline"),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: onAccept,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                    backgroundColor: GwColors.primary,
                  ),
                  child: const Text("Accept",
                      style: TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 16)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The trip in progress, and the one button that moves it forward.
///
/// One button, never a row of them: the driver is holding a phone at a kerb,
/// and the next legal step is always exactly one thing. The server's state
/// machine would reject the others anyway.
class _TripCard extends StatelessWidget {
  const _TripCard({
    required this.ride,
    required this.rider,
    required this.onAdvance,
    required this.onSos,
  });

  final Ride ride;
  final RideCounterpart? rider;
  final void Function(String status) onAdvance;
  final VoidCallback onSos;

  @override
  Widget build(BuildContext context) {
    final (label, next) = switch (ride.status) {
      RideStatus.accepted => ("I've arrived", "arrived"),
      RideStatus.arrived => ("Start trip", "in_progress"),
      _ => ("Complete trip", "completed"),
    };
    final cash = ride.paymentMethod == "cash";

    return GwCard(
      accent: GwColors.primaryBright,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  switch (ride.status) {
                    RideStatus.accepted => "Head to the pickup",
                    RideStatus.arrived => "Waiting for the passenger",
                    _ => "Trip in progress",
                  },
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
              Text(formatKyat(ride.payable),
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900)),
              // A driver alone in a car with a stranger is as exposed as the
              // passenger is. Same button, same alert board.
              IconButton(
                onPressed: onSos,
                tooltip: "Emergency",
                icon: const Icon(Icons.sos, color: GwColors.live),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (rider != null)
            Row(
              children: [
                GwAvatar(
                    url: rider!.avatar, name: rider!.name ?? "Passenger", size: 38),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(rider!.name ?? "Passenger",
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
                GwPill(
                  label: cash ? "Cash" : "G-Pay",
                  icon: cash ? Icons.payments : Icons.account_balance_wallet,
                ),
              ],
            ),
          const SizedBox(height: 12),
          _Leg(colour: GwColors.primaryBright, text: ride.pickupAddress),
          const SizedBox(height: 6),
          _Leg(colour: GwColors.live, text: ride.dropoffAddress),
          const SizedBox(height: 12),
          Row(
            children: [
              // Navigation is handed to whatever maps app the driver already
              // trusts. Building turn-by-turn into Gwave would be worse than
              // every option already on their phone.
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    final p = ride.status == RideStatus.accepted ||
                            ride.status == RideStatus.arrived
                        ? ride.pickup
                        : ride.dropoff;
                    launchUrl(
                      Uri.parse(
                          "google.navigation:q=${p.latitude},${p.longitude}"),
                      mode: LaunchMode.externalApplication,
                    ).catchError((_) => false);
                  },
                  icon: const Icon(Icons.navigation_outlined, size: 18),
                  label: const Text("Navigate"),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(46)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: FilledButton(
                  onPressed: () => onAdvance(next),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(46),
                    backgroundColor: GwColors.primary,
                  ),
                  child: Text(label,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Leg extends StatelessWidget {
  const _Leg({required this.colour, required this.text});
  final Color colour;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(color: colour, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 13.5)),
          ),
        ],
      );
}
