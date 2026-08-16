# 🏈 Gridiron HQ

A personal fantasy football command center — built for staying on top of the news
without needing Twitter or social media apps.

**Live NFL news · Player rankings · Draft assistant · Waiver wire radar · Your league's scoring**

## What's inside

| Tab | What it does |
| --- | --- |
| 📰 **News** | Live NFL headlines from ESPN's public wire, refreshed automatically every 10 minutes. Injury-related stories get flagged with a badge. Turn on the 🔔 bell for alerts. |
| 🧠 **Start/Sit** | The lineup optimizer. Add your roster once (or import your draft picks) and it builds your optimal lineup every week: real weekly projections scored with **your league's exact rules** (6-pt passing TDs, half-PPR, kicker distance bonuses, D/ST brackets), adjusted for matchup strength from live NFL defensive stats. Knows your OP slot can hold a second QB, benches players on bye or ruled Out, and flags close calls worth watching. |
| 💎 **Sleepers** | Two data-driven lists: **waiver heaters** (players ranked outside the top 100 that thousands of managers are adding right now) and **rank risers** (players climbing the consensus rankings between your visits). |
| 📊 **Rankings** | Live rankings **re-ranked for this league's 2-QB, 6-pt-pass-TD reality**: QBs are pulled up to superflex-calibrated slots (QB1 ≈ #1 overall, ~20 QBs with starter value), while a "▲ market #N" badge shows where standard 1-QB apps rank each player — that gap is your draft-day value edge. Position filters, positional ranks, injury tags, and trending badges included. |
| 🎯 **Draft** | A draft-day assistant using the same league-adjusted board: tap **MINE** when you pick, **GONE** when someone else does. Tracks your roster by lineup slot (including the OP slot), shows best-available, and warns when a position's top tier is running dry — with the QB tier sized at 20 for this 2-QB format. Picks are saved on your device. |
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

- [Sleeper API](https://docs.sleeper.com/) — full NFL player database, rankings, weekly projections, and 24-hour trending adds/drops
- ESPN public APIs — live NFL headlines, weekly schedule (opponents/byes), and team defensive stats for matchup strength

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
