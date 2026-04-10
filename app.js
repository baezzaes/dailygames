// 세균전 (Ataxx) - DailyGames
// game.js의 공통 함수 활용: addRecord, updateRankUI, showResultBanner, getPlayerName 등

const GAME_ID    = "bacteria";
const GAME_TITLE = "세균전";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${Number(v)}칸`;

// ── 상수 ────────────────────────────────────────────────────────────
const BOARD_SIZE = 7;
const EMPTY = 0, PLAYER = 1, AI = 2, BLOCK = 3;
const AI_DEPTH = 4; // 미니맥스 탐색 깊이

// ── 날짜 시드 유틸 ──────────────────────────────────────────────────
function getDailySeed() {
  const KST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return KST.getUTCFullYear() * 10000 + (KST.getUTCMonth() + 1) * 100 + KST.getUTCDate();
}

function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 보드 생성 ────────────────────────────────────────────────────────
function createBoard(seed) {
  const board = Array.from({ length: BOARD_SIZE }, () => new Uint8Array(BOARD_SIZE).fill(EMPTY));

  // 시작 위치: 플레이어 좌상단 + 우하단, AI 우상단 + 좌하단 (클래식 Ataxx)
  board[0][0] = PLAYER; board[BOARD_SIZE-1][BOARD_SIZE-1] = PLAYER;
  board[0][BOARD_SIZE-1] = AI;  board[BOARD_SIZE-1][0] = AI;

  // 날짜 시드로 장애물 생성 (대칭 배치로 공정성 유지)
  const rng = makeRng(seed);
  const obstacleCount = 4 + Math.floor(rng() * 3); // 4~6개 (절반 기준)
  const placed = new Set();
  const cornerCells = new Set(["0,0","0,6","6,0","6,6"]);
  let attempts = 0;

  while (placed.size < obstacleCount && attempts < 200) {
    attempts++;
    const r = Math.floor(rng() * 3) + 2; // 2~4행 (중간 영역)
    const c = Math.floor(rng() * 3) + 2; // 2~4열
    const key = `${r},${c}`;
    const sym = `${BOARD_SIZE-1-r},${BOARD_SIZE-1-c}`;
    if (placed.has(key) || cornerCells.has(key) || cornerCells.has(sym)) continue;
    board[r][c] = BLOCK;
    board[BOARD_SIZE-1-r][BOARD_SIZE-1-c] = BLOCK;
    placed.add(key);
    placed.add(sym);
  }

  return board;
}

// ── 게임 로직 ────────────────────────────────────────────────────────
function cloneBoard(board) {
  return board.map(row => new Uint8Array(row));
}

function countPieces(board) {
  let player = 0, ai = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === PLAYER) player++;
      else if (board[r][c] === AI) ai++;
    }
  return { player, ai };
}

function getMoves(board, who) {
  const moves = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== who) continue;
      // 클론 (인접 1칸)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (board[nr][nc] === EMPTY) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: 'clone' });
        }
      }
      // 점프 (2칸)
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (Math.abs(dr) < 2 && Math.abs(dc) < 2) continue; // 1칸은 위에서 처리
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
          if (board[nr][nc] === EMPTY) moves.push({ fr: r, fc: c, tr: nr, tc: nc, type: 'jump' });
        }
      }
    }
  }
  return moves;
}

function applyMove(board, move, who) {
  const next = cloneBoard(board);
  const opp = who === PLAYER ? AI : PLAYER;
  if (move.type === 'jump') next[move.fr][move.fc] = EMPTY;
  next[move.tr][move.tc] = who;
  // 감염: 주변 적 세균
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = move.tr + dr, nc = move.tc + dc;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
      if (next[nr][nc] === opp) next[nr][nc] = who;
    }
  }
  return next;
}

function isGameOver(board) {
  const playerMoves = getMoves(board, PLAYER);
  const aiMoves = getMoves(board, AI);
  if (playerMoves.length > 0 || aiMoves.length > 0) return false;
  return true;
}

// ── 미니맥스 (알파-베타) ─────────────────────────────────────────────
function evaluate(board) {
  const { player, ai } = countPieces(board);
  return ai - player; // AI 최대화
}

function minimax(board, depth, alpha, beta, maximizing) {
  const who = maximizing ? AI : PLAYER;
  const moves = getMoves(board, who);

  if (depth === 0 || moves.length === 0) {
    return { score: evaluate(board), move: null };
  }

  let best = { score: maximizing ? -Infinity : Infinity, move: null };

  for (const move of moves) {
    const next = applyMove(board, move, who);
    const result = minimax(next, depth - 1, alpha, beta, !maximizing);
    if (maximizing) {
      if (result.score > best.score) best = { score: result.score, move };
      alpha = Math.max(alpha, best.score);
    } else {
      if (result.score < best.score) best = { score: result.score, move };
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

// ── UI 상태 ──────────────────────────────────────────────────────────
const state = {
  board: null,
  selected: null,   // { r, c }
  validMoves: [],   // 선택된 조각의 이동 가능 위치
  turn: PLAYER,
  running: false,
  finished: false,
};

const boardEl   = document.getElementById('board');
const statusEl  = document.getElementById('statusMsg');
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl     = document.getElementById('aiScore');
const startBtn  = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

function renderBoard() {
  const cells = boardEl.querySelectorAll('.cell');
  const validSet = new Set(state.validMoves.map(m => `${m.tr},${m.tc}`));
  const selKey = state.selected ? `${state.selected.r},${state.selected.c}` : null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = cells[r * BOARD_SIZE + c];
      const val = state.board[r][c];
      cell.className = 'cell ' + ['empty','player','ai','obstacle'][val];
      if (selKey === `${r},${c}`) cell.classList.add('selected');
      if (validSet.has(`${r},${c}`)) cell.classList.add('valid');
    }
  }
  const { player, ai } = countPieces(state.board);
  playerScoreEl.textContent = player;
  aiScoreEl.textContent = ai;
}

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
  }
}

function setStatus(msg) { statusEl.textContent = msg; }

function infectAnimation(cells, positions) {
  positions.forEach(({r, c}) => {
    const cell = cells[r * BOARD_SIZE + c];
    cell.classList.remove('infect-anim');
    // reflow trigger
    void cell.offsetWidth;
    cell.classList.add('infect-anim');
    setTimeout(() => cell.classList.remove('infect-anim'), 300);
  });
}

function getInfectedCells(board, next, who) {
  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] !== who && next[r][c] === who && board[r][c] !== EMPTY && board[r][c] !== BLOCK)
        cells.push({r, c});
  return cells;
}

function endGame() {
  state.running = false;
  state.finished = true;
  state.selected = null;
  state.validMoves = [];
  renderBoard();

  const { player, ai } = countPieces(state.board);
  const totalCells = BOARD_SIZE * BOARD_SIZE - countBlocks(state.board);
  let msg = '';
  if (player > ai) msg = `승리! 🎉 ${player} : ${ai}`;
  else if (ai > player) msg = `패배 😞 ${player} : ${ai}`;
  else msg = `무승부 🤝 ${player} : ${ai}`;
  setStatus(msg);

  restartBtn.hidden = false;
  startBtn.hidden = true;

  showResultBanner(player, `${player}칸`);
  addRecord(player);
}

function countBlocks(board) {
  let n = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === BLOCK) n++;
  return n;
}

async function doAiMove() {
  if (!state.running || state.turn !== AI) return;
  setStatus('AI 생각 중…');
  boardEl.querySelectorAll('.cell').forEach(c => c.classList.add('ai-thinking'));

  await new Promise(r => setTimeout(r, 50)); // UI 업데이트 대기

  const result = minimax(state.board, AI_DEPTH, -Infinity, Infinity, true);
  boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('ai-thinking'));

  if (!result.move) {
    // AI 이동 불가 → 플레이어에게 턴
    const playerMoves = getMoves(state.board, PLAYER);
    if (!playerMoves.length) { endGame(); return; }
    state.turn = PLAYER;
    setStatus('당신의 차례');
    return;
  }

  const prev = state.board;
  state.board = applyMove(state.board, result.move, AI);
  const infected = getInfectedCells(prev, state.board, AI);
  renderBoard();
  if (infected.length) {
    const cellEls = boardEl.querySelectorAll('.cell');
    infectAnimation(cellEls, infected);
  }

  if (isGameOver(state.board)) { endGame(); return; }

  const playerMoves = getMoves(state.board, PLAYER);
  if (!playerMoves.length) {
    // 플레이어 이동 불가 → AI 연속
    setStatus('이동 가능한 칸이 없어요. AI가 한 번 더 이동합니다.');
    state.turn = AI;
    setTimeout(doAiMove, 600);
  } else {
    state.turn = PLAYER;
    setStatus('당신의 차례');
  }
}

function onCellClick(e) {
  if (!state.running || state.turn !== PLAYER || state.finished) return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;

  // 이동 가능한 칸 클릭
  const targetMove = state.validMoves.find(m => m.tr === r && m.tc === c);
  if (targetMove) {
    const prev = state.board;
    state.board = applyMove(state.board, targetMove, PLAYER);
    const infected = getInfectedCells(prev, state.board, PLAYER);
    state.selected = null;
    state.validMoves = [];
    renderBoard();
    if (infected.length) {
      const cellEls = boardEl.querySelectorAll('.cell');
      infectAnimation(cellEls, infected);
    }

    if (isGameOver(state.board)) { endGame(); return; }

    const aiMoves = getMoves(state.board, AI);
    if (!aiMoves.length) {
      const playerMoves = getMoves(state.board, PLAYER);
      if (!playerMoves.length) { endGame(); return; }
      setStatus('AI 이동 불가. 한 번 더 이동하세요.');
    } else {
      state.turn = AI;
      setTimeout(doAiMove, 400);
    }
    return;
  }

  // 내 조각 선택
  if (state.board[r][c] === PLAYER) {
    state.selected = { r, c };
    const allMoves = getMoves(state.board, PLAYER);
    state.validMoves = allMoves.filter(m => m.fr === r && m.fc === c);
    renderBoard();
    setStatus(state.validMoves.length ? '이동할 칸을 선택하세요' : '이동 가능한 칸이 없습니다');
    return;
  }

  // 빈 칸 또는 다른 클릭 → 선택 해제
  state.selected = null;
  state.validMoves = [];
  renderBoard();
  setStatus('당신의 차례');
}

function startGame() {
  const seed = getDailySeed();
  state.board = createBoard(seed);
  state.selected = null;
  state.validMoves = [];
  state.turn = PLAYER;
  state.running = true;
  state.finished = false;

  buildBoard();
  renderBoard();
  setStatus('당신의 차례 (파란 조각을 선택하세요)');
  startBtn.hidden = true;
  restartBtn.hidden = false;
  document.getElementById('resultBanner').hidden = true;
}

// ── 닉네임 처리 ──────────────────────────────────────────────────────
function loadNickname() {
  return localStorage.getItem('dailygames:lastname') || '';
}

function saveNickname(nick, tag) {
  localStorage.setItem('dailygames:lastname', nick);
  if (tag) localStorage.setItem('dailygames:lasttag', tag);
}

function generateTag() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function showNickModal() {
  document.getElementById('nickModal').hidden = false;
}

function hideNickModal() {
  document.getElementById('nickModal').hidden = true;
}

function updateHeaderNick() {
  const el = document.getElementById('headerNick');
  const name = loadNickname();
  const tag = localStorage.getItem('dailygames:lasttag') || '0000';
  if (name) el.textContent = `${name}#${tag}`;
}

document.getElementById('nickConfirm').addEventListener('click', () => {
  const val = document.getElementById('nickInput').value.trim();
  const errEl = document.getElementById('nickError');
  if (!val) { errEl.textContent = '닉네임을 입력해주세요'; errEl.hidden = false; return; }
  if (!isNicknameAllowed(val)) { errEl.textContent = '사용할 수 없는 닉네임입니다'; errEl.hidden = false; return; }
  errEl.hidden = true;
  const tag = generateTag();
  saveNickname(val, tag);
  hideNickModal();
  updateHeaderNick();
});

document.getElementById('nickInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('nickConfirm').click();
});

// 헤더 닉네임 클릭 → 변경
document.getElementById('headerNick').addEventListener('click', () => {
  const input = document.getElementById('nickInput');
  input.value = loadNickname();
  showNickModal();
});

// ── 버튼 이벤트 ──────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => {
  document.getElementById('resultBanner').hidden = true;
  startGame();
});

// ── 날짜 표시 ────────────────────────────────────────────────────────
document.getElementById('dateLabel').textContent = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
});

// ── 초기화 ───────────────────────────────────────────────────────────
(function init() {
  const nick = loadNickname();
  if (!nick || !isNicknameAllowed(nick)) {
    showNickModal();
  } else {
    updateHeaderNick();
  }
  buildBoard();
  updateRankUI();
})();
