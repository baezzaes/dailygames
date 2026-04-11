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

const CW = 360, CH = 460;
const HUD_H     = 44;
const BRICK_PX  = 10;
const BRICK_GAP = 4;
const BRICK_H   = 18;
const BRICK_W   = (CW - BRICK_PX * 2 - BRICK_GAP * (COLS - 1)) / COLS;
const BRICK_Y0  = HUD_H + 24;

const PAD_W_BASE = 80;
const PAD_H      = 12;
const PAD_Y      = CH - 44;
const BALL_R     = 7;
const BASE_SPEED = 215;
const MAX_BALLS  = 4;

const ITEM_DROP_CHANCE = 0.12;
const ITEM_SPEED       = 90;
const ITEM_R           = 13;

// ── 아이템 정의 ──────────────────────────────────────────────────────────
const ITEM_DEFS = {
  multiball: { emoji: '🔵', color: '#4da8ff', label: '멀티볼!',    good: true,  dur: 0 },
  widepad:   { emoji: '🟢', color: '#5fff8a', label: '패들 확장!', good: true,  dur: 9 },
  pierce:    { emoji: '⚡', color: '#ffd84f', label: '관통!',       good: true,  dur: 8 },
  timeadd:   { emoji: '⏱', color: '#58f0ff', label: '+10초!',      good: true,  dur: 0 },
  speeddown: { emoji: '🐢', color: '#a8ff5d', label: '슬로우!',    good: true,  dur: 7 },
  speedup:   { emoji: '🔥', color: '#ff5f5f', label: '스피드UP!',  good: false, dur: 6 },
  dark:      { emoji: '🌑', color: '#8888aa', label: '어둠!',       good: false, dur: 8 },
};
const ITEM_KEYS = Object.keys(ITEM_DEFS);

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
  balls:     [],      // { x, y, vx, vy }
  bricks:    [],
  parts:     [],
  items:     [],      // 떨어지는 아이템 { x, y, type }
  effects:   {},      // 활성 효과 타이머 { widepad: 5.2, ... }
  padW:      PAD_W_BASE,
  pierce:    false,
  dark:      false,
  paddle:    { x: (CW - PAD_W_BASE) / 2 },
  pointerX:  null,
  msgText:   '',
  msgColor:  '#a8ff5d',
  msgTimer:  0,
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
    speedMult: 1.0, ballOnPad: true,
    balls: [], parts: [], items: [], effects: {},
    padW: PAD_W_BASE, pierce: false, dark: false,
    pointerX: null, msgText: '', msgTimer: 0,
  });
  state.paddle.x = (CW - PAD_W_BASE) / 2;
  state.bricks = makeBricks();
}

function resetBall() {
  state.balls    = [];
  state.ballOnPad = true;
}

function launchBall() {
  if (!state.ballOnPad) return;
  state.ballOnPad = false;
  const angle = -(Math.PI / 2) + (Math.random() * 0.6 - 0.3);
  const spd = BASE_SPEED * state.speedMult;
  state.balls = [{
    x: state.paddle.x + state.padW / 2,
    y: PAD_Y - BALL_R - 2,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
  }];
}

// ── 입력 ────────────────────────────────────────────────────────────────
function setPointer(clientX) {
  const rect = canvas.getBoundingClientRect();
  state.pointerX = (clientX - rect.left) * (CW / rect.width);
}

canvas.addEventListener('mousemove',  e => setPointer(e.clientX));
canvas.addEventListener('click',      () => { if (state.running && state.ballOnPad) launchBall(); });
canvas.addEventListener('touchmove',  e => { setPointer(e.touches[0].clientX); }, { passive: true });
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

function reflectBall(ball, brick) {
  const overlapTop    = (ball.y + BALL_R) - brick.y;
  const overlapBottom = (brick.y + BRICK_H) - (ball.y - BALL_R);
  const overlapLeft   = (ball.x + BALL_R) - brick.x;
  const overlapRight  = (brick.x + BRICK_W) - (ball.x - BALL_R);
  if (Math.min(overlapTop, overlapBottom) <= Math.min(overlapLeft, overlapRight)) {
    ball.vy = -ball.vy;
  } else {
    ball.vx = -ball.vx;
  }
}

// ── 아이템 ──────────────────────────────────────────────────────────────
function maybeDropItem(x, y) {
  if (Math.random() > ITEM_DROP_CHANCE) return;
  const type = ITEM_KEYS[Math.floor(Math.random() * ITEM_KEYS.length)];
  state.items.push({ x, y, type });
}

function showMsg(text, color) {
  state.msgText  = text;
  state.msgColor = color || '#a8ff5d';
  state.msgTimer = 1.4;
}

function applyItem(type) {
  const def = ITEM_DEFS[type];
  showMsg(def.label, def.good ? '#a8ff5d' : '#ff5f5f');

  switch (type) {
    case 'multiball':
      if (state.balls.length > 0 && state.balls.length < MAX_BALLS) {
        const src = state.balls[0];
        const angle = -(Math.PI / 2) + (Math.random() * 0.8 - 0.4);
        const spd = Math.hypot(src.vx, src.vy);
        state.balls.push({
          x: src.x, y: src.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
        });
      }
      break;

    case 'widepad':
      state.padW = Math.min(CW * 0.72, PAD_W_BASE * 1.85);
      state.effects.widepad = def.dur;
      break;

    case 'pierce':
      state.pierce = true;
      state.effects.pierce = def.dur;
      break;

    case 'timeadd':
      state.timeLeft = Math.min(GAME_SEC * 1.5, state.timeLeft + 10);
      break;

    case 'speeddown':
      for (const b of state.balls) {
        const spd = Math.hypot(b.vx, b.vy);
        const newSpd = Math.max(BASE_SPEED * 0.5, spd * 0.55);
        const r = newSpd / (spd || 1);
        b.vx *= r; b.vy *= r;
      }
      state.speedMult = Math.max(0.6, state.speedMult * 0.7);
      state.effects.speeddown = def.dur;
      break;

    case 'speedup':
      for (const b of state.balls) {
        const spd = Math.hypot(b.vx, b.vy);
        const newSpd = Math.min(BASE_SPEED * 2.4, spd * 1.6);
        const r = newSpd / (spd || 1);
        b.vx *= r; b.vy *= r;
      }
      state.speedMult = Math.min(2.2, state.speedMult * 1.5);
      state.effects.speedup = def.dur;
      break;

    case 'dark':
      state.dark = true;
      state.effects.dark = def.dur;
      break;
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
  state.msgTimer = Math.max(0, state.msgTimer - dt);

  // 효과 타이머
  for (const key of Object.keys(state.effects)) {
    state.effects[key] -= dt;
    if (state.effects[key] <= 0) {
      delete state.effects[key];
      if (key === 'widepad')   state.padW   = PAD_W_BASE;
      if (key === 'pierce')    state.pierce = false;
      if (key === 'dark')      state.dark   = false;
    }
  }

  // 패들 이동
  if (state.pointerX !== null) {
    state.paddle.x = Math.max(0, Math.min(CW - state.padW, state.pointerX - state.padW / 2));
  }

  // 공 대기 중
  if (state.ballOnPad) {
    if (state.timeLeft <= 0) endGame(false);
    return;
  }

  // ── 공 업데이트
  for (let bi = state.balls.length - 1; bi >= 0; bi--) {
    const b = state.balls[bi];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 벽 반사
    if (b.x - BALL_R < 0)  { b.x = BALL_R;      b.vx =  Math.abs(b.vx); }
    if (b.x + BALL_R > CW) { b.x = CW - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y - BALL_R < 0)  { b.y = BALL_R;       b.vy =  Math.abs(b.vy); }

    // 패들 충돌
    if (b.vy > 0 && circleRect(b.x, b.y, BALL_R, state.paddle.x, PAD_Y, state.padW, PAD_H)) {
      const hit   = (b.x - state.paddle.x) / state.padW;
      const angle = -(Math.PI * (0.15 + hit * 0.7));
      const spd   = BASE_SPEED * state.speedMult;
      b.vx = Math.cos(angle) * spd;
      b.vy = Math.sin(angle) * spd;
      b.y  = PAD_Y - BALL_R - 1;
      state.speedMult = Math.min(1.6, state.speedMult + 0.02);
    }

    // 낙사
    if (b.y - BALL_R > CH) {
      state.balls.splice(bi, 1);
      if (state.balls.length === 0) {
        state.lives = Math.max(0, state.lives - 1);
        if (state.lives === 0) { endGame(false); return; }
        resetBall();
      }
      continue;
    }

    // 벽돌 충돌
    let hitCount = 0;
    for (const br of state.bricks) {
      if (!br.alive) continue;
      if (circleRect(b.x, b.y, BALL_R, br.x, br.y, BRICK_W, BRICK_H)) {
        br.alive = false;
        state.score += br.pts;
        spawnParts(br.x + BRICK_W / 2, br.y + BRICK_H / 2, ROW_COLORS[br.r]);
        maybeDropItem(br.x + BRICK_W / 2, br.y + BRICK_H);
        if (!state.pierce && hitCount === 0) reflectBall(b, br);
        hitCount++;
      }
    }
  }

  // ── 아이템 업데이트
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    it.y += ITEM_SPEED * dt;
    // 패들에 닿으면 적용
    if (it.y + ITEM_R > PAD_Y && it.y - ITEM_R < PAD_Y + PAD_H &&
        it.x > state.paddle.x && it.x < state.paddle.x + state.padW) {
      applyItem(it.type);
      state.items.splice(i, 1);
      continue;
    }
    if (it.y > CH + ITEM_R) state.items.splice(i, 1);
  }

  // ── 파티클 업데이트
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const p = state.parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) state.parts.splice(i, 1);
  }

  const bricksAlive = state.bricks.filter(br => br.alive).length;
  if (bricksAlive === 0) { endGame(true); return; }
  if (state.timeLeft <= 0) { endGame(false); return; }
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

  // 활성 효과 바
  const effectKeys = Object.keys(state.effects);
  if (effectKeys.length > 0) {
    let ex = 8;
    ctx.font = 'bold 10px system-ui';
    ctx.textBaseline = 'middle';
    for (const key of effectKeys) {
      const def  = ITEM_DEFS[key];
      const secs = Math.ceil(state.effects[key]);
      const label = def.dur > 0 ? `${def.emoji} ${secs}s` : def.emoji;
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = def.good ? 'rgba(168,255,93,0.18)' : 'rgba(255,95,95,0.18)';
      rrect(ex, HUD_H + 3, tw, 16, 4);
      ctx.fill();
      ctx.fillStyle = def.good ? '#a8ff5d' : '#ff7070';
      ctx.textAlign = 'left';
      ctx.fillText(label, ex + 5, HUD_H + 11);
      ex += tw + 4;
    }
  }

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

  // 어둠 효과 (패들 근처 제외)
  if (state.dark) {
    ctx.fillStyle = 'rgba(5,8,20,0.82)';
    ctx.fillRect(0, HUD_H + 22, CW, PAD_Y - HUD_H - 68);
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

  // 아이템 드롭
  ctx.font = '16px system-ui';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const it of state.items) {
    const def = ITEM_DEFS[it.type];
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(it.x, it.y, ITEM_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(def.emoji, it.x, it.y);
  }

  // 패들
  const px = state.paddle.x;
  const pw = state.padW;
  const pGrad = ctx.createLinearGradient(px, PAD_Y, px, PAD_Y + PAD_H);
  if (state.pierce) {
    pGrad.addColorStop(0, '#ffe47e');
    pGrad.addColorStop(1, '#cc9900');
  } else if ('widepad' in state.effects) {
    pGrad.addColorStop(0, '#7effa8');
    pGrad.addColorStop(1, '#00cc55');
  } else {
    pGrad.addColorStop(0, '#7ef5ff');
    pGrad.addColorStop(1, '#00b8cc');
  }
  ctx.fillStyle = pGrad;
  rrect(px, PAD_Y, pw, PAD_H, 6);
  ctx.fill();

  // 공 (대기 중)
  if (state.ballOnPad) {
    ctx.shadowColor = '#a8ff5d';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#ffffff';
    ctx.beginPath();
    ctx.arc(state.paddle.x + pw / 2, PAD_Y - BALL_R - 2, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // 공 (비행 중)
  for (const b of state.balls) {
    ctx.shadowColor = state.pierce ? '#ffd84f' : '#a8ff5d';
    ctx.shadowBlur  = state.pierce ? 18 : 10;
    ctx.fillStyle   = state.pierce ? '#ffd84f' : '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // 발사 힌트
  if (state.ballOnPad && state.running) {
    ctx.font      = '15px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('탭 또는 클릭으로 발사', CW / 2, CH / 2 + 30);
  }

  // 아이템 획득 메시지
  if (state.msgTimer > 0) {
    ctx.globalAlpha = Math.min(1, state.msgTimer * 2);
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.msgColor;
    ctx.fillText(state.msgText, CW / 2, CH / 2 - 10);
    ctx.globalAlpha = 1;
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
  if (state.ended) return;
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
