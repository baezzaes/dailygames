// 세균전 (Ataxx) - DailyGames
// game.js의 공통 함수 활용: addRecord, updateRankUI, showResultBanner, getPlayerName 등

const GAME_ID    = "bacteria";
const GAME_TITLE = "세균전";
const RANK_SORT  = "desc";
const scoreLabel = (v) => `${Number(v)}칸`;

// ── 상수 ────────────────────────────────────────────────────────────
const BOARD_SIZE = 7;
const EMPTY = 0, PLAYER = 1, AI = 2, BLOCK = 3;
const AI_DEPTH = 2;

// 애니메이션 타이밍
const ANIM_CLONE_MS  = 240;
const ANIM_JUMP_MS   = 360;
const ANIM_INFECT_MS = 260;
const ANIM_STAGGER   = 55; // 감염 파동 간격 (ms)

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
  board[0][0] = PLAYER; board[BOARD_SIZE-1][BOARD_SIZE-1] = PLAYER;
  board[0][BOARD_SIZE-1] = AI;  board[BOARD_SIZE-1][0] = AI;

  const rng = makeRng(seed);
  const obstacleCount = 4 + Math.floor(rng() * 3);
  const placed = new Set();
  const cornerCells = new Set(["0,0","0,6","6,0","6,6"]);
  let attempts = 0;

  while (placed.size < obstacleCount && attempts < 200) {
    attempts++;
    const r = Math.floor(rng() * 3) + 2;
    const c = Math.floor(rng() * 3) + 2;
    const key = `${r},${c}`;
    const sym = `${BOARD_SIZE-1-r},${BOARD_SIZE-1-c}`;
    if (placed.has(key) || cornerCells.has(key) || cornerCells.has(sym)) continue;
    board[r][c] = BLOCK;
    board[BOARD_SIZE-1-r][BOARD_SIZE-1-c] = BLOCK;
    placed.add(key); placed.add(sym);
  }
  return board;
}

// ── 게임 로직 ────────────────────────────────────────────────────────
function cloneBoard(board) { return board.map(row => new Uint8Array(row)); }

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
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r+dr, nc = c+dc;
          if (nr<0||nr>=BOARD_SIZE||nc<0||nc>=BOARD_SIZE) continue;
          if (board[nr][nc] === EMPTY) moves.push({ fr:r, fc:c, tr:nr, tc:nc, type:'clone' });
        }
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          if (Math.abs(dr)<2 && Math.abs(dc)<2) continue;
          const nr = r+dr, nc = c+dc;
          if (nr<0||nr>=BOARD_SIZE||nc<0||nc>=BOARD_SIZE) continue;
          if (board[nr][nc] === EMPTY) moves.push({ fr:r, fc:c, tr:nr, tc:nc, type:'jump' });
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
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr===0 && dc===0) continue;
      const nr = move.tr+dr, nc = move.tc+dc;
      if (nr<0||nr>=BOARD_SIZE||nc<0||nc>=BOARD_SIZE) continue;
      if (next[nr][nc] === opp) next[nr][nc] = who;
    }
  return next;
}

function isGameOver(board) {
  return getMoves(board, PLAYER).length === 0 && getMoves(board, AI).length === 0;
}

function getInfectedCells(board, next, who) {
  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] !== who && next[r][c] === who && board[r][c] !== EMPTY && board[r][c] !== BLOCK)
        cells.push({ r, c });
  return cells;
}

// ── 미니맥스 (알파-베타) ─────────────────────────────────────────────
function evaluate(board) { const { player, ai } = countPieces(board); return ai - player; }

function minimax(board, depth, alpha, beta, maximizing) {
  const who = maximizing ? AI : PLAYER;
  const moves = getMoves(board, who);
  if (depth === 0 || moves.length === 0) return { score: evaluate(board), move: null };
  let best = { score: maximizing ? -Infinity : Infinity, move: null };
  for (const move of moves) {
    const result = minimax(applyMove(board, move, who), depth-1, alpha, beta, !maximizing);
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

// ── 애니메이션 ───────────────────────────────────────────────────────
let isAnimating = false;

function getCellEl(r, c) { return boardEl.children[r * BOARD_SIZE + c]; }

/**
 * 조각이 source → target으로 이동하는 오버레이 애니메이션.
 * - clone: 소스에서 분열, 목표로 달려가는 느낌 (springy easing)
 * - jump:  포물선 호를 그리며 날아감 (arc + scale-up at apex)
 */
function animatePieceMove(fr, fc, tr, tc, who, type) {
  return new Promise(resolve => {
    const fromCell = getCellEl(fr, fc);
    const toCell   = getCellEl(tr, tc);
    const fromRect = fromCell.getBoundingClientRect();
    const toRect   = toCell.getBoundingClientRect();
    const dx = toRect.left - fromRect.left;
    const dy = toRect.top  - fromRect.top;
    const duration = type === 'jump' ? ANIM_JUMP_MS : ANIM_CLONE_MS;
    const isPlayer = who === PLAYER;

    // 점프: 소스 조각 흐리게
    if (type === 'jump') {
      fromCell.classList.add('piece-departing');
    }

    // 날아다니는 오버레이 조각 생성
    const piece = document.createElement('div');
    piece.className = `anim-flying-piece ${isPlayer ? 'player' : 'ai'}`;
    piece.style.width  = `${fromRect.width}px`;
    piece.style.height = `${fromRect.height}px`;
    piece.style.left   = `${fromRect.left}px`;
    piece.style.top    = `${fromRect.top}px`;
    piece.style.fontSize = `${fromRect.height * 0.48}px`;
    piece.textContent = isPlayer ? '🔵' : '🔴';
    document.body.appendChild(piece);

    // 키프레임 정의
    let keyframes;
    if (type === 'jump') {
      // 포물선: 중간 지점에서 위로 뜨고 scale 커짐
      const arcHeight = Math.max(28, Math.sqrt(dx*dx + dy*dy) * 0.35);
      keyframes = [
        { transform: 'translate(0,0) scale(1)',                                    offset: 0    },
        { transform: `translate(${dx*.5}px,${dy*.5-arcHeight}px) scale(1.35)`,    offset: 0.45 },
        { transform: `translate(${dx}px,${dy}px) scale(1)`,                       offset: 1    },
      ];
    } else {
      // 클론: 소스에서 분열하듯 목표로 이동 (약간 springy)
      keyframes = [
        { transform: 'translate(0,0) scale(0.7)',       opacity: 0.5, offset: 0    },
        { transform: `translate(${dx*.55}px,${dy*.55}px) scale(1.2)`, opacity: 1,   offset: 0.65 },
        { transform: `translate(${dx}px,${dy}px) scale(1)`,           opacity: 1,   offset: 1    },
      ];
    }

    const anim = piece.animate(keyframes, {
      duration,
      easing: type === 'jump'
        ? 'cubic-bezier(0.4, 0, 0.2, 1)'          // 부드러운 포물선
        : 'cubic-bezier(0.34, 1.56, 0.64, 1)',    // springy 분열
      fill: 'forwards',
    });

    anim.onfinish = () => {
      piece.remove();
      if (type === 'jump') fromCell.classList.remove('piece-departing');
      resolve();
    };
  });
}

/**
 * 감염 애니메이션: 착지 위치에서 파동처럼 순차적으로 번집니다.
 */
function infectAnimation(positions) {
  return new Promise(resolve => {
    if (!positions.length) { resolve(); return; }

    // 감염 순서: 착지 셀 기준으로 가까운 순서로 정렬 (파동 효과)
    positions.forEach(({ r, c }, i) => {
      setTimeout(() => {
        const cell = getCellEl(r, c);
        cell.classList.remove('infect-anim');
        void cell.offsetWidth; // reflow
        cell.classList.add('infect-anim');
        setTimeout(() => cell.classList.remove('infect-anim'), ANIM_INFECT_MS);
      }, i * ANIM_STAGGER);
    });

    setTimeout(resolve, positions.length * ANIM_STAGGER + ANIM_INFECT_MS);
  });
}

// ── UI 상태 ──────────────────────────────────────────────────────────
const state = {
  board: null,
  selected: null,
  validMoves: [],
  turn: PLAYER,
  running: false,
  finished: false,
};

const boardEl       = document.getElementById('board');
const statusEl      = document.getElementById('statusMsg');
const playerScoreEl = document.getElementById('playerScore');
const aiScoreEl     = document.getElementById('aiScore');
const startBtn      = document.getElementById('startBtn');
const restartBtn    = document.getElementById('restartBtn');

function renderBoard() {
  const validSet = new Set(state.validMoves.map(m => `${m.tr},${m.tc}`));
  const selKey   = state.selected ? `${state.selected.r},${state.selected.c}` : null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = getCellEl(r, c);
      const val  = state.board[r][c];
      cell.className = 'cell ' + ['empty','player','ai','obstacle'][val];
      if (selKey === `${r},${c}`) cell.classList.add('selected');
      if (validSet.has(`${r},${c}`)) cell.classList.add('valid');
    }
  }
  const { player, ai } = countPieces(state.board);
  playerScoreEl.textContent = player;
  aiScoreEl.textContent     = ai;
}

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    }
}

function setStatus(msg) { statusEl.textContent = msg; }

function lockBoard()   { boardEl.classList.add('board-locked'); }
function unlockBoard() { boardEl.classList.remove('board-locked'); }

function countBlocks(board) {
  let n = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === BLOCK) n++;
  return n;
}

function endGame() {
  state.running  = false;
  state.finished = true;
  state.selected = null;
  state.validMoves = [];
  renderBoard();
  const { player, ai } = countPieces(state.board);
  let msg = player > ai ? `승리! 🎉 ${player} : ${ai}`
          : ai > player ? `패배 😞 ${player} : ${ai}`
          : `무승부 🤝 ${player} : ${ai}`;
  setStatus(msg);
  showResultBanner(player, `${player}칸`);
  addRecord(player);
}

// ── 이동 실행 (애니메이션 포함) ──────────────────────────────────────
async function executeMove(move, who) {
  isAnimating = true;
  lockBoard();

  // 1. 이동 애니메이션
  await animatePieceMove(move.fr, move.fc, move.tr, move.tc, who, move.type);

  // 2. 보드 상태 업데이트
  const prev   = state.board;
  state.board  = applyMove(state.board, move, who);
  const infected = getInfectedCells(prev, state.board, who);

  // 감염 칸을 먼저 기준 위치(착지 셀)에서 가까운 순으로 정렬 → 파동 효과
  if (infected.length > 1) {
    infected.sort((a, b) => {
      const da = Math.abs(a.r - move.tr) + Math.abs(a.c - move.tc);
      const db = Math.abs(b.r - move.tr) + Math.abs(b.c - move.tc);
      return da - db;
    });
  }

  // 3. 보드 렌더링 (착지 포함)
  state.selected   = null;
  state.validMoves = [];
  renderBoard();

  // 4. 감염 파동 애니메이션 (await → 완전히 끝나고 다음 턴)
  if (infected.length) await infectAnimation(infected);

  isAnimating = false;
  unlockBoard();
}

// ── AI 턴 ─────────────────────────────────────────────────────────────
async function doAiMove() {
  if (!state.running || state.turn !== AI) return;
  setStatus('AI 생각 중…');
  lockBoard();

  // 미니맥스 계산 (짧은 비동기 지연으로 UI 업데이트 허용)
  await new Promise(r => setTimeout(r, 40));
  const result = minimax(state.board, AI_DEPTH, -Infinity, Infinity, true);

  if (!result.move) {
    unlockBoard();
    const playerMoves = getMoves(state.board, PLAYER);
    if (!playerMoves.length) { endGame(); return; }
    state.turn = PLAYER;
    setStatus('당신의 차례');
    return;
  }

  setStatus('AI 이동 중…');
  await executeMove(result.move, AI);

  if (isGameOver(state.board)) { endGame(); return; }

  const playerMoves = getMoves(state.board, PLAYER);
  if (!playerMoves.length) {
    setStatus('이동 가능한 칸이 없어요. AI가 한 번 더 이동합니다.');
    state.turn = AI;
    setTimeout(doAiMove, 500);
  } else {
    state.turn = PLAYER;
    setStatus('당신의 차례');
  }
}

// ── 플레이어 클릭 핸들러 ─────────────────────────────────────────────
async function onCellClick(e) {
  if (!state.running || state.turn !== PLAYER || state.finished || isAnimating) return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;

  // 이동 가능 칸 클릭 → 이동 실행
  const targetMove = state.validMoves.find(m => m.tr === r && m.tc === c);
  if (targetMove) {
    await executeMove(targetMove, PLAYER);
    if (isGameOver(state.board)) { endGame(); return; }

    const aiMoves = getMoves(state.board, AI);
    if (!aiMoves.length) {
      const playerMoves = getMoves(state.board, PLAYER);
      if (!playerMoves.length) { endGame(); return; }
      setStatus('AI 이동 불가. 한 번 더 이동하세요.');
    } else {
      state.turn = AI;
      setTimeout(doAiMove, 300);
    }
    return;
  }

  // 내 조각 선택
  if (state.board[r][c] === PLAYER) {
    state.selected   = { r, c };
    const allMoves   = getMoves(state.board, PLAYER);
    state.validMoves = allMoves.filter(m => m.fr === r && m.fc === c);
    renderBoard();
    setStatus(state.validMoves.length ? '이동할 칸을 선택하세요' : '이동 가능한 칸이 없습니다');
    return;
  }

  // 선택 해제
  state.selected   = null;
  state.validMoves = [];
  renderBoard();
  setStatus('당신의 차례');
}

// ── 게임 시작/재시작 ─────────────────────────────────────────────────
function startGame() {
  isAnimating = false;
  state.board      = createBoard(getDailySeed());
  state.selected   = null;
  state.validMoves = [];
  state.turn       = PLAYER;
  state.running    = true;
  state.finished   = false;

  buildBoard();
  renderBoard();
  unlockBoard();
  setStatus('당신의 차례 — 파란 조각을 선택하세요');
  hideResultBanner();
}

// ── 날짜 표시 ────────────────────────────────────────────────────────
document.getElementById('dateLabel').textContent = new Date().toLocaleDateString('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
});

// ── 버튼 이벤트 ──────────────────────────────────────────────────────
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ── 초기화 ───────────────────────────────────────────────────────────
buildBoard();
updateRankUI();
