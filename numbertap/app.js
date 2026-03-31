const $=(id)=>document.getElementById(id);
const GAME_ID="numbertap";const GAME_TITLE="숫자 순서 탭";
const RANK_SORT  = "asc";
const scoreLabel = (v)=>`${Number(v).toFixed(2)}s`;
// 1~25를 순서대로 누르는 기록 경쟁(짧을수록 좋은 asc 랭킹)입니다.
const rankTitle=$("rankTitle"),rankList=$("rankList");
const nextValEl=$("nextVal"),timeValEl=$("timeVal"),stateValEl=$("stateVal"),statusTextEl=$("statusText");
const startBtn=$("startBtn"),gridEl=$("grid");
const game={running:false,next:1,startTs:0,timer:0,cells:[]};
function setState(t){stateValEl.textContent=t}function setStatus(t){statusTextEl.textContent=t}
function shuffle(arr){for(let i=arr.length-1;i>0;i-=1){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function renderGrid(){gridEl.innerHTML="";for(const n of game.cells){const b=document.createElement("button");b.className="nbtn";b.type="button";b.textContent=String(n);b.dataset.n=String(n);gridEl.appendChild(b);}}
function resetView(){game.running=false;clearInterval(game.timer);game.next=1;game.startTs=0;nextValEl.textContent="1";timeValEl.textContent="0.00s";setState("대기");setStatus("START를 누르고 숫자를 순서대로 탭하세요.");}
function startGame(){hideResultBanner();resetView();game.cells=shuffle(Array.from({length:25},(_,i)=>i+1));renderGrid();game.running=true;setState("진행 중");setStatus("1부터 순서대로 탭하세요.");game.startTs=performance.now();game.timer=window.setInterval(()=>{if(!game.running)return;timeValEl.textContent=`${((performance.now()-game.startTs)/1000).toFixed(2)}s`;},30);}
function finish(){game.running=false;clearInterval(game.timer);const t=(performance.now()-game.startTs)/1000;timeValEl.textContent=`${t.toFixed(2)}s`;setState("완료");setStatus(`완료! 기록 ${t.toFixed(2)}초`);showResultBanner(t,`${t.toFixed(2)}s`);addRecord(t);}
gridEl.addEventListener("click",(e)=>{const btn=e.target.closest(".nbtn");if(!btn||!game.running)return;const n=Number(btn.dataset.n);if(n!==game.next){btn.classList.add("wrong");setTimeout(()=>btn.classList.remove("wrong"),180);return;}btn.classList.add("ok");btn.disabled=true;game.next+=1;nextValEl.textContent=game.next<=25?String(game.next):"완료";if(game.next===26)finish();});
// 오답은 패널티 없이 피드백만 주고, 정답만 진행 상태를 전진시킵니다.
startBtn.addEventListener("click",startGame)
resetView();game.cells=shuffle(Array.from({length:25},(_,i)=>i+1));renderGrid();updateRankUI();
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
