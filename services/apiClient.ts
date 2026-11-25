import { AnalyticsData, Grievance, NotificationItem, User } from '../types';

const TOKEN_KEY = 'civicconnect_token';
const USER_KEY = 'civicconnect_user';

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

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const apiClient = {
  health: () => apiFetch<{ ok: boolean; aiMode: 'live-ai' | 'demo-mode' }>('/api/health'),

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
