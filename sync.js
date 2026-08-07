"use strict";

// Publishing layer: mirrors a board to Firebase Realtime Database so it can
// be watched live from a public read-only link. Entirely optional — with no
// firebase-config.js values the app stays local-only and every call here is
// a no-op.
const Sync = (() => {
  let app = null;
  let db = null;
  let uid = null;

  const configured = () =>
    typeof FIREBASE_CONFIG === "object" &&
    FIREBASE_CONFIG !== null &&
    typeof firebase !== "undefined";

  function init() {
    if (!configured()) return false;
    if (!app) {
      app = firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.database();
    }
    return true;
  }

  // Anonymous sign-in identifies this device as the board owner; the database
  // rules only accept writes from the uid stored on the board.
  function signIn() {
    return new Promise((resolve, reject) => {
      if (uid) return resolve(uid);
      if (!init()) return reject(new Error("Publishing is not configured"));
      const auth = firebase.auth();
      const stop = auth.onAuthStateChanged((user) => {
        stop();
        if (user) {
          uid = user.uid;
          resolve(uid);
        } else {
          auth.signInAnonymously().then(
            (cred) => { uid = cred.user.uid; resolve(uid); },
            reject
          );
        }
      }, reject);
    });
  }

  const boardRef = (id) => db.ref("boards/" + id);
  const isPublished = (board) => !!(board.published && board.published.id);

  const metaOf = (board) => ({
    name: board.name,
    p1: board.p1,
    p2: board.p2,
    roster: board.roster,
    updated: Date.now(),
  });

  function newId() {
    const a = new Uint8Array(9);
    crypto.getRandomValues(a);
    return [...a].map((n) => "abcdefghijkmnpqrstuvwxyz23456789"[n % 32]).join("");
  }

  // Create (or overwrite) the public copy of a board.
  async function publish(board) {
    const owner = await signIn();
    const id = isPublished(board) ? board.published.id : newId();
    await boardRef(id).set({
      owner,
      meta: metaOf(board),
      results: board.results,
    });
    return id;
  }

  async function unpublish(board) {
    if (!isPublished(board)) return;
    await signIn();
    await boardRef(board.published.id).remove();
  }

  // Single result written, changed, or cleared.
  function pushResult(board, key, value) {
    if (!isPublished(board) || !init()) return;
    const base = boardRef(board.published.id);
    const write = value
      ? base.child("results").child(key).set(value)
      : base.child("results").child(key).remove();
    write.catch(reportError);
    base.child("meta/updated").set(Date.now()).catch(reportError);
  }

  // Name, colors or roster changed.
  function pushMeta(board) {
    if (!isPublished(board) || !init()) return;
    boardRef(board.published.id).child("meta").set(metaOf(board)).catch(reportError);
  }

  // Bulk change (echo merge) — cheaper and safer than diffing.
  function pushResults(board) {
    if (!isPublished(board) || !init()) return;
    boardRef(board.published.id).child("results").set(board.results).catch(reportError);
  }

  let lastError = null;

  function reportError(err) {
    lastError = (err && err.message) || String(err);
    console.warn("[sync] write failed:", lastError);
  }

  // Can this device still update the published copy? Writes are rejected
  // silently by the rules if the anonymous session that created the board
  // is gone (cleared site data, or storage evicted by the browser), so the
  // share dialog checks this rather than pretending everything is fine.
  async function status(board) {
    if (!configured()) return { state: "unconfigured" };
    if (!isPublished(board)) return { state: "unpublished" };
    try {
      const me = await signIn();
      const snap = await boardRef(board.published.id).child("owner").once("value");
      if (!snap.exists()) return { state: "missing" };
      if (snap.val() !== me) return { state: "not-owner" };
      return { state: "ok", lastError };
    } catch (err) {
      return { state: "error", message: err && err.message };
    }
  }

  // Read-only live subscription used by the viewer. No sign-in needed: the
  // rules make published boards world-readable.
  function subscribe(id, handlers) {
    if (!init()) {
      handlers.onUnavailable();
      return () => {};
    }
    const base = boardRef(id);
    const results = base.child("results");
    const onMeta = (snap) =>
      snap.exists() ? handlers.onMeta(snap.val()) : handlers.onMissing();
    const added = (s) => handlers.onResult(s.key, s.val());
    const changed = (s) => handlers.onResult(s.key, s.val());
    const removed = (s) => handlers.onResult(s.key, null);

    base.child("meta").on("value", onMeta, handlers.onMissing);
    results.on("child_added", added);
    results.on("child_changed", changed);
    results.on("child_removed", removed);
    base.child("meta/updated").on("value", () => handlers.onSynced && handlers.onSynced());

    return () => {
      base.child("meta").off("value", onMeta);
      results.off("child_added", added);
      results.off("child_changed", changed);
      results.off("child_removed", removed);
    };
  }

  return { configured, signIn, status, publish, unpublish, pushResult, pushMeta, pushResults, subscribe, isPublished };
})();
