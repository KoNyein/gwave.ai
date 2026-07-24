import '../../core/api_client.dart';
import 'audio_models.dart';

/// Thin data layer for the native Audio store. Flat PostgREST queries only —
/// no resource embeds (a stale schema cache would 500 them) — assembled in
/// code, exactly like the web `src/lib/db/audio.ts`. Purchases settle through
/// the same atomic `buy_audio` / `buy_audio_subscription` G-Pay RPCs the web
/// store uses.
class AudioApi {
  AudioApi(this.api);
  final ApiClient api;

  static const String _trackCols =
      "id,kind,title,description,cover_url,audio_url,duration_s,protection,"
      "price,currency,is_premium,publisher_id,bpm,music_key,time_sig,mood,release_year";

  /// One format's catalogue, newest first, with the format facet merged in
  /// (artist for music, author for audiobooks, episode no. for podcasts).
  Future<List<AudioTrack>> browse(AudioKind kind, {int limit = 40}) async {
    final rows = await api.select("audio_tracks", query: {
      "select": _trackCols,
      "kind": "eq.${audioKindValue(kind)}",
      "order": "published_at.desc.nullslast",
      "limit": "$limit",
    });
    final tracks = rows.map(AudioTrack.fromJson).toList();
    if (tracks.isEmpty) return tracks;
    await _mergeFacets(kind, tracks);
    return tracks;
  }

  /// Fetch the format-specific facet for a batch of tracks in one query and
  /// stitch it onto each track (matches on track_id).
  Future<void> _mergeFacets(AudioKind kind, List<AudioTrack> tracks) async {
    final ids = tracks.map((t) => t.id).toList();
    final inList = "in.(${ids.join(',')})";
    try {
      if (kind == AudioKind.music) {
        final facets = await api.select("audio_music", query: {
          "select": "track_id,artist,album,genre",
          "track_id": inList,
        });
        final byId = {for (final f in facets) f["track_id"] as String: f};
        for (final t in tracks) {
          final f = byId[t.id];
          if (f != null) {
            t.artist = f["artist"] as String?;
            t.album = f["album"] as String?;
            t.genre = f["genre"] as String?;
          }
        }
      } else if (kind == AudioKind.audiobook) {
        final facets = await api.select("audio_audiobook", query: {
          "select": "track_id,author,narrator",
          "track_id": inList,
        });
        final byId = {for (final f in facets) f["track_id"] as String: f};
        for (final t in tracks) {
          final f = byId[t.id];
          if (f != null) {
            t.author = f["author"] as String?;
            t.narrator = f["narrator"] as String?;
          }
        }
      } else if (kind == AudioKind.podcast) {
        final facets = await api.select("audio_podcast", query: {
          "select": "track_id,episode_no,season_no",
          "track_id": inList,
        });
        final byId = {for (final f in facets) f["track_id"] as String: f};
        for (final t in tracks) {
          final f = byId[t.id];
          if (f != null) {
            t.episodeNo = (f["episode_no"] as num?)?.toInt();
            t.seasonNo = (f["season_no"] as num?)?.toInt();
          }
        }
      }
    } catch (_) {
      // A missing facet table shouldn't blank the whole catalogue.
    }
  }

  /// Chapters/markers for an audiobook (or long podcast), in order.
  Future<List<AudioChapter>> chapters(String trackId) async {
    try {
      final rows = await api.select("audio_chapters", query: {
        "select": "idx,title,start_s",
        "track_id": "eq.$trackId",
        "order": "idx.asc",
      });
      return rows.map(AudioChapter.fromJson).toList();
    } catch (_) {
      return const [];
    }
  }

  /// Lyrics document for a track, if any (usually music).
  Future<AudioLyrics?> lyrics(String trackId) async {
    try {
      final rows = await api.select("audio_lyrics", query: {
        "select": "lyrics,synced",
        "track_id": "eq.$trackId",
        "limit": "1",
      });
      if (rows.isEmpty) return null;
      final text = rows.first["lyrics"] as String?;
      if (text == null || text.isEmpty) return null;
      return AudioLyrics(text: text, synced: rows.first["synced"] == true);
    } catch (_) {
      return null;
    }
  }

  /// True if the viewer may play this track (free, owned, or subscribed).
  Future<bool> isEntitled(String trackId) async {
    try {
      final res = await api.rpc("audio_is_entitled", {"p_track": trackId});
      return res == true;
    } catch (_) {
      return false;
    }
  }

  /// The viewer's saved resume point for a track, if any.
  Future<AudioResume?> resume(String trackId) async {
    final uid = api.session?.profileId;
    if (uid == null) return null;
    try {
      final rows = await api.select("audio_progress", query: {
        "select": "position_s,duration_s,speed,completed",
        "user_id": "eq.$uid",
        "track_id": "eq.$trackId",
        "limit": "1",
      });
      return AudioResume.fromRows(rows);
    } catch (_) {
      return null;
    }
  }

  /// Persist the current position so playback resumes on any device.
  Future<void> saveProgress(
    String trackId, {
    required int positionS,
    int? durationS,
    int? chapterIdx,
    double speed = 1.0,
    bool completed = false,
  }) async {
    final uid = api.session?.profileId;
    if (uid == null) return;
    try {
      await api.upsert(
        "audio_progress",
        {
          "user_id": uid,
          "track_id": trackId,
          "position_s": positionS,
          if (durationS != null) "duration_s": durationS,
          if (chapterIdx != null) "chapter_idx": chapterIdx,
          "speed": speed,
          "completed": completed,
          "device": "android",
          "updated_at": DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: "user_id,track_id",
      );
    } catch (_) {
      // Progress save is best-effort; playback continues regardless.
    }
  }

  /// Buy a single track from the G-Pay wallet (atomic server RPC). Throws
  /// [ApiException] with the server's message on failure (insufficient
  /// balance, suspended, etc.).
  Future<void> buyTrack(String trackId) async {
    await api.rpc("buy_audio", {"p_track": trackId});
  }

  /// Subscribe to all-access (monthly / annual) from the wallet.
  Future<void> subscribe(String plan) async {
    await api.rpc("buy_audio_subscription", {"p_plan": plan});
  }

  /// Available subscription plans (label, price, currency, days).
  Future<List<Map<String, dynamic>>> plans() async {
    try {
      return await api.select("audio_plans", query: {
        "select": "plan,price,currency,days,label",
        "order": "price.asc",
      });
    } catch (_) {
      return const [];
    }
  }

  /// The viewer's own star rating for a track, if any.
  Future<int?> myRating(String trackId) async {
    final uid = api.session?.profileId;
    if (uid == null) return null;
    try {
      final rows = await api.select("audio_ratings", query: {
        "select": "stars",
        "user_id": "eq.$uid",
        "track_id": "eq.$trackId",
        "limit": "1",
      });
      if (rows.isEmpty) return null;
      return (rows.first["stars"] as num?)?.toInt();
    } catch (_) {
      return null;
    }
  }

  /// Set/replace the viewer's star rating (1–5) for a track.
  Future<void> rate(String trackId, int stars) async {
    final uid = api.session?.profileId;
    if (uid == null) return;
    await api.upsert(
      "audio_ratings",
      {"user_id": uid, "track_id": trackId, "stars": stars},
      onConflict: "user_id,track_id",
    );
  }
}
