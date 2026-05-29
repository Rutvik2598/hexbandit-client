# External State Mode: Move Action Response Schema

This document describes the `result` payload for externally managed games.

Scope:

- Request submitted with `POST /api/v1/moves/request` using `game_id` and `game_state`
- Response polled via `GET /api/v1/moves/{request_id}` where `request_type == "move"` and `status == "complete"`
- Externally managed mode requires creating a game first to obtain `game_id`

## Result Shape

```json
{
  "action_type": "BUILD_ROAD",
  "action_data": {
    "value": [3, 4]
  },
  "reasoning": "Agent 'simple' decided BUILD_ROAD.",
  "timed_out": false,
  "pwin_by_color": {
    "RED": 0.52,
    "BLUE": 0.31,
    "WHITE": 0.10,
    "ORANGE": 0.07
  }
}
```

Notes:

- `action_type` is a string.
- `action_data` is an object and may or may not include `value`.
- `reasoning` is optional.
- `timed_out` is always a boolean in current poll responses. When `true`, the server returned a low-confidence fallback action after the agent exceeded its decision timeout.
- `pwin_by_color` is optional and may be `null`. If available, contains per-color win probabilities.

## Poll Envelope Fields

`result` appears inside the shared async poll envelope returned by `GET /api/v1/moves/{request_id}`:

| Field | Type | Notes |
|---|---|---|
| `request_id` | `string` | Request identifier returned by `POST /api/v1/moves/request`. |
| `game_id` | `string` | Always present. |
| `agent_id` | `string` | Agent used for the request. |
| `request_type` | `"move" \| "evaluate"` | Move requests use `"move"`; evaluate requests use `"evaluate"`. |
| `status` | `"pending" \| "thinking" \| "complete" \| "error"` | Async lifecycle state. Parse this before reading `result`. |
| `thinking_progress` | `number` | Approximate progress percentage (`0`-`100`). |
| `thinking_message` | `string` | Human-readable status message. |
| `think_time_budget_s` | `number \| null` | Search/decision budget in seconds when known. |
| `think_time_elapsed_s` | `number \| null` | Elapsed search/decision seconds once processing starts. |
| `timed_out` | `boolean` | Mirrors `result.timed_out` for completed move responses. |
| `result` | `MoveResponse \| null` | Populated when `status == "complete"` for move requests. |
| `pwin_result` | `null` | Evaluate-only field; `null` for move requests. |
| `error` | `string \| null` | Error detail when `status == "error"`. |

## `action_type` Enum Values

Canonical engine `ActionType` values:

- `ROLL`
- `MOVE_ROBBER`
- `DISCARD`
- `BUILD_ROAD`
- `BUILD_SETTLEMENT`
- `BUILD_CITY`
- `BUY_DEVELOPMENT_CARD`
- `PLAY_KNIGHT_CARD`
- `PLAY_YEAR_OF_PLENTY`
- `PLAY_MONOPOLY`
- `PLAY_ROAD_BUILDING`
- `MARITIME_TRADE`
- `OFFER_TRADE`
- `ACCEPT_TRADE`
- `REJECT_TRADE`
- `CONFIRM_TRADE`
- `CANCEL_TRADE`
- `END_TURN`

## `action_data` By `action_type`

Resource IDs used below:

- `WOOD = 0`
- `BRICK = 1`
- `SHEEP = 2`
- `WHEAT = 3`
- `ORE = 4`

Color values are uppercase strings like `RED`, `BLUE`, `ORANGE`, `WHITE`, `BROWN`.

| `action_type` | `action_data.value` shape | Example |
|---|---|---|
| `ROLL` | `null` | `{"value": null}` |
| `MOVE_ROBBER` | `[[x, y, z], victim_color_or_null]` where `victim_color_or_null` is a color string or `null` | `{"value": [[0, -1, 1], "BLUE"]}` |
| `DISCARD` | `[wood_count, brick_count, sheep_count, wheat_count, ore_count]` — 5-element count vector in `RESOURCES` order | `{"value": [1, 2, 0, 1, 0]}` (1 WOOD + 2 BRICK + 1 WHEAT) |
| `BUILD_ROAD` | `[node_a, node_b]` | `{"value": [3, 4]}` |
| `BUILD_SETTLEMENT` | `node_id` | `{"value": 15}` |
| `BUILD_CITY` | `node_id` | `{"value": 15}` |
| `BUY_DEVELOPMENT_CARD` | `null` | `{"value": null}` |
| `PLAY_KNIGHT_CARD` | `null` | `{"value": null}` |
| `PLAY_YEAR_OF_PLENTY` | `[resource_id]` or `[resource_id, resource_id]` | `{"value": [3, 4]}` |
| `PLAY_MONOPOLY` | `resource_id` | `{"value": 4}` |
| `PLAY_ROAD_BUILDING` | `null` | `{"value": null}` |
| `MARITIME_TRADE` | `[give1, give2, give3_or_null, give4_or_null, get1]` | `{"value": [0, 0, null, null, 4]}` |
| `OFFER_TRADE` | `[offer_wood, offer_brick, offer_sheep, offer_wheat, offer_ore, ask_wood, ask_brick, ask_sheep, ask_wheat, ask_ore]` — 10 non-negative integers (5 offered + 5 requested). | `{"value": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0]}` — Clients self-gate via `state.is_trade_allowed`. The server validates shape, affordability, and legality; an invalid offer returns the standard invalid-action error. |
| `ACCEPT_TRADE` | Current trade tuple as returned by engine (`11` entries in practice: 10 trade counts + offerer index) | `{"value": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2]}` |
| `REJECT_TRADE` | Same shape as `ACCEPT_TRADE` | `{"value": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 2]}` |
| `CONFIRM_TRADE` | `[offer_wood, offer_brick, offer_sheep, offer_wheat, offer_ore, ask_wood, ask_brick, ask_sheep, ask_wheat, ask_ore, counterparty_color]` | `{"value": [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, "BLUE"]}` |
| `CANCEL_TRADE` | `null` | `{"value": null}` |
| `END_TURN` | `null` | `{"value": null}` |

## External-State Parsing Contract

- `result.action_type` is always a string.
- `result.action_data` is always an object.
- `result.action_data.value` is optional.
- When `action_type` is one of the canonical enum values above, `action_data.value` follows the table in this document.
- When `action_type` is not one of those canonical values (for example `roll_dice`), treat it as caller-defined and parse `action_data.value` defensively.
- When `timed_out` is `true`, the returned action is a fallback and should be treated as low-confidence.

Examples:

```json
{
  "action_type": "roll_dice",
  "action_data": {}
}
```

```json
{
  "action_type": "build_road",
  "action_data": {"value": [3, 4]}
}
```

Client guidance:

- Always parse `action_type` as an arbitrary string first.
- Treat `action_data.value` as optional.
- If you need canonical handling, normalize aliases (for example `roll_dice` -> `ROLL`) in your client before dispatch.
- Check `timed_out` before applying the action if your client wants to replace low-confidence fallback moves.

## Error Status

When `status == "error"` the move was not computed. The poll response contains:

```json
{
  "request_id": "...",
  "status": "error",
  "result": null,
  "error": "Failed to reconstruct game from state: ..."
}
```

Common causes:

- Malformed or incomplete `game_state` payload (reconstruction error).
- The submitted game state represents a finished game (`winning_color` is already set).
- An internal failure during agent decisioning that the server could not recover from.

Clients must poll until `status` is `"complete"` or `"error"` — do not assume completion after a fixed delay. On `"error"`, inspect the `error` field for a description and resubmit with a corrected payload if appropriate.
