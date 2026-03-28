const $=(id)=>document.getElementById(id);
const GAME_ID="numbertap";const GAME_TITLE="숫자 순서 탭";
const modeEl=$("mode"),rankTitle=$("rankTitle"),rankList=$("rankList");
const nextValEl=$("nextVal"),timeValEl=$("timeVal"),stateValEl=$("stateVal"),statusTextEl=$("statusText");
const startBtn=$("startBtn"),gridEl=$("grid");
function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekKey(){const d=new Date();const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-dayNum);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));const weekNo=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`}
function sanitizeName(name){const v=String(name||"").trim().slice(0,12);return v||"anonymous"}function getPlayerName(){const name=sanitizeName(localStorage.getItem("dailygames:lastname")||"");const tag=localStorage.getItem("dailygames:lasttag")||"0000";return `${name}#${tag}`;}
function storageKey(mode){const p=mode==="weekly"?weekKey():todayKey();return `dailygames:${GAME_ID}:${mode}:${p}`}
function getBoard(mode){try{const raw=localStorage.getItem(storageKey(mode));const p=raw?JSON.parse(raw):[];return Array.isArray(p)?p:[]}catch{return[]}}
function saveBoard(mode,board){localStorage.setItem(storageKey(mode),JSON.stringify(board))}
function compareScore(a,b){return a.score-b.score||a.t-b.t}
function addRecord(score){const mode=modeEl.value;const b=getBoard(mode);b.push({name:getPlayerName(),score,t:Date.now()});b.sort(compareScore);saveBoard(mode,b.slice(0,50));updateRankUI()}
function clearBoard(){localStorage.removeItem(storageKey(modeEl.value));updateRankUI()}
function updateRankUI(){const modeText=modeEl.value==="weekly"?"주간":"오늘";rankTitle.textContent=`${GAME_TITLE} ${modeText} TOP 10`;rankList.innerHTML="";const b=getBoard(modeEl.value).sort(compareScore).slice(0,10);if(!b.length){const li=document.createElement("li");li.textContent="아직 기록이 없습니다.";rankList.appendChild(li);return;}b.forEach((r,i)=>{const li=document.createElement("li");li.textContent=`${i+1}. ${r.name} - ${r.score.toFixed(2)}s`;rankList.appendChild(li);});}

const game={running:false,next:1,startTs:0,timer:0,cells:[]};
function setState(t){stateValEl.textContent=t}function setStatus(t){statusTextEl.textContent=t}
function shuffle(arr){for(let i=arr.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function renderGrid(){gridEl.innerHTML="";for(const n of game.cells){const b=document.createElement("button");b.className="nbtn";b.type="button";b.textContent=String(n);b.dataset.n=String(n);gridEl.appendChild(b);}}
function resetView(){game.running=false;clearInterval(game.timer);game.next=1;game.startTs=0;nextValEl.textContent="1";timeValEl.textContent="0.00s";setState("대기");setStatus("START를 누르고 숫자를 순서대로 탭하세요.");}
function startGame(){hideResultBanner();resetView();game.cells=shuffle(Array.from({length:25},(_,i)=>i+1));renderGrid();game.running=true;setState("진행 중");setStatus("1부터 순서대로 탭하세요.");game.startTs=performance.now();game.timer=window.setInterval(()=>{if(!game.running)return;timeValEl.textContent=`${((performance.now()-game.startTs)/1000).toFixed(2)}s`;},30);}
function finish(){game.running=false;clearInterval(game.timer);const t=(performance.now()-game.startTs)/1000;timeValEl.textContent=`${t.toFixed(2)}s`;setState("완료");setStatus(`완료! 기록 ${t.toFixed(2)}초`);showResultBanner(t,`${t.toFixed(2)}s`);addRecord(t);}
gridEl.addEventListener("click",(e)=>{const btn=e.target.closest(".nbtn");if(!btn||!game.running)return;const n=Number(btn.dataset.n);if(n!==game.next){btn.classList.add("wrong");setTimeout(()=>btn.classList.remove("wrong"),180);return;}btn.classList.add("ok");btn.disabled=true;game.next+=1;nextValEl.textContent=game.next<=25?String(game.next):"완료";if(game.next===26)finish();});
startBtn.addEventListener("click",startGame);modeEl.addEventListener("change",()=>{void updateRankUI();});
resetView();game.cells=shuffle(Array.from({length:25},(_,i)=>i+1));renderGrid();updateRankUI();



/* SERVER_RANK_OVERRIDE */
const scoreLabel = (v)=>`${Number(v).toFixed(2)}s`;
function getRankSort() { return "asc"; }

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
  if (isNaN(curr) || score < curr) localStorage.setItem(key, String(score));
}
function showResultBanner(score, label) {
  savePB(score);
  const b = document.getElementById("resultBanner");
  if (b) { document.getElementById("resultScore").textContent = label; b.hidden = false; }
}
function hideResultBanner() {
  const b = document.getElementById("resultBanner"); if (b) b.hidden = true;
}
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
