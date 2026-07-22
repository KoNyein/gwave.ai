"use client";

import * as React from "react";
import { Loader2, SendHorizonal } from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/data/client";
import type { LiveChatMessage } from "@/types/database";
import type { AuthorSummary } from "@/types/social";

export interface ChatEntry extends LiveChatMessage {
  author: AuthorSummary;
}

/**
 * Realtime stream chat. History comes from the server; new messages arrive
 * via postgres_changes on live_chat_messages filtered to this stream.
 * Author profiles for incoming messages are fetched once and cached.
 */
export function LiveChat({
  streamId,
  currentUser,
  initialMessages,
  disabled,
  overlay,
}: {
  streamId: string;
  currentUser: AuthorSummary;
  initialMessages: ChatEntry[];
  disabled?: boolean;
  /** TikTok-style: transparent, white text with shadow, drawn over the video
   * (the parent supplies the gradient). Card styling when false. */
  overlay?: boolean;
}) {
  const [messages, setMessages] = React.useState<ChatEntry[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const profileCache = React.useRef(
    new Map<string, AuthorSummary>(
      initialMessages.map((m) => [m.author.id, m.author]),
    ),
  );

  // Auto-scroll to the newest message.
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  React.useEffect(() => {
    const db = createClient();
    profileCache.current.set(currentUser.id, currentUser);

    const channel = db
      .channel(`live-chat:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const row = payload.new as LiveChatMessage;
          let author = profileCache.current.get(row.user_id);
          if (!author) {
            const { data } = await db
              .from("profiles")
              .select("id, username, full_name, avatar_url")
              .eq("id", row.user_id)
              .maybeSingle();
            author = data ?? {
              id: row.user_id,
              username: null,
              full_name: null,
              avatar_url: null,
            };
            profileCache.current.set(row.user_id, author);
          }
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev.slice(-199), { ...row, author: author! }],
          );
        },
      )
      .subscribe();

    return () => {
      void db.removeChannel(channel);
    };
  }, [streamId, currentUser]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || pending || disabled) return;
    setPending(true);
    setError(null);

    const db = createClient();
    const { error: insertError } = await db
      .from("live_chat_messages")
      .insert({ stream_id: streamId, user_id: currentUser.id, content });
    setPending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={listRef}
        className={`flex-1 space-y-2 overflow-y-auto ${overlay ? "px-3 pb-1" : "p-3"}`}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          overlay ? null : (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No messages yet — say hi! 👋
            </p>
          )
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-2">
              <UserAvatar
                profile={message.author}
                linked={false}
                className="h-6 w-6"
              />
              <p
                className={`min-w-0 flex-1 text-sm ${
                  overlay ? "[text-shadow:0_1px_2px_rgba(0,0,0,.8)]" : ""
                }`}
              >
                <span
                  className={`mr-1 font-semibold ${overlay ? "text-white/80" : ""}`}
                >
                  {displayName(message.author)}
                </span>
                <span
                  className={`break-words ${
                    overlay ? "text-white" : "text-foreground/90"
                  }`}
                >
                  {message.content}
                </span>
              </p>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={send}
        className={`flex items-center gap-2 p-2 ${overlay ? "" : "border-t"}`}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={disabled ? "Chat is closed" : "Say something…"}
          maxLength={500}
          disabled={disabled || pending}
          aria-label="Chat message"
          className={
            overlay
              ? "h-9 rounded-full border-white/25 bg-black/40 text-white placeholder:text-white/60"
              : undefined
          }
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || pending || !draft.trim()}
          aria-label="Send"
          className={overlay ? "h-9 w-9 rounded-full" : undefined}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </Button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
