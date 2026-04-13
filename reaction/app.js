// 반응속도 테스트 — game.js 공통 함수 활용
const GAME_ID    = "reaction";
const GAME_TITLE = "⚡ 반응속도";
const RANK_SORT  = "asc";
const scoreLabel = v => `${Number(v).toFixed(1)}ms`;

const REACTION_ROUNDS = 5;

const reactionRoundEl = document.getElementById('reactionRound');
const reactionLastEl  = document.getElementById('reactionLast');
const reactionAvgEl   = document.getElementById('reactionAvg');
const reactionStateEl = document.getElementById('reactionState');
const reactionPad     = document.getElementById('reactionPad');
const startBtn        = document.getElementById('startBtn');
const restartBtn      = document.getElementById('restartBtn');

const rg = {
  running: false,
  round:   0,
  totalMs: 0,
  readyAt: 0,
  timerId: 0,
  phase:   'idle', // idle | waiting | ready | early
};

function clearTimer() {
  if (rg.timerId) { clearTimeout(rg.timerId); rg.timerId = 0; }
}

function setPad(label, phaseClass) {
  reactionPad.textContent = label;
  reactionPad.classList.remove('waiting', 'ready', 'too-early');
  if (phaseClass) reactionPad.classList.add(phaseClass);
}

function renderStats(lastMs) {
  reactionRoundEl.textContent = `${rg.round} / ${REACTION_ROUNDS}`;
  reactionLastEl.textContent  = Number.isFinite(lastMs) ? scoreLabel(lastMs) : '-';
  reactionAvgEl.textContent   = rg.round > 0
    ? scoreLabel(rg.totalMs / rg.round) : '-';
}

function queueRound(delayMs) {
  clearTimer();
  rg.timerId = setTimeout(() => {
    if (!rg.running) return;
    rg.phase = 'waiting';
    setPad('대기…', 'waiting');
    reactionStateEl.textContent = `${rg.round + 1} / ${REACTION_ROUNDS} — 초록색이 되면 즉시 탭!`;
    const waitMs = 700 + Math.floor(Math.random() * 2400);
    rg.timerId = setTimeout(() => {
      if (!rg.running) return;
      rg.phase   = 'ready';
      rg.readyAt = performance.now();
      setPad('지금!', 'ready');
      reactionStateEl.textContent = '지금 탭하세요!';
    }, waitMs);
  }, delayMs);
}

function startGame() {
  clearTimer();
  hideResultBanner();
  rg.running = true;
  rg.round   = 0;
  rg.totalMs = 0;
  rg.readyAt = 0;
  rg.phase   = 'idle';
  reactionPad.disabled = false;
  setPad('탭 대기', '');
  renderStats(NaN);
  reactionStateEl.textContent = '반응속도 테스트 시작!';
  queueRound(500);
}

reactionPad.addEventListener('click', () => {
  if (!rg.running) return;

  if (rg.phase === 'waiting') {
    clearTimer();
    setPad('너무 빨라요!', 'too-early');
    reactionStateEl.textContent = '너무 빨라요. 같은 라운드를 다시 시작합니다.';
    queueRound(700);
    return;
  }

  if (rg.phase !== 'ready') return;

  const elapsed = performance.now() - rg.readyAt;
  rg.round   += 1;
  rg.totalMs += elapsed;
  rg.phase    = 'idle';
  renderStats(elapsed);
  setPad(scoreLabel(elapsed), '');

  if (rg.round >= REACTION_ROUNDS) {
    rg.running = false;
    reactionPad.disabled = true;
    const avg     = rg.totalMs / REACTION_ROUNDS;
    const rounded = Math.round(avg * 10) / 10;
    reactionStateEl.textContent = `완료! 평균 반응 시간: ${scoreLabel(avg)}`;
    showResultBanner(rounded, scoreLabel(rounded));
    addRecord(rounded);
    return;
  }

  reactionStateEl.textContent = '좋아요! 다음 라운드 준비 중…';
  queueRound(800);
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

updateRankUI();
