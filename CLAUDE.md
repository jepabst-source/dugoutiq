# DugoutIQ

React + Vite + Tailwind v4 app for managing a softball team (lineups, batting stats, defense rotations, game day scoring). Firebase backend. Deployed via push to `main`.

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — eslint

## Layout
- `src/components/history/HistoryTab.jsx` — season stats + game log
- `src/components/gameday/GameDayTab.jsx` — live game day scoring
- `src/components/batting/` — batting tab (per-AB stats, can filter by N at-bats)
- `src/components/defense/` — defense rotation / star ratings
- `src/pages/ScorerPage.jsx` — standalone scorer view

## Conventions
- New game IDs default to `G-YYYY-MM-DD` (see GameDayTab.jsx:18, ScorerPage.jsx:36)
- Season Batting Stats sorted by OBP descending; nulls last
- Defensive star rating (`p.defRating`) lives on player; shown in Defense tab, **not** in Season Batting Stats
- "Season OBP" label distinguishes from Batting tab's filtered/recent OBP
