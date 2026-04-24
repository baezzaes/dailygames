const GAME_ID = "flappybird";
const GAME_TITLE = "🐤 플래피버드";
const RANK_SORT = "desc";
const scoreLabel = (v) => `${Math.round(v)}점`;

const CW = 360;
const CH = 540;
const GROUND_H = 84;
const PLAY_H = CH - GROUND_H;

const BIRD_X = 104;
const BIRD_R = 14;
const GRAVITY = 1450;
const JUMP_VELOCITY = -400;

const PIPE_W = 62;
const PIPE_INTERVAL = 1.24;
const PIPE_GAP_MAX = 176;
const PIPE_GAP_MIN = 132;
const PIPE_MARGIN_TOP = 62;
const PIPE_MARGIN_BOTTOM = 72;
const PIPE_SPEED_BASE = 175;
const PIPE_SPEED_MAX = 272;

const BG_SCROLL_BASE = 52;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = CW;
canvas.height = CH;

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const statusEl = document.getElementById("statusMsg");
const scoreNowEl = document.getElementById("scoreNow");
const scoreBestEl = document.getElementById("scoreBest");
const speedNowEl = document.getElementById("speedNow");

const state = {
  running: false,
  ended: false,
  rafId: 0,
  lastTs: 0,
  birdY: PLAY_H * 0.48,
  birdVy: 0,
  score: 0,
  best: 0,
  pipes: [],
  spawnTimer: 0,
  worldShift: 0,
};

function readLocalBest() {
  const raw = Number(localStorage.getItem("dailygames:flappybird:pb"));
  return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
}

function gameSpeed() {
  return Math.min(PIPE_SPEED_BASE + state.score * 4, PIPE_SPEED_MAX);
}

function speedMultiplierLabel() {
  return `${(gameSpeed() / PIPE_SPEED_BASE).toFixed(1)}x`;
}

function updateStats() {
  if (scoreNowEl) scoreNowEl.textContent = scoreLabel(state.score);
  if (scoreBestEl) scoreBestEl.textContent = scoreLabel(state.best);
  if (speedNowEl) speedNowEl.textContent = speedMultiplierLabel();
}

function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
}

function flap() {
  if (!state.running) return;
  state.birdVy = JUMP_VELOCITY;
}

function spawnPipe() {
  const scoreGapPenalty = Math.min(state.score * 2, 36);
  const gapSize = Math.max(PIPE_GAP_MIN, PIPE_GAP_MAX - scoreGapPenalty);
  const minGapY = PIPE_MARGIN_TOP + gapSize / 2;
  const maxGapY = PLAY_H - PIPE_MARGIN_BOTTOM - gapSize / 2;
  const gapY = minGapY + Math.random() * (maxGapY - minGapY);

  state.pipes.push({
    x: CW + 20,
    gapY,
    gapSize,
    passed: false,
  });
}

function resetGameState() {
  state.running = false;
  state.ended = false;
  state.rafId = 0;
  state.lastTs = 0;
  state.birdY = PLAY_H * 0.48;
  state.birdVy = 0;
  state.score = 0;
  state.pipes = [];
  state.spawnTimer = 0;
  state.worldShift = 0;
  state.best = Math.max(state.best, readLocalBest());
  updateStats();
}

function startGame() {
  hideResultBanner();
  resetGameState();
  state.running = true;
  startBtn.style.display = "none";
  startBtn.textContent = "다시 하기";
  setStatus("탭해서 날아오르세요!");
  spawnPipe();
  state.lastTs = performance.now();
  state.rafId = requestAnimationFrame(loop);
}

function collideWithPipe(pipe) {
  const birdLeft = BIRD_X - BIRD_R;
  const birdRight = BIRD_X + BIRD_R;
  const birdTop = state.birdY - BIRD_R;
  const birdBottom = state.birdY + BIRD_R;

  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + PIPE_W;
  if (birdRight <= pipeLeft || birdLeft >= pipeRight) return false;

  const gapTop = pipe.gapY - pipe.gapSize / 2;
  const gapBottom = pipe.gapY + pipe.gapSize / 2;
  return birdTop < gapTop || birdBottom > gapBottom;
}

function update(dt) {
  if (!state.running || state.ended) return;

  const speed = gameSpeed();
  state.worldShift += (BG_SCROLL_BASE + speed * 0.16) * dt;
  state.spawnTimer += dt;

  if (state.spawnTimer >= PIPE_INTERVAL) {
    state.spawnTimer -= PIPE_INTERVAL;
    spawnPipe();
  }

  state.birdVy += GRAVITY * dt;
  state.birdY += state.birdVy * dt;

  if (state.birdY - BIRD_R <= 0) {
    endGame("천장에 부딪혔어요!");
    return;
  }
  if (state.birdY + BIRD_R >= PLAY_H) {
    endGame("바닥에 닿았어요!");
    return;
  }

  for (let i = state.pipes.length - 1; i >= 0; i--) {
    const p = state.pipes[i];
    p.x -= speed * dt;

    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      state.score += 1;
      state.best = Math.max(state.best, state.score);
      updateStats();
    }

    if (collideWithPipe(p)) {
      endGame("파이프에 부딪혔어요!");
      return;
    }

    if (p.x + PIPE_W < -20) {
      state.pipes.splice(i, 1);
    }
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, PLAY_H);
  sky.addColorStop(0, "#6ec8ff");
  sky.addColorStop(0.55, "#8ee4ff");
  sky.addColorStop(1, "#d6f6ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, PLAY_H);

  const cloudSpeed = 20;
  const offset = (state.worldShift * cloudSpeed * 0.02) % (CW + 140);
  for (let i = -1; i < 4; i++) {
    const x = i * 140 - offset;
    const y = 56 + (i % 2) * 36;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(x + 30, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 52, y - 8, 22, 0, Math.PI * 2);
    ctx.arc(x + 76, y, 18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPipes() {
  for (const p of state.pipes) {
    const gapTop = p.gapY - p.gapSize / 2;
    const gapBottom = p.gapY + p.gapSize / 2;

    ctx.fillStyle = "#30a84a";
    ctx.fillRect(p.x, 0, PIPE_W, gapTop);
    ctx.fillRect(p.x, gapBottom, PIPE_W, PLAY_H - gapBottom);

    ctx.fillStyle = "#25853b";
    ctx.fillRect(p.x - 4, gapTop - 12, PIPE_W + 8, 12);
    ctx.fillRect(p.x - 4, gapBottom, PIPE_W + 8, 12);
  }
}

function drawGround() {
  ctx.fillStyle = "#d4b277";
  ctx.fillRect(0, PLAY_H, CW, GROUND_H);

  const stripeOffset = (state.worldShift * 0.8) % 36;
  for (let x = -36; x < CW + 36; x += 36) {
    ctx.fillStyle = "#c39a5f";
    ctx.fillRect(x - stripeOffset, PLAY_H + 8, 18, 8);
  }
}

function drawBird() {
  const tilt = Math.max(-0.7, Math.min(0.9, state.birdVy / 530));
  ctx.save();
  ctx.translate(BIRD_X, state.birdY);
  ctx.rotate(tilt);

  ctx.fillStyle = "#ffd84f";
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffb347";
  ctx.beginPath();
  ctx.ellipse(-5, 3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff8b39";
  ctx.beginPath();
  ctx.moveTo(10, -1);
  ctx.lineTo(22, 3);
  ctx.lineTo(10, 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(4, -5, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(5, -5, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "rgba(12,28,48,0.45)";
  ctx.fillRect(0, 0, CW, 50);
  ctx.font = 'bold 25px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(state.score), CW / 2, 26);
}

function drawGuideText() {
  if (state.running) return;
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(26, PLAY_H * 0.32, CW - 52, 76);
  ctx.font = 'bold 16px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4fbff";
  const msg = state.ended
    ? "다시 시작하려면 버튼이나 화면을 탭하세요"
    : "시작 버튼 또는 화면 탭으로 시작";
  ctx.fillText(msg, CW / 2, PLAY_H * 0.32 + 38);
}

function draw() {
  ctx.clearRect(0, 0, CW, CH);
  drawBackground();
  drawPipes();
  drawBird();
  drawGround();
  drawHud();
  drawGuideText();
}

function loop(ts) {
  if (!state.running) return;
  const dt = Math.min((ts - state.lastTs) / 1000, 0.034);
  state.lastTs = ts;
  update(dt);
  draw();
  if (state.running) state.rafId = requestAnimationFrame(loop);
}

async function endGame(reason) {
  if (state.ended) return;
  state.running = false;
  state.ended = true;
  cancelAnimationFrame(state.rafId);

  state.best = Math.max(state.best, state.score);
  updateStats();
  setStatus(`${reason} 점수 ${scoreLabel(state.score)}`);
  draw();

  startBtn.style.display = "";
  showResultBanner(state.score, scoreLabel(state.score));
  await addRecord(state.score);
}

function handlePrimaryAction() {
  if (!state.running) {
    startGame();
    flap();
    return;
  }
  flap();
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handlePrimaryAction();
});

window.addEventListener("keydown", (e) => {
  if (e.key !== " " && e.key !== "ArrowUp") return;
  if (e.target && /input|textarea|select/i.test(e.target.tagName || "")) return;
  e.preventDefault();
  handlePrimaryAction();
});

startBtn.addEventListener("click", startGame);
if (restartBtn) restartBtn.addEventListener("click", startGame);

resetGameState();
setStatus("화면을 탭해서 점프!");
draw();
updateRankUI();
