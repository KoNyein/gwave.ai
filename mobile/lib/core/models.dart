/// Plain data models mirroring the backend tables the app reads. Only the
/// columns the native screens use are mapped; PostgREST returns the rest and we
/// ignore them.

String? _s(dynamic v) => v == null ? null : v.toString();
int _i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse("${v ?? ''}") ?? 0);
double? _d(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse("$v"));

class Profile {
  Profile({
    required this.id,
    this.username,
    this.fullName,
    this.avatarUrl,
    this.coverUrl,
    this.bio,
    this.role,
    this.isTeacher = false,
    this.lastSeenAt,
  });

  final String id;
  final String? username;
  final String? fullName;
  final String? avatarUrl;
  final String? coverUrl;
  final String? bio;
  final String? role;
  final bool isTeacher;

  /// Presence heartbeat (profiles.last_seen_at). Filled only where a screen
  /// fetches it; "online" means seen within the last 2 minutes.
  final DateTime? lastSeenAt;

  bool get isOnline =>
      lastSeenAt != null &&
      DateTime.now().difference(lastSeenAt!) < const Duration(minutes: 2);

  /// Auto-generated placeholder usernames (user_<id-prefix>, minted so the
  /// web stops forcing onboarding) — not something to show as a person's name.
  static final _autoUsername = RegExp(r'^user_[0-9a-f]{6,}$');

  String get displayName {
    final fn = fullName?.trim() ?? "";
    if (fn.isNotEmpty) return fn;
    final un = username?.trim() ?? "";
    if (un.isNotEmpty && !_autoUsername.hasMatch(un)) return un;
    return "Gwave user";
  }

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
        id: j["id"].toString(),
        username: _s(j["username"]),
        fullName: _s(j["full_name"]),
        avatarUrl: _s(j["avatar_url"]),
        coverUrl: _s(j["cover_url"]),
        bio: _s(j["bio"]),
        role: _s(j["role"]),
        isTeacher: j["is_teacher"] == true,
        lastSeenAt: DateTime.tryParse("${j["last_seen_at"]}")?.toLocal(),
      );
}

class PostMedia {
  PostMedia({required this.storagePath, required this.mediaType});
  final String storagePath;
  final String mediaType; // image | video

  factory PostMedia.fromJson(Map<String, dynamic> j) => PostMedia(
        storagePath: (j["storage_path"] ?? "").toString(),
        mediaType: (j["media_type"] ?? "image").toString(),
      );
}

class Post {
  Post({
    required this.id,
    required this.authorId,
    required this.content,
    required this.reactionCount,
    required this.commentCount,
    required this.shareCount,
    required this.createdAt,
    this.locationName,
    this.latitude,
    this.longitude,
    this.author,
    this.media = const [],
  });

  final String id;
  final String authorId;
  final String content;
  final int reactionCount;
  final int commentCount;
  final int shareCount;
  final DateTime createdAt;
  final String? locationName;
  final double? latitude;
  final double? longitude;
  final Profile? author;
  final List<PostMedia> media;

  PostMedia? get firstImage {
    for (final m in media) {
      if (m.mediaType == "image") return m;
    }
    return media.isNotEmpty ? media.first : null;
  }

  /// The first attached video, if the post has one. Rendered as an inline
  /// player in the feed (an image widget can't display a video).
  PostMedia? get firstVideo {
    for (final m in media) {
      if (m.mediaType == "video") return m;
    }
    return null;
  }

  factory Post.fromJson(Map<String, dynamic> j) {
    final authorJson = j["author"] ?? j["profiles"];
    final mediaJson = j["media"] ?? j["post_media"];
    final media = mediaJson is List
        ? mediaJson
            .whereType<Map<String, dynamic>>()
            .map(PostMedia.fromJson)
            .toList()
        : <PostMedia>[];
    return Post(
      id: j["id"].toString(),
      authorId: j["author_id"].toString(),
      content: (j["content"] ?? "").toString(),
      reactionCount: _i(j["reaction_count"]),
      commentCount: _i(j["comment_count"]),
      shareCount: _i(j["share_count"]),
      createdAt: DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      locationName: _s(j["location_name"]),
      latitude: _d(j["latitude"]),
      longitude: _d(j["longitude"]),
      author: authorJson is Map<String, dynamic>
          ? Profile.fromJson(authorJson)
          : null,
      media: media,
    );
  }
}

class Comment {
  Comment({
    required this.id,
    required this.postId,
    required this.authorId,
    required this.content,
    required this.createdAt,
    this.imagePath,
    this.reactionCount = 0,
    this.author,
  });

  final String id;
  final String postId;
  final String authorId;
  final String content;
  final DateTime createdAt;

  /// Optional attached photo (object path in the "media" bucket).
  final String? imagePath;
  final int reactionCount;
  final Profile? author;

  factory Comment.fromJson(Map<String, dynamic> j) {
    final authorJson = j["author"] ?? j["profiles"];
    return Comment(
      id: j["id"].toString(),
      postId: j["post_id"].toString(),
      authorId: j["author_id"].toString(),
      content: (j["content"] ?? "").toString(),
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      imagePath: j["image_path"] as String?,
      reactionCount: (j["reaction_count"] as num?)?.toInt() ?? 0,
      author: authorJson is Map<String, dynamic>
          ? Profile.fromJson(authorJson)
          : null,
    );
  }
}

class LiveStream {
  LiveStream({
    required this.id,
    required this.hostId,
    required this.title,
    required this.status,
    required this.viewerCount,
    this.description,
    this.ivsPlaybackUrl,
    this.recordingPath,
    this.vodPlaybackId,
    this.host,
    this.createdAt,
    this.locationName,
    this.livekitRoom,
  });

  final String id;
  final String hostId;
  final String title;
  final String status; // scheduled | live | ended
  final int viewerCount;
  final String? description;
  final String? ivsPlaybackUrl;
  final String? recordingPath;
  final String? vodPlaybackId;
  final Profile? host;
  final DateTime? createdAt;
  final String? locationName;

  /// Set when the broadcast goes through the LiveKit SFU (browser Go Live).
  /// Those streams have no HLS URL — viewers join the room over WebRTC.
  final String? livekitRoom;

  bool get isLive => status == "live";

  /// A finished broadcast that actually has something to play back.
  bool get hasReplay =>
      (recordingPath != null && recordingPath!.isNotEmpty) ||
      (vodPlaybackId != null && vodPlaybackId!.isNotEmpty);

  factory LiveStream.fromJson(Map<String, dynamic> j) {
    final hostJson = j["host"] ?? j["profiles"];
    return LiveStream(
      id: j["id"].toString(),
      hostId: j["host_id"].toString(),
      title: (j["title"] ?? "Live").toString(),
      status: (j["status"] ?? "scheduled").toString(),
      viewerCount: _i(j["viewer_count"]),
      description: _s(j["description"]),
      ivsPlaybackUrl: _s(j["ivs_playback_url"]),
      recordingPath: _s(j["recording_path"]),
      vodPlaybackId: _s(j["vod_playback_id"]),
      host: hostJson is Map<String, dynamic> ? Profile.fromJson(hostJson) : null,
      createdAt: DateTime.tryParse("${j["created_at"]}")?.toLocal(),
      locationName: _s(j["location_name"]),
      livekitRoom: _s(j["livekit_room"]),
    );
  }
}

class LiveChatMessage {
  LiveChatMessage({
    required this.id,
    required this.streamId,
    required this.userId,
    required this.content,
    required this.createdAt,
    this.sender,
  });

  final String id;
  final String streamId;
  final String userId;
  final String content;
  final DateTime createdAt;
  final Profile? sender;

  String get senderName => sender?.displayName ?? "Viewer";

  factory LiveChatMessage.fromJson(Map<String, dynamic> j) {
    final s = j["sender"] ?? j["profiles"];
    return LiveChatMessage(
      id: j["id"].toString(),
      streamId: j["stream_id"].toString(),
      userId: j["user_id"].toString(),
      content: (j["content"] ?? "").toString(),
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      sender: s is Map<String, dynamic> ? Profile.fromJson(s) : null,
    );
  }
}

class ShopProduct {
  ShopProduct({
    required this.id,
    required this.title,
    required this.currency,
    this.description,
    this.imageUrl,
    this.price,
    this.category,
    this.externalUrl,
    this.merchant,
  });

  final String id;
  final String title;
  final String currency;
  final String? description;
  final String? imageUrl;
  final double? price;
  final String? category;
  final String? externalUrl;
  final String? merchant;

  factory ShopProduct.fromJson(Map<String, dynamic> j) => ShopProduct(
        id: j["id"].toString(),
        title: (j["title"] ?? "").toString(),
        currency: (j["currency"] ?? "Ks").toString(),
        description: _s(j["description"]),
        imageUrl: _s(j["image_url"]),
        price: _d(j["price"]),
        category: _s(j["category"]),
        externalUrl: _s(j["external_url"]),
        merchant: _s(j["merchant"]),
      );
}

class Story {
  Story({
    required this.id,
    required this.authorId,
    required this.mediaPath,
    required this.mediaType,
    required this.createdAt,
    this.textOverlay,
    this.author,
  });

  final String id;
  final String authorId;
  final String mediaPath;
  final String mediaType; // image | video
  final DateTime createdAt;
  final String? textOverlay;
  final Profile? author;

  factory Story.fromJson(Map<String, dynamic> j) {
    final a = j["author"] ?? j["profiles"];
    return Story(
      id: j["id"].toString(),
      authorId: j["author_id"].toString(),
      mediaPath: (j["media_path"] ?? "").toString(),
      mediaType: (j["media_type"] ?? "image").toString(),
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      textOverlay: _s(j["text_overlay"]),
      author: a is Map<String, dynamic> ? Profile.fromJson(a) : null,
    );
  }
}

class Reel {
  Reel({
    required this.id,
    required this.ownerId,
    required this.videoPath,
    required this.likeCount,
    required this.viewCount,
    this.posterPath,
    this.caption,
    this.locationName,
    this.author,
  });

  final String id;
  final String ownerId;
  final String videoPath;
  final int likeCount;
  final int viewCount;
  final String? posterPath;
  final String? caption;
  final String? locationName;
  final Profile? author;

  factory Reel.fromJson(Map<String, dynamic> j) {
    final a = j["author"] ?? j["profiles"];
    return Reel(
      id: j["id"].toString(),
      ownerId: j["owner_id"].toString(),
      videoPath: (j["video_path"] ?? "").toString(),
      likeCount: _i(j["like_count"]),
      viewCount: _i(j["view_count"]),
      posterPath: _s(j["poster_path"]),
      caption: _s(j["caption"]),
      locationName: _s(j["location_name"]),
      author: a is Map<String, dynamic> ? Profile.fromJson(a) : null,
    );
  }
}

class AppNotification {
  AppNotification({
    required this.id,
    required this.type,
    required this.read,
    required this.createdAt,
    this.actor,
    this.postId,
  });

  final String id;
  final String type;
  final bool read;
  final DateTime createdAt;
  final Profile? actor;
  final String? postId;

  factory AppNotification.fromJson(Map<String, dynamic> j) {
    final a = j["actor"] ?? j["profiles"];
    return AppNotification(
      id: j["id"].toString(),
      type: (j["type"] ?? "").toString(),
      read: j["read"] == true,
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      actor: a is Map<String, dynamic> ? Profile.fromJson(a) : null,
      postId: _s(j["post_id"]),
    );
  }
}

class Device {
  Device({
    required this.id,
    required this.name,
    required this.type,
    required this.online,
    this.zone,
    this.lastSeen,
  });

  final String id;
  final String name;
  final String type; // sensor | switch | camera | controller
  final bool online;
  final String? zone;
  final DateTime? lastSeen;

  factory Device.fromJson(Map<String, dynamic> j) => Device(
        id: j["id"].toString(),
        name: (j["name"] ?? "Device").toString(),
        type: (j["type"] ?? "sensor").toString(),
        online: j["online"] == true,
        zone: _s(j["zone"]),
        lastSeen: DateTime.tryParse("${j["last_seen"]}")?.toLocal(),
      );
}

class SensorReading {
  SensorReading({
    required this.deviceId,
    required this.metric,
    required this.value,
    required this.ts,
  });

  final String deviceId;
  final String metric;
  final double value;
  final DateTime ts;

  factory SensorReading.fromJson(Map<String, dynamic> j) => SensorReading(
        deviceId: j["device_id"].toString(),
        metric: (j["metric"] ?? "").toString(),
        value: _d(j["value"]) ?? 0,
        ts: DateTime.tryParse("${j["ts"]}")?.toLocal() ?? DateTime.now(),
      );
}

class Camera {
  Camera({
    required this.id,
    required this.title,
    required this.cameraType,
    this.hlsUrl,
    this.zone,
    this.isPublic = false,
  });

  final String id;
  final String title;
  final String cameraType;
  final String? hlsUrl;
  final String? zone;
  final bool isPublic;

  factory Camera.fromJson(Map<String, dynamic> j) => Camera(
        id: j["id"].toString(),
        title: (j["title"] ?? "Camera").toString(),
        cameraType: (j["camera_type"] ?? "").toString(),
        hlsUrl: _s(j["hls_url"]),
        zone: _s(j["zone"]),
        isPublic: j["is_public"] == true,
      );
}

class Conversation {
  Conversation({
    required this.id,
    required this.isGroup,
    required this.lastMessageAt,
    this.title,
    this.other,
    this.lastMessage,
  });

  final String id;
  final bool isGroup;
  final DateTime lastMessageAt;
  final String? title;
  final Profile? other;
  final String? lastMessage;

  String get displayTitle => title?.trim().isNotEmpty == true
      ? title!
      : (other?.displayName ?? (isGroup ? "Group chat" : "Chat"));

  /// [myId] identifies the current user so a 1-1 chat resolves to the *other*
  /// participant's profile (name + avatar), which PostgREST returns embedded as
  /// `participants:conversation_participants(user_id, profile:profiles(...))`.
  factory Conversation.fromJson(Map<String, dynamic> j, {String? myId}) {
    Profile? other;
    final parts = j["participants"];
    if (parts is List) {
      for (final p in parts) {
        if (p is! Map<String, dynamic>) continue;
        final uid = p["user_id"]?.toString();
        final prof = p["profile"] ?? p["profiles"];
        if (uid != null && uid != myId && prof is Map<String, dynamic>) {
          other = Profile.fromJson(prof);
          break;
        }
      }
    }
    return Conversation(
      id: j["id"].toString(),
      isGroup: j["is_group"] == true,
      lastMessageAt:
          DateTime.tryParse("${j["last_message_at"]}")?.toLocal() ?? DateTime.now(),
      title: _s(j["title"]),
      other: other,
    );
  }
}

/// A friendship row with the *other* person resolved (the requester for an
/// incoming request, the addressee for an outgoing one, either side for an
/// accepted friend).
class Friendship {
  Friendship({
    required this.id,
    required this.status,
    required this.other,
  });

  final String id;
  final String status; // pending | accepted | declined | blocked
  final Profile other;

  /// Build from a friendships row that embeds both profiles; [myId] picks the
  /// side that isn't me.
  static Friendship? fromJson(Map<String, dynamic> j, {required String myId}) {
    final reqId = j["requester_id"]?.toString();
    final reqJson = j["requester"];
    final addrJson = j["addressee"];
    Map<String, dynamic>? otherJson;
    if (reqId == myId) {
      otherJson = addrJson is Map<String, dynamic> ? addrJson : null;
    } else {
      otherJson = reqJson is Map<String, dynamic> ? reqJson : null;
    }
    if (otherJson == null) return null;
    return Friendship(
      id: j["id"].toString(),
      status: (j["status"] ?? "pending").toString(),
      other: Profile.fromJson(otherJson),
    );
  }
}

class GpayAccount {
  GpayAccount({
    required this.id,
    required this.status,
    required this.balance,
    this.fullName,
    this.phone,
  });

  final String id;
  final String status; // pending | active | rejected | suspended
  final double balance;
  final String? fullName;
  final String? phone; // the KPay handle others send to

  bool get isActive => status == "active";

  factory GpayAccount.fromJson(Map<String, dynamic> j) => GpayAccount(
        id: j["id"].toString(),
        status: (j["status"] ?? "pending").toString(),
        balance: _d(j["balance"]) ?? 0,
        fullName: _s(j["full_name"]),
        phone: _s(j["phone"]),
      );
}

class GpayTransaction {
  GpayTransaction({
    required this.id,
    required this.kind,
    required this.amount,
    required this.createdAt,
    required this.outgoing,
    this.note,
  });

  final String id;
  final String kind; // topup | transfer | withdrawal | ...
  final double amount;
  final DateTime createdAt;
  final bool outgoing; // money left my account
  final String? note;

  /// [myAccountId] decides the sign: a row whose `from_account` is mine is an
  /// outgoing debit, otherwise it's an incoming credit.
  factory GpayTransaction.fromJson(
    Map<String, dynamic> j, {
    required String myAccountId,
  }) {
    return GpayTransaction(
      id: j["id"].toString(),
      kind: (j["kind"] ?? "transfer").toString(),
      amount: _d(j["amount"]) ?? 0,
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      outgoing: j["from_account"]?.toString() == myAccountId,
      note: _s(j["note"]),
    );
  }
}

class PttChannel {
  PttChannel({
    required this.id,
    required this.name,
    required this.memberCount,
    this.joinCode,
    this.ownerId,
  });
  final String id;
  final String name;
  final int memberCount;
  final String? joinCode;
  final String? ownerId;

  factory PttChannel.fromJson(Map<String, dynamic> j) => PttChannel(
        id: j["id"].toString(),
        name: (j["name"] ?? "Channel").toString(),
        memberCount: _i(j["member_count"]),
        joinCode: j["join_code"]?.toString(),
        ownerId: j["owner_id"]?.toString(),
      );
}

/// One walkie-talkie transmission: a short voice clip in the media bucket.
class PttMessage {
  PttMessage({
    required this.id,
    required this.userId,
    required this.audioPath,
    required this.createdAt,
    this.durationMs,
    this.person,
  });

  final String id;
  final String userId;
  final String audioPath;
  final DateTime createdAt;
  final int? durationMs;
  final Profile? person;

  factory PttMessage.fromJson(Map<String, dynamic> j) => PttMessage(
        id: j["id"].toString(),
        userId: j["user_id"].toString(),
        audioPath: (j["audio_path"] ?? "").toString(),
        createdAt: DateTime.tryParse("${j["created_at"]}")?.toLocal() ??
            DateTime.now(),
        durationMs: (j["duration_ms"] as num?)?.toInt(),
        person: j["person"] is Map<String, dynamic>
            ? Profile.fromJson(j["person"] as Map<String, dynamic>)
            : null,
      );
}

class Game {
  Game({
    required this.id,
    required this.title,
    required this.emoji,
    required this.playsCount,
    this.description,
    this.author,
  });

  final String id;
  final String title;
  final String emoji;
  final int playsCount;
  final String? description;
  final Profile? author;

  factory Game.fromJson(Map<String, dynamic> j) {
    final a = j["author"] ?? j["profiles"];
    return Game(
      id: j["id"].toString(),
      title: (j["title"] ?? "Game").toString(),
      emoji: (j["emoji"] ?? "🎮").toString(),
      playsCount: _i(j["plays_count"]),
      description: _s(j["description"]),
      author: a is Map<String, dynamic> ? Profile.fromJson(a) : null,
    );
  }
}

/// A business expense row (personal finance tracker).
class Expense {
  Expense({
    required this.id,
    required this.title,
    required this.category,
    required this.amount,
    required this.currency,
    required this.isPaid,
    required this.recurring,
    required this.createdAt,
    this.dueDate,
    this.note,
  });

  final String id;
  final String title;
  final String category; // salary | rent | utility | tax | other
  final double amount;
  final String currency;
  final bool isPaid;
  final bool recurring;
  final DateTime createdAt;
  final DateTime? dueDate;
  final String? note;

  factory Expense.fromJson(Map<String, dynamic> j) => Expense(
        id: j["id"].toString(),
        title: (j["title"] ?? "").toString(),
        category: (j["category"] ?? "other").toString(),
        amount: _d(j["amount"]) ?? 0,
        currency: (j["currency"] ?? "MMK").toString(),
        isPaid: j["is_paid"] == true,
        recurring: j["recurring"] == true,
        createdAt:
            DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
        dueDate: DateTime.tryParse("${j["due_date"]}")?.toLocal(),
        note: _s(j["note"]),
      );
}

class Job {
  Job({
    required this.id,
    required this.title,
    required this.category,
    required this.employmentType,
    required this.description,
    required this.createdAt,
    this.company,
    this.location,
    this.requirements,
    this.salaryMin,
    this.salaryMax,
    this.salaryCurrency = "MMK",
    this.contact,
    this.questions = const [],
    this.employer,
  });

  final String id;
  final String title;
  final String category;
  final String employmentType;
  final String description;
  final DateTime createdAt;
  final String? company;
  final String? location;
  final String? requirements;
  final double? salaryMin;
  final double? salaryMax;
  final String salaryCurrency;
  final String? contact;
  final List<String> questions; // employer's custom application questions
  final Profile? employer;

  factory Job.fromJson(Map<String, dynamic> j) {
    final e = j["employer"] ?? j["profiles"];
    final qs = j["questions"];
    return Job(
      id: j["id"].toString(),
      title: (j["title"] ?? "").toString(),
      category: (j["category"] ?? "other").toString(),
      employmentType: (j["employment_type"] ?? "full_time").toString(),
      description: (j["description"] ?? "").toString(),
      createdAt:
          DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
      company: _s(j["company"]),
      location: _s(j["location"]),
      requirements: _s(j["requirements"]),
      salaryMin: _d(j["salary_min"]),
      salaryMax: _d(j["salary_max"]),
      salaryCurrency: (j["salary_currency"] ?? "MMK").toString(),
      contact: _s(j["contact"]),
      questions:
          qs is List ? qs.map((q) => q.toString()).toList() : const [],
      employer: e is Map<String, dynamic> ? Profile.fromJson(e) : null,
    );
  }
}

class PosStore {
  PosStore({required this.id, required this.name, required this.currency});
  final String id;
  final String name;
  final String currency;

  factory PosStore.fromJson(Map<String, dynamic> j) => PosStore(
        id: j["id"].toString(),
        name: (j["name"] ?? "Store").toString(),
        currency: (j["currency"] ?? "USD").toString(),
      );
}

class PosProduct {
  PosProduct({
    required this.id,
    required this.name,
    required this.price,
    this.sku,
    this.imagePath,
  });

  final String id;
  final String name;
  final double price;
  final String? sku;
  final String? imagePath;

  factory PosProduct.fromJson(Map<String, dynamic> j) => PosProduct(
        id: j["id"].toString(),
        name: (j["name"] ?? "").toString(),
        price: _d(j["price"]) ?? 0,
        sku: _s(j["sku"]),
        imagePath: _s(j["image_path"]),
      );
}

List<String> _sl(dynamic v) =>
    v is List ? v.map((e) => e.toString()).toList() : const [];

class Strain {
  Strain({
    required this.id,
    required this.name,
    required this.slug,
    required this.type,
    this.thc,
    this.cbd,
    this.effects = const [],
    this.flavors = const [],
    this.terpenes = const [],
    this.growDifficulty,
    this.floweringWeeks,
    this.yieldIndoor,
    this.yieldOutdoor,
    this.description,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String slug;
  final String type; // indica | sativa | hybrid
  final double? thc;
  final double? cbd;
  final List<String> effects;
  final List<String> flavors;
  final List<String> terpenes;
  final String? growDifficulty;
  final int? floweringWeeks;
  final String? yieldIndoor;
  final String? yieldOutdoor;
  final String? description;
  final String? imageUrl;

  factory Strain.fromJson(Map<String, dynamic> j) => Strain(
        id: j["id"].toString(),
        name: (j["name"] ?? "").toString(),
        slug: (j["slug"] ?? "").toString(),
        type: (j["type"] ?? "hybrid").toString(),
        thc: _d(j["thc"]),
        cbd: _d(j["cbd"]),
        effects: _sl(j["effects"]),
        flavors: _sl(j["flavors"]),
        terpenes: _sl(j["terpenes"]),
        growDifficulty: _s(j["grow_difficulty"]),
        floweringWeeks: j["flowering_weeks"] == null ? null : _i(j["flowering_weeks"]),
        yieldIndoor: _s(j["yield_indoor"]),
        yieldOutdoor: _s(j["yield_outdoor"]),
        description: _s(j["description"]),
        imageUrl: _s(j["image_url"]),
      );
}

class Mineral {
  Mineral({
    required this.id,
    required this.name,
    required this.category,
    this.symbol,
    this.hardnessMohs,
    this.density,
    this.uses = const [],
    this.description,
    this.imageUrl,
  });

  final String id;
  final String name;
  final String category;
  final String? symbol;
  final double? hardnessMohs;
  final double? density;
  final List<String> uses;
  final String? description;
  final String? imageUrl;

  factory Mineral.fromJson(Map<String, dynamic> j) => Mineral(
        id: j["id"].toString(),
        name: (j["name"] ?? "").toString(),
        category: (j["category"] ?? "").toString(),
        symbol: _s(j["symbol"]),
        hardnessMohs: _d(j["hardness_mohs"]),
        density: _d(j["density"]),
        uses: _sl(j["uses"]),
        description: _s(j["description"]),
        imageUrl: _s(j["image_url"]),
      );
}

class Group {
  Group({
    required this.id,
    required this.name,
    required this.slug,
    required this.privacy,
    required this.memberCount,
    this.description,
    this.coverUrl,
    this.isMember = false,
  });

  final String id;
  final String name;
  final String slug;
  final String privacy; // public | private
  final int memberCount;
  final String? description;
  final String? coverUrl;
  final bool isMember;

  factory Group.fromJson(Map<String, dynamic> j, {bool isMember = false}) =>
      Group(
        id: j["id"].toString(),
        name: (j["name"] ?? "Group").toString(),
        slug: (j["slug"] ?? "").toString(),
        privacy: (j["privacy"] ?? "public").toString(),
        memberCount: _i(j["member_count"]),
        description: _s(j["description"]),
        coverUrl: _s(j["cover_url"]),
        isMember: isMember,
      );
}

class Message {
  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    required this.createdAt,
    this.imagePath,
    this.filePath,
    this.fileKind,
    this.durationSeconds,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final DateTime createdAt;
  final String? imagePath;

  /// Attachment (web parity): file_kind 'audio' = voice message with
  /// duration_seconds; 'video'/'file' render as a link for now.
  final String? filePath;
  final String? fileKind;
  final int? durationSeconds;

  bool get isVoice => fileKind == "audio" && (filePath?.isNotEmpty ?? false);

  factory Message.fromJson(Map<String, dynamic> j) => Message(
        id: j["id"].toString(),
        conversationId: j["conversation_id"].toString(),
        senderId: j["sender_id"].toString(),
        content: (j["content"] ?? "").toString(),
        createdAt:
            DateTime.tryParse("${j["created_at"]}")?.toLocal() ?? DateTime.now(),
        imagePath: _s(j["image_path"]),
        filePath: _s(j["file_path"]),
        fileKind: _s(j["file_kind"]),
        durationSeconds: j["duration_seconds"] is num
            ? (j["duration_seconds"] as num).toInt()
            : null,
      );
}
