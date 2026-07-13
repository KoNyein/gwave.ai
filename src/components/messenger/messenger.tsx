"use client";

import * as React from "react";
import {
  ArrowLeft,
  FileText,
  Gamepad2,
  ImagePlus,
  Languages,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Radio,
  SendHorizonal,
  SquarePen,
  Video,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CallUI } from "@/components/messenger/call-ui";
import { GamesPanel } from "@/components/messenger/games-panel";
import { useCall } from "@/components/messenger/use-call";
import { VoiceMessage } from "@/components/messenger/voice-message";
import { VoiceRecorder } from "@/components/messenger/voice-recorder";
import { LocationMap } from "@/components/social/location-map";
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
import { translateText } from "@/lib/actions/translate";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { displayName, timeAgo } from "@/lib/format";
import { getCurrentPosition } from "@/lib/geolocation";
import { mediaUrl, uploadFile, uploadMedia, uploadVoice } from "@/lib/media";
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
  const locale = useLocale();
  const [conversations, setConversations] = React.useState(
    initialConversations,
  );
  // Auto-translate incoming messages into the viewer's language.
  const [autoTranslate, setAutoTranslate] = usePersistentState(
    "gw:msg-autotranslate",
    false,
  );
  const [translations, setTranslations] = React.useState<
    Record<string, { text: string; loading: boolean; failed?: boolean }>
  >({});
  const translationsRef = React.useRef(translations);
  translationsRef.current = translations;
  const [activeId, setActiveId] = React.useState<string | null>(
    initialActiveId ?? null,
  );
  const [messages, setMessages] = React.useState<MessageWithSender[] | null>(
    null,
  );
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [peerTyping, setPeerTyping] = React.useState(false);
  const [gamesOpen, setGamesOpen] = React.useState(false);
  const [peerLastReadAt, setPeerLastReadAt] = React.useState<string | null>(
    null,
  );
  const [starting, startTransition] = React.useTransition();

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const attachInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [recording, setRecording] = React.useState(false);
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

  // WebRTC audio/video calls (Supabase Realtime signaling).
  const call = useCall(currentUser);

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

  const translateMessage = React.useCallback(
    async (id: string, content: string) => {
      if (!content.trim()) return;
      if (translationsRef.current[id]?.text) return;
      setTranslations((prev) => ({
        ...prev,
        [id]: { text: prev[id]?.text ?? "", loading: true },
      }));
      const res = await translateText(content, locale);
      setTranslations((prev) => ({
        ...prev,
        [id]: { text: res.text, loading: false, failed: !res.ok },
      }));
    },
    [locale],
  );

  // Auto-translate the other person's messages when the toggle is on.
  React.useEffect(() => {
    if (!autoTranslate || !messages) return;
    for (const m of messages) {
      if (!m.content || m.sender_id === currentUser.id) continue;
      if (translationsRef.current[m.id]) continue;
      void translateMessage(m.id, m.content);
    }
  }, [autoTranslate, messages, currentUser.id, translateMessage]);

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
        latitude: null,
        longitude: null,
        file_path: null,
        file_kind: null,
        file_name: null,
        duration_seconds: null,
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

  // Send a video or an arbitrary file attachment.
  async function handleSendAttachment(file: File, kind: "video" | "file") {
    if (!activeId || sending) return;
    setSending(true);
    try {
      let filePath: string;
      let fileName: string;
      if (kind === "video") {
        const uploaded = await uploadMedia(currentUser.id, file);
        filePath = uploaded.storage_path;
        fileName = file.name;
      } else {
        const uploaded = await uploadFile(currentUser.id, file);
        filePath = uploaded.storage_path;
        fileName = uploaded.file_name;
      }

      const optimistic: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: activeId,
        sender_id: currentUser.id,
        content: "",
        image_path: null,
        latitude: null,
        longitude: null,
        file_path: filePath,
        file_kind: kind,
        file_name: fileName,
        duration_seconds: null,
        created_at: new Date().toISOString(),
        sender: currentUser,
      };
      setMessages((previous) => [...(previous ?? []), optimistic]);
      // Keep the sidebar preview and ordering current (the realtime handler
      // ignores our own inserts, so update the list optimistically here too).
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
        content: "",
        imagePath: null,
        filePath,
        fileKind: kind,
        fileName,
      });
      setMessages((previous) => {
        if (!previous) return previous;
        if (!result.ok) return previous.filter((m) => m.id !== optimistic.id);
        return previous.map((m) =>
          m.id === optimistic.id ? { ...m, id: result.data.messageId } : m,
        );
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSending(false);
    }
  }

  /** A finished recording: upload it, then send it as an 'audio' attachment. */
  async function handleSendVoice(blob: Blob, seconds: number) {
    if (!activeId || sending) return;
    setSending(true);
    try {
      const { storage_path: filePath } = await uploadVoice(currentUser.id, blob);

      const optimistic: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: activeId,
        sender_id: currentUser.id,
        content: "",
        image_path: null,
        latitude: null,
        longitude: null,
        file_path: filePath,
        file_kind: "audio",
        file_name: null,
        duration_seconds: seconds,
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
      setRecording(false);

      const result = await sendMessage({
        conversationId: activeId,
        content: "",
        imagePath: null,
        filePath,
        fileKind: "audio",
        durationSeconds: seconds,
      });
      setMessages((previous) => {
        if (!previous) return previous;
        if (!result.ok) return previous.filter((m) => m.id !== optimistic.id);
        return previous.map((m) =>
          m.id === optimistic.id ? { ...m, id: result.data.messageId } : m,
        );
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setRecording(false);
    } finally {
      setSending(false);
    }
  }

  async function shareLocation() {
    if (!activeId || sending) return;
    setSending(true);
    try {
      const position = await getCurrentPosition();
      const optimistic: MessageWithSender = {
        id: `optimistic-${Date.now()}`,
        conversation_id: activeId,
        sender_id: currentUser.id,
        content: "",
        image_path: null,
        latitude: position.latitude,
        longitude: position.longitude,
        file_path: null,
        file_kind: null,
        file_name: null,
        duration_seconds: null,
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
        content: "",
        imagePath: null,
        latitude: position.latitude,
        longitude: position.longitude,
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
    } catch {
      // Permission denied / unavailable — silently abort (button re-enables).
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
                  (conversation.last_message.image_path
                    ? t("sentPhoto")
                    : conversation.last_message.latitude != null
                      ? t("sharedLocation")
                      : conversation.last_message.file_kind === "video"
                        ? t("sentVideo")
                        : conversation.last_message.file_kind === "audio"
                          ? t("sentVoice")
                          : conversation.last_message.file_kind === "file"
                            ? t("sentFile")
                            : "")
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
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {active.title ?? (peer ? displayName(peer) : "")}
                </p>
                {peerTyping ? (
                  <p className="text-xs text-primary">{t("typing")}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() => setAutoTranslate((v) => !v)}
                aria-label="Auto-translate"
                title={
                  autoTranslate
                    ? "Auto ဘာသာပြန် — ဖွင့်ထားသည်"
                    : "Auto ဘာသာပြန် — ပိတ်ထားသည်"
                }
              >
                <Languages
                  className={
                    autoTranslate
                      ? "h-5 w-5 text-primary"
                      : "h-5 w-5 text-muted-foreground"
                  }
                />
              </Button>
              {peer ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => setGamesOpen((v) => !v)}
                    aria-label="ဂိမ်း"
                  >
                    <Gamepad2
                      className={gamesOpen ? "h-5 w-5 text-primary" : "h-5 w-5 text-accent"}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => call.startCall(peer, active.id, false)}
                    disabled={call.status !== "idle"}
                    aria-label={t("audioCall")}
                  >
                    <Phone className="h-5 w-5 text-accent" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => call.startCall(peer, active.id, true)}
                    disabled={call.status !== "idle"}
                    aria-label={t("videoCall")}
                  >
                    <Video className="h-5 w-5 text-accent" />
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label={t("goLive")}
                  >
                    <a href="/live/new">
                      <Radio className="h-5 w-5 text-destructive" />
                    </a>
                  </Button>
                </>
              ) : null}
            </div>

            {gamesOpen ? (
              <GamesPanel
                conversationId={active.id}
                currentUserId={currentUser.id}
                onClose={() => setGamesOpen(false)}
              />
            ) : null}

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
                          {message.latitude != null &&
                          message.longitude != null ? (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${message.latitude}&mlon=${message.longitude}#map=16/${message.latitude}/${message.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <LocationMap
                                latitude={message.latitude}
                                longitude={message.longitude}
                                className="h-40 w-60"
                              />
                              <span className="flex items-center gap-1 px-3 py-1.5 text-xs">
                                <MapPin className="h-3.5 w-3.5" />
                                {t("sharedLocation")}
                              </span>
                            </a>
                          ) : null}
                          {message.file_path && message.file_kind === "video" ? (
                            <video
                              src={mediaUrl(message.file_path)}
                              controls
                              playsInline
                              className="max-h-72 w-full bg-black"
                            />
                          ) : null}
                          {message.file_path && message.file_kind === "audio" ? (
                            <div className="px-2.5 py-2">
                              <VoiceMessage
                                path={message.file_path}
                                duration={message.duration_seconds ?? 0}
                                mine={isMine}
                              />
                            </div>
                          ) : null}
                          {message.file_path && message.file_kind === "file" ? (
                            <a
                              href={mediaUrl(message.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={message.file_name ?? true}
                              className="flex items-center gap-2 px-3 py-2 text-sm underline"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {message.file_name ?? t("file")}
                              </span>
                            </a>
                          ) : null}
                          {message.content ? (
                            <div className="px-3 py-2">
                              <p className="whitespace-pre-wrap break-words text-sm">
                                {message.content}
                              </p>
                              {translations[message.id]?.text ? (
                                <p
                                  className={cn(
                                    "mt-1 whitespace-pre-wrap break-words border-t pt-1 text-sm italic",
                                    isMine
                                      ? "border-primary-foreground/30 text-primary-foreground/80"
                                      : "border-border text-muted-foreground",
                                  )}
                                >
                                  🌐 {translations[message.id]?.text}
                                </p>
                              ) : null}
                              {!isMine ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void translateMessage(
                                      message.id,
                                      message.content,
                                    )
                                  }
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:underline"
                                >
                                  {translations[message.id]?.loading ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Languages className="h-3 w-3" />
                                  )}
                                  {translations[message.id]?.text
                                    ? "ဘာသာပြန်ပြီး"
                                    : "ဘာသာပြန်"}
                                </button>
                              ) : null}
                            </div>
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

            {uploadError ? (
              <p className="border-t bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                {uploadError}
              </p>
            ) : null}

            {/* Composer */}
            <div className="flex items-center gap-2 border-t p-3">
              {recording ? (
                <VoiceRecorder
                  busy={sending}
                  onSend={(blob, seconds) => void handleSendVoice(blob, seconds)}
                  onCancel={() => setRecording(false)}
                  onError={(message) => {
                    setUploadError(message);
                    setRecording(false);
                  }}
                />
              ) : (
                <>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => attachInputRef.current?.click()}
                    disabled={sending}
                    aria-label={t("sendAttachment")}
                  >
                    <Paperclip className="h-5 w-5 text-accent" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => void shareLocation()}
                    disabled={sending}
                    aria-label={t("shareLocation")}
                  >
                    <MapPin className="h-5 w-5 text-destructive" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => {
                      setUploadError(null);
                      setRecording(true);
                    }}
                    disabled={sending}
                    aria-label={t("recordVoice")}
                  >
                    <Mic className="h-5 w-5 text-primary" />
                  </Button>
                </>
              )}
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
                ref={attachInputRef}
                type="file"
                accept="video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setUploadError(null);
                    void handleSendAttachment(
                      file,
                      file.type.startsWith("video/") ? "video" : "file",
                    );
                  }
                  event.target.value = "";
                }}
              />
              {recording ? null : (
                <>
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
                </>
              )}
            </div>
          </>
        )}
      </section>

      <CallUI call={call} />
    </div>
  );
}
