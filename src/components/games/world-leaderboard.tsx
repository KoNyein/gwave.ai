'use client';
// ============================================================
// world-leaderboard.tsx — Open World (gwave.cc/world) Leaderboard Widget
// GWAVE STRIKE ရဲ့ RDS game.* stats ကို newsfeed card အဖြစ် ဖော်ပြသည်
//
// သုံးနည်း — ဒီဖိုင်ကို gwave.cc repo ရဲ့ components/ ထဲကူးထည့်ပြီး
// newsfeed page ထဲမှာ:
//   import LeaderboardWidget from '@/components/LeaderboardWidget';
//   <LeaderboardWidget />
//
// Tailwind မလိုပါ — inline styles သီးသန့် (မည်သည့် page မှာမဆို အလုပ်လုပ်)
// ============================================================
import { useEffect, useState } from 'react';

type Row = { player_key: string; name: string; kills: number; deaths: number; headshots: number; xp: number };

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardWidget({
  statsBase = '/world-stats',
  playUrl = '/world',
  limit = 5,
  refreshMs = 60_000,
  season = 'weekly', // 'alltime' | 'weekly' | 'monthly'
}: {
  statsBase?: string; playUrl?: string; limit?: number; refreshMs?: number; season?: string;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`${statsBase}/leaderboard?limit=${limit}&season=${season}`)
        .then(r => r.json())
        .then(d => { if (alive) { setRows(d.leaderboard || []); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    load();
    const iv = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(iv); };
  }, [statsBase, limit, refreshMs, season]);

  const S: Record<string, React.CSSProperties> = {
    card: {
      background: 'linear-gradient(160deg,#0b1026,#131c36)', color: '#eaf0ff',
      border: '1px solid #1d2a4d', borderRadius: 14, padding: '16px 18px',
      fontFamily: `'Padauk','Myanmar Text','Noto Sans Myanmar',system-ui,sans-serif`,
      maxWidth: 480, boxShadow: '0 4px 18px rgba(0,0,0,.25)',
    },
    head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    title: { fontSize: 16, fontWeight: 700, color: '#f5c542' },
    live: { fontSize: 11, color: '#3ddc97' },
    row: {
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
      borderBottom: '1px solid #1d2a4d', fontSize: 14,
    },
    rank: { width: 26, textAlign: 'center' as const },
    name: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
    kd: { fontSize: 12, opacity: 0.7, width: 84, textAlign: 'right' as const },
    xp: { color: '#f5c542', fontWeight: 700, width: 70, textAlign: 'right' as const },
    cta: {
      display: 'block', textAlign: 'center' as const, marginTop: 12, padding: '9px 0',
      background: '#f5c542', color: '#1a1200', borderRadius: 8,
      fontWeight: 700, textDecoration: 'none', fontSize: 14,
    },
    dim: { opacity: 0.65, fontSize: 13, padding: '14px 0', textAlign: 'center' as const },
  };

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.title}>🏆 Gwave Open World — {season === 'weekly' ? 'ဒီအပတ်' : season === 'monthly' ? 'ဒီလ' : ''} ထိပ်ဆုံးများ</span>
        <span style={S.live}>● LIVE</span>
      </div>

      {error && <div style={S.dim}>📊 Stats server နှင့် ခဏချိတ်၍မရပါ</div>}
      {!error && rows === null && <div style={S.dim}>Loading…</div>}
      {!error && rows?.length === 0 && (
        <div style={S.dim}>ပထမဆုံး ကစားသမား ဖြစ်လိုက်ပါ — leaderboard လွတ်နေသေးသည်!</div>
      )}

      {!error && rows?.map((r, i) => (
        <div key={r.player_key} style={{ ...S.row, ...(i === rows.length - 1 ? { borderBottom: 'none' } : {}) }}>
          <span style={S.rank}>{MEDALS[i] || `${i + 1}`}</span>
          <span style={S.name}>{r.name}</span>
          <span style={S.kd}>K {r.kills} · D {r.deaths} · 🎯{r.headshots}</span>
          <span style={S.xp}>{r.xp} XP</span>
        </div>
      ))}

      <a href={playUrl} style={S.cta}>🎮 ယခုပဲ ဝင်ကစားမည်</a>
    </div>
  );
}
