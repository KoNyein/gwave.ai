"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Navigation, X } from "lucide-react";

import { ChatBox, summarise } from "@/components/messenger/chat-box";
import { useLiveLocationShare } from "@/components/messenger/use-live-location-share";
import { UserAvatar } from "@/components/social/user-avatar";
import { markConversationRead, sendMessage } from "@/lib/actions/messages";
import { displayName } from "@/lib/format";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";
import type {
  AuthorSummary,
  ConversationSummary,
  MessageWithSender,
} from "@/types/social";

/**
 * How many conversations can be open at once. Four 19rem boxes plus the
 * launcher is about what a 1280px screen holds; beyond that they'd overlap the
 * page. Opening a fifth closes the one you touched least recently.
 */
const MAX_OPEN = 4;

function peerOf(
  conversation: ConversationSummary,
  viewerId: string,
): AuthorSummary | null {
  return (
    conversation.participants.find((p) => p.user_id !== viewerId)?.profile ??
    null
  );
}

/**
 * Facebook-style floating chat, docked bottom-right on every page.
 *
 * Several conversations stay open side by side, each its own box with its own
 * thread and input — talk to three people at once without leaving the page. A
 * message from someone you don't have open pops their box up (collapsed, with an
 * unread count, so it never steals what you're typing). Which boxes are open is
 * persisted, so it survives a reload.
 */
export function ChatDock({ currentUser }: { currentUser: AuthorSummary }) {
  const pathname = usePathname();
  const [listOpen, setListOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<
    ConversationSummary[]
  >([]);
  // Most-recently-focused last: that's the one that survives on a phone, and
  // the one dropped when a fifth box opens is the head of this list.
  const [openIds, setOpenIds] = usePersistentState<string[]>(
    "gw:chat-open",
    [],
  );
  const [minimized, setMinimized] = usePersistentState<string[]>(
    "gw:chat-minimized",
    [],
  );
  const [threads, setThreads] = React.useState<
    Record<string, MessageWithSender[] | null>
  >({});

  const conversationsRef = React.useRef(conversations);
  conversationsRef.current = conversations;
  const openIdsRef = React.useRef(openIds);
  openIdsRef.current = openIds;
  const minimizedRef = React.useRef(minimized);
  minimizedRef.current = minimized;
  // Which threads we've already fetched. A ref, not a dep: `threads` changes on
  // every message, and hanging openChat's identity off it tore down and re-joined
  // the realtime channel on each one — any message landing in the re-join window
  // was lost.
  const loadedRef = React.useRef<Set<string>>(new Set());

  // The full messenger owns the conversation on /messages: keep this one inert
  // there rather than running a second realtime subscription, re-fetching every
  // thread, and — worst — marking conversations read from a dock nobody can see.
  const inert = Boolean(pathname?.startsWith("/messages"));

  // Live location keeps running wherever you are. The watcher used to live only
  // in the full messenger, so navigating to any other page silently killed the
  // share while everyone watching still saw a pulsing LIVE badge. On /messages
  // the messenger drives it, so stand down there.
  const liveShare = useLiveLocationShare(undefined, !inert);

  const loadConversations = React.useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (!response.ok) return;
    const payload: { conversations: ConversationSummary[] } =
      await response.json();
    setConversations(payload.conversations);
  }, []);

  // The dock needs the list up front now, not on first click: a box can pop up
  // on its own when a message lands, and it needs the peer's name and avatar.
  React.useEffect(() => {
    if (inert) return;
    void loadConversations();
  }, [loadConversations, inert]);

  const loadThread = React.useCallback(async (conversationId: string) => {
    loadedRef.current.add(conversationId);
    setThreads((previous) =>
      conversationId in previous
        ? previous
        : { ...previous, [conversationId]: null },
    );
    const response = await fetch(`/api/messages?conversation=${conversationId}`);
    const payload: { messages?: MessageWithSender[] } = await response
      .json()
      .catch(() => ({}));
    const fetched = payload.messages ?? [];
    setThreads((previous) => {
      // Anything sent (or received) while the fetch was in flight isn't in the
      // snapshot — overwriting the slot outright made a just-sent message vanish.
      const pending = (previous[conversationId] ?? []).filter(
        (m) => !fetched.some((f) => f.id === m.id),
      );
      return { ...previous, [conversationId]: [...fetched, ...pending] };
    });
  }, []);

  const openChat = React.useCallback(
    (conversationId: string, collapsed = false) => {
      setOpenIds((previous) => {
        const next = [
          ...previous.filter((id) => id !== conversationId),
          conversationId,
        ];
        const kept = next.slice(-MAX_OPEN);
        // Whatever got evicted must not linger in `minimized` forever.
        const dropped = next.filter((id) => !kept.includes(id));
        if (dropped.length > 0) {
          setMinimized((mins) => mins.filter((id) => !dropped.includes(id)));
        }
        return kept;
      });
      setMinimized((previous) =>
        collapsed
          ? previous.includes(conversationId)
            ? previous
            : [...previous, conversationId]
          : previous.filter((id) => id !== conversationId),
      );
      setListOpen(false);
      if (!loadedRef.current.has(conversationId)) void loadThread(conversationId);
      if (!collapsed) {
        void markConversationRead(conversationId);
        setConversations((previous) =>
          previous.map((c) =>
            c.id === conversationId ? { ...c, unread: false } : c,
          ),
        );
      }
    },
    [loadThread, setMinimized, setOpenIds],
  );

  const closeChat = React.useCallback(
    (conversationId: string) => {
      setOpenIds((previous) => previous.filter((id) => id !== conversationId));
      setMinimized((previous) =>
        previous.filter((id) => id !== conversationId),
      );
    },
    [setMinimized, setOpenIds],
  );

  // Restore threads for boxes that a reload brought back.
  React.useEffect(() => {
    if (inert) return;
    for (const id of openIds) {
      if (!loadedRef.current.has(id)) void loadThread(id);
    }
  }, [openIds, loadThread, inert]);

  // Global realtime: every message this user can see.
  React.useEffect(() => {
    if (inert) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dock:${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          if (message.sender_id === currentUser.id) return;

          const known = conversationsRef.current.find(
            (c) => c.id === message.conversation_id,
          );
          if (!known) {
            // A brand-new conversation: fetch it, then pop it up collapsed.
            void loadConversations().then(() =>
              openChat(message.conversation_id, true),
            );
            return;
          }

          const isOpen = openIdsRef.current.includes(message.conversation_id);
          const isCollapsed = minimizedRef.current.includes(
            message.conversation_id,
          );
          const reading = isOpen && !isCollapsed;

          if (reading) {
            const sender = peerOf(known, currentUser.id) ?? currentUser;
            setThreads((previous) => {
              const thread = previous[message.conversation_id];
              if (!thread || thread.some((m) => m.id === message.id)) {
                return previous;
              }
              return {
                ...previous,
                [message.conversation_id]: [...thread, { ...message, sender }],
              };
            });
            void markConversationRead(message.conversation_id);
          } else if (!isOpen) {
            // Someone new is talking to you — open their box, collapsed, so it
            // announces itself without hijacking a box you're typing in.
            openChat(message.conversation_id, true);
          }

          setConversations((previous) =>
            previous
              .map((c) =>
                c.id === message.conversation_id
                  ? {
                      ...c,
                      last_message: message,
                      last_message_at: message.created_at,
                      unread: !reading,
                    }
                  : c,
              )
              .sort(
                (a, b) =>
                  new Date(b.last_message_at).getTime() -
                  new Date(a.last_message_at).getTime(),
              ),
          );
        },
      )
      .subscribe((status) => {
        // postgres_changes does not replay what was missed while the socket was
        // down (sleep, tunnel, tab suspended). Re-read the list on every (re)join
        // so a reconnect can't leave the dock quietly stale.
        if (status === "SUBSCRIBED") void loadConversations();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser, loadConversations, openChat, inert]);

  async function send(conversationId: string, content: string) {
    const optimistic: MessageWithSender = {
      id: `o-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUser.id,
      content,
      image_path: null,
      latitude: null,
      longitude: null,
      file_path: null,
      file_kind: null,
      file_name: null,
      duration_seconds: null,
      live_until: null,
      created_at: new Date().toISOString(),
      sender: currentUser,
    };
    setThreads((previous) => ({
      ...previous,
      [conversationId]: [...(previous[conversationId] ?? []), optimistic],
    }));

    const result = await sendMessage({
      conversationId,
      content,
      imagePath: null,
    });
    setThreads((previous) => {
      const thread = previous[conversationId];
      if (!thread) return previous;
      return {
        ...previous,
        [conversationId]: result.ok
          ? thread.map((m) =>
              m.id === optimistic.id ? { ...m, id: result.data.messageId } : m,
            )
          : thread.filter((m) => m.id !== optimistic.id),
      };
    });
    void loadConversations();
  }

  // Don't duplicate the dock on the full messenger page.
  if (inert) return null;

  const unreadTotal = conversations.filter((c) => c.unread).length;
  const openConversations = openIds
    .map((id) => conversations.find((c) => c.id === id))
    .filter((c): c is ConversationSummary => Boolean(c));

  // bottom-16 clears the mobile bottom nav; on desktop the boxes sit on the very
  // edge, the way a docked chat window should.
  return (
    <div
      data-no-print
      className="pointer-events-none fixed bottom-16 right-3 z-40 flex items-end gap-3 md:bottom-0 md:right-4"
    >
      {/* Open conversations, newest nearest the launcher. On a phone there's
          only room for one, so all but the most recent stay hidden. */}
      {openConversations.map((conversation, index) => {
        const collapsed = minimized.includes(conversation.id);
        const other = peerOf(conversation, currentUser.id);
        const isLast = index === openConversations.length - 1;
        return (
          <div
            key={conversation.id}
            className={cn("mb-0", !isLast && "hidden sm:block")}
          >
            <ChatBox
              conversationId={conversation.id}
              currentUserId={currentUser.id}
              title={
                conversation.title ?? (other ? displayName(other) : "Chat")
              }
              peer={other}
              messages={threads[conversation.id] ?? null}
              minimized={collapsed}
              unread={conversation.unread ? 1 : 0}
              onSend={(content) => send(conversation.id, content)}
              onClose={() => closeChat(conversation.id)}
              onToggleMinimize={() =>
                collapsed
                  ? openChat(conversation.id)
                  : setMinimized((previous) => [...previous, conversation.id])
              }
              onFocus={() => {
                if (conversation.unread) openChat(conversation.id);
              }}
            />
          </div>
        );
      })}

      {/* Sharing your location follows you across the whole app, so the way to
          stop it has to as well. */}
      {liveShare.share ? (
        <div className="pointer-events-auto mb-3 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-lg md:mb-4">
          <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
          <Navigation className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="whitespace-nowrap">
            {Math.max(
              0,
              Math.round(
                (new Date(liveShare.share.expiresAt).getTime() - Date.now()) /
                  60_000,
              ),
            )}{" "}
            min
          </span>
          <button
            type="button"
            onClick={() => void liveShare.stop()}
            className="rounded-full bg-destructive px-2 py-0.5 font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Stop
          </button>
        </div>
      ) : null}

      {/* Conversation list + launcher */}
      <div className="pointer-events-auto mb-3 flex flex-col items-end gap-2 md:mb-4">
        {listOpen ? (
          <div className="flex max-h-[26rem] w-[19rem] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b bg-card px-3 py-2">
              <span className="text-sm font-bold">Chats</span>
              <Link
                href="/messages"
                className="text-xs text-primary hover:underline"
                onClick={() => setListOpen(false)}
              >
                အားလုံးကြည့်
              </Link>
            </div>
            <div className="overflow-y-auto p-1.5">
              {conversations.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  စကားပြောဆိုမှု မရှိသေးပါ။
                </p>
              ) : (
                conversations.map((conversation) => {
                  const other = peerOf(conversation, currentUser.id);
                  const last = conversation.last_message;
                  const preview =
                    last?.content ||
                    (last?.image_path
                      ? "📷 ဓာတ်ပုံ"
                      : (last ? summarise(last as MessageWithSender) : null) ??
                        "…");
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openChat(conversation.id)}
                      className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"
                    >
                      {other ? (
                        <UserAvatar
                          profile={other}
                          linked={false}
                          className="h-9 w-9"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {conversation.title ??
                            (other ? displayName(other) : "Chat")}
                        </p>
                        <p
                          className={cn(
                            "truncate text-xs",
                            conversation.unread
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {preview}
                        </p>
                      </div>
                      {conversation.unread ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-label="Chat"
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
        >
          {listOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
          {!listOpen && unreadTotal > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
