const $ = (id) => document.getElementById(id);

const GAME_ID = "starblitz";
const GAME_TITLE = "스타블리츠";
const RANK_SORT = "desc";
const scoreLabel = (v) => `${Math.round(v)}점`;

const GAME_SEC = 30;
const MAX_SHIELD = 3;

const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreVal = $("scoreVal");
const shieldVal = $("shieldVal");
const comboVal = $("comboVal");
const timeVal = $("timeVal");
const statusText = $("statusText");
const startBtn = $("startBtn");
const leftBtn = $("leftBtn");
const rightBtn = $("rightBtn");

const game = {
  running: false,
  ended: false,
  rafId: 0,
  lastTs: 0,
  viewW: 960,
  viewH: 540,
  timeLeft: GAME_SEC,
  score: 0,
  shield: MAX_SHIELD,
  combo: 1,
  maxCombo: 1,
  comboStreak: 0,
  spawnTimer: 0,
  spawnEvery: 0.9,
  pointerActive: false,
  moveLeft: false,
  moveRight: false,
  shake: 0,
  flash: 0,
  speedOffset: 0,
  stars: [],
  mines: [],
  crystals: [],
  particles: [],
  player: { x: 0, y: 0, targetX: 0, vx: 0, r: 20 },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function setStatus(text) {
  statusText.textContent = text;
}

function refreshHud() {
  scoreVal.textContent = String(Math.round(game.score));
  shieldVal.textContent = `${game.shield}/${MAX_SHIELD}`;
  comboVal.textContent = `x${game.combo}`;
  timeVal.textContent = `${game.timeLeft.toFixed(1)}s`;
}


function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const newW = Math.max(320, Math.round(rect.width));
  const newH = Math.max(260, Math.round(rect.height));

  const prevW = game.viewW;
  const prevH = game.viewH;
  game.viewW = newW;
  game.viewH = newH;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(newW * dpr);
  canvas.height = Math.round(newH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sx = prevW ? newW / prevW : 1;
  const sy = prevH ? newH / prevH : 1;

  game.player.x = clamp(game.player.x * sx || newW * 0.5, game.player.r + 10, newW - game.player.r - 10);
  game.player.targetX = clamp(game.player.targetX * sx || game.player.x, game.player.r + 10, newW - game.player.r - 10);
  game.player.y = newH - 64;

  game.stars.forEach((st) => {
    st.x *= sx;
    st.y *= sy;
  });
  game.mines.forEach((m) => {
    m.baseX *= sx;
    m.x *= sx;
    m.y *= sy;
  });
  game.crystals.forEach((c) => {
    c.baseX *= sx;
    c.x *= sx;
    c.y *= sy;
  });
  game.particles.forEach((p) => {
    p.x *= sx;
    p.y *= sy;
  });
}

function initStars() {
  const layers = [
    { count: 55, speed: 18, minR: 0.6, maxR: 1.2, alpha: 0.45 },
    { count: 40, speed: 32, minR: 0.8, maxR: 1.8, alpha: 0.55 },
    { count: 24, speed: 52, minR: 1.2, maxR: 2.4, alpha: 0.75 },
  ];
  game.stars = [];
  layers.forEach((layer, idx) => {
    for (let i = 0; i < layer.count; i += 1) {
      game.stars.push({
        x: Math.random() * game.viewW,
        y: Math.random() * game.viewH,
        r: layer.minR + Math.random() * (layer.maxR - layer.minR),
        speed: layer.speed,
        alpha: layer.alpha,
        tw: Math.random() * Math.PI * 2,
        layer: idx,
      });
    }
  });
}

function resetRoundState() {
  game.mines = [];
  game.crystals = [];
  game.particles = [];
  game.score = 0;
  game.timeLeft = GAME_SEC;
  game.shield = MAX_SHIELD;
  game.combo = 1;
  game.maxCombo = 1;
  game.comboStreak = 0;
  game.spawnTimer = 0;
  game.spawnEvery = 0.9;
  game.speedOffset = 0;
  game.shake = 0;
  game.flash = 0;
  game.player.vx = 0;
  game.player.x = game.viewW * 0.5;
  game.player.targetX = game.player.x;
  game.player.y = game.viewH - 64;
  refreshHud();
}

function createParticles(x, y, config) {
  const {
    count = 8,
    speedMin = 40,
    speedMax = 180,
    lifeMin = 0.25,
    lifeMax = 0.8,
    sizeMin = 1.8,
    sizeMax = 4.8,
    gravity = 30,
    drag = 1.5,
    colors = ["#ffffff"],
  } = config || {};

  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = speedMin + Math.random() * (speedMax - speedMin);
    const life = lifeMin + Math.random() * (lifeMax - lifeMin);
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
      gravity,
      drag,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

function spawnCrystal() {
  const margin = 36;
  const x = margin + Math.random() * (game.viewW - margin * 2);
  const size = 11 + Math.random() * 7;
  const vy = 170 + Math.random() * 120 + (GAME_SEC - game.timeLeft) * 4;
  game.crystals.push({
    x,
    y: -30,
    baseX: x,
    r: size,
    vy,
    driftAmp: 18 + Math.random() * 22,
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: 1.5 + Math.random() * 1.2,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 4.2,
  });
}

function spawnMine() {
  const margin = 34;
  const x = margin + Math.random() * (game.viewW - margin * 2);
  const r = 16 + Math.random() * 10;
  const vy = 165 + Math.random() * 135 + (GAME_SEC - game.timeLeft) * 5;
  game.mines.push({
    x,
    y: -40,
    baseX: x,
    r,
    vy,
    near: false,
    driftAmp: 24 + Math.random() * 24,
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: 1.2 + Math.random() * 1.5,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 2.7,
  });
}

function spawnWave() {
  const danger = 1 - game.timeLeft / GAME_SEC;
  if (Math.random() < 0.6 + danger * 0.2) spawnMine();
  else spawnCrystal();
  if (danger > 0.45 && Math.random() < 0.32 + danger * 0.25) {
    Math.random() < 0.55 ? spawnMine() : spawnCrystal();
  }
}

function collectCrystal(c, idx) {
  game.crystals.splice(idx, 1);
  game.comboStreak += 1;
  game.combo = Math.min(4, 1 + Math.floor(game.comboStreak / 4));
  game.maxCombo = Math.max(game.maxCombo, game.combo);
  const gain = 10 * game.combo;
  game.score += gain;
  game.flash = Math.min(0.24, game.flash + 0.06);
  createParticles(c.x, c.y, {
    count: 14,
    speedMin: 50,
    speedMax: 220,
    lifeMin: 0.2,
    lifeMax: 0.7,
    gravity: 45,
    colors: ["#d6fbff", "#89f2ff", "#58f0ff", "#a8ff5d"],
  });
  setStatus(`크리스탈 +${gain} · 콤보 x${game.combo}`);
}

function hitMine(m, idx) {
  game.mines.splice(idx, 1);
  game.shield -= 1;
  game.combo = 1;
  game.comboStreak = 0;
  game.shake = 0.36;
  game.flash = 0.5;
  createParticles(m.x, m.y, {
    count: 26,
    speedMin: 80,
    speedMax: 280,
    lifeMin: 0.3,
    lifeMax: 1.0,
    sizeMin: 2.8,
    sizeMax: 6.8,
    gravity: 90,
    colors: ["#ffd070", "#ff8f47", "#ff4d37", "#ffffff"],
  });
  if (game.shield > 0) {
    setStatus(`피격! 실드 ${game.shield}/${MAX_SHIELD}`);
  } else {
    endGame("실드 소진");
  }
}

function grantNearMiss(m) {
  m.near = true;
  game.score += 2;
  createParticles(m.x, m.y, {
    count: 7,
    speedMin: 30,
    speedMax: 100,
    lifeMin: 0.15,
    lifeMax: 0.4,
    sizeMin: 1.4,
    sizeMax: 3.2,
    gravity: 5,
    colors: ["#ffe8ad", "#ffd84f", "#ffffff"],
  });
}

function updatePlayer(dt) {
  const p = game.player;
  const accel = 1650;
  const maxV = 560;

  if (game.pointerActive) {
    const diff = p.targetX - p.x;
    p.vx += diff * 14 * dt;
    p.vx *= 0.82;
  } else {
    let dir = 0;
    if (game.moveLeft) dir -= 1;
    if (game.moveRight) dir += 1;
    p.vx += dir * accel * dt;
    p.vx *= 0.9;
  }

  p.vx = clamp(p.vx, -maxV, maxV);
  p.x += p.vx * dt;

  const leftBound = p.r + 10;
  const rightBound = game.viewW - p.r - 10;
  if (p.x < leftBound) {
    p.x = leftBound;
    p.vx = Math.max(0, p.vx * -0.25);
  } else if (p.x > rightBound) {
    p.x = rightBound;
    p.vx = Math.min(0, p.vx * -0.25);
  }

  createParticles(p.x, p.y + p.r * 0.35, {
    count: 1,
    speedMin: 18,
    speedMax: 54,
    lifeMin: 0.2,
    lifeMax: 0.35,
    sizeMin: 1.5,
    sizeMax: 2.8,
    gravity: -20,
    drag: 4.2,
    colors: ["#ffd970", "#ff9b4f", "#ff6740"],
  });
}

function updateObjects(dt) {
  const p = game.player;

  for (let i = game.crystals.length - 1; i >= 0; i -= 1) {
    const c = game.crystals[i];
    c.y += c.vy * dt;
    c.rot += c.rotSpeed * dt;
    c.x = c.baseX + Math.sin(c.driftPhase + c.y * 0.011) * c.driftAmp;
    c.driftPhase += c.driftSpeed * dt;

    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < c.r + p.r * 0.8) {
      collectCrystal(c, i);
      continue;
    }
    if (c.y - c.r > game.viewH + 24) game.crystals.splice(i, 1);
  }

  for (let i = game.mines.length - 1; i >= 0; i -= 1) {
    const m = game.mines[i];
    m.y += m.vy * dt;
    m.rot += m.rotSpeed * dt;
    m.x = m.baseX + Math.sin(m.driftPhase + m.y * 0.009) * m.driftAmp;
    m.driftPhase += m.driftSpeed * dt;

    const d = Math.hypot(m.x - p.x, m.y - p.y);
    const hitDist = m.r + p.r * 0.72;
    const nearDist = hitDist + 14;

    if (d < hitDist) {
      hitMine(m, i);
      continue;
    }
    if (!m.near && d < nearDist) {
      grantNearMiss(m);
    }
    if (m.y - m.r > game.viewH + 26) game.mines.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      game.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.vx *= Math.max(0, 1 - p.drag * dt);
  }
}

function drawBackground() {
  const w = game.viewW;
  const h = game.viewH;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#030815");
  bg.addColorStop(0.45, "#08122b");
  bg.addColorStop(1, "#060710");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const nebulaA = ctx.createRadialGradient(w * 0.2, h * 0.15, 0, w * 0.2, h * 0.15, w * 0.72);
  nebulaA.addColorStop(0, "rgba(123,74,255,0.24)");
  nebulaA.addColorStop(1, "rgba(123,74,255,0)");
  ctx.fillStyle = nebulaA;
  ctx.fillRect(0, 0, w, h);

  const nebulaB = ctx.createRadialGradient(w * 0.76, h * 0.42, 0, w * 0.76, h * 0.42, w * 0.62);
  nebulaB.addColorStop(0, "rgba(18,213,255,0.2)");
  nebulaB.addColorStop(1, "rgba(18,213,255,0)");
  ctx.fillStyle = nebulaB;
  ctx.fillRect(0, 0, w, h);

  const planetX = w * 0.82;
  const planetY = h * 0.18;
  const planetR = Math.max(52, w * 0.1);
  const planetGlow = ctx.createRadialGradient(planetX, planetY, 0, planetX, planetY, planetR * 2.4);
  planetGlow.addColorStop(0, "rgba(130,228,255,0.22)");
  planetGlow.addColorStop(1, "rgba(130,228,255,0)");
  ctx.fillStyle = planetGlow;
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetR * 2.4, 0, Math.PI * 2);
  ctx.fill();

  const planet = ctx.createRadialGradient(planetX - planetR * 0.3, planetY - planetR * 0.35, 6, planetX, planetY, planetR);
  planet.addColorStop(0, "#d5f5ff");
  planet.addColorStop(0.4, "#73c5ff");
  planet.addColorStop(1, "#21428a");
  ctx.fillStyle = planet;
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(195,243,255,0.35)";
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.ellipse(planetX, planetY + 2, planetR * 1.5, planetR * 0.36, -0.25, 0, Math.PI * 2);
  ctx.stroke();

  const lineSpacing = 38;
  for (let y = -lineSpacing; y < h + lineSpacing; y += lineSpacing) {
    const yy = ((y + game.speedOffset) % (h + lineSpacing)) - 20;
    const alpha = 0.03 + ((yy / h) * 0.03);
    ctx.strokeStyle = `rgba(136,215,255,${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.06, yy);
    ctx.lineTo(w * 0.94, yy + 18);
    ctx.stroke();
  }
}

function drawStars() {
  game.stars.forEach((st) => {
    const twinkle = 0.64 + Math.sin(st.tw) * 0.36;
    ctx.fillStyle = `rgba(220,242,255,${(st.alpha * twinkle).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
    ctx.fill();
    if (st.layer === 2 && st.r > 1.7) {
      ctx.strokeStyle = `rgba(208,240,255,${(st.alpha * 0.45).toFixed(3)})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(st.x - st.r * 3, st.y);
      ctx.lineTo(st.x + st.r * 3, st.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(st.x, st.y - st.r * 3);
      ctx.lineTo(st.x, st.y + st.r * 3);
      ctx.stroke();
    }
  });
}

function drawCrystal(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.rot);

  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, c.r * 2.6);
  glow.addColorStop(0, "rgba(88,240,255,0.3)");
  glow.addColorStop(1, "rgba(88,240,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, c.r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -c.r);
  ctx.lineTo(c.r * 0.72, 0);
  ctx.lineTo(0, c.r);
  ctx.lineTo(-c.r * 0.72, 0);
  ctx.closePath();

  const grad = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
  grad.addColorStop(0, "#f4fdff");
  grad.addColorStop(0.45, "#8af4ff");
  grad.addColorStop(1, "#4dc8ff");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.1;
  ctx.stroke();

  ctx.restore();
}

function drawMine(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);

  const aura = ctx.createRadialGradient(0, 0, m.r * 0.25, 0, 0, m.r * 2.2);
  aura.addColorStop(0, "rgba(255,110,80,0.18)");
  aura.addColorStop(1, "rgba(255,90,40,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, m.r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  const spikes = 10;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i += 1) {
    const ang = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? m.r * 1.3 : m.r * 0.7;
    const x = Math.cos(ang) * rr;
    const y = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const body = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.25, 2, 0, 0, m.r * 1.2);
  body.addColorStop(0, "#ffd8c1");
  body.addColorStop(0.4, "#ff8664");
  body.addColorStop(1, "#6b1a1d");
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "rgba(20,0,0,0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const corePulse = 0.65 + Math.sin(performance.now() * 0.012 + m.rot) * 0.35;
  ctx.fillStyle = `rgba(255,240,220,${(0.7 * corePulse).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 0, m.r * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  game.particles.forEach((p) => {
    const life = p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, p.size * life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);

  const shadowW = p.r * 1.3;
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, p.r * 0.7, shadowW, p.r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  const tilt = clamp(p.vx / 520, -0.45, 0.45);
  ctx.rotate(tilt * 0.45);

  const flameLen = 16 + Math.random() * 10 + Math.abs(tilt) * 9;
  const flame = ctx.createLinearGradient(0, p.r * 0.25, 0, p.r * 0.25 + flameLen);
  flame.addColorStop(0, "#ffe17f");
  flame.addColorStop(0.45, "#ff9f50");
  flame.addColorStop(1, "rgba(255,64,40,0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-6, p.r * 0.2);
  ctx.lineTo(-2, p.r * 0.2 + flameLen);
  ctx.lineTo(0, p.r * 0.2 + flameLen + 7);
  ctx.lineTo(2, p.r * 0.2 + flameLen);
  ctx.lineTo(6, p.r * 0.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1c6fa8";
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-28, 11);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(28, 11);
  ctx.lineTo(11, 10);
  ctx.closePath();
  ctx.fill();

  const hull = ctx.createLinearGradient(-12, -22, 12, 14);
  hull.addColorStop(0, "#d5f7ff");
  hull.addColorStop(0.3, "#7be7ff");
  hull.addColorStop(0.7, "#3f92d6");
  hull.addColorStop(1, "#1e4a7b");
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.bezierCurveTo(11, -12, 13, -1, 10, 14);
  ctx.lineTo(-10, 14);
  ctx.bezierCurveTo(-13, -1, -11, -12, 0, -22);
  ctx.closePath();
  ctx.fill();

  const cockpit = ctx.createRadialGradient(0, -8, 1, 0, -8, 8);
  cockpit.addColorStop(0, "rgba(255,255,255,0.95)");
  cockpit.addColorStop(0.4, "rgba(186,239,255,0.8)");
  cockpit.addColorStop(1, "rgba(36,132,206,0.32)");
  ctx.fillStyle = cockpit;
  ctx.beginPath();
  ctx.ellipse(0, -8, 5.8, 7.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(216,250,255,0.48)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-1, -18);
  ctx.bezierCurveTo(-5, -12, -5, -3, -3, 7);
  ctx.stroke();

  ctx.restore();
}

function drawTopHud() {
  const w = game.viewW;
  ctx.fillStyle = "rgba(3,8,20,0.62)";
  ctx.fillRect(0, 0, w, 34);
  ctx.strokeStyle = "rgba(122,226,255,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(w, 34);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.font = '700 13px "Courier New", Consolas, monospace';
  ctx.fillStyle = "#dcf8ff";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${Math.round(game.score)}`, 10, 17);

  ctx.font = '700 11px "Courier New", Consolas, monospace';
  ctx.fillStyle = "#ffcf7b";
  ctx.fillText("SHIELD", 128, 17);

  const pipStart = 182;
  for (let i = 0; i < MAX_SHIELD; i += 1) {
    const x = pipStart + i * 12;
    const active = i < game.shield;
    ctx.fillStyle = active ? "#ffd178" : "rgba(255,209,120,0.18)";
    ctx.beginPath();
    ctx.arc(x, 17, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = active ? "rgba(255,245,214,0.72)" : "rgba(255,209,120,0.32)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.font = '700 13px "Courier New", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#9de4ff";
  ctx.fillText(`COMBO x${game.combo}`, w / 2, 17);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffe897";
  ctx.fillText(`TIME ${game.timeLeft.toFixed(1)}s`, w - 10, 17);
}

function drawIdleOverlay() {
  if (game.running || game.ended) return;
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 30px "Courier New", Consolas, monospace';
  ctx.fillStyle = "rgba(235,249,255,0.95)";
  ctx.fillText("STARBLITZ", w / 2, h * 0.45);
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(149,219,255,0.88)";
  ctx.fillText("출격 버튼으로 시작", w / 2, h * 0.53);
}

function render() {
  const shakePow = game.shake * 10;
  ctx.save();
  if (shakePow > 0.01) {
    ctx.translate((Math.random() - 0.5) * shakePow, (Math.random() - 0.5) * shakePow);
  }

  drawBackground();
  drawStars();
  game.crystals.forEach(drawCrystal);
  game.mines.forEach(drawMine);
  drawParticles();
  drawPlayer();
  drawTopHud();
  drawIdleOverlay();
  ctx.restore();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,120,90,${(game.flash * 0.35).toFixed(3)})`;
    ctx.fillRect(0, 0, game.viewW, game.viewH);
  }
}

function step(dt) {
  game.timeLeft = Math.max(0, game.timeLeft - dt);
  game.speedOffset += dt * 220;
  game.spawnEvery = Math.max(0.32, 0.92 - (1 - game.timeLeft / GAME_SEC) * 0.55);
  game.shake = Math.max(0, game.shake - dt * 2.2);
  game.flash = Math.max(0, game.flash - dt * 2.4);

  game.stars.forEach((st) => {
    st.y += st.speed * dt;
    st.tw += dt * (1.4 + st.layer * 0.35);
    if (st.y > game.viewH + 3) {
      st.y = -3;
      st.x = Math.random() * game.viewW;
    }
  });

  updatePlayer(dt);

  game.spawnTimer += dt;
  while (game.spawnTimer >= game.spawnEvery) {
    game.spawnTimer -= game.spawnEvery;
    spawnWave();
  }

  updateObjects(dt);
  updateParticles(dt);

  if (!game.running) return;
  if (game.timeLeft <= 0) endGame("작전 종료");
}

function gameLoop(ts) {
  if (!game.running) return;
  if (!game.lastTs) game.lastTs = ts;
  const dt = Math.min(0.033, (ts - game.lastTs) / 1000);
  game.lastTs = ts;
  step(dt);
  refreshHud();
  render();
  if (game.running) game.rafId = requestAnimationFrame(gameLoop);
}

function endGame(reason) {
  if (!game.running) return;
  game.running = false;
  game.ended = true;
  game.pointerActive = false;
  cancelAnimationFrame(game.rafId);
  startBtn.disabled = false;
  startBtn.textContent = "다시 출격";
  const finalScore = Math.round(game.score);
  const label = `${finalScore}점 · 최대 콤보 x${game.maxCombo}`;
  setStatus(`${reason || "작전 완료"} · 최종 ${label}`);
  showResultBanner(finalScore, label);
  addRecord(finalScore);
  render();
}

function startGame() {
  hideResultBanner();
  game.ended = false;
  game.running = false;
  game.pointerActive = false;
  cancelAnimationFrame(game.rafId);
  resetRoundState();
  setStatus("작전 시작. 크리스탈을 먹고 지뢰를 피하세요.");
  startBtn.disabled = true;
  startBtn.textContent = "진행 중";
  game.running = true;
  game.lastTs = 0;
  render();
  game.rafId = requestAnimationFrame(gameLoop);
}

function setDirection(dir, active) {
  if (dir === "left") game.moveLeft = active;
  else game.moveRight = active;
}

function canvasXFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return clamp(e.clientX - rect.left, game.player.r + 10, game.viewW - game.player.r - 10);
}

function bindHoldButton(el, dir) {
  const down = (e) => {
    setDirection(dir, true);
    e.preventDefault();
  };
  const up = (e) => {
    setDirection(dir, false);
    e.preventDefault();
  };
  el.addEventListener("mousedown", down);
  el.addEventListener("mouseup", up);
  el.addEventListener("mouseleave", up);
  el.addEventListener("touchstart", down, { passive: false });
  el.addEventListener("touchend", up, { passive: false });
  el.addEventListener("touchcancel", up, { passive: false });
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    setDirection("left", true);
    e.preventDefault();
  }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    setDirection("right", true);
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") setDirection("left", false);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setDirection("right", false);
});

window.addEventListener("blur", () => {
  game.moveLeft = false;
  game.moveRight = false;
  game.pointerActive = false;
});

canvas.addEventListener("mousedown", (e) => {
  if (!game.running) return;
  game.pointerActive = true;
  game.player.targetX = canvasXFromEvent(e);
  e.preventDefault();
});
window.addEventListener("mousemove", (e) => {
  if (!game.running || !game.pointerActive) return;
  game.player.targetX = canvasXFromEvent(e);
});
window.addEventListener("mouseup", () => {
  game.pointerActive = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

bindHoldButton(leftBtn, "left");
bindHoldButton(rightBtn, "right");

startBtn.addEventListener("click", startGame);
$("restartBtn").addEventListener("click", startGame);

syncCanvasSize();
initStars();
resetRoundState();
setStatus("출격을 누르면 30초 작전이 시작됩니다.");
render();
updateRankUI();

new ResizeObserver(() => {
  const wasRunning = game.running;
  syncCanvasSize();
  if (!game.stars.length) initStars();
  if (!wasRunning) render();
}).observe(canvas);
