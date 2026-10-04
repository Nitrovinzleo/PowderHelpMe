#  PowderHelpMe.exe - League of Legends Stats & Profile Tracker


<img width="1200" height="457" alt="image" src="https://github.com/user-attachments/assets/a631c504-fb36-4d81-bd85-06fd7ccac2d7" />



**PowderHelpMe** is a standalone desktop application (Electron + Node.js) dedicated to consulting League of Legends statistics and tracking real-time player performance, inspired by the universe of **Arcane** (Powder / Jinx).

---

## 🌟 Key Features & Implementation Highlights

### 1. 🏠 Home Page & Tactical Assistant ("Powder Will Help You!")
- **Left Sidebar Navigation** : Top-to-bottom sidebar navigation featuring *Home*, *Champions*, *My Profile*, *My Follows*, *Leaderboards*, *Live Games*, and *My Account*.
- **Powder Arcane Hero Banner** : Visual presentation featuring Powder holding her monkey grenade from Arcane.
- **Heroic Search Bar** : Instant search for any summoner via Riot ID (`GameName#TagLine`) with region selector (`EUW`, `NA`, `KR`, `EUNE`).

### 2. ⭐ "My Follows" Player Tracking System
- **"Follow" Button on Every Profile** : Subscribe to any summoner profile with a single click.
- **Live Status Overview** : Dedicated section in the sidebar menu listing all followed players with rank, win rate, and **live status** (🟢 In Game with champion name & elapsed match time, or ⚪ Offline / Idle).

### 3. 📊 Summoner Profile & Statistics
- **Ranked Solo/Duo & Flex Cards** : LP display, win/loss counters, and win rate percentage.
- **Top Champions** : Detailed KDA ratios (Kills/Deaths/Assists) and win rates per champion.
- **Match History** : Color-coded match cards (Blue Win / Red Loss) showing champion level, CS/min, KDA ratio, and full 6-item + trinket grid.
- **Personal Tier List (S+)** : Custom list of top personal champions.
- **LP Trajectory Chart** : Interactive time-series graph (Chart.js) covering the last 7 days.

### 4. 🔑 OriBot Authentication (2-Step Icon Verification)
- Secure login **without passwords** : The app generates a profile icon challenge (e.g. *Blue Potion #23*).
- The user equips the icon in the official League of Legends client, and the app verifies ownership by querying the Riot API.

### 5. 🎨 Matte Powder Arcane Visual Theme (Zero Emojis, Lucide SVG Icons)
- Matte dark design system (`#10141e`, flat borders `#283044`, Powder Cyan `#00a8e8` and Gold `#e5a93c` accents).
- **Zero raw text emojis** : Exclusive use of vector **Lucide SVG** icons for a clean, professional finish.
- Custom region selectors with integrated SVG chevrons and smooth loading spinners (`spin`).

### 6. 🔒 Security & Git Protection
- Riot API Key integrated into a protected `.env` file.
- `.gitignore` configured to exclude `.env`, `node_modules/`, `powder-settings.json`, and local logs.

---

## 🛠️ Technical Architecture

```
App league of legends stats/
├── src/
│   ├── main/
│   │   ├── main.js           # Electron main process & IPC Handlers
│   │   ├── riotApi.js        # Official Riot API client & U.GG mock fallback
│   │   ├── store.js          # Local settings persistence (powder-settings.json)
│   │   ├── badgeEngine.js    # Performance badges calculator
│   │   └── buildEngine.js    # Live build advice engine
│   └── renderer/
│       ├── assets/           # Logos & Powder artwork (powder_full.png, logo.png)
│       ├── dashboard/
│       │   ├── index.html    # Main layout with Sidebar and views (Home, Profile, Follows)
│       │   ├── dashboard.css # Powder Arcane design system & U.GG cards
│       │   └── dashboard.js  # Render logic, search, and follows manager
│       ├── overlays/         # Transparent overlay widgets (Paused)
│       └── styles/
│           └── powder-theme.css # CSS variables & visual tokens
├── .env                      # Riot Games API Key (RIOT_API_KEY)
├── .gitignore                # Git ignore rules
├── package.json              # Dependencies (Electron, Chart.js, Lucide)
└── README.md                 # Project specifications & documentation
```

---

## 🚀 Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Launch application in development mode
npm start
```

---

*Developed for PowderHelpMe.exe.*
