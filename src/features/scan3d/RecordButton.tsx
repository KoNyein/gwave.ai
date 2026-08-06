"use client";

/// ⏺ Pro-scanner record ခလုတ် — LiDAR app style: အဖြူကွင်း + အနီဝိုင်း။
/// Scanner စာမျက်နှာအားလုံး (room/object/avatar) တစ်ပုံစံတည်း သုံးတယ်။

export function RecordButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label ?? "ရိုက်မယ်"}
        className="flex items-center justify-center rounded-full border-4 border-white/90 transition active:scale-95 disabled:opacity-40"
        style={{ width: 64, height: 64 }}
      >
        <span className="block h-12 w-12 rounded-full bg-red-500" />
      </button>
      {label && <span className="text-[11px] text-white/70">{label}</span>}
    </div>
  );
}
