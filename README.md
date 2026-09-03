# 🏈 Gridiron HQ

A personal fantasy football command center — built for staying on top of the news
without needing Twitter or social media apps.

**Live NFL news · Player rankings · Draft assistant · Waiver wire radar · Your league's scoring**

## What's inside

| Tab | What it does |
| --- | --- |
| 📰 **News** | One merged, time-sorted, deduped feed from six sources: ESPN's wire, **Bluesky** (where NFL insiders landed after Twitter — real-time posts with author handles and like counts, spam-filtered), **ProFootballTalk** and **FantasyPros** (via RSS relay), plus **r/fantasyfootball** and **r/nfl** hot posts. Source badges, injury flagging, ⭐ your-player highlighting, auto-refresh every 10 minutes, 🔔 bell for alerts. |
| 🦬 **Bills** | A dedicated Buffalo Bills HQ — all Bills news, not just fantasy: ESPN's team-filtered wire, **r/buffalobills**, Bluesky, and Bills stories filtered out of the league-wide feeds, deduped into one stream. Plus a **🔴 live in-game feed**: while the Bills play, the tab auto-refreshes every 45 seconds with the live score and clock, every scoring play (ESPN), real-time Bluesky chatter (Bills / Josh Allen / #BillsMafia searches), the **r/buffalobills game thread** comment stream, and posts from your ✔ **followed insiders** — a user-curated list of Bluesky handles (beat writers, industry pros) whose posts always surface, no engagement filter. Also: the official injury report with practice notes, record/standings, schedule with results, and this week's betting line + weather. (`MY_NFL_TEAM` in `app.js` retargets the whole tab to another franchise.) |
| 🧠 **Start/Sit** | The lineup optimizer. Add your roster once (or import your draft picks) and it builds your optimal lineup every week: real weekly projections scored with **your league's exact rules**, adjusted for matchup strength — **position-specific defense-vs-position ranks** computed from real box scores in-season (overall points-allowed early on) — plus **Vegas implied team totals** and **live stadium weather** (18+ mph wind downgrades QBs and kickers; domes ignored). Knows your OP slot can hold a second QB, benches players on bye or ruled Out, and flags close calls. |
| 💎 **Sleepers** | Three data-driven lists: **waiver heaters** (players ranked outside the top 100 that thousands of managers are adding right now), **rank risers** (players climbing the consensus rankings between your visits), and in-season **📊 usage spikes** — targets + carries week-over-week from real box scores, because volume arrives a week before points do. |
| 📊 **Rankings** | Live rankings **re-ranked for this league's 2-QB, 6-pt-pass-TD reality**: QBs are pulled up to superflex-calibrated slots (QB1 ≈ #1 overall, ~20 QBs with starter value), while a "▲ market #N" badge shows where standard 1-QB apps rank each player — that gap is your draft-day value edge. Position filters, positional ranks, injury tags, and trending badges included. |
| 🎯 **Draft** | A live draft-day war room. **🛰 ESPN Live Draft Sync** follows your real draft hands-free: every 20 seconds it reads the public league's filling rosters and auto-marks picks GONE (yours MINE), keeping the board, rankings, and Pick Advisor current — starting a follow also busts the rankings/ADP caches for draft-day freshness. Plus a **🎭 mock draft simulator**: AI teams draft near real 2-QB ADP (with noise and roster logic) in your slot's snake order while your picks run through the advisor — rehearse the whole draft, see who was also available at each turn, and never touch your real board. Tap **MINE** / **GONE** as picks happen and the **🧭 Pick Advisor** recommends your next pick in real time: board value × your roster needs × "will they make it back to your next turn" (real 2-QB ADP + snake-draft math from your slot) × tier scarcity — each recommendation with plain-English reasons, plus "safe to wait" notes. Roster tracking by lineup slot, best-available, tier warnings (QB tier = 20 for this 2-QB format), ADP on every row. Picks saved on your device. |
| 🔄 **Waivers** | Who the fantasy world is adding and dropping *right now* — trending player counts over the last 24 hours across all Sleeper leagues. This surfaces breaking news (injuries, depth chart changes, breakouts) even if you never see a tweet. |
| 🔁 **Trade** | A need-aware trade analyzer: build both sides of a deal (pick the partner team to pull their real synced roster), and get a verdict from your optimal lineup's projected total before vs after, long-term board value in your league's 2-QB economy, and the partner's own lineup impact ("they may reject it"). Warns when a trade leaves you under two QBs or brings back an injured player. |
| 🎲 **Betting** | Every market, as **starting points** generated from live data (ideas, not advice): a ranked **Best Bets board**; spread/ATS leans (live home dogs, shootout dogs, bad-weather backdoors); moneyline leans (short home favorites, low-total upset value); game total and team total leans (wind/rain unders, leaky-defense overs); **6-point teaser spots** (classic Wong: through the key numbers 3 and 7); player prop ideas backed by projected stat lines; and parlay builders — same-game stacks, chalk ML parlays, two-leg teasers, and a ticket from your own roster. Full game board with spreads, O/U, moneylines, implied totals, and weather — plus a **🧾 bet ledger** that grades your actual bets (W/L/push) into a running record, net profit, and ROI. |
| ⚙️ **My League** | Your ESPN league's full scoring settings — **every value is editable** in case the league changes rules before the season. Edit a value and the entire app re-analyzes instantly: projections re-score, the lineup optimizer re-runs, the QB draft-board boost recalibrates (drop passing TDs to 4 and it softens automatically), and the strategy notes rewrite themselves. Edits persist on your device; one tap resets to league defaults. |

## Syncing your ESPN league

The league is public, so the app can read it without a login. In **Start/Sit → Manage
My Roster → 📥 Sync from ESPN**:

1. Tap **⚡ Auto-fetch my league** (league ID pre-filled), then tap your team once
2. From then on, every refresh re-syncs automatically:
   - **Your roster** stays current (add/drop on ESPN → reflected here)
   - **Waivers & Sleepers** flag every trending player as **FREE AGENT in your league**
     or *rostered in your league* — no more getting excited about someone your
     leaguemate already owns
   - **Start/Sit** shows a weekly head-to-head banner: your optimal lineup's projected
     total vs your actual opponent's
   - **My League** gains 🏆 **Power Rankings** — every team's optimal-lineup strength in
     your scoring, with records — and the **Trade tab** knows every roster
   - The 📊 **Optimizer scoreboard** (Start/Sit) grades each week from real box scores:
     what the optimizer projected, what its lineup actually scored, what your real ESPN
     lineup scored, and how many points you left on the bench
3. **⭐ My-player alerts**: news mentioning your rostered players is badged gold in every
   feed, and injury headlines about them fire priority notifications with their own alert
   budget

If ESPN ever blocks direct browser connections (they don't document their CORS policy),
the copy/paste fallback in the same panel always works: open the pre-built link, copy
the page, paste, tap your team.

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
| Reddit JSON (r/fantasyfootball, r/nfl, r/buffalobills, r/sportsbook) | Breaking-news + betting-buzz feeds — the fastest free fantasy news signal now that Twitter/X's API is paywalled |
| [Bluesky public API](https://public.api.bsky.app) | Real-time insider posts — the actual Twitter replacement, key-free and browser-callable |
| ProFootballTalk + FantasyPros RSS (via [allorigins](https://allorigins.win) relay) | Professional NFL reporting and fantasy-focused player news; relay used because browsers can't read RSS cross-origin |
| [FantasyFootballCalculator ADP](https://fantasyfootballcalculator.com/adp) | Real **2-QB format** ADP for the draft Pick Advisor |
| [Open-Meteo](https://open-meteo.com/) | Game-day stadium weather (wind/rain/temp) for outdoor venues |

### Optional: The Odds API (real betting lines)

The app ships **pre-configured with the owner's free-tier key** (an explicit choice:
anyone reading this public code can see it, and the worst case is burned free quota —
no payment methods are attached; regenerate the key on the provider dashboard and update
`app.js` to rotate it). Paste your own key in **Betting → 🔑 Odds providers** to override
on your device. It unlocks:

- **Line shopping** — best available spread/total/moneyline price across US sportsbooks,
  with the book named on every price
- **Real player prop lines** — loaded per game on demand (the button shows the credit cost)
- **💎 Prop edges** — every loaded line compared against this app's league-scored
  projections; 5+ yard gaps and anytime-TD value get flagged ("line 265.5, we project 289 →
  OVER edge +23.5")
- Gaps in ESPN's lines are auto-filled from sportsbook consensus

Quota discipline is built in for the free 500-credit/month tier: game lines cache for 12
hours and props only load when you ask. Your remaining credits are always shown in the
settings panel.

### Optional: SportsGameOdds (week-wide prop coverage)

A second provider, [sportsgameodds.com](https://sportsgameodds.com), bills **per event**
(all markets included), so its free 2,500 objects/month tier is enough to pull prop lines
for the **entire weekly NFL slate automatically** — no per-game buttons. Its odds are
10-minute delayed on the free tier, so the two providers complement each other: SGO
saturates the Prop Edges section all week; The Odds API refreshes a specific game with
sharp real-time multi-book prices when you're about to bet. When both provide the same
prop, the app keeps the best price. This provider is also pre-configured with the
owner's free key (same tradeoff as above); an on-device override field is provided.

### Odds orchestration (built-in quota efficiency)

The app treats its three odds sources as a coordinated system rather than separate feeds:

- **Roles**: ESPN = free always-on baseline (refreshes every 10 min) · SGO = bulk
  week-wide props · The Odds API = sharp real-time prices on demand
- **Adaptive cadence**: paid-tier pulls refresh every **6h on NFL game days**
  (Thu/Sun/Mon) and every **12h midweek**, when lines barely move
- **Usage metering**: The Odds API credits are tracked from its response headers
  (authoritative) and SGO objects are estimated per pull; the settings panel shows a
  **monthly pace projection** ("on pace ~140/500") and warns before you'd blow a quota
- **Freshness**: every provider shows "lines as of Xm ago", plus a force-refresh button
  when you want to burn a few credits for up-to-the-minute prices
- **Merging**: ESPN → The Odds API → SGO fill each other's gaps; identical props keep
  the best price with the source labeled

Why not ten more providers? Most remaining "free" odds sources are unofficial
sportsbook endpoints that browsers can't call (CORS-blocked, need a server), or
~100-request/month tiers that duplicate prices we already have. Extra sources add
prices, not information — the three-role system above already covers every market.
The provider framework makes adding another (e.g. SharpAPI, OddsPapi) a small job if
one proves worth it.

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
