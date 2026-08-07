// ============================================================
// StatsAPI.js — Stats REST API မှ Leaderboard / ကိုယ့် stats ဖတ်ခြင်း
// URL ကို ?api=https://... ဖြင့် ပေးနိုင် (default: localhost:8788)
// ============================================================
export class StatsAPI {
  constructor(baseUrl) { this.base = baseUrl.replace(/\/$/, ''); }

  async leaderboard(limit = 10) {
    const res = await fetch(`${this.base}/leaderboard?limit=${limit}`);
    if (!res.ok) throw new Error('leaderboard fetch failed');
    return (await res.json()).leaderboard;
  }

  async player(key) {
    const res = await fetch(`${this.base}/player/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    return res.json();
  }
}
