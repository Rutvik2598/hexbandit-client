# Coordinate Guide

This guide explains how board locations are represented in external game-state
and action payloads. It is a companion to
[`GAME_STATE_SCHEMA.md`](./GAME_STATE_SCHEMA.md) and
[`MOVE_ACTION_RESPONSE_SCHEMA.md`](./MOVE_ACTION_RESPONSE_SCHEMA.md), not a
replacement for their full field tables.

## Coordinate Spaces

The engine uses three related ways to identify board locations:

| Space | Shape | Used for | Example |
|---|---|---|---|
| Tile space | Cube coordinate `[x, y, z]` where `x + y + z == 0` | Hex tiles, robber position, ports, tile layout | `[0, -1, 1]` |
| Node space | Integer node ID (`0`-`53` on the standard board) | Intersections where settlements and cities are built | `15` |
| Edge space | Pair of node IDs | Roads between two adjacent intersections | `[3, 4]` |

Tile coordinates identify hex centers. Node IDs identify hex corners. Edge
coordinates are not independent IDs; a road is represented by the two node IDs
it connects.

## Tile Space

Tiles use cube coordinates on a hex grid. The three components are constrained
so that `x + y + z == 0`, and each adjacent hex differs by one of the six unit
directions. This is the coordinate system described in
[Hexagon grid coordinate system](https://math.stackexchange.com/questions/2254655/hexagon-grid-coordinate-system).

In serialized JSON, cube coordinates appear in two forms:

- As arrays when the coordinate is a field value, such as
  `"robber_coordinate": [1, -2, 1]`.
- As stringified tuple keys when the coordinate is a dictionary key, such as
  `"tiles": {"(0, 0, 0)": {...}}`.

Tile-space fields include:

- `board.tiles`: map from stringified cube coordinate to tile resource/number
  data. 
- `board.robber_coordinate`: cube coordinate of the tile currently occupied by
  the robber.
- `board.ports[].coordinate`: cube coordinate of a water/port tile. The port's
  adjacent node IDs are exposed separately in `board.ports[].nodes`.
- `MOVE_ROBBER` action values: `[target_coordinate, victim_color_or_null]`.

Example:

```json
{
  "board": {
    "tiles": {
      "(0, -1, 1)": {
        "resource": "WOOD",
        "number": 6
      }
    },
    "robber_coordinate": [1, -2, 1],
    "ports": [
      {
        "resource": "WHEAT",
        "coordinate": [3, -3, 0],
        "nodes": [8, 9]
      }
    ]
  }
}
```

## Node Space

Node IDs are integer intersection identifiers. On the standard board the engine
uses 54 land node IDs. Node IDs are topology IDs, not cube coordinates.

Node-space fields include:

- `board.buildings`: map from node ID string to the building at that
  intersection.
- `board.ports[].nodes`: the two node IDs adjacent to a port.
- `BUILD_SETTLEMENT` action values.
- `BUILD_CITY` action values.

Example:

```json
{
  "board": {
    "buildings": {
      "15": {
        "color": "RED",
        "type": "SETTLEMENT"
      }
    }
  }
}
```

## Edge Space

Roads are represented as the two endpoint node IDs. The pair is logically
undirected: `[3, 4]` and `[4, 3]` name the same physical road.

Edge-space fields include:

- `board.roads`: map from stringified node pair to owner color.
- `BUILD_ROAD` action values.
- Road-building follow-up actions after `PLAY_ROAD_BUILDING`.

Example:

```json
{
  "board": {
    "roads": {
      "(3, 4)": "RED"
    }
  },
  "action_type": "BUILD_ROAD",
  "action_data": {
    "value": [3, 4]
  }
}
```

## Game State Schema Summary

The external game-state board object mixes all three spaces:

| Field | Space | Notes |
|---|---|---|
| `board.tiles` keys | Tile | Stringified cube coordinates. |
| `board.robber_coordinate` | Tile | Robber's current hex. |
| `board.ports[].coordinate` | Tile | Port tile location. |
| `board.ports[].nodes` | Node / edge | The two intersections that own the port when occupied. |
| `board.buildings` keys | Node | Stringified node IDs. |
| `board.roads` keys | Edge | Stringified endpoint pairs; both directions may be present. |
| `players[].port_resources` | Derived state | Port types owned by a player, not coordinates. |

For reconstruction, `board.tiles` and `board.ports` define the map layout;
`board.buildings`, `board.roads`, and `board.robber_coordinate` define current
occupancy/state.

## Node Centers

Node IDs are fixed by the standard board topology. The external schema does not
repeat the six node IDs on every land tile, but you can derive tile corners by
using fractional cube-coordinate node centers.

For a tile at cube coordinate `[x, y, z]`, its six corner centers are:

| Corner | Offset from tile center |
|---|---|
| `NORTH` | `[1/3, 1/3, -2/3]` |
| `NORTHEAST` | `[2/3, -1/3, -1/3]` |
| `SOUTHEAST` | `[1/3, -2/3, 1/3]` |
| `SOUTH` | `[-1/3, -1/3, 2/3]` |
| `SOUTHWEST` | `[-2/3, 1/3, 1/3]` |
| `NORTHWEST` | `[-1/3, 2/3, -1/3]` |

Add one of these offsets to the tile coordinate, then match the result in the
table below. For example, the center tile `[0, 0, 0]` has corners:
`NORTH = 0`, `NORTHEAST = 1`, `SOUTHEAST = 2`, `SOUTH = 3`,
`SOUTHWEST = 4`, and `NORTHWEST = 5`.

These node centers are geometric reference coordinates for the standard
4-player board topology. They identify where each node sits relative to tile
cube coordinates; action and state payloads still use integer node IDs.

| Node | Center `[x, y, z]` |
|---:|---|
| `0` | `[1/3, 1/3, -2/3]` |
| `1` | `[2/3, -1/3, -1/3]` |
| `2` | `[1/3, -2/3, 1/3]` |
| `3` | `[-1/3, -1/3, 2/3]` |
| `4` | `[-2/3, 1/3, 1/3]` |
| `5` | `[-1/3, 2/3, -1/3]` |
| `6` | `[4/3, -2/3, -2/3]` |
| `7` | `[5/3, -4/3, -1/3]` |
| `8` | `[4/3, -5/3, 1/3]` |
| `9` | `[2/3, -4/3, 2/3]` |
| `10` | `[1/3, -5/3, 4/3]` |
| `11` | `[-1/3, -4/3, 5/3]` |
| `12` | `[-2/3, -2/3, 4/3]` |
| `13` | `[-4/3, -1/3, 5/3]` |
| `14` | `[-5/3, 1/3, 4/3]` |
| `15` | `[-4/3, 2/3, 2/3]` |
| `16` | `[-2/3, 4/3, -2/3]` |
| `17` | `[-5/3, 4/3, 1/3]` |
| `18` | `[-4/3, 5/3, -1/3]` |
| `19` | `[1/3, 4/3, -5/3]` |
| `20` | `[2/3, 2/3, -4/3]` |
| `21` | `[-1/3, 5/3, -4/3]` |
| `22` | `[4/3, 1/3, -5/3]` |
| `23` | `[5/3, -1/3, -4/3]` |
| `24` | `[7/3, -5/3, -2/3]` |
| `25` | `[8/3, -7/3, -1/3]` |
| `26` | `[7/3, -8/3, 1/3]` |
| `27` | `[5/3, -7/3, 2/3]` |
| `28` | `[4/3, -8/3, 4/3]` |
| `29` | `[2/3, -7/3, 5/3]` |
| `30` | `[1/3, -8/3, 7/3]` |
| `31` | `[-1/3, -7/3, 8/3]` |
| `32` | `[-2/3, -5/3, 7/3]` |
| `33` | `[-4/3, -4/3, 8/3]` |
| `34` | `[-5/3, -2/3, 7/3]` |
| `35` | `[-7/3, -1/3, 8/3]` |
| `36` | `[-8/3, 1/3, 7/3]` |
| `37` | `[-7/3, 2/3, 5/3]` |
| `38` | `[-8/3, 4/3, 4/3]` |
| `39` | `[-7/3, 5/3, 2/3]` |
| `40` | `[-5/3, 7/3, -2/3]` |
| `41` | `[-8/3, 7/3, 1/3]` |
| `42` | `[-7/3, 8/3, -1/3]` |
| `43` | `[-2/3, 7/3, -5/3]` |
| `44` | `[-4/3, 8/3, -4/3]` |
| `45` | `[1/3, 7/3, -8/3]` |
| `46` | `[2/3, 5/3, -7/3]` |
| `47` | `[-1/3, 8/3, -7/3]` |
| `48` | `[4/3, 4/3, -8/3]` |
| `49` | `[5/3, 2/3, -7/3]` |
| `50` | `[7/3, 1/3, -8/3]` |
| `51` | `[8/3, -1/3, -7/3]` |
| `52` | `[7/3, -2/3, -5/3]` |
| `53` | `[8/3, -4/3, -4/3]` |

## Action Schema Summary

Only some actions carry coordinates or node IDs in `action_data.value`:

| Action type | Location space | `action_data.value` shape |
|---|---|---|
| `MOVE_ROBBER` | Tile | `[[x, y, z], victim_color_or_null]` |
| `BUILD_ROAD` | Edge | `[node_a, node_b]` |
| `BUILD_SETTLEMENT` | Node | `node_id` |
| `BUILD_CITY` | Node | `node_id` |
