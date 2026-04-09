// 공통 게임 유틸:
// 각 게임의 index.html에서 먼저 로드되고, 뒤이어 각 게임 app.js가 로드됩니다.
// 각 게임 app.js는 아래 전역을 제공해야 합니다.
// - GAME_ID, GAME_TITLE, RANK_SORT("asc" | "desc"), scoreLabel(v)

// 닉네임 필터링용 금칙어 목록(한/영 혼합)
const BANNED_NICK_TOKENS = [
  "씨발","시발","ㅅㅂ","ㅂㅅ","병신","좆","존나","개새끼","지랄",
  "섹스","자지","보지","성교","강간","애널","porn","sex","fuck","shit","bitch"
];

const GAME_CATALOG = [
  { id: "click10", title: "10초 클릭" },
  { id: "reaction", title: "반응속도" },
  { id: "dodger", title: "운석 피하기" },
  { id: "memory", title: "색상 기억" },
  { id: "stopbar", title: "정지 타이밍" },
  { id: "onecount", title: "1초 카운트 정지" },
  { id: "numbertap", title: "숫자 탭" },
  { id: "lanetap", title: "라인 탭" },
  { id: "shadow", title: "그림자 퀴즈" },
  { id: "balance", title: "균형 잡기" },
  { id: "starblitz", title: "스타블리츠" },
  { id: "colorrush", title: "색상 러시" },
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

(function checkNickname() {
  const raw = localStorage.getItem('dailygames:lastname');
  if (!raw || !isNicknameAllowed(raw)) {
    localStorage.removeItem('dailygames:lastname');
    const ret = encodeURIComponent(location.pathname);
    location.replace(`/?return=${ret}`);
  }
})();

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
  current: "today", // today | week
};
// 랭킹 탭 연타 시 이전 요청 응답이 늦게 도착해 UI를 덮지 않도록 토큰을 사용합니다.
let rankRequestToken = 0;

function currentRankQuery() {
  if (rankModeState.current === "week") {
    return { mode: "weekly", periodKey: kstWeekKey(), modeLabel: "주간" };
  }
  return { mode: "daily", periodKey: todayKey(), modeLabel: "오늘" };
}

function renderRankModeToggle() {
  // 랭킹 제목 영역에 '오늘/주간' 토글을 동적으로 1회만 삽입합니다.
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
    <button id="rankModeTodayBtn" class="rank-mode-btn is-active" type="button" role="tab" aria-selected="true">오늘</button>
    <button id="rankModeWeekBtn" class="rank-mode-btn" type="button" role="tab" aria-selected="false">주간</button>
  `;

  const headerRow = rankTitle.closest(".row.between");
  if (headerRow) {
    headerRow.appendChild(toggle);
  } else {
    rankList.parentElement.insertBefore(toggle, rankList);
  }

  const todayBtn = document.getElementById("rankModeTodayBtn");
  const weekBtn = document.getElementById("rankModeWeekBtn");
  const setMode = (mode) => {
    rankModeState.current = mode;
    const isToday = mode === "today";
    todayBtn.classList.toggle("is-active", isToday);
    weekBtn.classList.toggle("is-active", !isToday);
    todayBtn.setAttribute("aria-selected", isToday ? "true" : "false");
    weekBtn.setAttribute("aria-selected", isToday ? "false" : "true");
    updateRankUI();
  };

  todayBtn.addEventListener("click", () => {
    if (rankModeState.current === "today") return;
    setMode("today");
  });
  weekBtn.addEventListener("click", () => {
    if (rankModeState.current === "week") return;
    setMode("week");
  });
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
  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey(), name: getPlayerName(), score }),
    });
  } catch {}
  updateStreak();
  await updateRankUI();
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

async function updateRankUI() {
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
    const res = await fetch(`/api/rank?${q}`);
    const data = await res.json();
    // 더 최신 요청이 이미 시작된 상태면 이전 응답은 무시합니다.
    if (requestToken !== rankRequestToken) return;

    const rows = Array.isArray(data.rows) ? data.rows : [];
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

document.addEventListener('DOMContentLoaded', _injectChallengeNotice);

// ── 카카오 공유 ──────────────────────────────────────────────────────
(function loadKakaoSDK() {
  const s = document.createElement('script');
  s.src = 'https://developers.kakao.com/sdk/js/kakao.js';
  s.onload = () => {
    if (window.Kakao && !Kakao.isInitialized()) Kakao.init('00fb3bd8b85c41ae34d3d3536f0bb2f8');
  };
  document.head.appendChild(s);
})();

function shareKakao(score, label, rank) {
  if (!window.Kakao || !Kakao.isInitialized()) return;
  const gameUrl = `${location.origin}/${GAME_ID}/`;
  const rankText = rank >= 1 ? ` · 오늘 ${rank}위` : '';
  const shareObj = {
    objectType: 'feed',
    content: {
      title: `${GAME_TITLE}${rankText}`,
      description: `기록: ${label} — 나도 도전해봐! 🎮`,
      imageUrl: 'https://dailygames.site/icons/icon-512.png',
      link: { mobileWebUrl: gameUrl, webUrl: gameUrl },
    },
    buttons: [{ title: '나도 해보기', link: { mobileWebUrl: gameUrl, webUrl: gameUrl } }],
  };
  // Share API(v2)는 카카오 로그인 활성화가 필요 → Link API(v1) 우선 시도
  const api = (Kakao.Share && Kakao.Share.sendDefault)
    ? Kakao.Share
    : (Kakao.Link && Kakao.Link.sendDefault)
    ? Kakao.Link
    : null;
  if (api) api.sendDefault(shareObj);
}

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

  // 카카오 공유 버튼 동적 삽입 (중복 방지)
  let kakaoBtn = document.getElementById('kakaoShareBtn');
  if (!kakaoBtn) {
    kakaoBtn = document.createElement('button');
    kakaoBtn.id = 'kakaoShareBtn';
    kakaoBtn.className = 'btn share kakao';
    kakaoBtn.type = 'button';
    kakaoBtn.textContent = '카카오 공유';
    const actions = b.querySelector('.result-actions');
    if (actions) actions.appendChild(kakaoBtn);
  }
  kakaoBtn.onclick = () => shareKakao(score, label, 0);

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
    if (kakaoBtn) kakaoBtn.onclick = () => shareKakao(score, label, rank);
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

