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

function savePB(score) {
  const key = `dailygames:${GAME_ID}:pb`;
  const curr = parseFloat(localStorage.getItem(key));
  if (isNaN(curr) || (RANK_SORT === 'asc' ? score < curr : score > curr)) {
    localStorage.setItem(key, String(score));
  }
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

function showResultBanner(score, label) {
  savePB(score);
  const b = document.getElementById('resultBanner');
  if (!b) return;
  document.getElementById('resultScore').textContent = label;
  b.hidden = false;
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.onclick = () => shareResult(score);
}

function hideResultBanner() {
  const b = document.getElementById('resultBanner');
  if (b) b.hidden = true;
}
