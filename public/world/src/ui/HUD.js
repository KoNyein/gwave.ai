// ============================================================
// HUD.js — မျက်နှာပြင်ပေါ်က မြန်မာ UI (room name, hint, dialogue, wallet)
// index.html ထဲက DOM element များကို ထိန်းချုပ်သည်
// ============================================================
export class HUD {
  constructor() {
    this.roomEl   = document.querySelector('#roomName b');
    this.hintEl   = document.querySelector('#hint');
    this.dialogEl = document.querySelector('#dialog');
    this.npcNameEl = document.querySelector('#dialog .npcName');
    this.npcTextEl = document.querySelector('#dialog .npcText');
    this.walletBtn = document.querySelector('#walletBtn');
    this.walletAddr = document.querySelector('#walletAddr');
    this.dialogTimer = null;
  }

  setRoom(title) { this.roomEl.textContent = title; }

  showHint(text) { this.hintEl.textContent = text; this.hintEl.style.display = 'block'; }
  hideHint() { this.hintEl.style.display = 'none'; }

  showDialogue(npcName, text) {
    this.npcNameEl.textContent = npcName;
    this.npcTextEl.textContent = text;
    this.dialogEl.style.display = 'block';
    clearTimeout(this.dialogTimer);
    this.dialogTimer = setTimeout(() => { this.dialogEl.style.display = 'none'; }, 4500);
  }

  /// 📐 Icon နဲ့ စာသားကို သီးသန့် span ခွဲထားတယ် — ကျဉ်းတဲ့ ဖုန်းမှာ CSS က
  /// စာသားကို ဖျောက်ပြီး icon-only ခလုတ် (44px) ဖြစ်သွားလို့ အခန်းနာမည်ကို
  /// မဖုံးတော့ဘူး။
  setWallet(address, short) {
    const icon = address ? '✅' : '🦊';
    const text = address ? 'ချိတ်ဆက်ပြီး' : 'Wallet ချိတ်ဆက်ရန်';
    this.walletBtn.innerHTML =
      `<span class="wIcon">${icon}</span><span class="wTxt">${text}</span>`;
    this.walletAddr.textContent = address ? short : '';
  }

  hideLoading() { document.querySelector('#loading')?.remove(); }
}

// ---------- GWAVE STRIKE Combat HUD ----------
// (index.html ထဲက #combat element များကို ထိန်းချုပ်သည်)
Object.assign(HUD.prototype, {
  setCombatVisible(v) {
    document.querySelector('#combat').style.display = v ? 'block' : 'none';
  },
  setHP(hp) {
    document.querySelector('#hpVal').textContent = hp;
    document.querySelector('#hpFill').style.width = Math.max(0, hp) + '%';
  },
  setAmmo(ammo, mag) {
    document.querySelector('#ammoVal').textContent = `${ammo} / ${mag}`;
  },
  addKill(text) {
    const feed = document.querySelector('#killfeed');
    const el = document.createElement('div');
    el.className = 'panel killItem';
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => el.remove(), 6000);
  },
  flashDamage() {
    const v = document.querySelector('#dmgVignette');
    v.style.opacity = 0.55;
    clearTimeout(this._dmgT);
    this._dmgT = setTimeout(() => { v.style.opacity = 0; }, 180);
  },
});

// ---------- Multiplayer / စနစ် အသိပေးချက်များ ----------
// (killfeed panel ကိုပဲ ပြန်သုံး — combat မဟုတ်ချိန်လည်း ပေါ်နိုင်အောင်)
Object.assign(HUD.prototype, {
  addToast(text) {
    const feed = document.querySelector('#killfeed');
    const el = document.createElement('div');
    el.className = 'panel killItem';
    el.textContent = text;
    feed.prepend(el);
    while (feed.children.length > 4) feed.lastChild.remove();
    setTimeout(() => el.remove(), 6000);
  },
});

// ---------- Leaderboard ([L] key) ----------
Object.assign(HUD.prototype, {
  showLeaderboard(rows, myName) {
    let panel = document.querySelector('#lbPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'lbPanel';
      panel.className = 'panel';
      panel.style.cssText = `left:50%; top:50%; transform:translate(-50%,-50%);
        width:min(420px,92vw); font-size:14px; z-index:6;`;
      document.body.appendChild(panel);
    }
    const medals = ['🥇', '🥈', '🥉'];
    panel.innerHTML =
      `<div style="font-size:17px; margin-bottom:8px;">🏆 <b style="color:var(--gold)">Gwave Leaderboard</b>
        <span style="float:right; opacity:.6; font-size:12px;">L — ပိတ်ရန်</span></div>` +
      (rows.length === 0 ? '<div style="opacity:.7">မှတ်တမ်း မရှိသေးပါ — Arena ထဲမှာ စတိုက်ကြည့်ပါ!</div>' :
        rows.map((r, i) =>
          `<div style="display:flex; gap:8px; padding:4px 0; border-bottom:1px solid var(--line);
             ${r.name === myName ? 'color:var(--jade); font-weight:700;' : ''}">
            <span style="width:28px">${medals[i] || (i + 1) + '.'}</span>
            <span style="flex:1">${r.name}</span>
            <span>⚔️ ${r.kills}</span>
            <span style="opacity:.7">☠️ ${r.deaths}</span>
            <span style="color:var(--gold)">✨ ${r.xp} XP</span>
          </div>`).join(''));
    panel.style.display = 'block';
  },
  hideLeaderboard() {
    const p = document.querySelector('#lbPanel');
    if (p) p.style.display = 'none';
    return p && false;
  },
  leaderboardVisible() {
    const p = document.querySelector('#lbPanel');
    return !!p && p.style.display !== 'none';
  },
});

// ---------- Leaderboard Panel ([L] key) ----------
Object.assign(HUD.prototype, {
  toggleLeaderboard() {
    const p = document.querySelector('#lbPanel');
    const show = p.style.display !== 'block';
    p.style.display = show ? 'block' : 'none';
    return show;
  },
  setLeaderboard(rows, error = null) {
    const el = document.querySelector('#lbContent');
    if (error) { el.textContent = error; return; }
    if (!rows?.length) { el.textContent = 'Stats မရှိသေးပါ — Strike Arena မှာ ကစားကြည့်ပါ!'; return; }
    el.innerHTML = '<table><tr><th>#</th><th>နာမည်</th><th>K</th><th>D</th><th>🎯HS</th><th class="xp">XP</th></tr>' +
      rows.map((r, i) =>
        `<tr><td>${i + 1}</td><td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td>` +
        `<td>${r.headshots}</td><td class="xp">${r.xp}</td></tr>`).join('') + '</table>';
  },
});

// ---------- Economy Panels (Phase 0 — GP / Shop / Quests) ----------
Object.assign(HUD.prototype, {
  setPoints(points) {
    const b = document.querySelector('#gpBadge');
    b.style.display = 'block';
    document.querySelector('#gpVal').textContent = points;
  },
  togglePanel(sel) {
    const p = document.querySelector(sel);
    const show = p.style.display !== 'block';
    p.style.display = show ? 'block' : 'none';
    return show;
  },
  setWalletPanel(wallet, shop, onBuy, nft = null) {
    const el = document.querySelector('#walletContent');
    if (!wallet) { el.textContent = '📊 Stats API မချိတ်နိုင်ပါ'; return; }
    this.setPoints(wallet.points);
    const ownedIds = new Set((wallet.inventory || []).map(i => i.item_id));
    el.innerHTML =
      `<div style="margin-bottom:10px">💰 လက်ကျန် — <b style="color:var(--gold)">${wallet.points} GP</b>
       <span style="opacity:.6;font-size:12px">(kill/quest များမှ ရယူပါ)</span></div>` +
      shop.map(it => `
        <div class="shopItem">
          ${it.color ? `<div class="sw" style="background:${it.color}"></div>` : '<div class="sw">🏷️</div>'}
          <div class="nm">${it.name_mm}<br><span style="opacity:.6;font-size:12px">${it.price} GP</span></div>
          ${ownedIds.has(it.id)
            ? (nft && it.type === 'skin'
                ? `<span class="owned">✅</span> <button data-nft="${it.id}" style="background:#7f5cff;color:#fff">⛓️ NFT</button>`
                : '<span class="owned">✅ ပိုင်ဆိုင်ပြီး</span>')
            : `<button data-item="${it.id}">ဝယ်ရန်</button>`}
        </div>`).join('');
    el.querySelectorAll('button[data-item]').forEach(btn =>
      btn.addEventListener('click', () => { btn.disabled = true; onBuy(btn.dataset.item); }));
    if (nft) el.querySelectorAll('button[data-nft]').forEach(btn =>
      btn.addEventListener('click', () => { btn.disabled = true; nft(btn.dataset.nft); }));
  },
  setQuestsPanel(quests) {
    const el = document.querySelector('#questContent');
    if (!quests?.length) { el.textContent = '📊 Stats API မချိတ်နိုင်ပါ'; return; }
    el.innerHTML = quests.map(q => `
      <div class="questRow">
        <div>${q.claimed ? '✅' : '⬜'} ${q.name_mm}
          <span style="float:right" class="${q.claimed ? 'qdone' : ''}">
            ${q.claimed ? `+${q.reward} GP ရပြီး` : `${q.progress}/${q.target} — ဆု ${q.reward} GP`}
          </span>
        </div>
        <div class="qbar"><div class="qfill" style="width:${Math.round(100 * q.progress / q.target)}%"></div></div>
      </div>`).join('');
  },
});

// ---------- POS Rewards ([I] panel အောက်ပိုင်း) + NFT ----------
Object.assign(HUD.prototype, {
  setRewardsPanel(catalog, redemptions, onRedeem) {
    let el = document.querySelector('#rewardsContent');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rewardsContent';
      document.querySelector('#walletContent').after(el);
    }
    el.innerHTML =
      `<h3 style="margin:14px 0 8px;color:var(--gold);font-size:15px">🎁 ဆိုင်မှာလဲရန် (GP → လက်တွေ့ဆု)</h3>` +
      catalog.map(r => `
        <div class="shopItem">
          <div class="nm">${r.name_mm}<br><span style="opacity:.6;font-size:12px">${r.cost} GP</span></div>
          <button data-reward="${r.id}">လဲမည်</button>
        </div>`).join('') +
      (redemptions.length ? `<h3 style="margin:14px 0 6px;color:var(--jade);font-size:14px">🎟️ ကိုယ့် Code များ</h3>` +
        redemptions.map(r => `
          <div style="font-size:13px;padding:4px 0">
            <b style="color:var(--gold)">${r.code}</b> — ${r.status === 'claimed' ? '✅ သုံးပြီး' : '⏳ ဆိုင်မှာပြရန်'}
          </div>`).join('') : '');
    el.querySelectorAll('button[data-reward]').forEach(btn =>
      btn.addEventListener('click', () => { btn.disabled = true; onRedeem(btn.dataset.reward); }));
  },
});

// ---------- Season Trophy NFTs ([I] panel) ----------
Object.assign(HUD.prototype, {
  setTrophiesSection(trophies, chainMode, onMint) {
    let el = document.querySelector('#trophiesContent');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trophiesContent';
      (document.querySelector('#rewardsContent') || document.querySelector('#walletContent')).after(el);
    }
    if (!trophies.length) { el.innerHTML = ''; return; }
    const medal = (r) => ['🥇', '🥈', '🥉'][r - 1] || '🏅';
    el.innerHTML =
      `<h3 style="margin:14px 0 8px;color:var(--gold);font-size:15px">🏆 Season Trophy NFT များ</h3>` +
      trophies.map(t => `
        <div class="shopItem">
          <div class="nm">${medal(t.rank)} ${t.season} — အဆင့် ${t.rank} (+${t.gp} GP ရခဲ့)</div>
          ${t.minted
            ? '<span class="owned">⛓️ Mint ပြီး</span>'
            : (chainMode === 'off'
                ? '<span style="opacity:.5;font-size:12px">NFT ပိတ်ထား</span>'
                : `<button data-season="${t.season}" style="background:#7f5cff;color:#fff">⛓️ Trophy ထုတ်</button>`)}
        </div>`).join('');
    el.querySelectorAll('button[data-season]').forEach(btn =>
      btn.addEventListener('click', () => { btn.disabled = true; onMint(btn.dataset.season); }));
  },
});

// ---------- Gwave Feed ([N] — FB feed ကို metaverse ထဲ holo panel အဖြစ်ရွှေ့) ----------
Object.assign(HUD.prototype, {
  setFeedPanel(posts) {
    const el = document.querySelector('#feedContent');
    if (!posts?.length) { el.textContent = 'Feed ဗလာနေသေးသည် — ပထမဆုံး post တင်လိုက်ပါ!'; return; }
    el.innerHTML = posts.map(p => `
      <div class="feedCard">
        <span class="when">${p.when || ''}</span>
        <span class="who">${p.who}</span>
        <div class="txt">${p.text}</div>
      </div>`).join('');
  },
});

// ---------- 🎭 Emote Wheel ([G]) + 🏛️ Meeting Panel ----------
Object.assign(HUD.prototype, {
  buildEmoteWheel(emotes, onPick) {
    const wrap = document.querySelector('#emoteWheel');
    // 📐 Radius ကို emote အရေအတွက် **နှင့်** ဖန်သားပြင် အကျယ်ကနေ တွက်တယ်။
    // item တစ်ခု 72px ⇒ စက်ဝိုင်းအပြည့် (2π) မှာ n ခု ထည့်ဖို့ R = 72n/2π。
    // ကျဉ်းတဲ့ ဖုန်းမှာ ဝိုင်းက ဘောင်ကျော်မထွက်အောင် အပေါ်က ကန့်သတ်တယ်။
    const vw = Math.min(window.innerWidth, window.innerHeight);
    const R = Math.min(
      Math.max(96, Math.round((72 * emotes.length) / (2 * Math.PI))),
      Math.round(vw / 2 - 56),
    );
    wrap.innerHTML = '';
    emotes.forEach((em, i) => {
      const a = (i / emotes.length) * Math.PI * 2 - Math.PI / 2;
      const el = document.createElement('button');
      el.className = 'emoteItem';
      const [icon, ...rest] = em.name_mm.split(' ');
      el.innerHTML = `<span class="ei">${icon}</span><span class="el">${rest.join(' ')}</span>`;
      el.style.setProperty('--tx', `${Math.cos(a) * R}px`);
      el.style.setProperty('--ty', `${Math.sin(a) * R}px`);
      el.addEventListener('click', () => { this.toggleEmoteWheel(false); onPick(em.id); });
      wrap.appendChild(el);
    });
  },
  toggleEmoteWheel(force) {
    const wrap = document.querySelector('#emoteWheel');
    const show = force !== undefined ? force : !wrap.classList.contains('open');
    wrap.classList.toggle('open', show);
    return show;
  },
  setMeetingPanel(spaces, active, onCreate, onJoin) {
    const el = document.querySelector('#meetContent');
    el.innerHTML =
      `<div style="font-size:13px;color:var(--dim);margin-bottom:8px">ခန်းမရွေးပြီး အစည်းအဝေးစတင်ပါ — code ကို မျှဝေလိုက်ရုံ</div>
       <div class="spaceGrid">` +
      spaces.map((sp, i) => `
        <div class="spaceCard${i === 0 ? ' active' : ''}" data-space="${sp.id}">
          <div class="spIcon">${sp.name_mm.split(' ')[0]}</div>
          <div class="spNm">${sp.name_mm.replace(/^\S+\s/, '')}</div>
          <div class="spMax">အများဆုံး ${sp.max} ယောက်</div>
        </div>`).join('') + `</div>
      <input id="meetTitle" placeholder="အစည်းအဝေး ခေါင်းစဉ်" maxlength="40">
      <button id="meetStart" class="bigBtn">🏛️ အစည်းအဝေး စတင်မည်</button>
      <div style="margin:16px 0 6px;color:var(--jade);font-size:14px">🔗 Code ဖြင့် ဝင်ရန်</div>
      <input id="meetCode" placeholder="MT-XXXXX" maxlength="12">
      <button id="meetJoin" class="bigBtn ghost">ဝင်မည်</button>` +
      (active?.length ? `<div style="margin:16px 0 6px;color:var(--gold);font-size:14px">🟢 လက်ရှိ အစည်းအဝေးများ</div>` +
        active.map(m => `
          <div class="shopItem">
            <div class="nm">${m.title}<br><span style="opacity:.6;font-size:12px">${m.code} · ${m.count} ယောက် · host ${m.host}</span></div>
            <button data-join="${m.code}">ဝင်မည်</button>
          </div>`).join('') : '');

    let picked = spaces[0]?.id;
    el.querySelectorAll('.spaceCard').forEach(card =>
      card.addEventListener('click', () => {
        picked = card.dataset.space;
        el.querySelectorAll('.spaceCard').forEach(c => c.classList.toggle('active', c === card));
      }));
    el.querySelector('#meetStart').addEventListener('click', () =>
      onCreate(picked, el.querySelector('#meetTitle').value.trim()));
    el.querySelector('#meetJoin').addEventListener('click', () =>
      onJoin(el.querySelector('#meetCode').value.trim()));
    el.querySelectorAll('button[data-join]').forEach(b =>
      b.addEventListener('click', () => onJoin(b.dataset.join)));
  },
});
