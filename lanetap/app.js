const $=(id)=>document.getElementById(id);
const GAME_ID="lanetap";const GAME_TITLE="레인 탭";
const RANK_SORT  = "desc";
const scoreLabel = (v)=>`${v}점`;
const rankTitle=$("rankTitle"),rankList=$("rankList");
const scoreValEl=$("scoreVal"),lifeValEl=$("lifeVal"),stateValEl=$("stateVal"),statusTextEl=$("statusText");
const startBtn=$("startBtn");
const laneBtns=Array.from(document.querySelectorAll(".lane-btn"));
const canvas=$("gameCanvas"),ctx=canvas.getContext("2d");

function syncCanvasSize(){const rect=canvas.getBoundingClientRect();const w=Math.round(rect.width);const h=Math.round(rect.height);if(w<10||h<10)return;canvas.width=w;canvas.height=h;hitY=Math.round(h*0.81);}
const game={running:false,raf:0,last:0,score:0,life:3,spawn:0,spawnRate:0.7,speed:190,notes:[],flash:[0,0,0,0]};
const lanes=4;let hitY=340;
function setState(t){stateValEl.textContent=t}function setStatus(t){statusTextEl.textContent=t}
function reset(clearOnly=true){cancelAnimationFrame(game.raf);game.running=false;game.last=0;game.score=0;game.life=3;game.spawn=0;game.spawnRate=0.7;game.speed=190;game.notes=[];game.flash=[0,0,0,0];scoreValEl.textContent="0";lifeValEl.textContent="3";setState("대기");setStatus("START 후 레인 버튼(1~4)을 눌러 노트를 맞추세요.");draw();if(!clearOnly)addRecord(game.score)}
function spawnNote(){game.notes.push({lane:Math.floor(Math.random()*lanes),y:-26,h:26,w:0.78,hit:false});}
function laneX(l){const laneW=canvas.width/lanes;return l*laneW}
function hitLane(lane){if(!game.running)return;let bestI=-1;let bestDist=1e9;for(let i=0;i<game.notes.length;i+=1){const n=game.notes[i];if(n.lane!==lane)continue;const d=Math.abs((n.y+n.h/2)-hitY);if(d<bestDist){bestDist=d;bestI=i;}}
  if(bestI>=0&&bestDist<=42){game.notes.splice(bestI,1);game.score+=10;scoreValEl.textContent=String(game.score);game.flash[lane]=0.12;}else{game.life-=1;lifeValEl.textContent=String(game.life);game.flash[lane]=0.12;if(game.life<=0)end();}}
function end(){if(!game.running)return;game.running=false;cancelAnimationFrame(game.raf);setState("종료");setStatus(`게임 종료! 점수 ${game.score}`);showResultBanner(game.score,`${game.score}점`);addRecord(game.score);draw();}
function update(dt){game.spawn+=dt;game.spawnRate=Math.max(0.28,0.7-game.score/800);game.speed=Math.min(360,190+game.score/7);while(game.spawn>=game.spawnRate){game.spawn-=game.spawnRate;spawnNote();}
  for(let i=0;i<game.notes.length;i+=1){game.notes[i].y+=game.speed*dt;}
  for(let i=game.notes.length-1;i>=0;i-=1){const n=game.notes[i];if(n.y>canvas.height+10){game.notes.splice(i,1);game.life-=1;lifeValEl.textContent=String(game.life);if(game.life<=0){end();return;}}}
  for(let i=0;i<4;i+=1){game.flash[i]=Math.max(0,game.flash[i]-dt);} }
function drawHUD(){ctx.save();ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,canvas.width,34);ctx.fillStyle="rgba(255,255,255,.9)";ctx.font="700 13px system-ui";ctx.textBaseline="middle";ctx.textAlign="left";ctx.fillText(`점수 ${game.score}`,10,17);ctx.textAlign="right";ctx.fillText(`체력 ${"♥".repeat(Math.max(0,game.life))}`,canvas.width-10,17);ctx.restore();}
function draw(){ctx.fillStyle="#071221";ctx.fillRect(0,0,canvas.width,canvas.height);const laneW=canvas.width/lanes;
  for(let l=0;l<lanes;l+=1){ctx.fillStyle=l%2?"rgba(255,255,255,.04)":"rgba(255,255,255,.07)";ctx.fillRect(l*laneW,0,laneW,canvas.height);if(game.flash[l]>0){ctx.fillStyle="rgba(121,255,168,.25)";ctx.fillRect(l*laneW,0,laneW,canvas.height);}ctx.strokeStyle="rgba(255,255,255,.08)";ctx.strokeRect(l*laneW,0,laneW,canvas.height);}ctx.fillStyle="rgba(255,209,103,.9)";ctx.fillRect(0,hitY,canvas.width,4);
  for(const n of game.notes){const x=laneX(n.lane)+laneW*0.13;const w=laneW*0.74;ctx.fillStyle="#79ffa8";ctx.fillRect(x,n.y,w,n.h);ctx.strokeStyle="rgba(0,0,0,.2)";ctx.strokeRect(x,n.y,w,n.h);} if(!game.running){ctx.fillStyle="rgba(0,0,0,.26)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="rgba(235,242,255,.9)";ctx.textAlign="center";ctx.font="700 22px system-ui";ctx.fillText("LANE TAP",canvas.width/2,canvas.height/2-6);ctx.font="14px system-ui";ctx.fillText("START를 눌러 시작",canvas.width/2,canvas.height/2+18);} drawHUD();}
function tick(ts){if(!game.running)return;if(!game.last)game.last=ts;const dt=Math.min(0.033,(ts-game.last)/1000);game.last=ts;update(dt);draw();if(game.running)game.raf=requestAnimationFrame(tick)}
function start(){hideResultBanner();reset(true);game.running=true;setState("진행 중");setStatus("노트를 히트 라인에서 맞추세요.");game.raf=requestAnimationFrame(tick)}
laneBtns.forEach((btn)=>{btn.addEventListener("click",()=>hitLane(Number(btn.dataset.lane)));});
window.addEventListener("keydown",(e)=>{if(["1","2","3","4"].includes(e.key)){hitLane(Number(e.key)-1);}});
startBtn.addEventListener("click",start)
syncCanvasSize();
reset(true);
updateRankUI();

new ResizeObserver(()=>{if(!game.running){syncCanvasSize();reset(true);}}).observe(canvas);
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); start(); });
