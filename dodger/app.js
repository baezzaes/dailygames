const $ = (id) => document.getElementById(id);

const GAME_ID = "dodger";
const GAME_TITLE = "운석 피하기";
const RANK_SORT  = "desc";
const scoreLabel = (v)=>`${v}점`;

const rankTitle = $("rankTitle");
const rankList = $("rankList");

const scoreEl = $("score");
const survivalEl = $("survival");
const stateEl = $("state");
const statusTextEl = $("statusText");
const startBtn = $("startBtn");
const leftBtn = $("leftBtn");
const rightBtn = $("rightBtn");
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");

function syncCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w < 10 || h < 10) return;
  canvas.width = w;
  canvas.height = h;
}
const game = {
  running: false,
  rafId: 0,
  lastTs: 0,
  elapsed: 0,
  score: 0,
  spawnTimer: 0,
  spawnEvery: 0.8,
  moveLeft: false,
  moveRight: false,
  stars: [],
  rocks: [],
  player: { x: canvas.width / 2, y: canvas.height - 46, w: 40, h: 26, speed: 340 },
};

function setState(text) {
  stateEl.textContent = text;
}

function setStatusText(text) {
  statusTextEl.textContent = text;
}

function resetGameState() {
  cancelAnimationFrame(game.rafId);
  game.running = false;
  game.rafId = 0;
  game.lastTs = 0;
  game.elapsed = 0;
  game.score = 0;
  game.spawnTimer = 0;
  game.spawnEvery = 0.8;
  game.moveLeft = false;
  game.moveRight = false;
  game.rocks = [];
  game.player.x = canvas.width / 2;
  game.player.y = canvas.height - 46;

  if (game.stars.length === 0) {
    game.stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.6 + 0.3,
      s: Math.random() * 30 + 10,
      a: Math.random() * 0.5 + 0.2,
    }));
  }

  scoreEl.textContent = "0";
  survivalEl.textContent = "0.0s";
  setState("대기");
  setStatusText("시작을 누르고 방향키(← →) 또는 A/D로 이동하세요.");
  drawFrame(0);
}

function spawnRock() {
  const radius = 12 + Math.random() * 20;
  const speed = 120 + Math.random() * 180 + game.elapsed * 6;
  game.rocks.push({
    x: radius + Math.random() * (canvas.width - radius * 2),
    y: -radius - 8,
    r: radius,
    vy: speed,
    spin: (Math.random() - 0.5) * 3,
    rot: Math.random() * Math.PI * 2,
    hue: 24 + Math.random() * 18,
  });
}

function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= cr * cr;
}

function endGame() {
  if (!game.running) {
    return;
  }
  game.running = false;
  cancelAnimationFrame(game.rafId);
  setState("종료");
  setStatusText(`충돌! 최종 점수 ${game.score}점`);
  showResultBanner(game.score, `${game.score}점`);
  addRecord(game.score);
  drawFrame(0);
}

function update(dt) {
  if (game.moveLeft && !game.moveRight) {
    game.player.x -= game.player.speed * dt;
  } else if (game.moveRight && !game.moveLeft) {
    game.player.x += game.player.speed * dt;
  }
  game.player.x = Math.max(game.player.w / 2 + 6, Math.min(canvas.width - game.player.w / 2 - 6, game.player.x));

  game.elapsed += dt;
  game.score = Math.floor(game.elapsed * 10);
  scoreEl.textContent = String(game.score);
  survivalEl.textContent = `${game.elapsed.toFixed(1)}s`;

  game.spawnEvery = Math.max(0.22, 0.8 - game.elapsed * 0.015);
  game.spawnTimer += dt;
  while (game.spawnTimer >= game.spawnEvery) {
    game.spawnTimer -= game.spawnEvery;
    spawnRock();
  }

  for (const star of game.stars) {
    star.y += star.s * dt;
    if (star.y > canvas.height + 2) {
      star.y = -2;
      star.x = Math.random() * canvas.width;
    }
  }

  const playerRect = {
    x: game.player.x - game.player.w / 2,
    y: game.player.y - game.player.h / 2,
    w: game.player.w,
    h: game.player.h,
  };

  for (let i = game.rocks.length - 1; i >= 0; i -= 1) {
    const rock = game.rocks[i];
    rock.y += rock.vy * dt;
    rock.rot += rock.spin * dt;

    if (circleRectCollide(rock.x, rock.y, rock.r, playerRect.x, playerRect.y, playerRect.w, playerRect.h)) {
      endGame();
      return;
    }

    if (rock.y - rock.r > canvas.height + 8) {
      game.rocks.splice(i, 1);
    }
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#091126");
  g.addColorStop(1, "#03060f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of game.stars) {
    ctx.fillStyle = `rgba(210,230,255,${star.a})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(121,255,168,.08)";
  ctx.lineWidth = 1;
  for (let y = 30; y < canvas.height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const p = game.player;
  const x = p.x;
  const y = p.y;

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = "#79ffa8";
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(18, 12);
  ctx.lineTo(0, 6);
  ctx.lineTo(-18, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#dfffee";
  ctx.beginPath();
  ctx.arc(0, -3, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,180,80,.85)";
  ctx.beginPath();
  ctx.moveTo(-6, 11);
  ctx.lineTo(0, 20 + Math.random() * 4);
  ctx.lineTo(6, 11);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawRock(rock) {
  ctx.save();
  ctx.translate(rock.x, rock.y);
  ctx.rotate(rock.rot);

  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const ang = (Math.PI * 2 * i) / 9;
    const rr = rock.r * (0.78 + ((i % 2) ? 0.22 : 0.05));
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();

  const g = ctx.createRadialGradient(-rock.r * 0.3, -rock.r * 0.4, 2, 0, 0, rock.r);
  g.addColorStop(0, `hsl(${rock.hue} 75% 68%)`);
  g.addColorStop(1, `hsl(${rock.hue} 35% 28%)`);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

function drawOverlay() {
  if (game.running) {
    return;
  }

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(232,236,255,.9)";
  ctx.font = "700 22px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("운석을 피하세요", canvas.width / 2, canvas.height / 2 - 6);
  ctx.font = "14px system-ui";
  ctx.fillStyle = "rgba(232,236,255,.75)";
  ctx.fillText("START를 눌러 시작", canvas.width / 2, canvas.height / 2 + 20);
}

function drawHUD() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(0, 0, canvas.width, 34);
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = "700 13px system-ui";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`점수 ${game.score}`, 10, 17);
  ctx.textAlign = "center";
  ctx.fillText(stateEl.textContent, canvas.width / 2, 17);
  ctx.textAlign = "right";
  ctx.fillText(`${game.elapsed.toFixed(1)}s`, canvas.width - 10, 17);
  ctx.restore();
}

function drawFrame() {
  drawBackground();
  for (const rock of game.rocks) {
    drawRock(rock);
  }
  drawPlayer();
  drawOverlay();
  drawHUD();
}

function tick(ts) {
  if (!game.running) {
    return;
  }

  if (!game.lastTs) {
    game.lastTs = ts;
  }
  const dt = Math.min(0.033, (ts - game.lastTs) / 1000);
  game.lastTs = ts;

  update(dt);
  drawFrame();

  if (game.running) {
    game.rafId = requestAnimationFrame(tick);
  }
}

function startGame() {
  hideResultBanner();
  resetGameState();
  game.running = true;
  setState("진행 중");
  setStatusText("운석 회피 중... 부딪히면 종료됩니다.");
  game.lastTs = 0;
  game.rafId = requestAnimationFrame(tick);
}

function setMove(dir, active) {
  if (dir === "left") {
    game.moveLeft = active;
  } else {
    game.moveRight = active;
  }
}

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    setMove("left", true);
    e.preventDefault();
  }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    setMove("right", true);
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    setMove("left", false);
  }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    setMove("right", false);
  }
});

window.addEventListener("blur", () => {
  game.moveLeft = false;
  game.moveRight = false;
});

function bindHoldButton(el, dir) {
  const down = (e) => {
    setMove(dir, true);
    e.preventDefault();
  };
  const up = (e) => {
    setMove(dir, false);
    e.preventDefault();
  };

  el.addEventListener("mousedown", down);
  el.addEventListener("mouseup", up);
  el.addEventListener("mouseleave", up);
  el.addEventListener("touchstart", down, { passive: false });
  el.addEventListener("touchend", up, { passive: false });
  el.addEventListener("touchcancel", up, { passive: false });
}

bindHoldButton(leftBtn, "left");
bindHoldButton(rightBtn, "right");

startBtn.addEventListener("click", startGame);

syncCanvasSize();
resetGameState();
updateRankUI();

new ResizeObserver(() => {
  if (!game.running) {
    syncCanvasSize();
    resetGameState();
  }
}).observe(canvas);
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
