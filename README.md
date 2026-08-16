# 🏈 Gridiron HQ

A personal fantasy football command center — built for staying on top of the news
without needing Twitter or social media apps.

**Live NFL news · Player rankings · Draft assistant · Waiver wire radar · Your league's scoring**

## What's inside

| Tab | What it does |
| --- | --- |
| 📰 **News** | One merged, time-sorted feed: ESPN's wire **plus r/fantasyfootball and r/nfl hot posts** — where breaking fantasy news usually lands minutes after it happens (the closest free thing to old fantasy Twitter). Source badges, upvote counts, injury flagging, auto-refresh every 10 minutes, 🔔 bell for alerts. |
| 🧠 **Start/Sit** | The lineup optimizer. Add your roster once (or import your draft picks) and it builds your optimal lineup every week: real weekly projections scored with **your league's exact rules**, adjusted for matchup strength — **position-specific defense-vs-position ranks** computed from real box scores in-season (overall points-allowed early on) — plus **Vegas implied team totals** and **live stadium weather** (18+ mph wind downgrades QBs and kickers; domes ignored). Knows your OP slot can hold a second QB, benches players on bye or ruled Out, and flags close calls. |
| 💎 **Sleepers** | Two data-driven lists: **waiver heaters** (players ranked outside the top 100 that thousands of managers are adding right now) and **rank risers** (players climbing the consensus rankings between your visits). |
| 📊 **Rankings** | Live rankings **re-ranked for this league's 2-QB, 6-pt-pass-TD reality**: QBs are pulled up to superflex-calibrated slots (QB1 ≈ #1 overall, ~20 QBs with starter value), while a "▲ market #N" badge shows where standard 1-QB apps rank each player — that gap is your draft-day value edge. Position filters, positional ranks, injury tags, and trending badges included. |
| 🎯 **Draft** | A live draft-day war room. Tap **MINE** / **GONE** as picks happen and the **🧭 Pick Advisor** recommends your next pick in real time: board value × your roster needs × "will they make it back to your next turn" (real 2-QB ADP + snake-draft math from your slot) × tier scarcity — each recommendation with plain-English reasons, plus "safe to wait" notes. Roster tracking by lineup slot, best-available, tier warnings (QB tier = 20 for this 2-QB format), ADP on every row. Picks saved on your device. |
| 🔄 **Waivers** | Who the fantasy world is adding and dropping *right now* — trending player counts over the last 24 hours across all Sleeper leagues. This surfaces breaking news (injuries, depth chart changes, breakouts) even if you never see a tweet. |
| ⚙️ **My League** | Your ESPN league's full scoring settings — **every value is editable** in case the league changes rules before the season. Edit a value and the entire app re-analyzes instantly: projections re-score, the lineup optimizer re-runs, the QB draft-board boost recalibrates (drop passing TDs to 4 and it softens automatically), and the strategy notes rewrite themselves. Edits persist on your device; one tap resets to league defaults. |

## Notifications

Tap the 🔔 bell in the top bar to enable alerts. While the app is open it checks every
10 minutes and notifies you about **new injury headlines** and **new hot waiver adds**.

- **Desktop / Android**: works in any modern browser.
- **iPhone**: install the app first (Share → **Add to Home Screen**) and open it from
  the home screen icon — iOS only allows notifications for installed web apps, and
  background push (alerts while the app is closed) would require a server, which this
  app deliberately doesn't have. Opening the app once a day and skimming News +
  Sleepers covers the same ground.

## Data sources (free, no accounts, no API keys)

| Source | What it feeds |
| --- | --- |
| [Sleeper API](https://docs.sleeper.com/) | Full NFL player database, consensus ranks, weekly projections, weekly box-score stats (for defense-vs-position), 24-hour trending adds/drops |
| ESPN public APIs | Live NFL headlines, weekly schedule + byes, Vegas odds (implied team totals), team defensive stats, league-wide injury report |
| Reddit JSON (r/fantasyfootball, r/nfl) | Breaking-news feed — the fastest free fantasy news signal now that Twitter/X's API is paywalled |
| [FantasyFootballCalculator ADP](https://fantasyfootballcalculator.com/adp) | Real **2-QB format** ADP for the draft Pick Advisor |
| [Open-Meteo](https://open-meteo.com/) | Game-day stadium weather (wind/rain/temp) for outdoor venues |

Every feed fails gracefully — if one is down, its section just goes quiet instead of breaking the app.
A note on Twitter/X: its API now costs $100+/month and blocks unauthenticated reads, so it can't be
pulled into a free client-side app. The Reddit feeds cover the same breaking-news ground — beat
reporters' tweets get reposted there within minutes.

Everything runs in your browser. There's no server, no build step, and nothing to sign up for.

## How to use it

### Easiest: GitHub Pages (free hosting, works on your phone)

1. In this repo on GitHub, go to **Settings → Pages**
2. Under **Branch**, pick your main branch, folder `/ (root)`, and hit **Save**
3. In a minute your app will be live at `https://<your-username>.github.io/Fantasy-football/`
4. Open that URL on your phone and **Add to Home Screen** — now it's an app icon

### Or run it locally

Just open `index.html` in any browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Customizing

- **Scoring settings** are editable right in the app (My League tab) — no code
  needed. Defaults live in `SCORING_CONFIG` in `app.js` and match the "Wings,
  Rings, and Eye Patches" league; the projection math in `leaguePoints()` reads
  the live values.
- **Roster slots** are in `ROSTER_SLOTS` in `app.js`
  (QB / 2 RB / 2 WR / TE / OP / D/ST / K / 7 bench / IR).

## Notes

- Draft picks and the player cache are stored in your browser's localStorage —
  clearing site data resets them. Use the **Reset draft** button after your draft.
- Player data caches for 12 hours to keep the app fast; hit **⟳ Refresh** any time
  to force-update everything.
