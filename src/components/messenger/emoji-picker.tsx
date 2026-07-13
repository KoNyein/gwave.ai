"use client";

import * as React from "react";
import { Clock, Cat, Coffee, Flag, Heart, Plane, Smile } from "lucide-react";

import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

/**
 * A small, dependency-free emoji picker. The full Unicode set is ~3,700 glyphs
 * and every off-the-shelf picker ships it as a few hundred kB of JSON; a curated
 * few hundred covers what people actually send in chat, and costs nothing.
 */
const CATEGORIES = [
  {
    id: "smileys",
    icon: Smile,
    emoji:
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤗 🤭 🤫 🤔 🤐 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖",
  },
  {
    id: "gestures",
    icon: Heart,
    emoji:
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 ✨ 🎉 🎊 👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 💪 🦾 ✍️ 👏 🙌 👐 🤲 🫶 💅 👀 👁️ 🧠 🦷 👅 👄",
  },
  {
    id: "animals",
    icon: Cat,
    emoji:
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🐢 🐍 🦖 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐘 🦏 🐪 🦒 🐄 🐖 🐑 🐓 🦃 🕊️ 🐇 🐁 🌸 🌹 🌻 🌼 🌷 🌱 🌲 🌴 🍀 🍁 🍂 🌾 🌵 ⭐ 🌟 🔥 🌈 ☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 💧 🌊",
  },
  {
    id: "food",
    icon: Coffee,
    emoji:
      "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🌰 🍞 🥐 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍚 🍥 🥠 🍦 🍰 🎂 🧁 🥧 🍫 🍬 🍭 🍩 🍪 ☕ 🍵 🧋 🥤 🧃 🍺 🍻 🥂 🍷 🥃 🍹",
  },
  {
    id: "activity",
    icon: Plane,
    emoji:
      "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛳ 🏹 🎣 🤿 🎿 🛷 🏆 🥇 🥈 🥉 🎯 🎮 🕹️ 🎲 🎰 🎳 🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🚜 🛵 🏍️ 🚲 ✈️ 🚀 🛸 🚁 ⛵ 🚤 🛳️ ⚓ 🚂 🚆 🏠 🏡 🏢 🏥 🏦 🏨 🏫 🏭 🗼 🗽 ⛰️ 🏖️ 🏝️ 🎡 🎢 🎪 🎭 🎨 🎤 🎧 🎼 🎹 🥁 🎸 🎺 🎻",
  },
  {
    id: "objects",
    icon: Flag,
    emoji:
      "📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 ⏰ ⌚ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 🛒 💰 💴 💵 💳 🧾 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧰 🧲 🔫 💊 💉 🩺 🚪 🛏️ 🛋️ 🚽 🚿 🧼 🧽 🔑 🗝️ 🔒 🔓 📌 📎 ✂️ 📏 📐 ✏️ 🖊️ 📝 📚 📖 📰 🗞️ 📅 📆 📊 📈 📉 🗂️ 📁 ✅ ❌ ⚠️ 🚫 ❓ ❗ 💤 🔔 🔕 🎁 🎈 🎀 🕐",
  },
] as const;

const RECENT_LIMIT = 24;

export function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [recent, setRecent] = usePersistentState<string[]>(
    "gw:emoji-recent",
    [],
  );
  const [tab, setTab] = React.useState<string>(
    recent.length > 0 ? "recent" : "smileys",
  );
  const boxRef = React.useRef<HTMLDivElement>(null);

  // Click-away and Escape both close, like every other picker on the web.
  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      // The toggle button lives outside the picker, so a plain outside-click
      // close fought with it: mousedown closed the picker, then the button's
      // click re-opened it, and the smiley could never close what it opened.
      if (target.closest("[data-emoji-toggle]")) return;
      if (!boxRef.current?.contains(target)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function pick(emoji: string) {
    setRecent((prev) =>
      [emoji, ...prev.filter((e) => e !== emoji)].slice(0, RECENT_LIMIT),
    );
    onPick(emoji);
  }

  const tabs = [
    ...(recent.length > 0
      ? [{ id: "recent", icon: Clock, list: recent }]
      : []),
    ...CATEGORIES.map((c) => ({
      id: c.id,
      icon: c.icon,
      list: c.emoji.split(" "),
    })),
  ];
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div
      ref={boxRef}
      className="absolute bottom-full left-0 z-30 mb-2 w-[19rem] overflow-hidden rounded-2xl border bg-popover shadow-xl sm:w-[22rem]"
    >
      <div className="flex gap-0.5 border-b p-1.5">
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg py-1.5 transition-colors",
              active?.id === id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-2">
        {active?.list.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => pick(emoji)}
            className="flex h-9 items-center justify-center rounded-lg text-xl transition-transform hover:scale-125 hover:bg-muted"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
