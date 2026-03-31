const $ = (id) => document.getElementById(id);

const GAME_ID = "memory";
const GAME_TITLE = "색상 기억 게임";
const RANK_SORT  = "desc";
const scoreLabel = (v)=>`${v}라운드`;
// 라운드가 올라갈수록 패턴 길이가 1개씩 증가합니다.

const rankTitle = $("rankTitle");
const rankList = $("rankList");

const roundValEl = $("roundVal");
const stateValEl = $("stateVal");
const statusTextEl = $("statusText");
const startBtn = $("startBtn");
const tiles = Array.from(document.querySelectorAll(".tile"));
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
  // 패턴 표시 중에는 입력을 잠그고, 표시 종료 후 입력을 엽니다.
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
  // 실패 시 기록은 "클리어한 마지막 라운드" 기준으로 저장합니다.
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
stopGame(true);
updateRound();
updateRankUI();
document.getElementById("restartBtn").addEventListener("click", () => { hideResultBanner(); startGame(); });
