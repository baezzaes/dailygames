const $ = (id) => document.getElementById(id);
const GAME_ID = "runner";
const GAME_TITLE = "피하기 + 코인 먹기";

const nameEl = $("name");
const modeEl = $("mode");
const rankTitle = $("rankTitle");
const rankList = $("rankList");
const scoreEl = $("score");
const timeEl = $("time");
const stateEl = $("state");
const statusTextEl = $("statusText");
const startBtn = $("startBtn");
const leftBtn = $("leftBtn");
const rightBtn = $("rightBtn");
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w < 10 || h < 10) return;
  canvas.width = w;
  canvas.height = h;
}

function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekKey(){const d=new Date();const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`}
function sanitizeName(name){const v=String(name||"").trim().slice(0,12);return v||"anonymous"}function getPlayerName(){const name=sanitizeName(localStorage.getItem("dailygames:lastname")||"");const tag=localStorage.getItem("dailygames:lasttag")||"0000";return `${name}#${tag}`;}
function storageKey(mode){const period=mode==="weekly"?weekKey():todayKey();return `dailygames:${GAME_ID}:${mode}:${period}`}
function getBoard(mode){try{const raw=localStorage.getItem(storageKey(mode));const p=raw?JSON.parse(raw):[];return Array.isArray(p)?p:[]}catch{return[]}}
function saveBoard(mode,board){localStorage.setItem(storageKey(mode),JSON.stringify(board))}
function compareScore(a,b){return b.score-a.score||a.t-b.t}
function addRecord(score){const mode=modeEl.value;const board=getBoard(mode);board.push({name:getPlayerName(),score,t:Date.now()});board.sort(compareScore);saveBoard(mode,board.slice(0,50));updateRankUI()}
function clearBoard(){localStorage.removeItem(storageKey(modeEl.value));updateRankUI()}
function updateRankUI(){const modeText=modeEl.value==="weekly"?"주간":"오늘";rankTitle.textContent=`${GAME_TITLE} ${modeText} TOP 10`;rankList.innerHTML="";const board=getBoard(modeEl.value).sort(compareScore).slice(0,10);if(!board.length){const li=document.createElement("li");li.textContent="아직 기록이 없습니다.";rankList.appendChild(li);return;}board.forEach((r,i)=>{const li=document.createElement("li");li.textContent=`${i+1}. ${r.name} - ${r.score}점`;rankList.appendChild(li);});}

const game={running:false,raf:0,last:0,time:0,score:0,left:false,right:false,spawn:0,spawnRate:0.7,stars:[],items:[],player:{x:canvas.width/2,y:canvas.height-36,w:48,h:24,speed:360}};

function setState(t){stateEl.textContent=t} function setStatus(t){statusTextEl.textContent=t}
function reset(){cancelAnimationFrame(game.raf);game.running=false;game.last=0;game.time=0;game.score=0;game.left=false;game.right=false;game.spawn=0;game.spawnRate=0.7;game.items=[];game.player.x=canvas.width/2;game.player.y=canvas.height-36;game.stars=[]; if(!game.stars.length){for(let i=0;i<60;i+=1){game.stars.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,s:20+Math.random()*35,r:Math.random()*1.4+0.3,a:Math.random()*0.5+0.2});}} scoreEl.textContent="0";timeEl.textContent="0.0s";setState("대기");setStatus("시작을 누르고 좌우로 이동하세요.");draw();}

function spawn(){const isCoin=Math.random()<0.35;const size=isCoin?14:18+Math.random()*16;game.items.push({type:isCoin?"coin":"rock",x:size+Math.random()*(canvas.width-size*2),y:-size-6,r:size,v:120+Math.random()*150+game.time*6,rot:Math.random()*Math.PI*2,spin:(Math.random()-0.5)*3});}
function collideCircleRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw));const ny=Math.max(ry,Math.min(cy,ry+rh));const dx=cx-nx;const dy=cy-ny;return dx*dx+dy*dy<=cr*cr;}

function end(){if(!game.running)return;game.running=false;cancelAnimationFrame(game.raf);setState("종료");setStatus(`게임 종료! 점수 ${game.score}점`);showResultBanner(game.score,`${game.score}점`);addRecord(game.score);draw();}

function update(dt){if(game.left&&!game.right)game.player.x-=game.player.speed*dt; if(game.right&&!game.left)game.player.x+=game.player.speed*dt; game.player.x=Math.max(28,Math.min(canvas.width-28,game.player.x));
  game.time+=dt; game.score=Math.floor(game.time*10); scoreEl.textContent=String(game.score); timeEl.textContent=`${game.time.toFixed(1)}s`;
  game.spawnRate=Math.max(0.24,0.7-game.time*0.012); game.spawn+=dt; while(game.spawn>=game.spawnRate){game.spawn-=game.spawnRate;spawn();}
  const pr={x:game.player.x-game.player.w/2,y:game.player.y-game.player.h/2,w:game.player.w,h:game.player.h};
  for(const st of game.stars){st.y+=st.s*dt;if(st.y>canvas.height+2){st.y=-2;st.x=Math.random()*canvas.width;}}
  for(let i=game.items.length-1;i>=0;i-=1){const it=game.items[i];it.y+=it.v*dt;it.rot+=it.spin*dt;if(collideCircleRect(it.x,it.y,it.r,pr.x,pr.y,pr.w,pr.h)){if(it.type==="coin"){game.score+=50;scoreEl.textContent=String(game.score);game.items.splice(i,1);}else{end();return;}}else if(it.y-it.r>canvas.height+8){game.items.splice(i,1);}}
}

function drawBG(){const g=ctx.createLinearGradient(0,0,0,canvas.height);g.addColorStop(0,"#0b1a2e");g.addColorStop(1,"#050b14");ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);for(const st of game.stars){ctx.fillStyle=`rgba(220,236,255,${st.a})`;ctx.beginPath();ctx.arc(st.x,st.y,st.r,0,Math.PI*2);ctx.fill();}}
function drawPlayer(){ctx.save();ctx.translate(game.player.x,game.player.y);ctx.fillStyle="#79ffa8";ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(20,10);ctx.lineTo(-20,10);ctx.closePath();ctx.fill();ctx.restore();}
function drawItem(it){ctx.save();ctx.translate(it.x,it.y);ctx.rotate(it.rot);if(it.type==="coin"){ctx.fillStyle="#ffe373";ctx.beginPath();ctx.arc(0,0,it.r,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f8c941";ctx.beginPath();ctx.arc(0,0,it.r*0.55,0,Math.PI*2);ctx.fill();}else{ctx.fillStyle="#d68757";ctx.beginPath();ctx.arc(0,0,it.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.2)";ctx.stroke();}ctx.restore();}
function drawOverlay(){if(game.running)return;ctx.fillStyle="rgba(0,0,0,.26)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(240,244,255,.9)";ctx.textAlign="center";ctx.font="700 22px system-ui";ctx.fillText("RUNNER",canvas.width/2,canvas.height/2-5);ctx.font="14px system-ui";ctx.fillText("START를 눌러 시작",canvas.width/2,canvas.height/2+18);}
function draw(){drawBG();for(const it of game.items)drawItem(it);drawPlayer();drawOverlay();}
function tick(ts){if(!game.running)return;if(!game.last)game.last=ts;const dt=Math.min(0.033,(ts-game.last)/1000);game.last=ts;update(dt);draw();if(game.running)game.raf=requestAnimationFrame(tick);}
function start(){hideResultBanner();reset();game.running=true;setState("진행 중");setStatus("코인을 먹고 장애물을 피하세요.");game.raf=requestAnimationFrame(tick);}
function move(dir,on){if(dir==="left")game.left=on;else game.right=on;}

window.addEventListener("keydown",(e)=>{if(["ArrowLeft","a","A"].includes(e.key)){move("left",true);e.preventDefault();}if(["ArrowRight","d","D"].includes(e.key)){move("right",true);e.preventDefault();}});
window.addEventListener("keyup",(e)=>{if(["ArrowLeft","a","A"].includes(e.key))move("left",false);if(["ArrowRight","d","D"].includes(e.key))move("right",false);});
window.addEventListener("blur",()=>{game.left=false;game.right=false;});
function bindHold(el,dir){const d=(e)=>{move(dir,true);e.preventDefault();};const u=(e)=>{move(dir,false);e.preventDefault();};el.addEventListener("mousedown",d);el.addEventListener("mouseup",u);el.addEventListener("mouseleave",u);el.addEventListener("touchstart",d,{passive:false});el.addEventListener("touchend",u,{passive:false});el.addEventListener("touchcancel",u,{passive:false});}
bindHold(leftBtn,"left");bindHold(rightBtn,"right");
startBtn.addEventListener("click",start);modeEl.addEventListener("change",()=>{void updateRankUI();});
syncCanvasSize();
reset();
updateRankUI();

new ResizeObserver(() => {
  if (!game.running) {
    syncCanvasSize();
    reset();
  }
}).observe(canvas);



/* SERVER_RANK_OVERRIDE */
const scoreLabel = (v)=>`${v}점`;
function getRankSort() { return "desc"; }

function periodKey(mode) {
  return mode === "weekly" ? weekKey() : todayKey();
}

async function addRecord(score) {
  const mode = modeEl.value;
  const payload = {
    gameId: GAME_ID,
    mode,
    periodKey: periodKey(mode),
    name: getPlayerName(),
    score,
  };

  try {
    await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}

  await updateRankUI();
}

async function clearBoard() {
  const mode = modeEl.value;
  try {
    await fetch("/api/rank", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: GAME_ID,
        mode,
        periodKey: periodKey(mode),
      }),
    });
  } catch {}

  await updateRankUI();
}

async function updateRankUI() {
  const modeText = modeEl.value === "weekly" ? "주간" : "오늘";
  rankTitle.textContent = `${GAME_TITLE} ${modeText} TOP 10`;
  rankList.innerHTML = "";

  try {
    const query = new URLSearchParams({
      gameId: GAME_ID,
      mode: modeEl.value,
      periodKey: periodKey(modeEl.value),
      sort: getRankSort(),
      limit: "10",
    });

    const res = await fetch(`/api/rank?${query.toString()}`);
    const data = await res.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (rows.length === 0) {
      const li = document.createElement("li");
      li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
      rankList.appendChild(li);
      return;
    }

    rows.forEach((row, idx) => {
      const li = document.createElement("li");
      const ts = row.created_at ? new Date(`${row.created_at}Z`) : new Date();
      li.textContent = `${idx + 1}. ${row.name} - ${scoreLabel(row.score)} (${ts.toLocaleString()})`;
      rankList.appendChild(li);
    });
  } catch {
    const li = document.createElement("li");
    li.textContent = "랭킹 서버 연결 실패. 잠시 후 다시 시도해주세요.";
    rankList.appendChild(li);
  }
}



/* RESULT_BANNER */
function savePB(score) {
  const key = `dailygames:${GAME_ID}:pb`;
  const curr = parseFloat(localStorage.getItem(key));
  if (isNaN(curr) || score > curr) localStorage.setItem(key, String(score));
}
function showResultBanner(score, label) {
  savePB(score);
  const b = document.getElementById("resultBanner");
  if (b) { document.getElementById("resultScore").textContent = label; b.hidden = false; }
}
function hideResultBanner() {
  const b = document.getElementById("resultBanner"); if (b) b.hidden = true;
}
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); start(); });
