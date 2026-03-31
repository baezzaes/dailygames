const $ = (id) => document.getElementById(id);
const GAME_ID    = "runner";
const GAME_TITLE = "피하기 + 코인 먹기";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}점`;
// 장애물은 피하고 코인은 먹으면서 점수를 누적하는 러너 게임입니다.

const nameEl       = $("name");
const rankTitle    = $("rankTitle");
const rankList     = $("rankList");
const scoreEl      = $("score");
const timeEl       = $("time");
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
  // 러너 게임 전체 상태(플레이어, 아이템, 파티클, 점수)
  running:false, raf:0, last:0, time:0, score:0, coinBonus:0,
  left:false, right:false, spawn:0, spawnRate:0.7,
  stars:[], items:[], particles:[], trail:[],
  player:{ x:0, y:0, w:44, h:22, speed:360 },
};

function setState(t)  { stateEl.textContent = t; }
function setStatus(t) { statusTextEl.textContent = t; }

function reset() {
  cancelAnimationFrame(game.raf);
  Object.assign(game, {
    running:false, last:0, time:0, score:0, coinBonus:0,
    left:false, right:false, spawn:0, spawnRate:0.7,
    items:[], particles:[], trail:[],
  });
  game.player.x = canvas.width / 2;
  game.player.y = canvas.height - 44;
  game.stars = [];
  for (let i = 0; i < 80; i++) {
    game.stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      spd: 14 + Math.random() * 38,
      r:   0.3 + Math.random() * 1.8,
      a:   0.15 + Math.random() * 0.65,
      tw:  Math.random() * Math.PI * 2,
    });
  }
  scoreEl.textContent = "0"; timeEl.textContent = "0.0s";
  setState("대기"); setStatus("시작을 누르고 좌우로 이동하세요.");
  draw();
}

// ── Spawn ────────────────────────────────────────────────────────────────────
function makeVerts(r, n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.62 + Math.random() * 0.38);
    return [Math.cos(a) * d, Math.sin(a) * d];
  });
}

function spawn() {
  // 코인/운석을 확률로 생성하고 시간 경과에 따라 낙하 속도를 높입니다.
  const isCoin = Math.random() < 0.35;
  const size   = isCoin ? 11 : 15 + Math.random() * 18;
  const item   = {
    type:  isCoin ? "coin" : "rock",
    x:     size + Math.random() * (canvas.width - size * 2),
    y:     -size - 6,
    r:     size,
    v:     120 + Math.random() * 150 + game.time * 6,
    rot:   Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 2.5,
    pulse: Math.random() * Math.PI * 2,
  };
  if (!isCoin) item.verts = makeVerts(size, 7 + Math.floor(Math.random() * 3));
  game.items.push(item);
}

function collideCircleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= cr * cr;
}

// ── Particles ────────────────────────────────────────────────────────────────
function spawnCoinParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 55 + Math.random() * 100;
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50,
      life: 0.45 + Math.random() * 0.3, maxLife: 0.75,
      r: 2 + Math.random() * 3,
    });
  }
}

// ── Update ───────────────────────────────────────────────────────────────────
function end() {
  if (!game.running) return;
  game.running = false; cancelAnimationFrame(game.raf);
  setState("종료"); setStatus(`게임 종료! 점수 ${game.score}점`);
  showResultBanner(game.score, `${game.score}점`);
  addRecord(game.score); draw();
}

function update(dt) {
  // 입력 처리 -> 스폰/이동 -> 충돌/점수 계산
  if (game.left  && !game.right) game.player.x -= game.player.speed * dt;
  if (game.right && !game.left)  game.player.x += game.player.speed * dt;
  game.player.x = Math.max(26, Math.min(canvas.width - 26, game.player.x));

  game.time += dt;
  game.score = Math.floor(game.time * 10) + game.coinBonus;
  scoreEl.textContent = String(game.score);
  timeEl.textContent  = `${game.time.toFixed(1)}s`;

  game.spawnRate = Math.max(0.24, 0.7 - game.time * 0.012);
  game.spawn += dt;
  while (game.spawn >= game.spawnRate) { game.spawn -= game.spawnRate; spawn(); }

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

  // Particles
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt; p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  // Collision
  const pr = { x: game.player.x - game.player.w/2, y: game.player.y - game.player.h/2,
               w: game.player.w, h: game.player.h };
  for (let i = game.items.length - 1; i >= 0; i--) {
    const it = game.items[i];
    it.y += it.v * dt; it.rot += it.spin * dt;
    if (collideCircleRect(it.x, it.y, it.r * 0.78, pr.x, pr.y, pr.w, pr.h)) {
      if (it.type === "coin") {
        game.coinBonus += 50; game.score += 50;
        scoreEl.textContent = String(game.score);
        spawnCoinParticles(it.x, it.y);
        game.items.splice(i, 1);
      } else { end(); return; }
    } else if (it.y - it.r > canvas.height + 8) { game.items.splice(i, 1); }
  }
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function drawBG() {
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0,   "#04091a");
  bg.addColorStop(0.5, "#080f22");
  bg.addColorStop(1,   "#030710");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Nebula blobs
  [
    { cx: canvas.width * 0.25, cy: canvas.height * 0.35, r: canvas.width * 0.55, c: "rgba(50,15,90,0.20)" },
    { cx: canvas.width * 0.75, cy: canvas.height * 0.65, r: canvas.width * 0.45, c: "rgba(0,30,80,0.18)"  },
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
    const r = 9 * f;
    const tg = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
    tg.addColorStop(0, `rgba(255,150,40,${f * 0.85})`);
    tg.addColorStop(0.5, `rgba(255,70,0,${f * 0.35})`);
    tg.addColorStop(1,   "rgba(200,20,0,0)");
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer() {
  const p = game.player;
  ctx.save(); ctx.translate(p.x, p.y);

  // Engine outer glow
  const eg = ctx.createRadialGradient(0, 15, 0, 0, 15, 30);
  eg.addColorStop(0, "rgba(255,150,40,0.65)");
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
  const wingColor = "#1870a0";
  ctx.fillStyle = wingColor;
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
  ctx.bezierCurveTo(-10,  0,  -9, -10,  0, -19);
  ctx.closePath(); ctx.fill();

  // Body left highlight
  ctx.strokeStyle = "rgba(180,248,255,0.55)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-1, -17); ctx.bezierCurveTo(-6, -11, -7, -3, -5, 5); ctx.stroke();

  // Cockpit glass
  const ck = ctx.createRadialGradient(-1, -10, 0, 0, -7, 7);
  ck.addColorStop(0,   "rgba(255,255,255,0.95)");
  ck.addColorStop(0.5, "rgba(140,235,255,0.6)");
  ck.addColorStop(1,   "rgba(20,140,210,0.25)");
  ctx.fillStyle = ck;
  ctx.beginPath(); ctx.ellipse(0, -7, 5, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawRock(it) {
  ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);

  // Danger aura
  const aura = ctx.createRadialGradient(0, 0, it.r * 0.5, 0, 0, it.r * 1.9);
  aura.addColorStop(0,   "rgba(255,80,20,0)");
  aura.addColorStop(0.6, "rgba(255,60,0,0.06)");
  aura.addColorStop(1,   "rgba(220,40,0,0.14)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, 0, it.r * 1.9, 0, Math.PI * 2); ctx.fill();

  // Rock body
  const rg = ctx.createRadialGradient(-it.r * 0.32, -it.r * 0.32, 0, 0, 0, it.r);
  rg.addColorStop(0,   "#c89870");
  rg.addColorStop(0.5, "#8a5830");
  rg.addColorStop(1,   "#3a1e0a");
  ctx.fillStyle = rg;

  const v = it.verts;
  ctx.beginPath(); ctx.moveTo(v[0][0], v[0][1]);
  for (let i = 1; i < v.length; i++) ctx.lineTo(v[i][0], v[i][1]);
  ctx.closePath(); ctx.fill();

  // Edge
  ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 1.5; ctx.stroke();

  // Surface highlight
  ctx.strokeStyle = "rgba(255,210,160,0.28)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(v[0][0] * 0.58, v[0][1] * 0.58);
  for (let i = 1; i < Math.ceil(v.length / 2.5); i++) ctx.lineTo(v[i][0] * 0.58, v[i][1] * 0.58);
  ctx.stroke();

  ctx.restore();
}

function drawCoin(it) {
  ctx.save(); ctx.translate(it.x, it.y);
  const s = 0.86 + Math.sin(it.pulse + game.time * 4.5) * 0.14;
  ctx.scale(s, s);

  // Outer glow
  const og = ctx.createRadialGradient(0, 0, 0, 0, 0, it.r * 2.8);
  og.addColorStop(0,   "rgba(255,230,70,0.55)");
  og.addColorStop(0.5, "rgba(255,170,0,0.18)");
  og.addColorStop(1,   "rgba(255,100,0,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(0, 0, it.r * 2.8, 0, Math.PI * 2); ctx.fill();

  // Coin body
  const cg = ctx.createRadialGradient(-it.r * 0.32, -it.r * 0.32, 0, 0, 0, it.r);
  cg.addColorStop(0,   "#fff590");
  cg.addColorStop(0.4, "#ffd020");
  cg.addColorStop(1,   "#b07200");
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.fill();

  // Rim
  ctx.strokeStyle = "rgba(255,255,200,0.65)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, it.r, 0, Math.PI * 2); ctx.stroke();

  // Inner ring
  ctx.strokeStyle = "rgba(180,110,0,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, it.r * 0.62, 0, Math.PI * 2); ctx.stroke();

  // $ symbol
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = `bold ${Math.round(it.r * 1.05)}px system-ui`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 1);

  ctx.restore();
}

function drawParticles() {
  for (const p of game.particles) {
    const f = p.life / p.maxLife;
    const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
    pg.addColorStop(0,   f > 0.5 ? `rgba(255,240,80,${f})` : `rgba(255,140,20,${f})`);
    pg.addColorStop(1,   "rgba(255,100,0,0)");
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawOverlay() {
  if (!game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.font = "700 23px system-ui"; ctx.fillStyle = "rgba(240,250,255,0.95)";
    ctx.fillText("RUNNER", canvas.width / 2, canvas.height / 2 - 8);
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

  ctx.textBaseline = "middle";
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`점수 ${game.score}`, 10, 17);
  ctx.textAlign = "right"; ctx.fillStyle = "rgba(88,240,255,0.9)";
  ctx.fillText(`${game.time.toFixed(1)}s`, canvas.width - 10, 17);
  ctx.restore();
}

function draw() {
  drawBG(); drawTrail();
  for (const it of game.items) { it.type === "rock" ? drawRock(it) : drawCoin(it); }
  drawPlayer(); drawParticles(); drawOverlay(); drawHUD();
}

function tick(ts) {
  if (!game.running) return;
  if (!game.last) game.last = ts;
  const dt = Math.min(0.033, (ts - game.last) / 1000);
  game.last = ts;
  update(dt); draw();
  if (game.running) game.raf = requestAnimationFrame(tick);
}

function start() {
  hideResultBanner(); reset();
  game.running = true;
  setState("진행 중"); setStatus("코인을 먹고 장애물을 피하세요.");
  game.raf = requestAnimationFrame(tick);
}

function move(dir, on) { if (dir === "left") game.left = on; else game.right = on; }

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft","a","A"].includes(e.key)) { move("left",true);  e.preventDefault(); }
  if (["ArrowRight","d","D"].includes(e.key)) { move("right",true); e.preventDefault(); }
});
window.addEventListener("keyup", (e) => {
  if (["ArrowLeft","a","A"].includes(e.key))  move("left",false);
  if (["ArrowRight","d","D"].includes(e.key)) move("right",false);
});
window.addEventListener("blur", () => { game.left = false; game.right = false; });

function bindHold(el, dir) {
  const d = (e) => { move(dir, true);  e.preventDefault(); };
  const u = (e) => { move(dir, false); e.preventDefault(); };
  el.addEventListener("mousedown", d); el.addEventListener("mouseup", u); el.addEventListener("mouseleave", u);
  el.addEventListener("touchstart", d, { passive:false });
  el.addEventListener("touchend",   u, { passive:false });
  el.addEventListener("touchcancel",u, { passive:false });
}
bindHold(leftBtn, "left"); bindHold(rightBtn, "right");
startBtn.addEventListener("click", start);
syncCanvasSize(); reset(); updateRankUI();

new ResizeObserver(() => { if (!game.running) { syncCanvasSize(); reset(); } }).observe(canvas);
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); start(); });
