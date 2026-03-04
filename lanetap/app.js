const $=(id)=>document.getElementById(id);
const GAME_ID="lanetap";const GAME_TITLE="레인 탭";
const modeEl=$("mode"),rankTitle=$("rankTitle"),rankList=$("rankList");
const scoreValEl=$("scoreVal"),lifeValEl=$("lifeVal"),stateValEl=$("stateVal"),statusTextEl=$("statusText");
const startBtn=$("startBtn"),resetRankBtn=$("resetRankBtn");
const laneBtns=Array.from(document.querySelectorAll(".lane-btn"));
const canvas=$("gameCanvas"),ctx=canvas.getContext("2d");
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekKey(){const d=new Date();const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`}
function sanitizeName(name){const v=String(name||"").trim().slice(0,12);return v||"anonymous"}function getPlayerName(){const lastName=localStorage.getItem("dailygames:lastname")||"";const typed=window.prompt("게임 완료! 닉네임을 입력하세요 (최대 12자)",lastName);const finalName=sanitizeName(typed);localStorage.setItem("dailygames:lastname",finalName);return finalName;}
function storageKey(mode){const p=mode==="weekly"?weekKey():todayKey();return `dailygames:${GAME_ID}:${mode}:${p}`}
function getBoard(mode){try{const raw=localStorage.getItem(storageKey(mode));const p=raw?JSON.parse(raw):[];return Array.isArray(p)?p:[]}catch{return[]}}
function saveBoard(mode,board){localStorage.setItem(storageKey(mode),JSON.stringify(board))}
function compareScore(a,b){return b.score-a.score||a.t-b.t}
function addRecord(score){const mode=modeEl.value;const b=getBoard(mode);b.push({name:getPlayerName(),score,t:Date.now()});b.sort(compareScore);saveBoard(mode,b.slice(0,50));updateRankUI()}
function clearBoard(){localStorage.removeItem(storageKey(modeEl.value));updateRankUI()}
function updateRankUI(){const modeText=modeEl.value==="weekly"?"주간":"오늘";rankTitle.textContent=`${GAME_TITLE} ${modeText} TOP 10`;rankList.innerHTML="";const b=getBoard(modeEl.value).sort(compareScore).slice(0,10);if(!b.length){const li=document.createElement("li");li.textContent="아직 기록이 없습니다.";rankList.appendChild(li);return;}b.forEach((r,i)=>{const li=document.createElement("li");li.textContent=`${i+1}. ${r.name} - ${r.score}점`;rankList.appendChild(li);});}

const game={running:false,raf:0,last:0,score:0,life:3,spawn:0,spawnRate:0.7,speed:190,notes:[],flash:[0,0,0,0]};
const lanes=4;const hitY=340;
function setState(t){stateValEl.textContent=t}function setStatus(t){statusTextEl.textContent=t}
function reset(clearOnly=true){cancelAnimationFrame(game.raf);game.running=false;game.last=0;game.score=0;game.life=3;game.spawn=0;game.spawnRate=0.7;game.speed=190;game.notes=[];game.flash=[0,0,0,0];scoreValEl.textContent="0";lifeValEl.textContent="3";setState("대기");setStatus("START 후 레인 버튼(1~4)을 눌러 노트를 맞추세요.");draw();if(!clearOnly)addRecord(game.score)}
function spawnNote(){game.notes.push({lane:Math.floor(Math.random()*lanes),y:-26,h:26,w:0.78,hit:false});}
function laneX(l){const laneW=canvas.width/lanes;return l*laneW}
function hitLane(lane){if(!game.running)return;let bestI=-1;let bestDist=1e9;for(let i=0;i<game.notes.length;i+=1){const n=game.notes[i];if(n.lane!==lane)continue;const d=Math.abs((n.y+n.h/2)-hitY);if(d<bestDist){bestDist=d;bestI=i;}}
  if(bestI>=0&&bestDist<=42){game.notes.splice(bestI,1);game.score+=100;scoreValEl.textContent=String(game.score);game.flash[lane]=0.12;}else{game.life-=1;lifeValEl.textContent=String(game.life);game.flash[lane]=0.12;if(game.life<=0)end();}}
function end(){if(!game.running)return;game.running=false;cancelAnimationFrame(game.raf);setState("종료");setStatus(`게임 종료! 점수 ${game.score}`);addRecord(game.score);draw();}
function update(dt){game.spawn+=dt;game.spawnRate=Math.max(0.28,0.7-game.score/8000);game.speed=Math.min(360,190+game.score/70);while(game.spawn>=game.spawnRate){game.spawn-=game.spawnRate;spawnNote();}
  for(let i=0;i<game.notes.length;i+=1){game.notes[i].y+=game.speed*dt;}
  for(let i=game.notes.length-1;i>=0;i-=1){const n=game.notes[i];if(n.y>canvas.height+10){game.notes.splice(i,1);game.life-=1;lifeValEl.textContent=String(game.life);if(game.life<=0){end();return;}}}
  for(let i=0;i<4;i+=1){game.flash[i]=Math.max(0,game.flash[i]-dt);} }
function draw(){ctx.fillStyle="#071221";ctx.fillRect(0,0,canvas.width,canvas.height);const laneW=canvas.width/lanes;
  for(let l=0;l<lanes;l+=1){ctx.fillStyle=l%2?"rgba(255,255,255,.04)":"rgba(255,255,255,.07)";ctx.fillRect(l*laneW,0,laneW,canvas.height);if(game.flash[l]>0){ctx.fillStyle="rgba(121,255,168,.25)";ctx.fillRect(l*laneW,0,laneW,canvas.height);}ctx.strokeStyle="rgba(255,255,255,.08)";ctx.strokeRect(l*laneW,0,laneW,canvas.height);}ctx.fillStyle="rgba(255,209,103,.9)";ctx.fillRect(0,hitY,canvas.width,4);
  for(const n of game.notes){const x=laneX(n.lane)+laneW*0.13;const w=laneW*0.74;ctx.fillStyle="#79ffa8";ctx.fillRect(x,n.y,w,n.h);ctx.strokeStyle="rgba(0,0,0,.2)";ctx.strokeRect(x,n.y,w,n.h);} if(!game.running){ctx.fillStyle="rgba(0,0,0,.26)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(235,242,255,.9)";ctx.textAlign="center";ctx.font="700 22px system-ui";ctx.fillText("LANE TAP",canvas.width/2,canvas.height/2-6);ctx.font="14px system-ui";ctx.fillText("START를 눌러 시작",canvas.width/2,canvas.height/2+18);} }
function tick(ts){if(!game.running)return;if(!game.last)game.last=ts;const dt=Math.min(0.033,(ts-game.last)/1000);game.last=ts;update(dt);draw();if(game.running)game.raf=requestAnimationFrame(tick)}
function start(){reset(true);game.running=true;setState("진행 중");setStatus("노트를 히트 라인에서 맞추세요.");game.raf=requestAnimationFrame(tick)}
laneBtns.forEach((btn)=>{btn.addEventListener("click",()=>hitLane(Number(btn.dataset.lane)));});
window.addEventListener("keydown",(e)=>{if(["1","2","3","4"].includes(e.key)){hitLane(Number(e.key)-1);}});
startBtn.addEventListener("click",start);resetRankBtn.addEventListener("click",clearBoard);modeEl.addEventListener("change",()=>{void updateRankUI();});
reset(true);updateRankUI();



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

