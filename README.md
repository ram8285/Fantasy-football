# 🏈 Gridiron HQ

A personal fantasy football command center — built for staying on top of the news
without needing Twitter or social media apps.

**Live NFL news · Player rankings · Draft assistant · Waiver wire radar · Your league's scoring**

## What's inside

| Tab | What it does |
| --- | --- |
| 📰 **News** | Live NFL headlines from ESPN's public wire, refreshed automatically every 10 minutes. Injury-related stories get flagged with a badge. |
| 📊 **Rankings** | Live consensus player rankings (Sleeper data) with position filters, positional ranks (e.g. RB12), injury tags, and trending add/drop badges. |
| 🎯 **Draft** | A draft-day assistant: tap **MINE** when you pick, **GONE** when someone else does. Tracks your roster by lineup slot, shows best-available, and warns you when a position's top tier is running dry. Picks are saved on your device, so a page reload won't lose your draft. |
| 🔄 **Waivers** | Who the fantasy world is adding and dropping *right now* — trending player counts over the last 24 hours across all Sleeper leagues. This surfaces breaking news (injuries, depth chart changes, breakouts) even if you never see a tweet. |
| ⚙️ **My League** | Your ESPN league's scoring settings plus strategy notes tailored to them (half-PPR, long-FG kicker bonuses, big-swing D/ST scoring, etc.). |

## Data sources (free, no accounts, no API keys)

- [Sleeper API](https://docs.sleeper.com/) — full NFL player database, rankings, and 24-hour trending adds/drops
- ESPN public news API — live NFL headlines

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

- **Scoring settings** live at the top of `app.js` (`LEAGUE_SCORING`). Passing and
  rushing rows are ESPN defaults since they weren't in the screenshots — edit them
  there if your league differs.
- **Roster slots** for the draft tracker are in `ROSTER_SLOTS` in `app.js`
  (default: QB / 2 RB / 2 WR / TE / FLEX / D/ST / K / 7 bench).

## Notes

- Draft picks and the player cache are stored in your browser's localStorage —
  clearing site data resets them. Use the **Reset draft** button after your draft.
- Player data caches for 12 hours to keep the app fast; hit **⟳ Refresh** any time
  to force-update everything.
