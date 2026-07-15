// Super Smash Bros. Ultimate roster in official order.
// Echo fighters ride along on their base character and are combined by
// default; a board's roster config can separate any pair individually and
// can add the three Mii Fighters. Default roster: 76 characters -> 5,776
// matchups, matching the classic physical board.
const CHARACTERS = [
  { slug: "mario", name: "Mario" },
  { slug: "donkey_kong", name: "Donkey Kong" },
  { slug: "link", name: "Link" },
  { slug: "samus", name: "Samus", echo: { slug: "dark_samus", name: "Dark Samus" } },
  { slug: "yoshi", name: "Yoshi" },
  { slug: "kirby", name: "Kirby" },
  { slug: "fox", name: "Fox" },
  { slug: "pikachu", name: "Pikachu" },
  { slug: "luigi", name: "Luigi" },
  { slug: "ness", name: "Ness" },
  { slug: "captain_falcon", name: "Captain Falcon" },
  { slug: "jigglypuff", name: "Jigglypuff" },
  { slug: "peach", name: "Peach", echo: { slug: "daisy", name: "Daisy" } },
  { slug: "bowser", name: "Bowser" },
  { slug: "ice_climbers", name: "Ice Climbers" },
  { slug: "sheik", name: "Sheik" },
  { slug: "zelda", name: "Zelda" },
  { slug: "dr_mario", name: "Dr. Mario" },
  { slug: "pichu", name: "Pichu" },
  { slug: "falco", name: "Falco" },
  { slug: "marth", name: "Marth", echo: { slug: "lucina", name: "Lucina" } },
  { slug: "young_link", name: "Young Link" },
  { slug: "ganondorf", name: "Ganondorf" },
  { slug: "mewtwo", name: "Mewtwo" },
  { slug: "roy", name: "Roy", echo: { slug: "chrom", name: "Chrom" } },
  { slug: "mr_game_and_watch", name: "Mr. Game & Watch" },
  { slug: "meta_knight", name: "Meta Knight" },
  { slug: "pit", name: "Pit", echo: { slug: "dark_pit", name: "Dark Pit" } },
  { slug: "zero_suit_samus", name: "Zero Suit Samus" },
  { slug: "wario", name: "Wario" },
  { slug: "snake", name: "Snake" },
  { slug: "ike", name: "Ike" },
  { slug: "pokemon_trainer", name: "Pokémon Trainer" },
  { slug: "diddy_kong", name: "Diddy Kong" },
  { slug: "lucas", name: "Lucas" },
  { slug: "sonic", name: "Sonic" },
  { slug: "king_dedede", name: "King Dedede" },
  { slug: "olimar", name: "Olimar" },
  { slug: "lucario", name: "Lucario" },
  { slug: "rob", name: "R.O.B." },
  { slug: "toon_link", name: "Toon Link" },
  { slug: "wolf", name: "Wolf" },
  { slug: "villager", name: "Villager" },
  { slug: "mega_man", name: "Mega Man" },
  { slug: "wii_fit_trainer", name: "Wii Fit Trainer" },
  { slug: "rosalina_and_luma", name: "Rosalina & Luma" },
  { slug: "little_mac", name: "Little Mac" },
  { slug: "greninja", name: "Greninja" },
  { slug: "palutena", name: "Palutena" },
  { slug: "pac_man", name: "Pac-Man" },
  { slug: "robin", name: "Robin" },
  { slug: "shulk", name: "Shulk" },
  { slug: "bowser_jr", name: "Bowser Jr." },
  { slug: "duck_hunt", name: "Duck Hunt" },
  { slug: "ryu", name: "Ryu", echo: { slug: "ken", name: "Ken" } },
  { slug: "cloud", name: "Cloud" },
  { slug: "corrin", name: "Corrin" },
  { slug: "bayonetta", name: "Bayonetta" },
  { slug: "inkling", name: "Inkling" },
  { slug: "ridley", name: "Ridley" },
  { slug: "simon", name: "Simon", echo: { slug: "richter", name: "Richter" } },
  { slug: "king_k_rool", name: "King K. Rool" },
  { slug: "isabelle", name: "Isabelle" },
  { slug: "incineroar", name: "Incineroar" },
  { slug: "piranha_plant", name: "Piranha Plant" },
  { slug: "joker", name: "Joker" },
  { slug: "hero", name: "Hero" },
  { slug: "banjo_and_kazooie", name: "Banjo & Kazooie" },
  { slug: "terry", name: "Terry" },
  { slug: "byleth", name: "Byleth" },
  { slug: "minmin", name: "Min Min" },
  { slug: "steve", name: "Steve" },
  { slug: "sephiroth", name: "Sephiroth" },
  { slug: "pyra", name: "Pyra & Mythra" },
  { slug: "kazuya", name: "Kazuya" },
  { slug: "sora", name: "Sora" },
];

const ECHO_PAIRS = CHARACTERS.filter((ch) => ch.echo);

// Miis slot in after Greninja (official numbering 49-51).
const MII_FIGHTERS = [
  { slug: "mii_brawler", name: "Mii Brawler" },
  { slug: "mii_swordfighter", name: "Mii Swordfighter" },
  { slug: "mii_gunner", name: "Mii Gunner" },
];
const MII_AFTER = "greninja";

const combinedSlug = (ch) => `${ch.slug}+${ch.echo.slug}`;

const DEFAULT_ROSTER_CONFIG = { separated: [], miis: false };

// Build the playable roster for a board config. Result keys use each
// entry's slug, so combined results ("marth+lucina|fox") and individual
// results ("marth|fox", "lucina|fox") live in separate namespaces and both
// survive toggling back and forth.
function buildRoster(config) {
  const cfg = config || DEFAULT_ROSTER_CONFIG;
  const sep = new Set(cfg.separated || []);
  const roster = [];
  for (const ch of CHARACTERS) {
    if (ch.echo && !sep.has(ch.slug)) {
      roster.push({
        slug: combinedSlug(ch),
        name: `${ch.name} / ${ch.echo.name}`,
        icon: ch.slug,
      });
    } else {
      roster.push({ slug: ch.slug, name: ch.name, icon: ch.slug });
      if (ch.echo) {
        roster.push({ slug: ch.echo.slug, name: ch.echo.name, icon: ch.echo.slug });
      }
    }
    if (ch.slug === MII_AFTER && cfg.miis) {
      for (const m of MII_FIGHTERS) {
        roster.push({ slug: m.slug, name: m.name, icon: m.slug });
      }
    }
  }
  return roster;
}
