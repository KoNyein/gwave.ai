"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Crosshair,
  Flag,
  Languages,
  MapPin,
  Mountain,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import { mediaRef } from "@/lib/media-url";
import { uploadMedia } from "@/lib/media";
import { SearchBar } from "@/components/ui/search-bar";
import {
  MINE_METALS,
  MLANG_LABEL,
  MSTR,
  SCALES,
  STATUSES,
  metalName,
  metalStyle,
  nextMLang,
  type MLang,
  type MineMetal,
} from "./mine-data";
import type { MinePin } from "./mine-map-inner";

const MineMap = dynamic(() => import("./mine-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

/**
 * The community mine-site map: find where a mineral is dug, add a site, correct
 * one, report a bad pin. Every user contributes, an admin removes.
 *
 * A listing is only accepted complete — mineral, name, state/region, township,
 * exact coordinates and at least one photo — so the form refuses to submit
 * until it is, and says which field is missing rather than failing silently at
 * the API.
 */

interface Site {
  id: string;
  metal: MineMetal;
  name: string;
  region: string;
  township: string;
  latitude: number;
  longitude: number;
  photos: string[];
  scale: (typeof SCALES)[number];
  status: (typeof STATUSES)[number];
  operator: string | null;
  description: string | null;
  access: string | null;
  hazard: string | null;
  tags: string | null;
  country: string;
  report_count: number;
  updated_at: string;
}

export function MineSitesBoard({
  isAdmin = false,
  userId,
}: {
  isAdmin?: boolean;
  userId: string;
}) {
  const [sites, setSites] = React.useState<Site[]>([]);
  const [metal, setMetal] = React.useState<"all" | MineMetal>("all");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Site | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [lang, setLang] = React.useState<MLang>("my");

  // Shares the metal board's language key so switching there carries over here.
  React.useEffect(() => {
    const saved = window.localStorage.getItem("gwave-mine-lang");
    if (saved === "en" || saved === "my" || saved === "th") setLang(saved);
  }, []);
  function cycleLang() {
    const next = nextMLang(lang);
    setLang(next);
    window.localStorage.setItem("gwave-mine-lang", next);
  }
  const t = MSTR[lang];

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/mine/sites");
      if (res.ok) {
        const body = (await res.json()) as { sites: Site[] };
        setSites(body.sites);
      }
    } catch {
      // Non-fatal: the map keeps whatever it already has.
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const needle = q.trim().toLowerCase();
  const shown = sites.filter((s) => {
    if (metal !== "all" && s.metal !== metal) return false;
    if (!needle) return true;
    return (
      s.name.toLowerCase().includes(needle) ||
      s.township.toLowerCase().includes(needle) ||
      s.region.toLowerCase().includes(needle) ||
      (s.operator ?? "").toLowerCase().includes(needle) ||
      (s.tags ?? "").toLowerCase().includes(needle)
    );
  });

  // Only offer chips for minerals that actually have a pin, plus whatever is
  // selected, so the filter row doesn't list sixteen empty categories.
  const present = new Set(sites.map((s) => s.metal));
  const chips = MINE_METALS.filter((m) => present.has(m) || m === metal);

  const pins: MinePin[] = shown.map((s) => ({
    id: s.id,
    metal: s.metal,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    township: s.township,
  }));
  const active = sites.find((s) => s.id === selected) ?? null;

  async function report(site: Site) {
    const reason = window.prompt(t.reportPrompt);
    if (!reason || reason.trim().length < 3) return;
    await fetch("/api/mine/sites/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: site.id, reason: reason.trim() }),
    }).catch(() => {});
    window.alert(t.reported);
    void load();
  }

  async function remove(site: Site) {
    if (!window.confirm(`${t.del}: ${site.name}?`)) return;
    await fetch(`/api/mine/sites?id=${encodeURIComponent(site.id)}`, {
      method: "DELETE",
    }).catch(() => {});
    setSelected(null);
    void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-bold">
            <Mountain className="h-5 w-5 text-primary" /> {t.title}
          </h2>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={cycleLang}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold"
          >
            <Languages className="h-3.5 w-3.5" /> {MLANG_LABEL[lang]}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen((o) => !o);
            }}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            {formOpen ? (
              t.close
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> {t.add}
              </>
            )}
          </button>
        </div>
      </div>

      <SearchBar
        value={q}
        onValueChange={setQ}
        placeholder={t.search}
        aria-label={t.search}
      />

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setMetal("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            metal === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.all} · {sites.length}
        </button>
        {chips.map((m) => {
          const style = metalStyle(m);
          const on = metal === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMetal(m)}
              style={on ? { backgroundColor: style.color, color: "#fff" } : {}}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                on ? "" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {style.emoji} {metalName(m, lang)}
            </button>
          );
        })}
      </div>

      {formOpen ? (
        <MineForm
          lang={lang}
          userId={userId}
          editing={editing}
          onDone={() => {
            setFormOpen(false);
            setEditing(null);
            void load();
          }}
        />
      ) : null}

      <div className="h-[55vh] w-full overflow-hidden rounded-xl border">
        <MineMap pins={pins} onSelect={(id) => setSelected(id)} />
      </div>

      {active ? (
        <MineCard
          site={active}
          lang={lang}
          isAdmin={isAdmin}
          onEdit={() => {
            setEditing(active);
            setFormOpen(true);
          }}
          onReport={() => void report(active)}
          onDelete={() => void remove(active)}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        {t.disclaimer}
      </div>

      <details
        open={guideOpen}
        onToggle={(e) => setGuideOpen((e.target as HTMLDetailsElement).open)}
        className="rounded-xl border"
      >
        <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
          ❓ {t.guide}
        </summary>
        <p className="whitespace-pre-wrap px-4 pb-3 text-xs leading-relaxed text-muted-foreground">
          {t.guideBody}
        </p>
      </details>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t.hint}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted-foreground">
            {shown.length} {t.sites}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((s) => {
              const style = metalStyle(s.metal);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={`flex gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted/40 ${
                    selected === s.id ? "border-primary" : ""
                  }`}
                >
                  {mediaRef(s.photos[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaRef(s.photos[0])!}
                      alt={s.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg text-2xl"
                      style={{ backgroundColor: `${style.color}22` }}
                    >
                      {style.emoji}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="truncate text-xs" style={{ color: style.color }}>
                      {style.emoji} {metalName(s.metal, lang)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.township}, {s.region}
                      {s.report_count > 0
                        ? ` · ⚠ ${s.report_count} ${t.reports}`
                        : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MineCard({
  site,
  lang,
  isAdmin,
  onEdit,
  onReport,
  onDelete,
  onClose,
}: {
  site: Site;
  lang: MLang;
  isAdmin: boolean;
  onEdit: () => void;
  onReport: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = MSTR[lang];
  const style = metalStyle(site.metal);
  const photos = site.photos
    .map(mediaRef)
    .filter((s): s is string => Boolean(s));
  return (
    <section className="overflow-hidden rounded-xl border">
      <div
        className="flex items-start justify-between gap-2 border-b px-4 py-2"
        style={{ backgroundColor: `${style.color}18` }}
      >
        <div>
          <p className="font-bold">
            {style.emoji} {site.name}
          </p>
          <p className="text-xs" style={{ color: style.color }}>
            {metalName(site.metal, lang)} · {t.scales[site.scale]} ·{" "}
            {t.statuses[site.status]}
          </p>
          {site.report_count > 0 ? (
            <p className="text-xs font-semibold text-amber-600">
              ⚠ {site.report_count} {t.reports}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto p-2">
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt={`${site.name} ${i + 1}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-32 w-32 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      ) : null}
      <div className="space-y-1 px-4 py-3 text-sm">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>
            {site.township}, {site.region}
          </span>
        </p>
        <p className="pl-6 text-xs tabular-nums text-muted-foreground">
          {t.coords}: {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
        </p>
        {site.operator ? (
          <p className="text-xs text-muted-foreground">🏗 {site.operator}</p>
        ) : null}
        {site.tags ? (
          <p className="text-xs text-muted-foreground">🏷 {site.tags}</p>
        ) : null}
        {site.description ? (
          <p className="whitespace-pre-wrap pt-1 text-sm leading-relaxed text-muted-foreground">
            {site.description}
          </p>
        ) : null}
        {site.access ? (
          <p className="whitespace-pre-wrap pt-1 text-xs leading-relaxed text-muted-foreground">
            🛣 {t.access}: {site.access}
          </p>
        ) : null}
        {site.hazard ? (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2 text-xs leading-relaxed text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="whitespace-pre-wrap">
              {t.hazard}: {site.hazard}
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t px-4 py-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
        >
          <Crosshair className="h-3.5 w-3.5" /> {t.directions}
        </a>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
        >
          <Pencil className="h-3.5 w-3.5" /> {t.edit}
        </button>
        <button
          type="button"
          onClick={onReport}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold text-amber-600"
        >
          <Flag className="h-3.5 w-3.5" /> {t.report}
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t.del}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Add / edit form. Photos upload straight to the user's media folder through
 * the same helper the post composer uses, so they land under CloudFront and
 * resolve with mediaRef like every other image in the app.
 */
function MineForm({
  lang,
  userId,
  editing,
  onDone,
}: {
  lang: MLang;
  userId: string;
  editing: Site | null;
  onDone: () => void;
}) {
  const t = MSTR[lang];
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    metal: editing?.metal ?? ("tin" as MineMetal),
    name: editing?.name ?? "",
    region: editing?.region ?? "",
    township: editing?.township ?? "",
    scale: editing?.scale ?? ("unknown" as (typeof SCALES)[number]),
    status: editing?.status ?? ("unknown" as (typeof STATUSES)[number]),
    operator: editing?.operator ?? "",
    description: editing?.description ?? "",
    access: editing?.access ?? "",
    hazard: editing?.hazard ?? "",
    tags: editing?.tags ?? "",
  });
  const [photos, setPhotos] = React.useState<string[]>(editing?.photos ?? []);
  const [point, setPoint] = React.useState<{ lat: number; lng: number } | null>(
    editing ? { lat: editing.latitude, lng: editing.longitude } : null,
  );

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const next: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - photos.length)) {
        const up = await uploadMedia(userId, file);
        next.push(up.storage_path);
      }
      setPhotos((p) => [...p, ...next].slice(0, 8));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Couldn't get your location."),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  async function submit() {
    if (
      form.name.trim().length < 2 ||
      form.region.trim().length < 2 ||
      form.township.trim().length < 2 ||
      !point ||
      photos.length === 0
    ) {
      setError(t.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        metal: form.metal,
        name: form.name.trim(),
        region: form.region.trim(),
        township: form.township.trim(),
        latitude: point.lat,
        longitude: point.lng,
        photos,
        scale: form.scale,
        status: form.status,
        operator: form.operator.trim() || undefined,
        description: form.description.trim() || undefined,
        access: form.access.trim() || undefined,
        hazard: form.hazard.trim() || undefined,
        tags: form.tags.trim() || undefined,
      };
      const res = await fetch(
        editing
          ? `/api/mine/sites?id=${encodeURIComponent(editing.id)}`
          : "/api/mine/sites",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const out = (await res.json()) as { error?: string };
      if (!res.ok || out.error) throw new Error(out.error ?? "Failed");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-2 rounded-xl border p-3">
      <div>
        <p className="mb-1 text-xs font-semibold">{t.metal}</p>
        <div className="flex flex-wrap gap-1">
          {MINE_METALS.map((m) => {
            const style = metalStyle(m);
            const on = form.metal === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setForm({ ...form, metal: m })}
                style={on ? { borderColor: style.color, color: style.color } : {}}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  on ? "font-semibold" : "text-muted-foreground"
                }`}
              >
                {style.emoji} {metalName(m, lang)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm sm:col-span-2"
          placeholder={t.name}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={120}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.region}
          value={form.region}
          onChange={(e) => setForm({ ...form, region: e.target.value })}
          maxLength={80}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.township}
          value={form.township}
          onChange={(e) => setForm({ ...form, township: e.target.value })}
          maxLength={80}
        />
        <label className="text-xs text-muted-foreground">
          {t.scale}
          <select
            className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
            value={form.scale}
            onChange={(e) =>
              setForm({
                ...form,
                scale: e.target.value as (typeof SCALES)[number],
              })
            }
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>
                {t.scales[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          {t.status}
          <select
            className="mt-0.5 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as (typeof STATUSES)[number],
              })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t.statuses[s]}
              </option>
            ))}
          </select>
        </label>
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.operator}
          value={form.operator}
          onChange={(e) => setForm({ ...form, operator: e.target.value })}
          maxLength={160}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.tags}
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          maxLength={200}
        />
        <textarea
          className="rounded-md border bg-background px-2 py-1.5 text-sm sm:col-span-2"
          placeholder={t.desc}
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={2000}
        />
        <textarea
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.access}
          rows={2}
          value={form.access}
          onChange={(e) => setForm({ ...form, access: e.target.value })}
          maxLength={800}
        />
        <textarea
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.hazard}
          rows={2}
          value={form.hazard}
          onChange={(e) => setForm({ ...form, hazard: e.target.value })}
          maxLength={800}
        />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold">{t.photos}</p>
        <div className="flex flex-wrap items-center gap-2">
          {photos.map((p) => (
            <div key={p} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaRef(p) ?? ""}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))}
                className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
              >
                ✕
              </button>
            </div>
          ))}
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed text-xl text-muted-foreground">
            {uploading ? "…" : "+"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void addPhotos(e.target.files)}
            />
          </label>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">{t.pickOnMap}</p>
          <button
            type="button"
            onClick={useGps}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
          >
            <Crosshair className="h-3 w-3" /> {t.useGps}
          </button>
        </div>
        <div className="h-56 w-full overflow-hidden rounded-lg border">
          <MineMap
            pins={[]}
            onSelect={() => {}}
            pickMode
            onPick={(lat, lng) => setPoint({ lat, lng })}
            focus={point}
          />
        </div>
        {point ? (
          <p className="pt-1 text-[11px] tabular-nums text-muted-foreground">
            📍 {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={busy || uploading}
        onClick={() => void submit()}
        className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? t.saving : t.save}
      </button>
    </section>
  );
}
