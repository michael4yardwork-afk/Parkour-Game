---
name: PB ghost mesh sync (GameCanvas)
description: Why the personal-best ghost mesh could fail to (re)appear, and the ordering fix used.
---

## Issue
The ghost mesh was created/removed in two separate places: a dedicated "Load Personal
Best" `useEffect` (deps: level.id, settings.showGhost, raceMode) and inside `initGame()`
(called from the Three.js scene-construction effect). The ghost effect's mesh-creation
branch required `sceneRef.current` to already be set, but nothing guaranteed the scene
effect had run first — it worked only by incidental effect-declaration order.

## Fix
Added a `sceneReady` state flipped true right after `sceneRef.current = scene` in the
scene-construction effect (and reset to false + refs nulled in that effect's cleanup).
`sceneReady` was added to the ghost effect's dependency array so it reliably re-attempts
mesh creation once a live scene actually exists, instead of depending only on ref-read
timing (refs changing via `.current = x` don't retrigger effects).

**Why:** Two independent effects mutating the same ghost mesh ref based on an
un-tracked ref (`sceneRef.current`) is a recurring source of "sometimes doesn't show up"
bugs — any future feature touching `ghostMeshRef`/`sceneRef` in GameCanvas.tsx should
route through a tracked readiness signal, not just check the ref inline.

## Known remaining limitation (not a bug, tracked as follow-up)
The camera in GameCanvas is forward-only (no mouse-look). The ghost is positioned by
matching elapsed time, not course progress, so if the current run's pace differs from
the recorded PB, the ghost can end up behind the camera and be invisible for stretches —
this looks like "ghost not showing" but is really a visibility/design gap, not a mesh
lifecycle bug.
