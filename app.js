const $ = (id) => document.getElementById(id);

// (레거시) 로컬 스토리지 기반 허브/게임 샘플 로직입니다.
// 현재 메인 서비스는 폴더별 게임 + 공통 game.js 구조를 사용합니다.
const nameEl = $("name");
const modeEl = $("mode");
const rankTitle = $("rankTitle");
const rankList = $("rankList");

const screens = {
  home: $("homeScreen"),
  click10: $("click10Screen"),
  reaction: $("reactionScreen"),
};

const gameDefs = {
  click10: {
    title: "10초 클릭 챌린지",
    scoreLabel: (v) => `${v}회`,
    compare: (a, b) => b.score - a.score || a.t - b.t,
  },
  reaction: {
    title: "반응속도 테스트",
    scoreLabel: (v) => `${Number(v).toFixed(1)}ms`,
    compare: (a, b) => a.score - b.score || a.t - b.t,
  },
};

let currentGame = null;

function todayKey() {
  // 일간 랭킹 키(로컬 시간 기준)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekKey() {
  // 주간 랭킹 키(ISO week)
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

function storageKey(gameId, mode) {
  const periodKey = mode === "weekly" ? weekKey() : todayKey();
  return `dailygames:${gameId}:${mode}:${periodKey}`;
}

function getBoard(gameId, mode) {
  try {
    const raw = localStorage.getItem(storageKey(gameId, mode));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBoard(gameId, mode, board) {
  localStorage.setItem(storageKey(gameId, mode), JSON.stringify(board));
}

function addRecord(gameId, score) {
  const mode = modeEl.value;
  const board = getBoard(gameId, mode);
  board.push({
    name: sanitizeName(nameEl.value),
    score,
    t: Date.now(),
  });
  board.sort(gameDefs[gameId].compare);
  saveBoard(gameId, mode, board.slice(0, 50));
  updateRankUI();
}

function clearBoard(gameId) {
  localStorage.removeItem(storageKey(gameId, modeEl.value));
  updateRankUI();
}

function showScreen(screenName) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("hidden", key !== screenName);
  });
}

function stopAllGamesForNavigation() {
  stopClickGame(false);
  stopReactionGame(false);
}

function openHome() {
  stopAllGamesForNavigation();
  currentGame = null;
  showScreen("home");
  updateRankUI();
}

function openGame(gameId) {
  stopAllGamesForNavigation();
  currentGame = gameId;
  showScreen(gameId);
  updateRankUI();
}

function updateRankUI() {
  // 현재 선택된 게임/모드에 맞는 로컬 랭킹을 렌더링
  const modeText = modeEl.value === "weekly" ? "주간" : "오늘";

  rankList.innerHTML = "";

  if (!currentGame) {
    rankTitle.textContent = `${modeText} 랭킹`;
    const li = document.createElement("li");
    li.textContent = "홈에서 게임을 선택하면 해당 게임 랭킹이 표시됩니다.";
    rankList.appendChild(li);
    return;
  }

  const game = gameDefs[currentGame];
  rankTitle.textContent = `${game.title} ${modeText} TOP 10`;

  const board = getBoard(currentGame, modeEl.value)
    .sort(game.compare)
    .slice(0, 10);

  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없습니다. 첫 기록을 만들어보세요.";
    rankList.appendChild(li);
    return;
  }

  board.forEach((row, idx) => {
    const li = document.createElement("li");
    const dt = new Date(row.t);
    li.textContent = `${idx + 1}. ${row.name} - ${game.scoreLabel(row.score)} (${dt.toLocaleString()})`;
    rankList.appendChild(li);
  });
}

// Click 10 Game
const clickTimeEl = $("clickTime");
const clickScoreEl = $("clickScore");
const clickStateEl = $("clickState");
const clickBigBtn = $("clickBigBtn");
const clickStartBtn = $("clickStartBtn");
const clickResetBtn = $("clickResetBtn");

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
    addRecord("click10", clickGame.score);
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
clickResetBtn.addEventListener("click", () => clearBoard("click10"));

// Reaction Game
const REACTION_ROUNDS = 5;
const reactionRoundEl = $("reactionRound");
const reactionLastEl = $("reactionLast");
const reactionAvgEl = $("reactionAvg");
const reactionStateEl = $("reactionState");
const reactionPad = $("reactionPad");
const reactionStartBtn = $("reactionStartBtn");
const reactionResetBtn = $("reactionResetBtn");

const reactionGame = {
  running: false,
  round: 0,
  totalMs: 0,
  readyAt: 0,
  timeoutId: 0,
  phase: "idle", // idle | waiting | ready
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
      addRecord("reaction", avg);
    }
  } else {
    reactionStateEl.textContent = "중단됨";
  }
}

function startReactionGame() {
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

  reactionStateEl.textContent = `좋아요! 다음 라운드 준비 중...`;
  queueNextReactionRound(800);
});

reactionStartBtn.addEventListener("click", startReactionGame);
reactionResetBtn.addEventListener("click", () => clearBoard("reaction"));

// Navigation bindings
Array.from(document.querySelectorAll("[data-game]")).forEach((btn) => {
  btn.addEventListener("click", () => openGame(btn.dataset.game));
});

Array.from(document.querySelectorAll("[data-go-home]")).forEach((btn) => {
  btn.addEventListener("click", openHome);
});

modeEl.addEventListener("change", updateRankUI);

resetClickUI();
resetReactionUI();
openHome();
