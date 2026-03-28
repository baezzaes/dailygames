const GAME_ID    = "balance";
const GAME_TITLE = "균형 잡기";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}개`;

const GAME_SEC  = 30;
const BALL_R    = 14;
const STAR_R    = 18;
const GRAVITY   = 0.38;
const FRICTION  = 0.88;
const WALL_BOUNCE = 0.45;

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');

// ── Tilt input ──────────────────────────────────────────────
let tiltX = 0, tiltY = 0;
let tiltReady = false;

function onOrientation(e) {
  // gamma: left/right (-90~90), beta: forward/back (-180~180)
  tiltX = Math.max(-30, Math.min(30, e.gamma || 0)) / 30;
  tiltY = Math.max(-30, Math.min(30, (e.beta || 0) - 20)) / 30; // -20 offset for natural hold
  tiltReady = true;
}

async function requestTilt() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const perm = await DeviceOrientationEvent.requestPermission().catch(() => 'denied');
    if (perm === 'granted') {
      window.addEventListener('deviceorientation', onOrientation);
      return true;
    }
    return false;
  }
  window.addEventListener('deviceorientation', onOrientation);
  return true;
}

// Desktop fallback: mouse position
canvas.addEventListener('mousemove', e => {
  if (tiltReady) return;
  const r = canvas.getBoundingClientRect();
  tiltX = ((e.clientX - r.left) / r.width - 0.5) * 2;
  tiltY = ((e.clientY - r.top)  / r.height - 0.5) * 2;
});

// iOS permission button
const permBtn = $('permBtn');
const tiltNotice = $('tiltNotice');

function syncCanvasSize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 10 || h < 10) return;
  canvas.width = w; canvas.height = h;
}

// ── Star pool ────────────────────────────────────────────────
function makeVerts(n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 0.7 + Math.random() * 0.3;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

const game = {
  running: false, rafId: 0,
  score: 0, timeLeft: GAME_SEC,
  ball: { x: 0, y: 0, vx: 0, vy: 0 },
  star: { x: 0, y: 0, pulse: 0, collected: false },
  particles: [],
};

function spawnStar() {
  const { width: W, height: H } = canvas;
  const margin = STAR_R + 20;
  let x, y, tries = 0;
  do {
    x = margin + Math.random() * (W - margin * 2);
    y = margin + Math.random() * (H - margin * 2);
    tries++;
  } while (tries < 20 && Math.hypot(x - game.ball.x, y - game.ball.y) < 80);
  game.star = { x, y, pulse: 0 };
}

function spawnParticles(x, y) {
  const colors = ['#ffd84f', '#ffe97a', '#ff9f40', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 4;
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, color: colors[Math.floor(Math.random() * colors.length)],
      r: 3 + Math.random() * 3,
    });
  }
}

// ── Draw ────────────────────────────────────────────────────
function drawBackground() {
  const { width: W, height: H } = canvas;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1a2e'); bg.addColorStop(1, '#080e1a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Grid dots
  ctx.fillStyle = 'rgba(88,240,255,0.05)';
  const spacing = 32;
  for (let x = spacing; x < W; x += spacing)
    for (let y = spacing; y < H; y += spacing) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    }
}

function drawBall() {
  const { x, y } = game.ball;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(x, y + BALL_R + 4, BALL_R * 0.9, BALL_R * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  // Glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, BALL_R * 2.5);
  glow.addColorStop(0, 'rgba(88,240,255,.25)'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, BALL_R * 2.5, 0, Math.PI * 2); ctx.fill();
  // Ball body
  const grad = ctx.createRadialGradient(x - BALL_R * 0.3, y - BALL_R * 0.3, 1, x, y, BALL_R);
  grad.addColorStop(0, '#a0f8ff'); grad.addColorStop(0.5, '#58f0ff'); grad.addColorStop(1, '#00a8c0');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, BALL_R, 0, Math.PI * 2); ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.arc(x - BALL_R * 0.28, y - BALL_R * 0.28, BALL_R * 0.28, 0, Math.PI * 2); ctx.fill();
}

function drawStar() {
  const { x, y, pulse } = game.star;
  const r = STAR_R + Math.sin(pulse) * 2;
  const spikes = 5, outerR = r, innerR = r * 0.45;

  // Aura
  const aura = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
  aura.addColorStop(0, 'rgba(255,216,79,.2)'); aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2); ctx.fill();

  // Star shape
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    i === 0 ? ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad)
            : ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
  }
  ctx.closePath();
  const sg = ctx.createRadialGradient(x, y, 0, x, y, outerR);
  sg.addColorStop(0, '#fff7a0'); sg.addColorStop(0.5, '#ffd84f'); sg.addColorStop(1, '#ff9f00');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  game.particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawHUD() {
  const { width: W, height: H } = canvas;
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(0, 0, W, 36);
  ctx.strokeStyle = 'rgba(88,240,255,.25)';
  ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(W, 36); ctx.stroke();

  ctx.font = `bold ${Math.floor(H * 0.07)}px "Courier New"`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a8ff5d'; ctx.textAlign = 'left';
  ctx.fillText(`${game.score}개`, 12, 18);
  ctx.fillStyle = '#58f0ff'; ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(game.timeLeft)}s`, W - 12, 18);
}

// ── Game loop ────────────────────────────────────────────────
let lastTs = 0;

function loop(ts) {
  if (!game.running) return;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  const { width: W, height: H } = canvas;

  // Physics
  game.ball.vx += tiltX * GRAVITY * (W / 360);
  game.ball.vy += tiltY * GRAVITY * (W / 360);
  game.ball.vx *= FRICTION;
  game.ball.vy *= FRICTION;
  game.ball.x += game.ball.vx;
  game.ball.y += game.ball.vy;

  // Wall bounce
  if (game.ball.x < BALL_R)         { game.ball.x = BALL_R;      game.ball.vx *= -WALL_BOUNCE; }
  if (game.ball.x > W - BALL_R)     { game.ball.x = W - BALL_R;  game.ball.vx *= -WALL_BOUNCE; }
  if (game.ball.y < BALL_R + 36)    { game.ball.y = BALL_R + 36; game.ball.vy *= -WALL_BOUNCE; }
  if (game.ball.y > H - BALL_R)     { game.ball.y = H - BALL_R;  game.ball.vy *= -WALL_BOUNCE; }

  // Star collection
  game.star.pulse += dt * 4;
  const dist = Math.hypot(game.ball.x - game.star.x, game.ball.y - game.star.y);
  if (dist < BALL_R + STAR_R) {
    game.score++;
    spawnParticles(game.star.x, game.star.y);
    spawnStar();
  }

  // Particles
  game.particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15;
    p.life -= dt * 1.8;
  });
  game.particles = game.particles.filter(p => p.life > 0);

  // Timer
  game.timeLeft -= dt;
  if (game.timeLeft <= 0) { game.timeLeft = 0; endGame(); return; }

  // Draw
  syncCanvasSize();
  drawBackground();
  drawStar();
  drawParticles();
  drawBall();
  drawHUD();

  game.rafId = requestAnimationFrame(loop);
}

// ── Game flow ────────────────────────────────────────────────
function startGame() {
  game.running = false;
  cancelAnimationFrame(game.rafId);
  syncCanvasSize();
  const { width: W, height: H } = canvas;

  game.score = 0;
  game.timeLeft = GAME_SEC;
  game.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  game.particles = [];
  hideResultBanner();
  $('startBtn').hidden = true;
  game.running = true;
  spawnStar();
  lastTs = performance.now();
  game.rafId = requestAnimationFrame(ts => { lastTs = ts; loop(ts); });
}

function endGame() {
  game.running = false;
  cancelAnimationFrame(game.rafId);
  $('startBtn').hidden = false;
  addRecord(game.score);
  showResultBanner(game.score, scoreLabel(game.score));
}

// ── Init ────────────────────────────────────────────────────
async function init() {
  syncCanvasSize();
  new ResizeObserver(syncCanvasSize).observe(canvas);

  // Check if device has orientation sensor
  const hasOrient = 'DeviceOrientationEvent' in window;
  const needsPermission = hasOrient &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  if (needsPermission) {
    tiltNotice.style.display = '';
    permBtn.addEventListener('click', async () => {
      const ok = await requestTilt();
      if (ok) tiltNotice.style.display = 'none';
      else permBtn.textContent = '권한이 거부됐습니다 (마우스로 플레이)';
    });
  } else if (hasOrient) {
    requestTilt();
  }

  $('startBtn').addEventListener('click', startGame);
  $('restartBtn').addEventListener('click', () => { hideResultBanner(); startGame(); });

  updateRankUI();

  // Draw idle screen
  drawBackground();
  const { width: W, height: H } = canvas;
  ctx.font = `bold ${Math.floor(H * 0.08)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,216,79,.25)';
  ctx.fillText('⭐', W / 2, H / 2);
}

init();
