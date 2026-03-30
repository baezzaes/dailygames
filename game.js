// game.js — shared utilities loaded before each game's app.js
// Requires these globals defined in app.js:
//   GAME_ID, GAME_TITLE, RANK_SORT ("asc"|"desc"), scoreLabel(v)

const BANNED_NICK_TOKENS = [
  "씨발","시발","ㅅㅂ","ㅂㅅ","병신","좆","존나","개새끼","지랄",
  "섹스","자지","보지","성교","강간","애널","porn","sex","fuck","shit","bitch"
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

function currentRankQuery() {
  if (rankModeState.current === "week") {
    return { mode: "weekly", periodKey: kstWeekKey(), modeLabel: "주간" };
  }
  return { mode: "daily", periodKey: todayKey(), modeLabel: "오늘" };
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
  renderRankModeToggle();
  const rankTitle = document.getElementById('rankTitle');
  const rankList  = document.getElementById('rankList');
  if (!rankTitle || !rankList) return;
  const rq = currentRankQuery();
  rankTitle.textContent = `${GAME_TITLE} ${rq.modeLabel} TOP 10`;
  rankList.innerHTML = '';
  try {
    const q = new URLSearchParams({ gameId: GAME_ID, mode: rq.mode, periodKey: rq.periodKey, sort: RANK_SORT, limit: '10' });
    const res = await fetch(`/api/rank?${q}`);
    const data = await res.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) {
      const li = document.createElement('li');
      li.textContent = '아직 기록이 없습니다. 첫 기록을 만들어보세요.';
      rankList.appendChild(li);
      return;
    }
    rows.forEach((row, idx) => {
      const li = document.createElement('li');
      const ts = row.created_at ? new Date(`${row.created_at}Z`) : new Date();
      li.textContent = `${idx+1}. ${safeDisplayName(row.name)} - ${scoreLabel(row.score)} (${ts.toLocaleString()})`;
      rankList.appendChild(li);
    });
  } catch {
    const li = document.createElement('li');
    li.textContent = '랭킹 서버 연결 실패. 잠시 후 다시 시도해주세요.';
    rankList.appendChild(li);
  }
}

function isNewPB(score) {
  const curr = parseFloat(localStorage.getItem(`dailygames:${GAME_ID}:pb`));
  return isNaN(curr) || (RANK_SORT === 'asc' ? score < curr : score > curr);
}

function savePB(score) {
  if (isNewPB(score)) localStorage.setItem(`dailygames:${GAME_ID}:pb`, String(score));
}

function shareResult(score) {
  const text = `${GAME_TITLE}에서 ${scoreLabel(score)} 달성했어요! 🎮`;
  const url  = location.href;
  if (navigator.share) {
    navigator.share({ title: GAME_TITLE, text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).then(() => {
      const btn = document.getElementById('shareBtn');
      if (btn) { btn.textContent = '복사됨!'; setTimeout(() => { btn.textContent = '공유하기'; }, 1500); }
    }).catch(() => {});
  }
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

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.onclick = () => shareResult(score);

  const cardBtn = document.getElementById('cardShareBtn');

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
