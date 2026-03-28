const $ = (id) => document.getElementById(id);

const GAME_ID    = "dodger";
const GAME_TITLE = "운석 피하기";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}점`;

const rankTitle    = $("rankTitle");
const rankList     = $("rankList");
const scoreEl      = $("score");
const survivalEl   = $("survival");
const stateEl      = $("state");
const statusTextEl = $("statusText");
const startBtn     = $("startBtn");
const leftBtn      = $("leftBtn");
const rightBtn     = $("rightBtn");
const canvas       = $("gameCanvas");
const ctx          = canvas.getContext("2d");

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width), h = Math.round(rect.height);
  if (w < 10 || h < 10) return;
  canvas.width = w; canvas.height = h;
}

const game = {
  running: false, rafId: 0, lastTs: 0, elapsed: 0, score: 0,
  spawnTimer: 0, spawnEvery: 0.8,
  moveLeft: false, moveRight: false,
  stars: [], rocks: [], trail: [],
  player: { x: canvas.width / 2, y: canvas.height - 46, w: 40, h: 26, speed: 340 },
};

function setState(text)     { stateEl.textContent = text; }
function setStatusText(text){ statusTextEl.textContent = text; }

function resetGameState() {
  cancelAnimationFrame(game.rafId);
  Object.assign(game, {
    running:false, rafId:0, lastTs:0, elapsed:0, score:0,
    spawnTimer:0, spawnEvery:0.8,
    moveLeft:false, moveRight:false,
    rocks:[], trail:[],
  });
  game.player.x = canvas.width / 2;
  game.player.y = canvas.height - 46;

  game.stars = Array.from({ length: 80 }, () => ({
    x:   Math.random() * canvas.width,
    y:   Math.random() * canvas.height,
    r:   0.3 + Math.random() * 1.8,
    spd: 12 + Math.random() * 36,
    a:   0.15 + Math.random() * 0.65,
    tw:  Math.random() * Math.PI * 2,
  }));

  scoreEl.textContent    = "0";
  survivalEl.textContent = "0.0s";
  setState("대기");
  setStatusText("시작을 누르고 방향키(← →) 또는 A/D로 이동하세요.");
  drawFrame();
}

// ── Spawn ────────────────────────────────────────────────────────────────────
function makeVerts(r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.62 + Math.random() * 0.38);
    return [Math.cos(a) * d, Math.sin(a) * d];
  });
}

function spawnRock() {
  const radius = 12 + Math.random() * 20;
  game.rocks.push({
    x:    radius + Math.random() * (canvas.width - radius * 2),
    y:    -radius - 8,
    r:    radius,
    vy:   120 + Math.random() * 180 + game.elapsed * 6,
    spin: (Math.random() - 0.5) * 3,
    rot:  Math.random() * Math.PI * 2,
    hue:  24 + Math.random() * 18,
    verts: makeVerts(radius, 7 + Math.floor(Math.random() * 3)),
  });
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= cr * cr;
}

// ── Update ───────────────────────────────────────────────────────────────────
function endGame() {
  if (!game.running) return;
  game.running = false; cancelAnimationFrame(game.rafId);
  setState("종료"); setStatusText(`충돌! 최종 점수 ${game.score}점`);
  showResultBanner(game.score, `${game.score}점`);
  addRecord(game.score); drawFrame();
}

function update(dt) {
  if (game.moveLeft  && !game.moveRight) game.player.x -= game.player.speed * dt;
  if (game.moveRight && !game.moveLeft)  game.player.x += game.player.speed * dt;
  game.player.x = Math.max(game.player.w / 2 + 6,
    Math.min(canvas.width - game.player.w / 2 - 6, game.player.x));

  game.elapsed += dt;
  game.score = Math.floor(game.elapsed * 10);
  scoreEl.textContent    = String(game.score);
  survivalEl.textContent = `${game.elapsed.toFixed(1)}s`;

  game.spawnEvery = Math.max(0.22, 0.8 - game.elapsed * 0.015);
  game.spawnTimer += dt;
  while (game.spawnTimer >= game.spawnEvery) { game.spawnTimer -= game.spawnEvery; spawnRock(); }

  // Stars
  for (const st of game.stars) {
    st.y += st.spd * dt; st.tw += dt * 1.8;
    if (st.y > canvas.height + 2) { st.y = -2; st.x = Math.random() * canvas.width; }
  }

  // Engine trail
  game.trail.push({ x: game.player.x, y: game.player.y + 14, life: 0.28, max: 0.28 });
  for (let i = game.trail.length - 1; i >= 0; i--) {
    game.trail[i].life -= dt;
    if (game.trail[i].life <= 0) game.trail.splice(i, 1);
  }

  // Collision
  const pr = { x: game.player.x - game.player.w / 2, y: game.player.y - game.player.h / 2,
               w: game.player.w, h: game.player.h };
  for (let i = game.rocks.length - 1; i >= 0; i--) {
    const rock = game.rocks[i];
    rock.y += rock.vy * dt; rock.rot += rock.spin * dt;
    if (circleRectCollide(rock.x, rock.y, rock.r * 0.8, pr.x, pr.y, pr.w, pr.h)) {
      endGame(); return;
    }
    if (rock.y - rock.r > canvas.height + 8) game.rocks.splice(i, 1);
  }
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function drawBackground() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0,   "#04091a");
  bg.addColorStop(0.5, "#080f22");
  bg.addColorStop(1,   "#030710");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Nebula
  [
    { cx: canvas.width * 0.7,  cy: canvas.height * 0.3, r: canvas.width * 0.55, c: "rgba(50,15,90,0.20)"  },
    { cx: canvas.width * 0.2,  cy: canvas.height * 0.7, r: canvas.width * 0.45, c: "rgba(0,30,80,0.18)"   },
  ].forEach(({ cx, cy, r, c }) => {
    const n = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    n.addColorStop(0, c); n.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = n; ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  // Stars
  for (const st of game.stars) {
    const a = st.a * (0.65 + Math.sin(st.tw) * 0.35);
    if (st.r > 1.3) {
      const sg = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, st.r * 3.5);
      sg.addColorStop(0, `rgba(255,255,255,${a})`);
      sg.addColorStop(1, "rgba(160,210,255,0)");
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r * 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(200,230,255,${a * 0.4})`; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(st.x - st.r*5, st.y); ctx.lineTo(st.x + st.r*5, st.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(st.x, st.y - st.r*5); ctx.lineTo(st.x, st.y + st.r*5); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(210,232,255,${a})`;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawTrail() {
  for (const t of game.trail) {
    const f = t.life / t.max;
    const tg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, 9 * f);
    tg.addColorStop(0, `rgba(255,150,40,${f * 0.85})`);
    tg.addColorStop(0.5, `rgba(255,70,0,${f * 0.35})`);
    tg.addColorStop(1,   "rgba(200,20,0,0)");
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, t.y, 9 * f, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer() {
  const p = game.player;
  ctx.save(); ctx.translate(p.x, p.y);

  // Engine outer glow
  const eg = ctx.createRadialGradient(0, 15, 0, 0, 15, 30);
  eg.addColorStop(0,    "rgba(255,150,40,0.65)");
  eg.addColorStop(0.45, "rgba(255,80,10,0.22)");
  eg.addColorStop(1,    "rgba(255,30,0,0)");
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(0, 15, 30, 0, Math.PI * 2); ctx.fill();

  // Flame
  const fl = ctx.createLinearGradient(0, 10, 0, 30);
  fl.addColorStop(0,   "#ffdd50"); fl.addColorStop(0.4, "#ff7525");
  fl.addColorStop(1,   "rgba(255,20,0,0)");
  ctx.fillStyle = fl;
  ctx.beginPath();
  ctx.moveTo(-7, 11); ctx.lineTo(-4, 28); ctx.lineTo(0, 33);
  ctx.lineTo(4, 28);  ctx.lineTo(7, 11); ctx.closePath(); ctx.fill();

  // Wings
  ctx.fillStyle = "#1870a0";
  ctx.beginPath();
  ctx.moveTo(-8, -1); ctx.lineTo(-28, 13); ctx.lineTo(-14, 10); ctx.lineTo(-8, 10);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(88,240,255,0.45)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8, -1); ctx.lineTo(28, 13); ctx.lineTo(14, 10); ctx.lineTo(8, 10);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Body
  const body = ctx.createLinearGradient(-9, -19, 9, 12);
  body.addColorStop(0,    "#b8f4ff");
  body.addColorStop(0.35, "#58d8f0");
  body.addColorStop(0.75, "#1e90b8");
  body.addColorStop(1,    "#0a5878");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.bezierCurveTo( 9, -10,  10,  0,  9, 12);
  ctx.lineTo(-9, 12);
  ctx.bezierCurveTo(-10,  0, -9, -10,  0, -19);
  ctx.closePath(); ctx.fill();

  // Highlight
  ctx.strokeStyle = "rgba(180,248,255,0.55)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-1, -17); ctx.bezierCurveTo(-6, -11, -7, -3, -5, 5); ctx.stroke();

  // Cockpit
  const ck = ctx.createRadialGradient(-1, -10, 0, 0, -7, 7);
  ck.addColorStop(0,   "rgba(255,255,255,0.95)");
  ck.addColorStop(0.5, "rgba(140,235,255,0.6)");
  ck.addColorStop(1,   "rgba(20,140,210,0.25)");
  ctx.fillStyle = ck;
  ctx.beginPath(); ctx.ellipse(0, -7, 5, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawRock(rock) {
  ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.rot);

  // Danger aura
  const aura = ctx.createRadialGradient(0, 0, rock.r * 0.5, 0, 0, rock.r * 1.9);
  aura.addColorStop(0,   "rgba(255,80,20,0)");
  aura.addColorStop(0.6, "rgba(255,60,0,0.06)");
  aura.addColorStop(1,   `hsla(${rock.hue},90%,50%,0.14)`);
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, rock.r * 1.9, 0, Math.PI * 2); ctx.fill();

  // Rock body with per-rock hue
  const rg = ctx.createRadialGradient(-rock.r * 0.32, -rock.r * 0.32, 0, 0, 0, rock.r);
  rg.addColorStop(0,   `hsl(${rock.hue} 55% 68%)`);
  rg.addColorStop(0.5, `hsl(${rock.hue} 45% 36%)`);
  rg.addColorStop(1,   `hsl(${rock.hue} 40% 14%)`);
  ctx.fillStyle = rg;

  const v = rock.verts;
  ctx.beginPath(); ctx.moveTo(v[0][0], v[0][1]);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i][0], v[i][1]);
  ctx.closePath(); ctx.fill();

  // Edge
  ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();

  // Surface highlight
  ctx.strokeStyle = `hsla(${rock.hue},80%,82%,0.30)`; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(v[0][0] * 0.58, v[0][1] * 0.58);
  for (let i = 1; i < Math.ceil(v.length / 2.5); i++) ctx.lineTo(v[i][0] * 0.58, v[i][1] * 0.58);
  ctx.stroke();

  ctx.restore();
}

function drawOverlay() {
  if (!game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.font = "700 23px system-ui"; ctx.fillStyle = "rgba(240,250,255,0.95)";
    ctx.fillText("운석을 피하세요", canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "14px system-ui"; ctx.fillStyle = "rgba(140,210,255,0.8)";
    ctx.fillText("START를 눌러 시작", canvas.width / 2, canvas.height / 2 + 18);
  }
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = "rgba(2,6,20,0.7)";
  ctx.fillRect(0, 0, canvas.width, 34);
  ctx.strokeStyle = "rgba(88,240,255,0.2)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 34); ctx.lineTo(canvas.width, 34); ctx.stroke();

  ctx.font = "700 13px system-ui"; ctx.textBaseline = "middle";
  ctx.textAlign = "left";   ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`점수 ${game.score}`, 10, 17);
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(200,220,255,0.7)";
  ctx.fillText(stateEl.textContent, canvas.width / 2, 17);
  ctx.textAlign = "right";  ctx.fillStyle = "rgba(88,240,255,0.9)";
  ctx.fillText(`${game.elapsed.toFixed(1)}s`, canvas.width - 10, 17);
  ctx.restore();
}

function drawFrame() {
  drawBackground(); drawTrail();
  for (const rock of game.rocks) drawRock(rock);
  drawPlayer(); drawOverlay(); drawHUD();
}

// ── Game loop ────────────────────────────────────────────────────────────────
function tick(ts) {
  if (!game.running) return;
  if (!game.lastTs) game.lastTs = ts;
  const dt = Math.min(0.033, (ts - game.lastTs) / 1000);
  game.lastTs = ts;
  update(dt); drawFrame();
  if (game.running) game.rafId = requestAnimationFrame(tick);
}

function startGame() {
  hideResultBanner(); resetGameState();
  game.running = true;
  setState("진행 중"); setStatusText("운석 회피 중... 부딪히면 종료됩니다.");
  game.lastTs = 0;
  game.rafId = requestAnimationFrame(tick);
}

function setMove(dir, active) {
  if (dir === "left") game.moveLeft = active; else game.moveRight = active;
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") { setMove("left",  true); e.preventDefault(); }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { setMove("right", true); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") setMove("left",  false);
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") setMove("right", false);
});
window.addEventListener("blur", () => { game.moveLeft = false; game.moveRight = false; });

function bindHoldButton(el, dir) {
  const down = (e) => { setMove(dir, true);  e.preventDefault(); };
  const up   = (e) => { setMove(dir, false); e.preventDefault(); };
  el.addEventListener("mousedown",  down);
  el.addEventListener("mouseup",    up);
  el.addEventListener("mouseleave", up);
  el.addEventListener("touchstart", down, { passive: false });
  el.addEventListener("touchend",   up,   { passive: false });
  el.addEventListener("touchcancel",up,   { passive: false });
}

bindHoldButton(leftBtn, "left");
bindHoldButton(rightBtn, "right");
startBtn.addEventListener("click", startGame);

syncCanvasSize(); resetGameState(); updateRankUI();

new ResizeObserver(() => { if (!game.running) { syncCanvasSize(); resetGameState(); } }).observe(canvas);
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
