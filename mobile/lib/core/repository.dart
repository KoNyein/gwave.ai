
import 'dart:math';

import 'api_client.dart';
import 'config.dart';
import 'models.dart';

/// Typed reads/writes over [ApiClient]. Uses PostgREST resource embedding
/// (`select=...,author:profiles(...)`) so one round-trip returns a post with its
/// author, a stream with its host, and so on.
class Repository {
  Repository(this.api);
  final ApiClient api;

  static const _profileCols = "id,username,full_name,avatar_url,cover_url,bio,role,is_teacher";

  // ---- Feed -----------------------------------------------------------------

  Future<List<Post>> feed({int limit = 20, int offset = 0}) async {
    final rows = await api.select("posts", query: {
      "select":
          "*,author:profiles!posts_author_id_fkey($_profileCols),media:post_media(storage_path,media_type,position)",
      "visibility": "eq.public",
      "removed_at": "is.null",
      "order": "created_at.desc",
      "limit": "$limit",
      "offset": "$offset",
    });
    return rows.map(Post.fromJson).toList();
  }

  /// Create a post and attach any already-uploaded media (storage paths from
  /// [ApiClient.uploadBytes]) as ordered post_media rows.
  Future<Post?> createPost(
    String content, {
    String? locationName,
    double? latitude,
    double? longitude,
    List<PostMedia> media = const [],
  }) async {
    final row = await api.insert("posts", {
      "author_id": api.session!.profileId,
      "content": content,
      "visibility": "public",
      if (locationName != null && locationName.isNotEmpty)
        "location_name": locationName,
      // Coordinates travel as a pair (posts_location_pair constraint).
      if (latitude != null && longitude != null) ...{
        "latitude": latitude,
        "longitude": longitude,
      },
    });
    if (row == null) return null;
    final postId = row["id"].toString();
    if (media.isNotEmpty) {
      for (var i = 0; i < media.length; i++) {
        await api.insert("post_media", {
          "post_id": postId,
          "media_type": media[i].mediaType,
          "storage_path": media[i].storagePath,
          "position": i,
        });
      }
    }
    return Post.fromJson({...row, "media": media.map((m) => {
          "storage_path": m.storagePath,
          "media_type": m.mediaType,
        }).toList()});
  }

  /// Whether the current user has reacted to a post (any reaction type).
  Future<bool> hasReacted(String postId) async {
    final rows = await api.select("reactions", query: {
      "select": "id",
      "post_id": "eq.$postId",
      "user_id": "eq.${api.session!.profileId}",
      "limit": "1",
    });
    return rows.isNotEmpty;
  }

  Future<void> addReaction(String postId, {String type = "like"}) async {
    await api.insert("reactions", {
      "post_id": postId,
      "user_id": api.session!.profileId,
      "type": type,
    });
  }

  Future<void> removeReaction(String postId) async {
    await api.deleteRows("reactions", filter: {
      "post_id": "eq.$postId",
      "user_id": "eq.${api.session!.profileId}",
    });
  }

  /// The viewer's reaction type on a post ("like", "love", …) or null.
  Future<String?> myPostReaction(String postId) async {
    final rows = await api.select("reactions", query: {
      "select": "type",
      "post_id": "eq.$postId",
      "user_id": "eq.${api.session!.profileId}",
      "limit": "1",
    });
    return rows.isEmpty ? null : rows.first["type"]?.toString();
  }

  /// Set or change the viewer's reaction on a post. One reaction per user per
  /// post (unique index), so any existing row is removed first.
  Future<void> setPostReaction(String postId, String type) async {
    await removeReaction(postId);
    await addReaction(postId, type: type);
  }

  /// The viewer's reactions on a batch of comments: comment id → type.
  Future<Map<String, String>> myCommentReactions(
      List<String> commentIds) async {
    if (commentIds.isEmpty) return {};
    final rows = await api.select("reactions", query: {
      "select": "comment_id,type",
      "comment_id": "in.(${commentIds.join(",")})",
      "user_id": "eq.${api.session!.profileId}",
    });
    return {
      for (final r in rows)
        if (r["comment_id"] != null)
          r["comment_id"].toString(): (r["type"] ?? "like").toString(),
    };
  }

  Future<void> setCommentReaction(String commentId, String type) async {
    await removeCommentReaction(commentId);
    await api.insert("reactions", {
      "comment_id": commentId,
      "user_id": api.session!.profileId,
      "type": type,
    });
  }

  Future<void> removeCommentReaction(String commentId) async {
    await api.deleteRows("reactions", filter: {
      "comment_id": "eq.$commentId",
      "user_id": "eq.${api.session!.profileId}",
    });
  }

  // ---- Comments -------------------------------------------------------------

  Future<List<Comment>> comments(String postId) async {
    final rows = await api.select("comments", query: {
      "select": "*,author:profiles!comments_author_id_fkey($_profileCols)",
      "post_id": "eq.$postId",
      "removed_at": "is.null",
      "order": "created_at.asc",
      "limit": "100",
    });
    return rows.map(Comment.fromJson).toList();
  }

  /// Post a comment; [imagePath] (media-bucket object path) attaches a photo.
  /// A photo-only comment sends empty content.
  Future<Comment?> addComment(
    String postId,
    String content, {
    String? imagePath,
  }) async {
    final row = await api.insert("comments", {
      "post_id": postId,
      "author_id": api.session!.profileId,
      "content": content,
      if (imagePath != null) "image_path": imagePath,
    });
    return row == null ? null : Comment.fromJson(row);
  }

  // ---- Live -----------------------------------------------------------------
  // Flat queries only: a resource embed here 500s whenever PostgREST's schema
  // cache goes stale, and a dead live list looks like "nobody can see lives".

  /// Fetch profiles for a set of ids and return them keyed by id.
  Future<Map<String, Map<String, dynamic>>> _profilesByIds(
    Iterable<String> ids,
  ) async {
    final unique = ids.toSet()..removeWhere((e) => e.isEmpty);
    if (unique.isEmpty) return {};
    try {
      final rows = await api.select("profiles", query: {
        "select": _profileCols,
        "id": "in.(${unique.join(",")})",
        "limit": "${unique.length}",
      });
      return {for (final r in rows) r["id"].toString(): r};
    } catch (_) {
      return {}; // names just fall back to "Gwave user"
    }
  }

  Future<List<LiveStream>> liveStreams({bool onlyLive = false}) async {
    final rows = await api.select("live_streams", query: {
      "select": "*",
      if (onlyLive) "status": "eq.live",
      if (!onlyLive) "status": "in.(live,ended)",
      "order": "created_at.desc",
      "limit": "40",
    });
    final hosts =
        await _profilesByIds(rows.map((r) => "${r["host_id"] ?? ""}"));
    for (final r in rows) {
      final host = hosts["${r["host_id"]}"];
      if (host != null) r["host"] = host;
    }
    return rows.map(LiveStream.fromJson).toList();
  }

  Future<LiveStream?> stream(String id) async {
    final rows = await api.select("live_streams", query: {
      "select": "*",
      "id": "eq.$id",
      "limit": "1",
    });
    if (rows.isEmpty) return null;
    final row = rows.first;
    final hosts = await _profilesByIds(["${row["host_id"] ?? ""}"]);
    final host = hosts["${row["host_id"]}"];
    if (host != null) row["host"] = host;
    return LiveStream.fromJson(row);
  }

  /// Live chat for a stream, oldest→newest. Pass [sinceIso] to fetch only
  /// messages newer than the last one seen (cheap polling while watching).
  Future<List<LiveChatMessage>> liveChat(
    String streamId, {
    String? sinceIso,
    int limit = 60,
  }) async {
    final rows = await api.select("live_chat_messages", query: {
      "select": "*",
      "stream_id": "eq.$streamId",
      if (sinceIso != null) "created_at": "gt.$sinceIso",
      "order": "created_at.asc",
      "limit": "$limit",
    });
    final senders =
        await _profilesByIds(rows.map((r) => "${r["user_id"] ?? ""}"));
    for (final r in rows) {
      final sender = senders["${r["user_id"]}"];
      if (sender != null) r["sender"] = sender;
    }
    return rows.map(LiveChatMessage.fromJson).toList();
  }

  Future<LiveChatMessage?> sendLiveChat(String streamId, String content) async {
    final row = await api.insert("live_chat_messages", {
      "stream_id": streamId,
      "user_id": api.session!.profileId,
      "content": content,
    });
    return row == null ? null : LiveChatMessage.fromJson(row);
  }

  /// Send a live reaction (one of ❤️ 👍 😂 😮 👏 🔥).
  Future<void> sendLiveReaction(String streamId, String emoji) async {
    await api.insert("live_reactions", {
      "stream_id": streamId,
      "user_id": api.session!.profileId,
      "emoji": emoji,
    });
  }

  /// The number of reactions on a stream since [sinceIso] — drives the floating
  /// hearts other viewers send while you watch.
  Future<int> liveReactionCount(String streamId, {String? sinceIso}) async {
    final rows = await api.select("live_reactions", query: {
      "select": "id",
      "stream_id": "eq.$streamId",
      if (sinceIso != null) "created_at": "gt.$sinceIso",
      "order": "created_at.desc",
      "limit": "50",
    });
    return rows.length;
  }

  /// Re-read a stream's live viewer count + status (polled while watching).
  Future<LiveStream?> refreshStream(String id) => stream(id);

  // ---- Stories --------------------------------------------------------------

  Future<List<Story>> stories() async {
    final rows = await api.select("stories", query: {
      "select":
          "*,author:profiles!stories_author_id_fkey($_profileCols)",
      "expires_at": "gt.${DateTime.now().toUtc().toIso8601String()}",
      "order": "created_at.desc",
      "limit": "50",
    });
    return rows.map(Story.fromJson).toList();
  }

  // ---- Reels ----------------------------------------------------------------

  Future<List<Reel>> reels({int limit = 20}) async {
    final rows = await api.select("reels", query: {
      "select": "*,author:profiles!reels_owner_id_fkey($_profileCols)",
      "is_public": "eq.true",
      "order": "created_at.desc",
      "limit": "$limit",
    });
    return rows.map(Reel.fromJson).toList();
  }

  /// Report that this viewer is watching a live stream. The RPC records the
  /// caller's own presence (viewer_id = auth.uid()) and lifts the stream's
  /// viewer_count to the running peak, so the host dashboard's "Peak viewers"
  /// is non-zero. Best-effort — callers should swallow failures.
  Future<void> liveHeartbeat(String streamId) async {
    await api.rpc("live_heartbeat", {"p_stream": streamId});
  }

  /// Toggle a like on a reel; returns the new liked state (server RPC keeps the
  /// count + like row in sync).
  Future<bool> toggleReelLike(String reelId) async {
    final res = await api.rpc("toggle_reel_like", {"p_reel": reelId});
    return res == true;
  }

  /// Publish a reel from an already-uploaded video (storage path).
  Future<void> createReel(
    String videoPath, {
    String? caption,
    bool originalConfirmed = true,
    String? locationName,
    double? latitude,
    double? longitude,
  }) async {
    await api.insert("reels", {
      "owner_id": api.session!.profileId,
      "video_path": videoPath,
      "is_public": true,
      "original_confirmed": originalConfirmed,
      if (caption != null && caption.trim().isNotEmpty) "caption": caption.trim(),
      if (locationName != null && locationName.isNotEmpty)
        "location_name": locationName,
      if (latitude != null && longitude != null) ...{
        "latitude": latitude,
        "longitude": longitude,
      },
    });
  }

  /// Post a story from an already-uploaded photo/video (storage path).
  Future<void> createStory(
    String mediaPath,
    String mediaType, {
    String? textOverlay,
  }) async {
    await api.insert("stories", {
      "author_id": api.session!.profileId,
      "media_path": mediaPath,
      "media_type": mediaType,
      if (textOverlay != null && textOverlay.trim().isNotEmpty)
        "text_overlay": textOverlay.trim(),
    });
  }

  // ---- Notifications --------------------------------------------------------

  /// My notifications, newest first, each with the acting user's profile.
  /// Embed-free (see conversations()) so a stale PostgREST schema cache after
  /// a migration can't take the whole list down.
  Future<List<AppNotification>> notifications() async {
    final rows = await api.select("notifications", query: {
      "select": "*",
      "recipient_id": "eq.${api.session!.profileId}",
      "order": "created_at.desc",
      "limit": "50",
    });
    final actorIds = rows
        .map((r) => r["actor_id"])
        .whereType<Object>()
        .map((e) => e.toString())
        .toSet()
        .toList();
    if (actorIds.isNotEmpty) {
      try {
        final profs = await api.select("profiles", query: {
          "select": _profileCols,
          "id": "in.(${actorIds.join(",")})",
          "limit": "100",
        });
        final byId = {for (final p in profs) p["id"].toString(): p};
        for (final r in rows) {
          r["actor"] = byId[r["actor_id"]?.toString()];
        }
      } catch (_) {
        // Actor names are cosmetic — the list still renders.
      }
    }
    return rows.map(AppNotification.fromJson).toList();
  }

  /// Number of unread notifications (badge on the feed bell).
  Future<int> unreadNotificationCount() async {
    try {
      final rows = await api.select("notifications", query: {
        "select": "id",
        "recipient_id": "eq.${api.session!.profileId}",
        "read": "eq.false",
        "limit": "100",
      });
      return rows.length;
    } catch (_) {
      return 0;
    }
  }

  Future<void> markNotificationsRead() async {
    // Best-effort: mark all the caller's unread notifications read.
    await api.update("notifications", {
      "read": true,
    }, filter: {
      "recipient_id": "eq.${api.session!.profileId}",
      "read": "eq.false",
    });
  }

  // ---- Shop -----------------------------------------------------------------

  Future<List<ShopProduct>> products({String? category}) async {
    final rows = await api.select("shop_products", query: {
      "select": "*",
      "status": "eq.active",
      if (category != null && category.isNotEmpty) "category": "eq.$category",
      "order": "created_at.desc",
      "limit": "40",
    });
    return rows.map(ShopProduct.fromJson).toList();
  }

  // ---- Presence -------------------------------------------------------------

  /// Heartbeat: stamp my profiles.last_seen_at so others see me online.
  /// Best-effort — silently a no-op until the column exists in the database.
  Future<void> heartbeat() async {
    try {
      await api.update("profiles", {
        "last_seen_at": DateTime.now().toUtc().toIso8601String(),
      }, filter: {
        "id": "eq.${api.session!.profileId}",
      });
    } catch (_) {}
    // Report which build this phone runs — separate call so a missing
    // app_build column can never break presence.
    if (AppConfig.appBuild > 0) {
      try {
        await api.update("profiles", {
          "app_build": AppConfig.appBuild,
        }, filter: {
          "id": "eq.${api.session!.profileId}",
        });
      } catch (_) {}
    }
  }

  /// last_seen_at for a set of users (messenger online dots). Returns {} when
  /// the presence column isn't deployed yet, so callers just skip the dots.
  Future<Map<String, DateTime>> presenceFor(List<String> userIds) async {
    if (userIds.isEmpty) return {};
    try {
      final rows = await api.select("profiles", query: {
        "select": "id,last_seen_at",
        "id": "in.(${userIds.toSet().join(",")})",
        "limit": "200",
      });
      final out = <String, DateTime>{};
      for (final r in rows) {
        final t = DateTime.tryParse("${r["last_seen_at"]}")?.toLocal();
        if (t != null) out[r["id"].toString()] = t;
      }
      return out;
    } catch (_) {
      return {};
    }
  }

  // ---- Messenger ------------------------------------------------------------

  Future<List<Conversation>> conversations() async {
    final myId = api.session?.profileId;
    // Embed-free on purpose: PostgREST resource embeds 500 whenever its schema
    // cache goes stale after a migration (until the container restarts), which
    // made the whole messenger look broken every time the schema changed.
    // Flat filter queries never hit that cache, so assemble the participant
    // shape ourselves.
    final rows = await api.select("conversations", query: {
      "select": "*",
      "order": "last_message_at.desc",
      "limit": "40",
    });
    if (rows.isEmpty) return [];
    final convIds = rows.map((r) => r["id"].toString()).toList();
    var parts = <Map<String, dynamic>>[];
    try {
      parts = await api.select("conversation_participants", query: {
        "select": "conversation_id,user_id",
        "conversation_id": "in.(${convIds.join(",")})",
        "limit": "400",
      });
    } catch (_) {
      // Participant names are cosmetic — the list still renders as "Chat".
    }
    final userIds = parts
        .map((p) => p["user_id"].toString())
        .where((id) => id != myId)
        .toSet()
        .toList();
    final profById = <String, Map<String, dynamic>>{};
    if (userIds.isNotEmpty) {
      try {
        final profiles = await api.select("profiles", query: {
          "select": _profileCols,
          "id": "in.(${userIds.join(",")})",
          "limit": "400",
        });
        for (final p in profiles) {
          profById[p["id"].toString()] = p;
        }
      } catch (_) {}
    }
    final partsByConv = <String, List<Map<String, dynamic>>>{};
    for (final p in parts) {
      (partsByConv[p["conversation_id"].toString()] ??= []).add({
        "user_id": p["user_id"],
        "profile": profById[p["user_id"].toString()],
      });
    }
    return rows.map((r) {
      r["participants"] = partsByConv[r["id"].toString()] ?? const [];
      return Conversation.fromJson(r, myId: myId);
    }).toList();
  }

  /// Open (or create) the 1-to-1 conversation with [friend] and return it,
  /// ready to hand to the chat screen. Uses the same `get_or_create_direct_
  /// conversation` RPC the web uses, so both clients land in the same thread.
  Future<Conversation> openConversationWith(Profile friend) async {
    final res =
        await api.rpc("get_or_create_direct_conversation", {"other_user": friend.id});
    final id = res is String
        ? res
        : (res is Map
            ? (res["id"] ?? res.values.first).toString()
            : res.toString());
    if (id.isEmpty) throw Exception("Couldn't open the chat.");
    return Conversation(
      id: id,
      isGroup: false,
      lastMessageAt: DateTime.now(),
      other: friend,
    );
  }

  Future<List<Message>> messages(String conversationId, {int limit = 50}) async {
    final rows = await api.select("messages", query: {
      "select": "*",
      "conversation_id": "eq.$conversationId",
      "order": "created_at.desc",
      "limit": "$limit",
    });
    return rows.map(Message.fromJson).toList().reversed.toList();
  }

  Future<Message?> sendMessage(String conversationId, String content) async {
    final row = await api.insert("messages", {
      "conversation_id": conversationId,
      "sender_id": api.session!.profileId,
      "content": content,
    });
    return row == null ? null : Message.fromJson(row);
  }

  /// Send a voice message: an AAC clip already uploaded to chat-media.
  /// Mirrors the web's voice notes (file_kind 'audio' + duration_seconds).
  Future<Message?> sendVoiceMessage(
    String conversationId,
    String storagePath,
    int durationSeconds,
  ) async {
    final row = await api.insert("messages", {
      "conversation_id": conversationId,
      "sender_id": api.session!.profileId,
      "file_path": storagePath,
      "file_kind": "audio",
      "duration_seconds": durationSeconds < 1 ? 1 : durationSeconds,
    });
    return row == null ? null : Message.fromJson(row);
  }

  /// Send a photo message (already uploaded to the media bucket). `content`
  /// defaults to '' server-side; the row is valid because image_path is set.
  Future<Message?> sendImageMessage(
    String conversationId,
    String imagePath,
  ) async {
    final row = await api.insert("messages", {
      "conversation_id": conversationId,
      "sender_id": api.session!.profileId,
      "image_path": imagePath,
    });
    return row == null ? null : Message.fromJson(row);
  }

  // ---- GPS Map / SOS --------------------------------------------------------

  /// Every open SOS alert (active or just-marked-safe), newest first, each with
  /// the person who raised it. RLS scopes this to open alerts + the caller's.
  Future<List<Map<String, dynamic>>> activeSosAlerts() async {
    return api.select("sos_alerts", query: {
      "select":
          "id,user_id,status,latitude,longitude,message,created_at,person:profiles!sos_alerts_user_id_fkey($_profileCols)",
      "status": "in.(active,safe)",
      "order": "created_at.desc",
      "limit": "100",
    });
  }

  /// Raise (or refresh) my own SOS at [lat],[lng]. Updates my open alert if I
  /// already have one, else creates it.
  Future<void> sendSos(double lat, double lng, {String? message}) async {
    final me = api.session!.profileId;
    final mine = await api.select("sos_alerts", query: {
      "select": "id",
      "user_id": "eq.$me",
      "status": "in.(active,safe)",
      "limit": "1",
    });
    final fields = <String, dynamic>{
      "status": "active",
      "latitude": lat,
      "longitude": lng,
      if (message != null && message.trim().isNotEmpty) "message": message.trim(),
    };
    if (mine.isNotEmpty) {
      await api.update("sos_alerts", fields,
          filter: {"id": "eq.${mine.first["id"]}"});
    } else {
      await api.insert("sos_alerts", {"user_id": me, ...fields});
    }
  }

  /// Close my own SOS ("safe" | "resolved" | "cancelled").
  Future<void> setMySosStatus(String status) async {
    final me = api.session!.profileId;
    await api.update("sos_alerts", {"status": status},
        filter: {"user_id": "eq.$me", "status": "in.(active,safe)"});
  }

  /// Volunteer to help someone's SOS (idempotent per responder).
  Future<void> respondToSos(String alertId) async {
    await api.insert("sos_responders", {
      "alert_id": alertId,
      "user_id": api.session!.profileId,
    });
  }

  /// My family circles, each row = my membership + the circle
  /// (id, name, invite_code, owner_id) and my sharing switch.
  Future<List<Map<String, dynamic>>> familyCircles() async {
    return api.select("family_memberships", query: {
      "select":
          "sharing_enabled,joined_at,circle:family_circles(id,name,invite_code,owner_id)",
      "user_id": "eq.${api.session!.profileId}",
      "order": "joined_at.asc",
      "limit": "20",
    });
  }

  /// Everyone in a circle, with their latest shared position when visible.
  Future<List<Map<String, dynamic>>> familyCircleMembers(
      String circleId) async {
    return api.select("family_memberships", query: {
      "select":
          "user_id,sharing_enabled,person:profiles!family_memberships_user_id_fkey($_profileCols)",
      "circle_id": "eq.$circleId",
      "limit": "100",
    });
  }

  /// Create a circle (returns nothing useful — reload after). The RPC also
  /// makes the caller its first member.
  Future<void> createFamilyCircle(String name) =>
      api.rpc("create_family_circle", {"p_name": name});

  /// Join by invite code.
  Future<void> joinFamilyCircle(String code) =>
      api.rpc("join_family_circle", {"p_code": code.trim()});

  /// My per-circle sharing switch.
  Future<void> setFamilySharing(String circleId, bool enabled) async {
    await api.update("family_memberships", {"sharing_enabled": enabled},
        filter: {
          "circle_id": "eq.$circleId",
          "user_id": "eq.${api.session!.profileId}",
        });
  }

  Future<void> leaveFamilyCircle(String circleId) =>
      api.deleteRows("family_memberships", filter: {
        "circle_id": "eq.$circleId",
        "user_id": "eq.${api.session!.profileId}",
      });

  /// Family members' latest shared locations (best-effort — returns [] if the
  /// feature/table isn't reachable so the map still renders).
  Future<List<Map<String, dynamic>>> familyLocations() async {
    try {
      return await api.select("member_locations", query: {
        "select":
            "user_id,latitude,longitude,updated_at,person:profiles!member_locations_user_id_fkey($_profileCols)",
        "order": "updated_at.desc",
        "limit": "100",
      });
    } catch (_) {
      return [];
    }
  }

  /// Publish my live location so family circles can see me (best-effort).
  Future<void> shareMyLocation(double lat, double lng) async {
    try {
      await api.upsert(
        "member_locations",
        {
          "user_id": api.session!.profileId,
          "latitude": lat,
          "longitude": lng,
          "updated_at": DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: "user_id",
      );
    } catch (_) {}
  }

  // ---- Farm / IoT -----------------------------------------------------------

  Future<List<Device>> devices() async {
    final rows = await api.select("devices", query: {
      "select": "id,name,type,zone,online,last_seen",
      "order": "created_at.asc",
      "limit": "100",
    });
    return rows.map(Device.fromJson).toList();
  }

  /// Latest value per (device, metric): pull a recent window and reduce.
  /// Register a device from the phone (same shape as the web's
  /// registerDevice): insert with a placeholder topic + fresh secret, then
  /// point the topic at gwave/<id>. Returns the MQTT credentials — show them
  /// once so the farmer can flash them onto the ESP32/controller.
  Future<({String id, String topic, String secret})?> registerDevice({
    required String name,
    required String type,
    String zone = "default",
  }) async {
    final rand = Random();
    final secret = List.generate(
        32, (_) => rand.nextInt(16).toRadixString(16)).join();
    final row = await api.insert("devices", {
      "owner_id": api.session!.profileId,
      "name": name,
      "type": type,
      "zone": zone.isEmpty ? "default" : zone,
      "protocol": "mqtt",
      "topic": "pending-${DateTime.now().microsecondsSinceEpoch}-"
          "${rand.nextInt(0x7fffffff)}",
      "secret": secret,
    });
    if (row == null) return null;
    final id = row["id"].toString();
    final topic = "gwave/$id";
    await api.update("devices", {"topic": topic}, filter: {"id": "eq.$id"});
    return (id: id, topic: topic, secret: secret);
  }

  /// Queue an MQTT command; the bridge publishes it to <topic>/cmd —
  /// e.g. {"power": true} for a switch.
  Future<void> sendDeviceCommand(
      String deviceId, Map<String, dynamic> command) async {
    await api.insert("device_commands", {
      "device_id": deviceId,
      "issued_by": api.session!.profileId,
      "command": command,
    });
  }

  Future<void> deleteDevice(String deviceId) =>
      api.deleteRows("devices", filter: {"id": "eq.$deviceId"});

  Future<Map<String, List<SensorReading>>> latestReadings() async {
    final rows = await api.select("sensor_readings", query: {
      "select": "device_id,metric,value,ts",
      "order": "ts.desc",
      "limit": "300",
    });
    final all = rows.map(SensorReading.fromJson).toList();
    final byDevice = <String, Map<String, SensorReading>>{};
    for (final r in all) {
      final m = byDevice.putIfAbsent(r.deviceId, () => {});
      m.putIfAbsent(r.metric, () => r); // first seen = latest (desc order)
    }
    return byDevice.map((k, v) => MapEntry(k, v.values.toList()));
  }

  /// Recent reading history for a device, grouped by metric (ascending time),
  /// for the sparkline/line charts on the device detail screen.
  Future<Map<String, List<SensorReading>>> readingsHistory(
    String deviceId, {
    int limit = 120,
  }) async {
    final rows = await api.select("sensor_readings", query: {
      "select": "device_id,metric,value,ts",
      "device_id": "eq.$deviceId",
      "order": "ts.desc",
      "limit": "$limit",
    });
    final all = rows.map(SensorReading.fromJson).toList().reversed.toList();
    final byMetric = <String, List<SensorReading>>{};
    for (final r in all) {
      (byMetric[r.metric] ??= []).add(r);
    }
    return byMetric;
  }

  // ---- CCTV -----------------------------------------------------------------

  Future<List<Camera>> cameras() async {
    final rows = await api.select("user_cameras", query: {
      "select": "id,title,camera_type,hls_url,zone,is_public",
      "order": "created_at.asc",
      "limit": "60",
    });
    return rows.map(Camera.fromJson).toList();
  }

  // ---- Dashboard ------------------------------------------------------------

  /// Personal overview counts + wallet balance, mirroring the web dashboard.
  Future<DashboardStats> dashboardStats() async {
    final me = api.session!.profileId;
    final results = await Future.wait([
      api.count("posts", filter: {"author_id": "eq.$me"}),
      api.count("friendships", filter: {
        "status": "eq.accepted",
        "or": "(requester_id.eq.$me,addressee_id.eq.$me)",
      }),
      api.count("lesson_progress",
          filter: {"user_id": "eq.$me", "status": "eq.completed"}),
      api.count("shop_orders", filter: {"buyer_id": "eq.$me"}),
      api.count("shop_products", filter: {"seller_id": "eq.$me"}),
    ]);
    GpayAccount? wallet;
    try {
      wallet = await myGpayAccount();
    } catch (_) {}
    return DashboardStats(
      posts: results[0],
      friends: results[1],
      lessons: results[2],
      orders: results[3],
      listings: results[4],
      walletBalance: wallet?.isActive == true ? wallet!.balance : null,
    );
  }

  // ---- Friends --------------------------------------------------------------

  Future<List<Friendship>> incomingRequests() async {
    final me = api.session!.profileId;
    final rows = await api.select("friendships", query: {
      "select":
          "id,status,requester_id,requester:profiles!friendships_requester_id_fkey($_profileCols)",
      "status": "eq.pending",
      "addressee_id": "eq.$me",
      "order": "created_at.desc",
      "limit": "50",
    });
    return rows
        .map((r) => Friendship.fromJson(r, myId: me))
        .whereType<Friendship>()
        .toList();
  }

  Future<List<Friendship>> outgoingRequests() async {
    final me = api.session!.profileId;
    final rows = await api.select("friendships", query: {
      "select":
          "id,status,requester_id,addressee:profiles!friendships_addressee_id_fkey($_profileCols)",
      "status": "eq.pending",
      "requester_id": "eq.$me",
      "order": "created_at.desc",
      "limit": "50",
    });
    return rows
        .map((r) => Friendship.fromJson(r, myId: me))
        .whereType<Friendship>()
        .toList();
  }

  Future<List<Friendship>> friends() async {
    final me = api.session!.profileId;
    final rows = await api.select("friendships", query: {
      "select":
          "id,status,requester_id,requester:profiles!friendships_requester_id_fkey($_profileCols),addressee:profiles!friendships_addressee_id_fkey($_profileCols)",
      "status": "eq.accepted",
      "or": "(requester_id.eq.$me,addressee_id.eq.$me)",
      "order": "updated_at.desc",
      "limit": "200",
    });
    return rows
        .map((r) => Friendship.fromJson(r, myId: me))
        .whereType<Friendship>()
        .toList();
  }

  Future<void> acceptFriend(String friendshipId) => api.update(
        "friendships",
        {"status": "accepted"},
        filter: {"id": "eq.$friendshipId"},
      );

  Future<void> removeFriendship(String friendshipId) =>
      api.deleteRows("friendships", filter: {"id": "eq.$friendshipId"});

  Future<void> addFriend(String profileId) => api.insert("friendships", {
        "requester_id": api.session!.profileId,
        "addressee_id": profileId,
        "status": "pending",
      });

  // ---- G-Pay ----------------------------------------------------------------

  Future<GpayAccount?> myGpayAccount() async {
    final rows = await api.select("gpay_accounts", query: {
      "select": "id,status,balance,full_name,phone",
      "user_id": "eq.${api.session!.profileId}",
      "limit": "1",
    });
    return rows.isEmpty ? null : GpayAccount.fromJson(rows.first);
  }

  /// Whether the caller has set a transaction PIN (gates outgoing transfers).
  Future<bool> gpayHasPin() async {
    final res = await api.rpc("gpay_has_pin");
    return res == true;
  }

  /// Set / change the caller's 4–6 digit transaction PIN.
  Future<void> gpaySetPin(String pin) => api.rpc("gpay_set_pin", {"p_pin": pin});

  /// Send money to another active G-Pay account by its number. Mirrors the web
  /// wallet exactly: the server RPC checks the PIN, balance and recipient, moves
  /// the money atomically and logs the ledger row. [clientRef] makes a retry
  /// idempotent (no double-spend). Returns the new transaction id.
  ///
  /// The RPC raises a descriptive error ("Incorrect PIN", "Insufficient
  /// balance", "No active G-Pay account with that number", …) which surfaces to
  /// the user via [ApiException].
  Future<String?> gpayTransfer({
    required String toPhone,
    required double amount,
    String? note,
    String? pin,
    required String clientRef,
  }) async {
    final res = await api.rpc("gpay_transfer", {
      "p_to_phone": toPhone,
      "p_amount": amount,
      if (note != null && note.trim().isNotEmpty) "p_note": note.trim(),
      if (pin != null && pin.isNotEmpty) "p_pin": pin,
      "p_client_ref": clientRef,
    });
    return res?.toString();
  }

  Future<List<GpayTransaction>> gpayTransactions(String accountId) async {
    final rows = await api.select("gpay_transactions", query: {
      "select": "id,kind,from_account,to_account,amount,note,created_at",
      "or": "(from_account.eq.$accountId,to_account.eq.$accountId)",
      "order": "created_at.desc",
      "limit": "60",
    });
    return rows
        .map((r) => GpayTransaction.fromJson(r, myAccountId: accountId))
        .toList();
  }

  // ---- Walkie-talkie (PTT) --------------------------------------------------

  Future<List<PttChannel>> myPttChannels() async {
    final me = api.session!.profileId;
    // Channels I'm a member of, with each channel's member count embedded.
    final rows = await api.select("ptt_channel_members", query: {
      "select":
          "channel:ptt_channels(id,name,join_code,owner_id,members:ptt_channel_members(count))",
      "user_id": "eq.$me",
      "limit": "50",
    });
    final channels = <PttChannel>[];
    for (final r in rows) {
      final c = r["channel"];
      if (c is! Map<String, dynamic>) continue;
      var memberCount = 0;
      final members = c["members"];
      if (members is List && members.isNotEmpty) {
        final first = members.first;
        if (first is Map<String, dynamic>) {
          memberCount = int.tryParse("${first["count"] ?? 0}") ?? 0;
        }
      }
      channels.add(PttChannel(
        id: c["id"].toString(),
        name: (c["name"] ?? "Channel").toString(),
        memberCount: memberCount,
        joinCode: c["join_code"]?.toString(),
        ownerId: c["owner_id"]?.toString(),
      ));
    }
    return channels;
  }

  /// Create a channel and join it as the owner. Done server-side (service role)
  /// because a direct client insert into the channel tables is blocked by RLS
  /// on device, so the channel never actually saved.
  Future<PttChannel> createPttChannel(String name) async {
    final row = await api.pttCreate(name);
    return PttChannel(
      id: row["id"].toString(),
      name: (row["name"] ?? name).toString(),
      memberCount: 1,
      joinCode: row["join_code"]?.toString(),
      ownerId: row["owner_id"]?.toString(),
    );
  }

  Future<void> leavePttChannel(String channelId) async {
    await api.deleteRows("ptt_channel_members", filter: {
      "channel_id": "eq.$channelId",
      "user_id": "eq.${api.session!.profileId}",
    });
  }

  /// Channel history (oldest→newest). Pass [sinceIso] to fetch only messages
  /// after that timestamp (the poll path).
  Future<List<PttMessage>> pttMessages(
    String channelId, {
    String? sinceIso,
  }) async {
    final rows = await api.select("ptt_messages", query: {
      "select": "*,person:profiles!ptt_messages_user_id_fkey($_profileCols)",
      "channel_id": "eq.$channelId",
      if (sinceIso != null) "created_at": "gt.$sinceIso",
      "order": sinceIso != null ? "created_at.asc" : "created_at.desc",
      "limit": "50",
    });
    final list = rows.map(PttMessage.fromJson).toList();
    if (sinceIso == null) list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return list;
  }

  /// Post an already-uploaded voice clip to the channel.
  Future<PttMessage?> sendPttMessage(
    String channelId,
    String audioPath, {
    int? durationMs,
  }) async {
    final row = await api.insert("ptt_messages", {
      "channel_id": channelId,
      "user_id": api.session!.profileId,
      "audio_path": audioPath,
      if (durationMs != null) "duration_ms": durationMs,
    });
    return row == null ? null : PttMessage.fromJson(row);
  }

  // ---- Live classes ---------------------------------------------------------

  /// Teacher-hosted live classes (live_streams with kind "class"), live first.
  Future<List<LiveStream>> learnClasses() async {
    final rows = await api.select("live_streams", query: {
      "select": "*,host:profiles!live_streams_host_id_fkey($_profileCols)",
      "kind": "eq.class",
      "order": "created_at.desc",
      "limit": "40",
    });
    final list = rows.map(LiveStream.fromJson).toList();
    int rank(LiveStream s) =>
        s.status == "live" ? 0 : (s.status == "idle" ? 1 : 2);
    list.sort((a, b) => rank(a).compareTo(rank(b)));
    return list;
  }

  // ---- Learn progress -------------------------------------------------------

  /// Mark a lesson completed (native lesson reader / quiz). Idempotent upsert
  /// on the (user, track, lesson) key; an optional quiz [score] is stored too.
  Future<void> markLessonComplete(
    String trackSlug,
    String lessonSlug, {
    int? score,
  }) async {
    await api.upsert(
      "lesson_progress",
      {
        "user_id": api.session!.profileId,
        "track_slug": trackSlug,
        "lesson_slug": lessonSlug,
        "status": "completed",
        "progress_pct": 100,
        if (score != null) "score": score,
        "completed_at": DateTime.now().toUtc().toIso8601String(),
        "last_viewed_at": DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: "user_id,track_slug,lesson_slug",
    );
  }

  Future<List<Profile>> pttMembers(String channelId) async {
    final rows = await api.select("ptt_channel_members", query: {
      "select": "person:profiles!ptt_channel_members_user_id_fkey($_profileCols)",
      "channel_id": "eq.$channelId",
      "limit": "100",
    });
    return [
      for (final r in rows)
        if (r["person"] is Map<String, dynamic>)
          Profile.fromJson(r["person"] as Map<String, dynamic>),
    ];
  }

  // ---- Games ----------------------------------------------------------------

  Future<List<Game>> approvedGames() async {
    final rows = await api.select("games", query: {
      "select":
          "id,title,emoji,description,plays_count,author:profiles!games_author_id_fkey($_profileCols)",
      "status": "eq.approved",
      "order": "plays_count.desc",
      "limit": "60",
    });
    return rows.map(Game.fromJson).toList();
  }

  // ---- Finance (business expenses) ------------------------------------------

  /// The caller's expenses, unpaid (soonest due) first — mirrors the web query.
  Future<List<Expense>> expenses() async {
    final rows = await api.select("business_expenses", query: {
      "select": "*",
      "owner_id": "eq.${api.session!.profileId}",
      "order": "is_paid.asc,due_date.asc.nullslast,created_at.desc",
      "limit": "200",
    });
    return rows.map(Expense.fromJson).toList();
  }

  Future<void> addExpense({
    required String title,
    required double amount,
    required String category,
    DateTime? dueDate,
    bool recurring = false,
    String? note,
  }) async {
    await api.insert("business_expenses", {
      "owner_id": api.session!.profileId,
      "title": title.trim(),
      "amount": amount,
      "category": category,
      "recurring": recurring,
      if (dueDate != null)
        "due_date":
            "${dueDate.year.toString().padLeft(4, '0')}-${dueDate.month.toString().padLeft(2, '0')}-${dueDate.day.toString().padLeft(2, '0')}",
      if (note != null && note.trim().isNotEmpty) "note": note.trim(),
    });
  }

  Future<void> setExpensePaid(String id, bool paid) async {
    await api.update("business_expenses", {
      "is_paid": paid,
      "paid_at": paid ? DateTime.now().toUtc().toIso8601String() : null,
    }, filter: {
      "id": "eq.$id",
    });
  }

  Future<void> deleteExpense(String id) =>
      api.deleteRows("business_expenses", filter: {"id": "eq.$id"});

  // ---- Jobs -----------------------------------------------------------------

  Future<List<Job>> jobs({String? category, String? q}) async {
    final query = <String, String>{
      "select":
          "*,employer:profiles!jobs_employer_id_fkey($_profileCols)",
      "status": "eq.open",
      "order": "created_at.desc",
      "limit": "60",
    };
    if (category != null && category.isNotEmpty) {
      query["category"] = "eq.$category";
    }
    if (q != null && q.trim().isNotEmpty) {
      final term = q.trim().replaceAll(",", " ");
      query["or"] = "(title.ilike.*$term*,company.ilike.*$term*)";
    }
    final rows = await api.select("jobs", query: query);
    return rows.map(Job.fromJson).toList();
  }

  /// Submit an application (one per person per job — a repeat insert fails
  /// with the unique-violation, surfaced as an error).
  Future<void> applyJob({
    required String jobId,
    required String fullName,
    required String phone,
    String? coverLetter,
    double? expectedSalary,
    int? experienceYears,
    List<Map<String, String>> answers = const [],
  }) async {
    await api.insert("job_applications", {
      "job_id": jobId,
      "applicant_id": api.session!.profileId,
      "full_name": fullName.trim(),
      "phone": phone.trim(),
      if (coverLetter != null && coverLetter.trim().isNotEmpty)
        "cover_letter": coverLetter.trim(),
      if (expectedSalary != null) "expected_salary": expectedSalary,
      if (experienceYears != null) "experience_years": experienceYears,
      if (answers.isNotEmpty) "answers": answers,
    });
  }

  // ---- POS ------------------------------------------------------------------

  /// Stores the caller can sell in: ones they own plus ones they're staff of.
  /// Owned stores are matched on stores.owner_id directly (like the web POS) —
  /// an owner doesn't necessarily have a store_members row.
  Future<List<PosStore>> myStores() async {
    final me = api.session!.profileId;
    final owned = await api.select("stores", query: {
      "select": "id,name,currency",
      "owner_id": "eq.$me",
      "limit": "20",
    });
    List<Map<String, dynamic>> memberRows = const [];
    try {
      memberRows = await api.select("store_members", query: {
        "select": "store:stores(id,name,currency)",
        "user_id": "eq.$me",
        "limit": "20",
      });
    } catch (_) {
      // Membership lookup is additive; owned stores alone are fine.
    }
    final seen = <String>{};
    final stores = <PosStore>[];
    for (final s in owned) {
      final st = PosStore.fromJson(s);
      if (seen.add(st.id)) stores.add(st);
    }
    for (final r in memberRows) {
      final s = r["store"];
      if (s is Map<String, dynamic>) {
        final st = PosStore.fromJson(s);
        if (seen.add(st.id)) stores.add(st);
      }
    }
    return stores;
  }

  Future<List<PosProduct>> posProducts(String storeId) async {
    final rows = await api.select("pos_products", query: {
      "select": "id,name,price,sku,image_path",
      "store_id": "eq.$storeId",
      "active": "eq.true",
      "order": "name.asc",
      "limit": "200",
    });
    return rows.map(PosProduct.fromJson).toList();
  }

  /// Ring up a sale via the create_sale RPC (validates membership + open
  /// shift, claims the receipt number, and writes stock movements atomically).
  /// [method] is the tender: cash | gpay | qr | card. Returns the receipt
  /// number.
  Future<int?> createSale({
    required String storeId,
    required List<({String productId, int quantity})> items,
    required double total,
    String method = "cash",
  }) async {
    final res = await api.rpc("create_sale", {
      "p_store_id": storeId,
      "p_items": [
        for (final it in items)
          {"product_id": it.productId, "quantity": it.quantity, "discount": 0},
      ],
      "p_payments": [
        {"method": method, "amount": total},
      ],
    });
    if (res is List && res.isNotEmpty) {
      final row = res.first;
      if (row is Map<String, dynamic>) {
        return int.tryParse("${row["receipt_number"] ?? ""}");
      }
    }
    return null;
  }

  /// Take a real in-store G-Pay payment: the customer authorises with their
  /// wallet phone + transaction PIN and the pos_settle_gpay RPC moves the
  /// money (customer → store owner) atomically. Call before [createSale] with
  /// method "gpay".
  Future<void> posSettleGpay({
    required String storeId,
    required String customerPhone,
    required double amount,
    required String pin,
  }) async {
    await api.rpc("pos_settle_gpay", {
      "p_store_id": storeId,
      "p_customer_phone": customerPhone,
      "p_amount": amount,
      "p_pin": pin,
    });
  }

  // ---- Boost (ad campaigns) -------------------------------------------------

  /// My ad campaigns, newest first.
  Future<List<Map<String, dynamic>>> myBoosts() async {
    return api.select("boosts", query: {
      "select":
          "id,headline,target_type,target_id,budget_mmk,spent_mmk,daily_cap_mmk,bid_mmk,status,impressions,clicks,start_at,end_at,created_at",
      "owner_id": "eq.${api.session!.profileId}",
      "order": "created_at.desc",
      "limit": "50",
    });
  }

  /// Pause/resume a campaign ("active" | "paused").
  Future<void> setBoostStatus(String boostId, String status) =>
      api.rpc("set_boost_status", {"p_boost": boostId, "p_status": status});

  /// Cancel a campaign — the unspent escrow refunds to the wallet.
  Future<void> cancelBoost(String boostId) =>
      api.rpc("cancel_boost", {"p_boost": boostId});

  /// Start a campaign for one of my posts (escrows the budget from G-Pay).
  Future<void> createPostBoost({
    required String postId,
    String? headline,
    required double budgetMmk,
    required double dailyCapMmk,
    double bidMmk = 5,
    int days = 7,
  }) async {
    await api.rpc("create_boost", {
      "p_target_type": "post",
      "p_target_id": postId,
      "p_headline": headline,
      "p_budget_mmk": budgetMmk,
      "p_daily_cap_mmk": dailyCapMmk,
      "p_bid_mmk": bidMmk,
      "p_days": days,
      "p_audience": {},
    });
  }

  /// My own recent posts (profile timeline + the boost target picker).
  Future<List<Post>> myPosts({int limit = 20, int offset = 0}) async {
    final rows = await api.select("posts", query: {
      "select":
          "*,author:profiles!posts_author_id_fkey($_profileCols),media:post_media(storage_path,media_type,position)",
      "author_id": "eq.${api.session!.profileId}",
      "removed_at": "is.null",
      "order": "created_at.desc",
      "limit": "$limit",
      "offset": "$offset",
    });
    return rows.map(Post.fromJson).toList();
  }

  // ---- Knowledge (strains + minerals) ---------------------------------------

  Future<List<Strain>> strains({String? q, String? type}) async {
    final query = <String, String>{
      "select":
          "id,name,slug,type,thc,cbd,effects,flavors,terpenes,grow_difficulty,flowering_weeks,yield_indoor,yield_outdoor,description,image_url",
      "order": "name.asc",
      "limit": "60",
    };
    if (type != null && type.isNotEmpty) query["type"] = "eq.$type";
    if (q != null && q.trim().isNotEmpty) {
      query["name"] = "ilike.*${q.trim()}*";
    }
    final rows = await api.select("strains", query: query);
    return rows.map(Strain.fromJson).toList();
  }

  Future<List<Mineral>> minerals({String? q, String? category}) async {
    final query = <String, String>{
      "select":
          "id,name,category,symbol,hardness_mohs,density,uses,description,image_url",
      "order": "name.asc",
      "limit": "60",
    };
    if (category != null && category.isNotEmpty) {
      query["category"] = "eq.$category";
    }
    if (q != null && q.trim().isNotEmpty) {
      query["name"] = "ilike.*${q.trim()}*";
    }
    final rows = await api.select("minerals", query: query);
    return rows.map(Mineral.fromJson).toList();
  }

  /// Distinct mineral categories for the filter chips.
  Future<List<String>> mineralCategories() async {
    final rows = await api.select("minerals", query: {
      "select": "category",
      "limit": "500",
    });
    final set = <String>{};
    for (final r in rows) {
      final c = r["category"]?.toString();
      if (c != null && c.isNotEmpty) set.add(c);
    }
    final list = set.toList()..sort();
    return list;
  }

  // ---- Groups ---------------------------------------------------------------

  /// Groups the caller belongs to, plus public groups to discover.
  Future<({List<Group> mine, List<Group> discover})> groups() async {
    final me = api.session!.profileId;
    final memberRows = await api.select("group_members", query: {
      "select":
          "group:groups(id,name,slug,description,privacy,cover_url,member_count)",
      "user_id": "eq.$me",
      "status": "eq.active",
      "limit": "50",
    });
    final mine = <Group>[];
    final mineIds = <String>{};
    for (final r in memberRows) {
      final g = r["group"];
      if (g is Map<String, dynamic>) {
        final grp = Group.fromJson(g, isMember: true);
        mine.add(grp);
        mineIds.add(grp.id);
      }
    }
    final publicRows = await api.select("groups", query: {
      "select": "id,name,slug,description,privacy,cover_url,member_count",
      "privacy": "eq.public",
      "order": "member_count.desc",
      "limit": "30",
    });
    final discover = publicRows
        .map((r) => Group.fromJson(r))
        .where((g) => !mineIds.contains(g.id))
        .toList();
    return (mine: mine, discover: discover);
  }

  Future<void> joinGroup(String groupId) async {
    await api.insert("group_members", {
      "group_id": groupId,
      "user_id": api.session!.profileId,
    });
  }

  /// Posts inside a group, newest first.
  Future<List<Post>> groupFeed(String groupId, {int limit = 30}) async {
    final rows = await api.select("posts", query: {
      "select":
          "*,author:profiles!posts_author_id_fkey($_profileCols),media:post_media(storage_path,media_type,position)",
      "group_id": "eq.$groupId",
      "removed_at": "is.null",
      "order": "created_at.desc",
      "limit": "$limit",
    });
    return rows.map(Post.fromJson).toList();
  }

  // ---- Learn progress -------------------------------------------------------

  /// The caller's completed lesson slugs within one track (for ✓ ticks).
  Future<Set<String>> completedLessons(String trackSlug) async {
    final rows = await api.select("lesson_progress", query: {
      "select": "lesson_slug",
      "user_id": "eq.${api.session!.profileId}",
      "track_slug": "eq.$trackSlug",
      "status": "eq.completed",
      "limit": "500",
    });
    return rows
        .map((r) => r["lesson_slug"]?.toString())
        .whereType<String>()
        .toSet();
  }

  /// Completed-lesson counts per track for the caller, driving the native
  /// Learn hub's progress bars (lesson content itself lives in the web app).
  Future<Map<String, int>> learnCompletedByTrack() async {
    final rows = await api.select("lesson_progress", query: {
      "select": "track_slug,status",
      "user_id": "eq.${api.session!.profileId}",
      "status": "eq.completed",
      "limit": "1000",
    });
    final byTrack = <String, int>{};
    for (final r in rows) {
      final t = r["track_slug"]?.toString();
      if (t != null) byTrack[t] = (byTrack[t] ?? 0) + 1;
    }
    return byTrack;
  }

  // ---- Settings -------------------------------------------------------------

  /// Update the caller's own profile fields (only the ones provided).
  Future<void> updateMyProfile({
    String? fullName,
    String? username,
    String? bio,
    String? avatarPath,
    String? coverPath,
  }) async {
    final patch = <String, dynamic>{};
    if (fullName != null && fullName.trim().isNotEmpty) {
      patch["full_name"] = fullName.trim();
    }
    if (username != null && username.trim().isNotEmpty) {
      patch["username"] = username.trim().toLowerCase();
    }
    if (bio != null) patch["bio"] = bio.trim();
    if (avatarPath != null) patch["avatar_url"] = avatarPath;
    if (coverPath != null) patch["cover_url"] = coverPath;
    if (patch.isEmpty) return;
    await api.update("profiles", patch, filter: {
      "id": "eq.${api.session!.profileId}",
    });
  }

  // ---- Profile --------------------------------------------------------------

  Future<Profile?> profile(String id) async {
    final rows = await api.select("profiles", query: {
      "select": _profileCols,
      "id": "eq.$id",
      "limit": "1",
    });
    return rows.isEmpty ? null : Profile.fromJson(rows.first);
  }

  Future<Profile?> myProfile() =>
      api.session == null ? Future.value(null) : profile(api.session!.profileId);

  /// Store the signed-in user's date of birth on their profile (drives the
  /// 18+ age gating). `birth_date` is a DATE column, so send `yyyy-MM-dd`.
  Future<void> setBirthDate(DateTime dob) async {
    final s =
        "${dob.year.toString().padLeft(4, '0')}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}";
    await api.update("profiles", {"birth_date": s}, filter: {
      "id": "eq.${api.session!.profileId}",
    });
  }

  /// Save the display name and/or gender collected at sign-up. Only the fields
  /// given are written; `gender` is one of male|female|other (see the
  /// profile_gender migration).
  /// Change my cover photo (an already-uploaded storage path) — the same
  /// profiles.cover_url the web hero uses. Pass null-like empty to clear.
  Future<void> setCoverPhoto(String path) async {
    await api.update("profiles", {"cover_url": path},
        filter: {"id": "eq.${api.session!.profileId}"});
  }

  /// Change my profile photo (avatar).
  Future<void> setAvatarPhoto(String path) async {
    await api.update("profiles", {"avatar_url": path},
        filter: {"id": "eq.${api.session!.profileId}"});
  }

  Future<void> setProfileBasics({String? fullName, String? gender}) async {
    final patch = <String, dynamic>{};
    if (fullName != null && fullName.trim().isNotEmpty) {
      patch["full_name"] = fullName.trim();
    }
    if (gender != null && gender.isNotEmpty) patch["gender"] = gender;
    if (patch.isEmpty) return;
    await api.update("profiles", patch, filter: {
      "id": "eq.${api.session!.profileId}",
    });
  }
}

/// Personal overview numbers for the native dashboard.
class DashboardStats {
  DashboardStats({
    required this.posts,
    required this.friends,
    required this.lessons,
    required this.orders,
    required this.listings,
    this.walletBalance,
  });

  final int posts;
  final int friends;
  final int lessons;
  final int orders;
  final int listings;
  final double? walletBalance;
}

/// Resolve a possibly-relative storage reference to a full URL. Values already
/// absolute (avatars synced from Google, external product images) pass through;
/// bucket paths become Supabase public object URLs.
String? resolveMedia(String? ref, {String bucket = "avatars"}) {
  if (ref == null || ref.isEmpty) return null;
  if (ref.startsWith("http://") || ref.startsWith("https://")) return ref;
  final clean = ref.startsWith("/") ? ref.substring(1) : ref;
  // S3/CloudFront: the stored key already encodes the location, so the bucket
  // isn't part of the URL (mirrors the web's `mediaUrl`). Supabase Storage:
  // build the public object URL under the given bucket.
  if (AppConfig.useS3Media) {
    return "${AppConfig.mediaCdn}/$clean";
  }
  return "${AppConfig.supabaseUrl}/storage/v1/object/public/$bucket/$clean";
}
