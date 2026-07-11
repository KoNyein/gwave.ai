"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  MessageCircle,
  SendHorizonal,
  X,
} from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import {
  markConversationRead,
  sendMessage,
} from "@/lib/actions/messages";
import { displayName } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";
import type {
  AuthorSummary,
  ConversationSummary,
  MessageWithSender,
} from "@/types/social";

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
 * Facebook-style floating chat. A round launcher docked bottom-right on every
 * page opens a compact conversation list; picking one opens a small chat popup
 * with realtime send/receive — without leaving the current page.
 */
export function ChatDock({ currentUser }: { currentUser: AuthorSummary }) {
  const pathname = usePathname();
  const [listOpen, setListOpen] = React.useState(false);
  const [conversations, setConversations] = React.useState<
    ConversationSummary[]
  >([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageWithSender[] | null>(
    null,
  );
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const activeIdRef = React.useRef(activeId);
  activeIdRef.current = activeId;
  const convRef = React.useRef(conversations);
  convRef.current = conversations;

  const loadConversations = React.useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const payload: { conversations: ConversationSummary[] } = await res.json();
    setConversations(payload.conversations);
  }, []);

  // Load the conversation list once the dock is first opened.
  React.useEffect(() => {
    if (listOpen && conversations.length === 0) void loadConversations();
  }, [listOpen, conversations.length, loadConversations]);

  // Load a thread when opened.
  React.useEffect(() => {
    if (!activeId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setMessages(null);
    fetch(`/api/messages?conversation=${activeId}`)
      .then((r) => r.json())
      .then((p: { messages?: MessageWithSender[] }) => {
        if (!cancelled) setMessages(p.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    void markConversationRead(activeId);
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unread: false } : c)),
    );
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Global realtime: incoming messages for this user.
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dock:${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const message = payload.new as Message;
          if (message.sender_id === currentUser.id) return;
          const known = convRef.current.find(
            (c) => c.id === message.conversation_id,
          );
          if (!known) {
            void loadConversations();
            return;
          }
          const isActive = activeIdRef.current === message.conversation_id;
          if (isActive) {
            const sender = peerOf(known, currentUser.id) ?? currentUser;
            setMessages((prev) =>
              prev && !prev.some((m) => m.id === message.id)
                ? [...prev, { ...message, sender }]
                : prev,
            );
            void markConversationRead(message.conversation_id);
          }
          setConversations((prev) =>
            prev
              .map((c) =>
                c.id === message.conversation_id
                  ? {
                      ...c,
                      last_message: message,
                      last_message_at: message.created_at,
                      unread: !isActive,
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUser, loadConversations]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, [messages]);

  async function send() {
    const content = input.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setInput("");
    const optimistic: MessageWithSender = {
      id: `o-${Date.now()}`,
      conversation_id: activeId,
      sender_id: currentUser.id,
      content,
      image_path: null,
      latitude: null,
      longitude: null,
      file_path: null,
      file_kind: null,
      file_name: null,
      created_at: new Date().toISOString(),
      sender: currentUser,
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    const res = await sendMessage({
      conversationId: activeId,
      content,
      imagePath: null,
    });
    setMessages((prev) => {
      if (!prev) return prev;
      if (!res.ok) return prev.filter((m) => m.id !== optimistic.id);
      return prev.map((m) =>
        m.id === optimistic.id ? { ...m, id: res.data.messageId } : m,
      );
    });
    void loadConversations();
    setSending(false);
  }

  // Don't duplicate the dock on the full messenger page.
  if (pathname?.startsWith("/messages")) return null;

  const unread = conversations.filter((c) => c.unread).length;
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const activePeer = active ? peerOf(active, currentUser.id) : null;

  return (
    <div className="fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2 md:bottom-4 md:right-4">
      {/* Open chat window */}
      {activeId && active ? (
        <div className="flex h-[26rem] w-[19rem] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
            {activePeer ? (
              <UserAvatar
                profile={activePeer}
                linked={false}
                className="h-7 w-7"
              />
            ) : null}
            <span className="flex-1 truncate text-sm font-semibold">
              {active.title ??
                (activePeer ? displayName(activePeer) : "Chat")}
            </span>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              aria-label="Minimise"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {messages === null ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                စကားစပြောလိုက်ပါ 👋
              </p>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === currentUser.id;
                return (
                  <div
                    key={m.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] overflow-hidden rounded-2xl",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted",
                      )}
                    >
                      {m.image_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(m.image_path)}
                          alt=""
                          loading="lazy"
                          className="max-h-40 w-full object-cover"
                        />
                      ) : null}
                      {m.content ? (
                        <p className="whitespace-pre-wrap break-words px-3 py-1.5 text-sm">
                          {m.content}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex items-center gap-2 border-t p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message…"
              maxLength={4000}
              className="flex-1 rounded-full bg-muted px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      ) : null}

      {/* Conversation list */}
      {listOpen && !activeId ? (
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
              conversations.map((c) => {
                const other = peerOf(c, currentUser.id);
                const preview =
                  c.last_message?.content ||
                  (c.last_message?.image_path ? "📷 ဓာတ်ပုံ" : "…");
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"
                  >
                    {other ? (
                      <UserAvatar profile={other} linked={false} className="h-9 w-9" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.title ?? (other ? displayName(other) : "Chat")}
                      </p>
                      <p
                        className={cn(
                          "truncate text-xs",
                          c.unread
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {preview}
                      </p>
                    </div>
                    {c.unread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => {
          if (activeId) {
            setActiveId(null);
            setListOpen(false);
          } else {
            setListOpen((v) => !v);
          }
        }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105"
        aria-label="Chat"
      >
        {listOpen || activeId ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
        {!listOpen && !activeId && unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
