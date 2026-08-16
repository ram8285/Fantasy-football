/* Fantasy Football Hub — frontend */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  news: [],
  rankings: [],        // full ALL-position rankings (used by draft board too)
  rankingsByPos: {},   // cache per position filter
  trendingAdds: [],
  trendingDrops: [],
  draft: loadDraft(),  // { taken: {id: 'me'|'other'}, log: [{id, by, name, pos}] }
  draftPos: 'ALL',
};

const ROSTER_SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
const FLEX_POSITIONS = ['RB', 'WR', 'TE'];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showOfflineBanner(live) {
  if (!live) $('#offline-banner').classList.remove('hidden');
}

/* ---------- Tabs ---------- */
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  $$('.tab').forEach((t) => t.classList.toggle('active', t === btn));
  $$('.panel').forEach((p) => p.classList.add('hidden'));
  $(`#panel-${btn.dataset.tab}`).classList.remove('hidden');
});

/* ---------- News ---------- */
async function loadNews() {
  try {
    const res = await fetch('/api/news');
    const data = await res.json();
    state.news = data.items;
    showOfflineBanner(data.live);
    $('#news-updated').textContent = `Updated ${new Date().toLocaleTimeString()} · refreshes every 5 min`;
    renderNews();
  } catch {
    $('#news-list').innerHTML = '<p class="empty">Could not load news.</p>';
  }
}

function renderNews() {
  const q = $('#news-search').value.toLowerCase().trim();
  const actionableOnly = $('#news-actionable').checked;
  let items = state.news;
  if (q) items = items.filter((i) => `${i.title} ${i.summary}`.toLowerCase().includes(q));
  if (actionableOnly) items = items.filter((i) => i.actionable);
  if (!items.length) {
    $('#news-list').innerHTML = '<p class="empty">No matching news.</p>';
    return;
  }
  $('#news-list').innerHTML = items.map((i) => `
    <article class="news-card ${i.actionable ? 'actionable' : ''}">
      <div class="news-meta">
        <span class="source-badge">${esc(i.source)}</span>
        ${i.published ? `<span>${timeAgo(i.published)}</span>` : ''}
        ${i.actionable ? '<span class="alert-badge">⚡ ACTIONABLE</span>' : ''}
      </div>
      <h4>${i.link ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>` : esc(i.title)}</h4>
      ${i.summary ? `<p>${esc(i.summary)}</p>` : ''}
    </article>
  `).join('');
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

$('#news-search').addEventListener('input', renderNews);
$('#news-actionable').addEventListener('change', renderNews);
setInterval(loadNews, 5 * 60 * 1000);

/* ---------- Rankings ---------- */
async function fetchRankings(position) {
  if (state.rankingsByPos[position]) return state.rankingsByPos[position];
  const res = await fetch(`/api/rankings?position=${position}&limit=300`);
  const data = await res.json();
  showOfflineBanner(data.live);
  state.rankingsByPos[position] = data.rankings;
  return data.rankings;
}

async function loadRankings() {
  const pos = $('#pos-filter .pos.active').dataset.pos;
  try {
    const rankings = await fetchRankings(pos);
    if (pos === 'ALL') state.rankings = rankings;
    renderRankings(rankings);
  } catch {
    $('#rankings-list').innerHTML = '<p class="empty">Could not load rankings.</p>';
  }
}

function playerRow(p, extraCols = '') {
  return `
    <tr data-id="${esc(p.id)}">
      <td class="dim">${p.rank}</td>
      <td><b>${esc(p.name)}</b>${p.injury_status ? `<span class="injury">${esc(p.injury_status)}</span>` : ''}</td>
      <td><span class="pos-badge pos-${esc(p.position)}">${esc(p.posRank || p.position)}</span></td>
      <td class="dim">${esc(p.team)}</td>
      <td class="dim">${p.age ?? '—'}</td>
      ${extraCols}
    </tr>`;
}

function renderRankings(rankings) {
  const q = $('#rankings-search').value.toLowerCase().trim();
  let list = rankings;
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q);
  if (!list.length) {
    $('#rankings-list').innerHTML = '<p class="empty">No matching players.</p>';
    return;
  }
  let lastTier = null;
  const rows = list.map((p) => {
    let tierRow = '';
    if (!q && p.tier !== lastTier) {
      lastTier = p.tier;
      tierRow = `<tr class="tier-row"><td colspan="5">Tier ${p.tier}</td></tr>`;
    }
    return tierRow + playerRow(p);
  }).join('');
  $('#rankings-list').innerHTML = `
    <table class="rank-table">
      <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Team</th><th>Age</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

$('#pos-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('.pos');
  if (!btn) return;
  $$('#pos-filter .pos').forEach((b) => b.classList.toggle('active', b === btn));
  loadRankings();
});
$('#rankings-search').addEventListener('input', () => {
  const pos = $('#pos-filter .pos.active').dataset.pos;
  renderRankings(state.rankingsByPos[pos] || []);
});

/* ---------- Draft board ---------- */
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem('ffhub-draft')) || { taken: {}, log: [] };
  } catch {
    return { taken: {}, log: [] };
  }
}

function saveDraft() {
  localStorage.setItem('ffhub-draft', JSON.stringify(state.draft));
}

function myPlayers() {
  return state.draft.log.filter((e) => e.by === 'me');
}

// Fill roster slots in order; FLEX takes the best leftover RB/WR/TE.
function computeRoster() {
  const mine = myPlayers();
  const used = new Set();
  const slots = ROSTER_SLOTS.map((slot) => {
    const eligible = slot === 'FLEX' ? FLEX_POSITIONS : [slot];
    const pick = mine.find((e) => !used.has(e.id) && eligible.includes(e.pos));
    if (pick) used.add(pick.id);
    return { slot, player: pick || null };
  });
  const bench = mine.filter((e) => !used.has(e.id));
  return { slots, bench };
}

function neededPositions() {
  const { slots } = computeRoster();
  const need = new Set();
  for (const { slot, player } of slots) {
    if (player) continue;
    if (slot === 'FLEX') FLEX_POSITIONS.forEach((p) => need.add(p));
    else need.add(slot);
  }
  return need;
}

function renderDraft() {
  const q = $('#draft-search').value.toLowerCase().trim();
  let available = state.rankings.filter((p) => !state.draft.taken[p.id]);
  if (state.draftPos !== 'ALL') available = available.filter((p) => p.position === state.draftPos);
  if (q) available = available.filter((p) => p.name.toLowerCase().includes(q));

  // Suggestion: best available at a position of need, otherwise best overall.
  const need = neededPositions();
  const bestAvailable = state.rankings.filter((p) => !state.draft.taken[p.id]);
  const suggestion = bestAvailable.find((p) => need.size === 0 || need.has(p.position)) || bestAvailable[0];
  if (suggestion) {
    const reason = need.has(suggestion.position)
      ? `fills your ${suggestion.position} need`
      : 'best player available';
    $('#draft-suggestion').innerHTML =
      `💡 Suggested pick: <b>${esc(suggestion.name)}</b> (${esc(suggestion.posRank || suggestion.position)}, ${esc(suggestion.team)}) — ${reason}, overall #${suggestion.rank}`;
    $('#draft-suggestion').classList.remove('hidden');
  } else {
    $('#draft-suggestion').classList.add('hidden');
  }

  const rows = available.slice(0, 100).map((p) => playerRow(p, `
    <td class="draft-actions">
      <button class="btn small primary" data-action="me" data-id="${esc(p.id)}">My pick</button>
      <button class="btn small" data-action="other" data-id="${esc(p.id)}">Taken</button>
    </td>`)).join('');

  $('#draft-list').innerHTML = rows
    ? `<table class="rank-table">
        <thead><tr><th>#</th><th>Player</th><th>Pos</th><th>Team</th><th>Age</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : '<p class="empty">No available players match.</p>';

  renderRoster();
}

function renderRoster() {
  const { slots, bench } = computeRoster();
  $('#my-roster').innerHTML = slots.map(({ slot, player }) => `
    <div class="roster-slot">
      <span class="slot-name">${slot}</span>
      ${player
        ? `<span>${esc(player.name)} <span class="dim">(${esc(player.team)})</span></span>`
        : '<span class="empty-slot">empty</span>'}
    </div>
  `).join('') + bench.map((e) => `
    <div class="roster-slot">
      <span class="slot-name">BN</span>
      <span>${esc(e.name)} <span class="dim">(${esc(e.pos)})</span></span>
    </div>
  `).join('');

  $('#draft-log').innerHTML = state.draft.log.length
    ? [...state.draft.log].reverse().map((e, i) =>
        `<div>${state.draft.log.length - i}. ${esc(e.name)} — ${e.by === 'me' ? '<b>you</b>' : 'other team'}</div>`
      ).join('')
    : '<div class="dim">No picks yet.</div>';
}

$('#draft-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const player = state.rankings.find((p) => p.id === btn.dataset.id);
  if (!player) return;
  const by = btn.dataset.action === 'me' ? 'me' : 'other';
  state.draft.taken[player.id] = by;
  state.draft.log.push({ id: player.id, by, name: player.name, pos: player.position, team: player.team });
  saveDraft();
  renderDraft();
});

$('#draft-undo').addEventListener('click', () => {
  const last = state.draft.log.pop();
  if (last) delete state.draft.taken[last.id];
  saveDraft();
  renderDraft();
});

$('#draft-reset').addEventListener('click', () => {
  if (!confirm('Clear the whole draft board and your roster?')) return;
  state.draft = { taken: {}, log: [] };
  saveDraft();
  renderDraft();
});

$('#draft-search').addEventListener('input', renderDraft);
$('#draft-pos-filter').addEventListener('click', (e) => {
  const btn = e.target.closest('.pos');
  if (!btn) return;
  $$('#draft-pos-filter .pos').forEach((b) => b.classList.toggle('active', b === btn));
  state.draftPos = btn.dataset.pos;
  renderDraft();
});

/* ---------- Waiver wire ---------- */
async function loadWaivers() {
  try {
    const [adds, drops] = await Promise.all([
      fetch('/api/trending/add').then((r) => r.json()),
      fetch('/api/trending/drop').then((r) => r.json()),
    ]);
    showOfflineBanner(adds.live);
    state.trendingAdds = adds.items;
    state.trendingDrops = drops.items;
    renderWaivers();
  } catch {
    $('#waiver-adds').innerHTML = '<p class="empty">Could not load trends.</p>';
    $('#waiver-drops').innerHTML = '<p class="empty">Could not load trends.</p>';
  }
}

function waiverCard(p, i, isAdd) {
  return `
    <div class="waiver-card">
      <span class="waiver-rank">${i + 1}</span>
      <div class="waiver-info">
        <div class="waiver-name">${esc(p.name)}${p.injury_status ? `<span class="injury">${esc(p.injury_status)}</span>` : ''}</div>
        <div class="waiver-sub"><span class="pos-badge pos-${esc(p.position)}">${esc(p.position)}</span> ${esc(p.team)}${p.rank ? ` · overall #${p.rank}` : ''}</div>
      </div>
      <div class="waiver-count"><b>${p.count.toLocaleString()}</b>${isAdd ? 'adds' : 'drops'} (24h)</div>
      ${isAdd && p.faab ? `<span class="faab-badge">FAAB ${p.faab}%</span>` : ''}
    </div>`;
}

function renderWaivers() {
  $('#waiver-adds').innerHTML = state.trendingAdds.length
    ? state.trendingAdds.map((p, i) => waiverCard(p, i, true)).join('')
    : '<p class="empty">No trending adds right now.</p>';
  $('#waiver-drops').innerHTML = state.trendingDrops.length
    ? state.trendingDrops.map((p, i) => waiverCard(p, i, false)).join('')
    : '<p class="empty">No trending drops right now.</p>';
}

setInterval(loadWaivers, 15 * 60 * 1000);

/* ---------- Init ---------- */
async function init() {
  loadNews();
  loadWaivers();
  await fetchRankings('ALL').then((r) => { state.rankings = r; }).catch(() => {});
  renderRankings(state.rankings);
  renderDraft();
}
init();
