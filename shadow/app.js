const GAME_ID    = "shadow";
const GAME_TITLE = "그림자 퀴즈";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}점`;

// 카테고리로 묶어서 헷갈리는 보기 우선 선택
const ITEMS = [
  // 동물 - 바다
  { e: '🐬', n: '돌고래',   c: 'sea' },
  { e: '🦈', n: '상어',     c: 'sea' },
  { e: '🐙', n: '문어',     c: 'sea' },
  { e: '🦑', n: '오징어',   c: 'sea' },
  { e: '🦀', n: '게',       c: 'sea' },
  { e: '🦞', n: '바닷가재', c: 'sea' },
  { e: '🐡', n: '복어',     c: 'sea' },
  { e: '🦭', n: '물개',     c: 'sea' },
  // 동물 - 육지
  { e: '🐘', n: '코끼리',   c: 'land' },
  { e: '🦒', n: '기린',     c: 'land' },
  { e: '🐊', n: '악어',     c: 'land' },
  { e: '🦏', n: '코뿔소',   c: 'land' },
  { e: '🦛', n: '하마',     c: 'land' },
  { e: '🐢', n: '거북이',   c: 'land' },
  { e: '🦘', n: '캥거루',   c: 'land' },
  { e: '🦔', n: '고슴도치', c: 'land' },
  // 동물 - 조류
  { e: '🦩', n: '플라밍고', c: 'bird' },
  { e: '🦚', n: '공작',     c: 'bird' },
  { e: '🦜', n: '앵무새',   c: 'bird' },
  { e: '🦅', n: '독수리',   c: 'bird' },
  { e: '🦆', n: '오리',     c: 'bird' },
  { e: '🐧', n: '펭귄',     c: 'bird' },
  { e: '🦉', n: '부엉이',   c: 'bird' },
  // 동물 - 곤충/기타
  { e: '🦋', n: '나비',     c: 'bug' },
  { e: '🐝', n: '꿀벌',     c: 'bug' },
  { e: '🦗', n: '귀뚜라미', c: 'bug' },
  { e: '🦂', n: '전갈',     c: 'bug' },
  { e: '🕷️', n: '거미',    c: 'bug' },
  // 탈것
  { e: '🚀', n: '로켓',     c: 'vehicle' },
  { e: '✈️', n: '비행기',  c: 'vehicle' },
  { e: '🚁', n: '헬리콥터', c: 'vehicle' },
  { e: '🛸', n: 'UFO',      c: 'vehicle' },
  { e: '⛵', n: '범선',     c: 'vehicle' },
  { e: '🚂', n: '기차',     c: 'vehicle' },
  { e: '🏍️', n: '오토바이',c: 'vehicle' },
  // 악기
  { e: '🎸', n: '기타',     c: 'music' },
  { e: '🎷', n: '색소폰',   c: 'music' },
  { e: '🎺', n: '트럼펫',   c: 'music' },
  { e: '🎻', n: '바이올린', c: 'music' },
  { e: '🥁', n: '드럼',     c: 'music' },
  { e: '🪗', n: '아코디언', c: 'music' },
  // 사물
  { e: '⚓', n: '닻',       c: 'object' },
  { e: '🏆', n: '트로피',   c: 'object' },
  { e: '🔑', n: '열쇠',     c: 'object' },
  { e: '⚔️', n: '검',      c: 'object' },
  { e: '🛡️', n: '방패',    c: 'object' },
  { e: '🔭', n: '망원경',   c: 'object' },
  { e: '⏳', n: '모래시계', c: 'object' },
  // 자연/식물
  { e: '🌵', n: '선인장',   c: 'plant' },
  { e: '🍄', n: '버섯',     c: 'plant' },
  { e: '🌴', n: '야자수',   c: 'plant' },
  { e: '🎋', n: '대나무',   c: 'plant' },
  // 판타지/기타
  { e: '🦕', n: '브론토',   c: 'fantasy' },
  { e: '🦖', n: '티라노',   c: 'fantasy' },
  { e: '🐉', n: '용',       c: 'fantasy' },
  { e: '🗿', n: '모아이',   c: 'fantasy' },
  { e: '🏰', n: '성',       c: 'fantasy' },
  { e: '🗼', n: '에펠탑',   c: 'fantasy' },
];

const GAME_SEC    = 30;
const QUESTION_SEC = 3;
const REVEAL_SEC  = 0.7;

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
  score: 0, timeLeft: GAME_SEC, qTimeLeft: QUESTION_SEC,
  current: null, choices: [], correctIdx: -1,
  answered: false, selectedIdx: -1, revealTimer: 0,
  silCache: null, silKey: '',
  usedItems: [],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickChoices(current) {
  // 같은 카테고리 우선, 부족하면 다른 카테고리로 채움
  const same = shuffle(ITEMS.filter(i => i !== current && i.c === current.c));
  const diff = shuffle(ITEMS.filter(i => i !== current && i.c !== current.c));
  const pool = [...same, ...diff];
  return shuffle([current, ...pool.slice(0, 3)]);
}

function nextQuestion() {
  // 모든 문제 다 쓰면 초기화
  if (game.usedItems.length >= ITEMS.length) game.usedItems = [];
  const remaining = ITEMS.filter(i => !game.usedItems.includes(i));
  game.current = shuffle(remaining)[0];
  game.usedItems.push(game.current);

  game.choices   = pickChoices(game.current);
  game.correctIdx = game.choices.indexOf(game.current);
  game.answered  = false;
  game.selectedIdx = -1;
  game.revealTimer = 0;
  game.qTimeLeft  = QUESTION_SEC;
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
    game.timeLeft  -= dt;
    game.qTimeLeft -= dt;
    if (game.timeLeft <= 0) { game.timeLeft = 0; endGame(); return; }
    if (game.qTimeLeft <= 0) {
      // 시간 초과 → 오답 처리
      onAnswer(-1);
    }
  }

  draw();
  game.rafId = requestAnimationFrame(loop);
}

function draw() {
  syncCanvasSize();
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1a2e'); bg.addColorStop(1, '#091220');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  if (!game.current) return;

  const size = Math.min(W, H) * 0.48;
  const cx = W / 2, cy = H / 2 + 4;

  // Glow
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.75);
  glow.addColorStop(0, 'rgba(88,240,255,.1)'); glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy, size * 0.75, 0, Math.PI * 2); ctx.fill();

  if (game.answered) {
    ctx.font = `${Math.floor(size * 0.72)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(game.current.e, cx, cy);
  } else {
    ctx.drawImage(getSil(size), cx - size / 2, cy - size / 2, size, size);
  }

  // 전체 타이머 바 (하단)
  const pct = game.timeLeft / GAME_SEC;
  const bw = W * 0.86, bh = 6, bx = (W - bw) / 2, by = H - 16;
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
  ctx.fillStyle = pct > 0.4 ? '#58f0ff' : pct > 0.2 ? '#ffd84f' : '#ff5050';
  ctx.beginPath(); ctx.roundRect(bx, by, bw * pct, bh, 3); ctx.fill();

  // 문제별 타이머 바 (상단 HUD 아래)
  const qpct = Math.max(0, game.answered ? 0 : game.qTimeLeft / QUESTION_SEC);
  const qbw = W * 0.86, qbh = 5, qbx = (W - qbw) / 2, qby = 42;
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath(); ctx.roundRect(qbx, qby, qbw, qbh, 2); ctx.fill();
  const qcolor = qpct > 0.5 ? '#a8ff5d' : qpct > 0.25 ? '#ffd84f' : '#ff5050';
  ctx.fillStyle = qcolor;
  ctx.beginPath(); ctx.roundRect(qbx, qby, qbw * qpct, qbh, 2); ctx.fill();

  // HUD
  ctx.textBaseline = 'top';
  ctx.font = `bold ${Math.floor(H * 0.075)}px "Courier New"`;
  ctx.fillStyle = '#a8ff5d'; ctx.textAlign = 'left';
  ctx.fillText(`${game.score}점`, 14, 10);
  ctx.fillStyle = '#58f0ff'; ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(game.timeLeft)}s`, W - 14, 10);
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
  game.answered    = true;
  game.selectedIdx = idx;
  if (idx === game.correctIdx) game.score++;

  const btns = $('choicesWrap').querySelectorAll('.choice-btn');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === game.correctIdx) btn.classList.add('correct');
    else if (i === idx)        btn.classList.add('wrong');
  });

  game.revealTimer = REVEAL_SEC;
}

function startGame() {
  game.running = false;
  cancelAnimationFrame(game.rafId);
  game.score = 0; game.timeLeft = GAME_SEC; game.qTimeLeft = QUESTION_SEC;
  game.silCache = null; game.silKey = '';
  game.usedItems = [];
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
