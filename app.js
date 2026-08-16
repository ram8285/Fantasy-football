/* Gridiron HQ — fantasy football command center.
 * Data sources (free, no keys):
 *   - Sleeper API: full NFL player DB + trending adds/drops
 *   - ESPN public API: live NFL news
 * Draft state persists in localStorage on this device.
 */
"use strict";

// ---------------------------------------------------------------------------
// League: "Wings, Rings, and Eye Patches" — 10-team ESPN H2H points.
// Scoring below is from the league settings screenshots.
// ---------------------------------------------------------------------------
const LEAGUE_SCORING = {
  "Passing": [
    ["Passing Yards (PY)", "0.04/yd"],
    ["TD Pass (PTD)", "6"],
    ["50+ yard TD pass bonus (PTD50)", "1"],
    ["Interceptions Thrown (INT)", "-2"],
    ["2pt Passing Conversion (2PC)", "2"],
    ["400+ yard passing game (P400)", "1"],
  ],
  "Rushing": [
    ["Rushing Yards (RY)", "0.1/yd"],
    ["TD Rush (RTD)", "6"],
    ["50+ yard TD rush bonus (RTD50)", "1"],
    ["2pt Rushing Conversion (2PR)", "2"],
    ["200+ yard rushing game (RY200)", "1"],
  ],
  "Receiving": [
    ["Receiving Yards (REY)", "0.1/yd"],
    ["Each Reception (REC)", "0.5"],
    ["TD Reception (RETD)", "6"],
    ["50+ yard TD rec bonus (RETD50)", "1"],
    ["2pt Receiving Conversion (2PRE)", "2"],
    ["200+ yard receiving game (REY200)", "1"],
  ],
  "Kicking": [
    ["Each PAT Made (PAT)", "1"],
    ["Total FG Missed (FGM)", "-1"],
    ["FG Made 0-39 yards (FG0)", "3"],
    ["FG Made 40-49 yards (FG40)", "4"],
    ["FG Made 50-59 yards (FG50)", "5"],
    ["FG Made 60+ yards (FG60)", "6"],
  ],
  "Team Defense / Special Teams": [
    ["Each Sack (SK)", "1"],
    ["Interception Return TD (INTTD)", "6"],
    ["Fumble Return TD (FRTD)", "6"],
    ["Kickoff Return TD (KRTD)", "6"],
    ["Punt Return TD (PRTD)", "6"],
    ["Blocked Punt or FG return for TD (BLKKRTD)", "6"],
    ["Blocked Punt, PAT or FG (BLKK)", "2"],
    ["Each Interception (INT)", "2"],
    ["Each Fumble Recovered (FR)", "2"],
    ["Each Safety (SF)", "2"],
    ["0 points allowed (PA0)", "5"],
    ["1-6 points allowed (PA1)", "4"],
    ["7-13 points allowed (PA7)", "3"],
    ["14-17 points allowed (PA14)", "1"],
    ["28-34 points allowed (PA28)", "-1"],
    ["35-45 points allowed (PA35)", "-3"],
    ["46+ points allowed (PA46)", "-5"],
    ["Less than 100 total yards allowed (YA100)", "5"],
    ["100-199 total yards allowed (YA199)", "3"],
    ["200-299 total yards allowed (YA299)", "2"],
    ["350-399 total yards allowed (YA399)", "-1"],
    ["400-449 total yards allowed (YA449)", "-3"],
    ["450-499 total yards allowed (YA499)", "-5"],
    ["500-549 total yards allowed (YA549)", "-6"],
    ["550+ total yards allowed (YA550)", "-7"],
    ["2pt Return (2PTRET)", "2"],
    ["1pt Safety (1PSF)", "1"],
  ],
  "Miscellaneous": [
    ["Kickoff Return TD (KRTD)", "6"],
    ["Punt Return TD (PRTD)", "6"],
    ["Fumble Recovered for TD (FTD)", "6"],
    ["Total Fumbles Lost (FUML)", "-2"],
    ["Interception Return TD (INTTD)", "6"],
    ["Fumble Return TD (FRTD)", "6"],
    ["Blocked Punt or FG return for TD (BLKKRTD)", "6"],
    ["2pt Return (2PTRET)", "2"],
    ["1pt Safety (1PSF)", "1"],
  ],
};

const STRATEGY_NOTES = [
  {
    title: "6-point passing TDs — QBs are gold here",
    body: "Your league pays 6 per passing TD instead of ESPN's default 4. Elite QBs outscore every other position by a wide margin. Draft QBs earlier than standard rankings suggest, and don't stream the position if you can lock up a stud.",
  },
  {
    title: "The OP slot = start TWO quarterbacks",
    body: "Your utility (OP) slot accepts any offensive player — including a QB. Combined with 6-point passing TDs, a second QB is almost always the best use of that slot. This app's Rankings and Draft boards are already re-ranked for that reality (the '▲ market #N' badge shows how far standard apps underrate a player here). With 10 teams starting 2 QBs, 20 QBs have starter value — leaguemates drafting off default rankings will let QBs slide. Take them.",
  },
  {
    title: "Half-PPR (0.5 per catch)",
    body: "Splits the difference between standard and full PPR. High-volume receivers still matter, but touchdown upside and yardage carry more weight than in full PPR. RBs who catch passes (dual threats) are extra valuable.",
  },
  {
    title: "Kickers with big legs are worth more here",
    body: "Your league pays 5 for 50-59 yd FGs and 6 for 60+, with only -1 per miss. Target kickers with strong legs on teams that stall between the 30s — long-FG volume is a real edge.",
  },
  {
    title: "D/ST is a massive weekly swing",
    body: "Between points-allowed and yards-allowed brackets, a shutdown day can score 20+, and a blowup can go deep negative (-12 or worse). Stream defenses against weak offenses every week instead of holding one all season — check the Waivers tab.",
  },
  {
    title: "Fumbles hurt (-2)",
    body: "Fumble-prone ball carriers cost real points. It's a tiebreaker when two players are close in your rankings.",
  },
  {
    title: "Bonuses reward boom games",
    body: "50+ yard TD catches and 200-yard receiving games earn extra. Deep-threat receivers get a small bump in value over pure possession guys.",
  },
];

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
// ESPN and Sleeper agree on team codes except Washington.
const ESPN_TO_SLEEPER = { WSH: "WAS" };

const PLAYERS_CACHE_KEY = "ghq_players_v1";
const PLAYERS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — ranks shift slowly
const DRAFT_KEY = "ghq_draft_v1";
const MYTEAM_KEY = "ghq_myteam_v1";
const NOTIFY_KEY = "ghq_notify_v1";
const SEEN_KEY = "ghq_seen_v1";       // news/waiver items already notified about
const RANKSNAP_KEY = "ghq_ranksnap_v1";   // rank snapshot from a previous visit
const RANKDELTA_KEY = "ghq_rankdelta_v1"; // computed rank movement
const RANKSNAP_MIN_AGE_MS = 12 * 60 * 60 * 1000;

// Your league's actual lineup: OP is a utility slot that accepts ANY offensive
// player, including a second QB (big deal with 6-pt passing TDs).
const ROSTER_SLOTS = [
  ["QB", 1], ["RB", 2], ["WR", 2], ["TE", 1], ["OP", 1], ["D/ST", 1], ["K", 1], ["Bench", 7], ["IR", 1],
];
const SLOT_ELIGIBLE = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  OP: ["QB", "RB", "WR", "TE"], "D/ST": ["DEF"], K: ["K"],
};

const state = {
  players: [],            // [{id, name, pos, team, rank, injury}]
  byId: new Map(),
  trendingAdd: [],        // [{id, count}]
  trendingDrop: [],
  trendMap: new Map(),    // id -> {add, drop}
  news: [],
  draft: loadDraft(),     // { [playerId]: "mine" | "taken" }
  myTeam: loadJSON(MYTEAM_KEY, []),      // [playerId]
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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
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
  // Target overall slot for the r-th QB (10-team, 20 starting QB slots,
  // 6-pt pass TDs): ~QB1 #1 overall, QB10 ~#17, QB20 ~#35, then a fast fade.
  const qbSlot = (r) => {
    if (r <= 20) return Math.max(1, Math.round(1.8 * r - 0.8));
    if (r <= 30) return 36 + (r - 20) * 4;
    return 76 + (r - 30) * 8;
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
  ];

  await Promise.allSettled(jobs);

  // Projections need the season/week from the scoreboard, so fetch them after.
  if (state.seasonYear && state.week) {
    try {
      const proj = await fetchJSON(projectionsUrl(state.seasonYear, state.week));
      parseProjections(proj);
    } catch { /* projections unavailable — optimizer falls back to ranks */ }
  }

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
  for (const ev of d.events || []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const home = comp.competitors?.find((c) => c.homeAway === "home");
    const away = comp.competitors?.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const h = normTeam(home.team?.abbreviation);
    const a = normTeam(away.team?.abbreviation);
    if (!h || !a) continue;
    state.schedule.set(h, { opp: a, homeAway: "home", date: ev.date });
    state.schedule.set(a, { opp: h, homeAway: "away", date: ev.date });
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

function parseProjections(raw) {
  // Sleeper serves projections either as {player_id: statsObj} or as an array
  // of {player_id, stats}. Normalize both, scoring with THIS league's rules.
  state.projections = new Map();
  const put = (id, stats) => {
    if (!id || !stats) return;
    const pts = leaguePoints(stats);
    if (pts > 0) state.projections.set(String(id), pts);
  };
  if (Array.isArray(raw)) {
    for (const row of raw) put(row.player_id, row.stats || row);
  } else if (raw && typeof raw === "object") {
    for (const [id, stats] of Object.entries(raw)) put(id, stats);
  }
}

// Score a Sleeper stat line with the league's exact settings. Rate-based
// yardage-game bonuses (P400/RY200/REY200) are omitted — projections are
// averages, so those thresholds almost never trigger meaningfully.
function leaguePoints(s) {
  const n = (k) => Number(s[k]) || 0;
  let pts =
    n("pass_yd") * 0.04 + n("pass_td") * 6 + n("pass_int") * -2 + n("pass_2pt") * 2 +
    n("rush_yd") * 0.1 + n("rush_td") * 6 + n("rush_2pt") * 2 +
    n("rec") * 0.5 + n("rec_yd") * 0.1 + n("rec_td") * 6 + n("rec_2pt") * 2 +
    n("fum_lost") * -2;
  // Kicking
  pts +=
    n("xpm") * 1 - n("fgmiss") * 1 - n("xpmiss") * 0 +
    (n("fgm_0_19") + n("fgm_20_29") + n("fgm_30_39")) * 3 +
    n("fgm_40_49") * 4 +
    (n("fgm_50_59") || n("fgm_50p")) * 5 +
    n("fgm_60p") * 6;
  // Team defense
  pts +=
    n("sack") * 1 + (n("int") + n("def_int")) * 2 + n("fum_rec") * 2 +
    (n("def_td") + n("def_st_td")) * 6 + n("safe") * 2 + n("blk_kick") * 2;
  if (s.pts_allow !== undefined) pts += paBracket(n("pts_allow"));
  if (s.yds_allow !== undefined) pts += yaBracket(n("yds_allow"));
  return Math.round(pts * 10) / 10;
}

function paBracket(pa) {
  if (pa <= 0) return 5;
  if (pa <= 6) return 4;
  if (pa <= 13) return 3;
  if (pa <= 17) return 1;
  if (pa <= 27) return 0;
  if (pa <= 34) return -1;
  if (pa <= 45) return -3;
  return -5;
}
function yaBracket(ya) {
  if (ya < 100) return 5;
  if (ya < 200) return 3;
  if (ya < 300) return 2;
  if (ya < 350) return 0;
  if (ya < 400) return -1;
  if (ya < 450) return -3;
  if (ya < 500) return -5;
  if (ya < 550) return -6;
  return -7;
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

function renderNews() {
  const el = document.getElementById("news-list");
  if (!state.news.length) return; // error already shown, or still loading
  el.innerHTML = state.news.map((a) => {
    const link = a.links?.web?.href || a.links?.mobile?.href || "#";
    const isInjury = /injur|out |questionable|doubtful|IR|carted|surgery|concussion/i.test(a.headline + " " + (a.description || ""));
    return `<a class="news-card" href="${escapeHtml(link)}" target="_blank" rel="noopener">
      <h3>${escapeHtml(a.headline)}</h3>
      <p>${escapeHtml(a.description || "")}</p>
      <div class="news-meta">
        <span>${timeAgo(a.published)}</span>
        ${isInjury ? '<span class="news-badge">⚕ injury-related</span>' : ""}
      </div>
    </a>`;
  }).join("");
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

// ----- Draft -----
function renderDraft() {
  if (!state.players.length) return;

  const entries = Object.entries(state.draft);
  document.getElementById("draft-pick-count").textContent = entries.length;
  document.getElementById("draft-my-count").textContent =
    entries.filter(([, v]) => v === "mine").length;

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

// ----- Start/Sit & lineup optimizer -----

// Matchup context for a player's NFL team this week.
function matchupFor(team) {
  const game = state.schedule.get(team);
  if (!game) return state.schedule.size ? { bye: true } : null; // null = no schedule data
  const def = state.defense.get(game.opp);
  let label = null, cls = "neutral", adj = 0;
  if (def && def.games >= 2) {
    if (def.easeRank <= 8) { label = "Great matchup"; cls = "great"; adj = 0.05; }
    else if (def.easeRank <= 16) { label = "Good matchup"; cls = "good"; adj = 0.025; }
    else if (def.easeRank <= 24) { label = "Tough matchup"; cls = "tough"; adj = -0.025; }
    else { label = "Brutal matchup"; cls = "brutal"; adj = -0.05; }
  }
  return {
    bye: false,
    opp: game.opp,
    homeAway: game.homeAway,
    label, cls, adj,
    oppPaPerGame: def && def.games >= 2 ? def.paPerGame : null,
  };
}

// Projected points in this league's scoring, matchup-adjusted for sorting.
// Falls back to a rank-derived estimate when projections are unavailable.
function playerScore(p) {
  const m = matchupFor(p.team);
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
  const dedicated = ["QB", "RB", "RB", "WR", "WR", "TE", "D/ST", "K"];
  for (const slot of dedicated) {
    const pick = scored.find((s) => !used.has(s.p.id) && SLOT_ELIGIBLE[slot].includes(s.p.pos));
    if (pick) used.add(pick.p.id);
    starters.push({ slot, pick: pick || null });
  }
  // OP last: best remaining offensive player (often a 2nd QB in this league).
  const op = scored.find((s) => !used.has(s.p.id) && SLOT_ELIGIBLE.OP.includes(s.p.pos));
  if (op) used.add(op.p.id);
  // Show OP right after TE, before D/ST.
  starters.splice(6, 0, { slot: "OP", pick: op || null });
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
  return `<span class="mu-opp">${vs}</span> ${label}`;
}

function renderStartSit() {
  const weekEl = document.getElementById("startsit-week");
  if (state.week && state.seasonYear) {
    const pre = state.seasonType !== 2 ? " (preseason — regular-season data may be limited)" : "";
    weekEl.innerHTML = `Week <strong>${state.week}</strong>, ${state.seasonYear}${pre} · projections scored with <strong>your exact league rules</strong> (6-pt pass TDs, half-PPR, OP slot) + matchup strength.`;
  }
  renderMyTeamManager();
  renderLineup();
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

  let html = `<div class="lineup-card">
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

  for (const a of state.news) {
    const key = (a.headline || "").slice(0, 120);
    if (!key || seenNews.has(key)) continue;
    seenNews.add(key);
    const isInjury = /injur|out |questionable|doubtful|IR|carted|surgery|concussion/i
      .test(a.headline + " " + (a.description || ""));
    if (isInjury && !firstRun && fired < 2) {
      showNotification("⚕ Injury news", a.headline);
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

// ----- League -----
function renderLeague() {
  const el = document.getElementById("league-content");
  let html = STRATEGY_NOTES.map((n) =>
    `<div class="strategy-card"><h4>${escapeHtml(n.title)}</h4><p>${escapeHtml(n.body)}</p></div>`
  ).join("");

  for (const [section, rows] of Object.entries(LEAGUE_SCORING)) {
    html += `<div class="scoring-section"><h3>${escapeHtml(section)}</h3><table class="scoring-table">`;
    for (const [label, pts] of rows) {
      const neg = String(pts).trim().startsWith("-");
      html += `<tr><td>${escapeHtml(label)}</td><td class="${neg ? "pts-neg" : "pts-pos"}">${escapeHtml(pts)}</td></tr>`;
    }
    html += "</table></div>";
  }
  el.innerHTML = html;
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

// PWA: offline shell + home-screen install.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* http or unsupported */ });
}
