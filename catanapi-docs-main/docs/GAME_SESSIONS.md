# External Game Sessions

This guide explains the required session flow for external integrations.

For external-state usage, you must:

1. Create a game first (`POST /api/v1/games`) to obtain `game_id`.
2. Reuse that `game_id` on all move/evaluate/analyze requests.

---

## Why `game_id` Is Required

`game_id` anchors all requests to a backend game session so the API can:

- persist recordings across frames
- store evaluate data on the correct step
- support replay and move analysis
- tie requests and recordings to one durable backend session

Without a created game session, these features are not available.

---

## 1) Create a Game Session

Create an externally managed game with recording enabled:

```bash
curl -X POST http://localhost:8000/api/v1/games \
  -H "Content-Type: application/json" \
  -d '{
    "num_players": 4,
    "player_ids": ["human", "default", "default", "default"],
    "externally_managed": true,
    "recording": true
  }'
```

Example response (truncated):

```json
{
  "game_id": "abc-123",
  "status": "active"
}
```

Save `game_id` and use it on every downstream request.

---

## 2) Request a Move (`POST /moves/request`)

For externally managed games, include:

- `game_id` (required)
- `game_state` (required)
- `agent_id` (optional; when omitted, backend resolves the default move agent)

```bash
curl -X POST http://localhost:8000/api/v1/moves/request \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": "abc-123",
    "game_state": { "...": "full Game.to_dict() payload" }
  }'
```

---

## 3) Evaluate a Position (`POST /moves/evaluate`)

Include:

- `game_id` (required)
- `game_state` (required for externally managed games)
- `perspective_color` (required)
- `requested_step` (required; usually `game_state.action_step`)

```bash
curl -X POST http://localhost:8000/api/v1/moves/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": "abc-123",
    "game_state": { "...": "full Game.to_dict() payload" },
    "perspective_color": "RED",
    "requested_step": 42
  }'
```

---

## 4) Analyze a Step (`POST /moves/analyze`)

Include:

- `game_id` (required)
- `step` (required)

Optional fallback payloads:

- `game_state`
- `action_taken`

These are only used when recording is missing for that `game_id`.

```bash
curl -X POST http://localhost:8000/api/v1/moves/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": "abc-123",
    "step": 42
  }'
```

---

## 5) Fetch Recording

Recording is keyed by `game_id`:

- `GET /api/v1/games/{game_id}/recording`
- `GET /api/v1/games/{game_id}/recording/{step}`

---

## Integration Summary

- Always create a game first.
- Always pass `game_id`.
- For externally managed move/evaluate, also pass `game_state`.
- Keep `requested_step` aligned with `game_state.action_step` for evaluate.
