// 정지 타이밍 게임 — game.js 공통 함수 활용
const GAME_ID    = "stopbar";
const GAME_TITLE = "🎯 정지 타이밍";
const RANK_SORT  = "desc";
const scoreLabel = v => `${v}연속`;

const scoreValEl   = document.getElementById('scoreVal');
const zoneValEl    = document.getElementById('zoneVal');
const stateValEl   = document.getElementById('stateVal');
const statusTextEl = document.getElementById('statusText');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const restartBtn   = document.getElementById('restartBtn');
const targetZone   = document.getElementById('targetZone');
const movingBar    = document.getElementById('movingBar');

const game = {
  running:    false,
  raf:        0,
  last:       0,
  pos:        0,
  dir:        1,
  speed:      0.8,
  score:      0,
  zoneCenter: 50,
  zoneWidth:  24,
};

function setState(t) { stateValEl.textContent = t; }
function setStatus(t){ statusTextEl.textContent = t; }

function renderHud() {
  scoreValEl.textContent = String(game.score);
  zoneValEl.textContent  = `${game.zoneWidth.toFixed(0)}%`;
  targetZone.style.width = `${game.zoneWidth}%`;
  targetZone.style.left  = `${game.zoneCenter - game.zoneWidth / 2}%`;
  movingBar.style.left   = `${game.pos}%`;
}

function randomizeZone() {
  const margin = game.zoneWidth / 2 + 5;
  game.zoneCenter = margin + Math.random() * (100 - margin * 2);
}

function tick(ts) {
  if (!game.running) return;
  if (!game.last) game.last = ts;
  const dt = Math.min(0.033, (ts - game.last) / 1000);
  game.last = ts;
  game.pos += game.dir * game.speed * dt * 100;
  if (game.pos >= 98) { game.pos = 98; game.dir = -1; }
  else if (game.pos <= 0) { game.pos = 0; game.dir = 1; }
  movingBar.style.left = `${game.pos}%`;
  game.raf = requestAnimationFrame(tick);
}

function startRound() {
  game.running  = true;
  startBtn.disabled = true;
  stopBtn.disabled  = false;
  setState('진행 중');
  setStatus('STOP 버튼으로 타이밍을 맞추세요!');
  game.last = 0;
  game.raf  = requestAnimationFrame(tick);
}

function onStop() {
  if (!game.running) return;
  game.running = false;
  cancelAnimationFrame(game.raf);
  const left = game.zoneCenter - game.zoneWidth / 2;
  const right = game.zoneCenter + game.zoneWidth / 2;
  const hit  = game.pos >= left && game.pos <= right;

  if (hit) {
    game.score    += 1;
    game.zoneWidth = Math.max(8, game.zoneWidth - 1.5);
    game.speed     = Math.min(1.8, game.speed + 0.06);
    setState('성공!');
    setStatus('성공! 다음 라운드 시작');
    randomizeZone();
    renderHud();
    setTimeout(() => { if (!game.running) startRound(); }, 500);
  } else {
    setState('실패');
    setStatus(`실패! 기록: ${scoreLabel(game.score)}`);
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    showResultBanner(game.score, scoreLabel(game.score));
    addRecord(game.score);
  }
}

function initGame() {
  hideResultBanner();
  game.score     = 0;
  game.zoneWidth = 24;
  game.speed     = 0.8;
  game.pos       = 0;
  game.dir       = 1;
  randomizeZone();
  renderHud();
  startRound();
}

startBtn.addEventListener('click', initGame);
stopBtn.addEventListener('click', onStop);
restartBtn.addEventListener('click', initGame);

renderHud();
setState('대기');
setStatus('시작 후 STOP을 눌러 바를 멈추세요.');
updateRankUI();
