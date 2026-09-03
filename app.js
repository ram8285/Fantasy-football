/* Gridiron HQ — fantasy football command center.
 * Data sources (free, no keys):
 *   - Sleeper API: full NFL player DB + trending adds/drops
 *   - ESPN public API: live NFL news
 * Draft state persists in localStorage on this device.
 */
"use strict";

// ---------------------------------------------------------------------------
// League: "Wings, Rings, and Eye Patches" — 10-team ESPN H2H points.
// Defaults below match the league settings screenshots. Every value is
// editable in the My League tab; edits persist on-device and instantly
// re-run projections, the lineup optimizer, and the QB draft-board boost.
// Items marked game:true are single-game bonuses / rare plays that don't
// feed weekly projections (projections are per-game averages).
// ---------------------------------------------------------------------------
const SCORING_CONFIG = [
  { section: "Passing", items: [
    { key: "pass_yd", label: "Passing Yards, per yard (PY)", def: 0.04 },
    { key: "pass_td", label: "TD Pass (PTD)", def: 6 },
    { key: "pass_td50", label: "50+ yard TD pass bonus (PTD50)", def: 1, game: true },
    { key: "pass_int", label: "Interceptions Thrown (INT)", def: -2 },
    { key: "pass_2pt", label: "2pt Passing Conversion (2PC)", def: 2 },
    { key: "pass_400", label: "400+ yard passing game (P400)", def: 1, game: true },
  ]},
  { section: "Rushing", items: [
    { key: "rush_yd", label: "Rushing Yards, per yard (RY)", def: 0.1 },
    { key: "rush_td", label: "TD Rush (RTD)", def: 6 },
    { key: "rush_td50", label: "50+ yard TD rush bonus (RTD50)", def: 1, game: true },
    { key: "rush_2pt", label: "2pt Rushing Conversion (2PR)", def: 2 },
    { key: "rush_200", label: "200+ yard rushing game (RY200)", def: 1, game: true },
  ]},
  { section: "Receiving", items: [
    { key: "rec_yd", label: "Receiving Yards, per yard (REY)", def: 0.1 },
    { key: "rec", label: "Each reception (REC)", def: 0.5 },
    { key: "rec_td", label: "TD Reception (RETD)", def: 6 },
    { key: "rec_td50", label: "50+ yard TD rec bonus (RETD50)", def: 1, game: true },
    { key: "rec_2pt", label: "2pt Receiving Conversion (2PRE)", def: 2 },
    { key: "rec_200", label: "200+ yard receiving game (REY200)", def: 1, game: true },
  ]},
  { section: "Kicking", items: [
    { key: "pat", label: "Each PAT Made (PAT)", def: 1 },
    { key: "fg_miss", label: "Total FG Missed (FGM)", def: -1 },
    { key: "fg0", label: "FG Made 0-39 yards (FG0)", def: 3 },
    { key: "fg40", label: "FG Made 40-49 yards (FG40)", def: 4 },
    { key: "fg50", label: "FG Made 50-59 yards (FG50)", def: 5 },
    { key: "fg60", label: "FG Made 60+ yards (FG60)", def: 6 },
  ]},
  { section: "Team Defense / Special Teams", items: [
    { key: "d_sack", label: "Each Sack (SK)", def: 1 },
    { key: "d_td", label: "Any defensive or return TD (INTTD / FRTD / KRTD / PRTD / BLKKRTD)", def: 6 },
    { key: "d_blk", label: "Blocked Punt, PAT or FG (BLKK)", def: 2 },
    { key: "d_int", label: "Each Interception (INT)", def: 2 },
    { key: "d_fr", label: "Each Fumble Recovered (FR)", def: 2 },
    { key: "d_safety", label: "Each Safety (SF)", def: 2 },
    // League update (Sep 2026): yards-allowed scoring REMOVED entirely;
    // points-allowed brackets adjusted (14-17 now 2, new 18-21 = 1 tier).
    { key: "pa0", label: "0 points allowed (PA0)", def: 5 },
    { key: "pa1", label: "1-6 points allowed (PA1)", def: 4 },
    { key: "pa7", label: "7-13 points allowed (PA7)", def: 3 },
    { key: "pa14", label: "14-17 points allowed (PA14)", def: 2 },
    { key: "pa18", label: "18-21 points allowed (PA18)", def: 1 },
    { key: "pa22", label: "22-27 points allowed (PA22)", def: 0 },
    { key: "pa28", label: "28-34 points allowed (PA28)", def: -1 },
    { key: "pa35", label: "35-45 points allowed (PA35)", def: -3 },
    { key: "pa46", label: "46+ points allowed (PA46)", def: -5 },
    { key: "d_2pt_ret", label: "2pt Return (2PTRET)", def: 2, game: true },
    { key: "d_1pt_sfty", label: "1pt Safety (1PSF)", def: 1, game: true },
  ]},
  { section: "Miscellaneous", items: [
    { key: "fum_lost", label: "Total Fumbles Lost (FUML)", def: -2 },
    { key: "misc_td", label: "Offensive player kick/punt-return or fumble-recovery TD (KRTD / PRTD / FTD)", def: 6, game: true },
  ]},
];

const SCORING_DEFAULTS = {};
for (const sec of SCORING_CONFIG) for (const it of sec.items) SCORING_DEFAULTS[it.key] = it.def;
const SCORING_KEY = "ghq_scoring_v1";

function loadScoring() {
  return { ...SCORING_DEFAULTS, ...loadJSON(SCORING_KEY, {}) };
}
function saveScoringOverrides() {
  const overrides = {};
  for (const [k, v] of Object.entries(state.scoring)) {
    if (v !== SCORING_DEFAULTS[k]) overrides[k] = v;
  }
  saveJSON(SCORING_KEY, overrides);
}

// Strategy notes are generated from the CURRENT scoring settings, so they
// stay honest if values are edited before the season.
function strategyNotes() {
  const S = state.scoring;
  const notes = [];
  if (S.pass_td > 4) {
    notes.push({
      title: `${S.pass_td}-point passing TDs — QBs are gold here`,
      body: `Your league pays ${S.pass_td} per passing TD instead of ESPN's default 4. Elite QBs outscore every other position by a wide margin. Draft QBs earlier than standard rankings suggest, and don't stream the position if you can lock up a stud.`,
    });
  }
  notes.push({
    title: "The OP slot = start TWO quarterbacks",
    body: `Your utility (OP) slot accepts any offensive player — including a QB${S.pass_td > 4 ? `, and with ${S.pass_td}-point passing TDs` : ""} a second QB is almost always the best use of that slot. This app's Rankings and Draft boards are already re-ranked for that reality (the '▲ market #N' badge shows how far standard apps underrate a player here). With 10 teams starting 2 QBs, 20 QBs have starter value — leaguemates drafting off default rankings will let QBs slide. Take them.`,
  });
  notes.push({
    title: S.rec >= 1 ? "Full PPR (1 per catch)" : S.rec > 0 ? `${S.rec} per reception` : "No PPR",
    body: S.rec > 0 && S.rec < 1
      ? "Splits the difference between standard and full PPR. High-volume receivers still matter, but touchdown upside and yardage carry more weight than in full PPR. RBs who catch passes (dual threats) are extra valuable."
      : S.rec >= 1
        ? "Target-hog receivers and pass-catching RBs get a big boost — volume is king."
        : "Yardage and TDs are everything — possession receivers lose value.",
  });
  if (S.fg50 > 4 || S.fg60 > 4) {
    notes.push({
      title: "Kickers with big legs are worth more here",
      body: `Your league pays ${S.fg50} for 50-59 yd FGs and ${S.fg60} for 60+, with ${S.fg_miss} per miss. Target kickers with strong legs on teams that stall between the 30s — long-FG volume is a real edge.`,
    });
  }
  notes.push({
    title: "D/ST scores on points allowed only",
    body: "Yards-allowed scoring was removed, so D/ST swings are smaller now: the bracket runs from +5 (shutout) to -5 (46+ allowed), plus sacks, turnovers, and TDs. Matchup still matters — stream defenses against weak offenses — but a defense's turnover/sack upside now counts for relatively more than opponent yardage.",
  });
  if (S.fum_lost < 0) {
    notes.push({
      title: `Fumbles hurt (${S.fum_lost})`,
      body: "Fumble-prone ball carriers cost real points. It's a tiebreaker when two players are close in your rankings.",
    });
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Constants & state
// ---------------------------------------------------------------------------
const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const SLEEPER_TRENDING_URL = (type) =>
  `https://api.sleeper.app/v1/players/nfl/trending/${type}?lookback_hours=24&limit=50`;
const ESPN_NEWS_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50";
const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const ESPN_STANDINGS_URL = "https://site.api.espn.com/apis/v2/sports/football/nfl/standings";
const projectionsUrl = (year, week) =>
  `https://api.sleeper.app/v1/projections/nfl/regular/${year}/${week}`;
const statsUrl = (year, week) =>
  `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${week}`;
const scoreboardWeekUrl = (week) => `${ESPN_SCOREBOARD_URL}?week=${week}`;
const ESPN_INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
// Where fantasy news breaks before the articles get written.
const REDDIT_URLS = [
  { url: "https://www.reddit.com/r/fantasyfootball/hot.json?limit=25", tag: "r/fantasyfootball" },
  { url: "https://www.reddit.com/r/nfl/hot.json?limit=15", tag: "r/nfl" },
];
// 2-QB ADP — matches this league's format exactly.
const ADP_URL = "https://fantasyfootballcalculator.com/api/v1/adp/2qb?teams=10";

// Bluesky — where NFL insiders landed after Twitter. Public API, no key, CORS-open.
const BSKY_SEARCH = (q) =>
  `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=latest&limit=15`;

// RSS feeds reached through a free CORS relay (browsers can't read RSS directly).
// Both fail gracefully if the relay or feed is down.
const RSS_RELAY = (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
const RSS_FEEDS = [
  { url: "https://profootballtalk.nbcsports.com/feed/", tag: "PFT" },
  { url: "https://www.fantasypros.com/nfl/rss/news.php", tag: "FantasyPros" },
];
const SPORTSBOOK_REDDIT_URL = "https://www.reddit.com/r/sportsbook/hot.json?limit=15";
// ESPN and Sleeper agree on team codes except Washington.
const ESPN_TO_SLEEPER = { WSH: "WAS" };

// The user's NFL team — powers the dedicated team tab. Change these five
// values to follow a different franchise.
const MY_NFL_TEAM = {
  name: "Buffalo Bills",
  sleeper: "BUF",
  espnId: 2,          // ESPN team id
  espnSlug: "buf",
  subreddit: "buffalobills",
  emoji: "🦬",
};
const TEAM_NEWS_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=30&team=${MY_NFL_TEAM.espnId}`;
const TEAM_INFO_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${MY_NFL_TEAM.espnSlug}`;
const TEAM_SCHEDULE_URL = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${MY_NFL_TEAM.espnSlug}/schedule`;
const TEAM_REDDIT_URL = `https://www.reddit.com/r/${MY_NFL_TEAM.subreddit}/hot.json?limit=25`;
const TEAM_WORD_RE = new RegExp(`\\b(bills|buffalo)\\b`, "i");
const ESPN_SUMMARY_URL = (eventId) =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;
const BSKY_AUTHOR_FEED = (handle) =>
  `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=10&filter=posts_no_replies`;
const BSKY_HANDLES_KEY = "ghq_bsky_handles_v1";
// Owner-curated insiders: Bills beat writers + national NFL reporters.
// Ships as the default follow list; editable in the Bills tab (on-device).
const DEFAULT_BSKY_HANDLES = [
  "wyattcoverage.bsky.social",
  "joebuscaglia.bsky.social",
  "mattparrino.bsky.social",
  "proant.bsky.social",
  "mattlombardo.bsky.social",
  "greggrosenthal.bsky.social",
  "bytimgraham.bsky.social",
  "minakimes.bsky.social",
  "rapsheet.bsky.social",
  "agetzenberg.bsky.social",
  "matthewfairburn.bsky.social",
  "kfitz134.bsky.social",
  "salmaiorana.bsky.social",
];
const LIVE_REFRESH_MS = 45 * 1000; // in-game feed cadence

// The Odds API (user-supplied key, stored on-device only — never in the repo).
// Free tier = 500 credits/month, so: featured lines cached 12h (3 credits per
// pull), player props fetched per-game on demand (4 credits per game).
const ODDS_API_HOST = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl";
const ODDS_KEY_KEY = "ghq_oddsapi_key";
const ODDS_CACHE_KEY = "ghq_oddsapi_featured_v1";
const ODDS_USAGE_KEY = "ghq_odds_usage_v1";

// Adaptive refresh: lines move fast on NFL game days (Thu/Sun/Mon) and barely
// at all midweek — so spend quota where it matters.
function oddsTtl(now = new Date()) {
  const gameDay = [0, 1, 4].includes(now.getDay()); // Sun, Mon, Thu
  return (gameDay ? 6 : 12) * 60 * 60 * 1000;
}
const ODDS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // fallback ceiling (SGO/props)

// Monthly usage meter so quota problems are visible BEFORE they bite.
function oddsUsage() {
  const month = new Date().toISOString().slice(0, 7);
  const u = loadJSON(ODDS_USAGE_KEY, null);
  return u && u.month === month ? u : { month, toaUsed: null, sgoObjects: 0, toaProps: 0 };
}
function saveOddsUsage(patch) {
  saveJSON(ODDS_USAGE_KEY, { ...oddsUsage(), ...patch });
}
function paceNote(used, limit) {
  if (used === null || used === undefined) return "";
  const day = new Date().getDate();
  const projected = Math.round((used / Math.max(1, day)) * 30);
  return projected > limit
    ? ` ⚠ on pace for ~${projected}/${limit} this month — slow down`
    : ` (on pace ~${projected}/${limit}/mo)`;
}
const PROP_MARKETS = "player_pass_yds,player_rush_yds,player_reception_yds,player_anytime_td";
const BOOK_ABBR = {
  draftkings: "DK", fanduel: "FD", betmgm: "MGM", williamhill_us: "CZR",
  caesars: "CZR", espnbet: "ESPNBet", pointsbetus: "PB", betrivers: "BR",
  bovada: "BOV", mybookieag: "MB", betonlineag: "BOL", lowvig: "LV", unibet_us: "UNI",
};
const NFL_FULLNAME_TO_ABBR = {
  "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
  "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR", "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN",
  "New England Patriots": "NE", "New Orleans Saints": "NO", "New York Giants": "NYG",
  "New York Jets": "NYJ", "Philadelphia Eagles": "PHI", "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA", "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
};

// SportsGameOdds (second optional provider, user-supplied key on-device only).
// Bills per EVENT (all markets included), free tier 2,500 objects/month with a
// 10-min delay — cheap enough to pull props for the whole weekly slate.
const SGO_HOST = "https://api.sportsgameodds.com/v2";
const SGO_KEY_KEY = "ghq_sgo_key";
const SGO_CACHE_KEY = "ghq_sgo_cache_v1";
const SGO_STAT_TO_MARKET = {
  passing_yards: "player_pass_yds",
  rushing_yards: "player_rush_yds",
  receiving_yards: "player_reception_yds",
  touchdowns: "player_anytime_td",
  anytime_touchdown: "player_anytime_td",
};

// Stadium locations for game-day weather (Open-Meteo, free, no key).
// dome:true = weather ignored (incl. retractable roofs).
const STADIUMS = {
  ARI: { lat: 33.5276, lon: -112.2626, dome: true },  ATL: { lat: 33.7554, lon: -84.4008, dome: true },
  BAL: { lat: 39.2780, lon: -76.6227 },               BUF: { lat: 42.7738, lon: -78.7870 },
  CAR: { lat: 35.2258, lon: -80.8528 },               CHI: { lat: 41.8623, lon: -87.6167 },
  CIN: { lat: 39.0955, lon: -84.5161 },               CLE: { lat: 41.5061, lon: -81.6995 },
  DAL: { lat: 32.7473, lon: -97.0945, dome: true },   DEN: { lat: 39.7439, lon: -105.0201 },
  DET: { lat: 42.3400, lon: -83.0456, dome: true },   GB:  { lat: 44.5013, lon: -88.0622 },
  HOU: { lat: 29.6847, lon: -95.4107, dome: true },   IND: { lat: 39.7601, lon: -86.1639, dome: true },
  JAX: { lat: 30.3240, lon: -81.6373 },               KC:  { lat: 39.0489, lon: -94.4839 },
  LAC: { lat: 33.9535, lon: -118.3392, dome: true },  LAR: { lat: 33.9535, lon: -118.3392, dome: true },
  LV:  { lat: 36.0909, lon: -115.1833, dome: true },  MIA: { lat: 25.9580, lon: -80.2389 },
  MIN: { lat: 44.9738, lon: -93.2575, dome: true },   NE:  { lat: 42.0909, lon: -71.2643 },
  NO:  { lat: 29.9511, lon: -90.0812, dome: true },   NYG: { lat: 40.8128, lon: -74.0742 },
  NYJ: { lat: 40.8128, lon: -74.0742 },               PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 },               SEA: { lat: 47.5952, lon: -122.3316 },
  SF:  { lat: 37.4030, lon: -121.9700 },              TB:  { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 },               WAS: { lat: 38.9077, lon: -76.8645 },
};

const PLAYERS_CACHE_KEY = "ghq_players_v1";
const PLAYERS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — ranks shift slowly
const DRAFT_KEY = "ghq_draft_v1";
const MYTEAM_KEY = "ghq_myteam_v1";
const NOTIFY_KEY = "ghq_notify_v1";
const SEEN_KEY = "ghq_seen_v1";       // news/waiver items already notified about
const RANKSNAP_KEY = "ghq_ranksnap_v1";   // rank snapshot from a previous visit
const RANKDELTA_KEY = "ghq_rankdelta_v1"; // computed rank movement
const RANKSNAP_MIN_AGE_MS = 12 * 60 * 60 * 1000;
const ADP_CACHE_KEY = "ghq_adp_v1";       // 2QB ADP, cached 24h
const DVP_CACHE_KEY = "ghq_dvp_v1";       // defense-vs-position, cached 24h
const DRAFT_SLOT_KEY = "ghq_draftslot_v1";
const ESPN_SYNC_KEY = "ghq_espnsync_v1"; // {leagueId, teamId, teamName}

const espnLeagueUrl = (id, year) =>
  `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${id}?view=mTeam&view=mRoster&view=mMatchup`;

// Your league's actual lineup (verified against the live ESPN roster view):
// a FLEX (RB/WR/TE) PLUS the OP utility slot that accepts any offensive
// player, including a second QB (big deal with 6-pt passing TDs).
// 10 starters + 7 bench = 17 draftable spots.
const ROSTER_SLOTS = [
  ["QB", 1], ["RB", 2], ["WR", 2], ["TE", 1], ["FLEX", 1], ["OP", 1], ["D/ST", 1], ["K", 1], ["Bench", 7], ["IR", 1],
];
const SLOT_ELIGIBLE = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  FLEX: ["RB", "WR", "TE"],
  OP: ["QB", "RB", "WR", "TE"], "D/ST": ["DEF"], K: ["K"],
};

const state = {
  players: [],            // [{id, name, pos, team, rank, injury}]
  byId: new Map(),
  trendingAdd: [],        // [{id, count}]
  trendingDrop: [],
  trendMap: new Map(),    // id -> {add, drop}
  news: [],               // ESPN articles
  reddit: [],             // merged reddit posts [{title, url, ts, tag, score}]
  adp: new Map(),         // normalized name -> {adp, posAdp}
  weather: new Map(),     // home team -> {wind, precip, temp}
  games: [],              // [{home, away, date, ou, spread, details}]
  // teamName ships as an owner default: if the browser wipes storage (common
  // in in-app webviews), the sync self-heals by re-adopting the team by name.
  espnCfg: loadJSON(ESPN_SYNC_KEY, { leagueId: "1767084290", teamId: null, teamName: "Material Weakness" }),
  espn: null,             // {teams, rosteredIds, opponent, currentMatchupPeriod}
  espnError: null,
  // Owner's free-tier keys ship as defaults BY THE OWNER'S EXPLICIT CHOICE —
  // zero setup on any device. Exposure risk accepted: keys are visible to
  // anyone reading this public code; worst case is burned free-tier quota
  // (no payment methods attached). Pasting a key in Settings overrides these.
  oddsKey: localStorage.getItem(ODDS_KEY_KEY) || "7e84e6e6e43aac6aaebf2828e214378b",
  sgoKey: localStorage.getItem(SGO_KEY_KEY) || "bc3d2ea15225e621ac7fb1c76092018e",
  sgoStatus: null,        // human-readable result of the last SGO pull
  oddsQuota: null,        // {remaining, used} from response headers
  oddsShop: new Map(),    // home abbr -> {eventId, spreads, totals, h2h best prices}
  propLines: new Map(),   // home abbr -> Map("player|market" -> {point, price, book})
  toaPropsLoaded: new Set(), // games whose TOA prop lines were fetched this session
  rssNews: [],            // [{title, desc, url, ts, tag}] from RSS relays
  bskyPosts: [],          // fantasy-football Bluesky posts
  bskyBills: [],          // team Bluesky posts
  sportsbookPosts: [],    // r/sportsbook buzz
  teamNews: [],           // ESPN articles filtered to MY_NFL_TEAM
  teamReddit: [],         // team subreddit posts
  teamInfo: null,         // {record, standing}
  teamSchedule: [],       // [{date, shortName, result}]
  billsGameThread: null,  // stickied game-thread post {id, title} when found
  billsLive: { plays: [], gtComments: [], liveBsky: [], authorPosts: [] },
  bskyHandles: loadJSON(BSKY_HANDLES_KEY, DEFAULT_BSKY_HANDLES),
  injuryByTeam: new Map(),// team abbr -> [{name, status, comment}]
  dvp: null,              // def team -> {QB:rank, RB:rank, WR:rank, TE:rank} 1=easiest
  draftSlot: loadJSON(DRAFT_SLOT_KEY, 5),
  tradeSend: [],          // player ids on my side of a proposed trade
  tradeRecv: [],
  draft: loadDraft(),     // { [playerId]: "mine" | "taken" }
  myTeam: loadJSON(MYTEAM_KEY, []),      // [playerId]
  scoring: null,          // set at boot via loadScoring()
  projStats: new Map(),   // id -> raw projected stat line (re-scorable)
  projections: new Map(), // id -> projected pts in THIS league's scoring
  schedule: new Map(),    // sleeper team code -> {opp, homeAway, date}
  defense: new Map(),     // sleeper team code -> {paPerGame, easeRank (1=easiest), games}
  week: null,
  seasonYear: null,
  seasonType: null,       // 2 = regular season
  rankDeltas: loadJSON(RANKDELTA_KEY, null), // {ts, days, moves:[{id, from, to}]}
  rankPos: "ALL",
  rankQuery: "",
  draftPos: "ALL",
  draftQuery: "",
  hideDrafted: true,
};

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full */ }
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
  catch { return {}; }
}
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
}
function saveMyTeam() {
  saveJSON(MYTEAM_KEY, state.myTeam);
}
state.scoring = loadScoring();

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Fetch with a hard timeout — used for relays/third parties that can hang.
async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRss(feed) {
  const res = await fetchWithTimeout(RSS_RELAY(feed.url));
  const xml = new DOMParser().parseFromString(await res.text(), "text/xml");
  return [...xml.querySelectorAll("item")].slice(0, 12).map((item) => {
    const get = (sel) => item.querySelector(sel)?.textContent?.trim() || "";
    const desc = get("description").replace(/<[^>]*>/g, "").slice(0, 180);
    return {
      title: get("title"),
      desc,
      url: get("link"),
      ts: new Date(get("pubDate") || Date.now()).getTime(),
      tag: feed.tag,
    };
  }).filter((it) => it.title);
}

async function fetchBsky(query) {
  const res = await fetchWithTimeout(BSKY_SEARCH(query));
  const json = await res.json();
  return (json?.posts || [])
    .filter((p) => (p.likeCount ?? 0) >= 2 && p.record?.text) // cut spam
    .map((p) => {
      const rkey = String(p.uri || "").split("/").pop();
      return {
        title: p.record.text.slice(0, 220),
        desc: "",
        url: `https://bsky.app/profile/${p.author?.handle}/post/${rkey}`,
        ts: new Date(p.record.createdAt || Date.now()).getTime(),
        tag: "Bluesky",
        extra: `@${p.author?.handle || "?"} · ♥ ${p.likeCount ?? 0}`,
      };
    });
}

async function loadPlayers(force = false) {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(PLAYERS_CACHE_KEY));
      if (cached && Date.now() - cached.ts < PLAYERS_CACHE_TTL_MS && cached.players?.length) {
        return cached.players;
      }
    } catch { /* fall through to fetch */ }
  }
  const raw = await fetchJSON(SLEEPER_PLAYERS_URL); // ~5 MB, hence the cache
  const players = [];
  for (const [id, p] of Object.entries(raw)) {
    const pos = p.position === "DEF" ? "DEF" : p.position;
    if (!POSITIONS.includes(pos)) continue;
    const rank = typeof p.search_rank === "number" ? p.search_rank : 9999999;
    // Keep every D/ST, plus active skill players who are on a roster or have a
    // meaningful rank — trending waiver players can sit deep in the rank list.
    if (pos !== "DEF" && (p.active === false || (rank >= 1200 && !p.team))) continue;
    players.push({
      id,
      name: pos === "DEF" ? `${p.first_name} ${p.last_name}` : (p.full_name || `${p.first_name} ${p.last_name}`),
      pos,
      team: p.team || "FA",
      rank,
      injury: p.injury_status || null,
    });
  }
  players.sort((a, b) => a.rank - b.rank);
  try {
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify({ ts: Date.now(), players }));
  } catch { /* cache full — not fatal */ }
  updateRankSnapshot(players);
  return players;
}

// Compare fresh ranks against a snapshot from a previous visit (>=12h old) so
// the Sleepers tab can show who's climbing the rankings.
function updateRankSnapshot(players) {
  const now = Date.now();
  const snap = loadJSON(RANKSNAP_KEY, null);
  const ranks = {};
  for (const p of players) if (p.rank < 9999999) ranks[p.id] = p.rank;

  if (!snap) {
    saveJSON(RANKSNAP_KEY, { ts: now, ranks });
    return;
  }
  if (now - snap.ts < RANKSNAP_MIN_AGE_MS) return; // too soon to compare

  const moves = [];
  for (const [id, to] of Object.entries(ranks)) {
    const from = snap.ranks[id];
    if (typeof from === "number" && from - to >= 10 && to <= 400) {
      moves.push({ id, from, to });
    }
  }
  moves.sort((a, b) => (b.from - b.to) - (a.from - a.to));
  state.rankDeltas = {
    ts: now,
    days: Math.max(1, Math.round((now - snap.ts) / 86400000)),
    moves: moves.slice(0, 25),
  };
  saveJSON(RANKDELTA_KEY, state.rankDeltas);
  saveJSON(RANKSNAP_KEY, { ts: now, ranks });
}

// Re-rank the board for THIS league's reality: a QB slot plus an OP slot that
// takes QBs = a 2-QB league, and passing TDs are worth 6. Consensus ranks are
// built for 1-QB leagues, so QBs get pulled up to superflex-calibrated slots
// while everyone else keeps their relative order. Each player keeps:
//   mrank — standard 1-QB market rank (what leaguemates' apps show)
//   lrank — this league's adjusted rank (what the player is worth HERE)
function applyLeagueRanks(players) {
  players.forEach((p, i) => { p.mrank = i + 1; });
  const qbs = players.filter((p) => p.pos === "QB");
  const others = players.filter((p) => p.pos !== "QB");
  // Target overall slot for the r-th QB (10-team, 20 starting QB slots).
  // The slope reacts to the passing-TD setting: at 6 pts QB1 ≈ #1 overall and
  // QB20 ~#35; if TDs drop toward 4 the boost softens automatically.
  const passTd = state.scoring?.pass_td ?? 6;
  const slope = 1.8 + Math.max(0, 6 - passTd) * 0.15;
  const base20 = Math.round(slope * 20 - 0.8);
  const qbSlot = (r) => {
    if (r <= 20) return Math.max(1, Math.round(slope * r - 0.8));
    if (r <= 30) return base20 + (r - 20) * 4;
    return base20 + 40 + (r - 30) * 8;
  };
  const merged = [];
  let qi = 0, oi = 0;
  while (qi < qbs.length || oi < others.length) {
    const slot = merged.length + 1;
    if (qi < qbs.length && (qbSlot(qi + 1) <= slot || oi >= others.length)) {
      merged.push(qbs[qi++]);
    } else {
      merged.push(others[oi++]);
    }
  }
  merged.forEach((p, i) => { p.lrank = i + 1; });
  return merged;
}

async function loadAll(force = false) {
  setUpdatedAt("updating…");

  const jobs = [
    loadPlayers(force)
      .then((players) => {
        state.players = applyLeagueRanks(players);
        state.byId = new Map(players.map((p) => [p.id, p]));
      })
      .catch((e) => showError("rankings-list", "Couldn't load player data", e)),

    fetchJSON(SLEEPER_TRENDING_URL("add"))
      .then((d) => { state.trendingAdd = d.map((t) => ({ id: t.player_id, count: t.count })); })
      .catch(() => { state.trendingAdd = []; }),

    fetchJSON(SLEEPER_TRENDING_URL("drop"))
      .then((d) => { state.trendingDrop = d.map((t) => ({ id: t.player_id, count: t.count })); })
      .catch(() => { state.trendingDrop = []; }),

    fetchJSON(ESPN_NEWS_URL)
      .then((d) => { state.news = d.articles || []; })
      .catch((e) => showError("news-list", "Couldn't load ESPN news", e)),

    fetchJSON(ESPN_SCOREBOARD_URL)
      .then((d) => parseScoreboard(d))
      .catch(() => { /* schedule unavailable — matchups degrade gracefully */ }),

    fetchJSON(ESPN_STANDINGS_URL)
      .then((d) => parseStandings(d))
      .catch(() => { /* defense strength unavailable */ }),

    ...REDDIT_URLS.map((src) =>
      fetchJSON(src.url)
        .then((d) => parseReddit(d, src.tag))
        .catch(() => { /* reddit unavailable */ })),

    fetchJSON(ESPN_INJURIES_URL)
      .then((d) => parseInjuries(d))
      .catch(() => { /* injury report unavailable */ }),

    loadAdp().catch(() => { /* ADP unavailable */ }),

    // --- Extra news layers: Bluesky, RSS relays, betting buzz ---
    fetchBsky("fantasy football")
      .then((posts) => { state.bskyPosts = posts; })
      .catch(() => { /* bluesky unavailable */ }),

    fetchBsky(`${MY_NFL_TEAM.name}`)
      .then((posts) => { state.bskyBills = posts; })
      .catch(() => { /* bluesky unavailable */ }),

    Promise.allSettled(RSS_FEEDS.map(fetchRss))
      .then((results) => {
        state.rssNews = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      }),

    fetchJSON(SPORTSBOOK_REDDIT_URL)
      .then((d) => {
        state.sportsbookPosts = (d?.data?.children || [])
          .map((c) => c.data)
          .filter((p) => p && !p.stickied && !p.over_18)
          .slice(0, 10)
          .map((p) => ({
            title: p.title,
            url: `https://www.reddit.com${p.permalink}`,
            ts: p.created_utc * 1000,
            score: p.ups || 0,
          }));
      })
      .catch(() => { /* r/sportsbook unavailable */ }),

    // --- The user's NFL team feeds ---
    fetchJSON(TEAM_NEWS_URL)
      .then((d) => { state.teamNews = d.articles || []; })
      .catch(() => { /* team news unavailable */ }),

    fetchJSON(TEAM_REDDIT_URL)
      .then((d) => {
        const raw = (d?.data?.children || []).map((c) => c.data).filter((p) => p && !p.over_18);
        // Game threads are stickied — grab one for the live comment stream.
        const gt = raw.find((p) => p.stickied && /game\s*thread|gameday|game\s*day/i.test(p.title || ""));
        state.billsGameThread = gt ? { id: gt.id, title: gt.title, url: `https://www.reddit.com${gt.permalink}` } : null;
        state.teamReddit = raw
          .filter((p) => !p.stickied)
          .map((p) => ({
            title: p.title,
            url: `https://www.reddit.com${p.permalink}`,
            ts: p.created_utc * 1000,
            score: p.ups || 0,
            flair: p.link_flair_text || "",
          }));
      })
      .catch(() => { /* team subreddit unavailable */ }),

    fetchJSON(TEAM_INFO_URL)
      .then((d) => {
        state.teamInfo = {
          record: d?.team?.record?.items?.[0]?.summary || null,
          standing: d?.team?.standingSummary || null,
        };
      })
      .catch(() => { /* team info unavailable */ }),

    fetchJSON(TEAM_SCHEDULE_URL)
      .then((d) => {
        state.teamSchedule = (d?.events || []).map((ev) => {
          const comp = ev.competitions?.[0];
          const us = comp?.competitors?.find((c) => c.team?.abbreviation &&
            normTeam(c.team.abbreviation) === MY_NFL_TEAM.sleeper);
          const them = comp?.competitors?.find((c) => c !== us);
          let result = null;
          if (us?.winner === true) result = "W";
          else if (us?.winner === false && them?.winner === true) result = "L";
          const score = us?.score?.displayValue && them?.score?.displayValue
            ? `${us.score.displayValue}-${them.score.displayValue}` : null;
          return { date: ev.date, shortName: ev.shortName || ev.name || "", result, score };
        });
      })
      .catch(() => { /* schedule unavailable */ }),
  ];

  await Promise.allSettled(jobs);
  applyInjuryOverlay();
  await loadEspnLeague(); // needs the player DB for name matching

  // These need the season/week from the scoreboard, so they run after.
  if (state.seasonYear && state.week) {
    await Promise.allSettled([
      fetchJSON(projectionsUrl(state.seasonYear, state.week))
        .then((proj) => parseProjections(proj))
        .catch(() => { /* projections unavailable — optimizer falls back to ranks */ }),
      loadWeather().catch(() => { /* weather unavailable */ }),
      loadDvp().catch(() => { /* defense-vs-position unavailable */ }),
      loadOddsApi().catch(() => { /* odds api unavailable or bad key */ }),
    ]);
    await loadSgo().catch((e) => { state.sgoStatus = `SGO error: ${e.message}`; });
    recordOptimizerWeek();
    await evaluateOptimizerWeeks().catch(() => { /* stats not posted yet */ });
    await loadUsageTrends().catch(() => { /* stats not posted yet */ });
  }
  await loadBillsExtras().catch(() => { /* live extras unavailable */ });

  state.trendMap = new Map();
  for (const t of state.trendingAdd) state.trendMap.set(t.id, { add: t.count, drop: 0 });
  for (const t of state.trendingDrop) {
    const cur = state.trendMap.get(t.id) || { add: 0, drop: 0 };
    cur.drop = t.count;
    state.trendMap.set(t.id, cur);
  }

  renderAll();
  maybeNotify();
  setUpdatedAt(`updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
}

function parseScoreboard(d) {
  state.week = d.week?.number || null;
  state.seasonYear = d.season?.year || null;
  state.seasonType = d.season?.type ?? null;
  state.schedule = new Map();
  state.games = [];
  for (const ev of d.events || []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const h = normTeam(home.team?.abbreviation);
    const a = normTeam(away.team?.abbreviation);
    if (!h || !a) continue;
    // Vegas: implied team totals from the spread + over/under, when posted.
    let hTotal = null, aTotal = null;
    const odds = comp.odds?.[0];
    if (odds && typeof odds.overUnder === "number") {
      const spread = typeof odds.spread === "number" ? odds.spread : 0; // negative = home favored
      hTotal = Math.round((odds.overUnder / 2 - spread / 2) * 10) / 10;
      aTotal = Math.round((odds.overUnder / 2 + spread / 2) * 10) / 10;
    }
    state.schedule.set(h, { opp: a, homeAway: "home", date: ev.date, implied: hTotal });
    state.schedule.set(a, { opp: h, homeAway: "away", date: ev.date, implied: aTotal });
    state.games.push({
      home: h, away: a, date: ev.date,
      eventId: ev.id || null,
      status: comp.status?.type?.state || "pre",          // pre | in | post
      statusDetail: comp.status?.type?.shortDetail || "",  // e.g. "Q3 5:24"
      hScore: home.score !== undefined ? Number(home.score) : null,
      aScore: away.score !== undefined ? Number(away.score) : null,
      ou: typeof odds?.overUnder === "number" ? odds.overUnder : null,
      spread: typeof odds?.spread === "number" ? odds.spread : null,
      details: odds?.details || null,
      hMl: odds?.homeTeamOdds?.moneyLine ?? null,
      aMl: odds?.awayTeamOdds?.moneyLine ?? null,
      hTotal, aTotal,
    });
  }
}

function normTeam(abbr) {
  if (!abbr) return null;
  return ESPN_TO_SLEEPER[abbr] || abbr;
}

function parseStandings(d) {
  // Standings entries live under children[] (conferences); each entry has a
  // stats array we search by name. Ease rank 1 = allows the most points.
  const teams = [];
  const groups = d.children || [d];
  for (const g of groups) {
    for (const e of g.standings?.entries || []) {
      const abbr = normTeam(e.team?.abbreviation);
      const stats = e.stats || [];
      const find = (n) => stats.find((s) => s.name === n)?.value;
      const pa = find("pointsAgainst");
      const games = find("gamesPlayed");
      if (abbr && typeof pa === "number" && games >= 1) {
        teams.push({ abbr, paPerGame: pa / games, games });
      }
    }
  }
  teams.sort((x, y) => y.paPerGame - x.paPerGame); // most points allowed first
  state.defense = new Map();
  teams.forEach((t, i) => state.defense.set(t.abbr, { ...t, easeRank: i + 1 }));
}

function parseReddit(d, tag) {
  const posts = (d?.data?.children || [])
    .map((c) => c.data)
    .filter((p) => p && !p.stickied && !p.over_18)
    .map((p) => ({
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      ts: p.created_utc * 1000,
      tag,
      score: p.ups || 0,
      flair: p.link_flair_text || "",
    }));
  state.reddit = state.reddit.filter((p) => p.tag !== tag).concat(posts);
}

// ESPN team-by-team injury report → name-keyed map, overlaid onto players
// that Sleeper hasn't flagged yet (two sources beat one).
let injuryReport = new Map();
function parseInjuries(d) {
  injuryReport = new Map();
  state.injuryByTeam = new Map();
  for (const team of d?.injuries || []) {
    const abbr = normTeam(team.team?.abbreviation || team.abbreviation || null);
    for (const inj of team.injuries || []) {
      const name = inj.athlete?.displayName;
      const status = inj.status || inj.type?.description;
      if (name && status) {
        injuryReport.set(normName(name), status);
        if (abbr) {
          const arr = state.injuryByTeam.get(abbr) || [];
          arr.push({ name, status, comment: inj.shortComment || inj.longComment || "" });
          state.injuryByTeam.set(abbr, arr);
        }
      }
    }
  }
}
function applyInjuryOverlay() {
  if (!injuryReport.size || !state.players.length) return;
  for (const p of state.players) {
    if (!p.injury) {
      const s = injuryReport.get(normName(p.name));
      if (s && !/active/i.test(s)) p.injury = s;
    }
  }
}

// Names differ across feeds ("A.J. Brown" vs "AJ Brown Jr.") — normalize hard.
function normName(n) {
  return String(n).toLowerCase().replace(/[.'’-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/\s+/g, " ").trim();
}

async function loadAdp() {
  const cached = loadJSON(ADP_CACHE_KEY, null);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) {
    state.adp = new Map(cached.entries);
    return;
  }
  const d = await fetchJSON(ADP_URL);
  const entries = [];
  for (const p of d?.players || []) {
    if (p.name && p.adp) entries.push([normName(p.name), { adp: p.adp, pos: p.position }]);
  }
  if (entries.length) {
    state.adp = new Map(entries);
    saveJSON(ADP_CACHE_KEY, { ts: Date.now(), entries });
  }
}

// One batched Open-Meteo call covers every outdoor game this week.
async function loadWeather() {
  state.weather = new Map();
  const games = []; // [{home, date}]
  for (const [team, g] of state.schedule) {
    if (g.homeAway === "home" && STADIUMS[team] && !STADIUMS[team].dome) {
      games.push({ home: team, date: g.date });
    }
  }
  if (!games.length) return;
  const lats = games.map((g) => STADIUMS[g.home].lat).join(",");
  const lons = games.map((g) => STADIUMS[g.home].lon).join(",");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
    `&hourly=wind_speed_10m,precipitation_probability,temperature_2m` +
    `&wind_speed_unit=mph&temperature_unit=fahrenheit&forecast_days=7&timezone=UTC`;
  const d = await fetchJSON(url);
  const results = Array.isArray(d) ? d : [d];
  games.forEach((g, i) => {
    const r = results[i];
    if (!r?.hourly?.time) return;
    // Pick the forecast hour closest to kickoff.
    const kick = new Date(g.date).getTime();
    let best = 0, bestDiff = Infinity;
    r.hourly.time.forEach((t, idx) => {
      const diff = Math.abs(new Date(t + "Z").getTime() - kick);
      if (diff < bestDiff) { bestDiff = diff; best = idx; }
    });
    if (bestDiff > 3 * 3600 * 1000 * 24) return; // kickoff beyond forecast range
    state.weather.set(g.home, {
      wind: Math.round(r.hourly.wind_speed_10m?.[best] ?? 0),
      precip: Math.round(r.hourly.precipitation_probability?.[best] ?? 0),
      temp: Math.round(r.hourly.temperature_2m?.[best] ?? 0),
    });
  });
}

// Defense-vs-position from real box scores: score every player's recent weeks
// with THIS league's rules, attribute the points to the defense they faced,
// then rank each defense per position (1 = gives up the most = easiest).
async function loadDvp() {
  if (state.seasonType !== 2 || state.week < 2) return; // needs completed weeks
  const cached = loadJSON(DVP_CACHE_KEY, null);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000 && cached.week === state.week) {
    state.dvp = new Map(cached.entries);
    return;
  }
  const weeks = [];
  for (let w = Math.max(1, state.week - 3); w < state.week; w++) weeks.push(w);
  const allowed = new Map(); // def team -> {QB: pts, RB: pts, ...}
  for (const w of weeks) {
    try {
      const [sb, stats] = await Promise.all([
        fetchJSON(scoreboardWeekUrl(w)),
        fetchJSON(statsUrl(state.seasonYear, w)),
      ]);
      const oppOf = new Map();
      for (const ev of sb.events || []) {
        const comp = ev.competitions?.[0];
        const home = normTeam(comp?.competitors?.find((c) => c.homeAway === "home")?.team?.abbreviation);
        const away = normTeam(comp?.competitors?.find((c) => c.homeAway === "away")?.team?.abbreviation);
        if (home && away) { oppOf.set(home, away); oppOf.set(away, home); }
      }
      const statEntries = Array.isArray(stats)
        ? stats.map((r) => [r.player_id, r.stats || r])
        : Object.entries(stats || {});
      for (const [pid, line] of statEntries) {
        const p = state.byId.get(String(pid));
        if (!p || !["QB", "RB", "WR", "TE"].includes(p.pos)) continue;
        const def = oppOf.get(p.team);
        if (!def) continue;
        const pts = leaguePoints(line);
        if (pts <= 0) continue;
        const rec = allowed.get(def) || { QB: 0, RB: 0, WR: 0, TE: 0 };
        rec[p.pos] += pts;
        allowed.set(def, rec);
      }
    } catch { /* skip week on failure */ }
  }
  if (allowed.size < 16) return; // not enough data to be meaningful
  state.dvp = new Map();
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    const sorted = [...allowed.entries()].sort((a, b) => b[1][pos] - a[1][pos]);
    sorted.forEach(([def], i) => {
      const rec = state.dvp.get(def) || {};
      rec[pos] = i + 1; // 1 = allows most points to this position
      state.dvp.set(def, rec);
    });
  }
  saveJSON(DVP_CACHE_KEY, { ts: Date.now(), week: state.week, entries: [...state.dvp.entries()] });
}

function parseProjections(raw) {
  // Sleeper serves projections either as {player_id: statsObj} or as an array
  // of {player_id, stats}. Keep the RAW stat lines so a scoring-settings edit
  // can re-score everything without refetching.
  state.projStats = new Map();
  const put = (id, stats) => {
    if (id && stats) state.projStats.set(String(id), stats);
  };
  if (Array.isArray(raw)) {
    for (const row of raw) put(row.player_id, row.stats || row);
  } else if (raw && typeof raw === "object") {
    for (const [id, stats] of Object.entries(raw)) put(id, stats);
  }
  recomputeProjections();
}

function recomputeProjections() {
  state.projections = new Map();
  for (const [id, stats] of state.projStats) {
    const pts = leaguePoints(stats);
    if (pts > 0) state.projections.set(id, pts);
  }
}

// Score a Sleeper stat line with the CURRENT scoring settings (editable in
// the My League tab). Single-game threshold bonuses (P400/RY200/REY200) are
// omitted — projections are averages, so those thresholds almost never
// trigger meaningfully.
function leaguePoints(s) {
  const S = state.scoring;
  const n = (k) => Number(s[k]) || 0;
  let pts =
    n("pass_yd") * S.pass_yd + n("pass_td") * S.pass_td + n("pass_int") * S.pass_int + n("pass_2pt") * S.pass_2pt +
    n("rush_yd") * S.rush_yd + n("rush_td") * S.rush_td + n("rush_2pt") * S.rush_2pt +
    n("rec") * S.rec + n("rec_yd") * S.rec_yd + n("rec_td") * S.rec_td + n("rec_2pt") * S.rec_2pt +
    n("fum_lost") * S.fum_lost;
  // Kicking (fg_miss is stored as a negative value, e.g. -1)
  pts +=
    n("xpm") * S.pat + n("fgmiss") * S.fg_miss +
    (n("fgm_0_19") + n("fgm_20_29") + n("fgm_30_39")) * S.fg0 +
    n("fgm_40_49") * S.fg40 +
    (n("fgm_50_59") || n("fgm_50p")) * S.fg50 +
    n("fgm_60p") * S.fg60;
  // Team defense
  pts +=
    n("sack") * S.d_sack + (n("int") + n("def_int")) * S.d_int + n("fum_rec") * S.d_fr +
    (n("def_td") + n("def_st_td")) * S.d_td + n("safe") * S.d_safety + n("blk_kick") * S.d_blk;
  // Yards-allowed scoring was removed from the league (Sep 2026) — D/ST
  // brackets are points-allowed only now.
  if (s.pts_allow !== undefined) pts += paBracket(n("pts_allow"));
  return Math.round(pts * 10) / 10;
}

function paBracket(pa) {
  const S = state.scoring;
  if (pa <= 0) return S.pa0;
  if (pa <= 6) return S.pa1;
  if (pa <= 13) return S.pa7;
  if (pa <= 17) return S.pa14;
  if (pa <= 21) return S.pa18;
  if (pa <= 27) return S.pa22;
  if (pa <= 34) return S.pa28;
  if (pa <= 45) return S.pa35;
  return S.pa46;
}

function setUpdatedAt(text) {
  document.getElementById("updated-at").textContent = text;
}

function showError(containerId, message, err) {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `<div class="error-box"><strong>${message}.</strong><br>
      ${escapeHtml(String(err))}<br>Check your connection and hit ⟳ Refresh.</div>`;
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderAll() {
  renderNews();
  renderRankings();
  renderDraft();
  renderWaivers();
  renderStartSit();
  renderSleepers();
  renderBetting();
  renderBills();
  renderTrade();
  renderPowerRankings();
}

// ----- News -----
function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const INJURY_RE = /injur|out |questionable|doubtful|IR\b|carted|surgery|concussion|placed on|activated|ruled/i;

// "Is one of MY players in this headline?" — powers ⭐ badges + priority alerts.
function mentionsMyPlayer(text) {
  const t = normName(text);
  for (const id of state.myTeam) {
    const p = state.byId.get(id);
    if (p && p.pos !== "DEF" && t.includes(normName(p.name))) return p;
  }
  return null;
}

function srcClass(tag) {
  if (tag === "ESPN") return "espn";
  if (tag === "Bluesky") return "bsky";
  if (String(tag).startsWith("r/")) return "reddit";
  return "other";
}

function newsCard(it) {
  const isInjury = INJURY_RE.test(it.title + " " + (it.desc || ""));
  const mine = mentionsMyPlayer(it.title + " " + (it.desc || ""));
  return `<a class="news-card ${mine ? "my-player-card" : ""}" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">
    <h3>${escapeHtml(it.title)}</h3>
    ${it.desc ? `<p>${escapeHtml(it.desc)}</p>` : ""}
    <div class="news-meta">
      <span class="src-badge src-${srcClass(it.tag)}">${escapeHtml(it.tag)}</span>
      <span>${timeAgo(it.ts)}</span>
      ${it.extra ? `<span>${escapeHtml(it.extra)}</span>` : ""}
      ${mine ? '<span class="news-badge my-player-badge">⭐ YOUR PLAYER</span>' : ""}
      ${isInjury ? '<span class="news-badge">⚕ injury-related</span>' : ""}
    </div>
  </a>`;
}

function renderNews() {
  const el = document.getElementById("news-list");
  if (!state.news.length && !state.reddit.length && !state.rssNews.length && !state.bskyPosts.length) return;

  // Merge every source into one time-sorted, deduped feed.
  const items = [
    ...state.news.map((a) => ({
      title: a.headline,
      desc: a.description || "",
      url: a.links?.web?.href || a.links?.mobile?.href || "#",
      ts: new Date(a.published).getTime(),
      tag: "ESPN",
      extra: "",
    })),
    ...state.reddit.map((p) => ({
      title: p.title,
      desc: p.flair ? `[${p.flair}]` : "",
      url: p.url,
      ts: p.ts,
      tag: p.tag,
      extra: `▲ ${p.score.toLocaleString()}`,
    })),
    ...state.rssNews.map((it) => ({ ...it, extra: "" })),
    ...state.bskyPosts,
  ];
  const seenTitles = new Set();
  el.innerHTML = items
    .filter((it) => {
      const key = normName(it.title).slice(0, 60);
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 90)
    .map(newsCard).join("");
}

// ----- Shared player row -----
function posRank(player) {
  // 1-based rank among same-position players (players array is rank-sorted).
  let n = 0;
  for (const p of state.players) {
    if (p.pos === player.pos) {
      n++;
      if (p.id === player.id) return n;
    }
  }
  return n;
}

function trendBadges(id) {
  const t = state.trendMap.get(id);
  if (!t) return "";
  let out = "";
  if (t.add) out += `<span class="trend-badge trend-add">▲ ${t.add.toLocaleString()} adds</span>`;
  if (t.drop) out += `<span class="trend-badge trend-drop">▼ ${t.drop.toLocaleString()} drops</span>`;
  return out;
}

// "market #N" note: where standard 1-QB consensus ranks a player vs this
// league's board. A green ▲ means leaguemates likely undervalue them here.
function marketNote(p) {
  if (!p.mrank || !p.lrank || Math.abs(p.mrank - p.lrank) < 5) return "";
  const up = p.mrank > p.lrank;
  return `<span class="mkt-note ${up ? "mkt-up" : ""}">${up ? "▲" : "▽"} market #${p.mrank}</span>`;
}

function playerRow(p, index, { withActions } = {}) {
  const status = state.draft[p.id];
  const cls = status === "mine" ? "is-mine" : status === "taken" ? "is-taken" : "";
  const injury = p.injury ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)}</span>` : "";
  const actions = withActions
    ? `<div class="row-actions">
        <button class="chip chip-mine ${status === "mine" ? "on" : ""}" data-act="mine" data-id="${p.id}">MINE</button>
        <button class="chip chip-taken ${status === "taken" ? "on" : ""}" data-act="taken" data-id="${p.id}">GONE</button>
      </div>`
    : "";
  return `<div class="player-row ${cls}">
    <div class="rank-num">${index}</div>
    <div class="player-info">
      <div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-sub">
        <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}${posRank(p)}</span>
        <span>${escapeHtml(p.team)}</span>
        ${marketNote(p)}
        ${adpOf(p) !== null ? `<span class="mkt-note">ADP ${adpOf(p)}</span>` : ""}
        ${injury}
        ${trendBadges(p.id)}
      </div>
    </div>
    ${actions}
  </div>`;
}

function filterPlayers(pos, query) {
  const q = query.trim().toLowerCase();
  return state.players.filter((p) =>
    (pos === "ALL" || p.pos === pos) &&
    (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)));
}

// ----- Rankings -----
function renderRankings() {
  const el = document.getElementById("rankings-list");
  if (!state.players.length) return;
  const list = filterPlayers(state.rankPos, state.rankQuery).slice(0, 200);
  el.innerHTML = list.length
    ? list.map((p, i) => playerRow(p, i + 1)).join("")
    : '<div class="loading">No players match.</div>';
}

// ----- Draft: live Pick Advisor -----
const TEAMS_IN_LEAGUE = 10;
const DRAFT_ROUNDS = 17; // 10 starters (incl. FLEX + OP) + 7 bench

// Shared 2-QB-adjusted board value curve (used by advisor, trades, rankings).
function boardValue(p) {
  return Math.max(4, 32 - 5 * Math.log(p.lrank || 200));
}

// Roster-need multiplier shared by the Pick Advisor and the mock simulator.
function needFactorFor(c, rosterSize, pos) {
  switch (pos) {
    case "QB": return c.QB < 2 ? 1.1 : c.QB === 2 ? 0.5 : 0.2; // 2-QB league
    // FLEX slot makes the 3rd RB/WR a near-starter, so depth stays valuable.
    case "RB": return c.RB < 2 ? 1.05 : Math.max(0.55, 0.95 - (c.RB - 2) * 0.08);
    case "WR": return c.WR < 2 ? 1.05 : Math.max(0.55, 0.95 - (c.WR - 2) * 0.08);
    case "TE": return c.TE < 1 ? 1.0 : 0.4;
    case "K": return c.K >= 1 ? 0.05 : rosterSize >= 12 ? 1.1 : rosterSize >= 10 ? 0.5 : 0.12;
    case "DEF": return c.DEF >= 1 ? 0.05 : rosterSize >= 11 ? 1.1 : rosterSize >= 9 ? 0.5 : 0.12;
    default: return 0.5;
  }
}

function myPickNumbers(slot) {
  const picks = [];
  for (let r = 1; r <= DRAFT_ROUNDS; r++) {
    picks.push((r - 1) * TEAMS_IN_LEAGUE + (r % 2 === 1 ? slot : TEAMS_IN_LEAGUE + 1 - slot));
  }
  return picks;
}

function adpOf(p) {
  return state.adp.get(normName(p.name))?.adp ?? null;
}

// Score every available player for "who should I take RIGHT NOW":
// board value × roster need × won't-be-back urgency × tier scarcity.
function computeDraftAdvice() {
  const mine = state.players.filter((p) => state.draft[p.id] === "mine");
  const count = (pos) => mine.filter((p) => p.pos === pos).length;
  const qb = count("QB"), rb = count("RB"), wr = count("WR"), te = count("TE"),
    k = count("K"), dst = count("DEF");
  const rosterSize = mine.length;

  const picked = Object.keys(state.draft).length;
  const currentPick = picked + 1;
  const myPicks = myPickNumbers(state.draftSlot);
  const nextMyPick = myPicks.find((n) => n >= currentPick) ?? currentPick;
  const followingMyPick = myPicks.find((n) => n > nextMyPick) ?? nextMyPick + 19;

  const counts = { QB: qb, RB: rb, WR: wr, TE: te, K: k, DEF: dst };
  const needFactor = (pos) => needFactorFor(counts, rosterSize, pos);

  const tierSize = { QB: 20, RB: 24, WR: 24, TE: 12, K: 10, DEF: 10 };
  const available = state.players.filter((p) => !state.draft[p.id] && !/^(Out|IR|Sus|NA)/i.test(p.injury || ""));
  const leftInTier = {};
  for (const pos of POSITIONS) {
    leftInTier[pos] = available.filter((p) => p.pos === pos && posRank(p) <= tierSize[pos]).length;
  }

  // Late-draft sleeper mode: from ~round 7 the advisor blends in breakout
  // signals — 24h add surges and rank risers — ramping to full weight by R10.
  const round = Math.ceil(currentPick / TEAMS_IN_LEAGUE);
  const lateFactor = Math.min(1, Math.max(0, (round - 6) / 4));

  const scoredCandidates = available.slice(0, 60).map((p) => {
    const v = boardValue(p);
    const nf = needFactor(p.pos);
    const adp = adpOf(p);
    const goneByNextTurn = adp !== null && adp < nextMyPick;
    const urgency = goneByNextTurn && nf >= 0.5 ? 1.12 : 1;
    const lastOfTier = leftInTier[p.pos] > 0 && leftInTier[p.pos] <= 2 && posRank(p) <= tierSize[p.pos];
    const scarcity = lastOfTier ? 1.08 : 1;
    const reasons = [];
    if (nf >= 1) reasons.push(`fills your ${p.pos === "DEF" ? "D/ST" : p.pos} starter need`);
    else if (nf >= 0.8) reasons.push(`solid ${p.pos} depth`);
    if (goneByNextTurn) reasons.push(`ADP ${adp} — likely gone before your pick #${nextMyPick}`);
    else if (adp !== null && adp < followingMyPick) reasons.push(`ADP ${adp} — won't survive two more turns`);
    if (lastOfTier) reasons.push(`one of the last ${leftInTier[p.pos]} startable ${p.pos === "DEF" ? "D/ST" : p.pos}s`);
    if (p.mrank && p.lrank && p.mrank - p.lrank >= 8) reasons.push(`market #${p.mrank} — leaguemates will undervalue`);
    let upside = 1;
    const buzz = state.trendMap.get(p.id)?.add || 0;
    const riser = state.rankDeltas?.moves?.find((m) => m.id === p.id);
    if (lateFactor > 0 && buzz >= 500) {
      upside += lateFactor * Math.min(0.3, buzz / 30000);
      reasons.push(`🔥 ${buzz.toLocaleString()} adds in 24h — sleeper buzz`);
    }
    if (lateFactor > 0 && riser) {
      upside += lateFactor * 0.1;
      reasons.push(`📈 up ${riser.from - riser.to} rank spots — riser`);
    }
    return { p, score: v * nf * urgency * scarcity * upside, reasons, adp };
  }).sort((a, b) => b.score - a.score);

  // Dedicated late-round stash list: deep-ranked players the fantasy world is
  // grabbing — shown even when they don't crack the top-3 recommendation.
  const sleeperWatch = lateFactor > 0
    ? available
        .filter((p) => (p.lrank > 60 || p.rank > 200))
        .map((p) => ({ p, buzz: state.trendMap.get(p.id)?.add || 0, riser: state.rankDeltas?.moves?.find((m) => m.id === p.id) }))
        .filter((x) => x.buzz >= 500 || x.riser)
        .sort((a, b) => b.buzz - a.buzz)
        .slice(0, 3)
    : [];

  // Positions safe to wait on: your need, but the best of them should
  // still be there at your next turn per ADP.
  const waits = [];
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    if (needFactor(pos) < 0.8) continue;
    const best = available.find((x) => x.pos === pos);
    const adp = best && adpOf(best);
    if (best && adp !== null && adp > followingMyPick) {
      waits.push(`${pos} can wait — ${best.name} (ADP ${adp}) should last past pick #${followingMyPick}`);
    }
  }

  return { currentPick, nextMyPick, top: scoredCandidates.slice(0, 3), waits, sleeperWatch };
}

// ----- ESPN live draft auto-follow -----
// During a live draft, the public league's rosters fill pick by pick. Poll
// them and mirror every pick onto the draft board: opponents' players marked
// GONE, yours marked MINE. Advisor + rankings recompute on each tick.
const DRAFT_FOLLOW_MS = 20 * 1000;
let draftFollowTimer = null;
let draftFollowLatest = [];

async function draftFollowTick() {
  await loadEspnLeague();
  const statusEl = document.getElementById("draft-follow-status");
  if (!state.espn) {
    statusEl.textContent = `⚠ Couldn't reach ESPN (${state.espnError || "network"}) — retrying in 20s.`;
    return;
  }
  const newly = [];
  for (const t of state.espn.teams) {
    const mineTeam = t.id === state.espnCfg.teamId;
    for (const id of t.ids) {
      if (!state.draft[id]) {
        state.draft[id] = mineTeam ? "mine" : "taken";
        const p = state.byId.get(id);
        if (p) newly.push(mineTeam ? `${p.name} → YOU` : p.name);
      }
    }
  }
  if (newly.length) {
    saveDraft();
    draftFollowLatest = newly.slice(-4);
    renderDraft();
    renderRankings();
  }
  const picks = Object.keys(state.draft).length;
  statusEl.innerHTML = `🔴 <b>Following your draft</b> · ${picks} picks marked · updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` +
    (draftFollowLatest.length ? `<br>Latest: ${draftFollowLatest.map(escapeHtml).join(" · ")}` : "");
}

async function startDraftFollow() {
  const statusEl = document.getElementById("draft-follow-status");
  const btn = document.getElementById("draft-follow");
  if (draftFollowTimer) { // toggle off
    clearInterval(draftFollowTimer);
    draftFollowTimer = null;
    btn.textContent = "🔴 Follow my draft";
    statusEl.textContent = `⏹ Stopped following. ${Object.keys(state.draft).length} picks are marked on the board.`;
    return;
  }
  if (state.espnCfg.teamId == null) {
    // Try the self-healing name match before giving up.
    statusEl.textContent = "Reconnecting to your ESPN team…";
    await loadEspnLeague().catch(() => {});
    if (state.espnCfg.teamId == null) {
      statusEl.textContent = "⚠ First tell the app which team is yours: Start/Sit tab → Manage My Roster → Sync from ESPN → Auto-fetch → tap your team. Then come back and Follow.";
      return;
    }
  }
  btn.textContent = "⏹ Stop following";
  statusEl.textContent = "Refreshing rankings, ADP, and league data for draft day…";
  // Draft-day freshness: bust slow caches so the board is current.
  localStorage.removeItem(PLAYERS_CACHE_KEY);
  localStorage.removeItem(ADP_CACHE_KEY);
  await loadAll(true);
  await draftFollowTick();
  draftFollowTimer = setInterval(() => draftFollowTick().catch(() => {}), DRAFT_FOLLOW_MS);
}

// ----- Mock draft simulator -----
// Simulates the REST of the draft from the current board state, in memory —
// the real draft tracker is never touched. AI teams pick near their 2-QB ADP
// with noise and simple roster logic; my picks use the advisor's need-scoring.
function runMockDraft() {
  const pool = state.players
    .filter((p) => !state.draft[p.id] && !/^(Out|IR|Sus)/i.test(p.injury || ""))
    .slice(0, 400)
    .sort((a, b) => (adpOf(a) ?? (a.mrank || 250) * 1.1) - (adpOf(b) ?? (b.mrank || 250) * 1.1));
  const finalMine = state.players.filter((p) => state.draft[p.id] === "mine").map((p) => p.id);
  const slot = state.draftSlot;
  const aiCounts = {};
  const myLog = [];
  const posCountsOf = (ids) => {
    const c = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    for (const id of ids) { const p = state.byId.get(id); if (p) c[p.pos]++; }
    return c;
  };
  const takeFrom = (arr, p) => arr.splice(arr.indexOf(p), 1);

  const startPick = Object.keys(state.draft).length + 1;
  for (let pick = startPick; pick <= TEAMS_IN_LEAGUE * DRAFT_ROUNDS && pool.length; pick++) {
    const round = Math.ceil(pick / TEAMS_IN_LEAGUE);
    const idxInRound = pick - (round - 1) * TEAMS_IN_LEAGUE;
    const teamIdx = round % 2 === 1 ? idxInRound : TEAMS_IN_LEAGUE + 1 - idxInRound;

    if (teamIdx === slot && finalMine.length < DRAFT_ROUNDS) {
      const counts = posCountsOf(finalMine);
      const scored = pool
        .map((p) => ({ p, s: boardValue(p) * needFactorFor(counts, finalMine.length, p.pos) }))
        .sort((a, b) => b.s - a.s);
      const best = scored[0].p;
      const alts = scored.slice(1, 3).map((x) => x.p.name);
      finalMine.push(best.id);
      takeFrom(pool, best);
      myLog.push({ round, pick, p: best, alts });
    } else {
      const c = (aiCounts[teamIdx] ||= { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0, n: 0 });
      const caps = { QB: 3, RB: 8, WR: 8, TE: 3, K: 1, DEF: 1 };
      const eligible = pool.filter((p) =>
        c[p.pos] < caps[p.pos] && ((p.pos !== "K" && p.pos !== "DEF") || round >= 12));
      const cands = (eligible.length ? eligible : pool).slice(0, 5);
      const choice = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
      c[choice.pos]++; c.n++;
      takeFrom(pool, choice);
    }
  }
  return { myLog, finalMine };
}

function renderMockResult({ myLog, finalMine }) {
  const el = document.getElementById("mock-result");
  const roster = finalMine.map((id) => state.byId.get(id)).filter(Boolean);
  const { starters } = optimizeLineup(roster);
  const total = starters.reduce((s, x) => s + (x.pick?.adjusted || 0), 0);
  let html = `<div class="advisor-status">Mock complete — your simulated roster projects
    <b>${total.toFixed(1)}</b> as an optimal lineup. AI picks are randomized around ADP: run it again for a different board.</div>`;
  html += myLog.map((m) => `<div class="player-row">
    <div class="rank-num">R${m.round}</div>
    <div class="player-info">
      <div class="player-name">Pick ${m.pick}: ${escapeHtml(m.p.name)}</div>
      <div class="player-sub">
        <span class="pos-tag pos-${m.p.pos}">${m.p.pos === "DEF" ? "D/ST" : m.p.pos}${posRank(m.p)}</span>
        ${adpOf(m.p) !== null ? `<span class="mkt-note">ADP ${adpOf(m.p)}</span>` : ""}
        ${m.alts.length ? `<span>also there: ${m.alts.map(escapeHtml).join(", ")}</span>` : ""}
      </div>
    </div>
  </div>`).join("");
  el.innerHTML = html;
}

function renderDraftAdvisor() {
  const el = document.getElementById("advisor-body");
  if (!state.players.length) return;
  const a = computeDraftAdvice();
  if (!a.top.length) { el.innerHTML = '<div class="loading">Board is empty.</div>'; return; }
  const round = Math.ceil(a.currentPick / TEAMS_IN_LEAGUE);
  let html = `<div class="advisor-status">Pick <b>#${a.currentPick}</b> (round ${round}) is on the clock ·
    your next pick: <b>#${a.nextMyPick}</b></div>`;
  a.top.forEach((c, i) => {
    html += `<div class="advisor-rec ${i === 0 ? "advisor-best" : ""}">
      <div class="rec-rank">${i === 0 ? "★" : i + 1}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(c.p.name)}</div>
        <div class="player-sub">
          <span class="pos-tag pos-${c.p.pos}">${c.p.pos === "DEF" ? "D/ST" : c.p.pos}${posRank(c.p)}</span>
          <span>${escapeHtml(c.p.team)}</span>
          ${c.adp !== null ? `<span class="mkt-note">ADP ${c.adp}</span>` : ""}
        </div>
        ${c.reasons.length ? `<div class="rec-reasons">${c.reasons.map((r) => `<span>• ${escapeHtml(r)}</span>`).join(" ")}</div>` : ""}
      </div>
    </div>`;
  });
  if (a.waits.length) {
    html += `<div class="advisor-waits">🕐 ${a.waits.map(escapeHtml).join("<br>🕐 ")}</div>`;
  }
  if (a.sleeperWatch?.length) {
    html += `<div class="advisor-waits">💎 Sleeper watch: ${a.sleeperWatch.map((s) =>
      `<b>${escapeHtml(s.p.name)}</b> (${s.p.pos}${posRank(s.p)}${s.buzz ? `, ${s.buzz.toLocaleString()} adds/24h` : ""}${s.riser ? `, ▲${s.riser.from - s.riser.to} spots` : ""})`).join(" · ")}</div>`;
  }
  el.innerHTML = html;
}

// ----- Draft -----
function renderDraft() {
  if (!state.players.length) return;

  const entries = Object.entries(state.draft);
  document.getElementById("draft-pick-count").textContent = entries.length;
  document.getElementById("draft-my-count").textContent =
    entries.filter(([, v]) => v === "mine").length;

  renderDraftAdvisor();
  renderRoster();
  renderScarcity();

  const el = document.getElementById("draft-list");
  let list = filterPlayers(state.draftPos, state.draftQuery);
  if (state.hideDrafted) list = list.filter((p) => !state.draft[p.id]);
  list = list.slice(0, 200);
  el.innerHTML = list.length
    ? list.map((p, i) => playerRow(p, i + 1, { withActions: true })).join("")
    : '<div class="loading">No players match.</div>';
}

function renderRoster() {
  const mine = state.players.filter((p) => state.draft[p.id] === "mine");
  const used = new Set();

  const fill = (want) => {
    const eligible = SLOT_ELIGIBLE[want] || [want];
    for (const p of mine) {
      if (!used.has(p.id) && eligible.includes(p.pos)) { used.add(p.id); return p; }
    }
    return null;
  };

  let html = "";
  for (const [slot, count] of ROSTER_SLOTS) {
    for (let i = 0; i < count; i++) {
      let p = null;
      if (slot === "Bench" || slot === "IR") {
        p = mine.find((x) => !used.has(x.id)) || null;
        if (p) used.add(p.id);
      } else {
        p = fill(slot);
      }
      html += p
        ? `<div class="roster-slot"><span class="slot-label">${slot}</span>
             <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span>
             ${escapeHtml(p.name)}</div>`
        : `<div class="roster-slot empty"><span class="slot-label">${slot}</span> —</div>`;
    }
  }
  document.getElementById("my-roster").innerHTML = html;
}

function renderScarcity() {
  // How many of each position's top-24 (top-12 for QB/TE/K/DEF) are still on the board.
  const el = document.getElementById("scarcity");
  let html = "";
  for (const pos of POSITIONS) {
    // QB tier = 20: this is a 2-QB league (10 teams × QB + OP slots).
    const tierSize = pos === "QB" ? 20 : (pos === "RB" || pos === "WR") ? 24 : 12;
    const top = state.players.filter((p) => p.pos === pos).slice(0, tierSize);
    const left = top.filter((p) => !state.draft[p.id]).length;
    const hot = left <= Math.ceil(tierSize / 4);
    html += `<div class="scarcity-cell">
      <b class="${hot ? "scarcity-hot" : ""}">${left} / ${tierSize}</b>
      ${pos === "DEF" ? "D/ST" : pos} top tier left
      ${hot ? '<div class="scarcity-note scarcity-hot">⚠ running out — consider drafting</div>' : ""}
    </div>`;
  }
  el.innerHTML = html;
}

// ----- Waivers -----
function renderWaivers() {
  const renderCol = (containerId, trends, label) => {
    const el = document.getElementById(containerId);
    if (!trends.length) {
      el.innerHTML = '<div class="loading">No trend data right now.</div>';
      return;
    }
    el.innerHTML = trends.map((t) => {
      const p = state.byId.get(t.id);
      if (!p) return "";
      return `<div class="waiver-card">
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)}</div>
          <div class="player-sub">
            <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span>
            <span>${escapeHtml(p.team)}</span>
            ${p.pos === "QB" ? '<span class="trend-badge trend-add">2-QB league value</span>' : ""}
            ${leagueAvailability(p.id)}
            ${p.injury ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)}</span>` : ""}
          </div>
        </div>
        <div class="waiver-count"><b>${t.count.toLocaleString()}</b><small>${label} · 24h</small></div>
      </div>`;
    }).join("");
  };
  renderCol("waiver-adds", state.trendingAdd, "adds");
  renderCol("waiver-drops", state.trendingDrop, "drops");
}

// ----- Bills live game feed -----
function billsGameEntry() {
  const T = MY_NFL_TEAM.sleeper;
  return state.games.find((g) => g.home === T || g.away === T) || null;
}

// Pull everything that moves during a game: scoring plays, game-thread
// comments, live Bluesky chatter, and followed insiders' posts.
async function loadBillsExtras() {
  const g = billsGameEntry();
  const jobs = [];

  if (g?.eventId) {
    jobs.push(fetchJSON(ESPN_SUMMARY_URL(g.eventId)).then((d) => {
      state.billsLive.plays = (d?.scoringPlays || []).map((sp) => ({
        text: sp.text || "",
        team: sp.team?.abbreviation || "",
        period: sp.period?.number ?? "",
        clock: sp.clock?.displayValue || "",
        score: sp.awayScore !== undefined ? `${sp.awayScore}-${sp.homeScore}` : "",
      }));
    }).catch(() => { /* no summary yet */ }));
  }

  if (state.billsGameThread) {
    jobs.push(fetchJSON(`https://www.reddit.com/comments/${state.billsGameThread.id}.json?sort=new&limit=40`)
      .then((arr) => {
        const children = arr?.[1]?.data?.children || [];
        state.billsLive.gtComments = children
          .filter((c) => c.kind === "t1")
          .map((c) => c.data)
          .filter((c) => c?.body && c.body !== "[deleted]" && c.author !== "AutoModerator")
          .slice(0, 20)
          .map((c) => ({
            title: c.body.slice(0, 240),
            desc: "",
            url: state.billsGameThread.url,
            ts: c.created_utc * 1000,
            tag: "Game Thread",
            extra: `u/${c.author} · ▲ ${c.ups || 0}`,
          }));
      }).catch(() => { /* thread comments unavailable */ }));
  }

  // Extra live searches only matter while the game is on.
  if (g?.status === "in") {
    jobs.push(Promise.allSettled(["Josh Allen", "#BillsMafia"].map(fetchBsky)).then((results) => {
      state.billsLive.liveBsky = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    }));
  }

  // Followed insiders (user-curated Bluesky handles) — no like-count filter.
  if (state.bskyHandles.length) {
    jobs.push(Promise.allSettled(state.bskyHandles.map(async (handle) => {
      const res = await fetchWithTimeout(BSKY_AUTHOR_FEED(handle));
      const json = await res.json();
      return (json?.feed || []).map((f) => f.post).filter((p) => p?.record?.text).map((p) => {
        const rkey = String(p.uri || "").split("/").pop();
        return {
          title: p.record.text.slice(0, 220),
          desc: "",
          url: `https://bsky.app/profile/${p.author?.handle}/post/${rkey}`,
          ts: new Date(p.record.createdAt || Date.now()).getTime(),
          tag: "Bluesky",
          extra: `✔ @${p.author?.handle || handle} · ♥ ${p.likeCount ?? 0}`,
        };
      });
    })).then((results) => {
      state.billsLive.authorPosts = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    }));
  }

  await Promise.allSettled(jobs);
}

function renderBillsLive() {
  const el = document.getElementById("bills-live");
  if (!el) return;
  const g = billsGameEntry();
  const T = MY_NFL_TEAM.sleeper;

  let statusCard = "";
  if (g && (g.status === "in" || g.status === "post") && g.hScore !== null) {
    const live = g.status === "in";
    const lastPlay = state.billsLive.plays[state.billsLive.plays.length - 1];
    statusCard = `<div class="bet-card ${live ? "live-card" : ""}">
      <div class="bet-head">
        <b>${live ? '<span class="live-dot"></span> LIVE · ' : "FINAL · "}${escapeHtml(g.away)} ${g.aScore} @ ${escapeHtml(g.home)} ${g.hScore}</b>
        <span class="bet-lines">${escapeHtml(g.statusDetail)}</span>
      </div>
      ${lastPlay ? `<div class="bet-sub">Last score: ${escapeHtml(lastPlay.text)} (${escapeHtml(String(lastPlay.score))})</div>` : ""}
      ${live ? '<div class="bet-sub">Feed refreshes every 45s while the game is on.</div>' : ""}
      ${state.billsLive.plays.length ? `<details><summary class="bet-sub" style="cursor:pointer">All scoring plays (${state.billsLive.plays.length})</summary>
        <ul class="bet-angles">${state.billsLive.plays.map((p) =>
          `<li>Q${p.period} ${escapeHtml(p.clock)} — ${escapeHtml(p.text)} (${escapeHtml(String(p.score))})</li>`).join("")}</ul></details>` : ""}
    </div>`;
  }

  // The live timeline: insiders + live chatter + team Bluesky + game thread.
  const items = [
    ...state.billsLive.authorPosts,
    ...state.billsLive.liveBsky,
    ...state.bskyBills,
    ...state.billsLive.gtComments,
  ];
  const seen = new Set();
  const feed = items.filter((it) => {
    const key = normName(it.title).slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.ts - a.ts).slice(0, 30);

  el.innerHTML = statusCard + (feed.length
    ? `<h3 class="waiver-head" style="margin-top:${statusCard ? "14px" : "0"}">📡 Live feed — insiders &amp; ${escapeHtml(T)} chatter</h3>
       <div class="card-list">${feed.map(newsCard).join("")}</div>`
    : "");
}

// ----- My NFL team tab (Bills HQ) -----
function renderBills() {
  const T = MY_NFL_TEAM.sleeper;

  // Header: record, standing, next game with line + weather.
  const headEl = document.getElementById("bills-header");
  const game = state.schedule.get(T);
  const g = state.games.find((x) => x.home === T || x.away === T);
  let next = "";
  if (game) {
    const vs = `${game.homeAway === "home" ? "vs" : "@"} ${game.opp}`;
    const kick = new Date(game.date);
    const line = g && g.details ? ` · ${g.details}${g.ou !== null ? ` · O/U ${g.ou}` : ""}` : "";
    const wx = state.weather.get(game.homeAway === "home" ? T : game.opp);
    next = `This week: <b>${vs}</b> · ${kick.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}${line}` +
      (typeof game.implied === "number" ? ` · implied ${game.implied} pts` : "") +
      (wx ? ` · ${wx.wind}mph ${wx.temp}°F` : "");
  } else if (state.schedule.size) {
    next = "This week: <b>BYE</b> — rest up for the stretch run.";
  }
  headEl.innerHTML = `<div class="bet-card">
    <div class="bet-head"><b>${MY_NFL_TEAM.emoji} ${MY_NFL_TEAM.name}</b>
      <span class="bet-lines">${state.teamInfo?.record ? escapeHtml(state.teamInfo.record) : ""}${state.teamInfo?.standing ? ` · ${escapeHtml(state.teamInfo.standing)}` : ""}</span>
    </div>
    ${next ? `<div class="bet-sub">${next}</div>` : ""}
  </div>`;

  // Injury report (official, via ESPN).
  const injEl = document.getElementById("bills-injuries");
  const inj = state.injuryByTeam.get(T) || [];
  injEl.innerHTML = inj.length
    ? inj.map((i) => `<div class="player-row">
        <div class="player-info">
          <div class="player-name">${escapeHtml(i.name)}</div>
          ${i.comment ? `<div class="player-sub"><span>${escapeHtml(i.comment)}</span></div>` : ""}
        </div>
        <span class="trend-badge trend-drop">${escapeHtml(i.status)}</span>
      </div>`).join("")
    : '<div class="loading">No Bills on the injury report right now. 🙏</div>';

  // Schedule: recent results + next few games.
  const schedEl = document.getElementById("bills-schedule");
  if (state.teamSchedule.length) {
    const now = Date.now();
    const past = state.teamSchedule.filter((e) => new Date(e.date).getTime() < now).slice(-3);
    const future = state.teamSchedule.filter((e) => new Date(e.date).getTime() >= now).slice(0, 4);
    schedEl.innerHTML = [...past, ...future].map((e) => `<div class="player-row">
      <div class="player-info"><div class="player-name">${escapeHtml(e.shortName)}</div>
        <div class="player-sub"><span>${new Date(e.date).toLocaleDateString([], { month: "short", day: "numeric" })}</span></div>
      </div>
      ${e.result ? `<span class="trend-badge ${e.result === "W" ? "trend-add" : "trend-drop"}">${e.result}${e.score ? ` ${escapeHtml(e.score)}` : ""}</span>` : ""}
    </div>`).join("");
  } else {
    schedEl.innerHTML = '<div class="loading">Schedule unavailable.</div>';
  }

  // Bills players moving on the fantasy wire.
  const trendEl = document.getElementById("bills-trending");
  const trending = [...state.trendMap.entries()]
    .map(([id, t]) => ({ p: state.byId.get(id), t }))
    .filter((x) => x.p && x.p.team === T);
  trendEl.innerHTML = trending.length
    ? trending.map((x) => `<div class="player-row">
        <div class="player-info"><div class="player-name">${escapeHtml(x.p.name)}</div>
          <div class="player-sub"><span class="pos-tag pos-${x.p.pos}">${x.p.pos}</span>${trendBadges(x.p.id)}</div>
        </div>
      </div>`).join("")
    : '<div class="loading">No Bills players trending in the last 24h.</div>';

  // Merged all-Bills news: team wire + team subreddit + Bills posts from the
  // league-wide feeds, deduped and time-sorted.
  const newsEl = document.getElementById("bills-news");
  const items = [
    ...state.teamNews.map((a) => ({
      title: a.headline, desc: a.description || "",
      url: a.links?.web?.href || "#", ts: new Date(a.published).getTime(),
      tag: "ESPN", extra: "",
    })),
    ...state.teamReddit.map((p) => ({
      title: p.title, desc: p.flair ? `[${p.flair}]` : "",
      url: p.url, ts: p.ts, tag: `r/${MY_NFL_TEAM.subreddit}`, extra: `▲ ${p.score.toLocaleString()}`,
    })),
    ...state.news.filter((a) => TEAM_WORD_RE.test(a.headline + " " + (a.description || ""))).map((a) => ({
      title: a.headline, desc: a.description || "",
      url: a.links?.web?.href || "#", ts: new Date(a.published).getTime(),
      tag: "ESPN", extra: "",
    })),
    ...state.reddit.filter((p) => TEAM_WORD_RE.test(p.title)).map((p) => ({
      title: p.title, desc: "", url: p.url, ts: p.ts, tag: p.tag, extra: `▲ ${p.score.toLocaleString()}`,
    })),
    ...state.bskyBills,
    ...state.rssNews.filter((it) => TEAM_WORD_RE.test(it.title + " " + it.desc)).map((it) => ({ ...it, extra: "" })),
  ];
  const seenTitles = new Set();
  const deduped = items
    .filter((it) => {
      const key = normName(it.title).slice(0, 60);
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50);
  newsEl.innerHTML = deduped.length
    ? deduped.map(newsCard).join("")
    : '<div class="loading">No Bills news right now.</div>';

  renderBillsLive();
}

// ----- Start/Sit & lineup optimizer -----

// Matchup context for a player's NFL team this week. Position-specific
// defense-vs-position ranks are used when available (built from real box
// scores); otherwise overall points-allowed. Plus Vegas implied totals and
// stadium weather.
function matchupFor(team, pos) {
  const game = state.schedule.get(team);
  if (!game) return state.schedule.size ? { bye: true } : null; // null = no schedule data
  const def = state.defense.get(game.opp);
  const dvpRank = pos && state.dvp?.get(game.opp)?.[pos]; // 1 = easiest for this position
  let label = null, cls = "neutral", adj = 0;
  const rank = dvpRank || (def && def.games >= 2 ? def.easeRank : null);
  const vsPos = dvpRank ? ` vs ${pos}` : "";
  if (rank) {
    if (rank <= 8) { label = `Great matchup${vsPos}`; cls = "great"; adj = 0.05; }
    else if (rank <= 16) { label = `Good matchup${vsPos}`; cls = "good"; adj = 0.025; }
    else if (rank <= 24) { label = `Tough matchup${vsPos}`; cls = "tough"; adj = -0.025; }
    else { label = `Brutal matchup${vsPos}`; cls = "brutal"; adj = -0.05; }
  }
  // Weather at the game site (outdoor stadiums only).
  const homeTeam = game.homeAway === "home" ? team : game.opp;
  const wx = state.weather.get(homeTeam) || null;
  const windy = wx && wx.wind >= 18;
  if (windy && (pos === "K" || pos === "QB")) adj -= 0.05; // wind kills kicks & deep balls
  return {
    bye: false,
    opp: game.opp,
    homeAway: game.homeAway,
    label, cls, adj,
    oppPaPerGame: def && def.games >= 2 ? def.paPerGame : null,
    implied: game.implied,
    wx, windy,
  };
}

// Projected points in this league's scoring, matchup-adjusted for sorting.
// Falls back to a rank-derived estimate when projections are unavailable.
function playerScore(p) {
  const m = matchupFor(p.team, p.pos);
  if (m?.bye) return { proj: 0, adjusted: 0, matchup: m, source: "bye" };
  const injOut = /^(Out|IR|PUP|Sus|NA)/i.test(p.injury || "");
  let proj = state.projections.get(p.id);
  let source = "proj";
  if (proj === undefined) {
    // Rough fallback so the optimizer still orders players sensibly — uses the
    // league-adjusted rank so QBs get their 2-QB/6-pt-TD value.
    const r = p.lrank || p.rank;
    proj = Math.max(1, Math.round((20 - 14 * Math.log10(1 + r / 12)) * 10) / 10);
    source = "rank";
  }
  if (injOut) return { proj, adjusted: 0, matchup: m, source: "out" };
  const adjusted = Math.round(proj * (1 + (m?.adj || 0)) * 10) / 10;
  return { proj, adjusted, matchup: m, source };
}

function optimizeLineup(roster) {
  const scored = roster
    .map((p) => ({ p, ...playerScore(p) }))
    .sort((a, b) => b.adjusted - a.adjusted);
  const used = new Set();
  const starters = [];
  const fill = (slot) => {
    const pick = scored.find((s) => !used.has(s.p.id) && SLOT_ELIGIBLE[slot].includes(s.p.pos));
    if (pick) used.add(pick.p.id);
    starters.push({ slot, pick: pick || null });
  };
  // Dedicated position slots first, then FLEX (best remaining RB/WR/TE),
  // then OP (best remaining offensive player — often a 2nd QB here).
  for (const slot of ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "OP", "D/ST", "K"]) fill(slot);
  const bench = scored.filter((s) => !used.has(s.p.id));
  return { starters, bench };
}

function matchupBadge(m) {
  if (!m) return "";
  if (m.bye) return '<span class="mu-badge mu-bye">BYE</span>';
  const vs = `${m.homeAway === "home" ? "vs" : "@"} ${escapeHtml(m.opp)}`;
  const label = m.label
    ? `<span class="mu-badge mu-${m.cls}">${m.label}${m.oppPaPerGame ? ` · ${m.oppPaPerGame.toFixed(1)} pa/g` : ""}</span>`
    : "";
  const vegas = typeof m.implied === "number"
    ? `<span class="mu-badge mu-vegas">Vegas ${m.implied} pts</span>` : "";
  const wx = m.wx
    ? `<span class="mu-badge ${m.windy ? "mu-brutal" : "mu-wx"}">${m.windy ? "💨" : "🌤"} ${m.wx.wind}mph${m.wx.precip >= 50 ? ` · 🌧 ${m.wx.precip}%` : ""} · ${m.wx.temp}°F</span>` : "";
  return `<span class="mu-opp">${vs}</span> ${label} ${vegas} ${wx}`;
}

function renderStartSit() {
  const weekEl = document.getElementById("startsit-week");
  if (state.week && state.seasonYear) {
    const pre = state.seasonType !== 2 ? " (preseason — regular-season data may be limited)" : "";
    weekEl.innerHTML = `Week <strong>${state.week}</strong>, ${state.seasonYear}${pre} · projections scored with <strong>your exact league rules</strong> (6-pt pass TDs, half-PPR, OP slot) + matchup strength.`;
  }
  renderMyTeamManager();
  renderLineup();
  renderEspnStatus();
  renderOptLog();
}

function renderMyTeamManager() {
  document.getElementById("myteam-count").textContent = state.myTeam.length;
  const listEl = document.getElementById("myteam-list");
  const roster = state.myTeam.map((id) => state.byId.get(id)).filter(Boolean);
  listEl.innerHTML = roster.length
    ? roster.map((p) => `<div class="player-row">
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)}</div>
          <div class="player-sub">
            <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span>
            <span>${escapeHtml(p.team)}</span>
            ${p.injury ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)}</span>` : ""}
          </div>
        </div>
        <button class="chip chip-taken" data-remove-id="${p.id}">✕ REMOVE</button>
      </div>`).join("")
    : '<div class="loading">No players yet — search above or import your draft picks.</div>';
}

function renderMyTeamSuggestions(query) {
  const el = document.getElementById("myteam-suggestions");
  const q = query.trim().toLowerCase();
  if (q.length < 2) { el.innerHTML = ""; return; }
  const matches = state.players
    .filter((p) => !state.myTeam.includes(p.id) && p.name.toLowerCase().includes(q))
    .slice(0, 8);
  el.innerHTML = matches.map((p) => `<div class="player-row">
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-sub">
          <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span>
          <span>${escapeHtml(p.team)}</span>
        </div>
      </div>
      <button class="chip chip-mine" data-add-id="${p.id}">＋ ADD</button>
    </div>`).join("");
}

function renderLineup() {
  const el = document.getElementById("lineup-area");
  const roster = state.myTeam.map((id) => state.byId.get(id)).filter(Boolean);
  if (!roster.length) {
    el.innerHTML = '<div class="loading">Add your roster above to get an optimized lineup.</div>';
    return;
  }
  const { starters, bench } = optimizeLineup(roster);
  const total = starters.reduce((sum, s) => sum + (s.pick?.adjusted || 0), 0);
  const usingProj = starters.some((s) => s.pick?.source === "proj");

  const row = (slot, s) => {
    if (!s) return `<div class="player-row lineup-row"><span class="slot-label">${slot}</span><div class="player-info"><em class="empty-slot">no eligible player</em></div></div>`;
    const { p, proj, adjusted, matchup, source } = s;
    const warn = source === "out" ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)} — do not start</span>`
      : p.injury ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)}</span>` : "";
    return `<div class="player-row lineup-row ${source === "out" ? "is-taken" : ""}">
      <span class="slot-label">${slot}</span>
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-sub">
          <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span>
          <span>${escapeHtml(p.team)}</span>
          ${matchupBadge(matchup)} ${warn}
        </div>
      </div>
      <div class="proj-pts"><b>${adjusted.toFixed(1)}</b><small>proj pts</small></div>
    </div>`;
  };

  let html = "";
  // Head-to-head banner when the ESPN league sync knows this week's opponent.
  if (state.espn?.opponent) {
    const opp = state.espn.opponent;
    const oppRoster = opp.ids.map((id) => state.byId.get(id)).filter(Boolean);
    const oppTotal = optimizeLineup(oppRoster).starters
      .reduce((sum, s) => sum + (s.pick?.adjusted || 0), 0);
    const diff = total - oppTotal;
    html += `<div class="strategy-card"><h4>⚔️ This week vs ${escapeHtml(opp.name)}</h4>
      <p>Your optimal lineup projects <b>${total.toFixed(1)}</b>, theirs projects <b>${oppTotal.toFixed(1)}</b> —
      ${diff >= 0 ? `you're favored by ${diff.toFixed(1)}` : `you're behind by ${(-diff).toFixed(1)}; hit the Waivers tab for upgrades`}.</p></div>`;
  }
  html += `<div class="lineup-card">
    <div class="lineup-head">
      <h3>✅ Optimal Lineup</h3>
      <div class="lineup-total"><b>${total.toFixed(1)}</b><small>total proj</small></div>
    </div>
    ${starters.map((s) => row(s.slot, s.pick)).join("")}
  </div>`;

  if (bench.length) {
    html += `<div class="lineup-card"><div class="lineup-head"><h3>🪑 Bench</h3></div>
      ${bench.map((s) => row("BE", s)).join("")}</div>`;
  }

  // Close calls: bench players projecting within 1.5 pts of a starter they
  // could replace — the classic start/sit decisions worth a second look.
  const closeCalls = [];
  for (const b of bench) {
    if (b.source === "out" || b.adjusted <= 0) continue;
    for (const s of starters) {
      if (!s.pick || s.pick.source === "out") continue;
      if (SLOT_ELIGIBLE[s.slot]?.includes(b.p.pos) && s.pick.adjusted - b.adjusted <= 1.5) {
        closeCalls.push(`<strong>${escapeHtml(b.p.name)}</strong> (${b.adjusted.toFixed(1)}) is within striking distance of <strong>${escapeHtml(s.pick.p.name)}</strong> (${s.pick.adjusted.toFixed(1)}) for ${s.slot} — check the news before kickoff.`);
        break;
      }
    }
  }
  if (closeCalls.length) {
    html += `<div class="strategy-card"><h4>🤔 Close calls</h4><p>${closeCalls.join("<br>")}</p></div>`;
  }
  if (!usingProj) {
    html += `<div class="strategy-card"><h4>ℹ️ Note</h4><p>Weekly projections aren't available right now (common in the offseason), so this ordering uses live consensus ranks + matchup strength instead. During the season you'll get true point projections scored with your league's rules.</p></div>`;
  }
  el.innerHTML = html;
}

// ----- Sleepers -----
function renderSleepers() {
  if (!state.players.length) return;

  // Waiver heaters: heavily added in the last 24h but ranked outside the
  // top 100 — the "act before your leaguemates notice" list.
  const heatEl = document.getElementById("sleepers-heaters");
  const heaters = state.trendingAdd
    .map((t) => ({ ...t, p: state.byId.get(t.id) }))
    .filter((x) => x.p && x.p.rank > 100)
    .slice(0, 15);
  heatEl.innerHTML = heaters.length
    ? heaters.map((x) => `<div class="waiver-card">
        <div class="player-info">
          <div class="player-name">${escapeHtml(x.p.name)}</div>
          <div class="player-sub">
            <span class="pos-tag pos-${x.p.pos}">${x.p.pos === "DEF" ? "D/ST" : x.p.pos}${posRank(x.p)}</span>
            <span>${escapeHtml(x.p.team)}</span>
            ${x.p.pos === "QB" ? '<span class="trend-badge trend-add">2-QB league value</span>' : ""}
            ${leagueAvailability(x.p.id)}
            <span>market #${x.p.mrank || x.p.rank} — flying under the radar</span>
          </div>
        </div>
        <div class="waiver-count"><b>${x.count.toLocaleString()}</b><small>adds · 24h</small></div>
      </div>`).join("")
    : '<div class="loading">No deep sleepers trending right now.</div>';

  // Rank risers computed between visits.
  const riseEl = document.getElementById("sleepers-risers");
  const d = state.rankDeltas;
  if (d?.moves?.length) {
    riseEl.innerHTML = d.moves.map((m) => {
      const p = state.byId.get(m.id);
      if (!p) return "";
      return `<div class="waiver-card">
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.name)}</div>
          <div class="player-sub">
            <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}${posRank(p)}</span>
            <span>${escapeHtml(p.team)}</span>
            <span>#${m.from} → #${m.to} overall</span>
          </div>
        </div>
        <div class="waiver-count"><b>▲ ${m.from - m.to}</b><small>spots · ${d.days}d</small></div>
      </div>`;
    }).join("");
  } else {
    riseEl.innerHTML = '<div class="loading">Risers are computed by comparing rankings between visits at least 12 hours apart. Check back tomorrow.</div>';
  }

  renderUsageTrends();
}

// ----- Usage-spike breakout detector (in-season) -----
const USAGE_KEY = "ghq_usage_v1";

async function loadUsageTrends() {
  if (state.seasonType !== 2 || !state.week || state.week < 2) return;
  const cached = loadJSON(USAGE_KEY, null);
  if (cached && cached.week === state.week && Date.now() - cached.ts < 12 * 60 * 60 * 1000) {
    state.usageTrends = cached.list;
    return;
  }
  const norm = (raw) => Array.isArray(raw)
    ? new Map(raw.map((r) => [String(r.player_id), r.stats || r]))
    : new Map(Object.entries(raw || {}));
  const last = norm(await fetchJSON(statsUrl(state.seasonYear, state.week - 1)));
  const prev = state.week >= 3
    ? norm(await fetchJSON(statsUrl(state.seasonYear, state.week - 2)))
    : new Map();
  const use = (s) => (Number(s?.rec_tgt) || 0) + (Number(s?.rush_att) || 0);
  const list = [];
  for (const [pid, s] of last) {
    const p = state.byId.get(String(pid));
    if (!p || !["RB", "WR", "TE"].includes(p.pos)) continue;
    const lastUse = use(s);
    if (lastUse < 8) continue; // real volume only
    const prevUse = use(prev.get(String(pid)));
    const delta = lastUse - prevUse;
    if (delta < 4) continue;
    list.push({ id: p.id, lastUse, prevUse, delta });
  }
  list.sort((a, b) => b.delta - a.delta);
  state.usageTrends = list.slice(0, 10);
  saveJSON(USAGE_KEY, { ts: Date.now(), week: state.week, list: state.usageTrends });
}

function renderUsageTrends() {
  const el = document.getElementById("sleepers-usage");
  if (!el) return;
  if (!state.usageTrends?.length) return; // keep the explainer text
  el.innerHTML = state.usageTrends.map((u) => {
    const p = state.byId.get(u.id);
    if (!p) return "";
    return `<div class="waiver-card">
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-sub">
          <span class="pos-tag pos-${p.pos}">${p.pos}${posRank(p)}</span>
          <span>${escapeHtml(p.team)}</span>
          <span>targets+carries ${u.prevUse} → ${u.lastUse} last week</span>
          ${leagueAvailability(p.id)}
        </div>
      </div>
      <div class="waiver-count"><b>▲ ${u.delta}</b><small>touches</small></div>
    </div>`;
  }).join("");
}

// ----- Bet ledger -----
const LEDGER_KEY = "ghq_ledger_v1";

function betProfit(b) {
  if (b.status === "won") return b.odds > 0 ? b.stake * (b.odds / 100) : b.stake * (100 / Math.abs(b.odds));
  if (b.status === "lost") return -b.stake;
  return 0; // open or push
}

function renderLedger() {
  const listEl = document.getElementById("ledger-list");
  const statsEl = document.getElementById("ledger-stats");
  if (!listEl) return;
  const bets = loadJSON(LEDGER_KEY, []);
  const settled = bets.filter((b) => b.status !== "open");
  const w = settled.filter((b) => b.status === "won").length;
  const l = settled.filter((b) => b.status === "lost").length;
  const pu = settled.filter((b) => b.status === "push").length;
  const net = settled.reduce((s, b) => s + betProfit(b), 0);
  const staked = settled.reduce((s, b) => s + (b.status === "push" ? 0 : b.stake), 0);
  statsEl.textContent = settled.length
    ? `Record ${w}-${l}${pu ? `-${pu}` : ""} · net ${net >= 0 ? "+" : ""}$${net.toFixed(2)}${staked ? ` · ROI ${((net / staked) * 100).toFixed(1)}%` : ""}`
    : "No settled bets yet — log bets here to learn which angle types actually win for you.";
  listEl.innerHTML = bets.length
    ? bets.slice().reverse().map((b) => `<div class="player-row ${b.status === "won" ? "is-mine" : b.status === "lost" ? "is-taken" : ""}">
        <div class="player-info">
          <div class="player-name">${escapeHtml(b.desc)}</div>
          <div class="player-sub"><span>${b.odds > 0 ? "+" : ""}${b.odds} · $${b.stake}</span>
            ${b.status !== "open" ? `<span class="trend-badge ${b.status === "won" ? "trend-add" : b.status === "lost" ? "trend-drop" : "mkt-note"}">${b.status}${b.status !== "push" ? ` ${betProfit(b) >= 0 ? "+" : ""}$${betProfit(b).toFixed(2)}` : ""}</span>` : ""}
          </div>
        </div>
        <div class="row-actions">
          ${b.status === "open" ? `
            <button class="chip chip-mine" data-bet="${b.id}" data-res="won">W</button>
            <button class="chip chip-taken" data-bet="${b.id}" data-res="lost">L</button>
            <button class="chip" data-bet="${b.id}" data-res="push">P</button>` : ""}
          <button class="chip" data-bet="${b.id}" data-res="delete">✕</button>
        </div>
      </div>`).join("")
    : "";
}

// ----- Notifications -----
function notifyEnabled() {
  return localStorage.getItem(NOTIFY_KEY) === "on" &&
    typeof Notification !== "undefined" && Notification.permission === "granted";
}

function updateNotifyUI() {
  const btn = document.getElementById("notify-btn");
  const on = notifyEnabled();
  btn.textContent = on ? "🔔" : "🔕";
  btn.title = on ? "Notifications on — tap to turn off" : "Notifications off — tap to turn on";
  const note = document.getElementById("news-notify-note");
  if (typeof Notification === "undefined") {
    note.innerHTML = "🔕 This browser doesn't support notifications. On iPhone: add the app to your Home Screen (Share → Add to Home Screen) and open it from there.";
  } else if (on) {
    note.innerHTML = "🔔 Alerts on: you'll get a notification for injury news and breakout waiver adds while the app is open (checks every 10 min).";
  } else {
    note.innerHTML = "🔕 Tap the bell (top right) to get alerts for injury news and hot waiver pickups while the app is open.";
  }
}

async function toggleNotifications() {
  if (typeof Notification === "undefined") { updateNotifyUI(); return; }
  if (notifyEnabled()) {
    localStorage.setItem(NOTIFY_KEY, "off");
  } else {
    const perm = await Notification.requestPermission();
    localStorage.setItem(NOTIFY_KEY, perm === "granted" ? "on" : "off");
  }
  updateNotifyUI();
}

function showNotification(title, body) {
  const opts = { body, icon: "icon-192.png", badge: "icon-192.png" };
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, opts))
      .catch(() => { try { new Notification(title, opts); } catch { /* unsupported */ } });
  } else {
    try { new Notification(title, opts); } catch { /* unsupported */ }
  }
}

// After each refresh, alert on new injury headlines and new top waiver adds.
function maybeNotify() {
  if (!notifyEnabled()) return;
  // First run just seeds the "seen" list — don't blast alerts for old items.
  const firstRun = localStorage.getItem(SEEN_KEY) === null;
  const seen = loadJSON(SEEN_KEY, { news: [], adds: [] });
  const seenNews = new Set(seen.news);
  const seenAdds = new Set(seen.adds);
  let fired = 0;

  const headlines = [
    ...state.news.map((a) => ({ text: a.headline, body: a.description || "" })),
    ...state.reddit.map((p) => ({ text: p.title, body: p.flair || "" })),
    ...state.teamNews.map((a) => ({ text: a.headline, body: a.description || "" })),
    ...state.teamReddit.map((p) => ({ text: p.title, body: p.flair || "" })),
    ...state.rssNews.map((it) => ({ text: it.title, body: it.desc || "" })),
    ...state.bskyPosts.map((it) => ({ text: it.title, body: "" })),
    ...state.bskyBills.map((it) => ({ text: it.title, body: "" })),
  ];
  // Priority pass: headlines about MY players get their own alert budget.
  let myFired = 0;
  for (const h of headlines) {
    const key = (h.text || "").slice(0, 120);
    if (!key || seenNews.has(key)) continue;
    const mine = mentionsMyPlayer(h.text + " " + h.body);
    if (mine && INJURY_RE.test(h.text + " " + h.body)) {
      seenNews.add(key);
      if (!firstRun && myFired < 3) {
        showNotification(`🚨 Your player: ${mine.name}`, h.text);
        myFired++;
      }
    }
  }
  for (const h of headlines) {
    const key = (h.text || "").slice(0, 120);
    if (!key || seenNews.has(key)) continue;
    seenNews.add(key);
    if (INJURY_RE.test(h.text + " " + h.body) && !firstRun && fired < 2) {
      showNotification("⚕ Injury news", h.text);
      fired++;
    }
  }
  for (const t of state.trendingAdd.slice(0, 10)) {
    if (seenAdds.has(t.id)) continue;
    seenAdds.add(t.id);
    const p = state.byId.get(t.id);
    if (p && !firstRun && fired < 3) {
      showNotification("🔥 Hot waiver add", `${p.name} (${p.pos}, ${p.team}) — ${t.count.toLocaleString()} adds in 24h`);
      fired++;
    }
  }
  saveJSON(SEEN_KEY, {
    news: [...seenNews].slice(-300),
    adds: [...seenAdds].slice(-300),
  });
}

// ----- Betting: prop & parlay ideas from live data -----
// No free API serves prop LINES, so this generates prop ANGLES: projected
// stat lines (Sleeper) + Vegas totals + defense-vs-position + weather.

function projStatOf(p, key) {
  const line = state.projStats.get(p.id);
  return line ? Number(line[key]) || 0 : 0;
}

function topPlayersFor(team, poss, n = 2) {
  return state.players
    .filter((p) => p.team === team && poss.includes(p.pos) && !/^(Out|IR|Sus)/i.test(p.injury || ""))
    .map((p) => ({ p, proj: state.projections.get(p.id) || 0 }))
    .filter((x) => x.proj > 0)
    .sort((a, b) => b.proj - a.proj)
    .slice(0, n);
}

// One prop idea per strong player situation, ranked by conviction score.
function buildPropIdeas() {
  const ideas = [];
  for (const g of state.games) {
    for (const [team, implied] of [[g.home, g.hTotal], [g.away, g.aTotal]]) {
      const impliedOk = implied === null || implied >= 21;
      for (const { p } of [...topPlayersFor(team, ["QB"], 1), ...topPlayersFor(team, ["RB", "WR", "TE"], 3)]) {
        const m = matchupFor(p.team, p.pos);
        if (!m || m.bye) continue;
        const great = m.cls === "great" || m.cls === "good";
        if (!great && !(implied >= 25)) continue;
        let text = null, stat = 0;
        if (p.pos === "QB" && !m.windy) {
          stat = projStatOf(p, "pass_yd");
          if (stat >= 230) {
            text = `Passing yards OVER — projected ~${Math.round(stat)} yds`;
            const tds = projStatOf(p, "pass_td");
            if (tds >= 1.8) text += ` · 2+ pass TDs (proj ${tds.toFixed(1)})`;
          }
        } else if (p.pos === "RB") {
          stat = projStatOf(p, "rush_yd");
          if (stat >= 55) {
            text = `Rushing yards OVER — projected ~${Math.round(stat)} yds`;
            const tds = projStatOf(p, "rush_td") + projStatOf(p, "rec_td");
            if (tds >= 0.55) text += ` · Anytime TD (proj ${tds.toFixed(2)})`;
          }
        } else {
          stat = projStatOf(p, "rec_yd");
          if (stat >= 50) {
            text = `Receiving yards OVER — projected ~${Math.round(stat)} yds`;
            const tds = projStatOf(p, "rec_td");
            if (tds >= 0.45) text += ` · Anytime TD (proj ${tds.toFixed(2)})`;
          }
        }
        if (!text || !impliedOk) continue;
        const why = [];
        if (m.label) why.push(m.label);
        if (implied !== null) why.push(`implied total ${implied}`);
        if (m.windy) why.push("⚠ windy — temper yardage overs");
        ideas.push({
          p, text, why,
          score: stat * (great ? 1.15 : 1) * (implied ? implied / 23 : 1),
          mine: state.myTeam.includes(p.id),
        });
      }
    }
  }
  return ideas.sort((a, b) => b.score - a.score).slice(0, 12);
}

// ----- The Odds API: real lines, line shopping, prop edges -----
async function fetchOddsApi(url) {
  const res = await fetch(url);
  const remaining = res.headers.get("x-requests-remaining");
  if (remaining !== null) {
    state.oddsQuota = { remaining, used: res.headers.get("x-requests-used") };
    saveOddsUsage({ toaUsed: Number(state.oddsQuota.used) || null }); // authoritative from headers
  }
  if (!res.ok) throw new Error(`Odds API ${res.status}`);
  return res.json();
}

// Best price for a side across books. American odds compare numerically
// (-105 beats -115, +150 beats +120); for spreads/totals a better POINT for
// the bettor wins first, then price.
function bestOutcome(bookmakers, marketKey, pickSide, pointPref) {
  let best = null;
  for (const bk of bookmakers || []) {
    const m = (bk.markets || []).find((x) => x.key === marketKey);
    for (const o of m?.outcomes || []) {
      if (!pickSide(o)) continue;
      const cand = { point: o.point ?? null, price: o.price, book: BOOK_ABBR[bk.key] || bk.title || bk.key };
      if (!best) { best = cand; continue; }
      if (pointPref && cand.point !== null && best.point !== null && cand.point !== best.point) {
        if (pointPref === "high" ? cand.point > best.point : cand.point < best.point) best = cand;
        continue;
      }
      if (cand.price > best.price) best = cand;
    }
  }
  return best;
}

async function loadOddsApi(force = false) {
  if (!state.oddsKey) return;
  let events;
  const cached = loadJSON(ODDS_CACHE_KEY, null);
  if (!force && cached && Date.now() - cached.ts < oddsTtl()) {
    events = cached.events;
    if (cached.quota && !state.oddsQuota) state.oddsQuota = cached.quota;
  } else {
    events = await fetchOddsApi(`${ODDS_API_HOST}/odds?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${state.oddsKey}`);
    saveJSON(ODDS_CACHE_KEY, { ts: Date.now(), events, quota: state.oddsQuota });
  }
  state.oddsShop = new Map();
  for (const ev of events || []) {
    const home = NFL_FULLNAME_TO_ABBR[ev.home_team];
    const away = NFL_FULLNAME_TO_ABBR[ev.away_team];
    if (!home || !away) continue;
    const bks = ev.bookmakers || [];
    const shop = {
      eventId: ev.id,
      spreadHome: bestOutcome(bks, "spreads", (o) => o.name === ev.home_team, "high"),
      spreadAway: bestOutcome(bks, "spreads", (o) => o.name === ev.away_team, "high"),
      over: bestOutcome(bks, "totals", (o) => o.name === "Over", "low"),
      under: bestOutcome(bks, "totals", (o) => o.name === "Under", "high"),
      mlHome: bestOutcome(bks, "h2h", (o) => o.name === ev.home_team),
      mlAway: bestOutcome(bks, "h2h", (o) => o.name === ev.away_team),
    };
    state.oddsShop.set(home, shop);
    // Fill gaps when ESPN hasn't posted a line yet.
    const g = state.games.find((x) => x.home === home && x.away === away);
    if (g) {
      if (g.spread === null && shop.spreadHome?.point !== null) g.spread = shop.spreadHome?.point ?? null;
      if (g.ou === null && shop.over?.point !== null) g.ou = shop.over?.point ?? null;
      if (g.hMl === null && shop.mlHome) g.hMl = shop.mlHome.price;
      if (g.aMl === null && shop.mlAway) g.aMl = shop.mlAway.price;
      if (g.ou !== null && g.spread !== null && g.hTotal === null) {
        g.hTotal = Math.round((g.ou / 2 - g.spread / 2) * 10) / 10;
        g.aTotal = Math.round((g.ou / 2 + g.spread / 2) * 10) / 10;
      }
    }
  }
}

// ----- SportsGameOdds: week-wide prop lines + gap-filling game odds -----
function sgoTeamAbbr(t) {
  if (!t) return null;
  const cand = t.names?.abbr || t.names?.short || t.abbreviation ||
    NFL_FULLNAME_TO_ABBR[t.names?.long || t.names?.medium || t.name] || null;
  return cand ? normTeam(cand) : null;
}

function sgoPlayerName(playerID) {
  // e.g. "PATRICK_MAHOMES_1_NFL" -> "patrick mahomes"
  return String(playerID).replace(/_\d+_NFL$/i, "").replace(/_/g, " ").toLowerCase();
}

function sgoNum(...vals) {
  for (const v of vals) {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

async function loadSgo(force = false) {
  if (!state.sgoKey) return;
  let data;
  const cached = loadJSON(SGO_CACHE_KEY, null);
  if (!force && cached && Date.now() - cached.ts < oddsTtl()) {
    data = cached.data;
  } else {
    const json = await fetchJSON(`${SGO_HOST}/events?leagueID=NFL&oddsAvailable=true&limit=50&apiKey=${state.sgoKey}`);
    data = json?.data || json?.events || (Array.isArray(json) ? json : []);
    saveJSON(SGO_CACHE_KEY, { ts: Date.now(), data });
    saveOddsUsage({ sgoObjects: oddsUsage().sgoObjects + (data?.length || 0) });
  }
  let games = 0, propCount = 0;
  for (const ev of data || []) {
    const home = sgoTeamAbbr(ev.teams?.home) || null;
    const away = sgoTeamAbbr(ev.teams?.away) || null;
    if (!home) continue;
    games++;
    const g = state.games.find((x) => x.home === home && (!away || x.away === away));
    let lines = state.propLines.get(home);
    for (const o of Object.values(ev.odds || {})) {
      const price = sgoNum(o.bookOdds, o.fairOdds, o.odds);
      // Game markets fill gaps ESPN/The Odds API haven't covered.
      if (!o.playerID && g) {
        const pt = sgoNum(o.bookSpread, o.fairSpread, o.bookOverUnder, o.fairOverUnder, o.overUnder, o.spread);
        if (o.betTypeID === "ml" && price !== null) {
          if (o.sideID === "home" && g.hMl === null) g.hMl = price;
          if (o.sideID === "away" && g.aMl === null) g.aMl = price;
        } else if (o.betTypeID === "ou" && o.sideID === "over" && g.ou === null && pt !== null) {
          g.ou = pt;
        } else if (o.betTypeID === "sp" && o.sideID === "home" && g.spread === null && pt !== null) {
          g.spread = pt;
        }
        continue;
      }
      // Player props -> same structure the edges engine already reads.
      const market = SGO_STAT_TO_MARKET[o.statID];
      if (!o.playerID || !market || price === null) continue;
      const isTd = market === "player_anytime_td";
      const side = String(o.sideID || "").toLowerCase();
      if (!isTd && side !== "over") continue;
      if (isTd && side && !["yes", "over"].includes(side)) continue;
      const point = isTd ? null : sgoNum(o.bookOverUnder, o.fairOverUnder, o.overUnder);
      if (!isTd && point === null) continue;
      if (!lines) { lines = new Map(); state.propLines.set(home, lines); }
      const key = `${normName(sgoPlayerName(o.playerID))}|${market}`;
      const cand = { point, price, book: "SGO" };
      const cur = lines.get(key);
      if (!cur || cand.price > cur.price) lines.set(key, cand);
      propCount++;
    }
  }
  state.sgoStatus = games
    ? `SGO: ${games} games, ${propCount} prop lines loaded.`
    : "SGO responded but no NFL events parsed — tell the developer what this says.";
}

const PROP_MARKET_INFO = {
  player_pass_yds: { label: "Passing yards", stat: "pass_yd" },
  player_rush_yds: { label: "Rushing yards", stat: "rush_yd" },
  player_reception_yds: { label: "Receiving yards", stat: "rec_yd" },
  player_anytime_td: { label: "Anytime TD", stat: null },
};

async function loadPropLines(home) {
  const shop = state.oddsShop.get(home);
  if (!shop?.eventId || !state.oddsKey) return;
  const cacheKey = `ghq_props_${shop.eventId}`;
  let data = loadJSON(cacheKey, null);
  if (!data || Date.now() - data.ts > ODDS_CACHE_TTL_MS) {
    const json = await fetchOddsApi(
      `${ODDS_API_HOST}/events/${shop.eventId}/odds?regions=us&markets=${PROP_MARKETS}&oddsFormat=american&apiKey=${state.oddsKey}`);
    data = { ts: Date.now(), json };
    saveJSON(cacheKey, data);
  }
  // Merge with any lines another provider (SGO) already loaded for this game,
  // keeping the best price per prop.
  const lines = new Map(state.propLines.get(home) || []);
  for (const bk of data.json?.bookmakers || []) {
    const abbr = BOOK_ABBR[bk.key] || bk.title || bk.key;
    for (const m of bk.markets || []) {
      if (!PROP_MARKET_INFO[m.key]) continue;
      for (const o of m.outcomes || []) {
        // Yardage props: name is Over/Under, description is the player.
        // Anytime TD: the player is in description (or name, book-dependent).
        const isOU = o.name === "Over" || o.name === "Under";
        if (isOU && o.name !== "Over") continue; // track the Over side
        const player = o.description || (!isOU && !["Yes", "No"].includes(o.name) ? o.name : null);
        if (!player) continue;
        const key = `${normName(player)}|${m.key}`;
        const cand = { point: o.point ?? null, price: o.price, book: abbr };
        const cur = lines.get(key);
        if (!cur || cand.price > cur.price) lines.set(key, cand);
      }
    }
  }
  state.propLines.set(home, lines);
  state.toaPropsLoaded.add(home);
}

// Model vs market: compare our league-scored projections to real prop lines.
function buildPropEdges() {
  const edges = [];
  for (const [home, lines] of state.propLines) {
    for (const [key, line] of lines) {
      const [pname, market] = key.split("|");
      const info = PROP_MARKET_INFO[market];
      if (!info) continue;
      const p = state.players.find((x) => normName(x.name) === pname);
      if (!p) continue;
      if (info.stat && line.point !== null) {
        const proj = projStatOf(p, info.stat);
        if (!proj) continue;
        const edge = Math.round((proj - line.point) * 10) / 10;
        if (Math.abs(edge) >= 5) {
          edges.push({
            p, home, market,
            text: `${info.label} ${edge > 0 ? "OVER" : "UNDER"} ${line.point} (${line.book} ${line.price > 0 ? "+" : ""}${line.price})`,
            why: `we project ~${Math.round(proj)} → edge ${edge > 0 ? "+" : ""}${edge}`,
            score: Math.abs(edge),
          });
        }
      } else if (market === "player_anytime_td") {
        const projTd = projStatOf(p, "rush_td") + projStatOf(p, "rec_td");
        if (!projTd || line.price === null) continue;
        const implied = line.price > 0 ? 100 / (line.price + 100) : Math.abs(line.price) / (Math.abs(line.price) + 100);
        const edge = Math.round((projTd - implied) * 100) / 100;
        if (edge >= 0.08) {
          edges.push({
            p, home, market,
            text: `Anytime TD ${line.price > 0 ? "+" : ""}${line.price} (${line.book})`,
            why: `we project ${projTd.toFixed(2)} TDs vs ${(implied * 100).toFixed(0)}% implied → value`,
            score: edge * 40,
          });
        }
      }
    }
  }
  return edges.sort((a, b) => b.score - a.score).slice(0, 12);
}

// Leans across every market — spread, moneyline, total, team total, teaser —
// each with a conviction score so the strongest float to a Best Bets board.
function buildMarketLeans() {
  const leans = [];
  const defRank = (t) => state.defense.get(t)?.easeRank ?? null; // 1 = allows most points
  for (const g of state.games) {
    const label = `${g.away} @ ${g.home}`;
    const wx = state.weather.get(g.home);
    const windy = wx && wx.wind >= 18;
    const rainy = wx && wx.precip >= 60;
    const sp = g.spread, ou = g.ou;
    const homeDefR = defRank(g.home), awayDefR = defRank(g.away);
    const add = (market, pick, why, score) => leans.push({ market, game: label, pick, why, score });

    // --- Totals ---
    if (windy) {
      add("Total", `UNDER${ou !== null ? ` ${ou}` : ""}`,
        [`${wx.wind} mph wind suppresses passing and kicking`, rainy ? `${wx.precip}% rain risk on top` : null].filter(Boolean),
        3 + (rainy ? 0.5 : 0));
    } else if (rainy) {
      add("Total", `UNDER${ou !== null ? ` ${ou}` : ""}`, [`${wx.precip}% rain risk — ball security and short passing games`], 2.2);
    } else if (ou !== null && homeDefR && awayDefR) {
      if (homeDefR <= 10 && awayDefR <= 10) {
        add("Total", `OVER ${ou}`, ["both defenses leak points (top-10 most generous)"], 2.5);
      } else if (homeDefR >= 23 && awayDefR >= 23) {
        add("Total", `UNDER ${ou}`, ["two stingy defenses (bottom-10 in points allowed)"], 2.3);
      }
    }

    // --- Team totals ---
    for (const [team, implied, oppDefR] of [[g.home, g.hTotal, awayDefR], [g.away, g.aTotal, homeDefR]]) {
      if (implied === null) continue;
      if (implied >= 26 && oppDefR && oppDefR <= 8 && !windy) {
        add("Team total", `${team} team total OVER`,
          [`implied ${implied} vs a defense allowing the ${ordinal(oppDefR)}-most points`], 2.6);
      } else if (implied <= 17 && oppDefR && oppDefR >= 25) {
        add("Team total", `${team} team total UNDER`,
          [`implied only ${implied} into a top defense`], 2.2);
      }
    }

    // --- Spreads ---
    if (sp !== null) {
      const dog = sp < 0 ? g.away : g.home;
      const dogPts = Math.abs(sp);
      if (sp > 0) {
        add("Spread", `${g.home} +${sp}`, ["home underdogs are historically live — crowd, no travel"], 2);
      }
      if (ou !== null && ou >= 48 && dogPts >= 7) {
        add("Spread", `${dog} +${dogPts}`, [`high total (${ou}) + big spread — shootouts keep dogs inside the number`], 2.4);
      }
      if (dogPts >= 10 && wx && wx.wind >= 15) {
        add("Spread", `${dog} +${dogPts}`, ["big favorites sit on leads in bad weather — backdoor territory"], 1.8);
      }

      // --- Moneylines ---
      if (sp >= -2.5 && sp < 0) {
        add("Moneyline", `${g.home} ML`, [`short home favorite (${sp}) — pay less juice than laying the hook`], 1.6);
      }
      if (sp > 0 && ou !== null && ou <= 41) {
        add("Moneyline", `${g.home} ML (upset)`, [`low total (${ou}) = fewer possessions = variance favors the dog`], 2.2);
      }

      // --- Teasers (Wong: tease through both key numbers 3 and 7) ---
      if (ou === null || ou <= 49) {
        if (sp <= -7 && sp >= -8.5) {
          add("Teaser", `${g.home} ${sp} → ${sp + 6} (6-pt)`, ["Wong spot: favorite teased through both key numbers 7 and 3"], 2.8);
        }
        if (sp >= 7 && sp <= 8.5) {
          add("Teaser", `${g.away} ${-sp} → ${-sp + 6} (6-pt)`, ["Wong spot: favorite teased through both key numbers 7 and 3"], 2.8);
        }
        if (sp >= 1.5 && sp <= 2.5) {
          add("Teaser", `${g.home} +${sp} → +${sp + 6} (6-pt)`, ["Wong spot: dog teased up through 3 and 7"], 2.8);
        }
        if (sp <= -1.5 && sp >= -2.5) {
          add("Teaser", `${g.away} +${-sp} → +${-sp + 6} (6-pt)`, ["Wong spot: dog teased up through 3 and 7"], 2.8);
        }
      }
    }
  }
  return leans.sort((a, b) => b.score - a.score);
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function gameAngles(g) {
  const angles = [];
  const wx = state.weather.get(g.home);
  if (wx && wx.wind >= 18) angles.push(`💨 ${wx.wind} mph wind — Under lean; fade kickers and deep passing`);
  if (wx && wx.precip >= 60) angles.push(`🌧 ${wx.precip}% rain risk — Under lean; run-game and turnover angles`);
  if (g.ou !== null && g.ou >= 48) angles.push("🔥 Shootout watch — overs and same-game stacks live here");
  if (g.ou !== null && g.ou <= 40) angles.push("🛡 Low total — Under / D-ST points angle");
  if (g.spread !== null && Math.abs(g.spread) >= 9.5) {
    const fav = g.spread < 0 ? g.home : g.away;
    const dog = g.spread < 0 ? g.away : g.home;
    angles.push(`📉 Big spread — ${fav} RBs get closing volume; ${dog} garbage-time passing overs`);
  }
  const dvpNote = (team, opp) => {
    const d = state.dvp?.get(opp);
    if (!d) return;
    if (d.QB <= 5) angles.push(`🎯 ${opp} bleeds to QBs (worst-5) — ${team} passing props over`);
    if (d.RB <= 5) angles.push(`🎯 ${opp} bleeds to RBs (worst-5) — ${team} rushing props over`);
    if (d.WR <= 5) angles.push(`🎯 ${opp} bleeds to WRs (worst-5) — ${team} receiving props over`);
  };
  dvpNote(g.home, g.away);
  dvpNote(g.away, g.home);
  return angles;
}

function buildParlays(props, leans) {
  const parlays = [];
  // Chalk moneyline parlay from the week's heaviest favorites.
  const favs = state.games
    .filter((g) => g.spread !== null && Math.abs(g.spread) >= 7)
    .map((g) => ({ team: g.spread < 0 ? g.home : g.away, ml: g.spread < 0 ? g.hMl : g.aMl, pts: Math.abs(g.spread) }))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3);
  if (favs.length >= 2) {
    parlays.push({
      title: `Chalk ML parlay: ${favs.map((f) => f.team).join(" + ")}`,
      legs: favs.map((f) => `${f.team} moneyline${f.ml !== null ? ` (${f.ml > 0 ? "+" : ""}${f.ml})` : ""}`),
      why: "The week's heaviest favorites just need to win, not cover — stack them for a better combined price.",
    });
  }
  // Two-leg 6-point teaser from the Wong spots.
  const wong = (leans || []).filter((l) => l.market === "Teaser").slice(0, 2);
  if (wong.length === 2) {
    parlays.push({
      title: "Two-leg 6-pt teaser (Wong spots)",
      legs: wong.map((l) => `${l.pick} — ${l.game}`),
      why: "Both legs tease through the key numbers 3 and 7, where NFL games land most often.",
    });
  }
  // Same-game stack from the highest-total game.
  const withOu = state.games.filter((g) => g.ou !== null).sort((a, b) => b.ou - a.ou);
  if (withOu.length) {
    const g = withOu[0];
    const team = (g.hTotal ?? 0) >= (g.aTotal ?? 0) ? g.home : g.away;
    const qb = topPlayersFor(team, ["QB"], 1)[0];
    const pc = topPlayersFor(team, ["WR", "TE"], 1)[0];
    if (qb && pc) {
      parlays.push({
        title: `Same-game stack: ${g.away} @ ${g.home} (O/U ${g.ou})`,
        legs: [
          `${qb.p.name} passing yards OVER (proj ~${Math.round(projStatOf(qb.p, "pass_yd"))})`,
          `${pc.p.name} receiving yards OVER (proj ~${Math.round(projStatOf(pc.p, "rec_yd"))})`,
          `Game total OVER ${g.ou}`,
        ],
        why: "Correlated legs: if the game shoots out, all three tend to hit together.",
      });
    }
  }
  // Weather-under build.
  const windy = state.games.find((g) => (state.weather.get(g.home)?.wind ?? 0) >= 18);
  if (windy) {
    const rb = topPlayersFor(windy.home, ["RB"], 1)[0] || topPlayersFor(windy.away, ["RB"], 1)[0];
    parlays.push({
      title: `Weather under: ${windy.away} @ ${windy.home} (${state.weather.get(windy.home).wind} mph wind)`,
      legs: [
        windy.ou !== null ? `Game total UNDER ${windy.ou}` : "Game total UNDER",
        rb ? `${rb.p.name} rushing attempts/yards OVER (wind = run scripts)` : "Lean run-game props",
        "Fade: kickers 50+ and deep-ball passing props",
      ],
      why: "High wind suppresses passing and kicking; teams leaning on the run shortens games.",
    });
  }
  // "My guys" ticket from the user's own roster.
  const mine = props.filter((i) => i.mine).slice(0, 2);
  if (mine.length === 2) {
    parlays.push({
      title: "Root for your own team",
      legs: mine.map((i) => `${i.p.name}: ${i.text.split(" · ")[0]}`),
      why: "Two of your starters with the strongest data angles — win your matchup and the ticket together.",
    });
  }
  return parlays;
}

function leanCard(l) {
  return `<div class="bet-card">
    <div class="bet-head">
      <b><span class="market-chip">${escapeHtml(l.market)}</span> ${escapeHtml(l.pick)}</b>
      <span class="bet-lines">${escapeHtml(l.game)}</span>
    </div>
    <div class="bet-sub">${l.why.map(escapeHtml).join(" · ")}</div>
  </div>`;
}

function renderBetting() {
  const gamesEl = document.getElementById("betting-games");
  const propsEl = document.getElementById("betting-props");
  const parlaysEl = document.getElementById("betting-parlays");
  const bestEl = document.getElementById("betting-best");
  const linesEl = document.getElementById("betting-lines");
  const totalsEl = document.getElementById("betting-totals");
  const teasersEl = document.getElementById("betting-teasers");
  if (!state.games.length) {
    const quiet = '<div class="loading">No games on the board (offseason or schedule unavailable).</div>';
    gamesEl.innerHTML = quiet;
    bestEl.innerHTML = quiet;
    linesEl.innerHTML = totalsEl.innerHTML = teasersEl.innerHTML = "";
    propsEl.innerHTML = '<div class="loading">Prop ideas appear when weekly projections and lines are live.</div>';
    parlaysEl.innerHTML = "";
    return;
  }

  const leans = buildMarketLeans();
  const section = (el, filter, empty) => {
    const list = leans.filter(filter);
    el.innerHTML = list.length ? list.map(leanCard).join("") : `<div class="loading">${empty}</div>`;
  };
  bestEl.innerHTML = leans.slice(0, 8).length
    ? leans.slice(0, 8).map(leanCard).join("")
    : '<div class="loading">No strong angles yet — lines may not be posted.</div>';
  section(linesEl, (l) => l.market === "Spread" || l.market === "Moneyline", "No spread/ML edges stand out this week.");
  section(totalsEl, (l) => l.market === "Total" || l.market === "Team total", "No totals angles — check back when lines post.");
  section(teasersEl, (l) => l.market === "Teaser", "No Wong teaser spots this week (need spreads of ±1.5-2.5 or ±7-8.5).");

  gamesEl.innerHTML = state.games.map((g) => {
    const wx = state.weather.get(g.home);
    const angles = gameAngles(g);
    const ml = g.hMl !== null || g.aMl !== null
      ? ` · ML ${escapeHtml(g.home)} ${g.hMl > 0 ? "+" : ""}${g.hMl ?? "—"} / ${escapeHtml(g.away)} ${g.aMl > 0 ? "+" : ""}${g.aMl ?? "—"}` : "";
    // Multi-book line shopping + on-demand prop lines (The Odds API).
    const shop = state.oddsShop.get(g.home);
    const fmt = (o, label) => o ? `${label} ${o.point !== null ? o.point + " " : ""}${o.price > 0 ? "+" : ""}${o.price} (${escapeHtml(o.book)})` : null;
    const shopLine = shop
      ? [fmt(shop.spreadHome, escapeHtml(g.home)), fmt(shop.spreadAway, escapeHtml(g.away)),
         fmt(shop.over, "O"), fmt(shop.under, "U"), fmt(shop.mlHome, "ML")].filter(Boolean).join(" · ")
      : "";
    const propBtn = shop?.eventId && !state.toaPropsLoaded.has(g.home)
      ? `<button class="btn prop-load" data-prop-home="${escapeHtml(g.home)}">📥 Load ${state.propLines.has(g.home) ? "live multi-book" : "real"} prop lines (~4 credits)</button>`
      : "";
    return `<div class="bet-card">
      <div class="bet-head">
        <b>${escapeHtml(g.away)} @ ${escapeHtml(g.home)}</b>
        <span class="bet-lines">${g.details ? escapeHtml(g.details) + " · " : ""}${g.ou !== null ? `O/U ${g.ou}` : "no line yet"}${ml}</span>
      </div>
      <div class="bet-sub">
        ${g.hTotal !== null ? `implied: ${escapeHtml(g.home)} ${g.hTotal} · ${escapeHtml(g.away)} ${g.aTotal}` : ""}
        ${wx ? ` · ${wx.wind}mph · ${wx.temp}°F${wx.precip >= 50 ? ` · 🌧${wx.precip}%` : ""}` : ""}
      </div>
      ${shopLine ? `<div class="bet-sub">🛒 best prices: ${shopLine}</div>` : ""}
      ${angles.length ? `<ul class="bet-angles">${angles.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>` : ""}
      ${propBtn}
    </div>`;
  }).join("");

  // Prop edges (model vs market) — only when real lines have been loaded.
  const edgesWrap = document.getElementById("betting-edges-wrap");
  const edgesEl = document.getElementById("betting-edges");
  const edges = buildPropEdges();
  edgesWrap.hidden = !state.propLines.size;
  edgesEl.innerHTML = edges.length
    ? edges.map((e) => `<div class="bet-card">
        <div class="bet-head">
          <b>${escapeHtml(e.p.name)}</b>
          <span class="player-sub"><span class="pos-tag pos-${e.p.pos}">${e.p.pos}</span> <span>${escapeHtml(e.p.team)}</span></span>
        </div>
        <div class="bet-idea">${escapeHtml(e.text)}</div>
        <div class="bet-sub">${escapeHtml(e.why)}</div>
      </div>`).join("")
    : (state.propLines.size ? '<div class="loading">Lines loaded — no 5+ yard edges vs our projections right now.</div>' : "");

  renderOddsSettings();

  const props = buildPropIdeas();
  propsEl.innerHTML = props.length
    ? props.map((i) => `<div class="bet-card">
        <div class="bet-head">
          <b>${escapeHtml(i.p.name)}</b>
          <span class="player-sub"><span class="pos-tag pos-${i.p.pos}">${i.p.pos}</span> <span>${escapeHtml(i.p.team)}</span>
          ${i.mine ? '<span class="trend-badge trend-add">on my team</span>' : ""}</span>
        </div>
        <div class="bet-idea">${escapeHtml(i.text)}</div>
        <div class="bet-sub">${i.why.map(escapeHtml).join(" · ")}</div>
      </div>`).join("")
    : '<div class="loading">Prop ideas need weekly projections — they go live during the season.</div>';

  const parlays = buildParlays(props, leans);
  parlaysEl.innerHTML = parlays.length
    ? parlays.map((pl) => `<div class="bet-card">
        <div class="bet-head"><b>${escapeHtml(pl.title)}</b></div>
        <ul class="bet-angles">${pl.legs.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
        <div class="bet-sub">${escapeHtml(pl.why)}</div>
      </div>`).join("")
    : '<div class="loading">Parlay ideas need posted lines and projections.</div>';

  const buzzEl = document.getElementById("betting-buzz");
  buzzEl.innerHTML = state.sportsbookPosts.length
    ? state.sportsbookPosts.map((p) => `<a class="news-card" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="news-meta">
          <span class="src-badge src-reddit">r/sportsbook</span>
          <span>${timeAgo(p.ts)}</span>
          <span>▲ ${p.score.toLocaleString()}</span>
        </div>
      </a>`).join("")
    : '<div class="loading">r/sportsbook quiet right now.</div>';

  renderLedger();
}

function agoText(ts) {
  if (!ts) return "never";
  const mins = Math.round((Date.now() - ts) / 60000);
  return mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

function renderOddsSettings() {
  const quotaEl = document.getElementById("odds-quota");
  if (!quotaEl) return;
  const usage = oddsUsage();
  if (!state.oddsKey) {
    quotaEl.textContent = "No key — game lines above come from ESPN only.";
  } else {
    const ts = loadJSON(ODDS_CACHE_KEY, null)?.ts;
    const q = state.oddsQuota
      ? `${state.oddsQuota.remaining} credits left${paceNote(usage.toaUsed, 500)}`
      : "lines will load on the next refresh";
    quotaEl.textContent = `✅ Lines as of ${agoText(ts)} · ${q}`;
  }
  const sgoEl = document.getElementById("sgo-status");
  if (sgoEl) {
    if (!state.sgoKey) {
      sgoEl.textContent = "No SGO key saved yet.";
    } else {
      const ts = loadJSON(SGO_CACHE_KEY, null)?.ts;
      sgoEl.textContent = `✅ ${state.sgoStatus || "props load on next refresh"} · as of ${agoText(ts)} · ~${usage.sgoObjects} objects used${paceNote(usage.sgoObjects, 2500)}`;
    }
  }
  const boardEl = document.getElementById("odds-board");
  if (boardEl) {
    boardEl.innerHTML = `Refresh cadence auto-tunes to the NFL week: every <b>6h on game days</b> (Thu/Sun/Mon),
      <b>12h midweek</b> — ESPN lines are free and refresh with the app every 10 minutes.
      <button id="odds-force-refresh" class="btn" style="margin-left:8px">⟳ Force refresh lines now</button>`;
  }
}

// ----- ESPN league sync (auto-fetch for public leagues, paste fallback) -----
function espnTeamsFrom(j) {
  const byName = new Map(state.players.map((p) => [normName(p.name), p.id]));
  const teams = (j.teams || []).map((t) => {
    const entries = t.roster?.entries || [];
    const nameOf = (e) => e.playerPoolEntry?.player?.fullName || e.playerPoolEntry?.player?.name;
    const players = entries.map(nameOf).filter(Boolean);
    // lineupSlotId 20 = bench, 21 = IR — everything else is a starter.
    const starterNames = entries
      .filter((e) => e.lineupSlotId !== 20 && e.lineupSlotId !== 21)
      .map(nameOf).filter(Boolean);
    const rec = t.record?.overall;
    return {
      id: t.id,
      name: t.name || `${t.location || ""} ${t.nickname || ""}`.trim() || `Team ${t.id}`,
      record: rec && typeof rec.wins === "number" ? `${rec.wins}-${rec.losses}` : null,
      players,
      ids: players.map((n) => byName.get(normName(n))).filter(Boolean),
      starterIds: starterNames.map((n) => byName.get(normName(n))).filter(Boolean),
    };
  });
  // NOTE: empty rosters are NORMAL before the draft — keep those teams so the
  // user can pick theirs and Live Draft Sync can fill rosters pick by pick.
  if (!teams.length) throw new Error("No teams in that data — make sure you copied the whole page.");
  return teams;
}

function parseEspnLeague(text) {
  return espnTeamsFrom(JSON.parse(text.trim()));
}

// Direct fetch — works now that the league is public, IF ESPN's API allows
// browser cross-origin calls. Fails gracefully to the paste flow otherwise.
async function loadEspnLeague() {
  const cfg = state.espnCfg;
  if (!cfg.leagueId) return;
  const year = state.seasonYear || new Date().getFullYear();
  try {
    const j = await fetchJSON(espnLeagueUrl(cfg.leagueId, year));
    const teams = espnTeamsFrom(j);
    const rosteredIds = new Set(teams.flatMap((t) => t.ids));
    const current = j.status?.currentMatchupPeriod ?? state.week ?? null;
    let opponent = null;
    // Self-healing sync: if the stored teamId is gone (storage wiped), match
    // the remembered/default team NAME and silently re-adopt it.
    if (cfg.teamId == null && cfg.teamName) {
      const match = teams.find((t) => normName(t.name) === normName(cfg.teamName));
      if (match) {
        cfg.teamId = match.id;
        saveJSON(ESPN_SYNC_KEY, cfg);
      }
    }
    if (cfg.teamId != null) {
      const mineTeam = teams.find((t) => t.id === cfg.teamId);
      if (mineTeam) {
        state.myTeam = mineTeam.ids; // auto-sync roster on every refresh
        saveMyTeam();
      }
      const m = (j.schedule || []).find((s) => s.matchupPeriodId === current &&
        (s.home?.teamId === cfg.teamId || s.away?.teamId === cfg.teamId));
      if (m) {
        const oppId = m.home?.teamId === cfg.teamId ? m.away?.teamId : m.home?.teamId;
        opponent = teams.find((t) => t.id === oppId) || null;
      }
    }
    state.espn = { teams, rosteredIds, opponent, currentMatchupPeriod: current };
    state.espnError = null;
  } catch (e) {
    state.espn = null;
    state.espnError = String(e?.message || e);
  }
}

function importEspnTeam(team) {
  const byName = new Map(state.players.map((p) => [normName(p.name), p.id]));
  const unmatched = team.players.filter((n) => !byName.has(normName(n)));
  state.myTeam = [...team.ids];
  saveMyTeam();
  renderStartSit();
  return { matched: team.ids.length, total: team.players.length, unmatched };
}

// "Is this trending player actually gettable in MY league?"
function leagueAvailability(id) {
  if (!state.espn?.rosteredIds) return "";
  return state.espn.rosteredIds.has(id)
    ? '<span class="mkt-note">rostered in your league</span>'
    : '<span class="trend-badge trend-add">FREE AGENT in your league</span>';
}

function renderEspnStatus() {
  const el = document.getElementById("espn-status");
  if (!el) return;
  const cfg = state.espnCfg;
  if (cfg.teamId != null && state.espn) {
    el.innerHTML = `⚡ Auto-sync ON — <b>${escapeHtml(cfg.teamName || "my team")}</b>, refreshes with the app. <button id="espn-sync-off" class="btn btn-danger">Turn off</button>`;
  } else if (cfg.teamId != null) {
    el.textContent = "⚡ Auto-sync armed — waiting for a successful fetch…";
  } else if (state.espnError) {
    el.textContent = "Auto-fetch failed (ESPN may block browser connections) — use the paste method below.";
  } else {
    el.textContent = "";
  }
}

// ----- Trade analyzer -----
function lineupTotalFor(ids) {
  const roster = ids.map((id) => state.byId.get(id)).filter(Boolean);
  if (!roster.length) return 0;
  return optimizeLineup(roster).starters.reduce((s, x) => s + (x.pick?.adjusted || 0), 0);
}

function tradePlayerRow(p, side) {
  return `<div class="player-row">
    <div class="player-info">
      <div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-sub">
        <span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}${posRank(p)}</span>
        <span>${escapeHtml(p.team)}</span>
        ${p.injury ? `<span class="trend-badge trend-drop">${escapeHtml(p.injury)}</span>` : ""}
      </div>
    </div>
    <button class="chip chip-taken" data-trade-remove="${side}" data-id="${p.id}">✕</button>
  </div>`;
}

function renderTrade() {
  if (!state.players.length) return;
  // Partner dropdown from the synced league (keep selection across renders).
  const sel = document.getElementById("trade-partner");
  const cur = sel.value;
  const opts = ['<option value="">Any player (no partner selected)</option>'];
  for (const t of state.espn?.teams || []) {
    if (t.id === state.espnCfg.teamId) continue;
    opts.push(`<option value="${t.id}">${escapeHtml(t.name)}${t.record ? ` (${t.record})` : ""}</option>`);
  }
  sel.innerHTML = opts.join("");
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;

  const list = (ids, side) => ids.map((id) => state.byId.get(id)).filter(Boolean)
    .map((p) => tradePlayerRow(p, side)).join("");
  document.getElementById("trade-send-list").innerHTML =
    list(state.tradeSend, "send") || '<div class="loading">No players added.</div>';
  document.getElementById("trade-recv-list").innerHTML =
    list(state.tradeRecv, "recv") || '<div class="loading">No players added.</div>';
}

function renderTradeSuggestions(side, query) {
  const el = document.getElementById(side === "send" ? "trade-send-sugg" : "trade-recv-sugg");
  const q = query.trim().toLowerCase();
  if (q.length < 2) { el.innerHTML = ""; return; }
  let pool;
  if (side === "send") {
    pool = state.myTeam.map((id) => state.byId.get(id)).filter(Boolean);
  } else {
    const partnerId = Number(document.getElementById("trade-partner").value) || null;
    const partner = partnerId && state.espn?.teams.find((t) => t.id === partnerId);
    pool = partner
      ? partner.ids.map((id) => state.byId.get(id)).filter(Boolean)
      : state.players.filter((p) => !state.myTeam.includes(p.id));
  }
  const chosen = new Set([...state.tradeSend, ...state.tradeRecv]);
  const matches = pool.filter((p) => !chosen.has(p.id) && p.name.toLowerCase().includes(q)).slice(0, 6);
  el.innerHTML = matches.map((p) => `<div class="player-row">
    <div class="player-info"><div class="player-name">${escapeHtml(p.name)}</div>
      <div class="player-sub"><span class="pos-tag pos-${p.pos}">${p.pos === "DEF" ? "D/ST" : p.pos}</span><span>${escapeHtml(p.team)}</span></div>
    </div>
    <button class="chip chip-mine" data-trade-add="${side}" data-id="${p.id}">＋ ADD</button>
  </div>`).join("");
}

function evaluateTrade() {
  const el = document.getElementById("trade-result");
  const send = state.tradeSend, recv = state.tradeRecv;
  if (!send.length && !recv.length) {
    el.innerHTML = '<div class="loading">Add players to both sides first.</div>';
    return;
  }
  const afterMine = state.myTeam.filter((id) => !send.includes(id))
    .concat(recv.filter((id) => !state.myTeam.includes(id)));
  const beforeL = lineupTotalFor(state.myTeam);
  const afterL = lineupTotalFor(afterMine);
  const delta = afterL - beforeL;
  const val = (ids) => ids.map((id) => state.byId.get(id)).filter(Boolean)
    .reduce((s, p) => s + boardValue(p), 0);
  const valDelta = val(recv) - val(send);

  const notes = [];
  const qbAfter = afterMine.map((id) => state.byId.get(id)).filter((p) => p?.pos === "QB").length;
  if (qbAfter < 2) notes.push(`⚠ Leaves you with ${qbAfter} QB${qbAfter === 1 ? "" : "s"} — this is a 2-QB league, and replacement QBs are scarce.`);
  for (const id of recv) {
    const p = state.byId.get(id);
    if (p && /^(Out|IR|Sus)/i.test(p.injury || "")) notes.push(`⚠ ${p.name} is currently ${p.injury} — factor in missed weeks.`);
  }
  for (const id of send) {
    const p = state.byId.get(id);
    if (p?.pos === "QB" && p.mrank - p.lrank >= 8) notes.push(`💡 ${p.name} is worth far more in this league than standard rankings say — don't price him at market.`);
  }

  // Partner impact when their roster is known.
  let partnerHtml = "";
  const partnerId = Number(document.getElementById("trade-partner").value) || null;
  const partner = partnerId && state.espn?.teams.find((t) => t.id === partnerId);
  if (partner) {
    const theirAfter = partner.ids.filter((id) => !recv.includes(id))
      .concat(send.filter((id) => !partner.ids.includes(id)));
    const theirDelta = lineupTotalFor(theirAfter) - lineupTotalFor(partner.ids);
    partnerHtml = `<div class="bet-sub">${escapeHtml(partner.name)}: lineup ${theirDelta >= 0 ? "+" : ""}${theirDelta.toFixed(1)} proj — ${theirDelta > 1 ? "they'll like this" : theirDelta < -1 ? "they may reject it" : "roughly neutral for them"}.</div>`;
  }

  const verdict = delta > 1.5 ? "✅ Verdict: ACCEPT — clear lineup upgrade"
    : delta < -1.5 ? "❌ Verdict: DECLINE — your lineup gets worse"
    : valDelta > 2 ? "👍 Verdict: LEAN ACCEPT — depth/value win, similar lineup"
    : valDelta < -2 ? "👎 Verdict: LEAN DECLINE — you give up more long-term value"
    : "🤝 Verdict: FAIR — decide on preference and injury risk";

  el.innerHTML = `<div class="bet-card">
    <div class="bet-head"><b>${verdict}</b></div>
    <div class="bet-sub">Your optimal lineup: ${beforeL.toFixed(1)} → ${afterL.toFixed(1)} proj (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})
      · roster value ${valDelta >= 0 ? "+" : ""}${valDelta.toFixed(1)}</div>
    ${partnerHtml}
    ${notes.length ? `<ul class="bet-angles">${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>` : ""}
  </div>`;
}

// ----- League power rankings (needs the ESPN league sync) -----
function renderPowerRankings() {
  const el = document.getElementById("power-rankings");
  if (!el) return;
  if (!state.espn?.teams?.length || !state.players.length) { el.innerHTML = ""; return; }
  const ranked = state.espn.teams.map((t) => {
    const roster = t.ids.map((id) => state.byId.get(id)).filter(Boolean);
    const { starters, bench } = optimizeLineup(roster);
    const starterTotal = starters.reduce((s, x) => s + (x.pick?.adjusted || 0), 0);
    const benchValue = bench.slice(0, 5).reduce((s, x) => s + boardValue(x.p) * 0.1, 0);
    return { t, score: starterTotal + benchValue, starterTotal };
  }).sort((a, b) => b.score - a.score);
  el.innerHTML = `<div class="scoring-section" style="margin-top:0"><h3>🏆 League Power Rankings</h3>
    <p class="subtitle">Optimal-lineup strength from every synced roster, in your league's scoring.</p>
    ${ranked.map((r, i) => `<div class="player-row ${r.t.id === state.espnCfg.teamId ? "is-mine" : ""}">
      <div class="rank-num">${i + 1}</div>
      <div class="player-info">
        <div class="player-name">${escapeHtml(r.t.name)}${r.t.record ? ` <span class="mkt-note">${r.t.record}</span>` : ""}</div>
        <div class="player-sub"><span>optimal lineup ${r.starterTotal.toFixed(1)} proj · ${r.t.ids.length} players matched</span></div>
      </div>
    </div>`).join("")}</div>`;
}

// ----- Optimizer scoreboard: projections vs what actually happened -----
const OPTLOG_KEY = "ghq_optlog_v1";

function recordOptimizerWeek() {
  if (state.seasonType !== 2 || !state.week || !state.myTeam.length) return;
  const log = loadJSON(OPTLOG_KEY, {});
  const key = `${state.seasonYear}-w${state.week}`;
  if (log[key]?.evaluated) return; // locked once graded
  const roster = state.myTeam.map((id) => state.byId.get(id)).filter(Boolean);
  if (!roster.length) return;
  const { starters } = optimizeLineup(roster);
  const mineTeam = state.espn?.teams?.find((t) => t.id === state.espnCfg.teamId);
  log[key] = {
    week: state.week,
    year: state.seasonYear,
    optIds: starters.map((s) => s.pick?.p.id).filter(Boolean),
    optProj: Math.round(starters.reduce((s, x) => s + (x.pick?.adjusted || 0), 0) * 10) / 10,
    actualStarterIds: mineTeam?.starterIds?.length ? mineTeam.starterIds : null,
  };
  saveJSON(OPTLOG_KEY, log);
}

async function evaluateOptimizerWeeks() {
  if (state.seasonType !== 2 || !state.week) return;
  const log = loadJSON(OPTLOG_KEY, {});
  let changed = false;
  for (const entry of Object.values(log)) {
    if (entry.evaluated || entry.year !== state.seasonYear || entry.week >= state.week) continue;
    try {
      const stats = await fetchJSON(statsUrl(entry.year, entry.week));
      const statEntries = Array.isArray(stats)
        ? new Map(stats.map((r) => [String(r.player_id), r.stats || r]))
        : new Map(Object.entries(stats || {}));
      const total = (ids) => ids
        ? Math.round(ids.reduce((s, id) => s + (statEntries.has(String(id)) ? leaguePoints(statEntries.get(String(id))) : 0), 0) * 10) / 10
        : null;
      entry.evaluated = { optActual: total(entry.optIds), startersActual: total(entry.actualStarterIds) };
      changed = true;
    } catch { /* stats not posted yet — retry next load */ }
  }
  if (changed) saveJSON(OPTLOG_KEY, log);
}

function renderOptLog() {
  const el = document.getElementById("opt-scoreboard");
  if (!el) return;
  const log = loadJSON(OPTLOG_KEY, {});
  const rows = Object.values(log).sort((a, b) => b.week - a.week).slice(0, 18);
  if (!rows.length) {
    el.innerHTML = '<div class="loading">Tracking starts in week 1 — each week logs what the optimizer projected, what its lineup actually scored, and what your real lineup scored.</div>';
    return;
  }
  el.innerHTML = rows.map((r) => {
    const ev = r.evaluated;
    const diff = ev && ev.optActual !== null && ev.startersActual !== null
      ? ev.optActual - ev.startersActual : null;
    return `<div class="player-row">
      <div class="rank-num">W${r.week}</div>
      <div class="player-info">
        <div class="player-sub">
          <span>optimizer proj <b>${r.optProj}</b></span>
          ${ev ? `<span>· optimal actual <b>${ev.optActual ?? "—"}</b></span>` : "<span>· awaiting results</span>"}
          ${ev?.startersActual !== null && ev ? `<span>· your lineup <b>${ev.startersActual}</b></span>` : ""}
          ${diff !== null && diff > 0.5 ? `<span class="trend-badge trend-drop">${diff.toFixed(1)} pts left on bench</span>` : ""}
          ${diff !== null && diff <= 0.5 ? '<span class="trend-badge trend-add">you matched the optimizer ✓</span>' : ""}
        </div>
      </div>
    </div>`;
  }).join("");
}

// ----- League (strategy notes + editable scoring) -----
function renderStrategyNotes() {
  document.getElementById("strategy-notes").innerHTML = strategyNotes().map((n) =>
    `<div class="strategy-card"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.body)}</p></div>`
  ).join("");
}

function renderLeague() {
  const el = document.getElementById("league-content");
  let html = `<div id="power-rankings"></div><div id="strategy-notes"></div>
    <div class="scoring-editor-head">
      <h3>Scoring Settings — editable</h3>
      <button id="scoring-reset" class="btn btn-danger">Reset to league defaults</button>
    </div>
    <p class="subtitle">If your league changes a value before the season, edit it here. Every projection,
    start/sit recommendation, and draft ranking re-computes instantly, and your edits are saved on this
    device. Values marked * are single-game bonuses or rare plays that don't feed weekly projections
    (projections are per-game averages).</p>`;

  for (const sec of SCORING_CONFIG) {
    html += `<div class="scoring-section"><h3>${escapeHtml(sec.section)}</h3><table class="scoring-table">`;
    for (const it of sec.items) {
      const v = state.scoring[it.key];
      const modified = v !== SCORING_DEFAULTS[it.key];
      html += `<tr>
        <td>${escapeHtml(it.label)}${it.game ? " *" : ""}
          ${modified ? '<span class="mod-chip">edited</span>' : ""}</td>
        <td><input class="scoring-input ${v < 0 ? "pts-neg" : ""}" type="number" step="any"
             inputmode="decimal" data-key="${it.key}" value="${v}"></td>
      </tr>`;
    }
    html += "</table></div>";
  }
  el.innerHTML = html;
  renderStrategyNotes();
}

// A scoring edit re-runs every analysis: projections re-scored from raw stat
// lines, the 2-QB draft board re-built, and all tabs re-rendered.
function reanalyze() {
  recomputeProjections();
  if (state.players.length) {
    state.players = applyLeagueRanks(
      [...state.players].sort((a, b) => (a.mrank || Infinity) - (b.mrank || Infinity))
    );
  }
  renderAll();
  renderStrategyNotes();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function initEvents() {
  // Tab switching
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  document.getElementById("refresh-btn").addEventListener("click", () => loadAll(true));

  // Position filters
  const wirePosFilters = (containerId, stateKey, rerender) => {
    document.getElementById(containerId).addEventListener("click", (e) => {
      const btn = e.target.closest(".pos-btn");
      if (!btn) return;
      document.querySelectorAll(`#${containerId} .pos-btn`).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state[stateKey] = btn.dataset.pos;
      rerender();
    });
  };
  wirePosFilters("rank-pos-filters", "rankPos", renderRankings);
  wirePosFilters("draft-pos-filters", "draftPos", renderDraft);

  document.getElementById("rank-search").addEventListener("input", (e) => {
    state.rankQuery = e.target.value;
    renderRankings();
  });
  document.getElementById("draft-search").addEventListener("input", (e) => {
    state.draftQuery = e.target.value;
    renderDraft();
  });
  document.getElementById("hide-drafted").addEventListener("change", (e) => {
    state.hideDrafted = e.target.checked;
    renderDraft();
  });

  // MINE / GONE buttons (delegated)
  document.getElementById("draft-list").addEventListener("click", (e) => {
    const btn = e.target.closest("button.chip");
    if (!btn) return;
    const { id, act } = btn.dataset;
    state.draft[id] = state.draft[id] === act ? undefined : act;
    if (!state.draft[id]) delete state.draft[id];
    saveDraft();
    renderDraft();
    renderRankings();
  });

  document.getElementById("draft-reset").addEventListener("click", () => {
    if (confirm("Clear all draft picks? This can't be undone.")) {
      state.draft = {};
      saveDraft();
      renderDraft();
      renderRankings();
    }
  });

  // My Team manager (Start/Sit tab)
  document.getElementById("myteam-search").addEventListener("input", (e) => {
    renderMyTeamSuggestions(e.target.value);
  });
  document.getElementById("myteam-suggestions").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-id]");
    if (!btn) return;
    if (!state.myTeam.includes(btn.dataset.addId)) state.myTeam.push(btn.dataset.addId);
    saveMyTeam();
    document.getElementById("myteam-search").value = "";
    renderMyTeamSuggestions("");
    renderStartSit();
  });
  document.getElementById("myteam-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-remove-id]");
    if (!btn) return;
    state.myTeam = state.myTeam.filter((id) => id !== btn.dataset.removeId);
    saveMyTeam();
    renderStartSit();
  });
  document.getElementById("myteam-import").addEventListener("click", () => {
    const mine = Object.entries(state.draft).filter(([, v]) => v === "mine").map(([id]) => id);
    if (!mine.length) { alert("No draft picks marked MINE yet — use the Draft tab during your draft."); return; }
    state.myTeam = [...new Set([...state.myTeam, ...mine])];
    saveMyTeam();
    renderStartSit();
  });
  document.getElementById("myteam-clear").addEventListener("click", () => {
    if (confirm("Remove all players from My Team?")) {
      state.myTeam = [];
      saveMyTeam();
      renderStartSit();
    }
  });

  document.getElementById("notify-btn").addEventListener("click", toggleNotifications);

  // ESPN league paste-import
  const syncBody = document.getElementById("espn-sync-body");
  const leagueIdInput = document.getElementById("espn-league-id");
  const refreshEspnLink = () => {
    const year = state.seasonYear || new Date().getFullYear();
    const id = (leagueIdInput.value || "").replace(/\D/g, "") || "1767084290";
    document.getElementById("espn-json-link").href =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${id}?view=mRoster&view=mTeam`;
  };
  document.getElementById("espn-sync-toggle").addEventListener("click", () => {
    syncBody.hidden = !syncBody.hidden;
    refreshEspnLink();
    renderEspnStatus();
  });
  leagueIdInput.addEventListener("input", () => {
    refreshEspnLink();
    state.espnCfg.leagueId = (leagueIdInput.value || "").replace(/\D/g, "") || "1767084290";
    saveJSON(ESPN_SYNC_KEY, state.espnCfg);
  });

  // Auto-fetch (public league): fetch directly, pick your team once, then the
  // roster + free-agent flags + weekly opponent stay synced on every refresh.
  document.getElementById("espn-autofetch").addEventListener("click", async () => {
    const resultEl = document.getElementById("espn-result");
    resultEl.innerHTML = '<div class="loading">Fetching your league…</div>';
    await loadEspnLeague();
    if (!state.espn) {
      resultEl.innerHTML = `<div class="error-box">Couldn't reach ESPN from the browser
        (${escapeHtml(state.espnError || "unknown error")}). This usually means ESPN blocks
        cross-site connections — the copy/paste method below always works.</div>`;
      renderEspnStatus();
      return;
    }
    const preDraft = state.espn.teams.every((t) => !t.players.length);
    resultEl.innerHTML = `<p class="subtitle">✅ League fetched (${state.espn.teams.length} teams) — tap YOUR team to turn on auto-sync:</p>
      <div class="espn-teams">${state.espn.teams.map((t) =>
        `<button class="btn" data-espn-auto="${t.id}">${escapeHtml(t.name)} (${t.ids.length})</button>`).join("")}</div>
      ${preDraft ? '<p class="subtitle" style="margin-top:8px">Rosters showing (0) is normal before your draft — pick your team anyway, then use 🛰 Live Draft Sync on the Draft tab and it fills in as you draft.</p>' : ""}`;
    resultEl.onclick = async (e) => {
      const btn = e.target.closest("[data-espn-auto]");
      if (!btn) return;
      const team = state.espn.teams.find((t) => t.id === Number(btn.dataset.espnAuto));
      if (!team) return;
      state.espnCfg.teamId = team.id;
      state.espnCfg.teamName = team.name;
      saveJSON(ESPN_SYNC_KEY, state.espnCfg);
      await loadEspnLeague(); // re-apply with the chosen team (roster + opponent)
      resultEl.innerHTML = `<p class="subtitle">✅ Auto-sync on: <b>${escapeHtml(team.name)}</b> — ${team.ids.length} players imported. Your roster now updates itself.</p>`;
      renderAll();
    };
  });

  // Turn auto-sync off (delegated — the button lives in a re-rendered status line)
  document.getElementById("espn-sync-body").addEventListener("click", (e) => {
    if (!e.target.closest("#espn-sync-off")) return;
    state.espnCfg.teamId = null;
    state.espnCfg.teamName = null;
    saveJSON(ESPN_SYNC_KEY, state.espnCfg);
    renderEspnStatus();
  });
  document.getElementById("espn-import").addEventListener("click", () => {
    const resultEl = document.getElementById("espn-result");
    try {
      const teams = parseEspnLeague(document.getElementById("espn-paste").value);
      resultEl.innerHTML = `<p class="subtitle">Found ${teams.length} teams — tap yours:</p>
        <div class="espn-teams">${teams.map((t, i) =>
          `<button class="btn" data-espn-team="${i}">${escapeHtml(t.name)} (${t.players.length})</button>`).join("")}</div>`;
      resultEl.onclick = (e) => {
        const btn = e.target.closest("[data-espn-team]");
        if (!btn) return;
        const r = importEspnTeam(teams[Number(btn.dataset.espnTeam)]);
        if (r.total === 0) {
          resultEl.innerHTML = '<p class="subtitle">✅ Team selected. Rosters are empty until your draft — after (or during) it, 🛰 Live Draft Sync on the Draft tab or a re-sync here fills it in.</p>';
          return;
        }
        resultEl.innerHTML = `<p class="subtitle">✅ Imported ${r.matched} of ${r.total} players into My Roster.` +
          (r.unmatched.length ? `<br>Couldn't match: ${r.unmatched.map(escapeHtml).join(", ")} — add them with the search box (D/ST units: search the team name).` : "") +
          `</p>`;
      };
    } catch (err) {
      resultEl.innerHTML = `<div class="error-box">Couldn't read that. Make sure you copied the ENTIRE page from the link in step 2 (it should start with {"). ${escapeHtml(err.message)}</div>`;
    }
  });

  // ESPN live draft follow
  document.getElementById("draft-follow").addEventListener("click", () => {
    startDraftFollow().catch((e) => {
      document.getElementById("draft-follow-status").textContent = `⚠ ${e.message} — tap Follow to retry.`;
    });
  });

  // Mock draft simulator
  document.getElementById("mock-run").addEventListener("click", () => {
    if (!state.players.length) return;
    renderMockResult(runMockDraft());
  });

  // Bet ledger
  document.getElementById("ledger-add").addEventListener("click", () => {
    const desc = document.getElementById("ledger-desc").value.trim();
    const odds = parseInt(document.getElementById("ledger-odds").value, 10);
    const stake = parseFloat(document.getElementById("ledger-stake").value.replace("$", ""));
    if (!desc || Number.isNaN(odds) || Number.isNaN(stake) || stake <= 0) {
      alert("Need a description, American odds (e.g. -110), and a stake.");
      return;
    }
    const bets = loadJSON(LEDGER_KEY, []);
    bets.push({ id: String(Date.now()), desc, odds, stake, status: "open", ts: Date.now() });
    saveJSON(LEDGER_KEY, bets);
    document.getElementById("ledger-desc").value = "";
    document.getElementById("ledger-odds").value = "";
    document.getElementById("ledger-stake").value = "";
    renderLedger();
  });
  document.getElementById("ledger-list").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bet]");
    if (!btn) return;
    let bets = loadJSON(LEDGER_KEY, []);
    if (btn.dataset.res === "delete") {
      bets = bets.filter((b) => b.id !== btn.dataset.bet);
    } else {
      const bet = bets.find((b) => b.id === btn.dataset.bet);
      if (bet) bet.status = btn.dataset.res;
    }
    saveJSON(LEDGER_KEY, bets);
    renderLedger();
  });

  // Trade analyzer
  document.getElementById("trade-send-search").addEventListener("input", (e) =>
    renderTradeSuggestions("send", e.target.value));
  document.getElementById("trade-recv-search").addEventListener("input", (e) =>
    renderTradeSuggestions("recv", e.target.value));
  document.getElementById("trade-partner").addEventListener("change", () =>
    renderTradeSuggestions("recv", document.getElementById("trade-recv-search").value));
  document.getElementById("tab-trade").addEventListener("click", (e) => {
    const add = e.target.closest("[data-trade-add]");
    if (add) {
      const side = add.dataset.tradeAdd === "send" ? "tradeSend" : "tradeRecv";
      if (!state[side].includes(add.dataset.id)) state[side].push(add.dataset.id);
      document.getElementById(`trade-${add.dataset.tradeAdd}-search`).value = "";
      renderTradeSuggestions(add.dataset.tradeAdd, "");
      renderTrade();
      return;
    }
    const rm = e.target.closest("[data-trade-remove]");
    if (rm) {
      const side = rm.dataset.tradeRemove === "send" ? "tradeSend" : "tradeRecv";
      state[side] = state[side].filter((id) => id !== rm.dataset.id);
      renderTrade();
      return;
    }
    if (e.target.closest("#trade-eval")) evaluateTrade();
  });

  // The Odds API key + on-demand prop loading
  const oddsInput = document.getElementById("odds-key-input");
  oddsInput.value = state.oddsKey;
  document.getElementById("odds-key-save").addEventListener("click", async () => {
    state.oddsKey = oddsInput.value.trim();
    localStorage.setItem(ODDS_KEY_KEY, state.oddsKey);
    localStorage.removeItem(ODDS_CACHE_KEY); // force a fresh pull with the new key
    renderOddsSettings();
    if (state.oddsKey) {
      try {
        await loadOddsApi(true);
        renderBetting();
      } catch {
        document.getElementById("odds-quota").textContent =
          "⚠ Couldn't fetch with that key — double-check it (or quota may be exhausted).";
      }
    }
  });
  const sgoInput = document.getElementById("sgo-key-input");
  sgoInput.value = state.sgoKey;
  document.getElementById("sgo-key-save").addEventListener("click", async () => {
    state.sgoKey = sgoInput.value.trim();
    localStorage.setItem(SGO_KEY_KEY, state.sgoKey);
    localStorage.removeItem(SGO_CACHE_KEY);
    state.sgoStatus = null;
    renderOddsSettings();
    if (state.sgoKey) {
      try {
        await loadSgo(true);
        renderBetting();
      } catch (e2) {
        state.sgoStatus = `error — ${e2.message} (check the key)`;
        renderOddsSettings();
      }
    }
  });
  // Force-refresh lives inside the re-rendered settings panel — delegate.
  document.getElementById("tab-betting").addEventListener("click", async (e) => {
    if (!e.target.closest("#odds-force-refresh")) return;
    e.target.textContent = "Refreshing…";
    await Promise.allSettled([
      loadOddsApi(true).catch(() => {}),
      loadSgo(true).catch(() => {}),
    ]);
    renderBetting();
  });

  document.getElementById("betting-games").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-prop-home]");
    if (!btn) return;
    btn.textContent = "Loading…";
    btn.disabled = true;
    try {
      await loadPropLines(btn.dataset.propHome);
      renderBetting();
    } catch {
      btn.textContent = "⚠ Failed — check key/quota";
      btn.disabled = false;
    }
  });

  // Followed Bluesky insiders
  const handlesInput = document.getElementById("bsky-handles");
  handlesInput.value = state.bskyHandles.join(", ");
  document.getElementById("bsky-handles-save").addEventListener("click", async () => {
    state.bskyHandles = handlesInput.value.split(",").map((h) => h.trim().replace(/^@/, "")).filter(Boolean);
    saveJSON(BSKY_HANDLES_KEY, state.bskyHandles);
    await loadBillsExtras().catch(() => {});
    renderBills();
  });

  // Draft slot picker (snake-draft math for the Pick Advisor)
  const slotSel = document.getElementById("draft-slot");
  slotSel.innerHTML = Array.from({ length: TEAMS_IN_LEAGUE }, (_, i) =>
    `<option value="${i + 1}">${i + 1}</option>`).join("");
  slotSel.value = String(state.draftSlot);
  slotSel.addEventListener("change", () => {
    state.draftSlot = parseInt(slotSel.value, 10) || 5;
    saveJSON(DRAFT_SLOT_KEY, state.draftSlot);
    renderDraft();
  });

  // Scoring editor (My League tab) — delegated so re-renders keep working.
  const league = document.getElementById("league-content");
  league.addEventListener("change", (e) => {
    const input = e.target.closest(".scoring-input");
    if (!input) return;
    const key = input.dataset.key;
    const v = parseFloat(input.value);
    if (Number.isNaN(v)) { input.value = state.scoring[key]; return; }
    state.scoring[key] = v;
    saveScoringOverrides();
    renderLeague();   // refresh "edited" chips
    reanalyze();
  });
  league.addEventListener("click", (e) => {
    if (!e.target.closest("#scoring-reset")) return;
    if (confirm("Reset all scoring values to your league's defaults?")) {
      localStorage.removeItem(SCORING_KEY);
      state.scoring = loadScoring();
      renderLeague();
      reanalyze();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
initEvents();
renderLeague();
updateNotifyUI();
loadAll();
// Keep news & waiver trends fresh while the app is open.
setInterval(() => loadAll(), 10 * 60 * 1000);

// Game-day mode: while the Bills game is live, refresh the live feed —
// score, scoring plays, game thread, and Bluesky chatter — every 45s.
setInterval(async () => {
  if (billsGameEntry()?.status !== "in") return;
  try {
    parseScoreboard(await fetchJSON(ESPN_SCOREBOARD_URL));
  } catch { /* keep last known score */ }
  const fresh = await fetchBsky(MY_NFL_TEAM.name).catch(() => null);
  if (fresh) state.bskyBills = fresh;
  await loadBillsExtras().catch(() => {});
  renderBills();
}, LIVE_REFRESH_MS);

// PWA: offline shell + home-screen install.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* http or unsupported */ });
}
