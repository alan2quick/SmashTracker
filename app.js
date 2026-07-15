"use strict";

/* ================= Storage ================= */

const STORE_KEY = "smashtracker.v1";

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupted -> start fresh */ }
  return { boards: [] };
}

function saveDB() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

let db = loadDB();
let currentBoard = null;

const $ = (id) => document.getElementById(id);
const muKey = (r, c) => CHARACTERS[r].slug + "|" + CHARACTERS[c].slug;

/* ================= Home view ================= */

function boardStats(board) {
  let p1 = 0, p2 = 0;
  for (const k in board.results) {
    if (board.results[k] === 1) p1++;
    else if (board.results[k] === 2) p2++;
  }
  return { p1, p2, played: p1 + p2 };
}

function renderHome() {
  const list = $("board-list");
  list.innerHTML = "";
  if (db.boards.length === 0) {
    list.innerHTML = '<li class="empty-note">No boards yet. Create one to start tracking!</li>';
    return;
  }
  for (const board of db.boards) {
    const s = boardStats(board);
    const li = document.createElement("li");
    li.className = "board-card";
    li.style.setProperty("--bc-p1", board.p1.color);
    li.style.setProperty("--bc-p2", board.p2.color);
    const pct1 = (s.p1 / TOTAL_MATCHUPS) * 100;
    const pct2 = (s.p2 / TOTAL_MATCHUPS) * 100;
    li.innerHTML = `
      <div class="board-card-main">
        <div class="board-card-name"></div>
        <div class="board-card-score">
          <b class="p1"></b> ${s.p1} &ndash; ${s.p2} <b class="p2"></b>
          &middot; ${s.played.toLocaleString()}/${TOTAL_MATCHUPS.toLocaleString()}
        </div>
        <div class="board-card-bar">
          <div class="fill-p1" style="width:${pct1}%"></div>
          <div class="fill-p2" style="width:${pct2}%"></div>
        </div>
      </div>
      <div class="board-card-actions">
        <button class="icon-btn edit-btn" aria-label="Edit board">&#9998;</button>
        <button class="icon-btn delete-btn" aria-label="Delete board">&#128465;</button>
      </div>`;
    li.querySelector(".board-card-name").textContent = board.name;
    li.querySelector(".board-card-score .p1").textContent = board.p1.name;
    li.querySelector(".board-card-score .p2").textContent = board.p2.name;
    li.addEventListener("click", (e) => {
      if (e.target.closest(".board-card-actions")) return;
      openBoard(board);
    });
    li.querySelector(".edit-btn").addEventListener("click", () => openBoardForm(board));
    li.querySelector(".delete-btn").addEventListener("click", () => {
      if (confirm(`Delete board "${board.name}"? This can't be undone.`)) {
        db.boards = db.boards.filter((b) => b.id !== board.id);
        saveDB();
        renderHome();
      }
    });
    list.appendChild(li);
  }
}

/* ================= Board create / edit ================= */

let editingBoard = null;

function openBoardForm(board) {
  editingBoard = board || null;
  $("board-modal-title").textContent = board ? "Edit board" : "New board";
  $("bf-save").textContent = board ? "Save" : "Create";
  $("bf-name").value = board ? board.name : "";
  $("bf-p1-name").value = board ? board.p1.name : "";
  $("bf-p2-name").value = board ? board.p2.name : "";
  $("bf-p1-color").value = board ? board.p1.color : "#3b82f6";
  $("bf-p2-color").value = board ? board.p2.color : "#ef4444";
  $("board-modal").showModal();
}

$("board-form").addEventListener("submit", () => {
  const data = {
    name: $("bf-name").value.trim(),
    p1: { name: $("bf-p1-name").value.trim(), color: $("bf-p1-color").value },
    p2: { name: $("bf-p2-name").value.trim(), color: $("bf-p2-color").value },
  };
  if (editingBoard) {
    Object.assign(editingBoard, data);
  } else {
    db.boards.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: new Date().toISOString(),
      results: {},
      unplayedOnly: true,
      ...data,
    });
  }
  saveDB();
  renderHome();
});

$("bf-cancel").addEventListener("click", () => $("board-modal").close());
$("new-board-btn").addEventListener("click", () => openBoardForm(null));

/* ================= Export / import ================= */

$("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `smashtracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import-btn").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.boards)) throw new Error("bad format");
    if (!confirm(`Import ${data.boards.length} board(s)? They will be added alongside existing boards.`)) return;
    for (const b of data.boards) {
      if (db.boards.some((x) => x.id === b.id)) b.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      db.boards.push(b);
    }
    saveDB();
    renderHome();
  } catch {
    alert("Couldn't read that file — expected a Smash Tracker backup JSON.");
  }
  e.target.value = "";
});

/* ================= Grid ================= */

const viewport = $("grid-viewport");
const canvas = $("grid-canvas");
let cellEls = null; // 2D lookup: cellEls[r][c]
let view = { scale: 1, tx: 0, ty: 0, minScale: 0.1, maxScale: 10 };
const CELL = 14; // cell pitch: 13px track + 1px gap (see --cell in CSS)
const GRID_PX = (N + 1) * CELL + 3; // padding minus trailing gap

function buildGrid() {
  canvas.style.gridTemplateColumns = `repeat(${N + 1}, ${CELL - 1}px)`;
  canvas.innerHTML = "";
  const frag = document.createDocumentFragment();
  cellEls = Array.from({ length: N }, () => new Array(N));

  const corner = document.createElement("div");
  corner.className = "gh corner";
  frag.appendChild(corner);

  for (let c = 0; c < N; c++) frag.appendChild(headerIcon(c));

  for (let r = 0; r < N; r++) {
    frag.appendChild(headerIcon(r));
    for (let c = 0; c < N; c++) {
      const cell = document.createElement("div");
      cell.className = "cell" + (r === c ? " diag" : "");
      cell.dataset.r = r;
      cell.dataset.c = c;
      cellEls[r][c] = cell;
      frag.appendChild(cell);
    }
  }
  canvas.appendChild(frag);
}

function headerIcon(i) {
  const d = document.createElement("div");
  d.className = "gh";
  const img = document.createElement("img");
  img.src = `icons/${CHARACTERS[i].slug}.png`;
  img.alt = CHARACTERS[i].name;
  img.title = CHARACTERS[i].name;
  img.draggable = false;
  img.loading = "lazy";
  d.appendChild(img);
  return d;
}

function paintCell(r, c) {
  const w = currentBoard.results[muKey(r, c)];
  const el = cellEls[r][c];
  el.classList.toggle("w1", w === 1);
  el.classList.toggle("w2", w === 2);
}

function paintAllCells() {
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) paintCell(r, c);
}

/* ---------- pan & zoom ---------- */

function applyView() {
  canvas.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
}

function fitBoard(animate) {
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const scale = Math.min(vw / GRID_PX, vh / GRID_PX) * 0.97;
  view.scale = scale;
  view.minScale = scale * 0.5;
  view.tx = (vw - GRID_PX * scale) / 2;
  view.ty = (vh - GRID_PX * scale) / 2;
  if (animate) animateView();
  else applyView();
}

function animateView() {
  canvas.classList.add("animate");
  applyView();
  setTimeout(() => canvas.classList.remove("animate"), 380);
}

function zoomAt(cx, cy, factor) {
  const ns = Math.min(view.maxScale, Math.max(view.minScale, view.scale * factor));
  const k = ns / view.scale;
  view.tx = cx - (cx - view.tx) * k;
  view.ty = cy - (cy - view.ty) * k;
  view.scale = ns;
  applyView();
}

viewport.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
}, { passive: false });

const pointers = new Map();
let moved = 0;
let pinchStart = null;

viewport.addEventListener("pointerdown", (e) => {
  viewport.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  moved = 0;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      scale: view.scale,
    };
  }
});

viewport.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  moved += Math.abs(dx) + Math.abs(dy);

  if (pointers.size === 1) {
    view.tx += dx;
    view.ty += dy;
    applyView();
  } else if (pointers.size === 2) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart && dist > 0) {
      const rect = viewport.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
      const target = pinchStart.scale * (dist / pinchStart.dist);
      zoomAt(mid.x, mid.y, target / view.scale);
    }
    return;
  }
  p.x = e.clientX; p.y = e.clientY;
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
}
viewport.addEventListener("pointerup", (e) => {
  endPointer(e);
  if (moved < 8 && pointers.size === 0) {
    const cell = document.elementFromPoint(e.clientX, e.clientY);
    if (cell && cell.classList.contains("cell")) {
      openMatchup(+cell.dataset.r, +cell.dataset.c, false);
    }
  }
});
viewport.addEventListener("pointercancel", endPointer);

$("zoom-in-btn").addEventListener("click", () =>
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.4));
$("zoom-out-btn").addEventListener("click", () =>
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.4));
$("fit-btn").addEventListener("click", () => fitBoard(true));

function centerOnCell(r, c) {
  const targetScale = Math.max(view.scale, 2.2);
  const x = (CELL * (c + 1) + CELL / 2 + 2) * targetScale;
  const y = (CELL * (r + 1) + CELL / 2 + 2) * targetScale;
  view.scale = targetScale;
  view.tx = viewport.clientWidth / 2 - x;
  view.ty = viewport.clientHeight / 2 - y;
  animateView();
}

/* ================= Board view ================= */

function openBoard(board) {
  currentBoard = board;
  document.documentElement.style.setProperty("--p1-color", board.p1.color);
  document.documentElement.style.setProperty("--p2-color", board.p2.color);
  $("board-name").textContent = board.name;
  $("score-p1-name").textContent = board.p1.name;
  $("score-p2-name").textContent = board.p2.name;
  $("unplayed-only").checked = board.unplayedOnly !== false;
  if (!cellEls) buildGrid();
  paintAllCells();
  updateScore();
  $("home-view").hidden = true;
  $("board-view").hidden = false;
  fitBoard(false);
}

$("back-btn").addEventListener("click", () => {
  clearHighlight();
  $("board-view").hidden = true;
  $("home-view").hidden = false;
  renderHome();
});

function updateScore() {
  const s = boardStats(currentBoard);
  $("score-p1").textContent = s.p1;
  $("score-p2").textContent = s.p2;
  $("board-progress").textContent =
    `${s.played.toLocaleString()} / ${TOTAL_MATCHUPS.toLocaleString()} played`;
}

$("unplayed-only").addEventListener("change", (e) => {
  currentBoard.unplayedOnly = e.target.checked;
  saveDB();
});

/* ================= Matchup modal ================= */

const modal = $("matchup-modal");
let currentMU = null; // { r, c, fromRandom }
let highlighted = null;

function clearHighlight() {
  if (highlighted) { highlighted.classList.remove("hl"); highlighted = null; }
}

function highlightCell(r, c) {
  clearHighlight();
  highlighted = cellEls[r][c];
  highlighted.classList.add("hl");
}

function openMatchup(r, c, fromRandom) {
  currentMU = { r, c, fromRandom };
  const b = currentBoard;
  $("mu-p1-img").src = `icons/${CHARACTERS[r].slug}.png`;
  $("mu-p2-img").src = `icons/${CHARACTERS[c].slug}.png`;
  $("mu-p1-char").textContent = CHARACTERS[r].name;
  $("mu-p2-char").textContent = CHARACTERS[c].name;
  $("mu-p1-player").textContent = b.p1.name;
  $("mu-p2-player").textContent = b.p2.name;
  $("mu-win-p1").textContent = `${b.p1.name} won`;
  $("mu-win-p2").textContent = `${b.p2.name} won`;
  $("mu-reroll").hidden = !fromRandom;

  const w = b.results[muKey(r, c)];
  const status = $("mu-status");
  if (w === 1) status.innerHTML = `Played &mdash; <b class="p1"></b> won`;
  else if (w === 2) status.innerHTML = `Played &mdash; <b class="p2"></b> won`;
  else status.textContent = "Not played yet";
  const bEl = status.querySelector("b");
  if (bEl) bEl.textContent = w === 1 ? b.p1.name : b.p2.name;
  $("mu-clear").hidden = !w;
  $("mu-win-p1").classList.toggle("held", w === 1);
  $("mu-win-p2").classList.toggle("held", w === 2);

  highlightCell(r, c);
  if (fromRandom) centerOnCell(r, c);
  if (!modal.open) modal.showModal();
}

function setResult(winner) {
  const { r, c } = currentMU;
  if (winner) currentBoard.results[muKey(r, c)] = winner;
  else delete currentBoard.results[muKey(r, c)];
  saveDB();
  paintCell(r, c);
  updateScore();
  modal.close();
}

$("mu-win-p1").addEventListener("click", () => setResult(1));
$("mu-win-p2").addEventListener("click", () => setResult(2));
$("mu-clear").addEventListener("click", () => setResult(0));
$("mu-close").addEventListener("click", () => modal.close());
modal.addEventListener("close", clearHighlight);

/* ================= Randomizer ================= */

$("randomize-btn").addEventListener("click", rollMatchup);
$("mu-reroll").addEventListener("click", rollMatchup);

function rollMatchup() {
  const unplayedOnly = $("unplayed-only").checked;
  let r, c;
  if (unplayedOnly) {
    const played = currentBoard.results;
    const remaining = TOTAL_MATCHUPS - Object.keys(played).length;
    if (remaining <= 0) {
      alert("All 5,776 matchups have been played. Incredible!");
      return;
    }
    // rejection sampling is fast until the board is nearly complete
    if (remaining > TOTAL_MATCHUPS / 200) {
      do {
        r = Math.floor(Math.random() * N);
        c = Math.floor(Math.random() * N);
      } while (played[muKey(r, c)]);
    } else {
      const open = [];
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++)
          if (!played[muKey(i, j)]) open.push([i, j]);
      [r, c] = open[Math.floor(Math.random() * open.length)];
    }
  } else {
    r = Math.floor(Math.random() * N);
    c = Math.floor(Math.random() * N);
  }
  openMatchup(r, c, true);
}

/* ================= Init ================= */

renderHome();

window.addEventListener("resize", () => {
  if (!$("board-view").hidden) fitBoard(false);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
