const $ = (id) => document.getElementById(id);
const GAME_ID = "onecount";
const GAME_TITLE = "1초 카운트 정지";
const RANK_SORT = "asc";
const scoreLabel = (v) => `${Number(v).toFixed(1)}ms`;

const TARGET_MS = 1000;
const ROUNDS = 5;

const roundVal = $("roundVal");
const countVal = $("countVal");
const errorVal = $("errorVal");
const statusText = $("statusText");
const startBtn = $("startBtn");
const stopBtn = $("stopBtn");

const game = {
  running: false,
  round: 0,
  startAt: 0,
  raf: 0,
  errors: [],
};

function setStatus(text) {
  statusText.textContent = text;
}

function resetHud() {
  roundVal.textContent = `${game.round} / ${ROUNDS}`;
  countVal.textContent = "0.000s";
  errorVal.textContent = "-";
}

function cancelTick() {
  if (game.raf) {
    cancelAnimationFrame(game.raf);
    game.raf = 0;
  }
}

function tick() {
  if (!game.running) return;
  const elapsed = performance.now() - game.startAt;
  countVal.textContent = `${(elapsed / 1000).toFixed(3)}s`;
  game.raf = requestAnimationFrame(tick);
}

function startRound() {
  game.round += 1;
  game.running = true;
  game.startAt = performance.now();
  roundVal.textContent = `${game.round} / ${ROUNDS}`;
  countVal.textContent = "0.000s";
  errorVal.textContent = "-";
  setStatus(`${game.round}라운드 진행 중... 1.000초에 STOP!`);
  stopBtn.disabled = false;
  game.raf = requestAnimationFrame(tick);
}

function finishGame() {
  const avgError = game.errors.reduce((sum, e) => sum + e, 0) / game.errors.length;
  const label = `평균 오차 ${scoreLabel(avgError)}`;
  setStatus(`게임 종료! ${label}`);
  stopBtn.disabled = true;
  startBtn.disabled = false;
  showResultBanner(avgError, label);
  addRecord(avgError);
}

function startGame() {
  hideResultBanner();
  cancelTick();
  game.running = false;
  game.round = 0;
  game.errors = [];
  startBtn.disabled = true;
  stopBtn.disabled = true;
  resetHud();
  setStatus("준비... 첫 라운드를 시작합니다.");
  setTimeout(startRound, 300);
}

function stopRound() {
  if (!game.running) return;

  game.running = false;
  cancelTick();

  const elapsed = performance.now() - game.startAt;
  const error = Math.abs(elapsed - TARGET_MS);
  game.errors.push(error);

  countVal.textContent = `${(elapsed / 1000).toFixed(3)}s`;
  errorVal.textContent = `${error.toFixed(1)}ms`;
  stopBtn.disabled = true;

  if (game.round >= ROUNDS) {
    finishGame();
    return;
  }

  setStatus(`오차 ${error.toFixed(1)}ms · 다음 라운드 준비...`);
  setTimeout(startRound, 700);
}

startBtn.addEventListener("click", startGame);
stopBtn.addEventListener("click", stopRound);
document.getElementById("restartBtn").addEventListener("click", startGame);

resetHud();
updateRankUI();
