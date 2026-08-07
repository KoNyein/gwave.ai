// ============================================================
// GwaveAuth.js — gwave.cc Cognito Login Token ရယူခြင်း
// ဂိမ်းကို gwave.cc မှ ဖွင့်ပေးချိန် token ကို ဒီအစဉ်အတိုင်း ရှာသည် —
//   ၁။ URL ?token=...        (gwave.cc က ဖွင့်ပေးချိန် ထည့်ပေး)
//   ၂။ URL #id_token=...     (Cognito Hosted UI redirect)
//   ၃။ localStorage 'gwave_id_token'
// မတွေ့လျှင် null — server AUTH_MODE=off ဆိုလျှင် အဆင်ပြေသည်
// ============================================================
export function getGwaveToken() {
  const params = new URLSearchParams(location.search);
  if (params.get('token')) {
    localStorage.setItem('gwave_id_token', params.get('token'));
    return params.get('token');
  }
  if (location.hash.includes('id_token=')) {
    const h = new URLSearchParams(location.hash.slice(1));
    const t = h.get('id_token');
    if (t) {
      localStorage.setItem('gwave_id_token', t);
      history.replaceState(null, '', location.pathname + location.search);
      return t;
    }
  }
  return localStorage.getItem('gwave_id_token');
}

// Token ထဲက username ကို ဖတ် (display သက်သက် — စစ်ဆေးမှုက server ဘက်မှာ)
export function getTokenName(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload['cognito:username'] || payload.username || payload.email || null;
  } catch { return null; }
}
