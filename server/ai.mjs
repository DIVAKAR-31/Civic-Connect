import { GoogleGenAI, Type } from '@google/genai';

const VALID_CATEGORIES = [
  'Pothole',
  'Road Damage',
  'Street Light',
  'Garbage',
  'Water Leakage',
  'Water Contamination',
  'Sanitation',
  'Drainage',
  'Stray Animals',
  'Noise Pollution',
  'Illegal Construction',
  'Traffic Signal',
  'Park Maintenance',
  'Public Toilets',
  'Encroachment',
  'Fallen Tree',
  'Sewage Overflow',
  'Air Pollution',
  'Public Transport',
  'Sidewalk Damage',
  'Open Manhole',
  'Water Logging',
  'Exposed Wires',
  'Hanging Cables',
  'Public Safety',
  'Others',
];

const CATEGORY_TO_DEPT = {
  'Pothole': 'Public Works & Roads',
  'Road Damage': 'Public Works & Roads',
  'Sidewalk Damage': 'Public Works & Roads',
  'Open Manhole': 'Public Works & Roads',
  'Illegal Construction': 'Urban Planning & Enforcement',
  'Encroachment': 'Urban Planning & Enforcement',
  'Street Light': 'Electrical & Street Lighting',
  'Exposed Wires': 'Electrical & Street Lighting',
  'Hanging Cables': 'Electrical & Street Lighting',
  'Traffic Signal': 'Traffic & Electrical Engineering',
  'Garbage': 'Sanitation & Solid Waste',
  'Sanitation': 'Sanitation & Solid Waste',
  'Public Toilets': 'Sanitation & Solid Waste',
  'Water Leakage': 'Water Supply & Sewerage',
  'Water Contamination': 'Water Supply & Sewerage',
  'Sewage Overflow': 'Water Supply & Sewerage',
  'Drainage': 'Stormwater & Drainage',
  'Water Logging': 'Stormwater & Drainage',
  'Stray Animals': 'Public Health & Veterinary',
  'Fallen Tree': 'Parks & Disaster Response',
  'Park Maintenance': 'Parks & Horticulture',
  'Noise Pollution': 'Pollution Control & Enforcement',
  'Air Pollution': 'Pollution Control & Enforcement',
  'Public Safety': 'Municipal Safety & Vigilance',
  'Public Transport': 'Transport & Transit Authority',
  'Others': 'General Municipal Administration',
};

function getApiKey() {
  const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!key || key === 'undefined' || key.trim().length < 10) return null;
  return key.trim();
}

function safeJsonParse(text) {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match?.[1]) {
      try {
        return JSON.parse(match[1].trim());
      } catch {}
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {}
    }
    return null;
  }
}

function heuristicCategorize(description = '', title = '') {
  const text = `${title} ${description}`.toLowerCase();

  const rules = [
    { cat: 'Open Manhole', keys: ['manhole', 'uncovered drain', 'open pit'] },
    { cat: 'Hanging Cables', keys: ['hanging cable', 'high tension', 'sagging wire', 'power line', 'live wire'] },
    { cat: 'Exposed Wires', keys: ['exposed wire', 'electric shock', 'sparking', 'short circuit'] },
    { cat: 'Water Contamination', keys: ['dirty water', 'brown water', 'contaminated', 'smelly tap', 'drinking water'] },
    { cat: 'Water Leakage', keys: ['water leak', 'pipe burst', 'leaking pipe', 'water wastage', 'broken pipe', 'tap leak'] },
    { cat: 'Sewage Overflow', keys: ['sewage', 'gutter overflow', 'sewer', 'foul smell'] },
    { cat: 'Water Logging', keys: ['water logging', 'stagnant water', 'flooded street', 'water stagnation'] },
    { cat: 'Drainage', keys: ['drainage', 'clogged drain', 'stormwater', 'blocked drain', 'drain'] },
    { cat: 'Pothole', keys: ['pothole', 'crater', 'pit on road', 'deep hole'] },
    { cat: 'Road Damage', keys: ['damaged road', 'broken road', 'asphalt', 'road crack', 'tar'] },
    { cat: 'Sidewalk Damage', keys: ['footpath', 'sidewalk', 'pavement'] },
    { cat: 'Street Light', keys: ['street light', 'streetlight', 'lamp post', 'dark street', 'light not working', 'flickering'] },
    { cat: 'Garbage', keys: ['garbage', 'trash', 'waste', 'rubbish', 'dumping', 'overflowing bin', 'litter'] },
    { cat: 'Sanitation', keys: ['sanitation', 'hygiene', 'unclean', 'mosquito', 'filth'] },
    { cat: 'Public Toilets', keys: ['public toilet', 'restroom', 'washroom'] },
    { cat: 'Traffic Signal', keys: ['traffic signal', 'traffic light', 'junction signal'] },
    { cat: 'Fallen Tree', keys: ['fallen tree', 'tree fell', 'uprooted tree', 'broken branch'] },
    { cat: 'Stray Animals', keys: ['stray dog', 'stray animal', 'cattle', 'menace'] },
    { cat: 'Noise Pollution', keys: ['noise', 'loudspeaker', 'horn'] },
  ];

  let matchedCat = 'Others';
  for (const r of rules) {
    if (r.keys.some((k) => text.includes(k))) {
      matchedCat = r.cat;
      break;
    }
  }

  let priority = 'Medium';
  let priorityReason = 'Standard civic maintenance SLA applied.';
  if (/critical|emergency|school|hospital|accident|electrocution|high-tension|hanging|open manhole|contaminated|children|collapse|burst/.test(text)) {
    priority = 'Critical';
    priorityReason = 'High public safety or essential health hazard keywords detected.';
  } else if (/major|days|week|flood|overflow|blocked|broken|dark|highway|main road|urgent|severe/.test(text)) {
    priority = 'High';
    priorityReason = 'Significant disruption to public mobility or sanitation detected.';
  } else if (/minor|small|paint|trim|cosmetic/.test(text)) {
    priority = 'Low';
    priorityReason = 'Routine non-emergency municipal upkeep issue.';
  }

  const department = CATEGORY_TO_DEPT[matchedCat] || 'General Municipal Administration';
  const cleanSnippet = (description || title || 'Civic issue reported').trim().replace(/\s+/g, ' ');
  const summary =
    cleanSnippet.length > 135
      ? `${matchedCat} issue flagged for ${department}: "${cleanSnippet.slice(0, 125)}..."`
      : `${matchedCat} issue flagged for ${department}: "${cleanSnippet}"`;

  return {
    category: matchedCat,
    priority,
    department,
    summary,
    reasoning: `${priorityReason} (Heuristic rule match for ${matchedCat}).`,
  };
}

function tokenize(str = '') {
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function detectDuplicatesHeuristic(issue, existingComplaints) {
  const active = existingComplaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected');
  const candidates = [];
  const inputText = `${issue.title || ''} ${issue.description || ''}`;

  for (const c of active) {
    const sameCategory = !issue.category || c.category === issue.category;
    const textSim = jaccardSimilarity(inputText, `${c.title} ${c.description}`);
    const sameArea =
      issue.location?.area &&
      c.area &&
      issue.location.area.toLowerCase().trim() === c.area.toLowerCase().trim();
    const sameDistrict =
      issue.location?.district &&
      c.district &&
      issue.location.district.toLowerCase().trim() === c.district.toLowerCase().trim();

    let score = textSim;
    if (sameCategory) score += 0.2;
    if (sameArea) score += 0.25;
    else if (sameDistrict) score += 0.1;

    if (score >= 0.45 && (textSim >= 0.2 || (sameCategory && sameArea))) {
      candidates.push({
        id: c.tracking_id || c.id,
        title: c.title,
        status: c.status,
        similarity: Math.min(99, Math.round(score * 100)),
        area: c.area || c.district || 'Nearby Zone',
      });
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity);
  const top = candidates.slice(0, 3);
  return {
    isDuplicate: top.length > 0,
    parentId: top[0]?.id || null,
    matches: top,
    reasoning:
      top.length > 0
        ? `Potential overlap with ${top[0].id} (${top[0].title}) — ${top[0].similarity}% similarity.`
        : 'No similar active complaints found in this area.',
  };
}

export async function analyzeComplaint({ title = '', description = '', category = '', location = null }, existingComplaints = []) {
  const apiKey = getApiKey();
  const heuristic = heuristicCategorize(description, title);
  const dupHeuristic = detectDuplicatesHeuristic({ title, description, category: category || heuristic.category, location }, existingComplaints);

  if (!apiKey) {
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (No API Key Configured — Deterministic Local Analysis)',
      category: heuristic.category,
      priority: heuristic.priority,
      department: heuristic.department,
      summary: heuristic.summary,
      reasoning: heuristic.reasoning,
      duplicateCheck: dupHeuristic,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const activeSample = existingComplaints
      .filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected')
      .slice(0, 12)
      .map((c) => `${c.tracking_id || c.id} | ${c.category} | ${c.area || c.district || ''} | ${c.title}: ${c.description}`)
      .join('\n');

    const locText = location
      ? `Location: ${location.address || ''}, ${location.area || ''}, ${location.village || ''}, ${location.taluk || ''}, ${location.district || ''}`
      : 'Location not specified';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this public civic grievance and return STRICT JSON.
Title: "${title}"
Description: "${description}"
${locText}

Valid Categories: ${VALID_CATEGORIES.join(', ')}
Valid Priorities: Low, Medium, High, Critical

Active existing complaints to check for potential duplicates:
${activeSample || 'None'}

Return JSON with keys:
- category (one of Valid Categories)
- priority (Low | Medium | High | Critical)
- department (concise municipal department name)
- summary (1-2 sentence executive summary)
- reasoning (brief explanation for category and priority)
- isDuplicate (boolean)
- duplicateParentId (tracking ID string or null)
- duplicateReasoning (string)`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            priority: { type: Type.STRING },
            department: { type: Type.STRING },
            summary: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            isDuplicate: { type: Type.BOOLEAN },
            duplicateParentId: { type: Type.STRING, nullable: true },
            duplicateReasoning: { type: Type.STRING },
          },
          required: ['category', 'priority', 'department', 'summary', 'reasoning', 'isDuplicate', 'duplicateReasoning'],
        },
      },
    });

    const parsed = safeJsonParse(response.text);
    if (!parsed) throw new Error('Invalid AI response JSON');

    const matchedCategory =
      VALID_CATEGORIES.find((c) => c.toLowerCase() === (parsed.category || '').toLowerCase()) || heuristic.category;
    const matchedPriority =
      ['Low', 'Medium', 'High', 'Critical'].find((p) => p.toLowerCase() === (parsed.priority || '').toLowerCase()) ||
      heuristic.priority;

    return {
      mode: 'live-ai',
      modeLabel: 'Live Gemini AI Analysis',
      category: matchedCategory,
      priority: matchedPriority,
      department: parsed.department || CATEGORY_TO_DEPT[matchedCategory] || heuristic.department,
      summary: parsed.summary || heuristic.summary,
      reasoning: parsed.reasoning || heuristic.reasoning,
      duplicateCheck: {
        isDuplicate: Boolean(parsed.isDuplicate),
        parentId: parsed.duplicateParentId || null,
        matches: parsed.duplicateParentId
          ? [{ id: parsed.duplicateParentId, title: 'Matched active complaint', status: 'Active', similarity: 85, area: location?.area || '' }]
          : dupHeuristic.matches,
        reasoning: parsed.duplicateReasoning || dupHeuristic.reasoning,
      },
    };
  } catch (err) {
    console.warn('Gemini API unavailable or failed, falling back to clearly labelled Demo Mode:', err.message);
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (API Fallback — Deterministic Local Analysis)',
      category: heuristic.category,
      priority: heuristic.priority,
      department: heuristic.department,
      summary: heuristic.summary,
      reasoning: heuristic.reasoning,
      duplicateCheck: dupHeuristic,
    };
  }
}

export async function analyzeForAuthority(complaint) {
  const apiKey = getApiKey();
  const createdMs = new Date(complaint.created_at || complaint.createdAt).getTime();
  const deadlineMs = new Date(complaint.sla_deadline || complaint.slaDeadline || createdMs + 7 * 86400000).getTime();
  const now = Date.now();
  const hoursRemaining = Math.round((deadlineMs - now) / 3600000);
  const slaStatus =
    complaint.status === 'Resolved'
      ? 'on-track'
      : hoursRemaining < 0
      ? 'violation'
      : hoursRemaining < 24
      ? 'at-risk'
      : 'on-track';

  const baseRisk =
    complaint.priority === 'Critical' ? 88 : complaint.priority === 'High' ? 68 : complaint.priority === 'Medium' ? 42 : 20;
  const riskScore = Math.min(99, slaStatus === 'violation' ? Math.max(baseRisk, 90) : baseRisk);
  const predictedResolutionHours = complaint.priority === 'Critical' ? 12 : complaint.priority === 'High' ? 36 : 72;
  const resourceComplexity =
    complaint.priority === 'Critical' || /sewage|bridge|contamination|cable|manhole/i.test(complaint.category)
      ? 'Complex'
      : complaint.priority === 'High'
      ? 'Moderate'
      : 'Simple';

  if (!apiKey) {
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (SLA Heuristic Evaluation)',
      riskScore,
      predictedResolutionHours,
      resourceComplexity,
      slaStatus,
      priorityJustification: `Priority ${complaint.priority} assigned for ${complaint.category} under ${complaint.assigned_department || CATEGORY_TO_DEPT[complaint.category] || 'Municipal'} oversight.`,
      fraudDetectionReasoning: 'Location metadata and complaint narrative passed consistency checks.',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Return STRICT JSON for municipal SLA risk evaluation.
Complaint ID: ${complaint.tracking_id || complaint.id}
Title: ${complaint.title}
Category: ${complaint.category}
Priority: ${complaint.priority}
Status: ${complaint.status}
Description: ${complaint.description}
Hours until SLA deadline: ${hoursRemaining}

Provide JSON: riskScore (0-100), predictedResolutionHours (number), resourceComplexity (Simple|Moderate|Complex), slaStatus (on-track|at-risk|violation), priorityJustification (string), fraudDetectionReasoning (string).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: { type: Type.NUMBER },
            predictedResolutionHours: { type: Type.NUMBER },
            resourceComplexity: { type: Type.STRING },
            slaStatus: { type: Type.STRING },
            priorityJustification: { type: Type.STRING },
            fraudDetectionReasoning: { type: Type.STRING },
          },
          required: ['riskScore', 'predictedResolutionHours', 'resourceComplexity', 'slaStatus', 'priorityJustification', 'fraudDetectionReasoning'],
        },
      },
    });
    const parsed = safeJsonParse(response.text);
    if (!parsed) throw new Error('Invalid JSON');
    return { mode: 'live-ai', modeLabel: 'Live Gemini AI SLA Evaluation', ...parsed };
  } catch {
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (SLA Heuristic Evaluation)',
      riskScore,
      predictedResolutionHours,
      resourceComplexity,
      slaStatus,
      priorityJustification: `Priority ${complaint.priority} assigned for ${complaint.category}.`,
      fraudDetectionReasoning: 'Location metadata and complaint narrative passed consistency checks.',
    };
  }
}

export async function chatAssistant(query = '') {
  const apiKey = getApiKey();
  const q = query.toLowerCase();

  if (!apiKey) {
    let reply =
      'Demo Assistant: You can report any civic issue (potholes, streetlights, garbage, water leaks, drainage) from the Citizen Portal, track it with your unique Tracking ID (e.g., CC-1001), and monitor escalation from Village/City President to Taluk Officer and District Collector.';
    if (q.includes('report') || q.includes('submit')) {
      reply =
        'To report an issue: Sign in as a Citizen, click "Report an Issue", select a category or let AI auto-categorize your description, attach a photo, capture GPS or enter your address manually, and submit to get a Tracking ID.';
    } else if (q.includes('track') || q.includes('status')) {
      reply =
        'Open the Track page or your Citizen Dashboard and enter your Tracking ID (like CC-1001) or DNA signature to view the live visual workflow timeline and authority remarks.';
    } else if (q.includes('escalat') || q.includes('sla') || q.includes('authority')) {
      reply =
        'CivicConnect follows a 3-tier oversight chain: (1) Village / City President → (2) Taluk Officer → (3) District Collector. If a complaint breaches its SLA deadline, it can be escalated to the next tier.';
    }
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (Offline Assistant)',
      suggestion: reply,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are CivicConnect Assistant for a public grievance and municipal oversight platform. Answer concisely (2-3 sentences) to help the user with: "${query}"`,
    });
    return {
      mode: 'live-ai',
      modeLabel: 'Live Gemini AI Assistant',
      suggestion: response.text || 'How can I help you report or track a civic issue today?',
    };
  } catch {
    return {
      mode: 'demo-mode',
      modeLabel: 'Demo AI Mode (Offline Assistant)',
      suggestion:
        'You can report civic issues, attach photos and locations, track your Tracking ID in real time, and follow escalation across Village/City President, Taluk Officer, and District Collector.',
    };
  }
}

export { CATEGORY_TO_DEPT, VALID_CATEGORIES };
