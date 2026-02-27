const $=(id)=>document.getElementById(id);
const GAME_ID="stopbar";const GAME_TITLE="정지 타이밍 게임";
const nameEl=$("name"),modeEl=$("mode"),rankTitle=$("rankTitle"),rankList=$("rankList");
const scoreValEl=$("scoreVal"),zoneValEl=$("zoneVal"),stateValEl=$("stateVal"),statusTextEl=$("statusText");
const startBtn=$("startBtn"),stopBtn=$("stopBtn"),resetRankBtn=$("resetRankBtn");
const barWrap=$("barWrap"),targetZone=$("targetZone"),movingBar=$("movingBar");
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekKey(){const d=new Date();const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`}
function sanitizeName(name){const v=String(name||"").trim().slice(0,12);return v||"anonymous"}
function storageKey(mode){const p=mode==="weekly"?weekKey():todayKey();return `dailygames:${GAME_ID}:${mode}:${p}`}
function getBoard(mode){try{const raw=localStorage.getItem(storageKey(mode));const p=raw?JSON.parse(raw):[];return Array.isArray(p)?p:[]}catch{return[]}}
function saveBoard(mode,board){localStorage.setItem(storageKey(mode),JSON.stringify(board))}
function compareScore(a,b){return b.score-a.score||a.t-b.t}
function addRecord(score){const mode=modeEl.value;const b=getBoard(mode);b.push({name:sanitizeName(nameEl.value),score,t:Date.now()});b.sort(compareScore);saveBoard(mode,b.slice(0,50));updateRankUI()}
function clearBoard(){localStorage.removeItem(storageKey(modeEl.value));updateRankUI()}
function updateRankUI(){const modeText=modeEl.value==="weekly"?"주간":"오늘";rankTitle.textContent=`${GAME_TITLE} ${modeText} TOP 10`;rankList.innerHTML="";const b=getBoard(modeEl.value).sort(compareScore).slice(0,10);if(!b.length){const li=document.createElement("li");li.textContent="아직 기록이 없습니다.";rankList.appendChild(li);return;}b.forEach((r,i)=>{const li=document.createElement("li");li.textContent=`${i+1}. ${r.name} - ${r.score}연속`;rankList.appendChild(li);});}

const game={running:false,raf:0,last:0,pos:0,dir:1,speed:0.8,score:0,zoneCenter:50,zoneWidth:24};
function setState(t){stateValEl.textContent=t}function setStatus(t){statusTextEl.textContent=t}
function renderHud(){scoreValEl.textContent=String(game.score);zoneValEl.textContent=`${game.zoneWidth.toFixed(0)}%`;targetZone.style.width=`${game.zoneWidth}%`;targetZone.style.left=`${game.zoneCenter-game.zoneWidth/2}%`;movingBar.style.left=`${game.pos}%`;}
function reset(clearOnly=true){cancelAnimationFrame(game.raf);game.running=false;game.last=0;game.pos=0;game.dir=1;game.speed=0.8;game.score=0;game.zoneWidth=24;game.zoneCenter=50;startBtn.disabled=false;stopBtn.disabled=true;setState("대기");setStatus("시작 후 STOP을 눌러 바를 멈추세요.");renderHud();if(!clearOnly)addRecord(game.score)}
function randomizeZone(){const margin=game.zoneWidth/2+5;game.zoneCenter=margin+Math.random()*(100-margin*2)}
function tick(ts){if(!game.running)return;if(!game.last)game.last=ts;const dt=Math.min(0.033,(ts-game.last)/1000);game.last=ts;game.pos+=game.dir*game.speed*dt*100;if(game.pos>=98){game.pos=98;game.dir=-1}else if(game.pos<=0){game.pos=0;game.dir=1}movingBar.style.left=`${game.pos}%`;game.raf=requestAnimationFrame(tick)}
function startRound(){game.running=true;startBtn.disabled=true;stopBtn.disabled=false;setState("진행 중");setStatus("STOP 버튼으로 타이밍을 맞추세요.");game.last=0;game.raf=requestAnimationFrame(tick)}
function onStop(){if(!game.running)return;game.running=false;cancelAnimationFrame(game.raf);const left=game.zoneCenter-game.zoneWidth/2;const right=game.zoneCenter+game.zoneWidth/2;const hit=game.pos>=left&&game.pos<=right;if(hit){game.score+=1;game.zoneWidth=Math.max(8,game.zoneWidth-1.5);game.speed=Math.min(1.8,game.speed+0.06);setState("성공");setStatus("성공! 다음 라운드 시작");randomizeZone();renderHud();setTimeout(()=>{if(!game.running){startRound();}},500);}else{setState("실패");setStatus(`실패! 기록 ${game.score}연속`);startBtn.disabled=false;stopBtn.disabled=true;addRecord(game.score);}}
startBtn.addEventListener("click",()=>{game.score=0;game.zoneWidth=24;game.speed=0.8;game.pos=0;game.dir=1;randomizeZone();renderHud();startRound();});
stopBtn.addEventListener("click",onStop);resetRankBtn.addEventListener("click",clearBoard);modeEl.addEventListener("change",updateRankUI);
reset(true);updateRankUI();
