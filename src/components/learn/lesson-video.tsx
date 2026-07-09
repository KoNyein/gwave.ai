import { Youtube } from "lucide-react";

/**
 * Embedded YouTube video lesson. Uses the privacy-enhanced youtube-nocookie
 * domain (allowed in the CSP frame-src). The 11-char id is validated so
 * nothing but a YouTube embed can be framed here.
 */
export function LessonVideo({
  youtubeId,
  title,
}: {
  youtubeId: string;
  title: string;
}) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return null;

  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Youtube className="h-4 w-4 text-red-600" /> Video lesson
      </p>
      <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    </div>
  );
}
