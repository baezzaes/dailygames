// 스네이크 — DailyGames
const GAME_ID    = "snake";
const GAME_TITLE = "🐍 스네이크";
const RANK_SORT  = "desc";
const scoreLabel = v => `${Math.round(v)}점`;

const COLS = 20, ROWS = 20, CELL = 16;
const CW = COLS * CELL, CH = ROWS * CELL;

const canvas     = document.getElementById('gameCanvas');
const ctx        = canvas.getContext('2d');
const startBtn   = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreEl    = document.getElementById('snakeScore');
const levelEl    = document.getElementById('snakeLevel');
const lengthEl   = document.getElementById('snakeLength');

canvas.width  = CW;
canvas.height = CH;

const g = {
  running:    false,
  snake:      [],
  dir:        [1, 0],
  nextDir:    [1, 0],
  food:       null,
  bonus:      null,
  score:      0,
  eaten:      0,
  tickMs:     160,
  timerId:    null,
  bonusTimer: null,
};

function rand(n) { return Math.floor(Math.random() * n); }

function occupiedSet() {
  const s = new Set(g.snake.map(([x, y]) => `${x},${y}`));
  if (g.bonus) s.add(`${g.bonus[0]},${g.bonus[1]}`);
  return s;
}

function randomCell() {
  const occ = occupiedSet();
  let pos;
  do { pos = [rand(COLS), rand(ROWS)]; } while (occ.has(`${pos[0]},${pos[1]}`));
  return pos;
}

function placeFood()  { g.food  = randomCell(); }
function placeBonus() {
  g.bonus = randomCell();
  clearTimeout(g.bonusTimer);
  g.bonusTimer = setTimeout(() => { g.bonus = null; draw(); }, 8000);
}

function currentLevel() { return Math.floor(g.eaten / 5) + 1; }

function initGame() {
  const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
  g.snake   = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];
  g.dir     = [1, 0];
  g.nextDir = [1, 0];
  g.score   = 0;
  g.eaten   = 0;
  g.tickMs  = 160;
  g.bonus   = null;
  clearTimeout(g.bonusTimer);
}

function tick() {
  const [dx, dy] = g.nextDir;
  g.dir = [dx, dy];
  const [hx, hy] = g.snake[0];
  const nx = hx + dx, ny = hy + dy;

  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { endGame(); return; }
  if (g.snake.some(([x, y]) => x === nx && y === ny)) { endGame(); return; }

  g.snake.unshift([nx, ny]);

  if (g.food && nx === g.food[0] && ny === g.food[1]) {
    g.score += 10 * currentLevel();
    g.eaten++;
    if (g.eaten % 5 === 0) g.tickMs = Math.max(70, g.tickMs - 10);
    placeFood();
    if (!g.bonus && Math.random() < 0.12) placeBonus();
  } else if (g.bonus && nx === g.bonus[0] && ny === g.bonus[1]) {
    g.score += 50 * currentLevel();
    g.bonus = null;
    clearTimeout(g.bonusTimer);
    g.snake.pop(); // 보너스는 몸 성장 없음
  } else {
    g.snake.pop();
  }

  updateHud();
  draw();
  g.timerId = setTimeout(tick, g.tickMs);
}

function updateHud() {
  if (scoreEl) scoreEl.textContent = `${g.score}점`;
  if (levelEl) levelEl.textContent = `Lv.${currentLevel()}`;
  if (lengthEl) lengthEl.textContent = `길이 ${g.snake.length}`;
}

function draw() {
  ctx.fillStyle = '#08101e';
  ctx.fillRect(0, 0, CW, CH);

  // 격자
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CH); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CW, y * CELL); ctx.stroke();
  }

  // 먹이 (분홍 원)
  if (g.food) {
    const [fx, fy] = g.food;
    ctx.fillStyle = '#ff5fd2';
    ctx.beginPath();
    ctx.arc(fx * CELL + CELL / 2, fy * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 보너스 먹이 (노란 별 — 빛나는 원)
  if (g.bonus) {
    const [bx, by] = g.bonus;
    ctx.save();
    ctx.shadowColor = '#ffd84f';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd84f';
    ctx.beginPath();
    ctx.arc(bx * CELL + CELL / 2, by * CELL + CELL / 2, CELL / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 뱀
  g.snake.forEach(([x, y], i) => {
    const ratio = (g.snake.length - i) / g.snake.length;
    ctx.fillStyle = i === 0 ? '#58f0ff' : `rgba(88,240,255,${(0.25 + ratio * 0.65).toFixed(2)})`;
    const pad = i === 0 ? 1 : 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2, i === 0 ? 4 : 2);
    } else {
      ctx.rect(x * CELL + pad, y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    }
    ctx.fill();
  });
}

function drawIdle() {
  ctx.fillStyle = '#08101e';
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = '13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('시작 버튼을 눌러주세요', CW / 2, CH / 2 - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('방향키 또는 화면 스와이프로 조작', CW / 2, CH / 2 + 12);
  ctx.textAlign = 'left';
}

function startGame() {
  clearTimeout(g.timerId);
  clearTimeout(g.bonusTimer);
  hideResultBanner();
  initGame();
  placeFood();
  g.running = true;
  updateHud();
  draw();
  g.timerId = setTimeout(tick, g.tickMs);
}

function endGame() {
  g.running = false;
  clearTimeout(g.timerId);
  clearTimeout(g.bonusTimer);
  showResultBanner(g.score, scoreLabel(g.score));
  addRecord(g.score);
}

// ── 키보드 ────────────────────────────────────────────────────────────────
const KEY_MAP = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
  W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
};
document.addEventListener('keydown', e => {
  if (!g.running) return;
  const nd = KEY_MAP[e.key];
  if (!nd) return;
  if (nd[0] === -g.dir[0] && nd[1] === -g.dir[1]) return;
  g.nextDir = nd;
  if (e.key.startsWith('Arrow')) e.preventDefault();
});

// ── 스와이프 ──────────────────────────────────────────────────────────────
let swipeStart = null;
document.addEventListener('touchstart', e => {
  if (!g.running) return;
  swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!g.running || !swipeStart) return;
  const dx = e.changedTouches[0].clientX - swipeStart.x;
  const dy = e.changedTouches[0].clientY - swipeStart.y;
  swipeStart = null;
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
  let nd;
  if (Math.abs(dx) > Math.abs(dy)) nd = dx > 0 ? [1, 0] : [-1, 0];
  else nd = dy > 0 ? [0, 1] : [0, -1];
  if (nd[0] === -g.dir[0] && nd[1] === -g.dir[1]) return;
  g.nextDir = nd;
}, { passive: true });

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

drawIdle();
updateRankUI();
