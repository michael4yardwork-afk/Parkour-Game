import { LevelConfig, LeaderboardEntry, UserAccount, RaceHistoryEntry, CourseNotification } from './types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('delta_rush_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) }
  });

  if (res.status === 401 && getToken()) {
    // Session token is invalid or expired — force a clean re-login instead of
    // silently failing on every authenticated request (e.g. leaderboard submits).
    localStorage.removeItem('delta_rush_token');
    localStorage.removeItem('momentum_current_user');
    window.dispatchEvent(new Event('delta_rush_session_expired'));
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API request failed');
  return data as T;
}

export interface AuthResult {
  token: string;
  user: UserAccount;
}

const PENDING_SUBMISSIONS_KEY = 'delta_rush_pending_submissions';

interface PendingSubmission {
  levelId: string;
  entry: { time: number; date: number; device?: string; speeds?: number[]; actions?: string[] };
}

export function queuePendingSubmission(levelId: string, entry: PendingSubmission['entry']) {
  try {
    const raw = localStorage.getItem(PENDING_SUBMISSIONS_KEY);
    const list: PendingSubmission[] = raw ? JSON.parse(raw) : [];
    list.push({ levelId, entry });
    localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to queue pending leaderboard submission:', e);
  }
}

export async function flushPendingSubmissions(): Promise<void> {
  let list: PendingSubmission[] = [];
  try {
    const raw = localStorage.getItem(PENDING_SUBMISSIONS_KEY);
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  if (!list.length) return;

  localStorage.removeItem(PENDING_SUBMISSIONS_KEY);

  const stillFailed: PendingSubmission[] = [];
  for (const pending of list) {
    try {
      await api.leaderboard.submit(pending.levelId, pending.entry);
    } catch (e) {
      console.warn('Retry of pending leaderboard submission failed:', (e as any)?.message || e);
      stillFailed.push(pending);
    }
  }
  if (stillFailed.length) {
    localStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(stillFailed));
  }
}

export const api = {
  auth: {
    async signup(username: string, password: string, avatar: string, avatarBg: string): Promise<AuthResult> {
      const result = await apiFetch<AuthResult>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, avatar, avatarBg })
      });
      localStorage.setItem('delta_rush_token', result.token);
      return result;
    },

    async login(username: string, password: string): Promise<AuthResult> {
      const result = await apiFetch<AuthResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('delta_rush_token', result.token);
      return result;
    },

    logout() {
      localStorage.removeItem('delta_rush_token');
    },

    async getUser(username: string): Promise<UserAccount | null> {
      try {
        return await apiFetch<UserAccount>(`/auth/user/${encodeURIComponent(username)}`);
      } catch {
        return null;
      }
    },

    async getAllUsers(): Promise<UserAccount[]> {
      try {
        return await apiFetch<UserAccount[]>('/auth/users');
      } catch {
        return [];
      }
    },

    async updateUser(username: string, updates: { avatar?: string; avatarBg?: string }): Promise<UserAccount> {
      return apiFetch<UserAccount>(`/auth/user/${encodeURIComponent(username)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    }
  },

  leaderboard: {
    async get(levelId: string): Promise<LeaderboardEntry[]> {
      try {
        return await apiFetch<LeaderboardEntry[]>(`/leaderboard/${encodeURIComponent(levelId)}`);
      } catch {
        return [];
      }
    },

    async submit(levelId: string, entry: { time: number; date: number; device?: string; speeds?: number[]; actions?: string[] }): Promise<{ id: string }> {
      return apiFetch<{ id: string }>(`/leaderboard/${encodeURIComponent(levelId)}`, {
        method: 'POST',
        body: JSON.stringify(entry)
      });
    },

    async clearMyRuns(levelId: string): Promise<void> {
      await apiFetch(`/leaderboard/${encodeURIComponent(levelId)}/my-runs`, { method: 'DELETE' });
    }
  },

  community: {
    async getCourses(): Promise<{ courses: LevelConfig[]; likedIds: string[]; bookmarkedIds: string[] }> {
      try {
        return await apiFetch<{ courses: LevelConfig[]; likedIds: string[]; bookmarkedIds: string[] }>('/community/courses');
      } catch {
        return { courses: [], likedIds: [], bookmarkedIds: [] };
      }
    },

    async publishCourse(course: LevelConfig): Promise<void> {
      await apiFetch('/community/courses', {
        method: 'POST',
        body: JSON.stringify(course)
      });
    },

    async deleteCourse(courseId: string): Promise<void> {
      await apiFetch(`/community/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' });
    },

    async toggleLike(courseId: string): Promise<{ liked: boolean; likesCount: number }> {
      return apiFetch<{ liked: boolean; likesCount: number }>(`/community/courses/${encodeURIComponent(courseId)}/like`, {
        method: 'POST'
      });
    },

    async toggleBookmark(courseId: string): Promise<{ bookmarked: boolean }> {
      return apiFetch<{ bookmarked: boolean }>(`/community/courses/${encodeURIComponent(courseId)}/bookmark`, {
        method: 'POST'
      });
    },

    async getSaved(): Promise<LevelConfig[]> {
      try {
        return await apiFetch<LevelConfig[]>('/community/saved');
      } catch {
        return [];
      }
    }
  },

  users: {
    async getProfile(username: string): Promise<{
      user: UserAccount;
      rating: number;
      color: string;
      courses: LevelConfig[];
      personalBests: { levelId: string; bestTime: number }[];
      followersCount: number;
      followingCount: number;
      isFollowing: boolean;
    } | null> {
      try {
        return await apiFetch(`/users/${encodeURIComponent(username)}/profile`);
      } catch {
        return null;
      }
    },

    async toggleFollow(username: string): Promise<{ following: boolean }> {
      return apiFetch<{ following: boolean }>(`/users/${encodeURIComponent(username)}/follow`, {
        method: 'POST'
      });
    },

    async getNotifications(username: string): Promise<CourseNotification[]> {
      try {
        const data = await apiFetch<any[]>(`/users/${encodeURIComponent(username)}/notifications`);
        return data.map(n => ({
          id: n.id,
          creator: n.creator,
          courseId: n.courseId,
          courseName: n.courseName,
          createdAt: n.createdAt,
          read: n.read
        }));
      } catch {
        return [];
      }
    },

    async markNotificationsRead(username: string, notifIds?: string[]): Promise<void> {
      await apiFetch(`/users/${encodeURIComponent(username)}/notifications/read`, {
        method: 'PATCH',
        body: JSON.stringify({ notifIds })
      });
    },

    async getRaceHistory(username: string): Promise<RaceHistoryEntry[]> {
      try {
        return await apiFetch<RaceHistoryEntry[]>(`/users/${encodeURIComponent(username)}/race-history`);
      } catch {
        return [];
      }
    },

    async saveRaceResult(username: string, result: RaceHistoryEntry): Promise<void> {
      await apiFetch(`/users/${encodeURIComponent(username)}/race-result`, {
        method: 'POST',
        body: JSON.stringify(result)
      });
    },

    async getRating(username: string): Promise<{ rating: number; color: string }> {
      try {
        return await apiFetch<{ rating: number; color: string }>(`/users/${encodeURIComponent(username)}/rating`);
      } catch {
        return { rating: 200, color: '#3b82f6' };
      }
    }
  }
};
