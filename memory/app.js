const $ = (id) => document.getElementById(id);

const GAME_ID = "memory";
const GAME_TITLE = "색상 기억 게임";

const modeEl = $("mode");
const rankTitle = $("rankTitle");
const rankList = $("rankList");

const roundValEl = $("roundVal");
const stateValEl = $("stateVal");
const statusTextEl = $("statusText");
const startBtn = $("startBtn");
const resetRankBtn = $("resetRankBtn");
const tiles = Array.from(document.querySelectorAll(".tile"));

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekKey() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function sanitizeName(name) {
  const value = String(name || "").trim().slice(0, 12);
  return value || "anonymous";
}
function getPlayerName() {
  return sanitizeName(localStorage.getItem("dailygames:lastname") || "");
}
function storageKey(mode) {
  const periodKey = mode === "weekly" ? weekKey() : todayKey();
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
  const mode = modeEl.value;
  const board = getBoard(mode);
  board.push({ name: getPlayerName(), score, t: Date.now() });
  board.sort(compareScore);
  saveBoard(mode, board.slice(0, 50));
  updateRankUI();
}
function clearBoard() {
  localStorage.removeItem(storageKey(modeEl.value));
  updateRankUI();
}
function updateRankUI() {
  const modeText = modeEl.value === "weekly" ? "주간" : "오늘";
  rankTitle.textContent = `${GAME_TITLE} ${modeText} TOP 10`;
  rankList.innerHTML = "";
  const board = getBoard(modeEl.value).sort(compareScore).slice(0, 10);
  if (!board.length) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
    rankList.appendChild(li);
    return;
  }
  board.forEach((r, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${r.name} - ${r.score}라운드`;
    rankList.appendChild(li);
  });
}

const game = {
  running: false,
  locked: true,
  seq: [],
  inputIdx: 0,
  round: 0,
};

function setState(text) { stateValEl.textContent = text; }
function setStatus(text) { statusTextEl.textContent = text; }
function updateRound() { roundValEl.textContent = String(game.round); }

function flashTile(idx, dur = 340) {
  return new Promise((resolve) => {
    const tile = tiles[idx];
    tile.classList.add("active");
    setTimeout(() => {
      tile.classList.remove("active");
      resolve();
    }, dur);
  });
}

async function showSequence() {
  game.locked = true;
  setState("패턴 표시");
  setStatus(`라운드 ${game.round}: 패턴을 기억하세요.`);
  await new Promise((r) => setTimeout(r, 400));
  for (const idx of game.seq) {
    await flashTile(idx, 300);
    await new Promise((r) => setTimeout(r, 130));
  }
  game.locked = false;
  game.inputIdx = 0;
  setState("입력 대기");
  setStatus("같은 순서로 탭하세요.");
}

function stopGame(clearOnly = false) {
  game.running = false;
  game.locked = true;
  setState("종료");
  if (!clearOnly) {
    const score = Math.max(0, game.round - 1);
    setStatus(`게임 종료. 기록: ${score}라운드`);
    showResultBanner(score, `${score}라운드`);
    addRecord(score);
  } else {
    setStatus("시작 버튼을 눌러 플레이하세요.");
  }
}

async function nextRound() {
  game.round += 1;
  updateRound();
  game.seq.push(Math.floor(Math.random() * 4));
  await showSequence();
}

async function startGame() {
  hideResultBanner();
  game.running = true;
  game.locked = true;
  game.seq = [];
  game.round = 0;
  updateRound();
  setState("준비");
  setStatus("게임 시작!");
  await nextRound();
}

tiles.forEach((tile) => {
  tile.addEventListener("click", async () => {
    if (!game.running || game.locked) return;
    const idx = Number(tile.dataset.idx);
    await flashTile(idx, 120);

    if (idx !== game.seq[game.inputIdx]) {
      stopGame(false);
      return;
    }

    game.inputIdx += 1;
    if (game.inputIdx >= game.seq.length) {
      setState("성공");
      setStatus("정답! 다음 라운드 준비...");
      game.locked = true;
      setTimeout(() => {
        if (game.running) nextRound();
      }, 500);
    }
  });
});

startBtn.addEventListener("click", () => {
  if (game.running) {
    stopGame(false);
    return;
  }
  startGame();
});
resetRankBtn.addEventListener("click", clearBoard);
modeEl.addEventListener("change", () => { void updateRankUI(); });

stopGame(true);
updateRound();
updateRankUI();




/* SERVER_RANK_OVERRIDE */
const scoreLabel = (v)=>`${v}라운드`;
function getRankSort() { return "desc"; }

function periodKey(mode) {
  return mode === "weekly" ? weekKey() : todayKey();
}

async function addRecord(score) {
  const mode = modeEl.value;
  const payload = {
    gameId: GAME_ID,
    mode,
    periodKey: periodKey(mode),
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
  const mode = modeEl.value;
  try {
    await fetch("/api/rank", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: GAME_ID,
        mode,
        periodKey: periodKey(mode),
      }),
    });
  } catch {}

  await updateRankUI();
}

async function updateRankUI() {
  const modeText = modeEl.value === "weekly" ? "주간" : "오늘";
  rankTitle.textContent = `${GAME_TITLE} ${modeText} TOP 10`;
  rankList.innerHTML = "";

  try {
    const query = new URLSearchParams({
      gameId: GAME_ID,
      mode: modeEl.value,
      periodKey: periodKey(modeEl.value),
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
  } catch {
    const li = document.createElement("li");
    li.textContent = "랭킹 서버 연결 실패. 잠시 후 다시 시도해주세요.";
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
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
