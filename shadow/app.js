const GAME_ID    = "shadow";
const GAME_TITLE = "그림자 퀴즈";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}점`;

const ITEMS = [
  { e: '🐘', n: '코끼리' }, { e: '🦒', n: '기린' },   { e: '🐬', n: '돌고래' },
  { e: '🦋', n: '나비' },   { e: '🐢', n: '거북이' }, { e: '🦀', n: '게' },
  { e: '🐙', n: '문어' },   { e: '🦈', n: '상어' },   { e: '🦩', n: '플라밍고' },
  { e: '🚀', n: '로켓' },   { e: '✈️', n: '비행기' }, { e: '🚁', n: '헬리콥터' },
  { e: '⚓', n: '닻' },     { e: '🎸', n: '기타' },   { e: '🏆', n: '트로피' },
  { e: '🔑', n: '열쇠' },   { e: '🌵', n: '선인장' }, { e: '🍄', n: '버섯' },
  { e: '🦕', n: '공룡' },   { e: '🦑', n: '오징어' }, { e: '🦜', n: '앵무새' },
  { e: '🦚', n: '공작' },   { e: '🎷', n: '색소폰' }, { e: '🗿', n: '모아이' },
  { e: '🏰', n: '성' },     { e: '🦞', n: '바닷가재'},{ e: '🐊', n: '악어' },
  { e: '🦅', n: '독수리' }, { e: '🐉', n: '용' },     { e: '🎺', n: '트럼펫' },
];

const GAME_SEC = 60;
const REVEAL_SEC = 0.9;

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');

function syncCanvasSize() {
  const r = canvas.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height);
  if (w < 10 || h < 10) return;
  canvas.width = w; canvas.height = h;
}

const game = {
  running: false, rafId: 0,
  score: 0, timeLeft: GAME_SEC,
  current: null, choices: [], correctIdx: -1,
  answered: false, selectedIdx: -1, revealTimer: 0,
  silCache: null, silKey: '',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextQuestion() {
  const pool = shuffle(ITEMS);
  game.current = pool[0];
  game.choices = shuffle(pool.slice(0, 4));
  game.correctIdx = game.choices.indexOf(game.current);
  game.answered = false;
  game.selectedIdx = -1;
  game.revealTimer = 0;
  renderChoices();
}

function makeSilhouette(emoji, size) {
  const off = document.createElement('canvas');
  off.width = off.height = size;
  const c = off.getContext('2d');
  c.font = `${Math.floor(size * 0.72)}px serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(emoji, size / 2, size / 2);
  const img = c.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 10) { d[i] = 0; d[i+1] = 0; d[i+2] = 0; d[i+3] = 255; }
  }
  c.putImageData(img, 0, 0);
  return off;
}

function getSil(size) {
  const key = `${game.current.e}_${size}`;
  if (game.silKey !== key) {
    game.silCache = makeSilhouette(game.current.e, Math.ceil(size));
    game.silKey = key;
  }
  return game.silCache;
}

function drawIdle() {
  syncCanvasSize();
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1a2e'); bg.addColorStop(1, '#091220');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  ctx.font = `bold ${Math.floor(H * 0.08)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.fillText('?', W / 2, H / 2);
}

let lastTs = 0;
function loop(ts) {
  if (!game.running) return;
  const dt = Math.min((ts - lastTs) / 1000, 0.1);
  lastTs = ts;

  if (game.answered) {
    game.revealTimer -= dt;
    if (game.revealTimer <= 0) nextQuestion();
  } else {
    game.timeLeft -= dt;
    if (game.timeLeft <= 0) { game.timeLeft = 0; endGame(); return; }
  }

  draw();
  game.rafId = requestAnimationFrame(loop);
}

function draw() {
  syncCanvasSize();
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1a2e'); bg.addColorStop(1, '#091220');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  if (!game.current) return;

  const size = Math.min(W, H) * 0.52;
  const cx = W / 2, cy = H / 2;

  // Glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.75);
  glow.addColorStop(0, 'rgba(88,240,255,.1)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.75, 0, Math.PI * 2); ctx.fill();

  if (game.answered) {
    // Reveal emoji
    ctx.font = `${Math.floor(size * 0.72)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(game.current.e, cx, cy);
  } else {
    ctx.drawImage(getSil(size), cx - size / 2, cy - size / 2, size, size);
  }

  // Timer bar
  const pct = game.timeLeft / GAME_SEC;
  const bw = W * 0.86, bh = 7, bx = (W - bw) / 2, by = H - 18;
  ctx.fillStyle = 'rgba(255,255,255,.1)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
  ctx.fillStyle = pct > 0.4 ? '#58f0ff' : pct > 0.2 ? '#ffd84f' : '#ff5050';
  ctx.beginPath(); ctx.roundRect(bx, by, bw * pct, bh, 3); ctx.fill();

  // HUD
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.floor(H * 0.078)}px "Courier New"`;
  ctx.fillStyle = '#a8ff5d'; ctx.textAlign = 'left';
  ctx.fillText(`${game.score}점`, 14, 12);
  ctx.fillStyle = '#58f0ff'; ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(game.timeLeft)}s`, W - 14, 12);
}

function renderChoices() {
  const wrap = $('choicesWrap');
  wrap.innerHTML = '';
  game.choices.forEach((item, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = item.n;
    btn.addEventListener('click', () => onAnswer(i));
    wrap.appendChild(btn);
  });
}

function onAnswer(idx) {
  if (game.answered || !game.running) return;
  game.answered = true;
  game.selectedIdx = idx;
  if (idx === game.correctIdx) game.score++;

  const btns = $('choicesWrap').querySelectorAll('.choice-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === game.correctIdx) btn.classList.add('correct');
    else if (i === idx) btn.classList.add('wrong');
  });

  game.revealTimer = REVEAL_SEC;
}

function startGame() {
  game.running = false;
  cancelAnimationFrame(game.rafId);
  game.score = 0; game.timeLeft = GAME_SEC;
  game.silCache = null; game.silKey = '';
  hideResultBanner();
  $('startBtn').hidden = true;
  $('choicesWrap').style.display = 'grid';
  game.running = true;
  nextQuestion();
  lastTs = performance.now();
  game.rafId = requestAnimationFrame(ts => { lastTs = ts; loop(ts); });
}

function endGame() {
  game.running = false;
  cancelAnimationFrame(game.rafId);
  $('choicesWrap').style.display = 'none';
  $('startBtn').hidden = false;
  addRecord(game.score);
  showResultBanner(game.score, scoreLabel(game.score));
}

$('startBtn').addEventListener('click', startGame);
$('restartBtn').addEventListener('click', () => { hideResultBanner(); startGame(); });

syncCanvasSize();
new ResizeObserver(syncCanvasSize).observe(canvas);
updateRankUI();
drawIdle();
