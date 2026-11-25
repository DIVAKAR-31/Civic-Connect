import { AIAnalyzeResponse, AdminAIAnalysis, Location } from '../types';
import { buildApiUrl, getAuthToken } from './apiClient';

async function postJson<T>(path: string, body: any): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `AI service request failed (${res.status})`);
  return data as T;
}

export const aiService = {
  async analyzeComplaint(payload: {
    title?: string;
    description: string;
    category?: string;
    location?: Location | null;
  }): Promise<AIAnalyzeResponse> {
    return postJson<AIAnalyzeResponse>('/api/ai/analyze', payload);
  },

  async analyzeCaseForAdmin(trackingId: string): Promise<AdminAIAnalysis> {
    return postJson<AdminAIAnalysis>('/api/ai/admin-analyze', { trackingId });
  },

  async chatAssistant(query: string): Promise<{ mode: 'live-ai' | 'demo-mode'; modeLabel: string; suggestion: string }> {
    return postJson('/api/ai/chat', { query });
  },
};
