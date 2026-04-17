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
function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === 'suspended') _ac.resume();
  return _ac;
}
function makeNoise(ctx, dur) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function sndFire() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    // 대포 발사: 저음 진동 burst
    const osc = ctx.createOscillator();
    const og  = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    og.gain.setValueAtTime(0.45, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.22);
    // 노이즈 충격
    const ns = ctx.createBufferSource();
    ns.buffer = makeNoise(ctx, 0.18);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 220; nf.Q.value = 1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    ns.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.18);
  } catch (_) {}
}
function sndWhoosh() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    const ns = ctx.createBufferSource();
    ns.buffer = makeNoise(ctx, 0.55);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.55);
    f.Q.value = 2.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    ns.connect(f); f.connect(g); g.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.55);
  } catch (_) {}
}
function sndMiss() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    const ns = ctx.createBufferSource();
    ns.buffer = makeNoise(ctx, 0.35);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    ns.connect(f); f.connect(g); g.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.35);
  } catch (_) {}
}
function sndHit() {
  try {
    const ctx = ac(), t = ctx.currentTime;
    // 저주파 진동
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.8, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.65);
    // 노이즈 폭발
    const ns = ctx.createBufferSource();
    ns.buffer = makeNoise(ctx, 0.65);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(80, t + 0.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.7, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
    ns.connect(f); f.connect(ng); ng.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.65);
    // 고음 크랙
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(350, t);
    osc2.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    const og2 = ctx.createGain();
    og2.gain.setValueAtTime(0.22, t);
    og2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc2.connect(og2); og2.connect(ctx.destination);
    osc2.start(t); osc2.stop(t + 0.13);
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
  roundDone:   false,
  explosions:  [],
  timerId:     null,
  animId:      null,
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
  g.proj        = null;
  g.explosions  = [];
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
        sndHit();
        const wasFirst = p.firstShot;
        g.proj = null;
        onHit(wasFirst);
      }
    }
  }

  draw();

  // 발사체가 있거나 폭발 애니메이션이 남아있으면 루프 지속
  if (g.proj || g.explosions.length > 0) {
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
