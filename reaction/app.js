const $ = (id) => document.getElementById(id);

const GAME_ID = "reaction";
const GAME_TITLE = "반응속도 테스트";
const REACTION_ROUNDS = 5;

const modeEl = $("mode");
const rankTitle = $("rankTitle");
const rankList = $("rankList");

const reactionRoundEl = $("reactionRound");
const reactionLastEl = $("reactionLast");
const reactionAvgEl = $("reactionAvg");
const reactionStateEl = $("reactionState");
const reactionPad = $("reactionPad");
const reactionStartBtn = $("reactionStartBtn");
const reactionResetBtn = $("reactionResetBtn");

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
  return a.score - b.score || a.t - b.t;
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
  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
    rankList.appendChild(li);
    return;
  }

  board.forEach((row, idx) => {
    const li = document.createElement("li");
    const dt = new Date(row.t);
    li.textContent = `${idx + 1}. ${row.name} - ${Number(row.score).toFixed(1)}ms (${dt.toLocaleString()})`;
    rankList.appendChild(li);
  });
}

const reactionGame = {
  running: false,
  round: 0,
  totalMs: 0,
  readyAt: 0,
  timeoutId: 0,
  phase: "idle",
};

function clearReactionTimer() {
  if (reactionGame.timeoutId) {
    clearTimeout(reactionGame.timeoutId);
    reactionGame.timeoutId = 0;
  }
}

function setReactionPad(label, phaseClass) {
  reactionPad.textContent = label;
  reactionPad.classList.remove("waiting", "ready", "too-early");
  if (phaseClass) {
    reactionPad.classList.add(phaseClass);
  }
}

function renderReactionStats(lastMs) {
  reactionRoundEl.textContent = `${reactionGame.round} / ${REACTION_ROUNDS}`;
  reactionLastEl.textContent = Number.isFinite(lastMs) ? `${lastMs.toFixed(1)}ms` : "-";
  reactionAvgEl.textContent = reactionGame.round > 0 ? `${(reactionGame.totalMs / reactionGame.round).toFixed(1)}ms` : "-";
}

function resetReactionUI() {
  clearReactionTimer();
  reactionGame.running = false;
  reactionGame.round = 0;
  reactionGame.totalMs = 0;
  reactionGame.readyAt = 0;
  reactionGame.phase = "idle";
  reactionPad.disabled = true;
  setReactionPad("START", "");
  reactionStateEl.textContent = "시작 버튼을 눌러주세요.";
  renderReactionStats(NaN);
}

function queueNextReactionRound(delayMs) {
  clearReactionTimer();
  reactionGame.timeoutId = window.setTimeout(() => {
    if (!reactionGame.running) {
      return;
    }

    reactionGame.phase = "waiting";
    setReactionPad("WAIT", "waiting");
    reactionStateEl.textContent = `${reactionGame.round + 1} / ${REACTION_ROUNDS} 준비... 초록색이 되면 클릭하세요.`;

    const waitMs = 700 + Math.floor(Math.random() * 1600);
    reactionGame.timeoutId = window.setTimeout(() => {
      if (!reactionGame.running) {
        return;
      }
      reactionGame.phase = "ready";
      reactionGame.readyAt = performance.now();
      setReactionPad("CLICK", "ready");
      reactionStateEl.textContent = "지금 클릭!";
    }, waitMs);
  }, delayMs);
}

function stopReactionGame(saveRecord) {
  clearReactionTimer();

  if (!reactionGame.running) {
    return;
  }

  const completedAllRounds = reactionGame.round === REACTION_ROUNDS;
  reactionGame.running = false;
  reactionGame.phase = "idle";
  reactionPad.disabled = true;
  setReactionPad("START", "");

  if (completedAllRounds) {
    const avg = reactionGame.totalMs / REACTION_ROUNDS;
    reactionStateEl.textContent = `종료! 평균 ${avg.toFixed(1)}ms`;
    if (saveRecord) {
      showResultBanner(avg, `평균 ${avg.toFixed(1)}ms`);
      addRecord(avg);
    }
  } else {
    reactionStateEl.textContent = "중단됨";
  }
}

function startReactionGame() {
  hideResultBanner();
  if (reactionGame.running) {
    return;
  }

  clearReactionTimer();
  reactionGame.running = true;
  reactionGame.round = 0;
  reactionGame.totalMs = 0;
  reactionGame.readyAt = 0;
  reactionGame.phase = "idle";
  reactionPad.disabled = false;
  setReactionPad("WAIT", "waiting");
  renderReactionStats(NaN);
  reactionStateEl.textContent = "반응속도 테스트 시작";

  queueNextReactionRound(500);
}

reactionPad.addEventListener("click", () => {
  if (!reactionGame.running) {
    return;
  }

  if (reactionGame.phase === "waiting") {
    clearReactionTimer();
    setReactionPad("EARLY", "too-early");
    reactionStateEl.textContent = "너무 빨라요. 같은 라운드를 다시 시작합니다.";
    queueNextReactionRound(700);
    return;
  }

  if (reactionGame.phase !== "ready") {
    return;
  }

  const measured = performance.now() - reactionGame.readyAt;
  reactionGame.round += 1;
  reactionGame.totalMs += measured;
  reactionGame.phase = "idle";

  renderReactionStats(measured);
  setReactionPad(`${Math.round(measured)}ms`, "");

  if (reactionGame.round >= REACTION_ROUNDS) {
    stopReactionGame(true);
    return;
  }

  reactionStateEl.textContent = "좋아요! 다음 라운드 준비 중...";
  queueNextReactionRound(800);
});

reactionStartBtn.addEventListener("click", startReactionGame);
reactionResetBtn.addEventListener("click", clearBoard);
modeEl.addEventListener("change", () => { void updateRankUI(); });

resetReactionUI();
updateRankUI();




/* SERVER_RANK_OVERRIDE */
const scoreLabel = (v)=>`${Number(v).toFixed(1)}ms`;
function getRankSort() { return "asc"; }

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
  if (isNaN(curr) || score < curr) localStorage.setItem(key, String(score));
}
function showResultBanner(score, label) {
  savePB(score);
  const b = document.getElementById("resultBanner");
  if (b) { document.getElementById("resultScore").textContent = label; b.hidden = false; }
}
function hideResultBanner() {
  const b = document.getElementById("resultBanner"); if (b) b.hidden = true;
}
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startReactionGame(); });
