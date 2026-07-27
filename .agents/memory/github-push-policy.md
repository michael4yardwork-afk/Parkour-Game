---
name: GitHub push policy
description: Never push to GitHub on the user's behalf — they handle all git pushes manually.
---

# GitHub Push Policy

**Rule:** Never run `git push` or use `gitPush()` on the user's behalf.

**Why:** The user explicitly requested to control all GitHub pushes themselves. This applies permanently, regardless of the task or context.

**How to apply:** After committing changes locally, stop there. Tell the user what was committed and that they can push when ready. Do not offer to push for them or ask if they want you to push.
