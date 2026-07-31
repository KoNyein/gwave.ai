import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:realtime_client/realtime_client.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api_client.dart';
import '../../core/app_state.dart';
import '../../core/config.dart';
import '../../core/theme.dart';
import '../../widgets/common.dart';
import '../map/offline_tiles.dart';
import 'ride_models.dart';

/// Book a ride — one screen, a full-bleed map, and a bottom sheet whose
/// contents follow the trip's state.
///
/// Why one screen rather than a page per step: the map is continuous context.
/// Pushing a route for "choose vehicle" and another for "searching" rebuilds
/// the map each time and throws away the camera, so the pickup pin jumps
/// around underneath the rider while they are trying to confirm where it is.
/// Swapping the sheet's contents leaves the map exactly where it was.
///
/// The screen mirrors the server's state machine rather than keeping its own.
/// Every transition is decided in the database (see db/sql/ride-hailing.sql);
/// what arrives here is the result, so the UI cannot get into a state the
/// backend disagrees with.
class RideScreen extends StatefulWidget {
  const RideScreen({super.key});

  @override
  State<RideScreen> createState() => _RideScreenState();
}

/// Where the rider is in the booking flow, before a ride exists. Once one does,
/// [Ride.status] takes over.
enum _Step { pickDropoff, choosing, booking }

class _RideScreenState extends State<RideScreen> {
  final MapController _map = MapController();

  static const LatLng _fallbackCentre = LatLng(16.8409, 96.1735); // Yangon

  LatLng? _pickup;
  String _pickupLabel = "";
  LatLng? _dropoff;
  final TextEditingController _dropoffLabel = TextEditingController();

  _Step _step = _Step.pickDropoff;
  RideQuote? _quote;
  String _vehicle = "bike";
  String _payment = "cash";
  bool _loadingQuote = false;
  bool _sharing = false;
  bool _searching = false;
  List<Map<String, dynamic>> _places = const [];
  Timer? _searchDebounce;
  String? _error;

  Ride? _ride;
  RideCounterpart? _driver;
  LatLng? _driverPos;

  Timer? _poll;
  RealtimeClient? _rt;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _locate();
    _resumeActiveRide();
    _search("");
  }

  @override
  void dispose() {
    _poll?.cancel();
    _searchDebounce?.cancel();
    _channel?.unsubscribe();
    _rt?.disconnect();
    _dropoffLabel.dispose();
    super.dispose();
  }

  ApiClient get _api => context.read<AppState>().api;

  // ---- Location -----------------------------------------------------------

  Future<void> _locate() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        // Not fatal: the rider can still drop a pickup pin by hand. Saying so
        // beats a blank map with no explanation.
        if (mounted) {
          setState(() => _error =
              "Location is off, so tap the map to set your pickup point.");
        }
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.high),
      ).timeout(const Duration(seconds: 12));
      if (!mounted) return;
      final me = LatLng(pos.latitude, pos.longitude);
      setState(() {
        _pickup = me;
        _pickupLabel = "Current location";
      });
      _map.move(me, 15);
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Couldn't get your location. Tap to set it.");
      }
    }
  }

  // ---- Resuming -----------------------------------------------------------

  /// A trip survives the app being killed. Without this the rider reopens
  /// Gwave to a fresh booking screen while a driver is on the way to them.
  Future<void> _resumeActiveRide() async {
    try {
      final j = await _api.rideActive();
      final row = j["asRider"];
      if (row is Map && mounted) {
        final ride = Ride.fromJson(Map<String, dynamic>.from(row));
        setState(() => _ride = ride);
        _watch(ride);
      }
    } catch (_) {
      // An unreachable server on open is not worth an error banner — the
      // booking screen still works and the next call will report properly.
    }
  }

  // ---- Quote --------------------------------------------------------------

  Future<void> _fetchQuote() async {
    final from = _pickup, to = _dropoff;
    if (from == null || to == null) return;
    setState(() {
      _loadingQuote = true;
      _error = null;
    });
    try {
      final j = await _api.rideQuote(
        fromLat: from.latitude,
        fromLng: from.longitude,
        toLat: to.latitude,
        toLng: to.longitude,
      );
      if (!mounted) return;
      final quote = RideQuote.fromJson(j);
      setState(() {
        _quote = quote;
        _step = _Step.choosing;
        if (quote.options.isNotEmpty &&
            !quote.options.any((o) => o.vehicleType == _vehicle)) {
          _vehicle = quote.options.first.vehicleType;
        }
      });
      _fitRoute();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't price that trip.");
    } finally {
      if (mounted) setState(() => _loadingQuote = false);
    }
  }

  void _fitRoute() {
    final from = _pickup, to = _dropoff;
    if (from == null || to == null) return;
    _map.fitCamera(
      CameraFit.bounds(
        bounds: LatLngBounds(from, to),
        padding: const EdgeInsets.fromLTRB(60, 100, 60, 320),
      ),
    );
  }

  // ---- Booking ------------------------------------------------------------

  Future<void> _book() async {
    final from = _pickup, to = _dropoff, quote = _quote;
    if (from == null || to == null || quote == null) return;
    final option = quote.options.firstWhere(
      (o) => o.vehicleType == _vehicle,
      orElse: () => quote.options.first,
    );

    setState(() {
      _step = _Step.booking;
      _error = null;
    });
    try {
      final row = await _api.rideRequest(
        vehicleType: option.vehicleType,
        fromLat: from.latitude,
        fromLng: from.longitude,
        fromAddress: _pickupLabel.isEmpty ? "Pickup point" : _pickupLabel,
        toLat: to.latitude,
        toLng: to.longitude,
        toAddress: _dropoffLabel.text.trim().isEmpty
            ? "Dropped pin"
            : _dropoffLabel.text.trim(),
        paymentMethod: _payment,
        expectedFare: option.fare,
      );
      if (!mounted) return;
      final ride = Ride.fromJson(row);
      setState(() => _ride = ride);
      _watch(ride);
    } on ApiException catch (e) {
      if (!mounted) return;
      // The price moved between the quote and the tap. Re-price rather than
      // charging the new number quietly — see FARE_DRIFT_TOLERANCE server-side.
      setState(() {
        _step = _Step.choosing;
        _error = e.message;
      });
      if (e.status == 409) _fetchQuote();
    } catch (_) {
      if (mounted) {
        setState(() {
          _step = _Step.choosing;
          _error = "Couldn't book that ride.";
        });
      }
    }
  }

  // ---- Watching a live ride ----------------------------------------------

  /// Poll for state, subscribe for position.
  ///
  /// The poll is not only a read: on the server each rider GET advances the
  /// driver search by one step, so this loop IS the dispatcher's clock while
  /// the rider waits. The realtime channel carries the driver's position
  /// between polls so the car moves smoothly instead of jumping every 3s.
  void _watch(Ride ride) {
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 3), (_) => _refresh());
    _subscribe(ride.id);
    _refresh();
  }

  Future<void> _refresh() async {
    final id = _ride?.id;
    if (id == null) return;
    try {
      final j = await _api.rideGet(id);
      if (!mounted) return;
      final ride = Ride.fromJson(Map<String, dynamic>.from(j["ride"] as Map));
      final other = j["counterpart"];
      setState(() {
        _ride = ride;
        _driver = other is Map
            ? RideCounterpart.fromJson(Map<String, dynamic>.from(other))
            : null;
      });
      if (!rideIsLive(ride.status)) {
        _poll?.cancel();
        _channel?.unsubscribe();
      }
    } catch (_) {
      // Keep polling: a dropped request mid-trip is a bad moment to give up,
      // and the next tick is three seconds away.
    }
  }

  Future<void> _subscribe(String rideId) async {
    try {
      if (!AppConfig.runtimeLoaded) await _api.loadRuntimeConfig();
      await _api.freshToken();
      final token = _api.session?.token;
      if (token == null) return;
      _rt = RealtimeClient(
        AppConfig.realtimeUrl,
        params: {"apikey": AppConfig.supabaseAnonKey},
      );
      _rt!.setAuth(token);
      _rt!.connect();
      _channel = _rt!.channel("ride:$rideId");
      _channel!
        ..onBroadcast(
          event: "driver_position",
          callback: (p) {
            // Server-relayed broadcasts arrive wrapped; unwrap before reading,
            // the same envelope the call signalling deals with.
            final b = p["payload"];
            final body = b is Map ? Map<String, dynamic>.from(b) : p;
            final lat = (body["lat"] as num?)?.toDouble();
            final lng = (body["lng"] as num?)?.toDouble();
            if (lat == null || lng == null || !mounted) return;
            setState(() => _driverPos = LatLng(lat, lng));
          },
        )
        // Any state change: let the poll fetch the authoritative row rather
        // than trusting the broadcast's shape. The broadcast is a hint that
        // something happened, not the record of what.
        ..onBroadcast(event: "ride_accepted", callback: (_) => _refresh())
        ..onBroadcast(event: "ride_arrived", callback: (_) => _refresh())
        ..onBroadcast(event: "ride_in_progress", callback: (_) => _refresh())
        ..onBroadcast(event: "ride_completed", callback: (_) => _refresh())
        ..onBroadcast(event: "ride_cancelled", callback: (_) => _refresh())
        ..onBroadcast(event: "ride_expired", callback: (_) => _refresh());
      _channel!.subscribe();
    } catch (_) {
      // Polling alone is enough to run the trip; the socket only smooths it.
    }
  }

  Future<void> _cancel() async {
    final id = _ride?.id;
    if (id == null) return;
    final fee = _ride?.status == RideStatus.requested ? null : "a fee";
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Cancel this ride?"),
        content: Text(fee == null
            ? "No driver has accepted yet, so there's no charge."
            : "A driver is already on the way. Cancelling now may cost a cancellation fee."),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Keep it"),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: GwColors.live),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Cancel ride"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await _api.rideCancel(id);
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  // ---- Destination search -------------------------------------------------

  /// Debounced so a rider typing "Junction City" costs one provider call
  /// instead of thirteen. 350ms is roughly the gap between words rather than
  /// between keystrokes.
  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    // Editing the text un-picks the place it named — otherwise the rider ends
    // up booking to the last thing they tapped under a label they since
    // rewrote.
    if (_dropoff != null) setState(() => _dropoff = null);
    _searchDebounce =
        Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String q) async {
    if (!mounted) return;
    setState(() => _searching = q.trim().isNotEmpty);
    try {
      final places = await _api.ridePlaces(
        q.trim(),
        nearLat: _pickup?.latitude,
        nearLng: _pickup?.longitude,
      );
      if (mounted) setState(() => _places = places);
    } catch (_) {
      // No suggestions is a workable state — the map is still tappable.
      if (mounted) setState(() => _places = const []);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  void _pickPlace(Map<String, dynamic> place) {
    final lat = (place["lat"] as num?)?.toDouble();
    final lng = (place["lng"] as num?)?.toDouble();
    if (lat == null || lng == null) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _dropoff = LatLng(lat, lng);
      _dropoffLabel.text = place["label"]?.toString() ?? "";
      _places = const [];
      _quote = null;
      _step = _Step.pickDropoff;
    });
    _fitRoute();
  }

  // ---- Safety -------------------------------------------------------------

  /// Hand someone a link that follows this trip.
  ///
  /// The link needs no Gwave account, because the person a rider sends this to
  /// at 11pm is often not a Gwave user, and "install our app first" is not an
  /// answer to "I'm worried about you".
  Future<void> _shareTrip() async {
    final ride = _ride;
    if (ride == null) return;
    setState(() => _sharing = true);
    try {
      final url = await _api.rideShare(ride.id);
      if (!mounted) return;
      final driver = _driver;
      await Share.share([
        "I'm in a Gwave ride.",
        if (driver?.plate != null) "Vehicle: ${driver!.plate}",
        "To: ${ride.dropoffAddress}",
        "Follow me live: $url",
      ].join("\n"));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = "Couldn't create the link.");
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  /// Raise an SOS from inside the trip.
  ///
  /// This is the generic Gwave SOS — same table, same map board, same
  /// responders — but the message carries the ride: the plate, the driver, and
  /// where the trip was going. A "help me" with no vehicle in it is the version
  /// nobody can act on, and the plate is the first thing anyone will ask for.
  Future<void> _sos() async {
    final ride = _ride;
    if (ride == null) return;

    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 4),
              child: Text("Emergency",
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                "Your alert includes this trip's vehicle, plate and your live "
                "position.",
                style: TextStyle(color: GwColors.inkSoft, fontSize: 13),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.sos, color: GwColors.live),
              title: const Text("Send Gwave SOS"),
              subtitle: const Text("Alerts nearby Gwave users and your family circle"),
              onTap: () => Navigator.pop(ctx, "sos"),
            ),
            ListTile(
              leading: const Icon(Icons.local_police_outlined),
              title: const Text("Call police (199)"),
              subtitle: const Text("Opens your dialler"),
              onTap: () => Navigator.pop(ctx, "call"),
            ),
            ListTile(
              leading: const Icon(Icons.close),
              title: const Text("Cancel"),
              onTap: () => Navigator.pop(ctx),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;

    if (choice == "call") {
      // Pre-filled, not auto-dialled: a pocket tap must not call the police.
      await launchUrl(Uri.parse("tel:199"));
      return;
    }

    final driver = _driver;
    final where = _driverPos ?? ride.pickup;
    try {
      await context.read<AppState>().repo.sendSos(
            where.latitude,
            where.longitude,
            reason: "unsafe",
            message: [
              "SOS during a Gwave ride.",
              if (driver?.plate != null) "Vehicle: ${driver!.plate}",
              if (driver?.vehicle != null) driver!.vehicle!,
              if (driver?.name != null) "Driver: ${driver!.name}",
              "Heading to: ${ride.dropoffAddress}",
            ].join(" · "),
            phone: driver?.phone,
          );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("🆘 SOS sent with your location and this vehicle."),
          duration: Duration(seconds: 5),
        ),
      );
    } catch (e) {
      if (mounted) setState(() => _error = "Couldn't send the SOS — $e");
    }
  }

  void _reset() {
    _poll?.cancel();
    _channel?.unsubscribe();
    setState(() {
      _ride = null;
      _driver = null;
      _driverPos = null;
      _quote = null;
      _dropoff = null;
      _dropoffLabel.clear();
      _step = _Step.pickDropoff;
      _error = null;
    });
  }

  // ---- Build --------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final ride = _ride;
    return Scaffold(
      backgroundColor: GwColors.bgOf(context),
      body: Stack(
        children: [
          _buildMap(),
          const _TopFade(),
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            left: 8,
            child: _RoundButton(
              icon: Icons.arrow_back,
              onTap: () => Navigator.of(context).maybePop(),
            ),
          ),
          if (ride == null && _pickup != null)
            Positioned(
              bottom: 300,
              right: 12,
              child: _RoundButton(icon: Icons.my_location, onTap: _locate),
            ),
          Align(
            alignment: Alignment.bottomCenter,
            child: _sheet(ride),
          ),
        ],
      ),
    );
  }

  Widget _buildMap() {
    final markers = <Marker>[
      if (_pickup != null)
        Marker(
          point: _pickup!,
          width: 40,
          height: 40,
          child: const _Dot(color: GwColors.primaryBright, icon: Icons.circle),
        ),
      if (_dropoff != null)
        Marker(
          point: _dropoff!,
          width: 44,
          height: 44,
          alignment: Alignment.topCenter,
          child: const _Dot(color: GwColors.live, icon: Icons.place),
        ),
      if (_driverPos != null)
        Marker(
          point: _driverPos!,
          width: 44,
          height: 44,
          child: _Dot(
            color: vehicleStyle(_ride?.vehicleType ?? "bike").color,
            icon: vehicleStyle(_ride?.vehicleType ?? "bike").icon,
          ),
        ),
    ];

    final line = _quote?.polyline;
    final route = line == null ? const <LatLng>[] : decodePolyline(line);

    return FlutterMap(
      mapController: _map,
      options: MapOptions(
        initialCenter: _pickup ?? _fallbackCentre,
        initialZoom: 14,
        minZoom: 4,
        maxZoom: 18,
        // Tapping the map is how a destination gets set — there is no address
        // search yet, and a map you cannot tap would leave no way to book.
        onTap: _ride != null
            ? null
            : (_, p) {
                setState(() {
                  if (_pickup == null) {
                    _pickup = p;
                    _pickupLabel = "Dropped pin";
                  } else {
                    _dropoff = p;
                    _quote = null;
                    _step = _Step.pickDropoff;
                  }
                });
              },
      ),
      children: [
        TileLayer(
          urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          userAgentPackageName: "ai.gwave.app",
          maxZoom: 19,
          tileProvider:
              CachingTileProvider(layerKey: "osm", userAgent: "ai.gwave.app"),
        ),
        if (route.length > 1)
          PolylineLayer(
            polylines: [
              Polyline(
                points: route,
                strokeWidth: 5,
                color: GwColors.primary.withValues(alpha: 0.85),
              ),
            ],
          ),
        MarkerLayer(markers: markers),
      ],
    );
  }

  Widget _sheet(Ride? ride) {
    final child = ride == null ? _bookingSheet() : _rideSheet(ride);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: GwColors.surfaceOf(context),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: const [
          BoxShadow(
              color: Color(0x1F000000), blurRadius: 18, offset: Offset(0, -4)),
        ],
      ),
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, 16 + MediaQuery.of(context).padding.bottom),
      child: SafeArea(
        top: false,
        child: AnimatedSize(
          duration: const Duration(milliseconds: 180),
          alignment: Alignment.topCenter,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: GwColors.lineOf(context),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              if (_error != null) ...[
                _Banner(text: _error!),
                const SizedBox(height: 12),
              ],
              child,
            ],
          ),
        ),
      ),
    );
  }

  // ---- Sheet: before a ride exists ---------------------------------------

  Widget _bookingSheet() {
    if (_step == _Step.choosing && _quote != null) return _vehicleSheet(_quote!);
    if (_step == _Step.booking) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    return _destinationSheet();
  }

  Widget _destinationSheet() {
    final ready = _pickup != null && _dropoff != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text("Where to?",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        _PointRow(
          colour: GwColors.primaryBright,
          label: _pickup == null ? "Tap the map to set pickup" : _pickupLabel,
          muted: _pickup == null,
        ),
        const SizedBox(height: 10),
        // One field does both jobs: type to search, or leave the label you
        // typed as the name for a pin you tapped. Splitting them into "search"
        // and "name this place" would be two boxes that look the same and do
        // different things.
        TextField(
          controller: _dropoffLabel,
          textInputAction: TextInputAction.search,
          onChanged: _onSearchChanged,
          decoration: InputDecoration(
            prefixIcon: const Icon(Icons.search, color: GwColors.live),
            suffixIcon: _searching
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : _dropoff != null
                    ? const Icon(Icons.check_circle,
                        color: GwColors.primaryBright)
                    : null,
            hintText: "Where to? Or tap the map",
            filled: true,
            fillColor: GwColors.surfaceMutedOf(context),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        if (_places.isNotEmpty) ...[
          const SizedBox(height: 6),
          ConstrainedBox(
            // Capped so the suggestions never push the button off screen —
            // a rider who cannot reach "See prices" is stuck.
            constraints: const BoxConstraints(maxHeight: 210),
            child: ListView.builder(
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              itemCount: _places.length,
              itemBuilder: (_, i) => _PlaceTile(
                place: _places[i],
                onTap: () => _pickPlace(_places[i]),
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        FilledButton(
          onPressed: ready && !_loadingQuote ? _fetchQuote : null,
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            backgroundColor: GwColors.primary,
          ),
          child: _loadingQuote
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Text("See prices",
                  style: TextStyle(fontWeight: FontWeight.w700)),
        ),
      ],
    );
  }

  Widget _vehicleSheet(RideQuote quote) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            const Text("Choose a ride",
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const Spacer(),
            Text(
              "${formatDistance(quote.distanceM)} · ${formatMinutes(quote.durationS)}",
              style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...quote.options.map((o) => _VehicleTile(
              option: o,
              selected: o.vehicleType == _vehicle,
              onTap: () => setState(() => _vehicle = o.vehicleType),
            )),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _PayChip(
                icon: Icons.payments,
                label: "Cash",
                selected: _payment == "cash",
                onTap: () => setState(() => _payment = "cash"),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PayChip(
                icon: Icons.account_balance_wallet,
                label: "G-Pay",
                selected: _payment == "gpay",
                onTap: () => setState(() => _payment = "gpay"),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            TextButton(
              onPressed: () => setState(() {
                _step = _Step.pickDropoff;
                _quote = null;
              }),
              child: const Text("Back"),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton(
                onPressed: _book,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  backgroundColor: GwColors.primary,
                ),
                child: const Text("Confirm ride",
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ---- Sheet: a ride exists ----------------------------------------------

  Widget _rideSheet(Ride ride) {
    switch (ride.status) {
      case RideStatus.requested:
        return _searchingSheet(ride);
      case RideStatus.accepted:
      case RideStatus.arrived:
      case RideStatus.inProgress:
        return _tripSheet(ride);
      case RideStatus.completed:
        return _completedSheet(ride);
      case RideStatus.cancelled:
        return _endedSheet(
          icon: Icons.cancel,
          colour: GwColors.live,
          title: ride.cancelledBy == "driver"
              ? "The driver cancelled"
              : "Ride cancelled",
          detail: ride.cancelFee > 0
              ? "Cancellation fee: ${formatKyat(ride.cancelFee)}"
              : null,
        );
      case RideStatus.expired:
        return _endedSheet(
          icon: Icons.search_off,
          colour: GwColors.inkSoft,
          title: "No drivers available",
          detail: "Nobody nearby accepted. Try again in a moment.",
        );
    }
  }

  Widget _searchingSheet(Ride ride) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text("Finding a driver…",
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              ),
              Text(formatKyat(ride.quotedFare),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            "We're asking the closest drivers one at a time.",
            style:
                TextStyle(color: GwColors.inkSoftOf(context), fontSize: 13),
          ),
          const SizedBox(height: 14),
          OutlinedButton(
            onPressed: _cancel,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              foregroundColor: GwColors.live,
            ),
            child: const Text("Cancel"),
          ),
        ],
      );

  Widget _tripSheet(Ride ride) {
    final driver = _driver;
    final headline = switch (ride.status) {
      RideStatus.accepted => "Driver on the way",
      RideStatus.arrived => "Your driver is here",
      _ => "On the trip",
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(headline,
                  style: const TextStyle(
                      fontSize: 19, fontWeight: FontWeight.w800)),
            ),
            GwPill(
              label: ride.paymentMethod == "gpay" ? "G-Pay" : "Cash",
              icon: ride.paymentMethod == "gpay"
                  ? Icons.account_balance_wallet
                  : Icons.payments,
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (driver != null)
          Row(
            children: [
              GwAvatar(
                  url: driver.avatar, name: driver.name ?? "Driver", size: 46),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.name ?? "Driver",
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(
                      [
                        driver.plate,
                        driver.vehicle,
                        if (driver.rating != null)
                          "★ ${driver.rating!.toStringAsFixed(1)}",
                      ].whereType<String>().join(" · "),
                      style: const TextStyle(
                          color: GwColors.inkSoft, fontSize: 12.5),
                    ),
                  ],
                ),
              ),
              if (driver.phone != null)
                _RoundButton(
                  icon: Icons.call,
                  filled: true,
                  onTap: () => launchUrl(Uri.parse("tel:${driver.phone}")),
                ),
            ],
          ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: GwColors.surfaceMutedOf(context),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              _PointRow(
                  colour: GwColors.primaryBright,
                  label: ride.pickupAddress,
                  dense: true),
              const SizedBox(height: 8),
              _PointRow(
                  colour: GwColors.live,
                  label: ride.dropoffAddress,
                  dense: true),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Safety sits above the fare, not buried in a menu. The two things a
        // passenger might need in a hurry are "let someone follow me" and
        // "get help", and a rider who has to go hunting for either has
        // already been failed.
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _sharing ? null : _shareTrip,
                icon: _sharing
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.ios_share, size: 18),
                label: const Text("Share trip"),
                style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(44)),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: FilledButton.icon(
                onPressed: _sos,
                icon: const Icon(Icons.sos, size: 20),
                label: const Text("SOS"),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  backgroundColor: GwColors.live,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Text(formatKyat(ride.payable),
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w800)),
            const Spacer(),
            if (ride.status != RideStatus.inProgress)
              TextButton(
                onPressed: _cancel,
                style: TextButton.styleFrom(foregroundColor: GwColors.live),
                child: const Text("Cancel"),
              ),
          ],
        ),
      ],
    );
  }

  Widget _completedSheet(Ride ride) => _RatingSheet(
        key: ValueKey("rate-${ride.id}"),
        ride: ride,
        alreadyRated: ride.riderRating != null,
        onSubmit: (stars, comment) async {
          await _api.rideRate(ride.id, stars, comment: comment);
        },
        onDone: _reset,
      );

  Widget _endedSheet({
    required IconData icon,
    required Color colour,
    required String title,
    String? detail,
  }) =>
      Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(icon, color: colour),
              const SizedBox(width: 10),
              Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800)),
              ),
            ],
          ),
          if (detail != null) ...[
            const SizedBox(height: 6),
            Text(detail,
                style: const TextStyle(color: GwColors.inkSoft, fontSize: 13)),
          ],
          const SizedBox(height: 14),
          FilledButton(
            onPressed: _reset,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: GwColors.primary,
            ),
            child: const Text("Book another ride"),
          ),
        ],
      );
}

// ---- Small pieces ---------------------------------------------------------

class _TopFade extends StatelessWidget {
  const _TopFade();

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: Container(
          height: MediaQuery.of(context).padding.top + 70,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0x33000000), Colors.transparent],
            ),
          ),
        ),
      );
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) => Material(
        color: filled ? GwColors.primary : GwColors.surfaceOf(context),
        shape: const CircleBorder(),
        elevation: 3,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Icon(icon,
                size: 22,
                color: filled ? Colors.white : GwColors.inkOf(context)),
          ),
        ),
      );
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.icon});
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2.5),
          boxShadow: const [
            BoxShadow(color: Color(0x40000000), blurRadius: 6),
          ],
        ),
        child: Icon(icon, size: 18, color: Colors.white),
      );
}

class _PointRow extends StatelessWidget {
  const _PointRow({
    required this.colour,
    required this.label,
    this.muted = false,
    this.dense = false,
  });

  final Color colour;
  final String label;
  final bool muted;
  final bool dense;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: colour, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: dense ? 13.5 : 15,
                color: muted
                    ? GwColors.inkSoftOf(context)
                    : GwColors.inkOf(context),
                fontWeight: muted ? FontWeight.w400 : FontWeight.w600,
              ),
            ),
          ),
        ],
      );
}

/// One destination suggestion.
///
/// History is badged with a clock rather than a pin, because "I have been here
/// before" is the fastest signal for picking the right row out of a list where
/// three entries can share a name.
class _PlaceTile extends StatelessWidget {
  const _PlaceTile({required this.place, required this.onTap});

  final Map<String, dynamic> place;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final history = place["source"] == "history";
    final detail = place["detail"]?.toString() ?? "";
    final distance = (place["distanceM"] as num?)?.toInt();
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 4),
        child: Row(
          children: [
            Icon(
              history ? Icons.history : Icons.place_outlined,
              size: 20,
              color: history ? GwColors.inkSoftOf(context) : GwColors.live,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(place["label"]?.toString() ?? "",
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14.5)),
                  if (detail.isNotEmpty)
                    Text(detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: GwColors.inkSoftOf(context), fontSize: 12)),
                ],
              ),
            ),
            if (distance != null)
              Text(formatDistance(distance),
                  style: TextStyle(
                      color: GwColors.inkSoftOf(context), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: GwColors.live.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            const Icon(Icons.info_outline, size: 18, color: GwColors.live),
            const SizedBox(width: 8),
            Expanded(
              child: Text(text,
                  style: TextStyle(
                      fontSize: 13, color: GwColors.inkOf(context))),
            ),
          ],
        ),
      );
}

class _VehicleTile extends StatelessWidget {
  const _VehicleTile({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final RideOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = vehicleStyle(option.vehicleType);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? GwColors.primary.withValues(alpha: 0.07)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? GwColors.primary : GwColors.lineOf(context),
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: style.color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(style.icon, color: style.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(option.labelMy.isEmpty ? option.labelEn : option.labelMy,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                      "${option.capacity} seat${option.capacity > 1 ? "s" : ""}",
                      style: TextStyle(
                          color: GwColors.inkSoftOf(context), fontSize: 12)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(formatKyat(option.fare),
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 15)),
                // Surge is labelled, never hidden inside the number. A rider who
                // finds out afterwards that a multiplier applied stops trusting
                // every price the app shows.
                if (option.surging)
                  Text("${option.surge}× busy",
                      style: const TextStyle(
                          color: GwColors.live,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PayChip extends StatelessWidget {
  const _PayChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected
                ? GwColors.primary.withValues(alpha: 0.07)
                : GwColors.surfaceMutedOf(context),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? GwColors.primary : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 18,
                  color: selected
                      ? GwColors.primary
                      : GwColors.inkSoftOf(context)),
              const SizedBox(width: 8),
              Text(label,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? GwColors.primary
                        : GwColors.inkSoftOf(context),
                  )),
            ],
          ),
        ),
      );
}

/// The end of a trip: the fare, then the stars.
///
/// Its own widget with its own state so tapping a star repaints five icons
/// rather than the map underneath it.
class _RatingSheet extends StatefulWidget {
  const _RatingSheet({
    super.key,
    required this.ride,
    required this.alreadyRated,
    required this.onSubmit,
    required this.onDone,
  });

  final Ride ride;
  final bool alreadyRated;
  final Future<void> Function(int stars, String? comment) onSubmit;
  final VoidCallback onDone;

  @override
  State<_RatingSheet> createState() => _RatingSheetState();
}

class _RatingSheetState extends State<_RatingSheet> {
  int _stars = 0;
  bool _sending = false;
  bool _sent = false;

  @override
  Widget build(BuildContext context) {
    final ride = widget.ride;
    final done = _sent || widget.alreadyRated;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const Icon(Icons.check_circle, color: GwColors.primaryBright),
            const SizedBox(width: 10),
            const Expanded(
              child: Text("Trip completed",
                  style:
                      TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
            ),
            Text(formatKyat(ride.payable),
                style: const TextStyle(
                    fontSize: 19, fontWeight: FontWeight.w800)),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          "${formatDistance(ride.distanceM)} · ${formatMinutes(ride.durationS)} · "
          "${ride.paymentMethod == "gpay" ? "Paid with G-Pay" : "Pay the driver in cash"}",
          style: const TextStyle(color: GwColors.inkSoft, fontSize: 13),
        ),
        // A wallet charge that did not go through is the rider's problem to
        // know about before they walk away, not a silent support ticket.
        if (ride.paymentStatus == "failed") ...[
          const SizedBox(height: 10),
          const _Banner(
              text: "The wallet payment didn't go through. "
                  "Please pay the driver in cash."),
        ],
        const SizedBox(height: 16),
        if (!done) ...[
          const Text("How was the ride?",
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              5,
              (i) => IconButton(
                onPressed: _sending ? null : () => setState(() => _stars = i + 1),
                icon: Icon(
                  i < _stars ? Icons.star_rounded : Icons.star_outline_rounded,
                  size: 36,
                  color: i < _stars ? GwColors.gold : GwColors.inkSoft,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _stars == 0 || _sending
                ? null
                : () async {
                    setState(() => _sending = true);
                    try {
                      await widget.onSubmit(_stars, null);
                      if (mounted) setState(() => _sent = true);
                    } catch (_) {
                      if (mounted) setState(() => _sending = false);
                    }
                  },
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: GwColors.primary,
            ),
            child: _sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text("Submit rating"),
          ),
          const SizedBox(height: 6),
        ],
        TextButton(
          onPressed: widget.onDone,
          child: Text(done ? "Done" : "Skip"),
        ),
      ],
    );
  }
}
