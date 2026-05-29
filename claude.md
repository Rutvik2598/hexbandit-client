# Hexbandit Frontend Client

## Project Goal

Build a production-quality frontend client for the Hexbandit API with a highly polished UI/UX experience inspired by modern online board-game clients such as Colonist.io and Hexed.gg.

The focus of this project is:
- frontend architecture
- scalable and maintainable code
- polished interaction design
- responsive layouts
- clean game-state handling
- production-level UX quality

This is NOT a prototype or hackathon project.

The codebase should be structured as if it will evolve into a long-term production application supporting:
- browser deployment
- tablet layouts
- mobile web
- future app-store deployment

The implementation should prioritize:
- maintainability
- extensibility
- reusability
- readability
- type safety
- separation of concerns

---

# Tech Stack

Use:

- React
- TypeScript
- Vite
- TailwindCSS
- Zustand
- TanStack Query
- Framer Motion
- React Three Fiber (`@react-three/fiber`) for 3D board rendering
- `@react-three/drei` for 3D helpers (camera, orbit controls, HTML overlay, etc.)

Do NOT use:
- Raw Three.js directly (always go through React Three Fiber)
- PixiJS
- Canvas 2D API
- SVG for the game board (SVG board has been superseded by R3F 3D)

React Three Fiber is the chosen renderer because the game board benefits from
true 3D perspective, lighting, and depth — and R3F keeps it idiomatic React.
For mobile: use InstancedMesh for hex tiles, keep geometry low-poly, and
integrate R3F's PerformanceMonitor for adaptive quality scaling.

---

# Core Architectural Principles

## 1. Strong Separation of Concerns

Separate:
- domain logic
- API integration
- state management
- rendering
- interaction logic
- reusable UI components

Avoid:
- giant React components
- duplicated logic
- API calls inside presentation components
- tightly coupled UI and game logic

---

## 2. Feature-Based Architecture

Prefer scalable feature/domain organization.

Example:

src/
  app/
  pages/
  features/
  entities/
  shared/
  services/
  store/
  styles/

---

# Suggested Structure

src/
  app/
    providers/
    router/

  pages/
    lobby/
    game/
    replay/

  features/
    game-board/
    game-actions/
    replay-controls/
    analysis-panel/
    eval-bar/
    player-panel/

  entities/
    player/
    board/
    game/
    actions/

  services/
    api/
      gamesApi.ts
      movesApi.ts
      evaluateApi.ts
      analysisApi.ts

  store/
    uiStore.ts
    interactionStore.ts
    replayStore.ts

  shared/
    components/
    hooks/
    utils/
    constants/
    types/

---

# Code Quality Requirements

## TypeScript

Use strict TypeScript typing everywhere.

Avoid:
- any
- untyped API responses
- implicit types

Create explicit domain models:
- Player
- Tile
- Edge
- Vertex
- GameAction
- GameState
- ResourceType

---

## Components

Components should:
- be reusable
- remain focused
- have clear props
- avoid excessive responsibility

Avoid large monolithic components.

Prefer composition over deeply nested conditional rendering.

---

## State Management

Use:
- Zustand for local interaction/UI state
- TanStack Query for async server state and polling

Do NOT place all game state in React component state.

Avoid prop drilling.

---

# Game Interaction Model

The interaction model is one of the most important parts of the application.

The UI should feel fluid and intuitive.

The frontend should support interaction modes such as:

- Idle
- Build Road
- Build Settlement
- Build City
- Robber Placement
- Trading
- Replay
- Analysis

These interaction states should be clearly modeled and separated.

Avoid scattered interaction booleans across components.

---

# Board Rendering

Render the game board using React Three Fiber.

The board should support:
- perspective camera (angled ~45° down, optional orbit controls)
- hover states via onPointerEnter/onPointerLeave on meshes
- selection states via emissive material highlights
- legal move highlighting with animated emissive glow rings
- animated transitions using R3F's useFrame or Framer Motion for UI panels
- interactive hex tiles, roads, and vertices via raycasting (R3F pointer events)
- adaptive quality via PerformanceMonitor for mobile

Board rendering should be modularized.

Preferred structure:

GameBoard3D (R3F Canvas + scene setup)
  BoardLighting
  BoardCamera
  HexTile3D (ExtrudeGeometry + texture on top face)
  RoadEdge3D (BoxGeometry)
  VertexNode3D (settlement = box+pyramid, city = tower geometry)
  Robber3D
  NumberToken (HTML overlay via @react-three/drei Html)

Mobile performance rules:
- Use InstancedMesh for the 19 hex tiles (single draw call)
- Keep settlement/city geometry under 500 triangles each
- Disable shadows on low-end devices via PerformanceMonitor
- Touch hit areas must be visually larger than the geometry

---

# UI/UX Expectations

The application should feel highly polished.

Prioritize:
- smooth transitions
- responsive interactions
- hover feedback
- animated highlights
- visual clarity
- clean layout hierarchy

Use Framer Motion for:
- panel transitions
- action transitions
- hover interactions
- replay animations
- state transitions

Animations should be subtle and purposeful.

Avoid excessive animation noise.

---

# Responsive Design

Desktop is the primary target.

However, architecture and layouts should not block:
- tablet support
- mobile-width layouts
- future app-store deployment

Use responsive layouts and avoid desktop-only assumptions.

---

# API Integration

The frontend communicates with the Hexbandit API.

Important endpoints include:
- /games/
- /agents/
- /moves/request
- /moves/{request_id}
- /moves/evaluate
- /analyze

The backend already handles:
- game logic
- bots
- evaluations
- analysis
- move legality

The frontend is responsible for:
- rendering
- interactions
- visualization
- UX
- polling async requests

---

# Async Request Handling

The move/evaluation APIs are asynchronous.

The client should:
1. submit request
2. receive request_id
3. poll until completion
4. update UI progressively

Support:
- loading states
- thinking indicators
- graceful error handling
- disabled interaction states

---

# Polling

Polling should:
- be centralized
- reusable
- cancellable
- resilient

Avoid duplicated polling logic across components.

---

# Error Handling

The app should gracefully handle:
- API failures
- invalid moves
- loading states
- empty states
- network interruptions

Never leave the UI in ambiguous states.

---

# Reusability

Prioritize reusable abstractions.

Examples:
- reusable modal system
- reusable buttons
- reusable game overlays
- reusable side panels
- reusable action cards

Avoid copy-paste UI patterns.

---

# Visual Style

Aim for:
- modern game UI
- dark polished interface
- clean visual hierarchy
- strong readability
- subtle gradients/shadows
- minimal clutter

References:
- Colonist.io
- Hexed.gg

Do NOT directly copy designs.

---

# Performance

Optimize for:
- smooth interactions
- minimal unnecessary rerenders
- memoized expensive computations
- stable rendering performance

Avoid premature optimization.

Prioritize clarity first.

---

# Accessibility

Support:
- keyboard navigation where practical
- visible focus states
- readable contrast
- semantic HTML where possible

---

# Implementation Priorities

Priority order:

1. Core gameplay interaction loop
2. Legal move highlighting
3. Clean architecture
4. Responsive layout
5. Eval bar integration
6. Replay system
7. Analysis panel
8. Advanced polish/animations

A polished core experience is more important than partially completed advanced features.

---

# Development Philosophy

Build this like a real production application.

Every architectural decision should optimize for:
- maintainability
- extensibility
- developer experience
- future scalability

Do not implement quick hacks that compromise long-term structure.

Prefer clean abstractions and incremental extensibility.
