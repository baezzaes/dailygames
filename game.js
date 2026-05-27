// 공통 게임 유틸:
// 각 게임의 index.html에서 먼저 로드되고, 뒤이어 각 게임 app.js가 로드됩니다.
// 각 게임 app.js는 아래 전역을 제공해야 합니다.
// - GAME_ID, GAME_TITLE, RANK_SORT("asc" | "desc"), scoreLabel(v)

// 닉네임 필터링용 금칙어 목록(한/영 혼합)
const BANNED_NICK_TOKENS = [
  "씨발","시발","ㅅㅂ","ㅂㅅ","병신","좆","존나","개새끼","지랄",
  "섹스","자지","보지","성교","강간","애널","porn","sex","fuck","shit","bitch"
];

// ── 티어 ─────────────────────────────────────────────────────────────
const TIERS = [
  { min: 3000, label: '다이아', emoji: '💎', color: '#58f0ff' },
  { min: 1000, label: '골드',   emoji: '🥇', color: '#ffd84f' },
  { min: 300,  label: '실버',   emoji: '🥈', color: '#c8d4e8' },
  { min: 50,   label: '브론즈', emoji: '🥉', color: '#e09c6a' },
  { min: 1,    label: '아이언', emoji: '⚔️',  color: '#8891aa' },
];
function getTier(pts) { return TIERS.find(t => pts >= t.min) || null; }

// ── 오늘의 게임 ───────────────────────────────────────────────────────
function getFeaturedGameId() {
  const [y, m, d] = todayKey().split('-').map(Number);
  const seed = y * 366 + m * 31 + d;
  return GAME_CATALOG[seed % GAME_CATALOG.length].id;
}

// ── 업적 ─────────────────────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
  { id: 'first_score',  label: '첫 발걸음',    desc: '처음으로 점수를 제출했습니다',   emoji: '🎮', color: '#a8ff5d' },
  { id: 'pb_breaker',   label: '기록 경신',     desc: '개인 최고 기록을 갱신했습니다',  emoji: '📈', color: '#58f0ff' },
  { id: 'streak_3',     label: '3일 연속',      desc: '3일 연속 플레이 달성',           emoji: '🔥', color: '#ff9040' },
  { id: 'streak_7',     label: '주간 파이터',   desc: '7일 연속 플레이 달성',           emoji: '🔥', color: '#ff6020' },
  { id: 'streak_30',    label: '한 달 전사',    desc: '30일 연속 플레이 달성',          emoji: '💪', color: '#ff5fd2' },
  { id: 'top10',        label: 'TOP 10',        desc: '일간 랭킹 TOP 10 진입',          emoji: '⭐', color: '#ffd84f' },
  { id: 'top3',         label: 'TOP 3',         desc: '일간 랭킹 TOP 3 진입',           emoji: '🏆', color: '#ffd84f' },
  { id: 'rank1',        label: '정상 등극',     desc: '일간 랭킹 1위 달성',             emoji: '👑', color: '#ffd84f' },
  { id: 'all_games',    label: '만능 플레이어', desc: '모든 게임을 한 번씩 플레이',     emoji: '🎯', color: '#58f0ff' },
  { id: 'challenger',   label: '도전자',        desc: '도전장을 보냈습니다',            emoji: '⚔️', color: '#ff5fd2' },
];
const _ACH_KEY = 'dailygames:achievements';
const _PLAYED_KEY = 'dailygames:played_games';

function _getAchievements() {
  try { return JSON.parse(localStorage.getItem(_ACH_KEY) || '[]'); } catch { return []; }
}
function unlockAchievement(id) {
  const list = _getAchievements();
  if (list.some(a => a.id === id)) return false;
  list.push({ id, earnedAt: Date.now() });
  localStorage.setItem(_ACH_KEY, JSON.stringify(list));
  return true;
}
function showAchievementToast(def) {
  const t = document.createElement('div');
  t.className = 'achievement-toast';
  t.innerHTML = `<span class="achievement-toast-icon">${def.emoji}</span><div><div class="achievement-toast-label">업적 달성!</div><div class="achievement-toast-name">${def.label}</div></div>`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('is-visible'));
  setTimeout(() => { t.classList.remove('is-visible'); setTimeout(() => t.remove(), 350); }, 3200);
}
function tryUnlockAchievement(id) {
  if (unlockAchievement(id)) {
    const def = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (def) showAchievementToast(def);
  }
}
function trackPlayedGame() {
  try {
    const played = JSON.parse(localStorage.getItem(_PLAYED_KEY) || '[]');
    if (!played.includes(GAME_ID)) {
      played.push(GAME_ID);
      localStorage.setItem(_PLAYED_KEY, JSON.stringify(played));
      if (played.length >= GAME_CATALOG.length) tryUnlockAchievement('all_games');
    }
  } catch {}
}
function checkRankAchievements(rank) {
  if (rank <= 0) return;
  if (rank <= 10) tryUnlockAchievement('top10');
  if (rank <= 3)  tryUnlockAchievement('top3');
  if (rank === 1) tryUnlockAchievement('rank1');
}

const GAME_CATALOG = [
  { id: 'bacteria',  title: '🧫 세균전' },
  { id: 'starblitz', title: '⭐ 스타블리츠' },
  { id: 'breakout',  title: '🧱 벽돌깨기' },
  { id: 'reaction',  title: '⚡ 반응속도' },
  { id: 'memory',    title: '🎨 색상 기억' },
  { id: 'stopbar',   title: '🎯 정지 타이밍' },
  { id: 'snake',     title: '🐍 스네이크' },
  { id: 'fortress',  title: '🏰 포트리스 챌린지' },
  { id: 'flappybird', title: '🐤 플래피버드' },
];

function normalizeForNickFilter(v) {
  return String(v || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\-_.,~!@#$%^&*()+=[\]{}:;"'`|\\/<>?]+/g, "");
}

function isNicknameAllowed(name) {
  const n = normalizeForNickFilter(name);
  return !BANNED_NICK_TOKENS.some(token => n.includes(token));
}

function safeDisplayName(name) {
  const v = String(name || "").trim().slice(0, 20);
  if (!v) return "anonymous";
  return isNicknameAllowed(v) ? v : "[filtered]";
}

function hasValidNickname() {
  const raw = localStorage.getItem('dailygames:lastname');
  if (!raw) return false;
  const clean = sanitizeName(raw);
  if (!clean || !isNicknameAllowed(clean)) {
    localStorage.removeItem('dailygames:lastname');
    return false;
  }
  return true;
}

function pendingScoreKey() {
  return `dailygames:pending-score:${GAME_ID}`;
}

function stashPendingScore(score) {
  if (!Number.isFinite(score)) return;
  localStorage.setItem(pendingScoreKey(), JSON.stringify({ score, createdAt: Date.now() }));
}

function readPendingScore() {
  const raw = localStorage.getItem(pendingScoreKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const score = Number(parsed?.score);
    const createdAt = Number(parsed?.createdAt || 0);
    if (createdAt > 0 && Date.now() - createdAt > 30 * 60 * 1000) return null;
    return Number.isFinite(score) ? score : null;
  } catch {
    return null;
  }
}

async function submitPendingScoreIfAny() {
  if (!hasValidNickname()) return;
  const score = readPendingScore();
  if (score === null) {
    localStorage.removeItem(pendingScoreKey());
    return;
  }
  localStorage.removeItem(pendingScoreKey());
  await addRecord(score);
}

function redirectToNicknameForSubmit(score) {
  stashPendingScore(score);
  const ret = encodeURIComponent(`${location.pathname}${location.search}`);
  location.href = `/?return=${ret}`;
}

// ── 도전장 ────────────────────────────────────────────────────────
// URL 파라미터 ?ch_score=&ch_from= 파싱 (게임 로드 시점)
const _challengeInfo = (function () {
  const p = new URLSearchParams(location.search);
  const raw = p.get('ch_score');
  const from = p.get('ch_from');
  if (raw === null || !from) return null;
  const score = parseFloat(raw);
  if (isNaN(score)) return null;
  return { score, from: String(from).slice(0, 25) };
})();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function kstMonthKey() {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function kstWeekKey() {
  // 주간 랭킹 키는 KST 기준 ISO week(YYYY-Www)로 계산합니다.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + KST_OFFSET_MS);
  const d = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  ));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const weekYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(weekNo).padStart(2, "0")}`;
}

const rankModeState = {
  current: "today", // today | week | month | alltime
};
const RANK_CASCADE = ["today", "week", "month", "alltime"];
let _initialRankLoad = true;
// 랭킹 탭 연타 시 이전 요청 응답이 늦게 도착해 UI를 덮지 않도록 토큰을 사용합니다.
let rankRequestToken = 0;

function currentRankQuery() {
  if (rankModeState.current === "week") {
    return { mode: "weekly", periodKey: kstWeekKey(), modeLabel: "주간" };
  }
  if (rankModeState.current === "month") {
    return { mode: "monthly", periodKey: kstMonthKey(), modeLabel: "월간" };
  }
  if (rankModeState.current === "alltime") {
    return { mode: "alltime", periodKey: "all", modeLabel: "역대" };
  }
  return { mode: "daily", periodKey: todayKey(), modeLabel: "오늘" };
}

function _applyRankModeToDOM(key) {
  const map = {
    today:   "rankModeTodayBtn",
    week:    "rankModeWeekBtn",
    month:   "rankModeMonthBtn",
    alltime: "rankModeAlltimeBtn",
  };
  for (const [k, id] of Object.entries(map)) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const active = k === key;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function renderRankModeToggle() {
  if (document.getElementById("rankModeToggle")) return;
  const rankTitle = document.getElementById("rankTitle");
  const rankList = document.getElementById("rankList");
  if (!rankTitle || !rankList) return;

  const toggle = document.createElement("div");
  toggle.id = "rankModeToggle";
  toggle.className = "rank-mode-toggle";
  toggle.setAttribute("role", "tablist");
  toggle.setAttribute("aria-label", "랭킹 모드");
  toggle.innerHTML = `
    <button id="rankModeTodayBtn"   class="rank-mode-btn is-active" type="button" role="tab" aria-selected="true">오늘</button>
    <button id="rankModeWeekBtn"    class="rank-mode-btn" type="button" role="tab" aria-selected="false">주간</button>
    <button id="rankModeMonthBtn"   class="rank-mode-btn" type="button" role="tab" aria-selected="false">월간</button>
    <button id="rankModeAlltimeBtn" class="rank-mode-btn" type="button" role="tab" aria-selected="false">역대</button>
  `;

  const headerRow = rankTitle.closest(".row.between");
  if (headerRow) {
    headerRow.appendChild(toggle);
  } else {
    rankList.parentElement.insertBefore(toggle, rankList);
  }

  const modes = [
    { key: "today",   btnId: "rankModeTodayBtn" },
    { key: "week",    btnId: "rankModeWeekBtn" },
    { key: "month",   btnId: "rankModeMonthBtn" },
    { key: "alltime", btnId: "rankModeAlltimeBtn" },
  ].map(m => ({ ...m, btn: document.getElementById(m.btnId) }));

  const setMode = (key) => {
    rankModeState.current = key;
    _applyRankModeToDOM(key);
    updateRankUI();
  };

  for (const m of modes) {
    m.btn.addEventListener("click", () => {
      if (rankModeState.current === m.key) return;
      setMode(m.key);
    });
  }
}

function sanitizeName(name) {
  const v = String(name || '').trim().slice(0, 12);
  return v || 'anonymous';
}

function pickRecommendedGames(currentId, count = 2) {
  const ids = GAME_CATALOG.map(g => g.id);
  const currentIdx = ids.indexOf(currentId);
  if (currentIdx < 0) return GAME_CATALOG.slice(0, count);

  const first = GAME_CATALOG[(currentIdx + 1) % GAME_CATALOG.length];
  const out = [first];

  const daySeed = Number(String(todayKey()).replaceAll("-", ""));
  const secondIdxBase = (currentIdx + 2 + (daySeed % (GAME_CATALOG.length - 1))) % GAME_CATALOG.length;
  const second = GAME_CATALOG[secondIdxBase];
  if (second.id !== currentId && second.id !== first.id) out.push(second);

  for (const g of GAME_CATALOG) {
    if (out.length >= count) break;
    if (g.id === currentId || out.some(x => x.id === g.id)) continue;
    out.push(g);
  }
  return out.slice(0, count);
}

function renderResultRecommendations() {
  const banner = document.getElementById('resultBanner');
  if (!banner || typeof GAME_ID !== 'string') return;

  let wrap = document.getElementById('resultNextWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'resultNextWrap';
    wrap.className = 'result-next';
    const actions = banner.querySelector('.result-actions');
    if (actions && actions.parentElement === banner) {
      banner.insertBefore(wrap, actions);
    } else {
      banner.appendChild(wrap);
    }
  }

  const picks = pickRecommendedGames(GAME_ID, 2);
  const links = picks.map(g => (
    `<a class="btn secondary slim result-next-btn" href="/${g.id}/">${g.title}</a>`
  )).join('');

  wrap.innerHTML = `
    <div class="result-next-label">다음 게임 추천</div>
    <div class="result-next-links">${links}</div>
  `;
}

function getPlayerName() {
  const baseName = sanitizeName(localStorage.getItem('dailygames:lastname') || '');
  const name = isNicknameAllowed(baseName) ? baseName : 'anonymous';
  const tag = localStorage.getItem('dailygames:lasttag') || '0000';
  return `${name}#${tag}`;
}

function updateStreak() {
  const today = todayKey();
  const lastDate = localStorage.getItem('dailygames:streak:lastdate');
  const count = parseInt(localStorage.getItem('dailygames:streak:count') || '0', 10);

  if (lastDate === today) return; // 오늘 이미 카운트됨

  const newCount = lastDate === yesterdayKey() ? count + 1 : 1;
  localStorage.setItem('dailygames:streak:count', String(newCount));
  localStorage.setItem('dailygames:streak:lastdate', today);

  const max = parseInt(localStorage.getItem('dailygames:streak:max') || '0', 10);
  if (newCount > max) localStorage.setItem('dailygames:streak:max', String(newCount));
}

async function addRecord(score) {
  const normalizedScore = Number(score);
  if (!Number.isFinite(normalizedScore)) return;
  if (!hasValidNickname()) {
    const moveToNickname = window.confirm("랭킹 제출을 하려면 닉네임 설정이 필요합니다.\n지금 설정하러 이동할까요?");
    if (moveToNickname) redirectToNicknameForSubmit(normalizedScore);
    return;
  }
  const wasNewPB = isNewPB(normalizedScore);
  let overtook = [];
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey(), name: getPlayerName(), score: normalizedScore, sort: RANK_SORT, gameTitle: GAME_TITLE }),
    });
    const data = await res.json();
    overtook = Array.isArray(data.overtook) ? data.overtook : [];
  } catch {}
  updateStreak();
  tryUnlockAchievement('first_score');
  trackPlayedGame();
  if (wasNewPB) tryUnlockAchievement('pb_breaker');
  const streak = parseInt(localStorage.getItem('dailygames:streak:count') || '0', 10);
  if (streak >= 30) tryUnlockAchievement('streak_30');
  else if (streak >= 7) tryUnlockAchievement('streak_7');
  else if (streak >= 3) tryUnlockAchievement('streak_3');
  if (overtook.length) showTauntButton(overtook);
  await updateRankUI(true);
}

async function clearBoard() {
  try {
    await fetch('/api/rank', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey() }),
    });
  } catch {}
  await updateRankUI();
}

async function updateRankUI(bypassCache = false) {
  const cascade = _initialRankLoad;
  // 탭 전환 시 스크롤 점프를 줄이기 위해 기존 목록 높이를 잠시 고정한 뒤 교체합니다.
  renderRankModeToggle();
  const rankTitle = document.getElementById('rankTitle');
  const rankList = document.getElementById('rankList');
  if (!rankTitle || !rankList) return;

  const rq = currentRankQuery();
  const requestToken = ++rankRequestToken;
  const prevMinHeight = rankList.style.minHeight;
  const prevHeight = Math.ceil(rankList.getBoundingClientRect().height);
  if (prevHeight > 0) rankList.style.minHeight = `${prevHeight}px`;
  rankList.setAttribute('aria-busy', 'true');

  rankTitle.textContent = `${GAME_TITLE} ${rq.modeLabel} TOP 10`;

  try {
    const q = new URLSearchParams({ gameId: GAME_ID, mode: rq.mode, periodKey: rq.periodKey, sort: RANK_SORT, limit: '10' });
    if (bypassCache) q.set('_nc', Date.now());
    const res = await fetch(`/api/rank?${q}`);
    const data = await res.json();
    // 더 최신 요청이 이미 시작된 상태면 이전 응답은 무시합니다.
    if (requestToken !== rankRequestToken) return;

    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (cascade && rows.length === 0) {
      const idx = RANK_CASCADE.indexOf(rankModeState.current);
      const nextKey = RANK_CASCADE[idx + 1];
      if (nextKey !== undefined) {
        rankModeState.current = nextKey;
        _applyRankModeToDOM(nextKey);
        await updateRankUI(bypassCache);
        return;
      }
    }
    _initialRankLoad = false;

    const items = [];

    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = '아직 기록이 없습니다. 첫 기록을 만들어보세요.';
      items.push(li);
    } else {
      rows.forEach((row, idx) => {
        const li = document.createElement('li');
        const ts = row.created_at ? new Date(`${row.created_at}Z`) : new Date();
        li.textContent = `${idx + 1}. ${safeDisplayName(row.name)} - ${scoreLabel(row.score)} (${ts.toLocaleString()})`;
        items.push(li);
      });
    }

    rankList.replaceChildren(...items);
  } catch {
    if (requestToken !== rankRequestToken) return;
    _initialRankLoad = false;
    const li = document.createElement('li');
    li.textContent = '랭킹 서버 연결 실패. 잠시 후 다시 시도해주세요.';
    rankList.replaceChildren(li);
  } finally {
    if (requestToken === rankRequestToken) {
      rankList.removeAttribute('aria-busy');
      requestAnimationFrame(() => {
        rankList.style.minHeight = prevMinHeight || '';
      });
    }
  }
}

function isNewPB(score) {
  const curr = parseFloat(localStorage.getItem(`dailygames:${GAME_ID}:pb`));
  return isNaN(curr) || (RANK_SORT === 'asc' ? score < curr : score > curr);
}

function savePB(score) {
  if (isNewPB(score)) localStorage.setItem(`dailygames:${GAME_ID}:pb`, String(score));
}

function sendChallenge(score) {
  tryUnlockAchievement('challenger');
  const base = location.origin + location.pathname;
  const url = `${base}?ch_score=${score}&ch_from=${encodeURIComponent(getPlayerName())}`;
  const text = `${GAME_TITLE}에서 ${scoreLabel(score)} 기록했어요. 이길 수 있어? 🎮`;
  const btn = document.getElementById('challengeBtn');
  if (navigator.share) {
    navigator.share({ title: `${GAME_TITLE} 도전장`, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
      if (btn) { btn.textContent = '링크 복사됨!'; setTimeout(() => { btn.textContent = '도전장 보내기'; }, 1500); }
    }).catch(() => {});
  }
}

function _injectChallengeNotice() {
  if (!_challengeInfo) return;
  const notice = document.createElement('div');
  notice.className = 'challenge-notice';
  notice.innerHTML = `<span class="challenge-notice-icon">⚔️</span><span class="challenge-notice-text"><strong>${safeDisplayName(_challengeInfo.from)}</strong>의 도전장! 기록 <em>${scoreLabel(_challengeInfo.score)}</em>을 넘어보세요</span>`;
  const wrap = document.querySelector('.wrap');
  if (wrap) wrap.insertBefore(notice, wrap.firstChild);
}

function _scrollToGameViewport() {
  const target =
    document.getElementById('gameCanvas') ||
    document.querySelector('.canvas-shell') ||
    document.getElementById('startBtn') ||
    document.querySelector('.wrap .card');
  if (!target) return;
  const top = window.scrollY + target.getBoundingClientRect().top - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

function _bindRestartScrollBehavior() {
  const restartBtn = document.getElementById('restartBtn');
  if (!restartBtn) return;
  restartBtn.addEventListener('click', () => {
    // Wait for each game's restart handler to update UI before positioning viewport.
    requestAnimationFrame(() => requestAnimationFrame(_scrollToGameViewport));
  });
}

function _injectFeaturedGameNotice() {
  if (typeof GAME_ID === 'undefined') return;
  if (GAME_ID !== getFeaturedGameId()) return;
  const notice = document.createElement('div');
  notice.className = 'featured-game-notice';
  notice.innerHTML = '<span>⭐</span><span>오늘의 추천 게임! 지금 도전해보세요</span>';
  const wrap = document.querySelector('.wrap');
  if (!wrap) return;
  const firstCard = wrap.querySelector('.card');
  if (firstCard) firstCard.insertAdjacentElement('beforebegin', notice);
  else wrap.insertBefore(notice, wrap.firstChild);
}

document.addEventListener('DOMContentLoaded', () => {
  _injectChallengeNotice();
  _bindRestartScrollBehavior();
  _injectFeaturedGameNotice();
  void submitPendingScoreIfAny();
});


function launchConfetti(rank) {
  const colors = rank === 1
    ? ['#ffd84f','#ffe97a','#fff3b0','#ffb400']
    : rank === 2
    ? ['#c8d4e8','#e0e8f8','#a0b0cc','#ffffff']
    : ['#e0a060','#f0c080','#c07030','#ffcc88'];
  const count = rank === 1 ? 80 : 50;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random()*100}vw;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      width:${6+Math.random()*6}px;
      height:${6+Math.random()*6}px;
      animation-duration:${1.5+Math.random()*2}s;
      animation-delay:${Math.random()*0.6}s;
    `;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

async function fetchMyRank(score) {
  try {
    const q = new URLSearchParams({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey(), sort: RANK_SORT, limit: '100' });
    const res = await fetch(`/api/rank?${q}`);
    const data = await res.json();
    const rows = data.rows || [];
    const myName = getPlayerName();
    const idx = rows.findIndex(r => r.name === myName && r.score === score);
    return idx >= 0 ? idx + 1 : 0;
  } catch { return 0; }
}

function showResultBanner(score, label) {
  const newRecord = isNewPB(score);
  savePB(score);

  const b = document.getElementById('resultBanner');
  if (!b) return;

  const pbEl    = document.getElementById('resultPB');
  const scoreEl = document.getElementById('resultScore');
  const rankEl  = document.getElementById('resultRank');

  if (pbEl) {
    const streakCount = parseInt(localStorage.getItem('dailygames:streak:count') || '0', 10);
    const parts = [];
    if (newRecord) parts.push('🔥 신기록!');
    if (streakCount >= 2) parts.push(`${streakCount}일 연속`);
    pbEl.textContent = parts.join(' · ');
    pbEl.className = newRecord ? 'result-pb new-record' : (streakCount >= 2 ? 'result-pb streak' : 'result-pb');
  }
  if (scoreEl) scoreEl.textContent = label;
  if (rankEl)  rankEl.textContent  = '';
  b.className = 'result-banner';
  b.hidden = false;
  renderResultRecommendations();
  setTimeout(() => b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);

  const cardBtn = document.getElementById('cardShareBtn');

  // 도전장 버튼 동적 삽입 (중복 방지)
  let challengeBtn = document.getElementById('challengeBtn');
  if (!challengeBtn) {
    challengeBtn = document.createElement('button');
    challengeBtn.id = 'challengeBtn';
    challengeBtn.className = 'btn share';
    challengeBtn.type = 'button';
    challengeBtn.textContent = '도전장 보내기';
    const actions = b.querySelector('.result-actions');
    if (actions) actions.appendChild(challengeBtn);
  }
  challengeBtn.onclick = () => sendChallenge(score);

  // 도전 결과 비교 (도전장 링크로 진입한 경우)
  if (_challengeInfo) {
    let challengeResult = document.getElementById('challengeResult');
    if (!challengeResult) {
      challengeResult = document.createElement('div');
      challengeResult.id = 'challengeResult';
      challengeResult.className = 'challenge-result';
      const actions = b.querySelector('.result-actions');
      if (actions) b.insertBefore(challengeResult, actions);
    }
    const won = RANK_SORT === 'asc' ? score <= _challengeInfo.score : score >= _challengeInfo.score;
    const eq  = score === _challengeInfo.score;
    const from = safeDisplayName(_challengeInfo.from);
    if (eq) {
      challengeResult.innerHTML = `<span class="challenge-tie">🤝 ${from}와(과) 동점!</span>`;
    } else if (won) {
      challengeResult.innerHTML = `<span class="challenge-win">🏆 ${from}의 기록 돌파!</span>`;
    } else {
      challengeResult.innerHTML = `<span class="challenge-lose">😅 ${from}한테 아쉽게 졌어요… 재도전?</span>`;
    }
  }

  setTimeout(async () => {
    const rank = await fetchMyRank(score);
    if (!rank || !rankEl) return;
    const medals = ['🥇','🥈','🥉'];
    checkRankAchievements(rank);
    if (rank <= 3) {
      rankEl.textContent = `${medals[rank-1]} ${rank}위 달성!`;
      rankEl.className   = `result-rank top${rank}`;
      b.classList.add(`rank-${rank}`);
      launchConfetti(rank);
    } else {
      rankEl.textContent = `오늘 ${rank}위`;
      rankEl.className   = 'result-rank';
    }
    if (cardBtn) cardBtn.onclick = () => shareCard(score, label, rank);
  }, 800);

  if (cardBtn) cardBtn.onclick = () => shareCard(score, label, 0);
}

function generateCardCanvas(label, rank) {
  const SIZE = 800;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const cx = c.getContext('2d');

  const bg = cx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, '#0f1e3a');
  bg.addColorStop(0.5, '#1a1040');
  bg.addColorStop(1, '#0a1220');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, SIZE, SIZE);

  cx.fillStyle = 'rgba(88,240,255,0.06)';
  for (let x = 20; x < SIZE; x += 28)
    for (let y = 20; y < SIZE; y += 28) {
      cx.beginPath(); cx.arc(x, y, 1, 0, Math.PI * 2); cx.fill();
    }

  const line = cx.createLinearGradient(0, 0, SIZE, 0);
  line.addColorStop(0, 'transparent');
  line.addColorStop(0.3, '#58f0ff');
  line.addColorStop(0.7, '#a8ff5d');
  line.addColorStop(1, 'transparent');
  cx.strokeStyle = line;
  cx.lineWidth = 3;
  cx.beginPath(); cx.moveTo(0, 6); cx.lineTo(SIZE, 6); cx.stroke();

  cx.font = 'bold 32px "Courier New", monospace';
  cx.fillStyle = 'rgba(255,255,255,0.5)';
  cx.textAlign = 'center';
  cx.textBaseline = 'top';
  cx.fillText('🎮 DailyGames', SIZE / 2, 48);

  cx.font = 'bold 44px system-ui, sans-serif';
  cx.fillStyle = '#e8eaf0';
  cx.fillText(GAME_TITLE, SIZE / 2, 128);

  cx.strokeStyle = 'rgba(255,255,255,0.12)';
  cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(100, 200); cx.lineTo(SIZE - 100, 200); cx.stroke();

  cx.font = `bold 110px "Courier New", monospace`;
  cx.fillStyle = '#a8ff5d';
  cx.textBaseline = 'middle';
  cx.fillText(label, SIZE / 2, 330);

  if (rank > 0) {
    const medals = ['🥇','🥈','🥉'];
    const rankText = rank <= 3
      ? `${medals[rank-1]} 오늘 ${rank}위`
      : `오늘 ${rank}위`;
    const rankColor = rank === 1 ? '#ffd84f' : rank === 2 ? '#c8d4e8' : rank === 3 ? '#e0a060' : '#58f0ff';
    cx.font = 'bold 52px system-ui, sans-serif';
    cx.fillStyle = rankColor;
    cx.textBaseline = 'middle';
    cx.fillText(rankText, SIZE / 2, 460);
  }

  const playerName = getPlayerName();
  cx.font = '32px system-ui, sans-serif';
  cx.fillStyle = 'rgba(255,255,255,0.55)';
  cx.textBaseline = 'middle';
  cx.fillText(playerName, SIZE / 2, rank > 0 ? 548 : 490);

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  cx.font = '28px system-ui, sans-serif';
  cx.fillStyle = 'rgba(255,255,255,0.3)';
  cx.fillText(today, SIZE / 2, rank > 0 ? 600 : 542);

  cx.strokeStyle = 'rgba(255,255,255,0.12)';
  cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(100, SIZE - 110); cx.lineTo(SIZE - 100, SIZE - 110); cx.stroke();

  cx.font = 'bold 26px "Courier New", monospace';
  cx.fillStyle = '#58f0ff';
  cx.fillText(location.hostname, SIZE / 2, SIZE - 70);

  const line2 = cx.createLinearGradient(0, 0, SIZE, 0);
  line2.addColorStop(0, 'transparent');
  line2.addColorStop(0.3, '#a8ff5d');
  line2.addColorStop(0.7, '#58f0ff');
  line2.addColorStop(1, 'transparent');
  cx.strokeStyle = line2;
  cx.lineWidth = 3;
  cx.beginPath(); cx.moveTo(0, SIZE - 6); cx.lineTo(SIZE, SIZE - 6); cx.stroke();

  return c;
}

async function shareCard(score, label, rank) {
  const btn = document.getElementById('cardShareBtn');
  if (btn) { btn.textContent = '생성 중…'; btn.disabled = true; }

  try {
    const card = generateCardCanvas(label, rank);
    const blob = await new Promise(r => card.toBlob(r, 'image/png'));
    const file = new File([blob], 'dailygames-result.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${GAME_TITLE} - ${label}`,
        text: `${GAME_TITLE}에서 ${label} 달성! 🎮`,
        files: [file],
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dailygames-result.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    if (e?.name !== 'AbortError') console.warn('shareCard error', e);
  } finally {
    if (btn) { btn.textContent = '카드 공유'; btn.disabled = false; }
  }
}

function hideResultBanner() {
  const b = document.getElementById('resultBanner');
  if (b) b.hidden = true;
}

// ── 도발 기능 ─────────────────────────────────────────────────────────
function showTauntButton(overtook) {
  const banner = document.getElementById('resultBanner');
  if (!banner) return;
  const actions = banner.querySelector('.result-actions');
  if (!actions) return;
  const existing = document.getElementById('tauntBtn');
  if (existing) existing.remove();

  const target = overtook[0];
  const btn = document.createElement('button');
  btn.id = 'tauntBtn';
  btn.className = 'btn share';
  btn.type = 'button';
  btn.textContent = `${target.split('#')[0]} 도발하기 👊`;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = '전송 중…';
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toName: target, fromName: getPlayerName(), gameId: GAME_ID, gameTitle: GAME_TITLE }),
      });
      btn.textContent = '도발 완료! 💥';
    } catch {
      btn.textContent = '전송 실패';
      btn.disabled = false;
    }
  };
  actions.appendChild(btn);
}

// ── 알림 토스트 ───────────────────────────────────────────────────────
async function checkNotifications() {
  const name = getPlayerName();
  if (!name) return;
  try {
    const data = await fetch(`/api/notifications?name=${encodeURIComponent(name)}`).then(r => r.json());
    const notifs = Array.isArray(data.notifications) ? data.notifications : [];
    if (!notifs.length) return;
    showNotifToast(notifs);
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  } catch {}
}

function showNotifToast(notifs) {
  const existing = document.getElementById('notifToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'notifToast';
  toast.className = 'notif-toast';
  toast.innerHTML = notifs.slice(0, 3).map(n =>
    `<div class="notif-item">💥 <strong>${n.from_name.split('#')[0]}</strong>님이 <em>${n.game_title}</em>에서 당신을 추월했습니다!</div>`
  ).join('') + `<button class="notif-close" onclick="this.parentElement.remove()">닫기</button>`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 6000);
}

document.addEventListener('DOMContentLoaded', () => { checkNotifications(); });

