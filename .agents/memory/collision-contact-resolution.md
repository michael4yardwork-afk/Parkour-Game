---
name: Collision contact resolution
description: Player movement must distinguish vertical crossings from shallow lateral block-edge overlaps.
---

The player collision solver should resolve floor and ceiling contacts only when the player crosses the corresponding block plane. A shallow X/Z overlap near the top edge is a lateral contact or an edge departure, not a landing; it must not snap the player vertically or zero horizontal velocity.

**Why:** Treating minimum-penetration edge overlaps as floor contacts caused ridge stops, momentum loss, and unnatural suction onto block tops.

**How to apply:** When changing GameCanvas collision logic, preserve the separation between top/ceiling crossing checks and X/Z wall resolution, and keep edge departures falling naturally.