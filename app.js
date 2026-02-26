const $ = (id) => document.getElementById(id);

const nameEl = $("name");
const modeEl = $("mode");
const timeEl = $("time");
const scoreEl = $("score");
const stateEl = $("state");
const bigBtn = $("bigBtn");
const startBtn = $("startBtn");
const resetBtn = $("resetBtn");
const rankTitle = $("rankTitle");
const rankList = $("rankList");

let running = false;
let score = 0;
let endAt = 0;
let rafId = 0;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ISO week (간단 버전)
function weekKey() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

function storageKey(mode) {
  const k = mode === "weekly" ? weekKey() : todayKey();
  return `dailygames:click10:${mode}:${k}`;
}

function getBoard(mode) {
  const raw = localStorage.getItem(storageKey(mode));
  return raw ? JSON.parse(raw) : [];
}

function saveBoard(mode, board) {
  localStorage.setItem(storageKey(mode), JSON.stringify(board));
}

function sanitizeName(s) {
  const t = (s || "").trim().slice(0, 12);
  return t ? t : "anonymous";
}

function updateRankUI() {
  const mode = modeEl.value;
  rankTitle.textContent = mode === "weekly" ? "🏆 이번주 랭킹 TOP 10" : "🏆 오늘 랭킹 TOP 10";
  const board = getBoard(mode).sort((a,b)=>b.score-a.score || a.t-b.t).slice(0,10);

  rankList.innerHTML = "";
  if (board.length === 0) {
    const li = document.createElement("li");
    li.textContent = "아직 기록이 없어요. 1등 해보자!";
    rankList.appendChild(li);
    return;
  }

  board.forEach((r, i) => {
    const li = document.createElement("li");
    const dt = new Date(r.t);
    li.textContent = `${i+1}. ${r.name} — ${r.score}점  (${dt.toLocaleString()})`;
    rankList.appendChild(li);
  });
}

function setState(text) {
  stateEl.textContent = text;
}

function stopGame() {
  running = false;
  bigBtn.disabled = true;
  cancelAnimationFrame(rafId);
  setState("종료");
  timeEl.textContent = "0.0";

  const mode = modeEl.value;
  const name = sanitizeName(nameEl.value);
  const board = getBoard(mode);

  board.push({ name, score, t: Date.now() });
  board.sort((a,b)=>b.score-a.score || a.t-b.t);
  saveBoard(mode, board.slice(0, 50)); // 로컬에 50개까지만

  updateRankUI();
}

function tick() {
  const now = performance.now();
  const left = Math.max(0, (endAt - now) / 1000);
  timeEl.textContent = left.toFixed(1);

  if (left <= 0) {
    stopGame();
    return;
  }
  rafId = requestAnimationFrame(tick);
}

function startGame() {
  if (running) return;
  running = true;
  score = 0;
  scoreEl.textContent = "0";
  setState("진행중");
  bigBtn.disabled = false;
  bigBtn.focus();

  endAt = performance.now() + 10_000;
  rafId = requestAnimationFrame(tick);
}

bigBtn.addEventListener("click", () => {
  if (!running) return;
  score++;
  scoreEl.textContent = String(score);
});

startBtn.addEventListener("click", () => startGame());

resetBtn.addEventListener("click", () => {
  const mode = modeEl.value;
  localStorage.removeItem(storageKey(mode));
  updateRankUI();
  setState("대기");
});

modeEl.addEventListener("change", () => updateRankUI());

setState("대기");
updateRankUI();