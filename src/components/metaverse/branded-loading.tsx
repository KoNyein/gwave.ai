"use client";

/**
 * Gwave-branded full-screen loading overlay — metaverse worlds and game
 * entries share this one look, so "loading" always reads as Gwave.
 * Pure DOM (no 3D deps); parents mount it absolutely inside their shell and
 * unmount when the world/socket is live.
 */
export function BrandedLoading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#0b0f16]">
      {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon, no next/image optimization needed */}
      <img
        src="/icon-192.png"
        alt="Gwave"
        width={72}
        height={72}
        className="animate-pulse rounded-2xl shadow-lg shadow-emerald-500/20"
      />
      <div className="text-center">
        <p className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-2xl font-black tracking-[0.35em] text-transparent">
          GWAVE
        </p>
        <p className="mt-1 text-sm font-medium text-white/85">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
