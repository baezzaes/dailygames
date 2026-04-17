// 포트리스 챌린지 — DailyGames
const GAME_ID    = "fortress";
const GAME_TITLE = "🏰 포트리스 챌린지";
const RANK_SORT  = "desc";
const scoreLabel = v => `${Math.round(v)}점`;

// ── 물리 상수 ────────────────────────────────────────────────────────────────
const GRAVITY   = 0.22;
const PWR_SCALE = 0.08;
const WIND_DRAG = 0.014;

// ── 사운드 (Web Audio API) ────────────────────────────────────────────────────
let _ac = null;
function getAC() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state !== 'running') _ac.resume();
  return _ac;
}
// 버퍼 크기 정수 보장
function makeNoiseBuf(a, dur) {
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
// 노이즈 소스 헬퍼 (필터+게인 한 번에)
function noiseLayer(a, dur, freqStart, freqEnd, filterType, gainPeak, gainDecay) {
  const t   = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = makeNoiseBuf(a, dur);
  const f = a.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freqStart, t);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  f.Q.value = 1;
  const g = a.createGain();
  g.gain.setValueAtTime(gainPeak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + gainDecay);
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start(t); src.stop(t + dur);
}
// 오실레이터 헬퍼
function oscLayer(a, type, freqStart, freqEnd, dur, gainPeak) {
  const t   = a.currentTime;
  const osc = a.createOscillator();
  osc.type  = type;
  osc.frequency.setValueAtTime(freqStart, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gainPeak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02);
  osc.connect(g); g.connect(a.destination);
  osc.start(t); osc.stop(t + dur + 0.02);
}

function sndFire() {
  try {
    const a = getAC();
    // 발사 충격음: 크랙(고음) + 쿵(중음)
    oscLayer(a,  'sawtooth', 800,  120, 0.18, 0.5);
    noiseLayer(a, 0.20, 1000, 200, 'bandpass', 0.5, 0.20);
  } catch (_) {}
}
function sndWhoosh() {
  try {
    const a = getAC(), t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = makeNoiseBuf(a, 0.55);
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.55);
    f.Q.value = 2;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t); src.stop(t + 0.55);
  } catch (_) {}
}
function sndMiss() {
  // 지형 충돌: 짧고 날카로운 쿵 소리 (폰 스피커 가청 대역)
  try {
    const a = getAC();
    // ① 크랙: 고음→중음 sweep
    oscLayer(a, 'square',   600, 120, 0.18, 0.55);
    // ② 노이즈 폭발: 800Hz bandpass → 300Hz
    noiseLayer(a, 0.30, 800, 300, 'bandpass', 0.70, 0.30);
    // ③ 잔향: 낮지 않은 400Hz 노이즈 tail
    noiseLayer(a, 0.22, 400, 150, 'lowpass',  0.35, 0.22);
  } catch (_) {}
}
function sndHit() {
  // 적 명중: 크고 묵직한 폭발 (3레이어)
  try {
    const a = getAC();
    // ① 초기 섬광 크랙 (날카로운 고음)
    oscLayer(a, 'sawtooth', 1500, 200, 0.12, 0.65);
    // ② 메인 폭발 노이즈: 1200Hz → 350Hz
    noiseLayer(a, 0.55, 1200, 350, 'bandpass', 0.85, 0.55);
    // ③ 쿵 진동: 중음 square 300Hz → 80Hz
    oscLayer(a, 'square',    300,  80, 0.50, 0.60);
    // ④ 잔향 노이즈: 500Hz 꼬리
    noiseLayer(a, 0.40, 500, 180, 'lowpass',  0.45, 0.40);
  } catch (_) {}
}

// ── 캔버스 ───────────────────────────────────────────────────────────────────
const CW = 360, CH = 260;
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = CW;
canvas.height = CH;

// ── DOM ──────────────────────────────────────────────────────────────────────
const startBtn    = document.getElementById('startBtn');
const restartBtn  = document.getElementById('restartBtn');
const fireBtn     = document.getElementById('fireBtn');
const angleSlider = document.getElementById('angleSlider');
const powerSlider = document.getElementById('powerSlider');
const angleVal    = document.getElementById('angleVal');
const powerVal    = document.getElementById('powerVal');
const roundEl     = document.getElementById('roundLabel');
const scoreEl     = document.getElementById('scoreLabel');
const timerEl     = document.getElementById('timerLabel');
const windEl      = document.getElementById('windLabel');
const shotsEl     = document.getElementById('shotsLabel');
const msgEl       = document.getElementById('statusMsg');
const controls    = document.getElementById('gameControls');

// ── 시드 랜덤 (Mulberry32) ───────────────────────────────────────────────────
function makeSeed(seed) {
  let s = (seed >>> 0) + 1;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

function dailyBaseSeed() {
  const KST = 9 * 60 * 60 * 1000;
  const d   = new Date(Date.now() + KST);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// ── 지형 생성 ────────────────────────────────────────────────────────────────
const TERRAIN_PTS = 11;
const PLAYER_X    = 42;
const ENEMY_X_MIN = 240;
const ENEMY_X_MAX = 320;
const HIT_RADIUS  = 20;

function genTerrain(rng) {
  const ys = [];
  // 왼쪽 플레이어 영역: 낮고 완만
  ys.push(CH - 28, CH - 30, CH - 32);
  // 중앙 지형: 랜덤 언덕 (최대 70px)
  for (let i = 3; i < TERRAIN_PTS - 2; i++) {
    ys.push(CH - 28 - rng() * 70);
  }
  // 오른쪽 적 영역: 중간 높이
  ys.push(CH - 28 - rng() * 50, CH - 28 - rng() * 35);

  // 코사인 보간으로 부드러운 지형 생성
  const terrain = new Float32Array(CW);
  for (let x = 0; x < CW; x++) {
    const t  = (x / (CW - 1)) * (TERRAIN_PTS - 1);
    const i  = Math.min(Math.floor(t), TERRAIN_PTS - 2);
    const f  = t - i;
    const cf = (1 - Math.cos(f * Math.PI)) / 2;
    terrain[x] = ys[i] * (1 - cf) + ys[i + 1] * cf;
  }
  return terrain;
}

// ── 게임 상태 ────────────────────────────────────────────────────────────────
const MAX_ROUNDS = 5;
const MAX_SHOTS  = 5;
const ROUND_TIME = 30;

const g = {
  running:     false,
  round:       0,
  totalScore:  0,
  terrain:     null,
  player:      null,   // { x, y }
  enemy:       null,   // { x, y }
  wind:        0,      // px/frame²: + = 오른쪽
  proj:        null,   // { x, y, vx, vy, trail[], firstShot }
  shots:       0,
  timeLeft:    ROUND_TIME,
  isFirstShot: true,
  roundDone:        false,
  explosions:       [],
  debris:           [],
  enemyDestroyed:   false,
  timerId:          null,
  animId:           null,
};

// ── 라운드 초기화 ─────────────────────────────────────────────────────────────
function setupRound(round) {
  const rng = makeSeed(dailyBaseSeed() * 31 + round);

  g.terrain = genTerrain(rng);

  // 플레이어: 왼쪽 고정
  g.player = { x: PLAYER_X, y: g.terrain[PLAYER_X] };

  // 적: 오른쪽 랜덤 (지형 위)
  const ex = ENEMY_X_MIN + Math.floor(rng() * (ENEMY_X_MAX - ENEMY_X_MIN));
  g.enemy  = { x: ex, y: g.terrain[Math.min(ex, CW - 1)] };

  // 바람: -2.8 ~ +2.8
  g.wind = (rng() * 5.6) - 2.8;

  g.shots       = 0;
  g.timeLeft    = ROUND_TIME;
  g.isFirstShot = true;
  g.roundDone   = false;
  g.proj            = null;
  g.explosions      = [];
  g.debris          = [];
  g.enemyDestroyed  = false;
}

// ── 타이머 ───────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(g.timerId);
  g.timerId = setInterval(() => {
    if (!g.running || g.roundDone) return;
    g.timeLeft = Math.max(0, g.timeLeft - 1);
    updateHud();
    if (g.timeLeft <= 0) {
      clearInterval(g.timerId);
      showMsg('⏰ 시간 초과!');
      endRound();
    }
  }, 1000);
}

// ── HUD ──────────────────────────────────────────────────────────────────────
function updateHud() {
  if (roundEl) roundEl.textContent = `${g.round} / ${MAX_ROUNDS}`;
  if (scoreEl) scoreEl.textContent = `${g.totalScore}점`;
  if (timerEl) {
    timerEl.textContent = `${g.timeLeft}초`;
    timerEl.classList.toggle('hud-urgent', g.timeLeft <= 10);
  }
  const dir = g.wind > 0 ? '→' : g.wind < 0 ? '←' : '—';
  if (windEl) windEl.textContent = `${dir} ${Math.abs(g.wind).toFixed(1)}`;

  // 탄 표시 (남은 탄 🟡, 사용한 탄 ⚫)
  const left = Math.max(0, MAX_SHOTS - g.shots);
  if (shotsEl) shotsEl.textContent = '🟡'.repeat(left) + '⚫'.repeat(MAX_SHOTS - left);
}

function setFireEnabled(on) {
  if (fireBtn) fireBtn.disabled = !on;
}

// ── 슬라이더 이벤트 ───────────────────────────────────────────────────────────
function getAngle() { return parseInt(angleSlider.value, 10); }
function getPower() { return parseInt(powerSlider.value, 10); }

angleSlider.addEventListener('input', () => {
  if (angleVal) angleVal.textContent = `${getAngle()}°`;
  if (!g.roundDone && g.running && !g.proj) draw();
});
powerSlider.addEventListener('input', () => {
  if (powerVal) powerVal.textContent = `${getPower()}%`;
});

// ── 발사 ─────────────────────────────────────────────────────────────────────
function fire() {
  if (!g.running || g.roundDone || g.proj || g.shots >= MAX_SHOTS) return;

  g.shots++;
  setFireEnabled(false);
  updateHud();

  const rad = getAngle() * Math.PI / 180;
  const spd = getPower() * PWR_SCALE;

  // 포신 끝에서 발사
  const bx = g.player.x + Math.cos(rad) * 24;
  const by = g.player.y - 14 - Math.sin(rad) * 24;

  g.proj = {
    x:  bx,
    y:  by,
    vx: spd * Math.cos(rad),
    vy: -spd * Math.sin(rad),
    trail:      [],
    firstShot:  g.isFirstShot,
  };
  g.isFirstShot = false;

  sndFire();
  sndWhoosh();
  cancelAnimationFrame(g.animId);
  g.animId = requestAnimationFrame(animStep);
}

// ── 탄도 애니메이션 (1스텝/프레임 — 느리고 긴장감 있는 비행) ─────────────────
function animStep() {
  const p = g.proj;

  if (p) {
    p.vx += g.wind * WIND_DRAG;
    p.vy += GRAVITY;
    p.x  += p.vx;
    p.y  += p.vy;

    p.trail.push([p.x, p.y]);
    if (p.trail.length > 28) p.trail.shift();

    if (p.x < -10 || p.x > CW + 10 || p.y > CH + 10) {
      // 화면 이탈 — 폭발 없이 조용히 소멸
      sndMiss();
      g.proj = null;
      onMiss();
    } else {
      const tx = Math.round(p.x);
      if (tx >= 0 && tx < CW && p.y >= g.terrain[tx]) {
        // 지형 충돌
        deformTerrain(p.x, 26, 16);
        spawnExplosion(p.x, g.terrain[tx], false);
        sndMiss();
        g.proj = null;
        onMiss();
      } else if (Math.hypot(p.x - g.enemy.x, p.y - (g.enemy.y - 8)) < HIT_RADIUS) {
        // 적 명중
        deformTerrain(g.enemy.x, 32, 20);
        spawnExplosion(g.enemy.x, g.enemy.y - 8, true);
        spawnDebris(g.enemy.x, g.enemy.y - 8);
        g.enemyDestroyed = true;
        sndHit();
        const wasFirst = p.firstShot;
        g.proj = null;
        onHit(wasFirst);
      }
    }
  }

  draw();

  // 발사체가 있거나 폭발/파편 애니메이션이 남아있으면 루프 지속
  if (g.proj || g.explosions.length > 0 || g.debris.length > 0) {
    g.animId = requestAnimationFrame(animStep);
  }
}

// ── 명중 / 미스 ───────────────────────────────────────────────────────────────
function onHit(wasFirst) {
  clearInterval(g.timerId);
  const shotsLeft = MAX_SHOTS - g.shots;
  let pts = 500 + shotsLeft * 80 + g.timeLeft * 5;
  if (wasFirst) pts += 200;
  g.totalScore += pts;
  updateHud();
  showMsg(wasFirst ? `🎯 퍼펙트! +${pts}점` : `💥 명중! +${pts}점`);
  endRound();
}

function onMiss() {
  if (g.shots >= MAX_SHOTS) {
    clearInterval(g.timerId);
    showMsg('💨 탄이 소진됐습니다.');
    endRound();
  } else {
    // 탄 남음 → 계속 발사 가능
    setFireEnabled(true);
  }
}

// ── 라운드 종료 ───────────────────────────────────────────────────────────────
function endRound() {
  g.roundDone = true;
  setFireEnabled(false);
  if (g.round >= MAX_ROUNDS) {
    setTimeout(finishGame, 1800);
  } else {
    setTimeout(nextRound, 1800);
  }
}

function nextRound() {
  g.round++;
  setupRound(g.round);
  updateHud();
  clearMsg();
  setFireEnabled(true);
  startTimer();
  draw();
}

function finishGame() {
  g.running = false;
  clearInterval(g.timerId);
  setFireEnabled(false);
  showResultBanner(g.totalScore, scoreLabel(g.totalScore));
  addRecord(g.totalScore);
}

// ── 지형 변형 (크레이터) ──────────────────────────────────────────────────────
function deformTerrain(cx, radius, depth) {
  const x0 = Math.max(0, Math.round(cx - radius));
  const x1 = Math.min(CW - 1, Math.round(cx + radius));
  for (let x = x0; x <= x1; x++) {
    const t = 1 - Math.pow((x - cx) / radius, 2);
    if (t > 0) g.terrain[x] = Math.min(CH - 2, g.terrain[x] + depth * t);
  }
}

// ── 폭발 이펙트 ───────────────────────────────────────────────────────────────
function spawnExplosion(x, y, big) {
  // 메인 폭발
  g.explosions.push({
    x, y, big,
    r:     big ? 6 : 4,
    alpha: 1.0,
    grow:  big ? 3.8 : 2.6,
    decay: big ? 0.042 : 0.062,
  });
  // 외곽 연기 링 (큰 폭발만)
  if (big) {
    g.explosions.push({ x, y, big: false, r: 10, alpha: 0.55, grow: 4.5, decay: 0.038 });
  }
}

// ── 파편 이펙트 ───────────────────────────────────────────────────────────────
function spawnDebris(x, y) {
  const colors = ['#cc3a3a', '#e05050', '#ff7722', '#ffcc00', '#888888', '#ff4444'];
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const spd   = 2.8 + Math.random() * 3.8;
    g.debris.push({
      x, y,
      vx:   Math.cos(angle) * spd,
      vy:   Math.sin(angle) * spd - 2.5,
      rot:  Math.random() * Math.PI * 2,
      drot: (Math.random() - 0.5) * 0.38,
      w:    4 + Math.random() * 7,
      h:    3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1.0,
    });
  }
}

function tickDebris() {
  for (let i = g.debris.length - 1; i >= 0; i--) {
    const d = g.debris[i];
    d.vy  += GRAVITY * 0.78;
    d.vx  *= 0.984;
    d.x   += d.vx;
    d.y   += d.vy;
    d.rot += d.drot;
    const tx = Math.round(d.x);
    if (tx >= 0 && tx < CW && d.y >= g.terrain[tx]) {
      d.y    = g.terrain[tx];
      d.vy   = -d.vy * 0.22;
      d.vx  *=  0.55;
      d.drot *= 0.45;
    }
    d.alpha -= 0.011;
    if (d.alpha <= 0 || d.x < -20 || d.x > CW + 20) g.debris.splice(i, 1);
  }
}

function drawDebris() {
  tickDebris();
  for (const d of g.debris) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.alpha);
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = d.color;
    ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    ctx.restore();
  }
}

function tickExplosions() {
  for (let i = g.explosions.length - 1; i >= 0; i--) {
    const e = g.explosions[i];
    e.r     += e.grow;
    e.alpha -= e.decay;
    if (e.alpha <= 0) g.explosions.splice(i, 1);
  }
}

// ── 그리기 ────────────────────────────────────────────────────────────────────
function draw() {
  // 하늘
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#060416');
  sky.addColorStop(1, '#111830');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);

  drawStars();
  if (g.terrain) drawTerrain();
  if (g.enemy)   drawEnemy();
  if (g.player)  drawPlayer();
  drawProjectile();
  drawExplosions();
  drawDebris();
}

function drawStars() {
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 35; i++) {
    const sx = (i * 139 + (g.round || 0) * 17) % CW;
    const sy = (i * 67)  % (CH * 0.55);
    ctx.fillRect(sx | 0, sy | 0, 1, 1);
  }
}

function drawTerrain() {
  // 채우기
  ctx.fillStyle = '#2d4a12';
  ctx.beginPath();
  ctx.moveTo(0, CH);
  for (let x = 0; x < CW; x++) ctx.lineTo(x, g.terrain[x]);
  ctx.lineTo(CW - 1, CH);
  ctx.closePath();
  ctx.fill();

  // 외곽선 (밝은 풀)
  ctx.strokeStyle = '#5a8f20';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, g.terrain[0]);
  for (let x = 1; x < CW; x++) ctx.lineTo(x, g.terrain[x]);
  ctx.stroke();
}

function drawPlayer() {
  const { x, y } = g.player;
  const rad = getAngle() * Math.PI / 180;

  // 탱크 몸체
  ctx.fillStyle = '#3a78cc';
  roundRect(ctx, x - 16, y - 11, 32, 13, 3);
  ctx.fill();
  // 상부
  ctx.fillStyle = '#4d9ae0';
  roundRect(ctx, x - 10, y - 17, 20, 8, 2);
  ctx.fill();

  // 포신
  ctx.save();
  ctx.translate(x, y - 14);
  ctx.rotate(-rad);
  ctx.fillStyle = '#7bc8ff';
  roundRect(ctx, 2, -3, 22, 6, 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy() {
  if (g.enemyDestroyed) return;
  const { x, y } = g.enemy;

  // 탱크 몸체
  ctx.fillStyle = '#cc3a3a';
  roundRect(ctx, x - 16, y - 11, 32, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#e05050';
  roundRect(ctx, x - 10, y - 17, 20, 8, 2);
  ctx.fill();

  // 적 X 표시
  ctx.strokeStyle = '#ffff44';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 26); ctx.lineTo(x + 5, y - 36);
  ctx.moveTo(x + 5, y - 26); ctx.lineTo(x - 5, y - 36);
  ctx.stroke();
}

function drawProjectile() {
  const p = g.proj;
  if (!p) return;

  // 궤적 잔상
  if (p.trail.length > 1) {
    ctx.strokeStyle = 'rgba(255,200,60,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.trail[0][0], p.trail[0][1]);
    for (const [tx, ty] of p.trail) ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  // 탄
  ctx.fillStyle = '#ffd84f';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosions() {
  tickExplosions();
  for (const e of g.explosions) {
    if (e.r <= 0) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, e.alpha);
    const gr = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
    if (e.big) {
      gr.addColorStop(0,    '#ffffff');
      gr.addColorStop(0.12, '#ffffa0');
      gr.addColorStop(0.35, '#ff8800');
      gr.addColorStop(0.65, '#cc2200');
      gr.addColorStop(1,    'rgba(180,40,0,0)');
    } else {
      gr.addColorStop(0,    '#ffe880');
      gr.addColorStop(0.3,  '#ff6600');
      gr.addColorStop(0.7,  '#cc3300');
      gr.addColorStop(1,    'rgba(150,30,0,0)');
    }
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── 유틸: roundRect polyfill ──────────────────────────────────────────────────
function roundRect(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); }
  else { c.beginPath(); c.rect(x, y, w, h); }
}

// ── 메시지 ───────────────────────────────────────────────────────────────────
function showMsg(text) {
  if (msgEl) { msgEl.textContent = text; msgEl.style.display = ''; }
}
function clearMsg() {
  if (msgEl) { msgEl.textContent = ''; msgEl.style.display = 'none'; }
}

// ── 게임 시작/재시작 ──────────────────────────────────────────────────────────
function startGame() {
  clearInterval(g.timerId);
  cancelAnimationFrame(g.animId);
  hideResultBanner();
  clearMsg();

  g.running    = true;
  g.round      = 1;
  g.totalScore = 0;

  setupRound(1);
  updateHud();
  setFireEnabled(true);
  startTimer();
  draw();
}

function drawIdle() {
  const sky = ctx.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0, '#060416');
  sky.addColorStop(1, '#111830');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.font = '13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('시작 버튼을 눌러주세요', CW / 2, CH / 2 - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('각도·파워 조절 후 발사!', CW / 2, CH / 2 + 12);
  ctx.textAlign = 'left';
}

startBtn.addEventListener('click',   startGame);
restartBtn.addEventListener('click', startGame);
fireBtn.addEventListener('click',    fire);

if (angleVal) angleVal.textContent = `${getAngle()}°`;
if (powerVal) powerVal.textContent = `${getPower()}%`;

drawIdle();
updateRankUI();
