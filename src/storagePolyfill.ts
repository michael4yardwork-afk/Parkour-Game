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
  // Do not prefix top-level authenticated session tracking, the global accounts registry, or shared leaderboards
  if (key === 'momentum_current_user' || key === 'momentum_users' || key.startsWith('leaderboard_') || key.startsWith('community_')) {
    return key;
  }

  const username = getCurrentUser();
  if (!username) {
    return key;
  }

  // Prepend usr_<username>_ to ensure independent account files/data
  return `usr_${username}_${key}`;
}

try {
  Storage.prototype.getItem = function (key: string): string | null {
    const finalKey = getPrefixedKey(key);
    return originalGet.call(this, finalKey);
  };

  Storage.prototype.setItem = function (key: string, value: string): void {
    const finalKey = getPrefixedKey(key);
    originalSet.call(this, finalKey, value);
  };

  Storage.prototype.removeItem = function (key: string): void {
    const finalKey = getPrefixedKey(key);
    originalRemove.call(this, finalKey);
  };
} catch (e) {
  console.error("Failed to safely install Momentum storage polyfill:", e);
}

export {};
