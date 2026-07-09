import { Youtube } from "lucide-react";

/**
 * A "Learn on YouTube" card that opens a YouTube search for the lesson topic
 * in a new tab. Used when a lesson has no pinned youtubeId — it guarantees a
 * relevant, working result (and honours the viewer's language when the query
 * is localized) instead of embedding a possibly-dead video id.
 */
export function LessonYouTubeLink({
  query,
  label,
}: {
  query: string;
  label: string;
}) {
  const href = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query,
  )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm transition-colors hover:bg-red-500/10"
    >
      <Youtube className="h-5 w-5 shrink-0 text-red-600 dark:text-red-500" />
      <span className="font-medium">{label}</span>
    </a>
  );
}
