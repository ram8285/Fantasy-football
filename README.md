# 🏈 Fantasy Football HQ

A personal fantasy football command center for people who quit social media but
still want to win their league. One page, four tabs, zero accounts:

- **📰 News** — live NFL headlines aggregated from ESPN, Yahoo Sports, CBS
  Sports, ProFootballTalk, and RotoWire. Auto-refreshes every 5 minutes,
  filterable by source or keyword, with fresh stories highlighted.
- **📊 Rankings** — overall and per-position player rankings (via the free
  Sleeper API), with age, experience, and injury status at a glance. Players
  currently trending on waivers get a 🔥 marker.
- **🧢 Draft Kit** — an interactive cheat sheet: mark players *Gone* or *Mine*
  as your draft unfolds (persists across page reloads), track your roster needs
  (QB/RB/WR/TE/FLEX/K/DEF), and compute your snake-draft pick numbers.
- **📈 Waiver Wire** — the most added and most dropped players across all
  Sleeper leagues in the last 24 hours. This is the "everyone on Twitter is
  picking this guy up" signal, without Twitter — plus a FAAB bidding guide.

## Running it

Requires [Node.js 18+](https://nodejs.org) (no npm packages to install).

```bash
node server.js
```

Then open <http://localhost:3000>. Set a different port with `PORT=8080 node server.js`.

## How it works

- `server.js` — a zero-dependency Node server. It serves the frontend and
  exposes a small JSON API that fetches and caches upstream data
  (news: 5 min, rankings: 1 h, trending: 10 min). If an upstream source is
  temporarily down, it serves the last good copy.
- `public/` — vanilla HTML/CSS/JS frontend, no build step.
- Data sources: the [Sleeper API](https://docs.sleeper.com) (free, no API key)
  for players/rankings/trending, and public RSS feeds for news. You can add or
  remove feeds by editing `NEWS_FEEDS` at the top of `server.js`.

Draft-board state lives in your browser's `localStorage` — use the
**Reset draft** button to clear it.

## Notes

- Rankings use Sleeper's overall fantasy-relevance ordering. It's a solid
  default board, but for scoring-format-specific ranks (PPR vs standard),
  cross-check tiers before your draft.
- Everything is read-only and anonymous: no logins, no tracking, no posting.

## Tests

```bash
npm test
```

Runs an offline smoke test of the RSS parser, player condensing, and the HTTP
server's static + API routes.
