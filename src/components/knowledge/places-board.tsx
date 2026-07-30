"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Crosshair,
  Flag,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import "leaflet/dist/leaflet.css";
import { mediaRef } from "@/lib/media-url";
import { uploadMedia } from "@/lib/media";
import type { PlacePin } from "./places-map-inner";

const PlacesMap = dynamic(() => import("./places-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

/**
 * The community cannabis map: find a dispensary, farm or clinic; add one; fix
 * one; report a bad listing. Every user contributes, an admin removes.
 *
 * A listing is only accepted complete — name, kind, address, phone, exact
 * coordinates and at least one photo — so the form refuses to submit until it
 * is, and says which field is missing rather than failing silently at the API.
 */

interface Place {
  id: string;
  kind: "shop" | "farm" | "clinic";
  name: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  photos: string[];
  description: string | null;
  hours: string | null;
  website: string | null;
  tags: string | null;
  city: string | null;
  country: string;
  report_count: number;
  updated_at: string;
}

type Lang = "my" | "en" | "th";

const T = {
  my: {
    title: "ဆေးခြောက်ဆိုင် / စိုက်ခင်း / ကလင်းနစ် မြေပုံ",
    all: "အားလုံး",
    shop: "🏪 ဆိုင်",
    farm: "🌱 စိုက်ခင်း",
    clinic: "🏥 ကလင်းနစ်",
    add: "+ နေရာအသစ် ထည့်",
    close: "ပိတ်မည်",
    save: "သိမ်းမည်",
    saving: "သိမ်းနေသည်…",
    edit: "ပြင်မည်",
    report: "တိုင်ကြားမည်",
    del: "ဖျက်မည်",
    name: "အမည် *",
    address: "လိပ်စာ အတိအကျ *",
    phone: "ဖုန်းနံပါတ် *",
    photos: "ဓာတ်ပုံ (၁ ပုံအနည်းဆုံး) *",
    pickOnMap: "မြေပုံပေါ် နှိပ်၍ တည်နေရာ ရွေးပါ *",
    useGps: "ကျွန်ုပ်တည်နေရာ သုံးမည်",
    hours: "ဖွင့်ချိန် (ဥပမာ — 09:00–22:00)",
    website: "Website / Facebook",
    tags: "အမျိုးအစား (ဥပမာ — delivery, medical, CBD)",
    city: "မြို့",
    desc: "အကြောင်းအရာ",
    required:
      "ဖြည့်ရန် လိုအပ်သည် — အမည်၊ လိပ်စာ၊ ဖုန်း၊ တည်နေရာနှင့် ဓာတ်ပုံ ၁ ပုံ။",
    empty:
      "နေရာ မရှိသေးပါ — ပထမဆုံး ထည့်သူ ဖြစ်လိုက်ပါ။ ဆိုင်/စိုက်ခင်း/ကလင်းနစ် ကို ဓာတ်ပုံ၊ လိပ်စာ၊ ဖုန်းနှင့်တကွ ထည့်ပါ။",
    reportPrompt: "အကြောင်းရင်း (ဥပမာ — ပိတ်သွားပြီ / လိပ်စာမှား / အတုအယောင်)",
    reported: "တိုင်ကြားပြီးပါပြီ — admin စစ်ဆေးပါလိမ့်မယ်။",
    reports: "တိုင်ကြားချက်",
    hint: "အချက်အလက် မှားနေရင် ပြင်လို့ရပါတယ် — user တိုင်း ပြင်ခွင့်ရှိသည်။ မှားတဲ့/အတုအယောင် နေရာများကို တိုင်ကြားပါ — admin ဖျက်ပါလိမ့်မယ်။",
    directions: "လမ်းညွှန်",
    call: "ဖုန်းဆက်",
  },
  en: {
    title: "Cannabis shops / farms / clinics map",
    all: "All",
    shop: "🏪 Shops",
    farm: "🌱 Farms",
    clinic: "🏥 Clinics",
    add: "+ Add a place",
    close: "Close",
    save: "Save",
    saving: "Saving…",
    edit: "Edit",
    report: "Report",
    del: "Delete",
    name: "Name *",
    address: "Full address *",
    phone: "Phone *",
    photos: "Photos (at least 1) *",
    pickOnMap: "Tap the map to set the exact location *",
    useGps: "Use my location",
    hours: "Opening hours (e.g. 09:00–22:00)",
    website: "Website / Facebook",
    tags: "Tags (e.g. delivery, medical, CBD)",
    city: "City",
    desc: "Description",
    required:
      "Required — name, address, phone, location and at least one photo.",
    empty:
      "No places yet — be the first. Add a shop, farm or clinic with photos, address and phone.",
    reportPrompt: "Reason (e.g. closed down / wrong address / fake)",
    reported: "Reported — an admin will review it.",
    reports: "reports",
    hint: "Anything wrong? Any user can fix a listing. Report fake or wrong entries and an admin will remove them.",
    directions: "Directions",
    call: "Call",
  },
  th: {
    title: "แผนที่ร้านกัญชา / ฟาร์ม / คลินิก",
    all: "ทั้งหมด",
    shop: "🏪 ร้าน",
    farm: "🌱 ฟาร์ม",
    clinic: "🏥 คลินิก",
    add: "+ เพิ่มสถานที่",
    close: "ปิด",
    save: "บันทึก",
    saving: "กำลังบันทึก…",
    edit: "แก้ไข",
    report: "รายงาน",
    del: "ลบ",
    name: "ชื่อ *",
    address: "ที่อยู่แบบเต็ม *",
    phone: "เบอร์โทร *",
    photos: "รูปภาพ (อย่างน้อย 1 รูป) *",
    pickOnMap: "แตะบนแผนที่เพื่อระบุพิกัดที่แน่นอน *",
    useGps: "ใช้ตำแหน่งของฉัน",
    hours: "เวลาเปิด (เช่น 09:00–22:00)",
    website: "เว็บไซต์ / เฟซบุ๊ก",
    tags: "แท็ก (เช่น delivery, medical, CBD)",
    city: "เมือง",
    desc: "รายละเอียด",
    required: "ต้องกรอก — ชื่อ ที่อยู่ เบอร์โทร พิกัด และรูปอย่างน้อย 1 รูป",
    empty:
      "ยังไม่มีสถานที่ — เป็นคนแรกเลย เพิ่มร้าน ฟาร์ม หรือคลินิก พร้อมรูป ที่อยู่ และเบอร์โทร",
    reportPrompt: "เหตุผล (เช่น ปิดกิจการ / ที่อยู่ผิด / ปลอม)",
    reported: "รายงานแล้ว — ผู้ดูแลจะตรวจสอบ",
    reports: "รายงาน",
    hint: "ข้อมูลผิด? ผู้ใช้ทุกคนแก้ไขได้ รายงานรายการปลอมหรือผิด ผู้ดูแลจะลบให้",
    directions: "เส้นทาง",
    call: "โทร",
  },
} as const;

const KINDS = ["shop", "farm", "clinic"] as const;

export function PlacesBoard({
  isAdmin = false,
  userId,
}: {
  isAdmin?: boolean;
  userId: string;
}) {
  const [places, setPlaces] = React.useState<Place[]>([]);
  const [filter, setFilter] = React.useState<"all" | (typeof KINDS)[number]>(
    "all",
  );
  const [selected, setSelected] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Place | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lang, setLang] = React.useState<Lang>("my");

  React.useEffect(() => {
    const saved = window.localStorage.getItem("gwave-cmkt-lang");
    if (saved === "en" || saved === "my" || saved === "th") setLang(saved);
  }, []);
  const t = T[lang];

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/cannabis/places");
      if (res.ok) {
        const body = (await res.json()) as { places: Place[] };
        setPlaces(body.places);
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

  const shown = places.filter((p) => filter === "all" || p.kind === filter);
  const pins: PlacePin[] = shown.map((p) => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    city: p.city,
  }));
  const active = places.find((p) => p.id === selected) ?? null;

  async function report(place: Place) {
    const reason = window.prompt(t.reportPrompt);
    if (!reason || reason.trim().length < 3) return;
    await fetch("/api/cannabis/places/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: place.id, reason: reason.trim() }),
    }).catch(() => {});
    window.alert(t.reported);
    void load();
  }

  async function remove(place: Place) {
    if (!window.confirm(`${t.del}: ${place.name}?`)) return;
    await fetch(`/api/cannabis/places?id=${encodeURIComponent(place.id)}`, {
      method: "DELETE",
    }).catch(() => {});
    setSelected(null);
    void load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(["all", ...KINDS] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? t.all : t[k]}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
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
            {formOpen ? t.close : (
              <>
                <Plus className="h-3.5 w-3.5" /> {t.add}
              </>
            )}
          </button>
        </div>
      </div>

      {formOpen ? (
        <PlaceForm
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
        <PlacesMap pins={pins} onSelect={(id) => setSelected(id)} />
      </div>

      {active ? (
        <PlaceCard
          place={active}
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

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t.hint}
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`flex gap-3 rounded-xl border p-2 text-left transition-colors hover:bg-muted/40 ${
                selected === p.id ? "border-primary" : ""
              }`}
            >
              {mediaRef(p.photos[0]) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaRef(p.photos[0])!}
                  alt={p.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                  {p.kind === "shop" ? "🏪" : p.kind === "farm" ? "🌱" : "🏥"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.city ? `${p.city} · ` : ""}
                  {p.address}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.phone}
                  {p.report_count > 0
                    ? ` · ⚠ ${p.report_count} ${t.reports}`
                    : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceCard({
  place,
  lang,
  isAdmin,
  onEdit,
  onReport,
  onDelete,
  onClose,
}: {
  place: Place;
  lang: Lang;
  isAdmin: boolean;
  onEdit: () => void;
  onReport: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = T[lang];
  const photos = place.photos
    .map(mediaRef)
    .filter((s): s is string => Boolean(s));
  return (
    <section className="overflow-hidden rounded-xl border">
      <div className="flex items-start justify-between gap-2 border-b bg-muted/40 px-4 py-2">
        <div>
          <p className="font-bold">
            {place.kind === "shop" ? "🏪" : place.kind === "farm" ? "🌱" : "🏥"}{" "}
            {place.name}
          </p>
          {place.report_count > 0 ? (
            <p className="text-xs font-semibold text-amber-600">
              ⚠ {place.report_count} {t.reports}
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
              alt={`${place.name} ${i + 1}`}
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
            {place.address}
            {place.city ? `, ${place.city}` : ""}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
          <a href={`tel:${place.phone}`} className="text-primary hover:underline">
            {place.phone}
          </a>
        </p>
        {place.hours ? (
          <p className="text-xs text-muted-foreground">🕘 {place.hours}</p>
        ) : null}
        {place.tags ? (
          <p className="text-xs text-muted-foreground">🏷 {place.tags}</p>
        ) : null}
        {place.website ? (
          <a
            href={
              place.website.startsWith("http")
                ? place.website
                : `https://${place.website}`
            }
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="block truncate text-xs text-primary hover:underline"
          >
            🔗 {place.website}
          </a>
        ) : null}
        {place.description ? (
          <p className="whitespace-pre-wrap pt-1 text-sm leading-relaxed text-muted-foreground">
            {place.description}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t px-4 py-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
        >
          <Crosshair className="h-3.5 w-3.5" /> {t.directions}
        </a>
        <a
          href={`tel:${place.phone}`}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
        >
          <Phone className="h-3.5 w-3.5" /> {t.call}
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
function PlaceForm({
  lang,
  userId,
  editing,
  onDone,
}: {
  lang: Lang;
  userId: string;
  editing: Place | null;
  onDone: () => void;
}) {
  const t = T[lang];
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    kind: editing?.kind ?? ("shop" as (typeof KINDS)[number]),
    name: editing?.name ?? "",
    address: editing?.address ?? "",
    phone: editing?.phone ?? "",
    city: editing?.city ?? "",
    hours: editing?.hours ?? "",
    website: editing?.website ?? "",
    tags: editing?.tags ?? "",
    description: editing?.description ?? "",
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
      form.address.trim().length < 5 ||
      form.phone.trim().length < 6 ||
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
        kind: form.kind,
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        latitude: point.lat,
        longitude: point.lng,
        photos,
        city: form.city.trim() || undefined,
        hours: form.hours.trim() || undefined,
        website: form.website.trim() || undefined,
        tags: form.tags.trim() || undefined,
        description: form.description.trim() || undefined,
      };
      const res = await fetch(
        editing
          ? `/api/cannabis/places?id=${encodeURIComponent(editing.id)}`
          : "/api/cannabis/places",
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
      <div className="flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setForm({ ...form, kind: k })}
            className={`rounded-full border px-3 py-0.5 text-xs ${
              form.kind === k
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground"
            }`}
          >
            {t[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.name}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          maxLength={120}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.phone}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          maxLength={40}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm sm:col-span-2"
          placeholder={t.address}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          maxLength={300}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.city}
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          maxLength={80}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.hours}
          value={form.hours}
          onChange={(e) => setForm({ ...form, hours: e.target.value })}
          maxLength={120}
        />
        <input
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
          placeholder={t.website}
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
          maxLength={300}
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
          maxLength={1500}
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
          <PlacesMap
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
