// 16 additional educational HTML5 mini-games (brings the built-in set to 20).
// Each `html` is a self-contained document (inline CSS+JS, no network), run in
// the same hardened sandbox as community games. Burmese-primary UI. All JS is
// ES5-style to match the existing games and run everywhere.

import { SHELL, type EduGame } from "@/lib/games/edu-shell";

// ── Shared multiple-choice quiz engine ──────────────────────────────────────
// `genBody` is the body of a JS function that returns { q, opts, a }:
//   q    = question HTML, opts = array of option HTML, a = index of the answer.
// A round shuffles options via the provided `shuf` helper.
function quiz(emoji: string, title: string, genBody: string, rounds = 10): string {
  return `${SHELL}
<h2>${emoji} ${title}</h2>
<p class="bar">အမှတ်: <span id="sc">0</span> / <span id="tot">${rounds}</span></p>
<div id="q" style="font-size:1.5rem;margin:1rem 0;min-height:3rem">—</div>
<div id="opts" class="grid" style="grid-template-columns:1fr 1fr"></div>
<p id="msg" style="height:1.5rem;font-weight:bold"></p>
<script>
var sc=0,n=0,ROUNDS=${rounds},cur,$=function(i){return document.getElementById(i)};
function shuf(a){for(var i=a.length-1;i>0;i--){var j=Math.random()*(i+1)|0;var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function gen(){ ${genBody} }
function draw(){
 if(n>=ROUNDS){$('q').textContent='🎉 ပြီးပါပြီ!';$('opts').innerHTML='';$('msg').textContent='အမှတ် '+sc+' / '+ROUNDS;return;}
 cur=gen();$('q').innerHTML=cur.q;var o=$('opts');o.innerHTML='';$('msg').textContent='';
 cur.opts.forEach(function(op,i){var b=document.createElement('button');b.className='opt';b.innerHTML=op;
  b.onclick=function(){if(b.dataset.done)return;
   var all=o.querySelectorAll('button');for(var k=0;k<all.length;k++)all[k].dataset.done='1';
   if(i===cur.a){b.className='opt ok';sc++;$('sc').textContent=sc;$('msg').textContent='✅ မှန်ပါတယ်';}
   else{b.className='opt no';all[cur.a].className='opt ok';$('msg').textContent='❌';}
   n++;setTimeout(draw,750);};o.appendChild(b);});}
draw();
</script>`;
}

// helper that emits JS building 4 options from a [emoji,name] table
const pickFromTable = (table: string, showEmojiBig = true) => `
var T=${table};var p=T[Math.random()*T.length|0];
var opts=[p[1]],set={};set[p[1]]=1;
while(opts.length<4){var r=T[Math.random()*T.length|0][1];if(!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:${showEmojiBig ? "'<span style=\\'font-size:3.4rem\\'>'+p[0]+'</span>'" : "p[0]"},opts:opts,a:opts.indexOf(p[1])};`;

// ── Quiz games ───────────────────────────────────────────────────────────────
const COUNTING = quiz("🔢", "အရေအတွက် ရေတွက်", `
var e=['🍎','⭐','🐤','🌸','🎈','🍀'][Math.random()*6|0];var k=2+(Math.random()*7|0);
var row=new Array(k+1).join(e);
var opts=[k],set={};set[k]=1;while(opts.length<4){var r=2+(Math.random()*8|0);if(!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:'ဘယ်နှစ်ခု ရှိလဲ?<br><span style="font-size:2rem">'+row+'</span>',opts:opts.map(String),a:opts.indexOf(k)};`);

const ODD_EVEN = quiz("⚖️", "စုံ / မ ခွဲ", `
var num=1+(Math.random()*30|0);
return {q:'<b style="font-size:2.4rem">'+num+'</b>',opts:['စုံ (even)','မ (odd)'],a:num%2===0?0:1};`);

const TIMES = quiz("✖️", "မြှောက်ကိန်း", `
var a=2+(Math.random()*8|0),b=2+(Math.random()*8|0),ans=a*b;
var opts=[ans],set={};set[ans]=1;while(opts.length<4){var r=(2+(Math.random()*8|0))*(2+(Math.random()*8|0));if(!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:'<b style="font-size:2.2rem">'+a+' × '+b+' = ?</b>',opts:opts.map(String),a:opts.indexOf(ans)};`);

const ADD_SUB = quiz("➕", "ပေါင်း / နုတ်", `
var a=2+(Math.random()*18|0),b=1+(Math.random()*a|0),plus=Math.random()<0.5;
var ans=plus?a+b:a-b;
var opts=[ans],set={};set[ans]=1;while(opts.length<4){var r=ans+((Math.random()*9|0)-4);if(r>=0&&!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:'<b style="font-size:2.2rem">'+a+(plus?' + ':' - ')+b+' = ?</b>',opts:opts.map(String),a:opts.indexOf(ans)};`);

const GREATER = quiz("📏", "ကြီး / ငယ် နှိုင်း", `
var a=1+(Math.random()*90|0),b=1+(Math.random()*90|0);while(b===a)b=1+(Math.random()*90|0);
return {q:'ဘယ်ဂဏန်း ပိုကြီးလဲ?',opts:['<b style="font-size:1.8rem">'+a+'</b>','<b style="font-size:1.8rem">'+b+'</b>'],a:a>b?0:1};`);

const SHAPES = quiz("🔷", "ပုံသဏ္ဌာန်", pickFromTable(
  `[['🔴','စက်ဝိုင်း'],['🔺','တြိဂံ'],['🟦','လေးထောင့်'],['⭐','ကြယ်'],['❤️','နှလုံး'],['🔶','စိန်ပုံ']]`));

const COLORS = quiz("🌈", "အရောင် ခွဲ", pickFromTable(
  `[['🟥','အနီ'],['🟦','အပြာ'],['🟩','အစိမ်း'],['🟨','အဝါ'],['🟧','လိမ္မော်'],['🟪','ခရမ်း'],['⬛','အနက်'],['⬜','အဖြူ']]`));

const ANIMALS = quiz("🐾", "တိရစ္ဆာန် သိရှိ", pickFromTable(
  `[['🐘','ဆင်'],['🐅','ကျား'],['🐄','နွား'],['🐎','မြင်း'],['🐐','ဆိတ်'],['🐓','ကြက်'],['🐕','ခွေး'],['🐈','ကြောင်'],['🐒','မျောက်'],['🐍','မြွေ'],['🐰','ယုန်'],['🐟','ငါး']]`));

const FRUITS = quiz("🍎", "အသီးအနှံ", pickFromTable(
  `[['🍎','ပန်းသီး'],['🍌','ငှက်ပျောသီး'],['🍊','လိမ္မော်သီး'],['🥭','သရက်သီး'],['🍉','ဖရဲသီး'],['🍇','စပျစ်သီး'],['🍍','နာနတ်သီး'],['🥥','အုန်းသီး']]`));

const FLAGS = quiz("🚩", "နိုင်ငံ အလံ", pickFromTable(
  `[['🇲🇲','မြန်မာ'],['🇹🇭','ထိုင်း'],['🇨🇳','တရုတ်'],['🇯🇵','ဂျပန်'],['🇰🇷','ကိုးရီးယား'],['🇺🇸','အမေရိကန်'],['🇬🇧','အင်္ဂလန်'],['🇮🇳','အိန္ဒိယ'],['🇸🇬','စင်္ကာပူ'],['🇻🇳','ဗီယက်နမ်']]`));

const SPELLING = quiz("🔤", "စာလုံးပေါင်း", `
var W=['APPLE','WATER','TIGER','GREEN','HOUSE','MOUSE','PLANT','LIGHT','MUSIC','HAPPY','TABLE','RIVER'];
var w=W[Math.random()*W.length|0];var i=Math.random()*w.length|0;var miss=w.charAt(i);
var shown=w.split('');shown[i]='_';
var opts=[miss],set={};set[miss]=1;var AL='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
while(opts.length<4){var r=AL.charAt(Math.random()*26|0);if(!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:'ပျောက်နေတဲ့ စာလုံး:<br><b style="letter-spacing:6px;font-size:2rem">'+shown.join('')+'</b>',opts:opts,a:opts.indexOf(miss)};`);

const SCRAMBLE = quiz("🔀", "စာလုံး ရှုပ်ထွေး", `
var W=['PLANT','WATER','TIGER','GREEN','APPLE','HOUSE','MUSIC','LIGHT'];
var w=W[Math.random()*W.length|0];var a=w.split('');
for(var k=a.length-1;k>0;k--){var j=Math.random()*(k+1)|0;var t=a[k];a[k]=a[j];a[j]=t;}
var opts=[w],set={};set[w]=1;while(opts.length<4){var r=W[Math.random()*W.length|0];if(!set[r]){set[r]=1;opts.push(r);}}
shuf(opts);
return {q:'စာလုံးတွေ စီပါ:<br><b style="letter-spacing:6px;font-size:1.8rem">'+a.join('')+'</b>',opts:opts,a:opts.indexOf(w)};`);

// ── Action games ─────────────────────────────────────────────────────────────
const REACTION = `${SHELL}
<h2>⚡ တုံ့ပြန်နှုန်း</h2>
<p class="bar">အစိမ်းရောင် ဖြစ်တာနဲ့ နှိပ်ပါ!</p>
<div id="box" style="height:180px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;background:#b91c1c;cursor:pointer;user-select:none">စောင့်ပါ…</div>
<p id="msg" style="height:1.5rem;font-weight:bold"></p>
<script>
var box=document.getElementById('box'),msg=document.getElementById('msg'),st='wait',t0=0,tm;
function arm(){st='wait';box.style.background='#b91c1c';box.textContent='စောင့်ပါ…';msg.textContent='';
 tm=setTimeout(function(){st='go';box.style.background='#16a34a';box.textContent='အခု နှိပ်!';t0=Date.now();},1000+Math.random()*2500);}
box.onclick=function(){if(st==='wait'){clearTimeout(tm);msg.textContent='❌ စောစီးလွန်း! ထပ်ကြိုးစား';arm();}
 else if(st==='go'){var ms=Date.now()-t0;msg.textContent='⚡ '+ms+' ms — '+(ms<300?'အလွန်မြန်!':ms<450?'ကောင်းတယ်':'ဆက်လေ့ကျင့်');st='done';box.style.background='#334155';box.textContent='ထပ်ကစားရန် နှိပ်';}
 else{arm();}};
arm();
</script>`;

const WHACK = `${SHELL}
<h2>🔨 ပိုးမ ထု</h2>
<p class="bar">အမှတ်: <span id="sc">0</span> · အချိန်: <span id="t">20</span>s</p>
<div id="grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:300px;margin:1rem auto"></div>
<p id="msg" style="height:1.4rem;font-weight:bold"></p>
<script>
var sc=0,t=20,run=true,$=function(i){return document.getElementById(i)},cells=[];
for(var i=0;i<9;i++){(function(){var c=document.createElement('button');c.style.cssText='aspect-ratio:1;font-size:2rem;background:#8B5A2B;border-radius:50%';c.textContent='';
 c.onclick=function(){if(c.dataset.up==='1'&&run){sc++;$('sc').textContent=sc;c.dataset.up='0';c.textContent='';}};
 cells.push(c);$('grid').appendChild(c);})();}
function pop(){if(!run)return;var c=cells[Math.random()*9|0];if(c.dataset.up==='1')return;c.dataset.up='1';c.textContent='🐹';
 setTimeout(function(){if(c.dataset.up==='1'){c.dataset.up='0';c.textContent='';}},700+Math.random()*500);}
var pv=setInterval(pop,650);
var tv=setInterval(function(){t--;$('t').textContent=t;if(t<=0){run=false;clearInterval(pv);clearInterval(tv);cells.forEach(function(c){c.textContent='';});$('msg').textContent='⏱️ ပြီးပါပြီ — အမှတ် '+sc;}},1000);
</script>`;

const BALLOON = `${SHELL}
<h2>🎈 ပူဖောင်း သင်္ချာ</h2>
<p class="bar">ရလဒ် <b id="target">?</b> နဲ့ ညီတဲ့ ပူဖောင်း ဖောက်ပါ · အမှတ်: <span id="sc">0</span> · <span id="t">30</span>s</p>
<div id="stage" style="position:relative;height:300px;overflow:hidden;background:#dbeafe;border-radius:12px"></div>
<p id="msg" style="height:1.4rem;font-weight:bold"></p>
<script>
var sc=0,t=30,run=true,a,b,ans,$=function(i){return document.getElementById(i)},stage=$('stage');
function newQ(){a=1+(Math.random()*9|0);b=1+(Math.random()*9|0);ans=a+b;$('target').textContent=a+' + '+b;}
function spawn(){if(!run)return;var correct=Math.random()<0.5;var val=correct?ans:(2+(Math.random()*16|0));
 var bal=document.createElement('button');bal.textContent='🎈'+val;bal.style.cssText='position:absolute;bottom:-40px;left:'+(Math.random()*80)+'%;font-size:1.3rem;background:none;color:#173404;font-weight:bold';
 var y=-40,left=parseFloat(bal.style.left);stage.appendChild(bal);
 var mv=setInterval(function(){y-=3;bal.style.bottom=(y*-1)+'px';if(-y>320){clearInterval(mv);if(bal.parentNode)stage.removeChild(bal);}},40);
 bal.onclick=function(){if(!run)return;clearInterval(mv);if(bal.parentNode)stage.removeChild(bal);
  if(val===ans){sc++;$('sc').textContent=sc;$('msg').textContent='✅';newQ();}else{$('msg').textContent='❌ '+val;}};}
newQ();var sv=setInterval(spawn,900);
var tv=setInterval(function(){t--;$('t').textContent=t;if(t<=0){run=false;clearInterval(sv);clearInterval(tv);$('msg').textContent='⏱️ ပြီးပါပြီ — အမှတ် '+sc;}},1000);
</script>`;

const SIMON = `${SHELL}
<h2>🎵 အစဉ်လိုက် မှတ်ဉာဏ်</h2>
<p class="bar">အဆင့်: <span id="lv">0</span></p>
<div id="pads" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:260px;margin:1rem auto"></div>
<p id="msg" style="height:1.5rem;font-weight:bold"></p>
<button id="go">စတင်</button>
<script>
var COL=['#ef4444','#22c55e','#3b82f6','#eab308'],seq=[],step=0,playing=false,pads=[],$=function(i){return document.getElementById(i)};
for(var i=0;i<4;i++){(function(idx){var p=document.createElement('button');p.style.cssText='aspect-ratio:1;border-radius:14px;background:'+COL[idx]+';opacity:.55';
 p.onclick=function(){if(playing||!seq.length)return;flash(idx);if(seq[step]===idx){step++;if(step===seq.length){$('msg').textContent='✅ တော်တယ်!';setTimeout(next,700);}}else{$('msg').textContent='❌ မှား — အဆင့် '+(seq.length-1);seq=[];}};
 pads.push(p);$('pads').appendChild(p);})(i);}
function flash(i){pads[i].style.opacity='1';setTimeout(function(){pads[i].style.opacity='.55';},300);}
function next(){seq.push(Math.random()*4|0);step=0;$('lv').textContent=seq.length;playing=true;$('msg').textContent='ကြည့်ပါ…';
 var k=0;var iv=setInterval(function(){flash(seq[k]);k++;if(k>=seq.length){clearInterval(iv);playing=false;$('msg').textContent='ကိုယ့်အလှည့်!';}},650);}
$('go').onclick=function(){seq=[];next();};
</script>`;

export const EDU_GAMES_EXTRA: EduGame[] = [
  { slug: "counting", emoji: "🔢", title: "အရေအတွက် ရေတွက်", desc: "ရုပ်ပုံ ဘယ်နှစ်ခု ရှိလဲ ရေတွက်ပါ", html: COUNTING },
  { slug: "odd-even", emoji: "⚖️", title: "စုံ / မ ခွဲ", desc: "ဂဏန်း စုံလား၊ မလား ခွဲပါ", html: ODD_EVEN },
  { slug: "times-table", emoji: "✖️", title: "မြှောက်ကိန်း", desc: "အမြှောက် ကိန်းသေ လေ့ကျင့်", html: TIMES },
  { slug: "add-sub", emoji: "➕", title: "ပေါင်း / နုတ်", desc: "အပေါင်း အနုတ် သင်္ချာ", html: ADD_SUB },
  { slug: "greater-less", emoji: "📏", title: "ကြီး / ငယ်", desc: "ဘယ်ဂဏန်း ပိုကြီးလဲ", html: GREATER },
  { slug: "shapes", emoji: "🔷", title: "ပုံသဏ္ဌာန်", desc: "ပုံစံ အမည် မှတ်သားပါ", html: SHAPES },
  { slug: "colors-game", emoji: "🌈", title: "အရောင် ခွဲ", desc: "အရောင် အမည် သင်ယူပါ", html: COLORS },
  { slug: "animals", emoji: "🐾", title: "တိရစ္ဆာန်", desc: "တိရစ္ဆာန် အမည် သိရှိ", html: ANIMALS },
  { slug: "fruits", emoji: "🍎", title: "အသီးအနှံ", desc: "အသီး အမည် သင်ယူ", html: FRUITS },
  { slug: "flags", emoji: "🚩", title: "နိုင်ငံ အလံ", desc: "အလံ နဲ့ နိုင်ငံ တွဲပါ", html: FLAGS },
  { slug: "spelling", emoji: "🔤", title: "စာလုံးပေါင်း", desc: "ပျောက်နေတဲ့ စာလုံး ရွေးပါ", html: SPELLING },
  { slug: "scramble", emoji: "🔀", title: "စာလုံး ရှုပ်", desc: "ရှုပ်ထားတဲ့ စာလုံး စီပါ", html: SCRAMBLE },
  { slug: "reaction", emoji: "⚡", title: "တုံ့ပြန်နှုန်း", desc: "အစိမ်းရောင် ဖြစ်ချိန် မြန်မြန် နှိပ်", html: REACTION },
  { slug: "whack", emoji: "🔨", title: "ပိုးမ ထု", desc: "ပေါ်လာတဲ့ ပိုးမကို ထုပါ", html: WHACK },
  { slug: "balloon-math", emoji: "🎈", title: "ပူဖောင်း သင်္ချာ", desc: "အဖြေ မှန်တဲ့ ပူဖောင်း ဖောက်", html: BALLOON },
  { slug: "simon", emoji: "🎵", title: "အစဉ်လိုက် မှတ်ဉာဏ်", desc: "အရောင် အစဉ် မှတ်ပြီး ပြန်လုပ်", html: SIMON },
];
