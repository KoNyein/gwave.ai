import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The signed-in session, persisted in the platform keystore. Holds the app data
/// token (the `gw_at` bearer sent to PostgREST) plus the Cognito refresh token +
/// username needed to re-mint it silently.
class Session {
  Session({
    required this.token,
    required this.profileId,
    required this.email,
    required this.cognitoUsername,
    required this.refreshToken,
    required this.expiresAt,
  });

  final String token;
  final String profileId;
  final String? email;
  final String? cognitoUsername;
  final String? refreshToken;
  final DateTime expiresAt;

  bool get isExpired => DateTime.now().isAfter(expiresAt);

  /// True within ~5 minutes of expiry — refresh proactively so requests don't
  /// race the deadline.
  bool get needsRefresh =>
      DateTime.now().isAfter(expiresAt.subtract(const Duration(minutes: 5)));

  Map<String, dynamic> toJson() => {
        "token": token,
        "profileId": profileId,
        "email": email,
        "cognitoUsername": cognitoUsername,
        "refreshToken": refreshToken,
        "expiresAt": expiresAt.toIso8601String(),
      };

  factory Session.fromJson(Map<String, dynamic> j) => Session(
        token: j["token"] as String,
        profileId: j["profileId"] as String,
        email: j["email"] as String?,
        cognitoUsername: j["cognitoUsername"] as String?,
        refreshToken: j["refreshToken"] as String?,
        expiresAt: DateTime.parse(j["expiresAt"] as String),
      );

  Session copyWith({String? token, DateTime? expiresAt, String? profileId}) =>
      Session(
        token: token ?? this.token,
        profileId: profileId ?? this.profileId,
        email: email,
        cognitoUsername: cognitoUsername,
        refreshToken: refreshToken,
        expiresAt: expiresAt ?? this.expiresAt,
      );
}

class SessionStore {
  static const _key = "gw_session";
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<Session?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      return Session.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<void> write(Session s) =>
      _storage.write(key: _key, value: jsonEncode(s.toJson()));

  Future<void> clear() => _storage.delete(key: _key);
}
