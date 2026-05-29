# External Game State Schema

This documents the `game_state` shape for **external state mode**.

Scope:

- Used with `POST /api/v1/moves/request` for externally managed games
- Used with `POST /api/v1/moves/evaluate` for externally managed games
- In both cases, callers must provide `game_id` and `game_state`

Field coverage is limited to the properties present in:

- `tests/fixtures/example_external_state.json`

## Top-Level Schema

```json
{
  "num_players": 4,
  "game_config": {
    ...
  },
  "current_player_index": 0,
  "current_turn_player_index": 0,
  "current_turn_player_has_rolled": false,
  "dev_card_played_this_turn": false,
  "num_turns": 74,
  "game_phase": "PLAY_TURN",
  "current_trade": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "acceptees": [false, false, false, false],
  "offers_this_turn": 0,
  "players": [],
  "board": {},
  "bank_resources": {},
  "dev_deck_private": {}
}
```

## Top-Level Properties

| Property | Type | Notes |
|---|---|---|
| `num_players` | `integer` | Number of players. Optional (inferred from `players` length). |
| `game_config` | `object` | See `GameConfig`. Optional. |
| `current_player_index` | `integer` | Zero-based index of the player who must act next. During out-of-turn phases (discarding, trade resolution) this may differ from `current_turn_player_index`. |
| `current_turn_player_index` | `integer` | Zero-based index of the player whose turn is in progress. **Required.** Must equal `current_player_index` outside discarding and trade-resolution phases. |
| `current_turn_player_has_rolled` | `boolean` | Whether the current turn's player has rolled dice this turn. |
| `dev_card_played_this_turn` | `boolean` | Whether a dev card was played this turn. |
| `num_turns` | `integer` | Global turn counter. |
| `action_step` | `integer` | Monotonically increasing action counter. Increments by 1 for every applied action (including during initial placement when `num_turns` stays at 0). |
| `game_phase` | `string` | **Required.** Mutually-exclusive phase. See [Phase model](#phase-model). |
| `current_trade` | `integer[11]` | Open trade: 5 resource counts offered, 5 requested, offerer seat index. All zeros when no trade is active. |
| `acceptees` | `boolean[num_players]` | Per-seat acceptance flags. All `false` when no trade is active. Length must equal `num_players`. |
| `offers_this_turn` | `integer` | Number of `OFFER_TRADE` actions the turn owner has made this turn. Used for enforcing `max_offers_per_turn`. |
| `players` | `Player[]` | Per-player public/private state. |
| `board` | `Board` | Board occupancy and map layout. |
| `bank_resources` | `ResourceCounts` | Remaining bank resources. |
| `dev_deck_private` | `DevCardCounts` | Remaining dev-card deck counts. |

### Turn-owner and actor invariants

- `current_turn_player_index` must be a valid seat index (`0 <= current_turn_player_index < num_players`).
- Outside `DISCARDING` and `RESOLVING_TRADE` / `DECIDE_ACCEPTEES`, `current_turn_player_index` must equal `current_player_index`.
- During `DISCARDING`, `current_player_index` is the player currently discarding; `current_turn_player_index` remains the player whose turn produced the discard phase.
- During `RESOLVING_TRADE` and `DECIDE_ACCEPTEES`, `current_player_index` is the current trade responder or confirming actor; `current_turn_player_index` remains the offerer / turn owner.
- `current_trade` must be length 11; `acceptees` must have length `num_players`.

### Phase model

`game_phase` takes exactly one of the following string values:

| Value | Meaning |
|---|---|
| `INITIAL_BUILD` | Initial settlement / road placement (turns 1-2). |
| `PLAY_TURN` | Normal turn flow: pre-roll, post-roll main phase, or end-turn. |
| `DISCARDING` | One or more players must discard cards after a 7-roll. The acting player (`current_player_index`) may differ from the turn owner (`current_turn_player_index`). |
| `MOVING_ROBBER` | The robber must be moved (after a 7-roll discard sequence finishes, or after a knight card is played). |
| `ROAD_BUILDING` | The current player has free roads to place from a Road Building dev card. |
| `RESOLVING_TRADE` | A domestic trade offer is open; non-offering players may accept / reject. The acting player may differ from the turn owner. |
| `DECIDE_ACCEPTEES` | Sub-phase of `RESOLVING_TRADE` where the offerer chooses which acceptee to confirm with. |

## Nested Objects

### `GameConfig`

```json
{
  "friendly_robber": false,
  "balanced_dice": false,
  "enable_player_trades": "auto",
  "max_offers_per_turn": 2
}
```

| `game_config` property | Type | Notes |
|---|---|---|
| `friendly_robber` | `boolean` | When true, players with public VP <= 2 cannot be targeted by the robber. |
| `balanced_dice` | `boolean` | When true, dice rolls are drawn from a 36-outcome balanced deck. |
| `enable_player_trades` | `boolean \| "auto"` | Tri-state. `true` enables AI player trading, `false` disables it, `"auto"` (default) enables it for 3+ player games and disables it for 2-player games. |
| `max_offers_per_turn` | `integer` | Per-turn cap on successful `OFFER_TRADE` applications. |

## Server-provided / read-only fields

These appear in `GET /games/{game_id}/state` responses but are **not** accepted on
external-state submissions to `POST /api/v1/moves/request` or `/moves/evaluate`
— the server derives them from the rest of the game state.

| Field | Type | Notes |
|---|---|---|
| `is_trade_allowed` | `boolean` | True iff the turn owner may submit `OFFER_TRADE` right now. Clients should self-gate their `OFFER_TRADE` UI on this flag rather than re-implementing the rule. The server is authoritative; an invalid offer returns the standard invalid-action error. |

### `Player`

```json
{
  "index": 0,
  "color": "RED",
  "name": "Red",
  "victory_points": 3,
  "resources": {
    "wood": 2,
    "brick": 0,
    "sheep": 1,
    "wheat": 1,
    "ore": 0
  },
  "settlements": 1,
  "cities": 1,
  "roads_built": 2,
  "has_longest_road": false,
  "has_largest_army": false,
  "longest_road_length": 1,
  "knights_played": 2,
  "num_dev_cards": 1,
  "dev_cards_private": {
    "knight": 1,
    "year_of_plenty": 0,
    "monopoly": 0,
    "road_building": 0,
    "victory_point": 0
  },
  "dev_cards_played": {
    "knight": 2,
    "year_of_plenty": 0,
    "monopoly": 0,
    "road_building": 0,
    "victory_point": 0
  },
  "dev_cards_owned_at_start_private": {
    "knight": true,
    "year_of_plenty": false,
    "monopoly": false,
    "road_building": false
  },
  "port_resources": [null, "brick"]
}
```

`color` values in the example: `RED`, `WHITE`, `BLUE`, `ORANGE`.

| `players[]` property | Type | Notes |
|---|---|---|
| `index` | `integer` | Zero-based seat index. Should match position in `players[]`. |
| `color` | `string` | Player color. Example values: `RED`, `WHITE`, `BLUE`, `ORANGE`. |
| `name` | `string` | Human-readable player/agent label. |
| `victory_points` | `integer` | Public VP total for the player. |
| `resources` | `ResourceCounts` | Resource cards in hand by type. |
| `settlements` | `integer` | Number of settlements currently on board. |
| `cities` | `integer` | Number of cities currently on board. |
| `roads_built` | `integer` | Number of roads currently on board. |
| `has_longest_road` | `boolean` | Whether this player currently holds Longest Road. |
| `has_largest_army` | `boolean` | Whether this player currently holds Largest Army. |
| `longest_road_length` | `integer` | Current longest-road path length for the player. |
| `knights_played` | `integer` | Number of knights played by this player. |
| `num_dev_cards` | `integer` | Total dev cards in hand. |
| `dev_cards_private` | `DevCardCounts` | In-hand dev cards by type. |
| `dev_cards_played` | `DevCardCounts` | Played dev cards by type. |
| `dev_cards_owned_at_start_private` | `DevCardsOwnedAtStartPrivate` | Per dev-card type booleans for "owned at start of turn". |
| `port_resources` | `(null \| "wood" \| "brick" \| "sheep" \| "wheat" \| "ore")[]` | Derived convenience list of unique port types currently owned by this player. `null` means generic `3:1`; resource names mean specific `2:1`. |

### `ResourceCounts`

```json
{
  "wood": 0,
  "brick": 0,
  "sheep": 0,
  "wheat": 0,
  "ore": 0
}
```

### `DevCardCounts`

```json
{
  "knight": 0,
  "year_of_plenty": 0,
  "monopoly": 0,
  "road_building": 0,
  "victory_point": 0
}
```

### `DevCardsOwnedAtStartPrivate`

```json
{
  "knight": false,
  "year_of_plenty": false,
  "monopoly": false,
  "road_building": false
}
```

### `Board`

```json
{
  "buildings": {},
  "roads": {},
  "tiles": {},
  "robber_coordinate": [1, -2, 1],
  "ports": []
}
```

| `board` property | Type | Notes |
|---|---|---|
| `buildings` | `Record<string, BuildingEntry>` | Key is node ID string (for example `"37"`). |
| `roads` | `Record<string, string>` | Key is edge string (for example `"(14, 37)"`), value is color string. |
| `tiles` | `Record<string, TileEntry>` | Key is cube-coordinate string (for example `"(0, 0, 0)"`). |
| `robber_coordinate` | `[integer, integer, integer]` | Current robber tile coordinate. |
| `ports` | `PortEntry[]` | Port metadata. |

### `BuildingEntry`

```json
{
  "color": "RED",
  "type": "SETTLEMENT"
}
```

`type` values in the example: `SETTLEMENT`, `CITY`.

### `TileEntry`

```json
{
  "resource": "WOOD",
  "number": 6
}
```

`resource` may be `null` for the desert tile in the example.

### `PortEntry`

```json
{
  "resource": "WHEAT",
  "coordinate": [3, -3, 0]
}
```

`resource` may be `null` for generic 3:1 ports in the example.

## Appendix A: Port Encoding And Trade Rates

This section summarizes how port data maps to maritime trade rates.

### A.1 Board-level Port Encoding (`board.ports`)

Each port entry uses:

- `resource: null` for a generic `3:1` port
- `resource: "WOOD" | "BRICK" | "SHEEP" | "WHEAT" | "ORE"` for a specific `2:1` port

`board.ports` is authoritative map topology/state for reconstruction in external-state mode.

### A.2 Player-level Port Encoding (`players[].port_resources`)

`players[].port_resources` is a derived convenience view of currently owned port types:

- `null` means the player has at least one generic `3:1` port
- lowercase resource name (for example `"brick"`) means the player has that specific `2:1` port

The list is unique and deterministically ordered with `null` first, then resource names alphabetically.
