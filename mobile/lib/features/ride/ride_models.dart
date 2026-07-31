import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme.dart';

/// Ride-hailing shapes, mirroring db/sql/ride-hailing.sql and /api/ride/*.

/// The trip state machine. The server enforces the transitions; the app only
/// renders whichever state it is told about, so a status it does not recognise
/// must not crash the screen — [rideStatusOf] falls back rather than throwing.
enum RideStatus {
  requested,
  accepted,
  arrived,
  inProgress,
  completed,
  cancelled,
  expired,
}

RideStatus rideStatusOf(String? raw) {
  switch (raw) {
    case "requested":
      return RideStatus.requested;
    case "accepted":
      return RideStatus.accepted;
    case "arrived":
      return RideStatus.arrived;
    case "in_progress":
      return RideStatus.inProgress;
    case "completed":
      return RideStatus.completed;
    case "cancelled":
      return RideStatus.cancelled;
    default:
      return RideStatus.expired;
  }
}

/// True while the trip is still happening and the screen should keep polling.
bool rideIsLive(RideStatus s) =>
    s == RideStatus.requested ||
    s == RideStatus.accepted ||
    s == RideStatus.arrived ||
    s == RideStatus.inProgress;

class Ride {
  Ride({
    required this.id,
    required this.status,
    required this.vehicleType,
    required this.pickup,
    required this.pickupAddress,
    required this.dropoff,
    required this.dropoffAddress,
    required this.quotedFare,
    required this.paymentMethod,
    this.finalFare,
    this.driverId,
    this.cancelledBy,
    this.cancelFee = 0,
    this.riderRating,
    this.surge = 1,
    this.distanceM = 0,
    this.durationS = 0,
    this.paymentStatus = "pending",
  });

  final String id;
  final RideStatus status;
  final String vehicleType;
  final LatLng pickup;
  final String pickupAddress;
  final LatLng dropoff;
  final String dropoffAddress;
  final num quotedFare;
  final num? finalFare;
  final String paymentMethod;
  final String paymentStatus;
  final String? driverId;
  final String? cancelledBy;
  final num cancelFee;
  final int? riderRating;
  final num surge;
  final int distanceM;
  final int durationS;

  /// What the rider actually pays: the settled fare once there is one, the
  /// quote until then. Showing the quote after completion would contradict the
  /// receipt.
  num get payable => finalFare ?? quotedFare;

  static Ride fromJson(Map<String, dynamic> j) => Ride(
        id: j["id"].toString(),
        status: rideStatusOf(j["status"]?.toString()),
        vehicleType: j["vehicle_type"]?.toString() ?? "bike",
        pickup: LatLng(
          (j["pickup_lat"] as num?)?.toDouble() ?? 0,
          (j["pickup_lng"] as num?)?.toDouble() ?? 0,
        ),
        pickupAddress: j["pickup_address"]?.toString() ?? "",
        dropoff: LatLng(
          (j["dropoff_lat"] as num?)?.toDouble() ?? 0,
          (j["dropoff_lng"] as num?)?.toDouble() ?? 0,
        ),
        dropoffAddress: j["dropoff_address"]?.toString() ?? "",
        quotedFare: (j["quoted_fare"] as num?) ?? 0,
        finalFare: j["final_fare"] as num?,
        paymentMethod: j["payment_method"]?.toString() ?? "cash",
        paymentStatus: j["payment_status"]?.toString() ?? "pending",
        driverId: j["driver_id"]?.toString(),
        cancelledBy: j["cancelled_by"]?.toString(),
        cancelFee: (j["cancel_fee"] as num?) ?? 0,
        riderRating: (j["rider_rating"] as num?)?.toInt(),
        surge: (j["surge_multiplier"] as num?) ?? 1,
        distanceM: ((j["actual_distance_m"] ?? j["quoted_distance_m"]) as num?)
                ?.toInt() ??
            0,
        durationS: ((j["actual_duration_s"] ?? j["quoted_duration_s"]) as num?)
                ?.toInt() ??
            0,
      );
}

/// The other person in the trip. The phone number is only present once a driver
/// has accepted — the server withholds it before that.
class RideCounterpart {
  RideCounterpart({
    required this.id,
    this.name,
    this.avatar,
    this.phone,
    this.plate,
    this.vehicle,
    this.rating,
    this.trips,
  });

  final String id;
  final String? name;
  final String? avatar;
  final String? phone;
  final String? plate;
  final String? vehicle;
  final double? rating;
  final int? trips;

  static RideCounterpart fromJson(Map<String, dynamic> j) => RideCounterpart(
        id: j["id"].toString(),
        name: j["name"]?.toString(),
        avatar: j["avatar"]?.toString(),
        phone: j["phone"]?.toString(),
        plate: j["plate"]?.toString(),
        vehicle: j["vehicle"]?.toString(),
        rating: (j["rating"] as num?)?.toDouble(),
        trips: (j["trips"] as num?)?.toInt(),
      );
}

/// One row of the vehicle picker.
class RideOption {
  RideOption({
    required this.vehicleType,
    required this.labelEn,
    required this.labelMy,
    required this.capacity,
    required this.fare,
    required this.fareBeforeSurge,
    required this.surge,
  });

  final String vehicleType;
  final String labelEn;
  final String labelMy;
  final int capacity;
  final num fare;
  final num fareBeforeSurge;
  final num surge;

  bool get surging => surge > 1;

  static RideOption fromJson(Map<String, dynamic> j) => RideOption(
        vehicleType: j["vehicleType"]?.toString() ?? "bike",
        labelEn: j["labelEn"]?.toString() ?? "",
        labelMy: j["labelMy"]?.toString() ?? "",
        capacity: (j["capacity"] as num?)?.toInt() ?? 1,
        fare: (j["fare"] as num?) ?? 0,
        fareBeforeSurge: (j["fareBeforeSurge"] as num?) ?? 0,
        surge: (j["surge"] as num?) ?? 1,
      );
}

/// A priced route: what one /api/ride/quote call returns.
class RideQuote {
  RideQuote({
    required this.distanceM,
    required this.durationS,
    required this.options,
    this.polyline,
  });

  final int distanceM;
  final int durationS;
  final String? polyline;
  final List<RideOption> options;

  static RideQuote fromJson(Map<String, dynamic> j) => RideQuote(
        distanceM: (j["distanceM"] as num?)?.toInt() ?? 0,
        durationS: (j["durationS"] as num?)?.toInt() ?? 0,
        polyline: j["polyline"]?.toString(),
        options: ((j["options"] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => RideOption.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

// ---- Presentation ---------------------------------------------------------

/// Icon and colour per vehicle type. Kept beside the model so the picker, the
/// map pin and the trip card cannot drift apart.
({IconData icon, Color color}) vehicleStyle(String code) {
  switch (code) {
    case "car":
      return (icon: Icons.local_taxi, color: GwColors.gold);
    case "three_wheeler":
      return (icon: Icons.electric_rickshaw, color: const Color(0xFF7A5AF8));
    case "delivery":
      return (icon: Icons.inventory_2, color: const Color(0xFF12A5A5));
    case "bike":
    default:
      return (icon: Icons.two_wheeler, color: GwColors.primaryBright);
  }
}

/// Kyat, grouped — 12500 reads as "12,500 Ks". Fares are whole Kyat by the time
/// they reach the app (see lib/ride/fare.ts), so no decimals are shown.
String formatKyat(num amount) {
  final whole = amount.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buf.write(",");
    buf.write(whole[i]);
  }
  return "${buf.toString()} Ks";
}

String formatDistance(int metres) => metres < 1000
    ? "$metres m"
    : "${(metres / 1000).toStringAsFixed(1)} km";

String formatMinutes(int seconds) {
  final m = (seconds / 60).round();
  if (m < 60) return "$m min";
  return "${m ~/ 60} hr ${m % 60} min";
}

/// Decode an encoded polyline (precision 5) into points for the map.
///
/// Both OSRM and Google return this format. Written out rather than pulled in
/// as a dependency — it is twenty lines, and the app already carries enough
/// packages.
List<LatLng> decodePolyline(String encoded) {
  final points = <LatLng>[];
  var index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (var i = 0; i < 2; i++) {
      var shift = 0, result = 0, b;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length);
      final delta = (result & 1) != 0 ? ~(result >> 1) : (result >> 1);
      if (i == 0) {
        lat += delta;
      } else {
        lng += delta;
      }
    }
    points.add(LatLng(lat / 1e5, lng / 1e5));
  }
  return points;
}
