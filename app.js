/* Gridiron HQ — fantasy football command center.
 * Data sources (free, no keys):
 *   - Sleeper API: full NFL player DB + trending adds/drops
 *   - ESPN public API: live NFL news
 * Draft state persists in localStorage on this device.
 */
"use strict";

// ---------------------------------------------------------------------------
// League scoring (from your ESPN league settings screenshots).
// Passing/rushing weren't in the screenshots — those rows use ESPN defaults
// and are marked; edit the numbers here if your league differs.
// ---------------------------------------------------------------------------
const LEAGUE_SCORING = {
  "Passing (ESPN defaults — edit app.js if different)": [
    ["Passing Yards", "0.04/yd (1 pt per 25)"],
    ["TD Pass", "4"],
    ["Interception Thrown", "-2"],
    ["2pt Passing Conversion", "2"],
  ],
  "Rushing (ESPN defaults — edit app.js if different)": [
    ["Rushing Yards", "0.1/yd (1 pt per 10)"],
    ["TD Rush", "6"],
    ["2pt Rushing Conversion", "2"],
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
    ["Fumble Recovered for TD (FTD)", "6"],
    ["Total Fumbles Lost (FUML)", "-2"],
  ],
};

const STRATEGY_NOTES = [
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

const PLAYERS_CACHE_KEY = "ghq_players_v1";
const PLAYERS_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — ranks shift slowly
const DRAFT_KEY = "ghq_draft_v1";

// Standard ESPN lineup used for the roster panel.
const ROSTER_SLOTS = [
  ["QB", 1], ["RB", 2], ["WR", 2], ["TE", 1], ["FLEX", 1], ["D/ST", 1], ["K", 1], ["Bench", 7],
];

const state = {
  players: [],            // [{id, name, pos, team, rank, injury}]
  byId: new Map(),
  trendingAdd: [],        // [{id, count}]
  trendingDrop: [],
  trendMap: new Map(),    // id -> {add, drop}
  news: [],
  draft: loadDraft(),     // { [playerId]: "mine" | "taken" }
  rankPos: "ALL",
  rankQuery: "",
  draftPos: "ALL",
  draftQuery: "",
  hideDrafted: true,
};

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
  catch { return {}; }
}
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft));
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
  return players;
}

async function loadAll(force = false) {
  setUpdatedAt("updating…");

  const jobs = [
    loadPlayers(force)
      .then((players) => {
        state.players = players;
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
  ];

  await Promise.allSettled(jobs);

  state.trendMap = new Map();
  for (const t of state.trendingAdd) state.trendMap.set(t.id, { add: t.count, drop: 0 });
  for (const t of state.trendingDrop) {
    const cur = state.trendMap.get(t.id) || { add: 0, drop: 0 };
    cur.drop = t.count;
    state.trendMap.set(t.id, cur);
  }

  renderAll();
  setUpdatedAt(`updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`);
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
    const eligible = want === "FLEX" ? ["RB", "WR", "TE"] : want === "D/ST" ? ["DEF"] : [want];
    for (const p of mine) {
      if (!used.has(p.id) && eligible.includes(p.pos)) { used.add(p.id); return p; }
    }
    return null;
  };

  let html = "";
  for (const [slot, count] of ROSTER_SLOTS) {
    for (let i = 0; i < count; i++) {
      let p = null;
      if (slot === "Bench") {
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
    const tierSize = (pos === "RB" || pos === "WR") ? 24 : 12;
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
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
initEvents();
renderLeague();
loadAll();
// Keep news & waiver trends fresh while the app is open.
setInterval(() => loadAll(), 10 * 60 * 1000);
