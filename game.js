// game.js — shared utilities loaded before each game's app.js
// Requires these globals defined in app.js:
//   GAME_ID, GAME_TITLE, RANK_SORT ("asc"|"desc"), scoreLabel(v)

(function checkNickname() {
  if (!localStorage.getItem('dailygames:lastname')) {
    const ret = encodeURIComponent(location.pathname);
    location.replace(`/?return=${ret}`);
  }
})();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function sanitizeName(name) {
  const v = String(name || '').trim().slice(0, 12);
  return v || 'anonymous';
}

function getPlayerName() {
  const name = sanitizeName(localStorage.getItem('dailygames:lastname') || '');
  const tag = localStorage.getItem('dailygames:lasttag') || '0000';
  return `${name}#${tag}`;
}

async function addRecord(score) {
  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey(), name: getPlayerName(), score }),
    });
  } catch {}
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
  const rankTitle = document.getElementById('rankTitle');
  const rankList  = document.getElementById('rankList');
  rankTitle.textContent = `${GAME_TITLE} 오늘 TOP 10`;
  rankList.innerHTML = '';
  try {
    const q = new URLSearchParams({ gameId: GAME_ID, mode: 'daily', periodKey: todayKey(), sort: RANK_SORT, limit: '10' });
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
      li.textContent = `${idx+1}. ${row.name} - ${scoreLabel(row.score)} (${ts.toLocaleString()})`;
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
    pbEl.textContent = newRecord ? '🔥 신기록!' : '';
    pbEl.className   = newRecord ? 'result-pb new-record' : 'result-pb';
  }
  if (scoreEl) scoreEl.textContent = label;
  if (rankEl)  rankEl.textContent  = '';
  b.className = 'result-banner';
  b.hidden = false;

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.onclick = () => shareResult(score);

  // 순위 조회 (제출 후 약간 대기)
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
  }, 800);
}

function hideResultBanner() {
  const b = document.getElementById('resultBanner');
  if (b) b.hidden = true;
}
