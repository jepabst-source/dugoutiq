# ⚾ Dugout IQ — Smart Lineup Manager for Youth Baseball & Softball

**[lineupman.com](https://lineupman.com)** — Free to use. No download required.

Dugout IQ is a lineup management app built specifically for youth baseball and softball coaches. It handles the stuff you used to scribble on napkins — batting orders, defensive rotations, and position tracking — so you can focus on your players.

## Why Dugout IQ?

Most coaching apps focus on scoring (GameChanger) or team communication (TeamSnap). Neither helps you answer the question every rec league coach faces before every game: **"Who plays where, and is it fair?"**

Dugout IQ is the only tool built specifically for lineup planning and fair play.

## Features

### 🛡️ Automatic Defensive Rotations
The rotation engine generates position assignments based on player ratings, position preferences, and bench history. Set competitive or development mode per inning. The bench fairness algorithm ensures no kid rides the bench all game — lower-rated players sit first, but bench time is distributed fairly across the season.

### ⚾ Live At-Bat Tracking
Tap a player, tap an outcome. Simple mode (K, Hit, Walk, Out) or Advanced mode (1B, 2B, 3B, HR, BB, HBP, SAC) with spray charts showing where each hit landed on the field. OBP and batting averages update in real time.

### 🖨️ Printable Dugout Cards
One-tap print: batting order on one side, defensive lineup on the other. Includes late-inning pocket cards — LFG (win mode) puts your best players at key positions, OOR (shuffle mode) rests your starters. Tape it to the dugout wall.

### 👨‍👩‍👧 Parent Portal
Share a link and a 4-digit PIN. Parents see their child's OBP, batting trends, recent positions played, and hot streaks. Only positive trends — no kid gets called out for struggling. No login required.

### 📤 Live Scorer Links
Generate a link you can text to anyone in the stands. They tap players and log at-bats from their phone — no account needed. Stats sync to your account automatically. Expires in 12 hours.

### 📊 Season History
Every committed game is saved. View position history across all games, season batting stats, per-player trends, and spray charts. Data-backed decisions about who plays where.

### 👥 Multi-Team Support
Coach multiple teams? Switch between them in one tap. Each team has its own roster, stats, and settings.

### ⭐ Player Ratings with Glove/Arm Breakdown
Rate players 1-5 stars for defense. Optionally break it down into Glove and Arm ratings — the average becomes the overall score. The rotation engine uses these to place the right players at the right positions.

### ⚙️ Configurable Rules
- No back-to-back bench sits
- Infield innings cap
- Position minimum ratings (e.g., 4★ minimum for 1st Base)
- Competitive vs. development mode per inning
- Configurable rolling average window (last 3, 5, or 10 at-bats)
- Simple or advanced at-bat tracking mode

## How It's Different

| Feature | Dugout IQ | GameChanger | TeamSnap |
|---------|-----------|-------------|----------|
| Auto defensive rotations | ✅ | ❌ | ❌ |
| Bench fairness algorithm | ✅ | ❌ | ❌ |
| Printable dugout cards | ✅ | ❌ | ❌ |
| Live at-bat tracking | ✅ | ✅ | ❌ |
| Parent portal | ✅ | ✅ | Partial |
| Spray charts | ✅ | ✅ | ❌ |
| Position history tracking | ✅ | ❌ | ❌ |
| No app download needed | ✅ | ❌ | ❌ |
| Team communication | ❌ | ❌ | ✅ |
| Advanced scoring (pitch-by-pitch) | ❌ | ✅ | ❌ |

**Use them together:** TeamSnap for scheduling and communication. GameChanger for live scoring. Dugout IQ for lineup planning and fair play.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v4
- **Backend:** Firebase (Auth + Firestore + Cloud Functions)
- **Payments:** Stripe (web) + RevenueCat (native, coming soon)
- **Hosting:** GitHub Pages with custom domain ([lineupman.com](https://lineupman.com))
- **PWA:** Installable on any device, works offline

## Pricing

- **Free:** 2 committed games, 70 at-bats — enough to try every feature
- **Pro:** $1.99 one-time purchase — lifetime access

## Links

- 🌐 **App:** [lineupman.com](https://lineupman.com)
- 📖 **About:** [lineupman.com/about.html](https://lineupman.com/about.html)
- ⚖️ **Compare:** [lineupman.com/compare.html](https://lineupman.com/compare.html)
- 🔒 **Privacy:** [lineupman.com/privacy.html](https://lineupman.com/privacy.html)
- 📧 **Support:** [support@lineupman.com](mailto:support@lineupman.com)

## Who It's For

Rec league coaches, travel ball coaches, and anyone managing a youth baseball or softball team who wants fair play and organized game days. Built by a youth softball coach in Indianapolis.

---

*Built by a coach, for coaches.*
