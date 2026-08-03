---
name: Collision contact resolution
description: Player movement must distinguish vertical crossings from shallow lateral block-edge overlaps.
---

The player collision solver should resolve floor and ceiling contacts only when the player crosses the corresponding block plane. A shallow X/Z overlap near the top edge is a lateral contact or an edge departure, not a landing; it must not snap the player vertically or zero horizontal velocity.

**Why:** Treating minimum-penetration edge overlaps as floor contacts caused ridge stops, momentum loss, and unnatural suction onto block tops.

**How to apply:** When changing GameCanvas collision logic, preserve the separation between top/ceiling crossing checks and X/Z wall resolution, and keep edge departures falling naturally.

Trigger effects such as checkpoints should be evaluated independently in every
collision-axis pass. Physical Y resolution can remain directional, but X/Z side
and underside contacts must still activate non-physical gameplay state.

**Why:** Split-axis resolution may push a player out of a block during the X or Z
pass before the later Y pass sees an overlap, otherwise side contacts silently
miss trigger effects.

**How to apply:** Run trigger activation on confirmed X, Z, and Y overlaps, while
leaving landing, ceiling, velocity, and grounded-state resolution directional.