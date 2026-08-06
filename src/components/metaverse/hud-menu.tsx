"use client";

/// Metaverse HUD ရဲ့ ⚙ Menu — ခလုပ်တွေအားလုံးကို category အလိုက် စုထားတယ်။
///
/// ★ အရင်က ခလုပ်တွေ (Avatar · bloom · အရိပ် · အသံ · 1st/3rd) က ဖန်သားပြင်
///   ညာဘက်မှာ တန်းလျား ဖြန့်ကျဲနေတယ် — ဖုန်းမှာ လောကထဲ မြင်ကွင်းကို
///   ကွယ်တယ်၊ ဘယ်ဟာက ဖွင့်ထား/ပိတ်ထား ဆိုတာလည်း စာသားဖတ်မှ သိရတယ်။
///   အခု category ၄ ခုအောက်မှာ **switch** တွေနဲ့ စုထားတယ် — ဖွင့်/ပိတ်ကို
///   ပုံကြည့်ရုံနဲ့ သိတယ်။
/// ★ Voice (မိုက်) ကို ဒီမှာ ထည့်ထားပေမယ့် **default ပိတ်** ပဲ — ဖွင့်မှသာ
///   အလုပ်လုပ်တယ်၊ ဘယ်တော့မှ record မလုပ်ဘူး။ ၁၈+ ကန့်သတ်ချက်ကို server
///   ဘက်က စစ်တယ် (`state` က denied-age ပြန်လာနိုင်တယ်)。

type VoiceState = "off" | "joining" | "on" | "denied-age" | "denied-auth" | "denied-full";

/// ဖွင့်/ပိတ် switch — ခလုပ်ရဲ့ အခြေအနေကို အရောင်+အခွေရွှေ့မှုနဲ့ ပြတယ်
function Switch({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      data-hud="1"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        disabled
          ? "cursor-not-allowed bg-white/10"
          : on
            ? "bg-emerald-500/80"
            : "bg-white/20 hover:bg-white/30"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? "left-[1.125rem]" : "left-0.5"
        } ${disabled ? "opacity-40" : ""}`}
      />
    </button>
  );
}

/// Switch တစ်ခုပါတဲ့ စာကြောင်း — ခေါင်းစဉ် + ရှင်းလင်းချက်
function Row({
  icon,
  title,
  hint,
  on,
  disabled,
  onChange,
}: {
  icon: string;
  title: string;
  hint?: string;
  on: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="w-5 text-center text-sm leading-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-white/85">{title}</span>
        {hint && <span className="block text-[10px] leading-snug text-white/45">{hint}</span>}
      </span>
      <Switch on={on} disabled={disabled} onChange={onChange} label={title} />
    </div>
  );
}

/// Switch မဟုတ်ဘဲ တခြားမျက်နှာပြင် ဖွင့်ပေးတဲ့ စာကြောင်း
function Action({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: string;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      data-hud="1"
      onClick={onClick}
      className="-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/10"
    >
      <span className="w-5 text-center text-sm leading-none">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-white/85">{title}</span>
        {hint && <span className="block text-[10px] leading-snug text-white/45">{hint}</span>}
      </span>
      <span className="shrink-0 text-[11px] text-white/35">›</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 px-3 py-1.5 first:border-t-0">
      <div className="pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        {title}
      </div>
      {children}
    </div>
  );
}

export function HudMenu({
  open,
  onToggle,
  sound,
  onSound,
  voiceState,
  micOn,
  onVoice,
  onMic,
  fpv,
  onFpv,
  bloom,
  bloomLocked,
  onBloom,
  shadows,
  onShadows,
  onAvatar,
  onPhotoAvatar,
  onMap,
  onGames,
  onBuild,
  mapLabel,
}: {
  open: boolean;
  onToggle: () => void;
  /// 🔊 ပတ်ဝန်းကျင်အသံ (ခြေသံ၊ spatial audio)
  sound: boolean;
  onSound: (on: boolean) => void;
  /// 🎙 Voice chat — အခန်းထဲ ဝင်/ထွက်
  voiceState: VoiceState;
  micOn: boolean;
  onVoice: (on: boolean) => void;
  onMic: (on: boolean) => void;
  fpv: boolean;
  onFpv: (on: boolean) => void;
  bloom: boolean;
  /// စက်နှေးလို့ အလိုအလျောက် လျှော့ချထားရင် ဖွင့်လို့ မရဘူး
  bloomLocked: boolean;
  onBloom: (on: boolean) => void;
  shadows: boolean;
  onShadows: (on: boolean) => void;
  onAvatar: () => void;
  /// 📸 Ready Player Me photo-avatar creator ဖွင့်
  onPhotoAvatar: () => void;
  onMap: () => void;
  onGames: () => void;
  onBuild: () => void;
  mapLabel: string;
}) {
  const voiceOn = voiceState === "on" || voiceState === "joining";
  const voiceDenied = voiceState.startsWith("denied");
  const voiceHint =
    voiceState === "denied-age"
      ? "၁၈ နှစ်အထက်သာ ဝင်လို့ရတယ်"
      : voiceState === "denied-auth"
        ? "Gwave အကောင့်နဲ့ ဝင်ဖို့ လိုတယ်"
        : voiceState === "denied-full"
          ? "အခန်းပြည့်နေတယ်"
          : voiceState === "joining"
            ? "ဝင်နေသည်…"
            : "အခန်းထဲက လူတွေနဲ့ စကားပြော";

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        data-hud="1"
        onClick={onToggle}
        aria-expanded={open}
        title="ဆက်တင်များ"
        className={`rounded-lg border bg-black/50 px-2.5 py-1.5 text-[11px] text-white/80 backdrop-blur transition hover:bg-black/70 ${
          open ? "border-emerald-400/60" : "border-white/15"
        }`}
      >
        ☰ Menu
      </button>

      {open && (
        <div
          data-hud="1"
          className="max-h-[60vh] w-[min(17rem,82vw)] overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-black/75 py-1 backdrop-blur"
        >
          <Section title="🔊 အသံ">
            <Row
              icon="🔈"
              title="စပီကာ"
              hint="ခြေသံ၊ ပတ်ဝန်းကျင်အသံ"
              on={sound}
              onChange={onSound}
            />
            <Row
              icon="🎧"
              title="Voice chat"
              hint={voiceHint}
              on={voiceOn}
              disabled={voiceDenied}
              onChange={onVoice}
            />
            {/* ★ မိုက်က voice ထဲ ဝင်ပြီးမှ ဖွင့်လို့ရတယ်၊ ဝင်တာနဲ့ အလိုအလျောက်
                မဖွင့်ဘူး — မိတ်ဆက်မထားဘဲ အသံထွက်သွားတာ ဆိုးဆုံး အမှား။ */}
            <Row
              icon="🎙"
              title="မိုက်"
              hint={voiceState === "on" ? "ပြောချင်မှ ဖွင့်ပါ" : "Voice chat ဖွင့်ပြီးမှ"}
              on={micOn}
              disabled={voiceState !== "on"}
              onChange={onMic}
            />
          </Section>

          <Section title="👁 မြင်ကွင်း">
            <Row
              icon="🎥"
              title="ကိုယ်တိုင်မြင်ကွင်း (1st)"
              hint={fpv ? "ဇာတ်ကောင်မျက်စိထဲက" : "နောက်ကနေ ကြည့်နေသည် (3rd)"}
              on={fpv}
              onChange={onFpv}
            />
            <Row
              icon="✨"
              title="အလင်းရောင်ဖြာ (bloom)"
              hint={bloomLocked ? "စက်နှေးလို့ ပိတ်ထားသည်" : "ပိတ်ရင် ဖုန်းမှာ ပိုချောတယ်"}
              on={bloom && !bloomLocked}
              disabled={bloomLocked}
              onChange={onBloom}
            />
            <Row
              icon="🌒"
              title="အရိပ်"
              hint="အလေးလံဆုံး ရုပ်ထွက် setting"
              on={shadows}
              onChange={onShadows}
            />
          </Section>

          <Section title="🌍 လောက">
            <Action icon="🗺" title="လောက ပြောင်း" hint={mapLabel} onClick={onMap} />
            <Action icon="🎮" title="ပွဲများ" hint="ဝင်ကြေး မယူပါ" onClick={onGames} />
            <Action icon="🏗" title="ဆောက်မယ်" hint="ကိုယ်ပိုင်ကွက်ပေါ်မှာသာ" onClick={onBuild} />
          </Section>

          <Section title="🧑 ကိုယ်ရေး">
            <Action icon="🧑" title="Avatar ပြင်မယ်" hint="အသွင်အပြင် ရွေးချယ်" onClick={onAvatar} />
            <Action icon="📸" title="Photo Avatar" hint="Selfie ကနေ လူသားရုပ်စစ်စစ်" onClick={onPhotoAvatar} />
          </Section>
        </div>
      )}
    </div>
  );
}
