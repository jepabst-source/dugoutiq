# Dugout IQ — Changelog

Every build is logged here with date, version, features added/changed, and files touched.
This file lives in the repo and deploys with the code. If we need to roll back, this tells us exactly what changed and when.

---

## v32 — March 20, 2026
**Fix: Blank page crash from static Capacitor import**
- `platform.js` had `import { Capacitor } from '@capacitor/core'` which doesn't exist on web
- Replaced with `window.Capacitor` detection — works with or without native shell
- Added all Capacitor packages to vite.config.js externals so builds don't fail on GitHub Actions

Files changed:
- `src/services/platform.js` — rewritten, no static imports
- `vite.config.js` — all @capacitor/* packages added to externals

---

## v31 — March 20, 2026
**Player card redesign + Demo Dolphins + Editable pocket cards + Bench-fair pocket cards**

Features:
- Player card matches Josh's mockup: line under name/jersey, position prefs + trash on same bottom row
- Demo Dolphins: new users get a pre-loaded sample team (12 players, at-bats, committed game)
- Blue banner on demo team with "Create My Team" button; demo auto-deletes when real team is created
- Pocket cards (LFG/OOR) now have dropdown swaps like regular innings
- Pocket card bench selection now considers who already benched in innings 1-3

Files changed:
- `src/components/roster/RosterTab.jsx` — PlayerCard layout
- `src/utils/demoTeam.js` — NEW, demo team seed data and creation
- `src/contexts/AuthContext.jsx` — demo team creation on new user signup
- `src/contexts/TeamContext.jsx` — auto-delete demo team when creating real team
- `src/pages/AppShell.jsx` — demo team banner
- `src/components/defense/DefenseTab.jsx` — pocket card swaps + onSwap handlers
- `src/utils/rotationEngine.js` — bench-aware buildLFGLineup and buildOORLineup

---

## v30 — March 20, 2026
**Bench-fair pocket cards (rotation engine only)**
- LFG and OOR pocket cards now receive innings data
- Bench selection avoids re-benching kids who already sat

Files changed:
- `src/utils/rotationEngine.js` — buildLFGLineup and buildOORLineup updated

---

## v29 — March 20, 2026
**Glove/arm defensive breakdown + Configurable practice sheet + Editable pocket cards**

Features:
- Optional glove + arm rating in player edit form; averages to defensive score
- Practice Sheet print button (desktop only) with checkbox config modal
- Checkboxes: def rating, glove/arm, OBP, coach notes, blank notes column
- Pocket cards made editable with dropdown swaps

Files changed:
- `src/components/roster/RosterTab.jsx` — PlayerForm glove/arm, printRoster, showPrintConfig modal
- `src/components/defense/DefenseTab.jsx` — PocketCard with PositionRow dropdowns

---

## v28 — March 20, 2026
**Multiple small updates deployed as v28 (repackaged several times)**

Features:
- OBP big and blue on batting order (matching parent portal style)
- About page logo 50% larger (120px → 180px)
- Login page logo 50% larger (w-32 → w-48)
- "Learn what Dugout IQ can do →" link on login page
- Removed founder line from about page
- Removed GameChanger/TeamSnap comparison tagline from about page
- OG preview card for portal/scorer/invite links (og-portal.jpg + 404.html meta tags)
- Practice sheet button hidden on touch devices
- Info tooltip (ⓘ) on "Invite Log Assistant" button
- Logo added to dugout card print header and practice sheet
- Suggestion Box replaced with mailto: support@lineupman.com

Files changed:
- `src/components/batting/BattingTab.jsx` — OBP styling
- `src/pages/LoginPage.jsx` — larger logo, learn more link
- `src/components/gameday/GameDayTab.jsx` — scorer info tooltip
- `src/components/print/PrintTab.jsx` — logo on print header
- `src/components/settings/SettingsTab.jsx` — mailto suggestion box, tighter position ratings
- `src/components/roster/RosterTab.jsx` — practice sheet touch detection
- `public/about.html` — hero, logo, comparison grid, removed founder line
- `public/404.html` — OG meta tags for link previews
- `public/og-portal.jpg` — NEW, preview image for shared links

---

## v27 — March 20, 2026
**Remove founder line from about page**

Files changed:
- `public/about.html`

---

## v26 — March 20, 2026
**Spray charts gated by coach tracking mode setting**
- History tab and parent portal only show spray charts when coach has set Advanced tracking mode
- Prevents partial/inconsistent data from showing to parents

Files changed:
- `src/components/history/HistoryTab.jsx` — showSpray flag from team settings
- `src/pages/PortalPage.jsx` — spray chart gated by team.settings.trackingMode

---

## v25 — March 19, 2026
**Repackage of v24 (extraction issue)**

---

## v24 — March 19, 2026
**Spray chart + OBP styling + Settings tweaks**

Features:
- Spray chart SVG field in advanced Game Day mode (tap hit type → tap field location)
- Hit location (hitX, hitY) stored in Firestore on at-bats
- Spray chart display in History (expandable per player) and parent portal
- Position Minimum Ratings spacing tightened
- Suggestion Box replaced with mailto

Files changed:
- `src/components/shared/SprayChart.jsx` — NEW, SVG field component
- `src/components/gameday/GameDayTab.jsx` — spray chart flow in advanced mode
- `src/contexts/TeamContext.jsx` — logAtBat accepts hitLocation
- `src/components/history/HistoryTab.jsx` — expandable spray charts
- `src/pages/PortalPage.jsx` — mini spray charts on player cards
- `src/components/settings/SettingsTab.jsx` — tighter spacing, mailto

---

## v23 — March 19, 2026
**Spray chart (initial)**

Files changed:
- `src/components/shared/SprayChart.jsx` — NEW
- `src/components/gameday/GameDayTab.jsx` — spray chart integration

---

## v22 — March 19, 2026
**All native services pre-built for Capacitor**

Features:
- RevenueCat payment service (native IAP on iOS/Android, Stripe on web)
- Biometric login service (Face ID / Touch ID)
- Deep link handler for scorer/portal/invite URLs in native app
- UpgradeModal updated: dual-path (RevenueCat on native, Stripe on web)
- usePlan checks RevenueCat entitlements on native
- AuthContext inits RevenueCat on login, enables biometric

Files changed:
- `src/services/payments.js` — NEW
- `src/services/biometric.js` — NEW
- `src/services/deeplinks.js` — NEW
- `src/components/shared/UpgradeModal.jsx` — dual payment path
- `src/hooks/usePlan.js` — RevenueCat entitlement check
- `src/contexts/AuthContext.jsx` — RevenueCat + biometric init
- `vite.config.js` — native externals

---

## v21 — March 19, 2026
**About page overhaul**
- Hero rewrite: "Fair lineups in seconds. No napkins required."
- Comparison grid: Dugout IQ vs Spreadsheets vs GameChanger vs TeamSnap
- Founder credibility line (later removed in v27)

Files changed:
- `public/about.html`

---

## v20 — March 19, 2026
**Privacy policy + App Store listing**
- Privacy policy page at lineupman.com/privacy.html
- App Store listing copy in app-store-listing.txt
- About page footer updated with privacy link and support@lineupman.com

Files changed:
- `public/privacy.html` — NEW
- `app-store-listing.txt` — NEW (reference only, not deployed)
- `public/about.html` — footer update

---

## v19 — March 19, 2026
**Google Analytics**
- Added G-Z2VVXQ6N4R measurement ID alongside existing Google Ads tag

Files changed:
- `index.html` — gtag config line added

---

## v18 — March 19, 2026
**Capacitor plumbing**
- Capacitor core + plugins installed (haptics, share, push notifications, etc.)
- capacitor.config.ts created (app ID: com.dugoutiq.app)
- Platform detection, haptics, sharing, notifications services created
- GameDayTab wired with haptics on at-bat outcomes + native share on scorer link
- AuthContext registers push notifications on login

Files changed:
- `capacitor.config.ts` — NEW
- `src/services/platform.js` — NEW
- `src/services/haptics.js` — NEW
- `src/services/sharing.js` — NEW
- `src/services/notifications.js` — NEW
- `src/components/gameday/GameDayTab.jsx` — haptics + share
- `src/contexts/AuthContext.jsx` — push notification init
- `package.json` — Capacitor scripts
- `.gitignore` — Capacitor build artifacts
