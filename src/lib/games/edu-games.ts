// Built-in educational HTML5 mini-games. Each `html` is a self-contained
// document fragment (inline CSS + JS, no network) rendered inside the same
// hardened sandbox as community games (see game-sandbox.ts). All original.

import { EDU_GAMES_EXTRA } from "@/lib/games/edu-games-extra";
import { SHELL, type EduGame } from "@/lib/games/edu-shell";

export { SHELL };
export type { EduGame };

const MATH_SPRINT = `${SHELL}
<h2>🧮 Math Sprint</h2>
<p class="bar">Score: <span id="score">0</span> · Time: <span id="timer">30</span>s</p>
<div id="q" style="font-size:2rem;margin:1rem 0">—</div>
<input id="ans" type="number" inputmode="numeric" autofocus
  style="font-size:1.5rem;padding:.4rem;width:140px;text-align:center;border:2px solid #639922;border-radius:10px">
<div style="margin-top:.6rem"><button id="go">Check</button></div>
<p id="msg" style="height:1.4rem"></p>
<script>
var s=0,t=30,run=true,a,b,op,ans,$=function(i){return document.getElementById(i)};
function next(){a=1+(Math.random()*12|0);b=1+(Math.random()*12|0);op=['+','-','×'][Math.random()*3|0];
 if(op==='+')ans=a+b;else if(op==='-'){if(b>a){var x=a;a=b;b=x}ans=a-b}else ans=a*b;
 $('q').textContent=a+' '+op+' '+b;$('ans').value='';$('ans').focus();}
function check(){if(!run)return;if(Number($('ans').value)===ans){s++;$('score').textContent=s;$('msg').textContent='✅';}else{$('msg').textContent='❌ = '+ans;}next();}
$('go').onclick=check;$('ans').addEventListener('keydown',function(e){if(e.key==='Enter')check();});
var iv=setInterval(function(){t--;$('timer').textContent=t;if(t<=0){clearInterval(iv);run=false;$('q').textContent='⏱️ Time!';$('msg').textContent='Final score: '+s;}},1000);
next();
</script>`;

const TYPING = `${SHELL}
<h2>⌨️ Typing Trainer</h2>
<p class="bar">Typed: <span id="score">0</span> · Time: <span id="timer">30</span>s</p>
<div id="word" style="font-size:2rem;margin:1rem 0;letter-spacing:1px">—</div>
<input id="in" autocomplete="off" autocapitalize="off" autofocus
  style="font-size:1.4rem;padding:.4rem;width:220px;text-align:center;border:2px solid #639922;border-radius:10px">
<p id="msg" style="height:1.4rem"></p>
<script>
var W=['plant','water','sunlight','leaf','root','garden','sprout','harvest','soil','seed','grow','green','flower','stem','nutrient'];
var s=0,t=30,run=true,cur='',$=function(i){return document.getElementById(i)};
function next(){cur=W[Math.random()*W.length|0];$('word').textContent=cur;$('in').value='';$('in').focus();}
$('in').addEventListener('input',function(){if(!run)return;if($('in').value.trim().toLowerCase()===cur){s++;$('score').textContent=s;$('msg').textContent='✅';next();}});
var iv=setInterval(function(){t--;$('timer').textContent=t;if(t<=0){clearInterval(iv);run=false;$('word').textContent='⏱️ Time!';$('msg').textContent='You typed '+s+' words!';}},1000);
next();
</script>`;

const MEMORY = `${SHELL}
<h2>🧠 Memory Match</h2>
<p class="bar">Moves: <span id="moves">0</span> · Pairs: <span id="pairs">0</span>/6</p>
<div id="grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:320px;margin:1rem auto"></div>
<p id="msg" style="height:1.4rem"></p>
<script>
var E=['🌱','🌿','🌸','💧','☀️','🍃'],deck=E.concat(E),moves=0,pairs=0,first=null,lock=false;
var $=function(i){return document.getElementById(i)};
for(var i=deck.length-1;i>0;i--){var j=Math.random()*(i+1)|0;var x=deck[i];deck[i]=deck[j];deck[j]=x;}
var g=$('grid');
deck.forEach(function(sym,idx){var b=document.createElement('button');b.style.cssText='aspect-ratio:1;font-size:1.8rem;background:#639922;color:#639922;border-radius:10px';b.dataset.sym=sym;b.dataset.on='0';
 b.onclick=function(){if(lock||b.dataset.on==='1')return;b.textContent=sym;b.style.background='#fff';b.dataset.on='1';
  if(!first){first=b;}else{moves++;$('moves').textContent=moves;
   if(first.dataset.sym===sym){pairs++;$('pairs').textContent=pairs;first=null;if(pairs===6){$('msg').textContent='🎉 Solved in '+moves+' moves!';}}
   else{lock=true;var f=first;first=null;setTimeout(function(){f.textContent='';f.style.background='#639922';f.dataset.on='0';b.textContent='';b.style.background='#639922';b.dataset.on='0';lock=false;},700);}}};
 g.appendChild(b);});
</script>`;

const HEX = `${SHELL}
<h2>🎨 Hex Colour Guess</h2>
<p class="bar">Score: <span id="score">0</span> · Round: <span id="round">1</span>/10</p>
<div id="sw" style="width:150px;height:110px;margin:1rem auto;border-radius:14px;border:2px solid #173404"></div>
<div id="opts" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"></div>
<p id="msg" style="height:1.4rem"></p>
<script>
var s=0,round=1,$=function(i){return document.getElementById(i)};
function hex(){var c='#';for(var i=0;i<3;i++){c+=('0'+(Math.random()*256|0).toString(16)).slice(-2);}return c;}
function draw(){if(round>10){$('sw').style.background='#EAF3DE';$('opts').innerHTML='';$('msg').textContent='Final score: '+s+'/10';return;}
 $('round').textContent=round;var correct=hex(),opts=[correct,hex(),hex()];
 for(var i=opts.length-1;i>0;i--){var j=Math.random()*(i+1)|0;var x=opts[i];opts[i]=opts[j];opts[j]=x;}
 $('sw').style.background=correct;$('opts').innerHTML='';$('msg').textContent='';
 opts.forEach(function(o){var b=document.createElement('button');b.textContent=o;b.style.fontFamily='monospace';
  b.onclick=function(){if(o===correct){s++;$('score').textContent=s;$('msg').textContent='✅';}else{$('msg').textContent='❌ was '+correct;}round++;setTimeout(draw,600);};
  $('opts').appendChild(b);});}
draw();
</script>`;

export const EDU_GAMES: EduGame[] = [
  {
    slug: "math-sprint",
    emoji: "🧮",
    titleKey: "eduMathTitle",
    descKey: "eduMathDesc",
    html: MATH_SPRINT,
  },
  {
    slug: "typing-trainer",
    emoji: "⌨️",
    titleKey: "eduTypingTitle",
    descKey: "eduTypingDesc",
    html: TYPING,
  },
  {
    slug: "memory-match",
    emoji: "🧠",
    titleKey: "eduMemoryTitle",
    descKey: "eduMemoryDesc",
    html: MEMORY,
  },
  {
    slug: "hex-colour",
    emoji: "🎨",
    titleKey: "eduHexTitle",
    descKey: "eduHexDesc",
    html: HEX,
  },
  ...EDU_GAMES_EXTRA,
];

export function getEduGame(slug: string): EduGame | undefined {
  return EDU_GAMES.find((g) => g.slug === slug);
}
