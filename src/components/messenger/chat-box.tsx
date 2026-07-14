"use client";

import * as React from "react";
import {
  Gamepad2,
  Loader2,
  Minus,
  SendHorizonal,
  Smile,
  X,
} from "lucide-react";

import { EmojiPicker } from "@/components/messenger/emoji-picker";
import { GamesPanel } from "@/components/messenger/games-panel";
import { UserAvatar } from "@/components/social/user-avatar";
import { chatMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { AuthorSummary, MessageWithSender } from "@/types/social";

/** What a message with no text and no image actually is. */
export function summarise(message: MessageWithSender): string | null {
  if (message.file_kind === "audio") return "🎤 အသံ မက်ဆေ့ခ်ျ";
  if (message.file_kind === "video") return "🎥 ဗီဒီယို";
  if (message.file_kind === "file") return "📎 ဖိုင်";
  if (message.live_until) return "📍 တည်နေရာ တိုက်ရိုက်";
  if (message.latitude != null) return "📍 တည်နေရာ";
  return null;
}

/**
 * One floating conversation, Facebook-style: several of these sit side by side
 * along the bottom of the screen, each with its own thread, input and unread
 * count. Collapsed, it shrinks to just its header so a stack of them still fits.
 */
export function ChatBox({
  title,
  peer,
  currentUserId,
  conversationId,
  messages,
  minimized,
  unread,
  onSend,
  onClose,
  onToggleMinimize,
  onFocus,
}: {
  title: string;
  peer: AuthorSummary | null;
  currentUserId: string;
  conversationId: string;
  messages: MessageWithSender[] | null;
  minimized: boolean;
  unread: number;
  onSend: (content: string) => Promise<void>;
  onClose: () => void;
  onToggleMinimize: () => void;
  onFocus: () => void;
}) {
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [gamesOpen, setGamesOpen] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!minimized) bottomRef.current?.scrollIntoView();
  }, [messages, minimized]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setInput("");
    setEmojiOpen(false);
    await onSend(content);
    setSending(false);
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onToggleMinimize}
        className="pointer-events-auto flex w-56 items-center gap-2 rounded-t-xl border border-b-0 bg-card px-3 py-2 shadow-lg transition-colors hover:bg-muted"
      >
        {peer ? (
          <UserAvatar profile={peer} linked={false} className="h-7 w-7" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
          {title}
        </span>
        {unread > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
        <span
          role="presentation"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="rounded-full p-0.5 text-muted-foreground hover:bg-muted-foreground/20"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div
      onMouseDown={onFocus}
      className={cn(
        "pointer-events-auto flex flex-col overflow-hidden rounded-t-xl border border-b-0 bg-background shadow-2xl",
        "h-[24rem] w-[19rem] max-w-[calc(100vw-1.5rem)]",
      )}
    >
      <div className="flex items-center gap-2 border-b bg-card px-2.5 py-2">
        {peer ? (
          <UserAvatar profile={peer} linked={false} className="h-7 w-7" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title}
        </span>
        {peer ? (
          <button
            type="button"
            onClick={() => setGamesOpen((open) => !open)}
            aria-label="Games"
            className={cn(
              "rounded-full p-1 hover:bg-muted",
              gamesOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Gamepad2 className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onToggleMinimize}
          aria-label="Minimise"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {gamesOpen ? (
        <div className="max-h-[18rem] overflow-y-auto">
          <GamesPanel
            conversationId={conversationId}
            currentUserId={currentUserId}
            peer={peer}
            onClose={() => setGamesOpen(false)}
          />
        </div>
      ) : null}

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
          messages.map((message) => {
            const mine = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] overflow-hidden rounded-2xl shadow-sm",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted",
                  )}
                >
                  {message.image_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={chatMediaUrl(message.image_path)}
                      alt=""
                      loading="lazy"
                      className="max-h-40 w-full object-cover"
                    />
                  ) : null}
                  {/* A voice note, file or location has no text and no image, so
                      the dock used to render it as a blank grey rectangle. The
                      dock is deliberately compact — say what arrived and send
                      them to the full messenger to act on it. */}
                  {summarise(message) ? (
                    <p className="flex items-center gap-1.5 px-3 py-1.5 text-sm">
                      {summarise(message)}
                    </p>
                  ) : null}
                  {message.content ? (
                    <p className="whitespace-pre-wrap break-words px-3 py-1.5 text-sm">
                      {message.content}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative flex items-center gap-1 border-t p-2">
        {emojiOpen ? (
          <EmojiPicker
            onClose={() => setEmojiOpen(false)}
            onPick={(emoji) => {
              setInput((previous) => (previous + emoji).slice(0, 4000));
              inputRef.current?.focus();
            }}
          />
        ) : null}
        <button
          type="button"
          data-emoji-toggle
          onClick={() => setEmojiOpen((open) => !open)}
          aria-label="Emoji"
          className={cn(
            "shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted",
            emojiOpen && "bg-primary/10 text-primary",
          )}
        >
          <Smile className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Message…"
          maxLength={4000}
          className="min-w-0 flex-1 rounded-full bg-muted px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="shrink-0 rounded-full bg-primary p-2 text-primary-foreground disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizonal className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
