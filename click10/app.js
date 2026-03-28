const $ = (id) => document.getElementById(id);

const GAME_ID = "click10";
const GAME_TITLE = "10초 클릭 챌린지";
const RANK_SORT  = "desc";
const scoreLabel = (v)=>`${v}회`;

const rankTitle = $("rankTitle");
const rankList = $("rankList");

const clickTimeEl = $("clickTime");
const clickScoreEl = $("clickScore");
const clickStateEl = $("clickState");
const clickBigBtn = $("clickBigBtn");
const clickStartBtn = $("clickStartBtn");
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
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startClickGame(); });
