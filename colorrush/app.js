const $ = (id) => document.getElementById(id);

const GAME_ID    = "colorrush";
const GAME_TITLE = "색상 러시";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${v}점`;
// 글자의 잉크 색상을 탭하는 Stroop 효과 게임. 30초 동안 최대 정답 수를 겨룹니다.

const GAME_SEC = 30;

const COLORS = [
  { name: "빨강", hex: "#ff5f5f" },
  { name: "파랑", hex: "#5f9fff" },
  { name: "초록", hex: "#5fff8a" },
  { name: "노랑", hex: "#ffd84f" },
  { name: "보라", hex: "#c87fff" },
  { name: "주황", hex: "#ff9f4f" },
];

const wordDisplay  = $("wordDisplay");
const colorButtons = $("colorButtons");
const feedbackEl   = $("feedback");
const scoreVal     = $("scoreVal");
const correctVal   = $("correctVal");
const timeVal      = $("timeVal");
const startBtn     = $("startBtn");

const game = {
  running: false,
  score: 0,
  correct: 0,
  timeLeft: GAME_SEC,
  tickId: 0,
  inkColor: null,   // 현재 표시 중인 잉크 색상 객체
  feedbackTimer: 0,
};

// ── 헬퍼 ──────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick(arr, exclude) {
  const pool = exclude !== undefined ? arr.filter(x => x !== exclude) : arr;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── UI 갱신 ───────────────────────────────────────────

function refreshHud() {
  scoreVal.textContent   = String(game.score);
  correctVal.textContent = String(game.correct);
  timeVal.textContent    = `${game.timeLeft.toFixed(1)}s`;
}

function setFeedback(text, cls) {
  clearTimeout(game.feedbackTimer);
  feedbackEl.textContent = text;
  feedbackEl.className   = `feedback-text ${cls}`;
  game.feedbackTimer = setTimeout(() => {
    feedbackEl.textContent = "";
    feedbackEl.className   = "feedback-text";
  }, 500);
}

// ── 문제 생성 ─────────────────────────────────────────

function nextQuestion() {
  // 잉크 색상 (표시될 색)
  const inkColor  = pick(COLORS);
  // 단어 뜻 (잉크 색과 반드시 다름)
  const wordColor = pick(COLORS, inkColor);

  game.inkColor = inkColor;

  wordDisplay.textContent = wordColor.name;
  wordDisplay.style.color = inkColor.hex;

  // 버튼 4개: 정답 inkColor + 오답 3개
  const wrong = shuffle(COLORS.filter(c => c !== inkColor)).slice(0, 3);
  const options = shuffle([inkColor, ...wrong]);

  colorButtons.innerHTML = "";
  for (const col of options) {
    const btn = document.createElement("button");
    btn.className = "color-btn";
    btn.dataset.color = col.name;
    btn.textContent = col.name;
    btn.type = "button";
    btn.addEventListener("click", () => onAnswer(btn, col));
    colorButtons.appendChild(btn);
  }
}

// ── 답변 처리 ─────────────────────────────────────────

function onAnswer(btn, chosen) {
  if (!game.running) return;

  const correct = chosen === game.inkColor;

  if (correct) {
    game.score   += 1;
    game.correct += 1;
    btn.classList.add("flash-ok");
    setFeedback("정답!", "ok");
  } else {
    game.score = Math.max(0, game.score - 1);
    btn.classList.add("flash-fail");
    // 정답 버튼 하이라이트
    const btns = colorButtons.querySelectorAll(".color-btn");
    btns.forEach(b => { if (b.dataset.color === game.inkColor.name) b.classList.add("flash-ok"); });
    setFeedback("오답 -1", "fail");
  }

  refreshHud();

  // 버튼 잠깐 비활성화 후 다음 문제
  setButtonsDisabled(true);
  setTimeout(() => {
    if (!game.running) return;
    setButtonsDisabled(false);
    nextQuestion();
  }, 220);
}

function setButtonsDisabled(disabled) {
  colorButtons.querySelectorAll(".color-btn").forEach(b => { b.disabled = disabled; });
}

// ── 타이머 ────────────────────────────────────────────

function tick() {
  game.timeLeft = Math.max(0, game.timeLeft - 0.1);
  timeVal.textContent = `${game.timeLeft.toFixed(1)}s`;

  if (game.timeLeft <= 0) {
    endGame();
    return;
  }
  game.tickId = setTimeout(tick, 100);
}

// ── 게임 시작 / 종료 ──────────────────────────────────

function startGame() {
  hideResultBanner();
  clearTimeout(game.tickId);
  clearTimeout(game.feedbackTimer);

  game.running  = true;
  game.score    = 0;
  game.correct  = 0;
  game.timeLeft = GAME_SEC;

  startBtn.disabled = true;
  feedbackEl.textContent = "";
  feedbackEl.className   = "feedback-text";

  refreshHud();
  nextQuestion();
  game.tickId = setTimeout(tick, 100);
}

function endGame() {
  clearTimeout(game.tickId);
  game.running = false;
  startBtn.disabled = false;

  setButtonsDisabled(true);
  wordDisplay.textContent = "";
  wordDisplay.style.color = "";

  showResultBanner(game.score, scoreLabel(game.score));
  addRecord(game.score);
}

// ── 이벤트 바인딩 ─────────────────────────────────────

startBtn.addEventListener("click", startGame);
$("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });

// ── 초기화 ────────────────────────────────────────────

refreshHud();
updateRankUI();
