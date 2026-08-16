/* Fantasy Football HQ — frontend. Vanilla JS, no build step. */
'use strict';

const $ = (sel) => document.querySelector(sel);
const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

const state = {
  news: [],
  newsSource: 'ALL',
  players: [],
  rankPos: 'ALL',
  draftPos: 'ALL',
  // draft: { taken: {id: true}, mine: [id, ...] } persisted in localStorage
  draft: loadDraft(),
  waiverPos: 'ALL',
  adds: [],
  drops: [],
  dataSource: null,
};

// ---------------------------------------------------------------- helpers

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function posBadge(pos) {
  return `<span class="pos pos-${esc(pos)}">${esc(pos)}</span>`;
}

function statusCell(injury) {
  return injury
    ? `<span class="injury">${esc(injury)}</span>`
    : '<span class="ok">Healthy</span>';
}

async function api(path) {
  const res = await fetch(path);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  if (body.dataSource) noteDataSource(body.dataSource);
  return body;
}

function noteDataSource(src) {
  state.dataSource = src;
  const el = $('#dataStatus');
  const banner = $('#banner');
  if (src === 'live') {
    el.textContent = '● live data';
    el.style.color = 'var(--accent)';
    banner.classList.add('hidden');
  } else if (src === 'cache') {
    el.textContent = '● cached data';
    el.style.color = 'var(--warn)';
    banner.classList.add('hidden');
  } else {
    el.textContent = '● sample data';
    el.style.color = 'var(--warn)';
    banner.textContent =
      'Offline: showing bundled sample data. Start the app with internet access for live news, rankings, and waiver trends.';
    banner.classList.remove('hidden');
  }
}

function chipRow(el, options, active, onPick) {
  el.innerHTML = options
    .map((o) => `<button class="chip ${o === active ? 'active' : ''}" data-v="${esc(o)}">${esc(o)}</button>`)
    .join('');
  el.querySelectorAll('.chip').forEach((c) =>
    c.addEventListener('click', () => onPick(c.dataset.v))
  );
}

// ------------------------------------------------------------------ tabs

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    ['news', 'rankings', 'draft', 'waivers'].forEach((t) =>
      $(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab)
    );
  });
});

// ------------------------------------------------------------------ news

async function loadNews() {
  try {
    const body = await api('/api/news');
    state.news = body.items || [];
    renderNews();
  } catch (err) {
    $('#newsList').innerHTML = `<div class="empty">Could not load news: ${esc(err.message)}</div>`;
  }
}

function renderNews() {
  const q = $('#newsSearch').value.trim().toLowerCase();
  const sources = ['ALL', ...new Set(state.news.map((n) => n.source))];
  chipRow($('#newsSources'), sources, state.newsSource, (v) => {
    state.newsSource = v;
    renderNews();
  });

  const items = state.news.filter(
    (n) =>
      (state.newsSource === 'ALL' || n.source === state.newsSource) &&
      (!q || (n.title + ' ' + n.summary).toLowerCase().includes(q))
  );
  $('#newsList').innerHTML = items.length
    ? items
        .map(
          (n) => `
      <article class="news-item">
        <div class="news-meta">
          <span class="badge">${esc(n.source)}</span>
          <span>${timeAgo(n.publishedAt)}</span>
        </div>
        <div class="news-title">${n.link ? `<a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>` : esc(n.title)}</div>
        ${n.summary ? `<div class="news-summary">${esc(n.summary)}</div>` : ''}
      </article>`
        )
        .join('')
    : '<div class="empty">No headlines match.</div>';
}

$('#newsSearch').addEventListener('input', renderNews);
$('#newsRefresh').addEventListener('click', loadNews);
setInterval(loadNews, 5 * 60 * 1000); // auto-refresh every 5 minutes

// -------------------------------------------------------------- rankings

async function loadPlayers() {
  try {
    const body = await api('/api/players');
    state.players = body.players || [];
    renderRankings();
    renderDraft();
  } catch (err) {
    $('#rankTable tbody').innerHTML = `<tr><td colspan="7" class="empty">Could not load players: ${esc(err.message)}</td></tr>`;
  }
}

function renderRankings() {
  chipRow($('#rankPos'), POSITIONS, state.rankPos, (v) => {
    state.rankPos = v;
    renderRankings();
  });
  const q = $('#rankSearch').value.trim().toLowerCase();
  const rows = state.players
    .filter(
      (p) =>
        (state.rankPos === 'ALL' || p.pos === state.rankPos) &&
        (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q)
    )
    .slice(0, 300);
  $('#rankTable tbody').innerHTML = rows.length
    ? rows
        .map(
          (p, i) => `
      <tr>
        <td>${state.rankPos === 'ALL' ? p.rank : i + 1}</td>
        <td><b>${esc(p.name)}</b></td>
        <td>${posBadge(p.pos)}</td>
        <td>${esc(p.team)}</td>
        <td>${p.age ?? '—'}</td>
        <td>${p.exp != null ? (p.exp === 0 ? 'R' : p.exp) : '—'}</td>
        <td>${statusCell(p.injury)}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="empty">No players match.</td></tr>';
}

$('#rankSearch').addEventListener('input', renderRankings);

// ----------------------------------------------------------------- draft

const ROSTER_SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
const FLEX_POS = new Set(['RB', 'WR', 'TE']);

function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem('ffhq-draft'));
    if (d && d.taken && Array.isArray(d.mine) && Array.isArray(d.history)) return d;
  } catch { /* fall through */ }
  return { taken: {}, mine: [], history: [] };
}

function saveDraft() {
  localStorage.setItem('ffhq-draft', JSON.stringify(state.draft));
}

function assignSlots(minePlayers) {
  // Greedy: dedicated slots first, then FLEX, then bench.
  const slots = ROSTER_SLOTS.map((s) => ({ slot: s, player: null }));
  const bench = [];
  for (const p of minePlayers) {
    let placed = slots.find((s) => s.slot === p.pos && !s.player);
    if (!placed && FLEX_POS.has(p.pos)) placed = slots.find((s) => s.slot === 'FLEX' && !s.player);
    if (placed) placed.player = p;
    else bench.push(p);
  }
  return { slots, bench };
}

function renderDraft() {
  chipRow($('#draftPos'), POSITIONS, state.draftPos, (v) => {
    state.draftPos = v;
    renderDraft();
  });

  const q = $('#draftSearch').value.trim().toLowerCase();
  const gone = new Set([...Object.keys(state.draft.taken), ...state.draft.mine]);
  const avail = state.players
    .filter(
      (p) =>
        !gone.has(p.id) &&
        (state.draftPos === 'ALL' || p.pos === state.draftPos) &&
        (!q || p.name.toLowerCase().includes(q) || p.team.toLowerCase() === q)
    )
    .slice(0, 200);

  $('#draftTable tbody').innerHTML = avail.length
    ? avail
        .map(
          (p) => `
      <tr>
        <td>${p.rank}</td>
        <td><b>${esc(p.name)}</b></td>
        <td>${posBadge(p.pos)}</td>
        <td>${esc(p.team)}</td>
        <td>${statusCell(p.injury)}</td>
        <td>
          <button class="btn small" data-mine="${esc(p.id)}">Mine</button>
          <button class="btn small danger" data-taken="${esc(p.id)}">Taken</button>
        </td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="6" class="empty">No available players match.</td></tr>';

  $('#draftTable').querySelectorAll('[data-mine]').forEach((b) =>
    b.addEventListener('click', () => {
      state.draft.mine.push(b.dataset.mine);
      state.draft.history.push({ type: 'mine', id: b.dataset.mine });
      saveDraft();
      renderDraft();
    })
  );
  $('#draftTable').querySelectorAll('[data-taken]').forEach((b) =>
    b.addEventListener('click', () => {
      state.draft.taken[b.dataset.taken] = true;
      state.draft.history.push({ type: 'taken', id: b.dataset.taken });
      saveDraft();
      renderDraft();
    })
  );

  renderRoster();
}

function renderRoster() {
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const mine = state.draft.mine.map((id) => byId.get(id)).filter(Boolean);
  const { slots, bench } = assignSlots(mine);

  $('#needs').innerHTML = slots
    .map(
      (s) => `<span class="need ${s.player ? 'filled' : 'open'}">${esc(s.slot)}</span>`
    )
    .join('');

  const rows = [
    ...slots.map(
      (s) => `
    <li><span class="roster-slot">${esc(s.slot)}</span>
      ${s.player ? `<b>${esc(s.player.name)}</b> <span class="team">${esc(s.player.team)}</span>` : '<span class="ok">—</span>'}
    </li>`
    ),
    ...bench.map(
      (p) => `
    <li><span class="roster-slot">BN</span> <b>${esc(p.name)}</b>
      <span class="team">${esc(p.team)}</span> ${posBadge(p.pos)}</li>`
    ),
  ];
  $('#rosterList').innerHTML = rows.join('');
}

$('#draftSearch').addEventListener('input', renderDraft);
$('#draftUndo').addEventListener('click', () => {
  const last = state.draft.history.pop();
  if (!last) return;
  if (last.type === 'mine') {
    const i = state.draft.mine.lastIndexOf(last.id);
    if (i >= 0) state.draft.mine.splice(i, 1);
  } else {
    delete state.draft.taken[last.id];
  }
  saveDraft();
  renderDraft();
});
$('#draftReset').addEventListener('click', () => {
  if (!confirm('Clear the whole draft board and your roster?')) return;
  state.draft = { taken: {}, mine: [], history: [] };
  saveDraft();
  renderDraft();
});

// --------------------------------------------------------------- waivers

async function loadWaivers() {
  try {
    const [adds, drops] = await Promise.all([
      api('/api/trending/add'),
      api('/api/trending/drop'),
    ]);
    state.adds = adds.players || [];
    state.drops = drops.players || [];
    renderWaivers();
  } catch (err) {
    $('#waiverAdds').innerHTML = `<div class="empty">Could not load trends: ${esc(err.message)}</div>`;
    $('#waiverDrops').innerHTML = '';
  }
}

function renderWaivers() {
  chipRow($('#waiverPos'), POSITIONS, state.waiverPos, (v) => {
    state.waiverPos = v;
    renderWaivers();
  });
  const render = (list, cls) => {
    const rows = list.filter(
      (p) => state.waiverPos === 'ALL' || p.pos === state.waiverPos
    );
    return rows.length
      ? rows
          .map(
            (p) => `
        <div class="waiver-item">
          ${posBadge(p.pos)}
          <b>${esc(p.name)}</b>
          <span class="team">${esc(p.team)}</span>
          ${p.injury ? `<span class="injury">${esc(p.injury)}</span>` : ''}
          <span class="count ${cls}">${cls === 'add' ? '+' : '−'}${p.count.toLocaleString()}</span>
        </div>`
          )
          .join('')
      : '<div class="empty">Nothing trending at this position.</div>';
  };
  $('#waiverAdds').innerHTML = render(state.adds, 'add');
  $('#waiverDrops').innerHTML = render(state.drops, 'drop');
}

$('#waiverRefresh').addEventListener('click', loadWaivers);
setInterval(loadWaivers, 10 * 60 * 1000);

// ------------------------------------------------------------------ init

loadNews();
loadPlayers();
loadWaivers();
