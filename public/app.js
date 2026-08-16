'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  news: { items: [], errors: [], sources: new Set(), activeSource: 'All', query: '' },
  rankings: { players: [], pos: 'ALL', query: '' },
  trending: { adds: [], drops: [], hotIds: new Set() },
  draft: {
    pos: 'ALL',
    query: '',
    hideDrafted: false,
    // { [playerId]: 'gone' | 'mine' }
    picks: loadDraftState(),
  },
};

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const ROSTER_SLOTS = [
  { pos: 'QB', need: 1 }, { pos: 'RB', need: 2 }, { pos: 'WR', need: 2 },
  { pos: 'TE', need: 1 }, { pos: 'FLEX', need: 1 }, { pos: 'K', need: 1 }, { pos: 'DEF', need: 1 },
];
const DRAFT_KEY = 'ffhq-draft-v1';

function loadDraftState() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
  catch { return {}; }
}
function saveDraftState() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.draft.picks));
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function setNotice(id, msg) {
  const el = $(id);
  if (!msg) { el.hidden = true; return; }
  el.textContent = msg;
  el.hidden = false;
}

function injuryBadge(injury) {
  if (!injury) return '';
  const cls = injury === 'Questionable' ? 'injury-badge injury-Questionable' : 'injury-badge';
  return `<span class="${cls}">${esc(injury)}</span>`;
}

function posBadge(pos) {
  return `<span class="pos-badge pos-${esc(pos)}">${esc(pos)}</span>`;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach((p) =>
      p.classList.toggle('active', p.id === `panel-${btn.dataset.tab}`));
  });
});

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

async function loadNews() {
  try {
    const data = await getJson('/api/news');
    state.news.items = data.items;
    state.news.errors = data.errors || [];
    state.news.sources = new Set(data.items.map((i) => i.source));
    renderNewsSources();
    renderNews();
    $('#last-updated').textContent = `Updated ${timeAgo(data.updated)}`;
  } catch (err) {
    $('#news-list').innerHTML = '';
    setNotice('#news-notice', `Couldn't load news: ${err.message}. Check your internet connection and refresh.`);
  }
}

function renderNewsSources() {
  const wrap = $('#news-sources');
  const sources = ['All', ...state.news.sources];
  wrap.innerHTML = sources.map((s) =>
    `<button class="chip ${s === state.news.activeSource ? 'active' : ''}" data-source="${esc(s)}">${esc(s)}</button>`
  ).join('');
  wrap.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.news.activeSource = chip.dataset.source;
      renderNewsSources();
      renderNews();
    });
  });
}

function renderNews() {
  const { items, activeSource, query, errors } = state.news;
  const q = query.trim().toLowerCase();
  const filtered = items.filter((i) =>
    (activeSource === 'All' || i.source === activeSource) &&
    (!q || `${i.title} ${i.summary}`.toLowerCase().includes(q))
  );
  const failed = errors.map((e) => e.source).join(', ');
  setNotice('#news-notice', failed ? `Some feeds are unavailable right now: ${failed}.` : '');
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // highlight items < 2h old
  $('#news-list').innerHTML = filtered.length
    ? filtered.map((i) => `
      <article class="news-item ${i.date && new Date(i.date).getTime() > cutoff ? 'fresh' : ''}">
        <div class="news-head">
          <span class="source-badge">${esc(i.source)}</span>
          <a class="news-title" href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.title)}</a>
          <span class="news-meta">${timeAgo(i.date)}</span>
        </div>
        ${i.summary ? `<p class="news-summary">${esc(i.summary)}</p>` : ''}
      </article>`).join('')
    : '<div class="loading">No stories match your filter.</div>';
}

$('#news-search').addEventListener('input', (e) => {
  state.news.query = e.target.value;
  renderNews();
});

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

async function loadRankings() {
  try {
    const data = await getJson('/api/players');
    state.rankings.players = data.players;
    renderRankings();
    renderDraft();
  } catch (err) {
    $('#rank-body').innerHTML = '';
    setNotice('#rank-notice', `Couldn't load rankings: ${err.message}`);
  }
}

function filteredPlayers(pos, query) {
  const q = query.trim().toLowerCase();
  return state.rankings.players.filter((p) =>
    (pos === 'ALL' || p.pos === pos) &&
    (!q || `${p.name} ${p.team}`.toLowerCase().includes(q))
  );
}

function renderPosChips(wrapSel, current, onPick) {
  const wrap = $(wrapSel);
  wrap.innerHTML = POSITIONS.map((p) =>
    `<button class="chip ${p === current ? 'active' : ''}" data-pos="${p}">${p}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach((chip) =>
    chip.addEventListener('click', () => onPick(chip.dataset.pos)));
}

function renderRankings() {
  renderPosChips('#rank-positions', state.rankings.pos, (p) => {
    state.rankings.pos = p; renderRankings();
  });
  const rows = filteredPlayers(state.rankings.pos, state.rankings.query).slice(0, 300);
  $('#rank-body').innerHTML = rows.length
    ? rows.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${posBadge(p.pos)}</td>
        <td>${esc(p.team)}</td>
        <td>${p.age ?? '—'}</td>
        <td>${p.exp == null ? '—' : p.exp === 0 ? 'R' : p.exp}</td>
        <td>${injuryBadge(p.injury)}</td>
        <td>${state.trending.hotIds.has(p.id) ? '<span class="hot">🔥 trending</span>' : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="loading">No players match.</td></tr>';
}

$('#rank-search').addEventListener('input', (e) => {
  state.rankings.query = e.target.value;
  renderRankings();
});

// ---------------------------------------------------------------------------
// Draft kit
// ---------------------------------------------------------------------------

function renderDraft() {
  renderPosChips('#draft-positions', state.draft.pos, (p) => {
    state.draft.pos = p; renderDraft();
  });
  const rows = filteredPlayers(state.draft.pos, state.draft.query)
    .filter((p) => !(state.draft.hideDrafted && state.draft.picks[p.id]))
    .slice(0, 300);
  $('#draft-body').innerHTML = rows.length
    ? rows.map((p) => {
      const status = state.draft.picks[p.id];
      return `
      <tr class="${status === 'gone' ? 'is-drafted' : status === 'mine' ? 'is-mine' : ''}" data-id="${esc(p.id)}">
        <td>${p.rank < 9999999 ? p.rank : '—'}</td>
        <td><strong class="draft-name">${esc(p.name)}</strong></td>
        <td>${posBadge(p.pos)}</td>
        <td>${esc(p.team)}</td>
        <td>${injuryBadge(p.injury)}</td>
        <td>
          <div class="draft-actions">
            <button class="btn btn-small" data-act="mine" title="I drafted this player">${status === 'mine' ? 'Undo' : 'Mine'}</button>
            <button class="btn btn-small" data-act="gone" title="Someone else drafted them">${status === 'gone' ? 'Undo' : 'Gone'}</button>
          </div>
        </td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6" class="loading">No players match.</td></tr>';
  renderRoster();
}

$('#draft-body').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('tr').dataset.id;
  const act = btn.dataset.act;
  state.draft.picks[id] = state.draft.picks[id] === act ? undefined : act;
  if (!state.draft.picks[id]) delete state.draft.picks[id];
  saveDraftState();
  renderDraft();
});

$('#draft-search').addEventListener('input', (e) => {
  state.draft.query = e.target.value;
  renderDraft();
});

$('#hide-drafted').addEventListener('change', (e) => {
  state.draft.hideDrafted = e.target.checked;
  renderDraft();
});

$('#reset-draft').addEventListener('click', () => {
  if (!confirm('Clear all draft picks and start over?')) return;
  state.draft.picks = {};
  saveDraftState();
  renderDraft();
});

function renderRoster() {
  const mine = state.rankings.players.filter((p) => state.draft.picks[p.id] === 'mine');
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  mine.forEach((p) => { counts[p.pos] = (counts[p.pos] || 0) + 1; });

  // FLEX absorbs RB/WR/TE surplus beyond starter needs.
  const surplus = Math.max(0, counts.RB - 2) + Math.max(0, counts.WR - 2) + Math.max(0, counts.TE - 1);
  $('#roster-needs').innerHTML = ROSTER_SLOTS.map(({ pos, need }) => {
    const have = pos === 'FLEX' ? Math.min(surplus, need) : Math.min(counts[pos] || 0, need);
    const cls = have >= need ? 'filled' : 'short';
    return `<span class="need-pill ${cls}">${pos} ${have}/${need}</span>`;
  }).join('');

  $('#my-roster').innerHTML = mine.length
    ? mine.map((p) => `<li>${posBadge(p.pos)} ${esc(p.name)} <span class="trend-team">${esc(p.team)}</span></li>`).join('')
    : '<li class="empty">Mark players as "Mine" during your draft.</li>';
}

// ---------------------------------------------------------------------------
// Snake pick calculator
// ---------------------------------------------------------------------------

function renderPicks() {
  const teams = Math.max(2, Number($('#calc-teams').value) || 12);
  const slot = Math.min(teams, Math.max(1, Number($('#calc-slot').value) || 1));
  const rounds = Math.max(1, Math.min(30, Number($('#calc-rounds').value) || 15));
  const picks = [];
  for (let r = 1; r <= rounds; r++) {
    const posInRound = r % 2 === 1 ? slot : teams - slot + 1;
    picks.push({ round: r, overall: (r - 1) * teams + posInRound });
  }
  $('#pick-list').innerHTML = picks.map((p) =>
    `<span class="pick-pill">R${p.round} <small>· #${p.overall}</small></span>`).join('');
}

['#calc-teams', '#calc-slot', '#calc-rounds'].forEach((sel) =>
  $(sel).addEventListener('input', renderPicks));

// ---------------------------------------------------------------------------
// Waiver wire
// ---------------------------------------------------------------------------

async function loadTrending() {
  try {
    const data = await getJson('/api/trending');
    state.trending.adds = data.adds;
    state.trending.drops = data.drops;
    state.trending.hotIds = new Set(data.adds.slice(0, 25).map((p) => p.id));
    renderTrending();
    renderRankings(); // refresh 🔥 markers
    setNotice('#waiver-notice', '');
  } catch (err) {
    setNotice('#waiver-notice', `Couldn't load trending players: ${err.message}`);
  }
}

function trendRow(p, kind) {
  return `<li class="${kind}">
    <span class="trend-name">${esc(p.name)}</span>
    ${posBadge(p.pos)}
    <span class="trend-team">${esc(p.team)}</span>
    ${injuryBadge(p.injury)}
    <span class="trend-count">${kind === 'drop' ? '−' : '+'}${p.count.toLocaleString()}</span>
  </li>`;
}

function renderTrending() {
  $('#trend-adds').innerHTML = state.trending.adds.slice(0, 25).map((p) => trendRow(p, 'add')).join('')
    || '<li class="loading">No trending data.</li>';
  $('#trend-drops').innerHTML = state.trending.drops.slice(0, 25).map((p) => trendRow(p, 'drop')).join('')
    || '<li class="loading">No trending data.</li>';
}

// ---------------------------------------------------------------------------
// Season line + refresh
// ---------------------------------------------------------------------------

async function loadSeason() {
  try {
    const s = await getJson('/api/state');
    const label = s.season_type === 'off' ? 'Offseason'
      : s.season_type === 'pre' ? `Preseason · Week ${s.week}`
      : `Week ${s.week}`;
    $('#season-line').textContent = `${s.season} NFL season · ${label}`;
  } catch { /* keep default tagline */ }
}

function refreshAll() {
  loadNews();
  loadRankings();
  loadTrending();
  loadSeason();
}

$('#refresh-btn').addEventListener('click', refreshAll);
setInterval(loadNews, 5 * 60 * 1000);      // live news every 5 min
setInterval(loadTrending, 10 * 60 * 1000); // waiver trends every 10 min

renderPicks();
refreshAll();
