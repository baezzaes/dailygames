const $ = (id) => document.getElementById(id);

const GAME_ID = "click10";
const GAME_TITLE = "10초 클릭 챌린지";

const rankTitle = $("rankTitle");
const rankList = $("rankList");

const clickTimeEl = $("clickTime");
const clickScoreEl = $("clickScore");
const clickStateEl = $("clickState");
const clickBigBtn = $("clickBigBtn");
const clickStartBtn = $("clickStartBtn");
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sanitizeName(name) {
  const value = String(name || "").trim().slice(0, 12);
  return value || "anonymous";
}

function getPlayerName() {
  const name = sanitizeName(localStorage.getItem("dailygames:lastname") || "");
  const tag = localStorage.getItem("dailygames:lasttag") || "0000";
  return `${name}#${tag}`;
}

function storageKey(mode) {
  const periodKey = todayKey();
  return `dailygames:${GAME_ID}:${mode}:${periodKey}`;
}

function getBoard(mode) {
  try {
    const raw = localStorage.getItem(storageKey(mode));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBoard(mode, board) {
  localStorage.setItem(storageKey(mode), JSON.stringify(board));
}

function compareScore(a, b) {
  return b.score - a.score || a.t - b.t;
}

function addRecord(score) {
  const mode = "daily";
  const board = getBoard(mode);
  board.push({ name: getPlayerName(), score, t: Date.now() });
  board.sort(compareScore);
  saveBoard(mode, board.slice(0, 50));
  updateRankUI();
}

function clearBoard() {
  localStorage.removeItem(storageKey("daily"));
  updateRankUI();
}

function updateRankUI() {
  rankTitle.textContent = `${GAME_TITLE} 오늘 TOP 10`;
  rankList.innerHTML = "";

  const board = getBoard("daily").sort(compareScore).slice(0, 10);
  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
    rankList.appendChild(li);
    return;
  }

  board.forEach((row, idx) => {
    const li = document.createElement("li");
    const dt = new Date(row.t);
    li.textContent = `${idx + 1}. ${row.name} - ${row.score}회 (${dt.toLocaleString()})`;
    rankList.appendChild(li);
  });
}

const clickGame = {
  running: false,
  score: 0,
  endAt: 0,
  rafId: 0,
};

function setClickState(text) {
  clickStateEl.textContent = text;
}

function resetClickUI() {
  clickGame.score = 0;
  clickScoreEl.textContent = "0";
  clickTimeEl.textContent = "10.0";
  clickBigBtn.disabled = true;
  setClickState("대기");
}

function stopClickGame(saveRecord) {
  if (!clickGame.running) {
    cancelAnimationFrame(clickGame.rafId);
    return;
  }

  clickGame.running = false;
  cancelAnimationFrame(clickGame.rafId);
  clickBigBtn.disabled = true;
  clickTimeEl.textContent = "0.0";
  setClickState("종료");

  if (saveRecord) {
    showResultBanner(clickGame.score, `${clickGame.score}회`);
    addRecord(clickGame.score);
  }
}

function tickClickGame() {
  if (!clickGame.running) {
    return;
  }

  const left = Math.max(0, (clickGame.endAt - performance.now()) / 1000);
  clickTimeEl.textContent = left.toFixed(1);

  if (left <= 0) {
    stopClickGame(true);
    return;
  }

  clickGame.rafId = requestAnimationFrame(tickClickGame);
}

function startClickGame() {
  hideResultBanner();
  if (clickGame.running) {
    return;
  }

  clickGame.running = true;
  clickGame.score = 0;
  clickScoreEl.textContent = "0";
  clickBigBtn.disabled = false;
  setClickState("진행 중");
  clickBigBtn.focus();

  clickGame.endAt = performance.now() + 10000;
  clickGame.rafId = requestAnimationFrame(tickClickGame);
}

clickBigBtn.addEventListener("click", () => {
  if (!clickGame.running) {
    return;
  }
  clickGame.score += 1;
  clickScoreEl.textContent = String(clickGame.score);
});

clickStartBtn.addEventListener("click", startClickGame);


resetClickUI();
updateRankUI();




/* SERVER_RANK_OVERRIDE */
const scoreLabel = (v)=>`${v}회`;
function getRankSort() { return "desc"; }

async function addRecord(score) {
  const payload = {
    gameId: GAME_ID,
    mode: "daily",
    periodKey: todayKey(),
    name: getPlayerName(),
    score,
  };

  try {
    await fetch("/api/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}

  await updateRankUI();
}

async function clearBoard() {
  try {
    await fetch("/api/rank", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: GAME_ID,
    mode: "daily",
        periodKey: todayKey(),
      }),
    });
  } catch {}

  await updateRankUI();
}

async function updateRankUI() {
  rankTitle.textContent = `${GAME_TITLE} 오늘 TOP 10`;
  rankList.innerHTML = "";

  try {
    const query = new URLSearchParams({
      gameId: GAME_ID,
    mode: "daily",
      periodKey: todayKey(),
      sort: getRankSort(),
      limit: "10",
    });

    const res = await fetch(`/api/rank?${query.toString()}`);
    const data = await res.json();
    const rows = Array.isArray(data.rows) ? data.rows : [];

    if (rows.length === 0) {
      const li = document.createElement("li");
      li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
      rankList.appendChild(li);
      return;
    }

    rows.forEach((row, idx) => {
      const li = document.createElement("li");
      const ts = row.created_at ? new Date(`${row.created_at}Z`) : new Date();
      li.textContent = `${idx + 1}. ${row.name} - ${scoreLabel(row.score)} (${ts.toLocaleString()})`;
      rankList.appendChild(li);
    });
  } catch (e) {
    console.error("rank fetch error", e);
    const li = document.createElement("li");
    li.textContent = `랭킹 서버 연결 실패: ${e && e.message ? e.message : e}`;
    rankList.appendChild(li);
  }
}






/* RESULT_BANNER */
function savePB(score) {
  const key = `dailygames:${GAME_ID}:pb`;
  const curr = parseFloat(localStorage.getItem(key));
  if (isNaN(curr) || score > curr) localStorage.setItem(key, String(score));
}
function showResultBanner(score, label) {
  savePB(score);
  const b = document.getElementById("resultBanner");
  if (b) { document.getElementById("resultScore").textContent = label; b.hidden = false; }
}
function hideResultBanner() {
  const b = document.getElementById("resultBanner"); if (b) b.hidden = true;
}
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startClickGame(); });
