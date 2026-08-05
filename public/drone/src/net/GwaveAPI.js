// net/GwaveAPI.js — gwave ecosystem client bridge (tasks 7.1, 7.3, 7.4, 7.5)
// Token: gwave.cc က iframe/redirect နဲ့ ?token=<cognito_id_token> ပေး
//        (dev: localStorage 'gwave_token' သို့ ?token=)
export class GwaveAPI {
  constructor(vo) {
    this.vo = vo;
    const params = new URLSearchParams(location.search);
    // on gwave.cc the api rides the same origin behind Caddy (/drone-api/*)
    this.base = params.get('api')
      ?? (location.hostname === 'localhost' ? 'http://localhost:8788' : '/drone-api');
    this.token = params.get('token') ?? this._cookieToken() ?? this._storedToken();
    this.profile = null;
  }
  // gwave.cc web session: gw_at (app ES256 data token) is a non-httpOnly
  // cookie — same credential the data client uses, verified by AUTH_MODE=gwave
  _cookieToken() {
    const m = document.cookie.match(/(?:^|;\s*)gw_at=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
  _storedToken() {
    try { return localStorage.getItem('gwave_token'); } catch { return null; }
  }
  saveToken(t) {
    this.token = t;
    try { localStorage.setItem('gwave_token', t); } catch {}
  }
  get authed() { return !!this.profile; }

  async _fetch(path, opts = {}) {
    const res = await fetch(this.base + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}),
        ...opts.headers,
      },
    });
    if (!res.ok) throw new Error('api ' + res.status);
    return res.json();
  }

  // login flow: /me → profile + stats + avatar GLB URL (7.4)
  async login() {
    try {
      this.profile = await this._fetch('/me');
      this.vo?.(`gwave login ✓ — ${this.profile.display_name} (kills ${this.profile.kills})`, 'wave');
      return this.profile;
    } catch (e) {
      this.profile = null;
      return null;
    }
  }

  // drone build sync (7.3)
  async pullDroneConfig() {
    try { return await this._fetch('/me/drone-config'); } catch { return null; }
  }
  async pushDroneConfig(build, rates) {
    try {
      await this._fetch('/me/drone-config', { method: 'PUT',
        body: JSON.stringify({ build, rates }) });
      return true;
    } catch { return false; }
  }

  async setName(name) {
    try { await this._fetch('/me/name', { method: 'PUT', body: JSON.stringify({ name }) }); }
    catch {}
  }

  // leaderboard (7.5) — auth မလို
  async leaderboard(limit = 10) {
    try {
      const res = await fetch(`${this.base}/leaderboard?limit=${limit}`);
      return await res.json();
    } catch { return []; }
  }
}

// ============================================================
// ai/NPCDialogue — OpenClaw AI NPC (task 7.9)
// openclaw.gwave.cc → Anthropic API gateway · offline fallback canned replies
export class NPCDialogue {
  constructor(vo) {
    this.vo = vo;
    const params = new URLSearchParams(location.search);
    this.endpoint = params.get('ai');          // e.g. https://openclaw.gwave.cc/v1/messages
    this.history = [];
    this.busy = false;
    this.persona = 'မင်းက GWAVE COMBAT game ထဲက Drone Valley စခန်းမှူး "ဦးလှ" ဆိုတဲ့ NPC ဖြစ်တယ်။ ' +
      'မြန်မာလိုပဲ တိုတိုပြန်ဖြေ (စာကြောင်း ၂ ကြောင်းထက်မပို)။ ကစားသမားကို drone ပျံနည်း၊ ' +
      'garage ပြင်နည်း၊ wave mode ကစားနည်း လမ်းညွှန်ပေး။ စစ်မြေပြင်ဇာတ်ကောင်လို ရဲရဲတောက်ပြော။';
    this.fallbacks = [
      'ဒီနေ့ လေကောင်းတယ် — drone စမ်းပျံဖို့ အချိန်ကောင်းပဲ။ [F] နှိပ်ပြီးတက်လိုက်။',
      'Garage ထဲမှာ 7-blade prop စမ်းကြည့် — cinematic ပျံရတာ ချောတယ်။ [B] နှိပ်။',
      'ရန်သူတွေလာရင် mine အရင်ထောင်ထား — [4] နဲ့ထောင်၊ ခွေးကိုတော့ သတိထား။',
      'Payload arm ဖြစ်ဖို့ 30m ပျံရမယ် — RSSI ကျရင် ပြန်လှည့်၊ link ပြတ်ရင် drone ဆုံးမယ်။',
      'Jammer zone ထဲမဝင်နဲ့ — အနီစက်ဝိုင်းမြင်ရင် ရှောင်၊ ဒါမှမဟုတ် ပစ်ဖျက်။',
    ];
  }

  async ask(text) {
    if (this.busy) return;
    this.busy = true;
    this.vo?.('ဦးလှ စဉ်းစားနေ…', 'info');
    try {
      if (!this.endpoint) throw new Error('offline');
      this.history.push({ role: 'user', content: text });
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          system: this.persona,
          messages: this.history.slice(-8),
        }),
      });
      const data = await res.json();
      const reply = (data.content ?? []).filter(c => c.type === 'text')
        .map(c => c.text).join('\n').trim() || this._fallback();
      this.history.push({ role: 'assistant', content: reply });
      this.vo?.('ဦးလှ: ' + reply, 'wave');
    } catch (_) {
      this.vo?.('ဦးလှ: ' + this._fallback(), 'wave');
    }
    this.busy = false;
  }

  _fallback() {
    return this.fallbacks[(Math.random() * this.fallbacks.length) | 0];
  }
}
