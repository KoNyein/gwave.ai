
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
    List<PostMedia> media = const [],
  }) async {
    final row = await api.insert("posts", {
      "author_id": api.session!.profileId,
      "content": content,
      "visibility": "public",
      if (locationName != null && locationName.isNotEmpty)
        "location_name": locationName,
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

  Future<List<LiveStream>> liveStreams({bool onlyLive = false}) async {
    final rows = await api.select("live_streams", query: {
      "select": "*,host:profiles!live_streams_host_id_fkey($_profileCols)",
      if (onlyLive) "status": "eq.live",
      if (!onlyLive) "status": "in.(live,ended)",
      "order": "created_at.desc",
      "limit": "40",
    });
    return rows.map(LiveStream.fromJson).toList();
  }

  Future<LiveStream?> stream(String id) async {
    final rows = await api.select("live_streams", query: {
      "select": "*,host:profiles!live_streams_host_id_fkey($_profileCols)",
      "id": "eq.$id",
      "limit": "1",
    });
    return rows.isEmpty ? null : LiveStream.fromJson(rows.first);
  }

  /// Live chat for a stream, oldest→newest. Pass [sinceIso] to fetch only
  /// messages newer than the last one seen (cheap polling while watching).
  Future<List<LiveChatMessage>> liveChat(
    String streamId, {
    String? sinceIso,
    int limit = 60,
  }) async {
    final rows = await api.select("live_chat_messages", query: {
      "select":
          "*,sender:profiles!live_chat_messages_user_id_fkey($_profileCols)",
      "stream_id": "eq.$streamId",
      if (sinceIso != null) "created_at": "gt.$sinceIso",
      "order": "created_at.asc",
      "limit": "$limit",
    });
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
  }) async {
    await api.insert("reels", {
      "owner_id": api.session!.profileId,
      "video_path": videoPath,
      "is_public": true,
      "original_confirmed": originalConfirmed,
      if (caption != null && caption.trim().isNotEmpty) "caption": caption.trim(),
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

  Future<List<AppNotification>> notifications() async {
    final rows = await api.select("notifications", query: {
      "select":
          "*,actor:profiles!notifications_actor_id_fkey($_profileCols)",
      "order": "created_at.desc",
      "limit": "50",
    });
    return rows.map(AppNotification.fromJson).toList();
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

  // ---- Messenger ------------------------------------------------------------

  Future<List<Conversation>> conversations() async {
    final myId = api.session?.profileId;
    final rows = await api.select("conversations", query: {
      "select":
          "*,participants:conversation_participants(user_id,profile:profiles!conversation_participants_user_id_fkey($_profileCols))",
      "order": "last_message_at.desc",
      "limit": "40",
    });
    return rows.map((r) => Conversation.fromJson(r, myId: myId)).toList();
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

  /// Stores the caller belongs to (owner or staff), via their membership rows.
  Future<List<PosStore>> myStores() async {
    final rows = await api.select("store_members", query: {
      "select": "store:stores(id,name,currency)",
      "user_id": "eq.${api.session!.profileId}",
      "limit": "20",
    });
    final stores = <PosStore>[];
    for (final r in rows) {
      final s = r["store"];
      if (s is Map<String, dynamic>) stores.add(PosStore.fromJson(s));
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

  /// Ring up a cash sale via the create_sale RPC (validates membership + open
  /// shift, claims the receipt number, and writes stock movements atomically).
  /// Returns the receipt number.
  Future<int?> createSale({
    required String storeId,
    required List<({String productId, int quantity})> items,
    required double total,
  }) async {
    final res = await api.rpc("create_sale", {
      "p_store_id": storeId,
      "p_items": [
        for (final it in items)
          {"product_id": it.productId, "quantity": it.quantity, "discount": 0},
      ],
      "p_payments": [
        {"method": "cash", "amount": total},
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
