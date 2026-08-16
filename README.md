# 🏈 Fantasy Football Hub

A self-hosted fantasy football command center — stay on top of breaking news, rankings, your draft, and the waiver wire **without needing Twitter or any social apps**.

## Features

- **📰 Live News** — aggregates NFL headlines from ESPN, Yahoo Sports, CBS Sports, RotoBaller, and ProFootballTalk RSS feeds. Auto-refreshes every 5 minutes, de-dupes headlines across sources, and flags **⚡ actionable** items (injuries, trades, signings, depth-chart changes) so you can filter straight to news you can act on. Search by player, team, or keyword.
- **📊 Player Rankings** — live rankings for every fantasy-relevant player from the Sleeper API, filterable by position, grouped into **tiers** based on rank gaps, with positional ranks (RB12, WR3, …) and injury status.
- **📋 Draft Board** — an interactive draft assistant: mark players as *My pick* or *Taken*, and it tracks best-available, your roster slots (QB/RB/RB/WR/WR/TE/FLEX/K/DEF + bench), suggests your next pick based on positional need, keeps a draft log, and supports undo/reset. State persists in your browser, so a page refresh mid-draft won't lose anything.
- **🔥 Waiver Wire** — the most added and dropped players across all Sleeper leagues in the last 24 hours (a great substitute for "fantasy Twitter buzz"), with suggested FAAB bid percentages for hot pickups.

## Getting started

Requires Node.js 18+.

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

## Data sources

All sources are free and require **no API keys**:

| Data | Source | Refresh |
|---|---|---|
| News | ESPN / Yahoo / CBS / RotoBaller / PFT RSS | every 5 min |
| Players & rankings | Sleeper API (`/players/nfl`) | every 12 h |
| Waiver trends | Sleeper API (`/players/nfl/trending`) | every 15 min |

If a source is unreachable (offline, blocked network), the app falls back to bundled sample data and shows a banner, so every screen still works.

## Tests

```bash
npm test
```

## Project layout

```
server.js          Express server + JSON API
lib/news.js        RSS aggregation, de-dupe, actionable-news detection
lib/sleeper.js     Sleeper players/rankings/trending + tiers + FAAB heuristic
lib/cache.js       In-memory TTL cache with stale fallback
public/            Single-page frontend (no build step)
data/              Bundled sample data used when offline
test/              Node test suite
```
