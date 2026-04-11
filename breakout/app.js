// 벽돌깨기 — DailyGames
const GAME_ID    = "breakout";
const GAME_TITLE = "벽돌깨기";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${Math.round(v)}점`;

GAME_CATALOG.push(
  { id: 'bacteria',  title: '🧫 세균전' },
  { id: 'starblitz', title: '⭐ 스타블리츠' },
  { id: 'breakout',  title: '🧱 벽돌깨기' },
);

// ── 상수 ───────────────────────────────────────────────────────────────
const GAME_SEC   = 60;
const ROWS       = 5;
const COLS       = 9;
const LIVES_MAX  = 3;
const ROW_SCORES = [30, 20, 20, 10, 10]; // 0=최상단
const ROW_COLORS = ['#ff5f5f', '#ff9f4f', '#ffd84f', '#5fff8a', '#4da8ff'];

// 논리 캔버스 해상도 (CSS로 스케일)
const CW = 360, CH = 540;
const HUD_H     = 44;
const BRICK_PX  = 10;  // 좌우 패딩
const BRICK_GAP = 4;
const BRICK_H   = 18;
const BRICK_W   = (CW - BRICK_PX * 2 - BRICK_GAP * (COLS - 1)) / COLS;
const BRICK_Y0  = HUD_H + 14;

const PAD_W      = 80;
const PAD_H      = 12;
const PAD_Y      = CH - 44;
const BALL_R     = 7;
const BASE_SPEED = 215; // px/s

// ── DOM ─────────────────────────────────────────────────────────────────
const canvas     = document.getElementById('gameCanvas');
const ctx        = canvas.getContext('2d');
const statusEl   = document.getElementById('statusMsg');
const startBtn   = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

canvas.width  = CW;
canvas.height = CH;

// ── 게임 상태 ───────────────────────────────────────────────────────────
const state = {
  running:   false,
  ended:     false,
  rafId:     0,
  lastTs:    0,
  timeLeft:  GAME_SEC,
  score:     0,
  lives:     LIVES_MAX,
  speedMult: 1.0,
  ballOnPad: true,
  bricks:    [],
  parts:     [],
  paddle:    { x: (CW - PAD_W) / 2 },
  ball:      { x: CW / 2, y: PAD_Y - BALL_R - 2, vx: 0, vy: 0 },
  pointerX:  null,
};

// ── 벽돌 생성 ───────────────────────────────────────────────────────────
function makeBricks() {
  const arr = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      arr.push({
        r, c,
        x: BRICK_PX + c * (BRICK_W + BRICK_GAP),
        y: BRICK_Y0 + r * (BRICK_H + BRICK_GAP),
        alive: true,
        pts: ROW_SCORES[r],
      });
    }
  }
  return arr;
}

// ── 초기화 ──────────────────────────────────────────────────────────────
function initGame() {
  Object.assign(state, {
    running: false, ended: false, rafId: 0, lastTs: 0,
    timeLeft: GAME_SEC, score: 0, lives: LIVES_MAX,
    speedMult: 1.0, ballOnPad: true, parts: [], pointerX: null,
  });
  state.paddle.x = (CW - PAD_W) / 2;
  state.bricks = makeBricks();
  resetBall();
}

function resetBall() {
  state.ball.x = state.paddle.x + PAD_W / 2;
  state.ball.y = PAD_Y - BALL_R - 2;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ballOnPad = true;
}

function launchBall() {
  if (!state.ballOnPad) return;
  state.ballOnPad = false;
  const angle = -(Math.PI / 2) + (Math.random() * 0.6 - 0.3);
  const spd = BASE_SPEED * state.speedMult;
  state.ball.vx = Math.cos(angle) * spd;
  state.ball.vy = Math.sin(angle) * spd;
}

// ── 입력 ────────────────────────────────────────────────────────────────
function setPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  state.pointerX = (clientX - rect.left) * (CW / rect.width);
}

canvas.addEventListener('mousemove',  e => setPointer(e.clientX));
canvas.addEventListener('click',      () => { if (state.running && state.ballOnPad) launchBall(); });
canvas.addEventListener('touchmove',  e => { e.preventDefault(); setPointer(e.touches[0].clientX); }, { passive: false });
canvas.addEventListener('touchstart', e => {
  setPointer(e.touches[0].clientX);
  if (state.running && state.ballOnPad) launchBall();
}, { passive: true });

// ── 충돌 ────────────────────────────────────────────────────────────────
function circleRect(bx, by, br, rx, ry, rw, rh) {
  const cx = Math.max(rx, Math.min(bx, rx + rw));
  const cy = Math.max(ry, Math.min(by, ry + rh));
  return (bx - cx) ** 2 + (by - cy) ** 2 < br * br;
}

function reflectBrick(brick) {
  const b = state.ball;
  const overlapTop    = (b.y + BALL_R) - brick.y;
  const overlapBottom = (brick.y + BRICK_H) - (b.y - BALL_R);
  const overlapLeft   = (b.x + BALL_R) - brick.x;
  const overlapRight  = (brick.x + BRICK_W) - (b.x - BALL_R);
  if (Math.min(overlapTop, overlapBottom) <= Math.min(overlapLeft, overlapRight)) {
    b.vy = -b.vy;
  } else {
    b.vx = -b.vx;
  }
}

// ── 파티클 ──────────────────────────────────────────────────────────────
function spawnParts(x, y, color) {
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 140;
    state.parts.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, decay: 1.5 + Math.random(),
      r: 2 + Math.random() * 2.5, color,
    });
  }
}

// ── 업데이트 ─────────────────────────────────────────────────────────────
function update(dt) {
  if (!state.running || state.ended) return;

  state.timeLeft = Math.max(0, state.timeLeft - dt);

  // 패들 이동
  if (state.pointerX !== null) {
    state.paddle.x = Math.max(0, Math.min(CW - PAD_W, state.pointerX - PAD_W / 2));
  }

  // 공이 패들 위에 대기 중
  if (state.ballOnPad) {
    state.ball.x = state.paddle.x + PAD_W / 2;
    state.ball.y = PAD_Y - BALL_R - 2;
    if (state.timeLeft <= 0) endGame(false);
    return;
  }

  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // 벽 반사
  if (b.x - BALL_R < 0)  { b.x = BALL_R;      b.vx =  Math.abs(b.vx); }
  if (b.x + BALL_R > CW) { b.x = CW - BALL_R; b.vx = -Math.abs(b.vx); }
  if (b.y - BALL_R < 0)  { b.y = BALL_R;       b.vy =  Math.abs(b.vy); }

  // 패들 충돌 (아래로 움직일 때만)
  if (b.vy > 0 && circleRect(b.x, b.y, BALL_R, state.paddle.x, PAD_Y, PAD_W, PAD_H)) {
    const hit   = (b.x - state.paddle.x) / PAD_W; // 0~1
    const angle = -(Math.PI * (0.15 + hit * 0.7)); // 왼쪽~오른쪽 → 비스듬한 각도
    const spd   = BASE_SPEED * state.speedMult;
    b.vx = Math.cos(angle) * spd;
    b.vy = Math.sin(angle) * spd;
    b.y  = PAD_Y - BALL_R - 1;
    state.speedMult = Math.min(1.6, state.speedMult + 0.025);
  }

  // 공 낙사
  if (b.y - BALL_R > CH) {
    state.lives = Math.max(0, state.lives - 1);
    if (state.lives === 0) { endGame(false); return; }
    resetBall();
  }

  // 벽돌 충돌 — 여러 벽돌을 한 프레임에 파괴할 수 있으나 반사는 1회만
  let hitCount = 0, bricksAlive = 0;
  for (const br of state.bricks) {
    if (!br.alive) continue;
    bricksAlive++;
    if (circleRect(b.x, b.y, BALL_R, br.x, br.y, BRICK_W, BRICK_H)) {
      br.alive = false;
      bricksAlive--;
      state.score += br.pts;
      spawnParts(br.x + BRICK_W / 2, br.y + BRICK_H / 2, ROW_COLORS[br.r]);
      if (hitCount === 0) reflectBrick(br);
      hitCount++;
    }
  }

  // 파티클 업데이트
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) state.parts.splice(i, 1);
  }

  if (bricksAlive === 0) { endGame(true); return; }
  if (state.timeLeft <= 0) endGame(false);
}

// ── 그리기 ──────────────────────────────────────────────────────────────
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function draw() {
  ctx.clearRect(0, 0, CW, CH);

  // 배경
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, CW, CH);

  // HUD 배경
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(0, 0, CW, HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fillRect(0, HUD_H - 1, CW, 1);

  // HUD 텍스트
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#a8ff5d';
  ctx.fillText(`${state.score}점`, 12, HUD_H / 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = state.timeLeft <= 10 ? '#ff5f5f' : '#58f0ff';
  ctx.fillText(`⏱ ${Math.ceil(state.timeLeft)}s`, CW / 2, HUD_H / 2);

  ctx.font = '13px system-ui';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#e8eaf0';
  ctx.fillText('❤️'.repeat(state.lives) + '🖤'.repeat(Math.max(0, LIVES_MAX - state.lives)), CW - 10, HUD_H / 2);

  // 벽돌
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const br of state.bricks) {
    if (!br.alive) continue;
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = ROW_COLORS[br.r];
    rrect(br.x, br.y, BRICK_W, BRICK_H, 3);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(br.pts, br.x + BRICK_W / 2, br.y + BRICK_H / 2);
  }

  // 파티클
  for (const p of state.parts) {
    ctx.globalAlpha = p.life * 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 패들
  const px   = state.paddle.x;
  const pGrad = ctx.createLinearGradient(px, PAD_Y, px, PAD_Y + PAD_H);
  pGrad.addColorStop(0, '#7ef5ff');
  pGrad.addColorStop(1, '#00b8cc');
  ctx.fillStyle = pGrad;
  rrect(px, PAD_Y, PAD_W, PAD_H, 6);
  ctx.fill();

  // 공
  ctx.shadowColor = '#a8ff5d';
  ctx.shadowBlur  = 10;
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(state.ball.x, state.ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 발사 힌트
  if (state.ballOnPad && state.running) {
    ctx.font      = '15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('탭 또는 클릭으로 발사', CW / 2, CH / 2 + 30);
  }
}

// ── 게임 루프 ────────────────────────────────────────────────────────────
function loop(ts) {
  if (!state.running) return;
  const dt = Math.min((ts - state.lastTs) / 1000, 0.05);
  state.lastTs = ts;
  update(dt);
  draw();
  if (state.running) state.rafId = requestAnimationFrame(loop);
}

// ── 게임 종료 ────────────────────────────────────────────────────────────
async function endGame(fullClear) {
  state.running = false;
  state.ended   = true;
  cancelAnimationFrame(state.rafId);

  if (fullClear) {
    const bonus = Math.round(state.timeLeft) * 5;
    state.score += bonus;
    setStatus(`🎉 풀클리어! +${bonus}점 보너스!`);
  }

  draw();
  startBtn.textContent   = '다시 하기';
  startBtn.style.display = '';

  showResultBanner(state.score, scoreLabel(state.score));
  await addRecord(state.score);
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent   = msg || '';
  statusEl.style.display = msg ? '' : 'none';
}

// ── 시작 / 재시작 ────────────────────────────────────────────────────────
function startGame() {
  hideResultBanner();
  setStatus('');
  initGame();
  state.running = true;
  state.lastTs  = performance.now();
  state.rafId   = requestAnimationFrame(loop);
  startBtn.style.display = 'none';
}

startBtn.addEventListener('click', startGame);
if (restartBtn) restartBtn.addEventListener('click', startGame);

// ── 초기 렌더 ────────────────────────────────────────────────────────────
initGame();
draw();
updateRankUI();
