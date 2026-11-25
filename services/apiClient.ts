import { AnalyticsData, Grievance, NotificationItem, User } from '../types';

const TOKEN_KEY = 'civicconnect_token';
const USER_KEY = 'civicconnect_user';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
}

export function resolveMediaUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/') && API_BASE_URL) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function getSavedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    ['loggedInUser', 'adminLoggedIn', 'adminLevel', 'adminDistrict', 'adminTaluk', 'adminVillage'].forEach((k) =>
      localStorage.removeItem(k)
    );
  } catch {}
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(buildApiUrl(path), { ...options, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg =
      data.error ||
      (res.status === 404
        ? `API endpoint not found (${path}). Verify backend /api routing or VITE_API_BASE_URL.`
        : `Request failed (${res.status})`);
    throw new Error(msg);
  }
  return data as T;
}

export const apiClient = {
  health: () =>
    apiFetch<{ ok: boolean; dbConnected?: boolean; dbDriver?: string; aiMode: 'live-ai' | 'demo-mode' }>(
      '/api/health'
    ),

  register: (payload: { name: string; email: string; password: string; district?: string; taluk?: string; village?: string }) =>
    apiFetch<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string; portal?: 'citizen' | 'admin' | 'authority' }) =>
    apiFetch<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<{ user: User; unreadNotifications: number }>('/api/auth/me'),

  getComplaints: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return apiFetch<{ complaints: Grievance[] }>(`/api/complaints${qs}`);
  },

  getComplaint: (id: string) => apiFetch<{ complaint: Grievance }>(`/api/complaints/${encodeURIComponent(id)}`),

  createComplaint: (payload: {
    title: string;
    category: string;
    priority?: string;
    description: string;
    image?: string;
    location: any;
    isAnonymous?: boolean;
    isEmergency?: boolean;
  }) =>
    apiFetch<{ complaint: Grievance; aiAnalysis: any }>('/api/complaints', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  upvoteComplaint: (id: string) =>
    apiFetch<{ complaint: Grievance }>(`/api/complaints/${encodeURIComponent(id)}/upvote`, {
      method: 'POST',
    }),

  submitFeedback: (id: string, rating: number, feedback: string) =>
    apiFetch<{ complaint: Grievance }>(`/api/complaints/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    }),

  adminUpdateComplaint: (
    id: string,
    payload: {
      priority?: string;
      status?: string;
      currentTier?: string;
      assignedDepartment?: string;
      assignedAuthority?: string;
      remarks?: string;
    }
  ) =>
    apiFetch<{ complaint: Grievance }>(`/api/complaints/${encodeURIComponent(id)}/admin`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  authorityAction: (
    id: string,
    payload: {
      actionType: 'progress' | 'resolve' | 'escalate' | 'reject';
      status?: string;
      remarks?: string;
    }
  ) =>
    apiFetch<{ complaint: Grievance }>(`/api/complaints/${encodeURIComponent(id)}/authority`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  autoEscalateOverdue: () =>
    apiFetch<{ escalatedCount: number }>('/api/complaints/auto-escalate', { method: 'POST' }),

  getNotifications: () => apiFetch<{ notifications: NotificationItem[] }>('/api/notifications'),

  markNotificationRead: (id: number) => apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllNotificationsRead: () => apiFetch<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }),

  getAnalytics: (scope: 'all' | 'live' | 'sample' = 'all') =>
    apiFetch<AnalyticsData>(`/api/analytics?scope=${scope}`),

  sendContact: (payload: { name: string; email: string; subject: string; message: string }) =>
    apiFetch<{ ok: boolean; message: string }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
