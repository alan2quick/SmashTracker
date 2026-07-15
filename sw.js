const CACHE = "smashtracker-v1";

const SLUGS = [
  "mario","donkey_kong","link","samus","yoshi","kirby","fox","pikachu","luigi","ness",
  "captain_falcon","jigglypuff","peach","bowser","ice_climbers","sheik","zelda","dr_mario",
  "pichu","falco","marth","young_link","ganondorf","mewtwo","roy","mr_game_and_watch",
  "meta_knight","pit","zero_suit_samus","wario","snake","ike","pokemon_trainer","diddy_kong",
  "lucas","sonic","king_dedede","olimar","lucario","rob","toon_link","wolf","villager",
  "mega_man","wii_fit_trainer","rosalina_and_luma","little_mac","greninja","palutena",
  "pac_man","robin","shulk","bowser_jr","duck_hunt","ryu","cloud","corrin","bayonetta",
  "inkling","ridley","simon","king_k_rool","isabelle","incineroar","piranha_plant","joker",
  "hero","banjo_and_kazooie","terry","byleth","minmin","steve","sephiroth","pyra","kazuya","sora",
];

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./characters.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  ...SLUGS.map((s) => `./icons/${s}.png`),
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  if (response.ok && new URL(request.url).origin === location.origin) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const isIcon = e.request.destination === "image";
  if (isIcon) {
    // icons never change: cache-first
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(
        (hit) => hit || fetch(e.request).then((res) => cachePut(e.request, res))
      )
    );
  } else {
    // app shell: network-first so updates land automatically, cache as offline fallback
    e.respondWith(
      fetch(e.request)
        .then((res) => cachePut(e.request, res))
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});
