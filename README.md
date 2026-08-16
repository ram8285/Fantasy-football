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
| 📊 **Rankings** | Live consensus player rankings (Sleeper data) with position filters, positional ranks (e.g. RB12), injury tags, and trending add/drop badges. |
| 🎯 **Draft** | A draft-day assistant: tap **MINE** when you pick, **GONE** when someone else does. Tracks your roster by lineup slot (including the OP slot), shows best-available, and warns you when a position's top tier is running dry. Picks are saved on your device. |
| 🔄 **Waivers** | Who the fantasy world is adding and dropping *right now* — trending player counts over the last 24 hours across all Sleeper leagues. This surfaces breaking news (injuries, depth chart changes, breakouts) even if you never see a tweet. |
| ⚙️ **My League** | Your ESPN league's full scoring settings plus strategy notes tailored to them (6-pt pass TDs → draft QBs early, OP slot → start two QBs, long-FG kicker bonuses, big-swing D/ST scoring, etc.). |

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

- **Scoring settings** live at the top of `app.js` (`LEAGUE_SCORING`), and the
  projection math is in `leaguePoints()` — both match the "Wings, Rings, and Eye
  Patches" league settings.
- **Roster slots** are in `ROSTER_SLOTS` in `app.js`
  (QB / 2 RB / 2 WR / TE / OP / D/ST / K / 7 bench / IR).

## Notes

- Draft picks and the player cache are stored in your browser's localStorage —
  clearing site data resets them. Use the **Reset draft** button after your draft.
- Player data caches for 12 hours to keep the app fast; hit **⟳ Refresh** any time
  to force-update everything.
