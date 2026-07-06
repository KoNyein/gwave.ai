"use client";

import * as React from "react";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  MessageCircle,
  SendHorizonal,
  SquarePen,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markConversationRead,
  openDirectConversation,
  sendMessage,
} from "@/lib/actions/messages";
import { displayName, timeAgo } from "@/lib/format";
import { mediaUrl, uploadMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/database";
import type {
  AuthorSummary,
  ConversationSummary,
  MessageWithSender,
} from "@/types/social";

interface MessengerProps {
  initialConversations: ConversationSummary[];
  currentUser: AuthorSummary;
  friends: AuthorSummary[];
  initialActiveId?: string;
}

/** Display info for a conversation from the viewer's perspective. */
function conversationPeer(
  conversation: ConversationSummary,
  viewerId: string,
): AuthorSummary | null {
  return (
    conversation.participants.find((p) => p.user_id !== viewerId)?.profile ??
    null
  );
}

export function Messenger({
  initialConversations,
  currentUser,
  friends,
  initialActiveId,
}: MessengerProps) {
  const t = useTranslations("messenger");
  const [conversations, setConversations] = React.useState(
    initialConversations,
  );
  const [activeId, setActiveId] = React.useState<string | null>(
    initialActiveId ?? null,
  );
  const [messages, setMessages] = React.useState<MessageWithSender[] | null>(
    null,
  );
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [peerTyping, setPeerTyping] = React.useState(false);
  const [peerLastReadAt, setPeerLastReadAt] = React.useState<string | null>(
    null,
  );
  const [starting, startTransition] = React.useTransition();

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const typingSentAt = React.useRef(0);
  const typingTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const activeIdRef = React.useRef(activeId);
  activeIdRef.current = activeId;
  const conversationsRef = React.useRef(conversations);
  conversationsRef.current = conversations;

  const active = conversations.find((c) => c.id === activeId) ?? null;
  const peer = active ? conversationPeer(active, currentUser.id) : null;

  const refreshConversations = React.useCallback(async () => {
    const response = await fetch("/api/conversations");
    if (!response.ok) return;
    const payload: { conversations: ConversationSummary[] } =
      await response.json();
    setConversations(payload.conversations);
  }, []);

  // Load messages when the active conversation changes.
  React.useEffect(() => {
    if (!activeId) {
      setMessages(null);
      return;
    }
    let cancelled = false;
    setMessages(null);
    setPeerTyping(false);
    fetch(`/api/messages?conversation=${activeId}`)
      .then((response) => response.json())
      .then((payload: { messages?: MessageWithSender[] }) => {
        if (!cancelled) setMessages(payload.messages ?? []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    void markConversationRead(activeId);
    setConversations((previous) =>
      previous.map((c) => (c.id === activeId ? { ...c, unread: false } : c)),
    );

    const conversation = conversationsRef.current.find(
      (c) => c.id === activeId,
    );
    const other = conversation
      ? conversationPeer(conversation, currentUser.id)
      : null;
    const otherParticipant = conversation?.participants.find(
      (p) => p.user_id !== currentUser.id,
    );
    setPeerLastReadAt(otherParticipant?.last_read_at ?? null);

    // Per-conversation channel: typing broadcasts + peer read receipts.
    const supabase = createClient();
    const channel = supabase
      .channel(`conversation:${activeId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== currentUser.id) {
          setPeerTyping(true);
          if (typingTimeout.current) clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setPeerTyping(false), 3000);
        }
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
          filter: `conversation_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as {
            user_id?: string;
            last_read_at?: string;
          };
          if (other && row.user_id === other.id && row.last_read_at) {
            setPeerLastReadAt(row.last_read_at);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, currentUser.id]);

  // Global channel: every message insert visible to this user (RLS-scoped).
  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${currentUser.id}`)
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
            void refreshConversations();
            return;
          }

          const isActive = activeIdRef.current === message.conversation_id;
          if (isActive) {
            const sender =
              conversationPeer(known, currentUser.id) ?? currentUser;
            setMessages((previous) =>
              previous && !previous.some((m) => m.id === message.id)
                ? [...previous, { ...message, sender }]
                : previous,
            );
            setPeerTyping(false);
            void markConversationRead(message.conversation_id);
          }

          setConversations((previous) =>
            previous
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
  }, [currentUser, refreshConversations]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  function broadcastTyping() {
    if (!activeId) return;
    const now = Date.now();
    if (now - typingSentAt.current < 2000) return;
    typingSentAt.current = now;
    const supabase = createClient();
    void supabase.channel(`conversation:${activeId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUser.id },
    });
  }

  async function handleSend(imageFile?: File) {
    if (!activeId || sending) return;
    const content = input.trim();
    if (!content && !imageFile) return;

    setSending(true);
    setInput("");
    try {
      let imagePath: string | null = null;
      if (imageFile) {
        const uploaded = await uploadMedia(currentUser.id, imageFile);
        imagePath = uploaded.storage_path;
      }

      const optimistic: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: activeId,
        sender_id: currentUser.id,
        content,
        image_path: imagePath,
        created_at: new Date().toISOString(),
        sender: currentUser,
      };
      setMessages((previous) => [...(previous ?? []), optimistic]);
      setConversations((previous) =>
        previous
          .map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  last_message: optimistic,
                  last_message_at: optimistic.created_at,
                }
              : c,
          )
          .sort(
            (a, b) =>
              new Date(b.last_message_at).getTime() -
              new Date(a.last_message_at).getTime(),
          ),
      );

      const result = await sendMessage({
        conversationId: activeId,
        content,
        imagePath,
      });
      setMessages((previous) => {
        if (!previous) return previous;
        if (!result.ok) {
          return previous.filter((m) => m.id !== optimistic.id);
        }
        return previous.map((m) =>
          m.id === optimistic.id ? { ...m, id: result.data.messageId } : m,
        );
      });
    } finally {
      setSending(false);
    }
  }

  function startChat(friendId: string) {
    startTransition(async () => {
      const result = await openDirectConversation(friendId);
      if (result.ok) {
        await refreshConversations();
        setActiveId(result.data.conversationId);
      }
    });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Conversation list */}
      <aside
        className={cn(
          "w-full shrink-0 border-r bg-background md:w-80",
          activeId && "hidden md:block",
        )}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={t("newMessage")}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <SquarePen className="h-5 w-5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {friends.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {t("noFriends")}
                </p>
              ) : (
                friends.map((friend) => (
                  <DropdownMenuItem
                    key={friend.id}
                    onSelect={() => startChat(friend.id)}
                  >
                    <UserAvatar
                      profile={friend}
                      linked={false}
                      className="mr-2 h-7 w-7"
                    />
                    {displayName(friend)}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="overflow-y-auto px-2 pb-4">
          {conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            conversations.map((conversation) => {
              const other = conversationPeer(conversation, currentUser.id);
              const preview = conversation.last_message
                ? conversation.last_message.content ||
                  (conversation.last_message.image_path ? t("sentPhoto") : "")
                : t("noMessagesYet");
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted",
                    conversation.id === activeId && "bg-secondary",
                  )}
                >
                  {other ? (
                    <UserAvatar profile={other} linked={false} />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {conversation.title ??
                        (other ? displayName(other) : t("conversation"))}
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
                      {conversation.last_message
                        ? ` · ${timeAgo(conversation.last_message.created_at)}`
                        : ""}
                    </p>
                  </div>
                  {conversation.unread ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat window */}
      <section
        className={cn("flex min-w-0 flex-1 flex-col", !activeId && "hidden md:flex")}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">{t("selectConversation")}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b p-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full md:hidden"
                onClick={() => setActiveId(null)}
                aria-label={t("back")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {peer ? <UserAvatar profile={peer} /> : null}
              <div>
                <p className="text-sm font-semibold">
                  {active.title ?? (peer ? displayName(peer) : "")}
                </p>
                {peerTyping ? (
                  <p className="text-xs text-primary">{t("typing")}</p>
                ) : null}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-1 overflow-y-auto p-4">
              {messages === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((message, index) => {
                  const isMine = message.sender_id === currentUser.id;
                  const isLastMine =
                    isMine &&
                    !messages
                      .slice(index + 1)
                      .some((m) => m.sender_id === currentUser.id);
                  const seen =
                    isLastMine &&
                    peerLastReadAt !== null &&
                    new Date(peerLastReadAt) >= new Date(message.created_at);
                  return (
                    <div key={message.id}>
                      <div
                        className={cn(
                          "flex items-end gap-2",
                          isMine && "justify-end",
                        )}
                      >
                        {!isMine ? (
                          <UserAvatar
                            profile={message.sender}
                            linked={false}
                            className="h-7 w-7"
                          />
                        ) : null}
                        <div
                          className={cn(
                            "max-w-[70%] overflow-hidden rounded-2xl",
                            isMine
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          {message.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={mediaUrl(message.image_path)}
                              alt=""
                              loading="lazy"
                              className="max-h-72 w-full object-cover"
                            />
                          ) : null}
                          {message.content ? (
                            <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm">
                              {message.content}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {seen ? (
                        <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
                          {t("seen")}
                        </p>
                      ) : null}
                    </div>
                  );
                })
              )}
              {peerTyping ? (
                <div className="flex items-center gap-2">
                  {peer ? (
                    <UserAvatar
                      profile={peer}
                      linked={false}
                      className="h-7 w-7"
                    />
                  ) : null}
                  <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    …
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2 border-t p-3">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                aria-label={t("sendPhoto")}
              >
                <ImagePlus className="h-5 w-5 text-accent" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSend(file);
                  event.target.value = "";
                }}
              />
              <input
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  broadcastTyping();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={t("placeholder")}
                maxLength={4000}
                className="flex-1 rounded-full bg-muted px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              />
              <Button
                size="icon"
                className="rounded-full"
                onClick={() => void handleSend()}
                disabled={sending || !input.trim()}
                aria-label={t("send")}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
