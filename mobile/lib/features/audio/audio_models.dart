import 'package:flutter/material.dart';

import '../../core/i18n.dart';

/// The three catalogue formats. Column values on `audio_tracks.kind`.
enum AudioKind { music, podcast, audiobook }

AudioKind audioKindFromString(String? s) {
  switch (s) {
    case "podcast":
      return AudioKind.podcast;
    case "audiobook":
      return AudioKind.audiobook;
    default:
      return AudioKind.music;
  }
}

String audioKindValue(AudioKind k) {
  switch (k) {
    case AudioKind.podcast:
      return "podcast";
    case AudioKind.audiobook:
      return "audiobook";
    case AudioKind.music:
      return "music";
  }
}

String audioKindLabel(BuildContext context, AudioKind k) {
  switch (k) {
    case AudioKind.music:
      return tr(context, "Music", "တေးဂီတ");
    case AudioKind.podcast:
      return tr(context, "Podcasts", "ပို့တ်ကာစ်");
    case AudioKind.audiobook:
      return tr(context, "Audiobooks", "အသံစာအုပ်");
  }
}

IconData audioKindIcon(AudioKind k) {
  switch (k) {
    case AudioKind.music:
      return Icons.music_note_rounded;
    case AudioKind.podcast:
      return Icons.podcasts_rounded;
    case AudioKind.audiobook:
      return Icons.menu_book_rounded;
  }
}

/// One catalogue row (flat — facets fetched separately, assembled in code).
/// Mirrors `src/lib/db/audio.ts` `AudioTrack`.
class AudioTrack {
  AudioTrack({
    required this.id,
    required this.kind,
    required this.title,
    this.description,
    this.coverUrl,
    this.audioUrl,
    this.durationS,
    this.protection = "free",
    this.price,
    this.currency,
    this.isPremium = false,
    this.publisherId,
    this.bpm,
    this.musicKey,
    this.timeSig,
    this.mood,
    this.releaseYear,
    // Assembled facet fields (nullable — depend on kind).
    this.artist,
    this.album,
    this.genre,
    this.author,
    this.narrator,
    this.episodeNo,
    this.seasonNo,
  });

  final String id;
  final AudioKind kind;
  final String title;
  final String? description;
  final String? coverUrl;
  final String? audioUrl;
  final int? durationS;
  final String protection;
  final num? price;
  final String? currency;
  final bool isPremium;
  final String? publisherId;
  final int? bpm;
  final String? musicKey;
  final String? timeSig;
  final String? mood;
  final int? releaseYear;

  String? artist;
  String? album;
  String? genre;
  String? author;
  String? narrator;
  int? episodeNo;
  int? seasonNo;

  /// Everyone can play a free / non-premium track without owning it.
  bool get isFree => protection == "free" || !isPremium;

  /// A-la-carte purchasable (has a positive price).
  bool get isPurchasable => (price ?? 0) > 0;

  static AudioTrack fromJson(Map<String, dynamic> j) {
    num? asNum(dynamic v) => v is num ? v : (v == null ? null : num.tryParse("$v"));
    int? asInt(dynamic v) => v is int ? v : (v is num ? v.toInt() : (v == null ? null : int.tryParse("$v")));
    return AudioTrack(
      id: j["id"] as String,
      kind: audioKindFromString(j["kind"] as String?),
      title: (j["title"] as String?) ?? "Untitled",
      description: j["description"] as String?,
      coverUrl: j["cover_url"] as String?,
      audioUrl: j["audio_url"] as String?,
      durationS: asInt(j["duration_s"]),
      protection: (j["protection"] as String?) ?? "free",
      price: asNum(j["price"]),
      currency: j["currency"] as String?,
      isPremium: j["is_premium"] == true,
      publisherId: j["publisher_id"] as String?,
      bpm: asInt(j["bpm"]),
      musicKey: j["music_key"] as String?,
      timeSig: j["time_sig"] as String?,
      mood: j["mood"] as String?,
      releaseYear: asInt(j["release_year"]),
    );
  }
}

/// A saved cross-device playback position. Mirrors `audio_progress`.
class AudioResume {
  AudioResume({
    required this.positionS,
    this.durationS,
    this.speed,
    this.completed = false,
  });
  final int positionS;
  final int? durationS;
  final double? speed;
  final bool completed;

  static AudioResume? fromRows(List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return null;
    final r = rows.first;
    int? asInt(dynamic v) => v is int ? v : (v is num ? v.toInt() : null);
    return AudioResume(
      positionS: asInt(r["position_s"]) ?? 0,
      durationS: asInt(r["duration_s"]),
      speed: (r["speed"] is num) ? (r["speed"] as num).toDouble() : null,
      completed: r["completed"] == true,
    );
  }
}

/// A chapter/marker on an audiobook (or long podcast). Mirrors `audio_chapters`.
class AudioChapter {
  AudioChapter({required this.idx, required this.title, required this.startS});
  final int idx;
  final String title;
  final int startS;

  static AudioChapter fromJson(Map<String, dynamic> j) => AudioChapter(
        idx: (j["idx"] as num?)?.toInt() ?? 0,
        title: (j["title"] as String?) ?? "",
        startS: (j["start_s"] as num?)?.toInt() ?? 0,
      );
}

/// Lyrics document — plain text or LRC ([mm:ss.xx] lines) for karaoke.
class AudioLyrics {
  AudioLyrics({required this.text, required this.synced});
  final String text;
  final bool synced;
}

/// Format seconds as m:ss / h:mm:ss for player labels.
String fmtClock(int seconds) {
  if (seconds < 0) seconds = 0;
  final h = seconds ~/ 3600;
  final m = (seconds % 3600) ~/ 60;
  final s = seconds % 60;
  final ss = s.toString().padLeft(2, '0');
  if (h > 0) return "$h:${m.toString().padLeft(2, '0')}:$ss";
  return "$m:$ss";
}
