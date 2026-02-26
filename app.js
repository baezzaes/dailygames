const LS_KEY = "mini-rank-sample:v1";

const startBtn = document.getElementById("startBtn");
const tapBtn = document.getElementById("tapBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

const timeLeftEl = document.getElementById("timeLeft");
const scoreEl = document.getElementById("score");
const nameInput = document.getElementById("nameInput");
const rankList = document.getElementById("rankList");

let running = false;
let score = 0;
let endAt = 0;
let rafId = null;

function now() { return performance.now(); }

function loadRank() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRank(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

function renderRank() {
  const list = loadRank()
    .sort((a, b) => b.score - a.score || b.ts - a.ts)
    .slice(0, 10);

  rankList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="name">아직 기록이 없어</span><span class="meta">—</span>`;
    rankList.appendChild(li);
    return;
  }

  list.forEach((r, idx) => {
    const li = document.createElement("li");
    const date = new Date(r.ts).toLocaleString("ko-KR", { hour12: false });
    li.innerHTML = `
      <span class="name">${idx + 1}. ${escapeHtml(r.name || "anon")}</span>
      <span class="meta">${r.score}점 · ${date}</span>
    `;
    rankList.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function setUIIdle() {
  running = false;
  startBtn.disabled = false;
  tapBtn.disabled = true;
  saveBtn.disabled = score <= 0;
}

function setUIRunning() {
  running = true;
  startBtn.disabled = true;
  tapBtn.disabled = false;
  saveBtn.disabled = true;
}

function startGame() {
  if (running) return;
  score = 0;
  scoreEl.textContent = "0";
  timeLeftEl.textContent = "10.0";
  endAt = now() + 10_000;
  setUIRunning();
  loop();
}

function loop() {
  const leftMs = Math.max(0, endAt - now());
  timeLeftEl.textContent = (leftMs / 1000).toFixed(1);

  if (leftMs <= 0) {
    stopGame();
    return;
  }
  rafId = requestAnimationFrame(loop);
}

function stopGame() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  setUIIdle();
}

function tap() {
  if (!running) return;
  score += 1;
  scoreEl.textContent = String(score);
}

function saveScore() {
  const name = (nameInput.value || "").trim().slice(0, 12);
  if (score <= 0) return;

  const list = loadRank();
  list.push({ name: name || "anon", score, ts: Date.now() });
  saveRank(list);

  renderRank();
  saveBtn.disabled = true;
}

function resetRank() {
  localStorage.removeItem(LS_KEY);
  renderRank();
}

startBtn.addEventListener("click", startGame);
tapBtn.addEventListener("click", tap);
saveBtn.addEventListener("click", saveScore);
resetBtn.addEventListener("click", resetRank);

nameInput.addEventListener("input", () => {
  // 게임 종료 후에만 저장 가능하게
  if (!running) saveBtn.disabled = score <= 0;
});

renderRank();
setUIIdle();