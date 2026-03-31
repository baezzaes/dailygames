const $ = (id) => document.getElementById(id);

const GAME_ID = "reaction";
const GAME_TITLE = "반응속도 테스트";
const RANK_SORT  = "asc";
const scoreLabel = (v)=>`${Number(v).toFixed(1)}ms`;
const REACTION_ROUNDS = 5;
// WAIT -> CLICK 전환 시점을 측정해 평균 반응속도를 계산합니다.

const rankTitle = $("rankTitle");
const rankList = $("rankList");

const reactionRoundEl = $("reactionRound");
const reactionLastEl = $("reactionLast");
const reactionAvgEl = $("reactionAvg");
const reactionStateEl = $("reactionState");
const reactionPad = $("reactionPad");
const reactionStartBtn = $("reactionStartBtn");
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
  // 라운드마다 "준비 대기 -> 랜덤 지연 -> 클릭 가능" 순서로 진행
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
  // 5라운드를 모두 완료했을 때만 기록을 저장합니다.
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

resetReactionUI();
updateRankUI();
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startReactionGame(); });
