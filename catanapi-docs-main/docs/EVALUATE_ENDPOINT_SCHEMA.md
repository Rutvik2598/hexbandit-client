# External Evaluate Endpoint Schema

This document covers the external/client-facing contract for:

- `POST /api/v1/moves/evaluate`
- `GET /api/v1/moves/{request_id}` (polling)

## Request Schema (`POST /api/v1/moves/evaluate`)

### Top-Level Shape

```json
{
  "game_id": "abc-123",
  "game_state": { ... },
  "perspective_color": "RED",
  "requested_step": 42
}
```

### Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `game_id` | `string` | Yes | Game identifier returned by `POST /api/v1/games`. |
| `game_state` | `object` | Conditional | Required for externally managed games. Serialized snapshot to evaluate. See [`GAME_STATE_SCHEMA.md`](./GAME_STATE_SCHEMA.md). |
| `perspective_color` | `string` | Yes | Player color whose perspective the evaluation should use (for example `"RED"`). |
| `requested_step` | `integer` | Yes | Client-observed `action_step` for stale-request protection. |

### Validation Rules (external mode)

- `game_id` is always required.
- For externally managed games, include `game_state`.
- `perspective_color` is required.
- `requested_step` is required.

---

## Response Schema

Both submit and poll use the same envelope (`MoveRequestResponse`).

- Submit (`POST`) returns `202 Accepted` with `status: "pending"`.
- Poll (`GET`) transitions through: `pending` -> `thinking` -> `complete` or `error`.

### Envelope Shape (`MoveRequestResponse`)

```json
{
  "request_id": "uuid",
  "game_id": null,
  "request_type": "evaluate",
  "status": "pending",
  "created_at": "2026-04-24T12:34:56.000000Z",
  "started_at": null,
  "completed_at": null,
  "thinking_progress": 0,
  "thinking_message": "Waiting to start...",
  "think_time_budget_s": null,
  "think_time_elapsed_s": null,
  "timed_out": false,
  "result": null,
  "pwin_result": null,
  "error": null
}
```

### Envelope Fields

| Field | Type | Notes |
|---|---|---|
| `request_id` | `string` | Request identifier for polling/cancel. |
| `game_id` | `string \| null` | `null` in external (`game_state`) mode; the supplied game id in server-authoritative `game_id` mode. |
| `request_type` | `"evaluate"` | Always `"evaluate"` for this endpoint. |
| `status` | `"pending" \| "thinking" \| "complete" \| "error"` | Current async lifecycle state. |
| `created_at` | `datetime` | Request creation time (ISO 8601). |
| `started_at` | `datetime \| null` | Processing start time. |
| `completed_at` | `datetime \| null` | Processing completion time. |
| `thinking_progress` | `number` | Approximate progress percentage (`0`-`100`). |
| `thinking_message` | `string` | Human-readable processing stage. |
| `think_time_budget_s` | `number \| null` | Search budget in seconds (when available). |
| `think_time_elapsed_s` | `number \| null` | Elapsed search seconds (when started). |
| `timed_out` | `boolean` | Timeout marker. Evaluate responses normally return `false`; move timeouts are documented in [`MOVE_ACTION_RESPONSE_SCHEMA.md`](./MOVE_ACTION_RESPONSE_SCHEMA.md). |
| `result` | `null` | Unused for evaluate; move payloads only. |
| `pwin_result` | `PwinResult \| null` | Populated when `status == "complete"`. |
| `error` | `string \| null` | Error detail when `status == "error"`. |

### `pwin_result` Schema (`status == "complete"`)

```json
{
  "perspective": "RED",
  "pwin": [0.52, 0.31, 0.10, 0.07],
  "pwin_by_color": {
    "RED": 0.52,
    "BLUE": 0.31,
    "WHITE": 0.10,
    "ORANGE": 0.07
  },
  "actions_pwin": [
    {
      "action_label": "BUILD_ROAD (3,4)",
      "pwin_by_color": {
        "RED": 0.55,
        "BLUE": 0.28,
        "WHITE": 0.10,
        "ORANGE": 0.07
      },
      "confidence": 0.41
    },
    {
      "action_label": "END_TURN",
      "pwin_by_color": {
        "RED": 0.49,
        "BLUE": 0.34,
        "WHITE": 0.10,
        "ORANGE": 0.07
      },
      "confidence": 0.27
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `perspective` | `string` | Echo of the evaluated perspective color. |
| `pwin` | `number[]` | Raw per-player probability vector in engine player order. |
| `pwin_by_color` | `object` | Color-keyed probability map. |
| `actions_pwin` | `ActionPwin[]` | Root-action summaries sorted by descending confidence. Optional. |

### `ActionPwin`

| Field | Type | Notes |
|---|---|---|
| `action_label` | `string` | Human-readable action summary. |
| `pwin_by_color` | `object` | Per-color win-probability map for that action branch. |
| `confidence` | `number` | Confidence in pwin map for that action (`0.0`-`1.0`). |

---

## External Parsing Contract

- Treat submit and poll responses as the same envelope shape.
- For evaluate requests, read terminal data from `pwin_result` (not `result`).
- Always branch on `status` first:
  - `complete`: parse `pwin_result`
  - `error`: inspect `error`
  - otherwise: continue polling
