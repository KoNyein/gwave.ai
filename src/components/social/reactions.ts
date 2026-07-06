import type { ReactionType } from "@/types/database";

export const REACTIONS: Record<
  ReactionType,
  { emoji: string; label: string; color: string }
> = {
  like: { emoji: "👍", label: "Like", color: "text-primary" },
  love: { emoji: "❤️", label: "Love", color: "text-red-500" },
  haha: { emoji: "😆", label: "Haha", color: "text-amber-500" },
  wow: { emoji: "😮", label: "Wow", color: "text-amber-500" },
  sad: { emoji: "😢", label: "Sad", color: "text-amber-500" },
  angry: { emoji: "😡", label: "Angry", color: "text-orange-600" },
};

export const REACTION_ORDER: ReactionType[] = [
  "like",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
];
