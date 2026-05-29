# Move Analysis Endpoint

`POST /api/v1/moves/analyze`

Analyzes a recorded move by comparing the action that was taken against the
best known alternative action.  Returns per-action win-probability maps and
an optional plain-text explanation.

---

## Purpose

This endpoint is designed for use by analysis panels and replay viewers that
want to explain why a recorded move was (or was not) the strongest choice.

It supports recording-first analysis:
- `game_id` + `step` are always required.
- `game_state` + `action_taken` are optional fallback inputs only when recording is missing.

When evaluation data is missing, the endpoint runs an implicit evaluate
("backfill"):
- Recording mode writes the new evaluate payload back to the recording frame.
- External-state mode returns evaluate data in the response.

---

## Request Modes

Provide `game_id` and `step` on every request.

### Mode 1: Recording (`game_id` + `step`)

```json
{
  "game_id": "abc-123",
  "step": 7
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `game_id` | `string` | Yes | Session identifier for the game. |
| `step` | `integer` | Yes | Zero-based recording frame index to analyze. Pass `-1` to analyze the most recent frame. |

### Optional Fallback: External State (`game_state` + `action_taken`)

```json
{
  "game_id": "abc-123",
  "step": 7,
  "game_state": { "...": "full Game.to_dict() snapshot" },
  "action_taken": {
    "action_type": "END_TURN",
    "action_data": { "value": null },
    "color": "RED"
  }
}
```

`action_taken` accepts either shape:
- **Move-request style**: `{ "action_type": "...", "action_data": { "value": ... }, "color": "RED" }`
- **Recording style**: `{ "action_type": "...", "value": ..., "color": "RED" }`

When recording for `game_id` is missing:
- `game_state` and `action_taken` let analyze continue without recording data.

---

## Response

```json
{
  "game_id": "abc-123",
  "step": 7,
  "acting_player": "RED",
  "action_taken": {
    "action_type": "END_TURN",
    "value": null,
    "color": "RED",
    "description": "END_TURN",  
    "pwin_by_color": {
      "RED": 0.42,
      "BLUE": 0.31,
      "WHITE": 0.15,
      "ORANGE": 0.12
    }
  },
  "best_action": {
    "action_type": "MARITIME_TRADE",
    "value": [0, 0, 0, 0, 4],
    "color": "RED",
    "description": "MARITIME_TRADE 4:1 give wood ask ore",
    "pwin_by_color": {
      "RED": 0.45,
      "BLUE": 0.30,
      "WHITE": 0.13,
      "ORANGE": 0.12
    }
  },
  "win_probability_delta": "6%",
  "explanation": "Trading first would have reduced your hand size and risk before ending the turn.",
  "explanation_error": null,
  "evaluate": {
    "pwin_by_color": {
      "RED": 0.43,
      "BLUE": 0.30,
      "WHITE": 0.15,
      "ORANGE": 0.12
    },
    "actions_pwin": []
  }
}
```

### Top-level fields

| Field | Type | Notes |
|---|---|---|
| `game_id` | `string` | Echo of request `game_id`. |
| `step` | `integer` | Resolved recording step in `game_id` mode; in external-state mode, derived from `game_state.action_step`. |
| `acting_player` | `string \| null` | Color string of the player who acted (`"RED"`, `"BLUE"`, etc.). `null` for terminal frames. |
| `action_taken` | `ActionRecord \| null` | The action that was actually taken. `null` for terminal or empty frames. |
| `best_action` | `ActionRecord \| null` | Best alternative the search engine found. `null` if no alternative was available. |
| `win_probability_delta` | `string \| null` | Human-readable win-probability difference between `best_action` and `action_taken` for the acting player (e.g. `"6%"` or `"-3%"`). `null` when unavailable. |
| `explanation` | `string \| null` | Plain-text explanation of the comparison. `null` when disabled or unavailable. |
| `explanation_error` | `string \| null` | Human-readable reason when the explanation could not be generated (e.g. `"No API key configured"`, `"LLM request failed"`). `null` when the explanation was generated successfully, or when the feature flag is off. |
| `evaluate` | `object \| null` | Evaluate payload containing `pwin_by_color` (state-level win probabilities) and `actions_pwin` (per-action breakdown).  Normally present.  `null` when evaluate data is unavailable (e.g. agent turns or terminal frames). |

### `ActionRecord`

| Field | Type | Notes |
|---|---|---|
| `action_type` | `string` | Action type string (e.g. `"END_TURN"`, `"MARITIME_TRADE"`). |
| `value` | `any \| null` | Action value payload. `null` for actions with no data (e.g. `END_TURN`). |
| `color` | `string` | Color of the player who took or would take this action. |
| `description` | `string \| null` | Display-friendly action text (e.g. `"BUILD_ROAD 3,4"`, `"MARITIME_TRADE 4:1"`). `null` when unavailable. |
| `pwin_by_color` | `object \| null` | Win-probability map for this action branch. `null` when data is unavailable. |

### Reading player-specific pwin

To render the acting player's win probability for each action:

```js
const takenPwin  = analysis.action_taken?.pwin_by_color?.[analysis.acting_player];
const bestPwin   = analysis.best_action?.pwin_by_color?.[analysis.acting_player];
```

---

## Null-response behavior

| Situation | Response |
|---|---|
| `game_id` not found (game_id mode) | `404 Not Found` |
| Missing `step` with `game_id` mode | `422 Unprocessable Entity` |
| Missing `action_taken` with `game_state` mode | `422 Unprocessable Entity` |
| `step` out of range | `404 Not Found` |
| Terminal frame with no recorded action | `200` with `action_taken: null`, `best_action: null`, `explanation: null` |
| Step 0 (no prior frame to supply evaluation data) | `200` with `action_taken` populated, `best_action: null`, `explanation: null` |
| No best alternative in evaluation data | `200` with `best_action: null`, `explanation: null` |
| Recorded action missing from evaluation data | `200` with `action_taken.pwin_by_color: null` |
| Malformed or missing evaluation data | `200`; pwin fields are `null`; no crash |

---

## Client handling of backfilled evaluate data

When `evaluate` is non-null, **clients should write this payload onto their
local representation of the frame** so that all subsequent reads (eval bar,
win-probability display, caching) use the most up-to-date values.  Always
overwrite — the server may return a restricted re-evaluate with sharper
estimates than the frame's original data:

```js
if (analysis.evaluate) {
    frame.evaluate = analysis.evaluate;
}
```

Once written, the eval bar and win-probability display can read from
`frame.evaluate.pwin_by_color` without any special override path.

---

## Caching guidance

Analysis results for a given `(game_id, step)` pair are deterministic once the
recording and evaluation data for that frame are stable.  Clients that step
through a replay can cache results by `(game_id, step)` to avoid redundant
requests.

For external-state mode, cache by a frame key from your replay source (for
example `(game_id, step, mode)` in frontend replay code), since no server
recording id/step lookup is performed.

---

## Notes

- `pwin_by_color` values come from the evaluation data that was captured when
  the recording frame was created, or from a backfill evaluate triggered by
  this endpoint when the frame had no prior data.
- In external-state mode, the endpoint does not read or write game recording
  frames. It analyzes the supplied `game_state` + `action_taken` only.
- `explanation` is a human-readable plain-text string.
- Only recorded game sessions support this endpoint.  Games that were not
  configured for recording return `404`.
- In game_id mode, when `step` is `-1`, the response `step` field contains the
  resolved zero-based index of the most recent frame.

---

## Synchronous Call (Backlog)

This endpoint may currently take several seconds to return. It is planned to
move to an asynchronous flow in the future, similar to the move request
pipeline.
