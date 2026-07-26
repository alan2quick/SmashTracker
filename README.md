# Smash Matchup Tracker

A lightweight PWA for tracking every Super Smash Bros. Ultimate matchup between
two players — the full 76-character roster (Miis removed, echo fighters merged),
76 × 76 = **5,776 unique matchups** per board.

Inspired by the classic "physical matchup board on the basement wall" project.

## Features

- **Multiple boards** — one per opponent/pair, each with its own names, colors, and results
- **Roster options** (edit board → Advanced) — separate any echo pair individually
  (Marth/Lucina, Ryu/Ken, …) and/or add the three Mii Fighters. Combined and
  individual echo results are stored in separate namespaces, so toggling back and
  forth never loses data. Re-combining a pair you've played individually offers to
  merge: a combined win is assigned only where one player won every individual game
  of that matchup; cells already played as the combined fighter always take priority.
- **Zoomable 76×76 grid** — fits fully on screen, pinch/scroll to zoom, drag to pan,
  character icons along the top and left edges
- **Tap any cell** to record a result; already-played matchups show the existing
  winner and can be edited or cleared
- **Matchup randomizer** — rolls the next game, with a toggle to restrict to
  unplayed matchups only
- **Score & progress** — running win totals and `played / 5776` counter
- **Offline-first PWA** — installable, all data stored locally (localStorage),
  with JSON export/import for backups
- **Optional public share link** — publish a board to a read-only URL that
  updates live as you record games (see below). Off by default; the app is
  fully local until you set it up.

## Running it

Any static file server works. From this folder:

```
python -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080. To install as an app (Add to Home Screen /
Install), serve it over HTTPS or localhost.

## Publishing a board (optional)

Publishing mirrors one board to a Firebase Realtime Database so anyone with the
link can watch it fill in live. Your device is the only writer; viewers get a
read-only page with no way to record or change anything.

**One-time setup, about five minutes:**

1. At [console.firebase.google.com](https://console.firebase.google.com) create
   a project (Google Analytics is not needed).
2. **Build → Realtime Database → Create Database.** Pick any region and start in
   locked mode.
3. On the database's **Rules** tab, paste this and publish:

   ```json
   {
     "rules": {
       "boards": {
         "$board": {
           ".read": true,
           ".write": "auth != null && (!data.exists() ? newData.child('owner').val() === auth.uid : data.child('owner').val() === auth.uid)",
           "owner": { ".validate": "newData.isString()" }
         }
       }
     }
   }
   ```

   Published boards are readable by anyone with the link; only the device that
   created a board can write to it.
4. **Build → Authentication → Sign-in method → Anonymous → Enable.** This is how
   your device proves it owns the board; you never create an account or sign in.
5. **Project settings → General → Your apps → Web (`</>`).** Register an app and
   copy the `firebaseConfig` object into `firebase-config.js`, replacing
   `const FIREBASE_CONFIG = null;`.

Commit and deploy. The link button (🔗) on each board card now offers **Publish
board**, which gives you a URL like `.../SmashTracker/?b=k4m9xq2vt`. Share it and
results appear on the viewer's screen as you record them. **Unpublish** takes it
offline immediately.

Notes and caveats:

- The values in `firebase-config.js` are not secrets — Firebase web configs are
  meant to ship in client code, and the rules above are what actually protect
  your data. They are safe to commit to a public repo.
- Anything published is genuinely public to anyone holding the link, including
  the player names. The board id is random and unguessable, but it is not a
  password.
- Write access is tied to the anonymous sign-in stored on the device that
  published. If you clear that device's site data, you can no longer update that
  board — unpublish and publish again to get a fresh link.
- Free-tier limits (roughly 1 GB stored, 10 GB/month transferred, 100 concurrent
  viewers at the time of writing) are far beyond what a board like this uses; a
  full 5,776-result board is only a few hundred KB.
- Recording while offline is fine — the Firebase SDK queues the writes and syncs
  them when you reconnect.

## Grid semantics

Rows = Player 1's character, columns = Player 2's character. A cell is colored
with the winner's color. The diagonal (mirror matches) is included — that's how
you get to 5,776 on the default roster (76² grows if you separate echoes or add
Miis).
