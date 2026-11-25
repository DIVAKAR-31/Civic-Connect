import { AIAnalyzeResponse, AdminAIAnalysis, Location } from '../types';
import { getAuthToken } from './apiClient';

async function postJson<T>(url: string, body: any): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'AI service request failed');
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
