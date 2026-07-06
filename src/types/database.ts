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
  | "new_follower";

export type GroupPrivacy = "public" | "private";

export type StrainType = "indica" | "sativa" | "hybrid";

export type GroupMemberRole = "member" | "moderator" | "admin";

export type GroupMemberStatus = "pending" | "active";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
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

export interface CurrencyRate {
  code: string;
  rate_per_usd: number;
  updated_at: string;
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
      create_group_with_owner: {
        Args: {
          group_name: string;
          group_slug: string;
          group_description: string | null;
          group_privacy: GroupPrivacy;
        };
        Returns: string;
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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
