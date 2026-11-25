export enum IssueCategory {
  POTHOLE = 'Pothole',
  ROAD_DAMAGE = 'Road Damage',
  STREET_LIGHT = 'Street Light',
  GARBAGE = 'Garbage',
  WATER = 'Water Leakage',
  WATER_CONTAMINATION = 'Water Contamination',
  SANITATION = 'Sanitation',
  DRAINAGE = 'Drainage',
  STRAY_ANIMALS = 'Stray Animals',
  NOISE_POLLUTION = 'Noise Pollution',
  ILLEGAL_CONSTRUCTION = 'Illegal Construction',
  TRAFFIC_SIGNAL = 'Traffic Signal',
  PARK_MAINTENANCE = 'Park Maintenance',
  PUBLIC_TOILETS = 'Public Toilets',
  ENCROACHMENT = 'Encroachment',
  TREE_FALLEN = 'Fallen Tree',
  SEWAGE_OVERFLOW = 'Sewage Overflow',
  AIR_QUALITY = 'Air Pollution',
  PUBLIC_TRANSPORT = 'Public Transport',
  VANDALISM = 'Vandalism',
  ABANDONED_VEHICLE = 'Abandoned Vehicle',
  MOSQUITO_BREEDING = 'Mosquito Breeding',
  ILLEGAL_ADVERTISING = 'Illegal Advertising',
  STREET_VENDORS = 'Street Vendors',
  EXPOSED_WIRES = 'Exposed Wires',
  BRIDGE_MAINTENANCE = 'Bridge Maintenance',
  SIDEWALK_DAMAGE = 'Sidewalk Damage',
  PUBLIC_SAFETY = 'Public Safety',
  STREET_SIGN = 'Street Sign Damage',
  OPEN_MANHOLE = 'Open Manhole',
  WATER_LOGGING = 'Water Logging',
  ILLEGAL_PARKING = 'Illegal Parking',
  FIRE_HAZARD = 'Fire Hazard',
  DAMAGED_HYDRANT = 'Damaged Hydrant',
  PEST_INFESTATION = 'Pest Infestation',
  SCHOOL_ZONE = 'School Zone Safety',
  BROKEN_FENCE = 'Broken Fence',
  HANGING_CABLES = 'Hanging Cables',
  OTHERS = 'Others'
}

export enum IssueStatus {
  SUBMITTED = 'Submitted',
  IN_PROGRESS = 'In Progress',
  RESOLVED = 'Resolved',
  REJECTED = 'Rejected',
  ESCALATED = 'Escalated',
  MERGED = 'Merged'
}

export enum IssuePriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum EscalationLevel {
  VILLAGE_PRESIDENT = 'Village / City President',
  TALUK_OFFICE = 'Taluk Officer',
  DISTRICT_COLLECTOR = 'District Collector'
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  area?: string;
  village?: string;
  taluk?: string;
  district?: string;
}

export interface AdminAIAnalysis {
  mode?: 'live-ai' | 'demo-mode';
  modeLabel?: string;
  riskScore: number;
  fraudDetectionReasoning: string;
  predictedResolutionHours: number;
  priorityJustification: string;
  resourceComplexity: 'Simple' | 'Moderate' | 'Complex' | string;
  slaStatus: 'on-track' | 'at-risk' | 'violation' | string;
}

export interface AIAnalyzeResponse {
  mode: 'live-ai' | 'demo-mode';
  modeLabel: string;
  category: string;
  priority: string;
  department: string;
  summary: string;
  reasoning: string;
  duplicateCheck: {
    isDuplicate: boolean;
    parentId?: string | null;
    matches?: Array<{
      id: string;
      title: string;
      status: string;
      similarity: number;
      area: string;
    }>;
    reasoning: string;
  };
}

export interface ResolveChainEvent {
  timestamp: string;
  status: IssueStatus | string;
  action: string;
  remarks?: string;
  actor: string;
  actorRole?: string;
  tier?: EscalationLevel | string;
}

export interface Grievance {
  id: string;
  dbId?: number;
  trackingId?: string;
  dnaSignature: string;
  citizenName?: string;
  citizenEmail?: string;
  title: string;
  category: IssueCategory | string;
  description: string;
  image?: string;
  location: Location;
  status: IssueStatus | string;
  priority: IssuePriority | string;
  currentTier: EscalationLevel | string;
  assignedDepartment?: string;
  assignedAuthority?: string;
  createdAt: string;
  updatedAt: string;
  aiCategorized: boolean;
  aiMode?: 'live-ai' | 'demo-mode' | string;
  aiSummary?: string;
  aiSuggestedDepartment?: string;
  aiReasoning?: string;
  rating?: number;
  feedback?: string;
  upvotes: number;
  votedByMe?: boolean;
  isEmergency?: boolean;
  slaDeadline?: string;
  isAnonymous?: boolean;
  isSample?: boolean;
  parentCaseId?: string;
  resolveChain: ResolveChainEvent[];
}

export type UserRole = 'citizen' | 'admin' | 'authority';

export interface UserImpactLedger {
  reportsVerified: number;
  hoursSavedForCity: number;
  safetyContributionScore: number;
}

export interface User {
  id?: number;
  name?: string;
  email: string;
  role: UserRole;
  adminLevel?: EscalationLevel | string;
  authorityTier?: EscalationLevel | string;
  district?: string;
  taluk?: string;
  village?: string;
  points: number;
  trustScore: number;
  badges: string[];
  impactLedger?: UserImpactLedger;
}

export interface NotificationItem {
  id: number;
  trackingId?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  isRead: boolean;
  createdAt: string;
}

export interface AnalyticsData {
  scope: 'all' | 'live' | 'sample';
  counts: { live: number; sample: number };
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    escalated: number;
    resolved: number;
    highPriority: number;
  };
  byCategory: Array<{ category: string; count: number }>;
  monthlyStats: Array<{ label: string; submitted: number; resolved: number }>;
  authorityPerformance: Array<{
    tier: string;
    total: number;
    resolved: number;
    pending: number;
    resolutionRate: number;
  }>;
}
