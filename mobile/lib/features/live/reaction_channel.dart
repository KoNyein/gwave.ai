import 'dart:async';

import 'package:realtime_client/realtime_client.dart';

import '../../core/api_client.dart';
import '../../core/config.dart';

/// The one place a broadcast's reactions travel through.
///
/// Reactions used to live in two unconnected worlds. The web tapped an emoji
/// and broadcast it over Realtime; the app tapped an emoji and wrote a row to
/// `live_reactions`, then counted rows every three seconds. Each side could see
/// its own reactions and had no idea the other side existed — a viewer on the
/// phone could spam hearts at a host broadcasting from a browser and the host
/// would watch a completely still screen.
///
/// So the app joins the same channel the web has always used,
/// `live-reactions:{streamId}`, and speaks the same message. Nothing about the
/// web changes; the phone simply arrives in the room it should have been in.
///
/// The database row is still written by the caller — that is what counts are
/// built from. This carries the *moment*, which a row read three seconds later
/// never could.
class LiveReactions {
  LiveReactions(this._api);

  final ApiClient _api;
  RealtimeClient? _rt;
  RealtimeChannel? _channel;

  /// Whether the channel is up. When it is not — no network, Realtime down —
  /// the sender falls back to a local float so a tap never feels ignored.
  bool get connected => _channel != null;

  /// Called for every reaction on this stream, including our own — the sender
  /// spawns its float from here rather than locally, so one tap is one heart no
  /// matter which path it took.
  void Function(String emoji)? onEmoji;

  Future<void> join(String streamId) async {
    try {
      if (!AppConfig.runtimeLoaded) await _api.loadRuntimeConfig();
      await _api.freshToken();
      final token = _api.session?.token;
      if (token == null) return;

      final rt = RealtimeClient(
        AppConfig.realtimeUrl,
        params: {"apikey": AppConfig.supabaseAnonKey},
      );
      rt.setAuth(token);
      _rt = rt;

      final ch = rt.channel("live-reactions:$streamId");
      ch.onBroadcast(
        event: "reaction",
        callback: (payload) {
          final emoji = _emojiOf(payload);
          if (emoji != null) onEmoji?.call(emoji);
        },
      );
      ch.subscribe();
      _channel = ch;
    } catch (_) {
      // Reactions are decoration. A broadcast that cannot reach Realtime still
      // plays, still has chat, and still records the reaction row.
    }
  }

  void send(String emoji) {
    _channel?.sendBroadcastMessage(
      event: "reaction",
      payload: {"emoji": emoji},
    );
  }

  Future<void> dispose() async {
    try {
      await _channel?.unsubscribe();
    } catch (_) {}
    _channel = null;
    _rt?.disconnect();
    _rt = null;
  }

  /// Unwrap the emoji from either delivery shape.
  ///
  /// A message sent socket-to-socket arrives as the payload itself; one that
  /// went through Realtime's HTTP relay arrives wrapped in
  /// `{event, type, payload}`. The call signalling code learned this the hard
  /// way (see `_sigBody` in call_service.dart) — same lesson, same fix.
  static String? _emojiOf(Map<String, dynamic> payload) {
    final direct = payload["emoji"];
    if (direct is String && direct.isNotEmpty) return direct;
    final inner = payload["payload"];
    if (inner is Map) {
      final nested = inner["emoji"];
      if (nested is String && nested.isNotEmpty) return nested;
    }
    return null;
  }
}
