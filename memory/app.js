// 색상 기억 게임 — game.js 공통 함수 활용
const GAME_ID    = "memory";
const GAME_TITLE = "🎨 색상 기억";
const RANK_SORT  = "desc";
const scoreLabel = v => `${v}라운드`;

const roundValEl   = document.getElementById('roundVal');
const stateValEl   = document.getElementById('stateVal');
const statusTextEl = document.getElementById('statusText');
const startBtn     = document.getElementById('startBtn');
const restartBtn   = document.getElementById('restartBtn');
const tiles        = Array.from(document.querySelectorAll('.tile'));

const game = {
  running:  false,
  locked:   true,
  seq:      [],
  inputIdx: 0,
  round:    0,
};

function setStateText(t) { stateValEl.textContent = t; }
function setStatus(t)    { statusTextEl.textContent = t; }
function updateRound()   { roundValEl.textContent = String(game.round); }

function flashTile(idx, dur = 340) {
  return new Promise(resolve => {
    const tile = tiles[idx];
    tile.classList.add('active');
    setTimeout(() => { tile.classList.remove('active'); resolve(); }, dur);
  });
}

async function showSequence() {
  game.locked = true;
  setStateText('패턴 표시');
  setStatus(`라운드 ${game.round}: 패턴을 기억하세요.`);
  await new Promise(r => setTimeout(r, 400));
  for (const idx of game.seq) {
    await flashTile(idx, 300);
    await new Promise(r => setTimeout(r, 130));
  }
  game.locked   = false;
  game.inputIdx = 0;
  setStateText('입력 대기');
  setStatus('같은 순서로 탭하세요.');
}

function endGame() {
  game.running = false;
  game.locked  = true;
  const score = Math.max(0, game.round - 1);
  setStateText('종료');
  setStatus(`게임 종료! ${scoreLabel(score)} 달성.`);
  showResultBanner(score, scoreLabel(score));
  addRecord(score);
}

async function nextRound() {
  game.round += 1;
  updateRound();
  game.seq.push(Math.floor(Math.random() * 4));
  await showSequence();
}

async function startGame() {
  hideResultBanner();
  game.running  = true;
  game.locked   = true;
  game.seq      = [];
  game.round    = 0;
  updateRound();
  setStateText('준비');
  setStatus('게임 시작!');
  await nextRound();
}

tiles.forEach(tile => {
  tile.addEventListener('click', async () => {
    if (!game.running || game.locked) return;
    const idx = Number(tile.dataset.idx);
    await flashTile(idx, 120);

    if (idx !== game.seq[game.inputIdx]) {
      endGame();
      return;
    }

    game.inputIdx += 1;
    if (game.inputIdx >= game.seq.length) {
      setStateText('정답!');
      setStatus('정답! 다음 라운드 준비 중…');
      game.locked = true;
      setTimeout(() => { if (game.running) nextRound(); }, 500);
    }
  });
});

startBtn.addEventListener('click', () => {
  if (game.running) return;
  startGame();
});
restartBtn.addEventListener('click', startGame);

updateRankUI();
