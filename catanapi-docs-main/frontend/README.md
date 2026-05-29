# Hexbandit Frontend

An example frontend demonstrating API calls and UI elements for Hexbandit
platform features. These pages can be pointed at any running Hexbandit API
instance.

## Pages

| Page | File | Purpose |
|------|------|---------|
| **Play** | `play.html` | Playable hex-board game — human vs AI or AI vs AI |
| **Dev** | `dev.html` | API explorer for testing endpoints |

## Getting Started

Serve this folder with any static file server and configure the API base
URL via the switcher bar at the top of each page. For example:

```bash
# Using Python's built-in server
cd frontend/
python3 -m http.server 3000

# Then open http://localhost:3000/play.html
```

Point the **API Base URL** switcher to the address of a running Hexbandit
API server (e.g. `http://localhost:8000`).

## Playing as a Human

1. Open `play.html`.
2. In the setup screen, select **🎮 Human Player** for one or more seats.
3. Click **▶ Start Game**.
4. When it's your turn, the header shows **🎮 YOUR TURN** and available
   actions appear in the right panel. Click action buttons or click
   directly on the hex board to place settlements/roads.
5. AI opponents will move automatically after your turn.

## API Base URL Switcher

Both pages include a bar at the top that lets you point the frontend at
a different API server:

| Option | When to use |
|--------|-------------|
| **This server** (default) | Frontend is served by the same host |
| **localhost:8000** | API runs locally on port 8000 |
| **localhost:5000** | API runs locally on port 5000 |
| **Custom…** | Any other URL (e.g. a staging deploy) |

The choice is persisted in `localStorage`.

## Managed Games

This frontend demonstrates two different modes:

- Server (API) managed games (for development of new client): create the 
  game with `externally_managed: false`. Look at how code uses `currentGameId`.
- Frontend managed games (for integration with existing platforms): create 
  the game with `externally_managed: true`. Look at how code uses `externalGameId`.


## File Layout

```
frontend/
├── play.html              # Playable game page (hex board, human + AI)
├── dev.html               # Dev / API testing page
├── README.md              # ← you are here
├── assets/                # SVG hex tiles
│   ├── tile_brick.svg
│   ├── tile_desert.svg
│   ├── tile_maritime.svg
│   ├── tile_ore.svg
│   ├── tile_sheep.svg
│   ├── tile_wheat.svg
│   └── tile_wood.svg
└── static/
    ├── play.js            # Hex-board renderer + game logic + human input
    ├── play.css           # Play page styles
    ├── dev.js             # Dev page logic
    └── style.css          # Dev page styles
```

