export type UserRole =
  | "user"
  | "member"
  | "moderator"
  | "developer"
  | "admin"
  | "super_admin";

export type PostVisibility = "public" | "friends" | "only_me" | "members";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type PaymentProvider = "stripe" | "promptpay" | "manual";

export type PaymentStatus =
  | "awaiting_review"
  | "pending"
  | "succeeded"
  | "failed"
  | "rejected"
  | "refunded";

export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "post_reaction"
  | "post_comment"
  | "comment_reply"
  | "post_share"
  | "new_follower"
  | "device_alert";

export type DeviceType = "sensor" | "switch" | "camera" | "controller";

export type DeviceProtocol = "mqtt" | "http";

export type AlertSeverity = "info" | "warning" | "critical";

export type CommandStatus = "pending" | "sent" | "acked" | "failed";

export type StoreRole = "staff" | "manager";

export type PaymentMethod = "cash" | "card" | "qr" | "gpay";

export type SaleStatus = "completed" | "refunded";

export type StockReason = "sale" | "refund" | "adjustment" | "purchase";

export type ReportStatus = "pending" | "removed" | "dismissed";

export type WebhookEvent =
  | "post.created"
  | "sale.completed"
  | "alert.triggered";

export type GroupPrivacy = "public" | "private";

export type StrainType = "indica" | "sativa" | "hybrid";

export type GroupMemberRole = "member" | "moderator" | "admin";

export type GroupMemberStatus = "pending" | "active";

export type AgeBandDb = "child" | "preteen" | "teen" | "adult" | "unknown";

export type LessonStatus = "in_progress" | "completed";

export type LiveStreamStatus = "idle" | "live" | "ended";

export const LIVE_REACTION_EMOJIS = [
  "❤️",
  "👍",
  "😂",
  "😮",
  "👏",
  "🔥",
] as const;
export type LiveReactionEmoji = (typeof LIVE_REACTION_EMOJIS)[number];

export interface LiveStream {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  status: LiveStreamStatus;
  mux_stream_id: string | null;
  mux_playback_id: string | null;
  livekit_room: string | null;
  viewer_count: number;
  kind: "stream" | "class";
  track_slug: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export type TeacherApplicationStatus = "pending" | "approved" | "rejected";

export interface TeacherApplication {
  id: string;
  user_id: string;
  bio: string;
  subjects: string | null;
  status: TeacherApplicationStatus;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveStreamKey {
  stream_id: string;
  stream_key: string;
}

export interface LiveChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface LiveReaction {
  id: number;
  stream_id: string;
  user_id: string;
  emoji: LiveReactionEmoji;
  created_at: string;
}

export interface LessonProgress {
  user_id: string;
  track_slug: string;
  lesson_slug: string;
  status: LessonStatus;
  progress_pct: number;
  score: number | null;
  last_viewed_at: string;
  completed_at: string | null;
}

export interface MemberProject {
  id: string;
  user_id: string;
  track_slug: string;
  lesson_slug: string;
  kind: string;
  title: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export type GameStatus = "pending" | "approved" | "rejected";

export interface Game {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  emoji: string;
  code: string;
  status: GameStatus;
  review_note: string | null;
  plays_count: number;
  reactions_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export type GameReactionKind = "like" | "love" | "fun" | "interested" | "wow";

export interface GameComment {
  id: string;
  game_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface PostView {
  post_id: string;
  viewer_id: string;
  viewed_at: string;
}

export type ShopProductKind = "affiliate" | "dropship";
export type ShopProductStatus = "active" | "hidden";
export type ShopOrderStatus =
  | "pending"
  | "forwarded"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface ShopProduct {
  id: string;
  seller_id: string;
  kind: ShopProductKind;
  title: string;
  description: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  external_url: string | null;
  merchant: string | null;
  source_url: string | null;
  category: string | null;
  commission_rate: number | null;
  clicks_count: number;
  status: ShopProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ShopOrder {
  id: string;
  buyer_id: string;
  product_id: string | null;
  seller_id: string;
  quantity: number;
  unit_price: number;
  currency: string;
  status: ShopOrderStatus;
  ship_name: string;
  ship_phone: string;
  ship_address: string;
  note: string | null;
  courier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameCatalogItem {
  id: string;
  title: string;
  thumbnail_url: string;
  game_url: string;
  category: string;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CameraType = "webrtc" | "rtsp" | "kvs";

export interface UserCamera {
  id: string;
  owner_id: string;
  title: string;
  camera_type: CameraType;
  rtsp_url: string | null;
  // Public HLS (.m3u8) playback URL. Credential-free, safe to expose to viewers.
  hls_url: string | null;
  // Amazon KVS signaling channel name + region (kvs cameras). Not secret.
  kvs_channel: string | null;
  kvs_region: string | null;
  // Free-text room/area label for grouping. Not secret.
  zone: string | null;
  // Optional PTZ control endpoint. Server-side only (may carry credentials).
  ptz_url: string | null;
  stream_id: string;
  share_token: string;
  is_public: boolean;
  public_until: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseCategory =
  | "salary"
  | "rent"
  | "utility"
  | "tax"
  | "other";

export interface BusinessExpense {
  id: string;
  owner_id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  due_date: string | null;
  is_paid: boolean;
  paid_at: string | null;
  recurring: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyCircle {
  id: string;
  owner_id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface FamilyMembership {
  circle_id: string;
  user_id: string;
  sharing_enabled: boolean;
  joined_at: string;
}

export interface MemberLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  updated_at: string;
}

export type SosCategory =
  | "medical"
  | "disaster"
  | "conflict"
  | "fire"
  | "trapped"
  | "other";
export type SosStatus = "active" | "safe" | "resolved" | "cancelled";

export type SafetyStatus = "safe" | "need_help";

export interface SafetyCheckin {
  id: string;
  user_id: string;
  status: SafetyStatus;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface SosAlert {
  id: string;
  user_id: string;
  category: SosCategory;
  status: SosStatus;
  message: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export type GpayStatus = "pending" | "active" | "suspended" | "rejected";
export type GpayTxnKind = "transfer" | "topup" | "withdraw" | "fee";

export interface GpayAccount {
  id: string;
  user_id: string;
  status: GpayStatus;
  full_name: string;
  nrc_number: string;
  phone: string;
  email: string;
  telegram: string | null;
  viber: string | null;
  address: string;
  // Storage path (in the private "slips" bucket) of the KPay payment slip.
  slip_path: string | null;
  // Storage path (private "slips" bucket) of the KYC face-scan selfie.
  face_path: string | null;
  // Set the first time the account is approved; gates the one-time bonus.
  welcomed_at: string | null;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface GpayTransaction {
  id: string;
  kind: GpayTxnKind;
  from_account: string | null;
  to_account: string | null;
  amount: number;
  note: string | null;
  created_at: string;
}

export type WellnessKind = "dhamma" | "meditation" | "radio" | "health";

export type PresenceStatus =
  | "available"
  | "busy"
  | "away"
  | "sleep"
  | "invisible";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  presence_status: PresenceStatus;
  role: UserRole;
  suspended_until: string | null;
  suspend_reason: string | null;
  birth_date: string | null;
  is_teacher: boolean;
  // Opted in to earning play-money from reels.
  monetization_enabled: boolean;
  terms_accepted_version: string | null;
  privacy_accepted_version: string | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  track_slug: string;
  track_title: string;
  lessons_completed: number;
  issued_at: string;
}

export interface CohostRoom {
  id: string;
  code: string;
  host_id: string;
  title: string;
  created_at: string;
  ended_at: string | null;
}

export interface CohostGuest {
  room_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
}

export interface LiveGift {
  id: string;
  code: string;
  name: string;
  emoji: string;
  price_mmk: number;
  sort: number;
  is_active: boolean;
}

export interface Job {
  id: string;
  employer_id: string;
  title: string;
  category: string;
  employment_type:
    | "full_time"
    | "part_time"
    | "contract"
    | "internship"
    | "temporary"
    | "remote";
  company: string | null;
  location: string | null;
  description: string;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  contact: string | null;
  // Employer's custom application questions.
  questions: string[];
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  applicant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  cover_letter: string | null;
  expected_salary: number | null;
  experience_years: number | null;
  resume_url: string | null;
  // Answers to the job's custom questions.
  answers: { q: string; a: string }[];
  status: "submitted" | "shortlisted" | "rejected" | "hired";
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  post_id: string | null;
  comment_id: string | null;
  profile_id: string | null;
  reason: string;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Block {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface Consent {
  id: string;
  user_id: string;
  terms_version: string;
  privacy_version: string;
  guardian_email: string | null;
  guardian_consent: boolean;
  accepted_at: string;
  ip_note: string | null;
}

export interface DeletionRequest {
  user_id: string;
  reason: string | null;
  requested_at: string;
  status: "pending" | "processed" | "cancelled";
}

export interface WellnessItem {
  id: string;
  kind: WellnessKind;
  title: string;
  body: string | null;
  url: string | null;
  duration_minutes: number | null;
  position: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  owner_id: string;
  name: string;
  prefix: string;
  key_hash: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface ApiLog {
  id: number;
  api_key_id: string;
  endpoint: string;
  method: string;
  status: number;
  latency_ms: number | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  owner_id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  attempts: number;
  last_status: number | null;
  delivered_at: string | null;
  next_attempt_at: string;
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  visibility: PostVisibility;
  shared_post_id: string | null;
  group_id: string | null;
  page_id: string | null;
  reaction_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  privacy: GroupPrivacy;
  cover_url: string | null;
  owner_id: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  created_at: string;
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  owner_id: string;
  follower_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageFollower {
  page_id: string;
  user_id: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  title: string | null;
  direct_key: string | null;
  created_by: string | null;
  created_at: string;
  last_message_at: string;
}

export interface ConversationParticipant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_path: string | null;
  latitude: number | null;
  longitude: number | null;
  // Generic attachment in the "media" bucket: a video, an arbitrary file, or a
  // voice note. Voice notes carry duration_seconds and nothing else does.
  file_path: string | null;
  file_kind: "video" | "file" | "audio" | null;
  file_name: string | null;
  duration_seconds: number | null;
  /**
   * Set when latitude/longitude are the *start* of a live share rather than a
   * fixed pin. The moving position lives in live_locations, keyed by this
   * message; this is what tells the client to render the live map.
   */
  live_until: string | null;
  created_at: string;
}

/** The moving pin behind a live-location message. */
export interface LiveLocation {
  message_id: string;
  conversation_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  expires_at: string;
  stopped_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface Story {
  id: string;
  author_id: string;
  media_path: string;
  media_type: "image" | "video";
  text_overlay: string | null;
  created_at: string;
  expires_at: string;
}

export interface StoryView {
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

export interface Strain {
  id: string;
  name: string;
  slug: string;
  type: StrainType;
  thc: number | null;
  cbd: number | null;
  effects: string[];
  flavors: string[];
  terpenes: string[];
  grow_difficulty: "easy" | "moderate" | "hard" | null;
  flowering_weeks: number | null;
  yield_indoor: string | null;
  yield_outdoor: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  currency: string;
  features: Record<string, boolean | number | string>;
  stripe_price_id: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  provider: PaymentProvider;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  slip_path: string | null;
  stripe_payment_id: string | null;
  note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  number: string;
  user_id: string;
  payment_id: string | null;
  amount: number;
  currency: string;
  description: string | null;
  issued_at: string;
}

export interface Device {
  id: string;
  owner_id: string;
  name: string;
  type: DeviceType;
  protocol: DeviceProtocol;
  zone: string;
  topic: string;
  secret: string;
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  online: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface SensorReading {
  id: number;
  device_id: string;
  metric: string;
  value: number;
  ts: string;
}

export interface AutomationRule {
  id: string;
  owner_id: string;
  name: string;
  trigger_device_id: string;
  metric: string;
  comparator: "gt" | "gte" | "lt" | "lte";
  threshold: number;
  action_device_id: string | null;
  action: Record<string, unknown>;
  time_start: string | null;
  time_end: string | null;
  severity: AlertSeverity;
  cooldown_minutes: number;
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  owner_id: string;
  device_id: string | null;
  rule_id: string | null;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface Scene {
  id: string;
  owner_id: string;
  name: string;
  actions: { device_id: string; command: Record<string, unknown> }[];
  created_at: string;
}

export interface SceneSchedule {
  id: string;
  owner_id: string;
  scene_id: string;
  run_at: string;
  days_of_week: number[];
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  issued_by: string | null;
  command: Record<string, unknown>;
  status: CommandStatus;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  currency: string;
  receipt_footer: string | null;
  next_receipt_number: number;
  created_at: string;
  updated_at: string;
}

export interface StoreMember {
  store_id: string;
  user_id: string;
  role: StoreRole;
  created_at: string;
}

export interface PosCategory {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface PosProduct {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  cost: number | null;
  image_path: string | null;
  track_stock: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  product_id: string;
  quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  delta: number;
  reason: StockReason;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PosCustomer {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
}

export interface Shift {
  id: string;
  store_id: string;
  opened_by: string;
  opened_at: string;
  float_amount: number;
  cash_in: number;
  cash_out: number;
  closed_at: string | null;
  closed_by: string | null;
  expected_cash: number | null;
  actual_cash: number | null;
  note: string | null;
}

export interface Sale {
  id: string;
  store_id: string;
  shift_id: string | null;
  cashier_id: string | null;
  customer_id: string | null;
  receipt_number: number;
  subtotal: number;
  discount: number;
  total: number;
  status: SaleStatus;
  refunded_at: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
}

export interface CurrencyRate {
  code: string;
  rate_per_usd: number;
  name: string | null;
  symbol: string | null;
  kind: "fiat" | "crypto";
  decimals: number;
  flag: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface MineralDeposit {
  place: string;
  region: string;
  note?: string;
}

export interface MineralMyanmar {
  deposits?: MineralDeposit[];
  extraction?: string;
  transport?: string;
  notes?: string;
}

export interface Mineral {
  id: string;
  name: string;
  slug: string;
  symbol: string | null;
  category: string;
  hardness_mohs: number | null;
  density: number | null;
  properties: Record<string, string>;
  uses: string[];
  description: string | null;
  image_url: string | null;
  wikipedia_url: string | null;
  youtube_query: string | null;
  myanmar: MineralMyanmar;
  created_at: string;
  updated_at: string;
}

export interface PostMedia {
  id: string;
  post_id: string;
  media_type: "image" | "video";
  storage_path: string;
  width: number | null;
  height: number | null;
  position: number;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  content: string;
  reaction_count: number;
  reply_count: number;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reaction {
  id: string;
  user_id: string;
  post_id: string | null;
  comment_id: string | null;
  type: ReactionType;
  created_at: string;
}

export interface Share {
  id: string;
  original_post_id: string;
  share_post_id: string;
  user_id: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  read: boolean;
  created_at: string;
}

// ── Reels & creator monetization ────────────────────────────────────────────
export interface Reel {
  id: string;
  owner_id: string;
  video_path: string;
  poster_path: string | null;
  caption: string | null;
  view_count: number;
  like_count: number;
  watch_seconds: number;
  is_public: boolean;
  /** Creator confirmed it's their own original work → eligible to earn. */
  original_confirmed: boolean;
  created_at: string;
}

export type EarningKind = "view" | "like" | "watch" | "bonus";

export interface CreatorEarning {
  id: string;
  user_id: string;
  reel_id: string | null;
  kind: EarningKind;
  amount_mmk: number;
  paid_out: boolean;
  created_at: string;
}

/** A reel joined with its author + the caller's like state, for the feed. */
export interface ReelWithAuthor extends Reel {
  author: Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;
  video_url: string;
  liked_by_me: boolean;
}

export interface CreatorSummary {
  reelCount: number;
  totalViews: number;
  totalLikes: number;
  totalWatchSeconds: number;
  totalEarned: number;
  balance: number;
}

/** One time bucket (a day or a month) of creator analytics. */
export interface CreatorStatBucket {
  /** "YYYY-MM-DD" for daily, "YYYY-MM" for monthly. */
  period: string;
  views: number;
  likes: number;
  watchSeconds: number;
  earnings: number;
}

// ---------------------------------------------------------------------------
// Boosts (paid promotion / ads)
// ---------------------------------------------------------------------------

export type BoostTarget = "post" | "shop_product" | "pos_product";
export type BoostStatus =
  | "active"
  | "paused"
  | "completed"
  | "cancelled"
  | "rejected";

export interface Boost {
  id: string;
  owner_id: string;
  target_type: BoostTarget;
  target_id: string;
  headline: string | null;
  budget_mmk: number;
  spent_mmk: number;
  daily_cap_mmk: number;
  bid_mmk: number;
  audience: { adult?: boolean; region?: string | null; tags?: string[] };
  start_at: string;
  end_at: string;
  status: BoostStatus;
  impressions: number;
  reach: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

/** One eligible campaign row returned by the get_feed_boosts RPC. */
export interface BoostServeRow {
  id: string;
  owner_id: string;
  target_id: string;
  headline: string | null;
  bid_mmk: number;
  budget_mmk: number;
  spent_mmk: number;
  daily_cap_mmk: number;
  spent_today: number;
  impressions: number;
  clicks: number;
  start_at: string;
  end_at: string;
}

/** One day of a single campaign's performance (owner analytics). */
export interface BoostDailyStat {
  day: string;
  impressions: number;
  clicks: number;
  spent: number;
}

// ---------------------------------------------------------------------------
// Reviews & ratings
// ---------------------------------------------------------------------------

export type ReviewSubject = "profile" | "page" | "shop_product";

export interface Review {
  id: string;
  reviewer_id: string;
  subject_type: ReviewSubject;
  subject_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewStats {
  rating_count: number;
  rating_avg: number;
}

/** One ranked entry on the reviews leaderboard, with display info resolved. */
export interface LeaderboardEntry {
  subjectId: string;
  ratingCount: number;
  ratingAvg: number;
  score: number;
  title: string;
  image: string | null;
  href: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          bio?: string | null;
          role?: UserRole;
          birth_date?: string | null;
          terms_accepted_version?: string | null;
          privacy_accepted_version?: string | null;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          bio?: string | null;
          role?: UserRole;
          suspended_until?: string | null;
          suspend_reason?: string | null;
          birth_date?: string | null;
          terms_accepted_version?: string | null;
          privacy_accepted_version?: string | null;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: {
          id?: string;
          reporter_id: string;
          post_id?: string | null;
          comment_id?: string | null;
          profile_id?: string | null;
          reason: string;
          status?: ReportStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Report>;
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      live_streams: {
        Row: LiveStream;
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          description?: string | null;
          status?: LiveStreamStatus;
          mux_stream_id: string;
          mux_playback_id?: string | null;
          viewer_count?: number;
          kind?: "stream" | "class";
          track_slug?: string | null;
          scheduled_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: Partial<LiveStream>;
        Relationships: [
          {
            foreignKeyName: "live_streams_host_id_fkey";
            columns: ["host_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_applications: {
        Row: TeacherApplication;
        Insert: {
          id?: string;
          user_id: string;
          bio: string;
          subjects?: string | null;
          status?: TeacherApplicationStatus;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<TeacherApplication>;
        Relationships: [
          {
            foreignKeyName: "teacher_applications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      live_stream_keys: {
        Row: LiveStreamKey;
        Insert: LiveStreamKey;
        Update: Partial<LiveStreamKey>;
        Relationships: [
          {
            foreignKeyName: "live_stream_keys_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: true;
            referencedRelation: "live_streams";
            referencedColumns: ["id"];
          },
        ];
      };
      live_chat_messages: {
        Row: LiveChatMessage;
        Insert: {
          id?: string;
          stream_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<LiveChatMessage>;
        Relationships: [
          {
            foreignKeyName: "live_chat_messages_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "live_streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_chat_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      live_reactions: {
        Row: LiveReaction;
        Insert: {
          id?: number;
          stream_id: string;
          user_id: string;
          emoji: LiveReactionEmoji;
          created_at?: string;
        };
        Update: Partial<LiveReaction>;
        Relationships: [
          {
            foreignKeyName: "live_reactions_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "live_streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: LessonProgress;
        Insert: {
          user_id: string;
          track_slug: string;
          lesson_slug: string;
          status?: LessonStatus;
          progress_pct?: number;
          score?: number | null;
          last_viewed_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<LessonProgress>;
        Relationships: [
          {
            foreignKeyName: "lesson_progress_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      member_projects: {
        Row: MemberProject;
        Insert: {
          id?: string;
          user_id: string;
          track_slug: string;
          lesson_slug: string;
          kind: string;
          title: string;
          data?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: Partial<MemberProject>;
        Relationships: [
          {
            foreignKeyName: "member_projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: Block;
        Insert: {
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: Partial<Block>;
        Relationships: [
          {
            foreignKeyName: "blocks_blocker_id_fkey";
            columns: ["blocker_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blocks_blocked_id_fkey";
            columns: ["blocked_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: Consent;
        Insert: {
          id?: string;
          user_id: string;
          terms_version: string;
          privacy_version: string;
          guardian_email?: string | null;
          guardian_consent?: boolean;
          accepted_at?: string;
          ip_note?: string | null;
        };
        Update: Partial<Consent>;
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      deletion_requests: {
        Row: DeletionRequest;
        Insert: {
          user_id: string;
          reason?: string | null;
          requested_at?: string;
          status?: "pending" | "processed" | "cancelled";
        };
        Update: Partial<DeletionRequest>;
        Relationships: [
          {
            foreignKeyName: "deletion_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wellness_items: {
        Row: WellnessItem;
        Insert: {
          id?: string;
          kind: WellnessKind;
          title: string;
          body?: string | null;
          url?: string | null;
          duration_minutes?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: Partial<WellnessItem>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLog;
        Insert: {
          id?: number;
          actor_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          detail?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<AuditLog>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_settings: {
        Row: SiteSetting;
        Insert: {
          key: string;
          value?: Record<string, unknown>;
          updated_at?: string;
        };
        Update: Partial<SiteSetting>;
        Relationships: [];
      };
      feature_flags: {
        Row: FeatureFlag;
        Insert: {
          key: string;
          enabled?: boolean;
          description?: string | null;
          updated_at?: string;
        };
        Update: Partial<FeatureFlag>;
        Relationships: [];
      };
      api_keys: {
        Row: ApiKey;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          prefix: string;
          key_hash: string;
          scopes?: string[];
          rate_limit?: number;
          last_used_at?: string | null;
          revoked?: boolean;
          created_at?: string;
        };
        Update: Partial<ApiKey>;
        Relationships: [
          {
            foreignKeyName: "api_keys_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_logs: {
        Row: ApiLog;
        Insert: {
          id?: number;
          api_key_id: string;
          endpoint: string;
          method: string;
          status: number;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: Partial<ApiLog>;
        Relationships: [
          {
            foreignKeyName: "api_logs_api_key_id_fkey";
            columns: ["api_key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      webhooks: {
        Row: Webhook;
        Insert: {
          id?: string;
          owner_id: string;
          url: string;
          events?: WebhookEvent[];
          secret: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Webhook>;
        Relationships: [
          {
            foreignKeyName: "webhooks_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: WebhookDelivery;
        Insert: {
          id?: string;
          webhook_id: string;
          event: WebhookEvent;
          payload: Record<string, unknown>;
          attempts?: number;
          last_status?: number | null;
          delivered_at?: string | null;
          next_attempt_at?: string;
          created_at?: string;
        };
        Update: Partial<WebhookDelivery>;
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: false;
            referencedRelation: "webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: Post;
        Insert: {
          id?: string;
          author_id: string;
          content?: string;
          visibility?: PostVisibility;
          shared_post_id?: string | null;
          group_id?: string | null;
          page_id?: string | null;
          reaction_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
          location_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content?: string;
          visibility?: PostVisibility;
          shared_post_id?: string | null;
          group_id?: string | null;
          page_id?: string | null;
          reaction_count?: number;
          comment_count?: number;
          share_count?: number;
          view_count?: number;
          location_name?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_shared_post_id_fkey";
            columns: ["shared_post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_views: {
        Row: PostView;
        Insert: {
          post_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: Partial<PostView>;
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: Game;
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          description?: string | null;
          emoji?: string;
          code: string;
          status?: GameStatus;
          review_note?: string | null;
          plays_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Game>;
        Relationships: [
          {
            foreignKeyName: "games_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: PostMedia;
        Insert: {
          id?: string;
          post_id: string;
          media_type: "image" | "video";
          storage_path: string;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          media_type?: "image" | "video";
          storage_path?: string;
          width?: number | null;
          height?: number | null;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: Comment;
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          content: string;
          reaction_count?: number;
          reply_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          parent_id?: string | null;
          content?: string;
          reaction_count?: number;
          reply_count?: number;
          removed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      reactions: {
        Row: Reaction;
        Insert: {
          id?: string;
          user_id: string;
          post_id?: string | null;
          comment_id?: string | null;
          type: ReactionType;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string | null;
          comment_id?: string | null;
          type?: ReactionType;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      shares: {
        Row: Share;
        Insert: {
          id?: string;
          original_post_id: string;
          share_post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_post_id?: string;
          share_post_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shares_original_post_id_fkey";
            columns: ["original_post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shares_share_post_id_fkey";
            columns: ["share_post_id"];
            isOneToOne: true;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      friendships: {
        Row: Friendship;
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "friendships_requester_id_fkey";
            columns: ["requester_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey";
            columns: ["addressee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows: {
        Row: Follow;
        Insert: {
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: {
          follower_id?: string;
          followee_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_followee_id_fkey";
            columns: ["followee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: Notification;
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type: NotificationType;
          post_id?: string | null;
          comment_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          type?: NotificationType;
          post_id?: string | null;
          comment_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: Group;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          privacy?: GroupPrivacy;
          cover_url?: string | null;
          owner_id: string;
          member_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Group>;
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: GroupMember;
        Insert: {
          group_id: string;
          user_id: string;
          role?: GroupMemberRole;
          status?: GroupMemberStatus;
          created_at?: string;
        };
        Update: Partial<GroupMember>;
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: Page;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          category?: string | null;
          description?: string | null;
          avatar_url?: string | null;
          cover_url?: string | null;
          owner_id: string;
          follower_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Page>;
        Relationships: [
          {
            foreignKeyName: "pages_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      page_followers: {
        Row: PageFollower;
        Insert: {
          page_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<PageFollower>;
        Relationships: [
          {
            foreignKeyName: "page_followers_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_followers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          is_group?: boolean;
          title?: string | null;
          direct_key?: string | null;
          created_by?: string | null;
          created_at?: string;
          last_message_at?: string;
        };
        Update: Partial<Conversation>;
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: {
          conversation_id: string;
          user_id: string;
          joined_at?: string;
          last_read_at?: string;
        };
        Update: Partial<ConversationParticipant>;
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string;
          image_path?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
        };
        Update: Partial<Message>;
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stories: {
        Row: Story;
        Insert: {
          id?: string;
          author_id: string;
          media_path: string;
          media_type?: "image" | "video";
          text_overlay?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: Partial<Story>;
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      story_views: {
        Row: StoryView;
        Insert: {
          story_id: string;
          viewer_id: string;
          viewed_at?: string;
        };
        Update: Partial<StoryView>;
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey";
            columns: ["viewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      devices: {
        Row: Device;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          type: DeviceType;
          protocol?: DeviceProtocol;
          zone?: string;
          topic: string;
          secret: string;
          config?: Record<string, unknown>;
          state?: Record<string, unknown>;
          online?: boolean;
          last_seen?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Device>;
        Relationships: [
          {
            foreignKeyName: "devices_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sensor_readings: {
        Row: SensorReading;
        Insert: {
          id?: number;
          device_id: string;
          metric: string;
          value: number;
          ts?: string;
        };
        Update: Partial<SensorReading>;
        Relationships: [
          {
            foreignKeyName: "sensor_readings_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_rules: {
        Row: AutomationRule;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          trigger_device_id: string;
          metric: string;
          comparator: "gt" | "gte" | "lt" | "lte";
          threshold: number;
          action_device_id?: string | null;
          action?: Record<string, unknown>;
          time_start?: string | null;
          time_end?: string | null;
          severity?: AlertSeverity;
          cooldown_minutes?: number;
          enabled?: boolean;
          last_triggered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<AutomationRule>;
        Relationships: [
          {
            foreignKeyName: "automation_rules_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_rules_trigger_device_id_fkey";
            columns: ["trigger_device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_rules_action_device_id_fkey";
            columns: ["action_device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
        ];
      };
      alerts: {
        Row: Alert;
        Insert: {
          id?: string;
          owner_id: string;
          device_id?: string | null;
          rule_id?: string | null;
          severity?: AlertSeverity;
          message: string;
          acknowledged?: boolean;
          created_at?: string;
        };
        Update: Partial<Alert>;
        Relationships: [
          {
            foreignKeyName: "alerts_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "automation_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      scenes: {
        Row: Scene;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          actions?: { device_id: string; command: Record<string, unknown> }[];
          created_at?: string;
        };
        Update: Partial<Scene>;
        Relationships: [
          {
            foreignKeyName: "scenes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      scene_schedules: {
        Row: SceneSchedule;
        Insert: {
          id?: string;
          owner_id: string;
          scene_id: string;
          run_at: string;
          days_of_week?: number[];
          enabled?: boolean;
          last_run_at?: string | null;
          created_at?: string;
        };
        Update: Partial<SceneSchedule>;
        Relationships: [
          {
            foreignKeyName: "scene_schedules_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scene_schedules_scene_id_fkey";
            columns: ["scene_id"];
            isOneToOne: false;
            referencedRelation: "scenes";
            referencedColumns: ["id"];
          },
        ];
      };
      device_commands: {
        Row: DeviceCommand;
        Insert: {
          id?: string;
          device_id: string;
          issued_by?: string | null;
          command: Record<string, unknown>;
          status?: CommandStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<DeviceCommand>;
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "device_commands_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: Store;
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          currency?: string;
          receipt_footer?: string | null;
          next_receipt_number?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Store>;
        Relationships: [
          {
            foreignKeyName: "stores_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      store_members: {
        Row: StoreMember;
        Insert: {
          store_id: string;
          user_id: string;
          role?: StoreRole;
          created_at?: string;
        };
        Update: Partial<StoreMember>;
        Relationships: [
          {
            foreignKeyName: "store_members_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_categories: {
        Row: PosCategory;
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<PosCategory>;
        Relationships: [
          {
            foreignKeyName: "pos_categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_products: {
        Row: PosProduct;
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          name: string;
          sku?: string | null;
          barcode?: string | null;
          price: number;
          cost?: number | null;
          image_path?: string | null;
          track_stock?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<PosProduct>;
        Relationships: [
          {
            foreignKeyName: "pos_products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "pos_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: Inventory;
        Insert: {
          product_id: string;
          quantity?: number;
          low_stock_threshold?: number;
          updated_at?: string;
        };
        Update: Partial<Inventory>;
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "pos_products";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: StockMovement;
        Insert: {
          id?: string;
          product_id: string;
          delta: number;
          reason: StockReason;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<StockMovement>;
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "pos_products";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_customers: {
        Row: PosCustomer;
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<PosCustomer>;
        Relationships: [
          {
            foreignKeyName: "pos_customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: Shift;
        Insert: {
          id?: string;
          store_id: string;
          opened_by: string;
          opened_at?: string;
          float_amount?: number;
          cash_in?: number;
          cash_out?: number;
          closed_at?: string | null;
          closed_by?: string | null;
          expected_cash?: number | null;
          actual_cash?: number | null;
          note?: string | null;
        };
        Update: Partial<Shift>;
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: Sale;
        Insert: {
          id?: string;
          store_id: string;
          shift_id?: string | null;
          cashier_id?: string | null;
          customer_id?: string | null;
          receipt_number: number;
          subtotal: number;
          discount?: number;
          total: number;
          status?: SaleStatus;
          refunded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Sale>;
        Relationships: [
          {
            foreignKeyName: "sales_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_shift_id_fkey";
            columns: ["shift_id"];
            isOneToOne: false;
            referencedRelation: "shifts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "pos_customers";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_items: {
        Row: SaleItem;
        Insert: {
          id?: string;
          sale_id: string;
          product_id?: string | null;
          name: string;
          price: number;
          quantity: number;
          discount?: number;
          total: number;
        };
        Update: Partial<SaleItem>;
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sale_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "pos_products";
            referencedColumns: ["id"];
          },
        ];
      };
      sale_payments: {
        Row: SalePayment;
        Insert: {
          id?: string;
          sale_id: string;
          method: PaymentMethod;
          amount: number;
        };
        Update: Partial<SalePayment>;
        Relationships: [
          {
            foreignKeyName: "sale_payments_sale_id_fkey";
            columns: ["sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["id"];
          },
        ];
      };
      currency_rates: {
        Row: CurrencyRate;
        Insert: {
          code: string;
          rate_per_usd: number;
          updated_at?: string;
        };
        Update: Partial<CurrencyRate>;
        Relationships: [];
      };
      membership_plans: {
        Row: MembershipPlan;
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          price_monthly?: number;
          currency?: string;
          features?: Record<string, boolean | number | string>;
          stripe_price_id?: string | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<MembershipPlan>;
        Relationships: [];
      };
      subscriptions: {
        Row: Subscription;
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: SubscriptionStatus;
          provider: PaymentProvider;
          current_period_start?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          stripe_subscription_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Subscription>;
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "membership_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: Payment;
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          provider: PaymentProvider;
          status?: PaymentStatus;
          amount: number;
          currency?: string;
          slip_path?: string | null;
          stripe_payment_id?: string | null;
          note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Payment>;
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: Invoice;
        Insert: {
          id?: string;
          number: string;
          user_id: string;
          payment_id?: string | null;
          amount: number;
          currency?: string;
          description?: string | null;
          issued_at?: string;
        };
        Update: Partial<Invoice>;
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      strains: {
        Row: Strain;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          type: StrainType;
          thc?: number | null;
          cbd?: number | null;
          effects?: string[];
          flavors?: string[];
          terpenes?: string[];
          grow_difficulty?: "easy" | "moderate" | "hard" | null;
          flowering_weeks?: number | null;
          yield_indoor?: string | null;
          yield_outdoor?: string | null;
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Strain>;
        Relationships: [];
      };
      minerals: {
        Row: Mineral;
        Insert: {
          id?: string;
          name: string;
          slug: string;
          symbol?: string | null;
          category: string;
          hardness_mohs?: number | null;
          density?: number | null;
          properties?: Record<string, string>;
          uses?: string[];
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Mineral>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      are_friends: {
        Args: { user_a: string; user_b: string };
        Returns: boolean;
      };
      can_view_post: {
        Args: { post_author: string; post_vis: PostVisibility };
        Returns: boolean;
      };
      can_view_post_id: {
        Args: { pid: string };
        Returns: boolean;
      };
      is_group_member: {
        Args: { gid: string };
        Returns: boolean;
      };
      is_group_admin: {
        Args: { gid: string };
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: { cid: string };
        Returns: boolean;
      };
      get_or_create_direct_conversation: {
        Args: { other_user: string };
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_member_user: {
        Args: { uid: string };
        Returns: boolean;
      };
      is_store_member: {
        Args: { sid: string };
        Returns: boolean;
      };
      is_moderator: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_developer: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_suspended: {
        Args: { uid: string };
        Returns: boolean;
      };
      enqueue_webhook: {
        Args: { p_event: WebhookEvent; p_owner: string; p_payload: unknown };
        Returns: undefined;
      };
      is_store_manager: {
        Args: { sid: string };
        Returns: boolean;
      };
      create_sale: {
        Args: {
          p_store_id: string;
          p_items: unknown;
          p_payments: unknown;
          p_cart_discount?: number;
          p_customer_id?: string | null;
        };
        Returns: { sale_id: string; receipt_number: number }[];
      };
      refund_sale: {
        Args: { p_sale_id: string };
        Returns: undefined;
      };
      latest_sensor_readings: {
        Args: Record<string, never>;
        Returns: {
          device_id: string;
          metric: string;
          value: number;
          ts: string;
        }[];
      };
      create_group_with_owner: {
        Args: {
          group_name: string;
          group_slug: string;
          group_description: string | null;
          group_privacy: GroupPrivacy;
        };
        Returns: string;
      };
      is_blocked: {
        Args: { a: string; b: string };
        Returns: boolean;
      };
      age_band_of: {
        Args: { bd: string | null };
        Returns: AgeBandDb;
      };
      is_adult: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_minor: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      my_age_band: {
        Args: Record<string, never>;
        Returns: AgeBandDb;
      };
      record_game_play: {
        Args: { gid: string };
        Returns: undefined;
      };
      learning_points: {
        Args: { uid: string };
        Returns: number;
      };
    };
    Enums: {
      user_role: UserRole;
      post_visibility: PostVisibility;
      reaction_type: ReactionType;
      friendship_status: FriendshipStatus;
      notification_type: NotificationType;
      group_privacy: GroupPrivacy;
      group_member_role: GroupMemberRole;
      group_member_status: GroupMemberStatus;
      strain_type: StrainType;
      subscription_status: SubscriptionStatus;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
      device_type: DeviceType;
      device_protocol: DeviceProtocol;
      alert_severity: AlertSeverity;
      command_status: CommandStatus;
      store_role: StoreRole;
      payment_method: PaymentMethod;
      sale_status: SaleStatus;
      stock_reason: StockReason;
      report_status: ReportStatus;
      webhook_event: WebhookEvent;
      age_band: AgeBandDb;
      wellness_kind: WellnessKind;
      lesson_status: LessonStatus;
      live_stream_status: LiveStreamStatus;
      game_status: GameStatus;
      shop_product_kind: ShopProductKind;
      shop_product_status: ShopProductStatus;
      shop_order_status: ShopOrderStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
