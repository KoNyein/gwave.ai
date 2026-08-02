"use client";

/// Gwave Edu Arcade — three.js ပညာရေး ဂိမ်းစုစည်းမှု။
///
/// ရှိပြီးသား HTML learning games တွေရဲ့ 3D မျိုးဆက် — engine တစ်ခုတည်းပေါ်
/// game ၁၀ ခု။ PC / iPad / ဖုန်း အားလုံး tap တစ်ခုတည်းနဲ့ ကစားလို့ရတယ်။
///
/// ★ Game logic အားလုံး client — server မလို၊ offline လည်း ကစားလို့ရတယ်။
/// ★ အမှတ်တွေက localStorage သာ — ကလေးတွေရဲ့ ဒေတာ ဘာမှ မပို့ဘူး။

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { fetchBests, questEvent, questsToday, refreshQuests, syncBest, type QuestView } from "@/lib/quests";

import { createArcade, emojiTexture, makeSynth, textTexture, type Synth } from "./engine";
import { ALL_GAMES, MEMORY_EMOJI, PICK_GAMES, WORDS, type Choice, type PickGame } from "./games";

const HS_KEY = "gw-arcade-best";

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(HS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}
function saveBest(id: string, score: number) {
  try {
    const b = loadBest();
    if (score > (b[id] ?? 0)) {
      b[id] = score;
      window.localStorage.setItem(HS_KEY, JSON.stringify(b));
    }
  } catch {
    /* ignore */
  }
}

/// ရွေးစရာ object တစ်ခု ဆောက် — emoji=မျှောစက်ဘူး၊ text=တုံး၊ color=ကျောက်တုံး
function buildChoice(c: Choice): THREE.Group {
  const g = new THREE.Group();
  if (c.color) {
    const crystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({
        color: c.color,
        roughness: 0.25,
        metalness: 0.15,
        emissive: c.color,
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
    );
    g.add(crystal);
  } else if (c.emoji) {
    // ပုလင်းသီး bubble + emoji sprite
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0x8fb7ff,
        transparent: true,
        opacity: 0.18,
        roughness: 0.2,
      }),
    );
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: emojiTexture(c.emoji), transparent: true }),
    );
    spr.scale.setScalar(1.35);
    g.add(bubble, spr);
  } else {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 0.35),
      new THREE.MeshStandardMaterial({
        map: textTexture(c.text ?? "?", { bg: "#22345e", fg: "#ffffff" }),
        roughness: 0.5,
      }),
    );
    g.add(box);
  }
  return g;
}

type Screen = "hub" | "play" | "end";

export function EduArcade() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [screen, setScreen] = useState<Screen>("hub");
  const [gameId, setGameId] = useState<string>("math");
  const [prompt, setPrompt] = useState("");
  const [sub, setSub] = useState<string | undefined>();
  const [round, setRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});
  const [quests, setQuests] = useState<QuestView[]>([]);
  const synthRef = useRef<Synth | null>(null);

  useEffect(() => {
    setBest(loadBest());
    setQuests(questsToday());
    synthRef.current = makeSynth();
  }, []);

  // Hub ပြန်ရောက်တိုင်း — quest + server best တွေ ဆွဲ merge (signed-in မှသာ
  // server က ပြန်လာတယ်၊ မဟုတ်ရင် local အတိုင်း ဆက်သွား)
  useEffect(() => {
    if (screen !== "hub") return;
    let alive = true;
    void refreshQuests().then((q) => {
      if (alive) setQuests(q);
    });
    void fetchBests().then((remote) => {
      if (!alive) return;
      setBest((local) => {
        const merged = { ...local };
        for (const [k, v] of Object.entries(remote)) {
          if (k.startsWith("arcade-")) {
            const id = k.slice(7);
            merged[id] = Math.max(merged[id] ?? 0, v.best);
          }
        }
        return merged;
      });
    });
    return () => {
      alive = false;
    };
  }, [screen]);

  // ── Game scene ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== "play") return;
    const mount = mountRef.current;
    if (!mount) return;
    const arcade = createArcade(mount);
    const synth = synthRef.current ?? makeSynth();
    synth.unlock();

    const game = ALL_GAMES.find((x) => x.id === gameId) ?? PICK_GAMES[0]!;
    let objects: THREE.Group[] = [];
    let disposed = false;
    let localScore = 0;

    const clearObjects = () => {
      for (const o of objects) arcade.scene.remove(o);
      objects = [];
      arcade.clearPickables();
    };

    const finish = () => {
      if (disposed) return;
      synth.win();
      for (let i = 0; i < 5; i++) {
        arcade.confetti(new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 2, (Math.random() - 0.5) * 3));
      }
      saveBest(game.id, localScore);
      setBest(loadBest());
      setScore(localScore);
      // Quest + cross-device sync — signed-in ဖြစ်ရင် server မှာပါ မှတ်တယ်
      questEvent("arcade_play");
      if (localScore > 0) questEvent("arcade_stars", localScore);
      syncBest(`arcade-${game.id}`, localScore);
      setTimeout(() => setScreen("end"), 900);
    };

    // Object တွေကို မျဉ်းခုံးပေါ် စီပြီး ဝင်လာတဲ့ animation
    const layout = (groups: THREE.Group[]) => {
      const n = groups.length;
      groups.forEach((g, i) => {
        const x = (i - (n - 1) / 2) * 2.6;
        g.position.set(x, 2.1, 0);
        g.scale.setScalar(0.01);
        arcade.add(g);
      });
    };

    // ── Pick game flow ────────────────────────────────────────────────
    if (game.kind === "pick") {
      const pg = game as PickGame;
      setTotalRounds(pg.rounds);
      setScore(0);
      let r = 0;
      let wrongThisRound = false;
      let advancing = false;

      const nextRound = () => {
        if (disposed) return;
        advancing = false;
        if (r >= pg.rounds) {
          finish();
          return;
        }
        r += 1;
        setRound(r);
        wrongThisRound = false;
        clearObjects();
        const rd = pg.gen();
        setPrompt(rd.prompt);
        setSub(rd.sub);
        rd.choices.forEach((c, i) => {
          const g = buildChoice(c);
          objects.push(g);
          arcade.pickable(g, c.correct ? "ok" : `no-${i}`);
        });
        layout(objects);
      };

      arcade.onTap((id, obj) => {
        if (advancing) return;
        if (id === "ok") {
          advancing = true;
          synth.pop();
          if (!wrongThisRound) {
            localScore += 1;
            setScore(localScore);
          }
          arcade.confetti(obj.position.clone());
          obj.scale.setScalar(0.01);
          setTimeout(nextRound, 500);
        } else {
          wrongThisRound = true;
          synth.buzz();
          arcade.shake(obj);
        }
      });
      nextRound();
    }

    // ── Word builder ──────────────────────────────────────────────────
    if (game.kind === "word") {
      const session = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 5);
      setTotalRounds(session.length);
      setScore(0);
      let wi = 0;
      let progress = 0;
      let wrong = false;

      const nextWord = () => {
        if (disposed) return;
        if (wi >= session.length) {
          finish();
          return;
        }
        const w = session[wi]!;
        wi += 1;
        setRound(wi);
        progress = 0;
        wrong = false;
        clearObjects();
        setPrompt(`${w.emoji}  ${w.my}`);
        setSub("စာလုံးတွေကို အစဉ်လိုက် နှိပ်ပါ");
        const letters = w.word.split("").map((ch, idx) => ({ ch, idx }));
        letters.sort(() => Math.random() - 0.5);
        for (const L of letters) {
          const g = buildChoice({ text: L.ch, correct: false });
          objects.push(g);
          arcade.pickable(g, `L${L.idx}`);
        }
        layout(objects);
      };

      arcade.onTap((id, obj) => {
        const idx = Number(id.slice(1));
        if (idx === progress) {
          synth.tick();
          progress += 1;
          obj.position.y = 0.9;
          obj.scale.setScalar(0.7);
          if (progress >= session[wi - 1]!.word.length) {
            synth.pop();
            arcade.confetti(new THREE.Vector3(0, 2, 0));
            if (!wrong) {
              localScore += 1;
              setScore(localScore);
            }
            setTimeout(nextWord, 650);
          }
        } else if (!Number.isNaN(idx)) {
          wrong = true;
          synth.buzz();
          arcade.shake(obj);
        }
      });
      nextWord();
    }

    // ── Memory match ──────────────────────────────────────────────────
    if (game.kind === "memory") {
      const pairs = [...MEMORY_EMOJI].sort(() => Math.random() - 0.5).slice(0, 6);
      const deck = [...pairs, ...pairs].sort(() => Math.random() - 0.5);
      setTotalRounds(deck.length / 2);
      setRound(0);
      setScore(0);
      setPrompt("တူတဲ့အတွဲ ရှာပါ");
      setSub(undefined);
      let openA: number | null = null;
      let lock = false;
      let found = 0;
      let moves = 0;
      const cards: { g: THREE.Group; emoji: string; open: boolean; done: boolean }[] = [];

      deck.forEach((emoji, i) => {
        const g = new THREE.Group();
        const back = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.8, 0.12),
          new THREE.MeshStandardMaterial({
            map: textTexture("?", { bg: "#31498a", fg: "#9db8ff" }),
            roughness: 0.5,
          }),
        );
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(1.25, 1.6),
          new THREE.MeshStandardMaterial({ map: emojiTexture(emoji), transparent: true }),
        );
        face.position.z = -0.09;
        face.rotation.y = Math.PI;
        g.add(back, face);
        const col = i % 4;
        const row = Math.floor(i / 4);
        // အောက်ဆုံးတန်း မြေအောက် မရောက်အောင် y ကို 0.4 မှ စတယ်
        g.position.set((col - 1.5) * 1.9, 4.6 - row * 2.1, 0);
        arcade.add(g);
        arcade.pickable(g, String(i));
        cards.push({ g, emoji, open: false, done: false });
      });

      arcade.onTap((id) => {
        const i = Number(id);
        const c = cards[i];
        if (!c || lock || c.open || c.done) return;
        synth.tick();
        c.open = true;
        if (openA === null) {
          openA = i;
          return;
        }
        const a = cards[openA]!;
        openA = null;
        moves += 1;
        if (a.emoji === c.emoji) {
          a.done = true;
          c.done = true;
          found += 1;
          setRound(found);
          synth.pop();
          arcade.confetti(c.g.position.clone());
          if (found >= deck.length / 2) {
            localScore = Math.max(1, deck.length - moves + 6);
            finish();
          }
        } else {
          lock = true;
          setTimeout(() => {
            a.open = false;
            c.open = false;
            lock = false;
          }, 750);
        }
      });

      arcade.onFrame((dt) => {
        for (const c of cards) {
          const want = c.open || c.done ? Math.PI : 0;
          c.g.rotation.y += (want - c.g.rotation.y) * Math.min(1, 10 * dt);
          if (c.done) c.g.position.z += (-1.2 - c.g.position.z) * Math.min(1, 3 * dt);
        }
      });
    }

    // ── ဝင်လာတဲ့ scale + မျှော animation (pick/word အတွက်) ─────────────
    if (game.kind !== "memory") {
      arcade.onFrame((dt, t) => {
        objects.forEach((g, i) => {
          g.scale.setScalar(Math.min(1, g.scale.x + dt * 3));
          g.position.y += Math.sin(t * 1.8 + i * 1.3) * dt * 0.25;
          g.rotation.y += dt * (0.3 + i * 0.07);
        });
      });
    }

    return () => {
      disposed = true;
      arcade.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameId]);

  // Memory မှာ score က rounds ထက် ကျော်နိုင်လို့ 0..3 ကန့်သတ်
  const stars = Math.max(
    0,
    Math.min(3, totalRounds > 0 ? Math.round((score / totalRounds) * 3) : 0),
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#101a33] text-white">
      {screen === "play" && <div ref={mountRef} className="absolute inset-0" />}

      {/* ── HUB ─────────────────────────────────────────────────────────── */}
      {screen === "hub" && (
        <div className="absolute inset-0 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-2xl font-extrabold tracking-tight">
              🎓 Edu Arcade <span className="text-emerald-300">3D</span>
            </h1>
            <p className="mt-1 text-xs text-white/55">
              three.js နဲ့ ဆောက်ထားတဲ့ ပညာရေး ဂိမ်း ၁၀ ခု — ဖုန်း/iPad/PC အားလုံး tap တစ်ခုတည်း။
            </p>

            {/* ── နေ့စဉ် Quest များ ── */}
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-amber-200">📜 ဒီနေ့ Quest များ</span>
                <span className="text-[10px] text-white/40">
                  Login ဝင်ထားရင် device တိုင်း တူညီတယ်
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {quests.map((q) => (
                  <div
                    key={q.id}
                    className={`rounded-xl border p-2.5 ${q.done ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="min-w-0 truncate">
                        {q.emoji} {q.nameMy}
                      </span>
                      <span className={`shrink-0 ${q.done ? "text-emerald-300" : "text-white/50"}`}>
                        {q.done ? `✓ +${q.stars}⭐` : `${q.progress}/${q.target}`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full transition-all ${q.done ? "bg-emerald-400" : "bg-amber-400"}`}
                        style={{ width: `${Math.round((q.progress / q.target) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ALL_GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setGameId(g.id);
                    setScreen("play");
                    synthRef.current?.unlock();
                  }}
                  className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/50"
                >
                  <div className="text-3xl transition group-hover:scale-110">{g.emoji}</div>
                  <div className="mt-2 text-sm font-bold leading-snug">{g.nameMy}</div>
                  <div className="mt-1 text-[11px] leading-snug text-white/50">{g.blurbMy}</div>
                  {best[g.id] !== undefined && (
                    <div className="mt-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                      🏆 အကောင်းဆုံး {best[g.id]}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PLAY HUD ────────────────────────────────────────────────────── */}
      {screen === "play" && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 w-[min(30rem,92vw)] -translate-x-1/2 rounded-2xl bg-black/45 px-4 py-2.5 text-center backdrop-blur">
            <div className="text-lg font-extrabold leading-snug">{prompt}</div>
            {sub && <div className="mt-0.5 text-sm text-white/70">{sub}</div>}
          </div>
          <div className="absolute left-3 top-3 z-10 rounded-full bg-black/45 px-3 py-1.5 text-[12px] backdrop-blur">
            ⭐ {score} · {round}/{totalRounds}
          </div>
          <button
            onClick={() => setScreen("hub")}
            className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[12px] backdrop-blur hover:bg-black/70"
          >
            ← ထွက်မယ်
          </button>
        </>
      )}

      {/* ── END ─────────────────────────────────────────────────────────── */}
      {screen === "end" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#101a33]">
          <div className="w-[min(20rem,90vw)] rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <div className="text-4xl">
              {"⭐".repeat(Math.max(1, stars))}
              <span className="opacity-20">{"⭐".repeat(Math.max(0, 3 - Math.max(1, stars)))}</span>
            </div>
            <div className="mt-3 text-xl font-extrabold">ရမှတ် {score}</div>
            <div className="mt-1 text-xs text-white/55">
              🏆 အကောင်းဆုံး {Math.max(best[gameId] ?? 0, score)}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setScreen("play")}
                className="flex-1 rounded-xl border border-emerald-400/60 bg-emerald-500/25 px-3 py-2 text-sm font-bold text-emerald-100 hover:bg-emerald-500/40"
              >
                🔁 ထပ်ကစား
              </button>
              <button
                onClick={() => setScreen("hub")}
                className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                🎓 ဂိမ်းများ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
