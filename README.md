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

## Running it

Any static file server works. From this folder:

```
python -m http.server 8080
# or
npx serve .
```

Then open http://localhost:8080. To install as an app (Add to Home Screen /
Install), serve it over HTTPS or localhost.

## Grid semantics

Rows = Player 1's character, columns = Player 2's character. A cell is colored
with the winner's color. The diagonal (mirror matches) is included — that's how
you get to 5,776 on the default roster (76² grows if you separate echoes or add
Miis).
