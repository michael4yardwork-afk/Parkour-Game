---
name: Multiplayer WebSocket architecture
description: How real cross-machine multiplayer works — WS server, matchmaking queue, race rooms, client ownership handoff.
---

## Overview
Real multiplayer uses a WebSocket server at `/ws` (proxied by Vite in dev). The server manages matchmaking and in-race position sync. Previous system was BroadcastChannel (same-browser tabs only).

## Server (`server/ws.ts`)
- `setupWebSocketServer(httpServer)` — attaches WS to the shared HTTP server (not app.listen).
- **Queue**: players join with `QUEUE_JOIN`. Timer starts when 2+ are present. Server broadcasts `QUEUE_UPDATE {players, timeLeft, timerActive}` every second.
- **RACE_START**: server picks a level, assigns a roomId, sends `{roomId, levelId, seed, players}` to all queued players, then moves them into a `Room`.
- **In-race routing**: `GAME_TICK` and `GAME_FINISHED` are routed by looking up the sender's ws in `rooms` — **never trust client-supplied roomId/username**. Server uses server-bound identity.
- `FORCE_START`: any queued player can trigger an immediate race start.

## Client — Races.tsx
- Connects WebSocket on "Start Matching Queue", sends `QUEUE_JOIN`.
- Receives `QUEUE_UPDATE` to drive lobby UI (timer driven by server, not local interval).
- Receives `RACE_START` → calls `startRaceMatch(roomId, levelId, seed, serverPlayers)`.
- **`raceActiveRef`**: set to `true` before calling `onSelectLevel`. The unmount cleanup checks this and skips `QUEUE_LEAVE` + `close()` — because the socket is handed off to GameCanvas. This is critical: Races unmounts when the tab switches to 'play'.

## Client — App.tsx
- `handleSelectRaceLevel(level, raceMode, opponents, ws?, roomId?)` stores `ws` in `raceWsRef` and `roomId` in `raceRoomId` state.
- Passes `raceWs={raceWsRef.current}` and `raceRoomId={raceRoomId}` to `<GameCanvas />`.
- On exit, clears `raceWsRef.current = null` and `setRaceRoomId(null)` — does NOT close the WS (Races manages that).

## Client — GameCanvas.tsx
- Accepts `raceWs?: WebSocket | null` and `raceRoomId?: string | null` props.
- Attaches `message` listener to `raceWs` for `GAME_TICK`/`GAME_FINISHED` from real players.
- Outgoing ticks: prefers `raceWs.send(...)` when open; falls back to BroadcastChannel.
- Cleanup removes the message listener on effect teardown.

**Why:**
BroadcastChannel only works between tabs on the same browser/machine. Cross-machine multiplayer requires a server-side relay.

**How to apply:**
Any change to in-race sync (new message types, level additions) must be reflected in both `server/ws.ts` (routing) and `GameCanvas.tsx` (listener). The WS ownership handoff pattern (raceActiveRef) must be preserved if Races.tsx is refactored.
