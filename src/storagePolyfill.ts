// Dynamic sandboxed storage polyfill for the Momentum app
// This transparently scopes all user preferences, drafts, scores, and custom layouts to the active username

const originalGet = Storage.prototype.getItem;
const originalSet = Storage.prototype.setItem;
const originalRemove = Storage.prototype.removeItem;

let prefixBypass = false;

function getCurrentUser(): string | null {
  if (prefixBypass) return null;
  prefixBypass = true;
  try {
    const saved = originalGet.call(localStorage, 'momentum_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && parsed.username) {
        return parsed.username.toLowerCase().trim();
      }
    }
  } catch (e) {
    // Ignore any JSON parse issues
  } finally {
    prefixBypass = false;
  }
  return null;
}

function getPrefixedKey(key: string): string {
  // Do not prefix top-level authenticated session tracking, the global accounts registry,
  // shared leaderboards, the auth token (needed before/independent of the active user being
  // set), or the pending-submission retry queue (must survive across login state changes).
  if (
    key === 'momentum_current_user' ||
    key === 'momentum_users' ||
    key === 'delta_rush_token' ||
    key === 'delta_rush_pending_submissions' ||
    key.startsWith('leaderboard_') ||
    key.startsWith('community_')
  ) {
    return key;
  }

  const username = getCurrentUser();
  if (!username) {
    return key;
  }

  // Prepend usr_<username>_ to ensure independent account files/data
  return `usr_${username}_${key}`;
}

function freeStorageSpace(requiredBytes: number, excludeKey: string): boolean {
  const ghostKeys: { key: string; size: number; age: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes('_ghost_replay_') && k !== excludeKey) {
        const val = originalGet.call(localStorage, k);
        let age = 0;
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (parsed && typeof parsed === 'object' && typeof parsed.createdAt === 'number') {
              age = parsed.createdAt;
            }
          } catch (e) {}
        }
        ghostKeys.push({
          key: k,
          size: val ? val.length : 0,
          age: age || 1
        });
      }
    }

    // Sort by age ascending (oldest first), then by size descending
    ghostKeys.sort((a, b) => {
      if (a.age !== b.age) return a.age - b.age;
      return b.size - a.size;
    });

    let freed = 0;
    for (const gk of ghostKeys) {
      originalRemove.call(localStorage, gk.key);
      freed += gk.size;
      if (freed >= requiredBytes) {
        return true;
      }
    }
    return ghostKeys.length > 0;
  } catch (e) {
    console.error("Failed during freeStorageSpace:", e);
    return false;
  }
}

try {
  Storage.prototype.getItem = function (key: string): string | null {
    const finalKey = getPrefixedKey(key);
    return originalGet.call(this, finalKey);
  };

  Storage.prototype.setItem = function (key: string, value: string): void {
    const finalKey = getPrefixedKey(key);
    try {
      originalSet.call(this, finalKey, value);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.warn(`Storage quota exceeded for key: ${finalKey}. Attempting to free space...`);
        
        // Try to clear some old ghost replays
        const freedSome = freeStorageSpace(value.length, finalKey);
        
        if (freedSome) {
          try {
            originalSet.call(this, finalKey, value);
            return;
          } catch (retryErr) {
            console.warn(`Retry failed after clearing other ghost replays. Attempting downsampling...`);
          }
        }

        // If it's a ghost replay, downsample it to reduce size significantly
        if (finalKey.includes('_ghost_replay_')) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && Array.isArray(parsed.frames)) {
              const originalLen = parsed.frames.length;
              // Keep every 3rd frame to reduce space by ~66%
              parsed.frames = parsed.frames.filter((_: any, idx: number) => idx % 3 === 0);
              const downsampledValue = JSON.stringify(parsed);
              console.warn(`Downsampled ghost replay from ${originalLen} to ${parsed.frames.length} frames.`);
              
              try {
                originalSet.call(this, finalKey, downsampledValue);
                return;
              } catch (downsampleErr) {
                console.error("Downsampled save also failed:", downsampleErr);
              }
            }
          } catch (parseErr) {
            console.error("Failed to parse ghost replay for downsampling:", parseErr);
          }
        }

        // Handle case where we still exceed quota (swallow error gracefully to prevent crash)
        console.error(`Failed to execute 'setItem' on 'Storage': ${finalKey} could not be saved due to quota limit.`);
      } else {
        throw e;
      }
    }
  };

  Storage.prototype.removeItem = function (key: string): void {
    const finalKey = getPrefixedKey(key);
    originalRemove.call(this, finalKey);
  };
} catch (e) {
  console.error("Failed to safely install Momentum storage polyfill:", e);
}

export {};
