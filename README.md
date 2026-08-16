# 🏈 Fantasy Football HQ

A personal fantasy football companion app — **live news, player rankings, draft
help, and waiver wire trends** — with no social media, no accounts, and no API
keys required.

Built for people who quit Twitter/X and social apps but still want to catch
breaking player news in time to act on it.

## Features

- **📰 Live News** — aggregates NFL headlines from ESPN, Yahoo Sports,
  CBS Sports, and RotoWire RSS feeds into one chronological feed.
  Auto-refreshes every 5 minutes. Filter by source or search for a player/team
  name.
- **📊 Player Rankings** — the full fantasy-relevant player pool (QB, RB, WR,
  TE, K, DEF) ranked using Sleeper's player database, with age, experience, and
  live injury status. Filter by position or search.
- **🧠 Draft Help** — a live draft assistant. Best-available board sorted by
  rank; mark players **Taken** (off the board) or **Mine** (added to your
  roster). Tracks your starting lineup slots (QB / 2 RB / 2 WR / TE / FLEX /
  K / DEF + bench) and highlights which positions you still need. Undo and
  reset supported; your draft persists across page reloads.
- **📈 Waiver Wire** — the most **added** and most **dropped** players across
  all Sleeper leagues in the last 24 hours. This is the fastest no-social-media
  signal that something happened: when a backup RB gets 50,000 adds overnight,
  you know the starter got hurt — often before the story tops the news sites.

## Quick start

Requires [Node.js](https://nodejs.org) 18 or newer. No dependencies to install.

```bash
node server.js
```

Then open <http://localhost:3000>.

## Data sources (all free, no keys)

| Data | Source | Refresh |
|---|---|---|
| News | ESPN / Yahoo / CBS / RotoWire RSS | every 5 min |
| Player database & rankings | [Sleeper API](https://docs.sleeper.com) | every 12 h |
| Waiver trends (adds/drops) | Sleeper trending API | every 10 min |

Responses are cached in `data/cache/` so restarts are instant and brief
outages fall back to the last good data. With no internet at all, the app
serves bundled sample data (`data/sample-*.json`) and shows an offline banner
so you always see a working UI.

## Customizing

- **News feeds:** edit the `NEWS_FEEDS` list at the top of `server.js` — any
  RSS feed works (add your favorite beat writer's feed, remove a source, etc.).
- **Roster slots:** edit `ROSTER_SLOTS` in `public/app.js` to match your
  league's lineup (e.g. add a second FLEX or superflex).
- **Port:** `PORT=8080 node server.js`.

## Project layout

```
server.js            # zero-dependency Node server + data fetching/caching
public/index.html    # single-page UI (News / Rankings / Draft / Waivers)
public/app.js        # frontend logic (vanilla JS, no build step)
public/style.css     # styling
data/sample-*.json   # offline fallback data
data/cache/          # runtime cache (gitignored)
```
