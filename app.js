"use strict";

/* ================= Storage ================= */

const STORE_KEY = "smashtracker.v1";

function loadDB() {
  let data = { boards: [] };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (e) { /* corrupted -> start fresh */ }
  data.boards.forEach(migrateBoard);
  return data;
}

// Boards created before roster options existed store combined-echo results
// under the base slug ("marth|fox"); move them to the combined namespace
// ("marth+lucina|fox") and attach the default roster config.
function migrateBoard(board) {
  if (board.roster) return;
  board.roster = { separated: [], miis: false };
  const map = {};
  for (const ch of ECHO_PAIRS) map[ch.slug] = combinedSlug(ch);
  const migrated = {};
  for (const k in board.results) {
    const [r, c] = k.split("|");
    migrated[(map[r] || r) + "|" + (map[c] || c)] = board.results[k];
  }
  board.results = migrated;
}

function saveDB() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

let db = loadDB();
let currentBoard = null;

const $ = (id) => document.getElementById(id);

/* ================= Active roster ================= */

// Roster of the currently open board. Results are keyed by roster slugs, so
// only cells of the active roster count anywhere; results for hidden
// fighters (combined pairs, separated echoes, disabled Miis) stay saved.
let ROSTER = [];
let N = 0;
let TOTAL = 0;

function setActiveRoster(board) {
  ROSTER = buildRoster(board.roster);
  N = ROSTER.length;
  TOTAL = N * N;
}

const muKey = (r, c) => ROSTER[r].slug + "|" + ROSTER[c].slug;

/* ================= Home view ================= */

function boardStats(board) {
  const roster = buildRoster(board.roster);
  let p1 = 0, p2 = 0;
  for (const a of roster) {
    for (const b of roster) {
      const v = board.results[a.slug + "|" + b.slug];
      if (v === 1) p1++;
      else if (v === 2) p2++;
    }
  }
  return { p1, p2, played: p1 + p2, total: roster.length * roster.length };
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
    const pct1 = (s.p1 / s.total) * 100;
    const pct2 = (s.p2 / s.total) * 100;
    li.innerHTML = `
      <div class="board-card-main">
        <div class="board-card-name"></div>
        <div class="board-card-score">
          <b class="p1"></b> ${s.p1} &ndash; ${s.p2} <b class="p2"></b>
          &middot; ${s.played.toLocaleString()}/${s.total.toLocaleString()}
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

// Build the per-pair "separate echoes" checkboxes once.
(function buildPairToggles() {
  const wrap = $("bf-pairs");
  for (const ch of ECHO_PAIRS) {
    const label = document.createElement("label");
    label.className = "adv-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.pair = ch.slug;
    label.appendChild(input);
    label.appendChild(document.createTextNode(` Separate ${ch.name} & ${ch.echo.name}`));
    wrap.appendChild(label);
  }
})();

function openBoardForm(board) {
  editingBoard = board || null;
  $("board-modal-title").textContent = board ? "Edit board" : "New board";
  $("bf-save").textContent = board ? "Save" : "Create";
  $("bf-name").value = board ? board.name : "";
  $("bf-p1-name").value = board ? board.p1.name : "";
  $("bf-p2-name").value = board ? board.p2.name : "";
  $("bf-p1-color").value = board ? board.p1.color : "#3b82f6";
  $("bf-p2-color").value = board ? board.p2.color : "#ef4444";
  const cfg = board ? board.roster : { separated: [], miis: false };
  $("bf-miis").checked = !!cfg.miis;
  const sep = new Set(cfg.separated || []);
  $("bf-pairs").querySelectorAll("input").forEach((i) => {
    i.checked = sep.has(i.dataset.pair);
  });
  $("bf-advanced").open = false;
  $("board-modal").showModal();
}

function formRosterConfig() {
  const separated = [...$("bf-pairs").querySelectorAll("input:checked")]
    .map((i) => i.dataset.pair);
  return { separated, miis: $("bf-miis").checked };
}

// Does this board have any individually-played echo results for the pair?
function hasSeparateResults(board, ch) {
  const slugs = new Set([ch.slug, ch.echo.slug]);
  for (const k in board.results) {
    const [r, c] = k.split("|");
    if (slugs.has(r) || slugs.has(c)) return true;
  }
  return false;
}

// Fill combined-namespace cells from individual echo results. Saved combined
// results always win; otherwise a winner is assigned only when every played
// constituent game (1-0, 2-0, ...) went to the same player.
function mergeEchoResults(board, pairs, newConfig) {
  const roster = buildRoster(newConfig);
  const res = board.results;
  const reps = (slug) => {
    const i = slug.indexOf("+");
    return i < 0 ? [slug] : [slug, slug.slice(0, i), slug.slice(i + 1)];
  };
  for (const ch of pairs) {
    const combined = combinedSlug(ch);
    for (const opp of roster) {
      for (const [A, B] of [[combined, opp.slug], [opp.slug, combined]]) {
        const target = A + "|" + B;
        if (res[target]) continue;
        let w1 = 0, w2 = 0;
        for (const a of reps(A)) {
          for (const b of reps(B)) {
            const k = a + "|" + b;
            if (k === target) continue;
            const v = res[k];
            if (v === 1) w1++;
            else if (v === 2) w2++;
          }
        }
        if (w1 > 0 && w2 === 0) res[target] = 1;
        else if (w2 > 0 && w1 === 0) res[target] = 2;
      }
    }
  }
}

let pendingSave = null; // { data, newConfig, affected }

function applyBoardSave(data, newConfig) {
  if (editingBoard) {
    Object.assign(editingBoard, data);
    editingBoard.roster = newConfig;
  } else {
    db.boards.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: new Date().toISOString(),
      results: {},
      unplayedOnly: true,
      roster: newConfig,
      ...data,
    });
  }
  saveDB();
  renderHome();
  $("board-modal").close();
}

$("board-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {
    name: $("bf-name").value.trim(),
    p1: { name: $("bf-p1-name").value.trim(), color: $("bf-p1-color").value },
    p2: { name: $("bf-p2-name").value.trim(), color: $("bf-p2-color").value },
  };
  const newConfig = formRosterConfig();
  if (editingBoard) {
    const oldSep = new Set(editingBoard.roster.separated || []);
    const newSep = new Set(newConfig.separated);
    const affected = ECHO_PAIRS.filter(
      (ch) => oldSep.has(ch.slug) && !newSep.has(ch.slug) && hasSeparateResults(editingBoard, ch)
    );
    if (affected.length) {
      pendingSave = { data, newConfig, affected };
      $("ew-pairs").textContent = affected
        .map((ch) => `${ch.name} & ${ch.echo.name}`)
        .join(", ");
      $("echo-warning").showModal();
      return;
    }
  }
  applyBoardSave(data, newConfig);
});

$("ew-cancel").addEventListener("click", () => {
  pendingSave = null;
  $("echo-warning").close();
});
$("ew-blank").addEventListener("click", () => {
  const { data, newConfig } = pendingSave;
  pendingSave = null;
  $("echo-warning").close();
  applyBoardSave(data, newConfig);
});
$("ew-merge").addEventListener("click", () => {
  const { data, newConfig, affected } = pendingSave;
  pendingSave = null;
  $("echo-warning").close();
  mergeEchoResults(editingBoard, affected, newConfig);
  applyBoardSave(data, newConfig);
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
      migrateBoard(b);
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
let gridPx = 0; // board size in px; depends on roster size
let gridSig = ""; // roster signature the current grid was built for

function buildGrid() {
  gridPx = (N + 1) * CELL + 3; // padding minus trailing gap
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
  img.src = `icons/${ROSTER[i].icon}.png`;
  img.alt = ROSTER[i].name;
  img.title = ROSTER[i].name;
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
  const scale = Math.min(vw / gridPx, vh / gridPx) * 0.97;
  view.scale = scale;
  view.minScale = scale * 0.5;
  view.tx = (vw - gridPx * scale) / 2;
  view.ty = (vh - gridPx * scale) / 2;
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
  setActiveRoster(board);
  document.documentElement.style.setProperty("--p1-color", board.p1.color);
  document.documentElement.style.setProperty("--p2-color", board.p2.color);
  $("board-name").textContent = board.name;
  $("score-p1-name").textContent = board.p1.name;
  $("score-p2-name").textContent = board.p2.name;
  $("unplayed-only").checked = board.unplayedOnly !== false;
  const sig = ROSTER.map((e) => e.slug).join(",");
  if (sig !== gridSig) {
    buildGrid();
    buildPickerList();
    gridSig = sig;
  }
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
    `${s.played.toLocaleString()} / ${TOTAL.toLocaleString()} played`;
}

$("unplayed-only").addEventListener("change", (e) => {
  currentBoard.unplayedOnly = e.target.checked;
  saveDB();
});

/* ================= Matchup modal ================= */

// A player's overall record with one character: for P1 that character's
// row (results where P1 played it), for P2 its column.
function charRecord(side, i) {
  const res = currentBoard.results;
  let w = 0, l = 0;
  for (let j = 0; j < N; j++) {
    const v = side === "p1" ? res[muKey(i, j)] : res[muKey(j, i)];
    if (!v) continue;
    const won = side === "p1" ? v === 1 : v === 2;
    if (won) w++; else l++;
  }
  return { w, l };
}

const fmtRecord = ({ w, l }) => `${w}W – ${l}L`;

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
  $("mu-p1-img").src = `icons/${ROSTER[r].icon}.png`;
  $("mu-p2-img").src = `icons/${ROSTER[c].icon}.png`;
  $("mu-p1-char").textContent = ROSTER[r].name;
  $("mu-p2-char").textContent = ROSTER[c].name;
  $("mu-p1-player").textContent = b.p1.name;
  $("mu-p2-player").textContent = b.p2.name;
  $("mu-win-p1").textContent = `${b.p1.name} won`;
  $("mu-win-p2").textContent = `${b.p2.name} won`;
  $("mu-p1-record").textContent = fmtRecord(charRecord("p1", r));
  $("mu-p2-record").textContent = fmtRecord(charRecord("p2", c));
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

/* ================= Character picker ================= */

const picker = $("char-picker");
const cpSearch = $("cp-search");
const cpList = $("cp-list");
let pickerSide = null; // "p1" | "p2"

const normalize = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function buildPickerList() {
  cpList.innerHTML = "";
  const frag = document.createDocumentFragment();
  ROSTER.forEach((ch, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.i = i;
    const img = document.createElement("img");
    img.src = `icons/${ch.icon}.png`;
    img.alt = "";
    img.loading = "lazy";
    btn.appendChild(img);
    const name = document.createElement("span");
    name.className = "cp-name";
    name.textContent = ch.name;
    btn.appendChild(name);
    const rec = document.createElement("span");
    rec.className = "cp-rec";
    btn.appendChild(rec);
    li.appendChild(btn);
    frag.appendChild(li);
  });
  cpList.appendChild(frag);
}

function openPicker(side) {
  pickerSide = side;
  const currentIdx = side === "p1" ? currentMU.r : currentMU.c;
  cpSearch.value = "";
  filterPicker("");
  cpList.querySelectorAll("button").forEach((b) => {
    const i = +b.dataset.i;
    b.classList.toggle("current", i === currentIdx);
    b.querySelector(".cp-rec").textContent = fmtRecord(charRecord(side, i));
  });
  picker.showModal();
  const cur = cpList.querySelector("button.current");
  if (cur) cur.scrollIntoView({ block: "center" });
  cpSearch.focus();
}

function filterPicker(query) {
  const q = normalize(query.trim());
  cpList.querySelectorAll("button").forEach((b) => {
    const ch = ROSTER[+b.dataset.i];
    b.parentElement.hidden = q !== "" && !normalize(ch.name).includes(q);
  });
}

function pickCharacter(i) {
  picker.close();
  const { r, c, fromRandom } = currentMU;
  if (pickerSide === "p1") openMatchup(i, c, fromRandom);
  else openMatchup(r, i, fromRandom);
}

$("mu-p1-pick").addEventListener("click", () => openPicker("p1"));
$("mu-p2-pick").addEventListener("click", () => openPicker("p2"));
cpSearch.addEventListener("input", () => filterPicker(cpSearch.value));
cpSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const first = cpList.querySelector("li:not([hidden]) button");
    if (first) pickCharacter(+first.dataset.i);
  }
});
cpList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-i]");
  if (btn) pickCharacter(+btn.dataset.i);
});

/* ================= Randomizer ================= */

$("randomize-btn").addEventListener("click", rollMatchup);
$("mu-reroll").addEventListener("click", rollMatchup);

function rollMatchup() {
  const unplayedOnly = $("unplayed-only").checked;
  let r, c;
  if (unplayedOnly) {
    const played = currentBoard.results;
    // count within the active roster only; hidden namespaced results don't count
    const remaining = TOTAL - boardStats(currentBoard).played;
    if (remaining <= 0) {
      alert(`All ${TOTAL.toLocaleString()} matchups have been played. Incredible!`);
      return;
    }
    // rejection sampling is fast until the board is nearly complete
    if (remaining > TOTAL / 200) {
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
