import Link from "next/link";

import { strainPhoto } from "@/lib/strain-photo";
import { cn } from "@/lib/utils";
import type { Strain, StrainType } from "@/types/database";

export const STRAIN_TYPE_STYLES: Record<StrainType, string> = {
  indica: "bg-purple-100 text-purple-800",
  sativa: "bg-amber-100 text-amber-800",
  hybrid: "bg-secondary text-primary",
};

export function StrainTypeBadge({ type }: { type: StrainType }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        STRAIN_TYPE_STYLES[type],
      )}
    >
      {type}
    </span>
  );
}

export function StrainCard({ strain }: { strain: Strain }) {
  return (
    <Link
      href={`/strains/${strain.slug}`}
      className="flex flex-col overflow-hidden rounded-xl border bg-background transition-shadow hover:shadow-md"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={strainPhoto(strain)}
        alt={strain.name}
        loading="lazy"
        className="aspect-[5/3] w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{strain.name}</h3>
        <StrainTypeBadge type={strain.type} />
      </div>
      <p className="text-xs text-muted-foreground">
        THC {strain.thc ?? "–"}% · CBD {strain.cbd ?? "–"}%
      </p>
      <div className="flex flex-wrap gap-1">
        {strain.effects.slice(0, 3).map((effect) => (
          <span
            key={effect}
            className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground"
          >
            {effect}
          </span>
        ))}
      </div>
      {strain.description ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {strain.description}
        </p>
      ) : null}
      </div>
    </Link>
  );
}
