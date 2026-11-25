import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { db, initDatabase, formatComplaintRow } from './db.mjs';
import { hashPassword, verifyPassword, signToken, authenticateToken, optionalAuth, requireRole } from './auth.mjs';
import { analyzeComplaint, analyzeForAuthority, chatAssistant, CATEGORY_TO_DEPT } from './ai.mjs';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT || 5050);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: false }));

const TIER_ORDER = ['Village / City President', 'Taluk Officer', 'District Collector'];

function getSlaHoursForPriority(priority) {
  switch (priority) {
    case 'Critical':
      return 24;
    case 'High':
      return 72;
    case 'Low':
      return 240;
    case 'Medium':
    default:
      return 168;
  }
}

function saveBase64Image(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (dataUrl.startsWith('/uploads/')) return dataUrl;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Invalid image format. Only PNG, JPG, or WEBP images are allowed.');
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Image exceeds maximum 5 MB file size.');
  }
  const filename = `complaint-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

function generateTrackingId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  const candidate = `CC-${random}`;
  const exists = db.prepare('SELECT 1 FROM complaints WHERE tracking_id = ?').get(candidate);
  if (exists) {
    return `CC-${Math.floor(10000 + Math.random() * 89999)}`;
  }
  return candidate;
}

function generateDnaSignature(district = 'TN', category = 'CIV') {
  const d = (district || 'TN').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const c = (category || 'CIV').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X');
  const code = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `DNA-${d}-${code}-${c}`;
}

function createNotification(userEmail, trackingId, title, message, type = 'info') {
  if (!userEmail) return;
  db.prepare(
    `INSERT INTO notifications (user_email, tracking_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(userEmail, trackingId, title, message, type, new Date().toISOString());
}

function sanitizeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    adminLevel: u.authority_tier || undefined,
    authorityTier: u.authority_tier || undefined,
    district: u.district || undefined,
    taluk: u.taluk || undefined,
    village: u.village || undefined,
    points: u.points || 0,
    trustScore: u.trust_score || 80,
    badges: (() => {
      try {
        return JSON.parse(u.badges || '[]');
      } catch {
        return [];
      }
    })(),
  };
}

// Health check
app.get('/api/health', (req, res) => {
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10);
  res.json({
    ok: true,
    service: 'CivicConnect API',
    aiMode: aiConfigured ? 'live-ai' : 'demo-mode',
    timestamp: new Date().toISOString(),
  });
});

// Auth: Register Citizen
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, district, taluk, village } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanName = (name || '').trim();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, authority_tier, district, taluk, village, points, trust_score, badges, created_at)
         VALUES (?, ?, ?, 'citizen', NULL, ?, ?, ?, 100, 80, ?, ?)`
      )
      .run(cleanName, cleanEmail, hashPassword(password), district || 'Chennai', taluk || '', village || '', '["Newcomer"]', now);

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const userPayload = sanitizeUser(created);
    const token = signToken(userPayload);
    res.status(201).json({ user: userPayload, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Auth: Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, portal } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!userRow || !verifyPassword(password, userRow.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (portal === 'admin' && userRow.role !== 'admin') {
      return res.status(403).json({ error: 'This account does not have System Administrator privileges.' });
    }
    if (portal === 'authority' && userRow.role !== 'authority') {
      return res.status(403).json({ error: 'This account is not a Government Authority official.' });
    }
    if (portal === 'citizen' && userRow.role !== 'citizen') {
      return res.status(403).json({ error: 'Please use the Admin or Government Authority portal to sign in.' });
    }

    const userPayload = sanitizeUser(userRow);
    const token = signToken(userPayload);
    res.json({ user: userPayload, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication failed.' });
  }
});

// Auth: Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(req.user.email);
  if (!userRow) return res.status(404).json({ error: 'User not found.' });
  const unread = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE user_email = ? AND is_read = 0').get(userRow.email).cnt;
  res.json({ user: sanitizeUser(userRow), unreadNotifications: unread });
});

// AI: Analyze complaint
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { title, description, category, location } = req.body || {};
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Please enter at least 10 characters in the description for AI analysis.' });
    }
    const existing = db.prepare('SELECT id, tracking_id, title, category, description, status, area, district FROM complaints').all();
    const analysis = await analyzeComplaint({ title, description, category, location }, existing);
    res.json(analysis);
  } catch (err) {
    console.error('AI analyze error:', err);
    res.status(500).json({ error: 'AI analysis service error.' });
  }
});

// AI: Authority SLA analysis
app.post('/api/ai/admin-analyze', authenticateToken, requireRole('admin', 'authority'), async (req, res) => {
  try {
    const { trackingId } = req.body || {};
    const row = db.prepare('SELECT * FROM complaints WHERE tracking_id = ?').get(trackingId);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });
    const result = await analyzeForAuthority(row);
    res.json(result);
  } catch (err) {
    console.error('Admin AI error:', err);
    res.status(500).json({ error: 'Authority AI evaluation failed.' });
  }
});

// AI: Chat assistant
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query cannot be empty.' });
    }
    const reply = await chatAssistant(query);
    res.json(reply);
  } catch (err) {
    res.status(500).json({ error: 'AI assistant error.' });
  }
});

// Complaints: List
app.get('/api/complaints', optionalAuth, (req, res) => {
  try {
    const { search = '', status = 'all', priority = 'all', category = 'all', tier = 'all', mine = 'false', dataMode = 'all' } = req.query;
    let rows = db.prepare('SELECT * FROM complaints ORDER BY datetime(created_at) DESC, id DESC').all();

    if (mine === 'true' && req.user) {
      rows = rows.filter((r) => r.citizen_email === req.user.email);
    }
    if (dataMode === 'live') {
      rows = rows.filter((r) => r.is_sample === 0);
    } else if (dataMode === 'sample') {
      rows = rows.filter((r) => r.is_sample === 1);
    }

    if (status && status !== 'all') {
      if (status === 'pending') {
        rows = rows.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected');
      } else if (status === 'overdue') {
        const now = Date.now();
        rows = rows.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected' && new Date(r.sla_deadline).getTime() < now);
      } else {
        rows = rows.filter((r) => r.status.toLowerCase() === String(status).toLowerCase());
      }
    }
    if (priority && priority !== 'all') {
      rows = rows.filter((r) => r.priority.toLowerCase() === String(priority).toLowerCase());
    }
    if (category && category !== 'all') {
      rows = rows.filter((r) => r.category.toLowerCase() === String(category).toLowerCase());
    }
    if (tier && tier !== 'all') {
      rows = rows.filter((r) => r.current_tier === tier);
    }

    const q = String(search).toLowerCase().trim();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.tracking_id.toLowerCase().includes(q) ||
          r.dna_signature.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          (r.area || '').toLowerCase().includes(q) ||
          (r.district || '').toLowerCase().includes(q)
      );
    }

    const formatted = rows.map((r) => formatComplaintRow(r, req.user?.email));
    res.json({ complaints: formatted });
  } catch (err) {
    console.error('List complaints error:', err);
    res.status(500).json({ error: 'Failed to load complaints.' });
  }
});

// Complaints: Single by tracking_id or dna_signature
app.get('/api/complaints/:id', optionalAuth, (req, res) => {
  const key = req.params.id;
  const row = db
    .prepare('SELECT * FROM complaints WHERE tracking_id = ? OR dna_signature = ?')
    .get(key, key);
  if (!row) return res.status(404).json({ error: 'Complaint not found.' });
  res.json({ complaint: formatComplaintRow(row, req.user?.email) });
});

// Complaints: Create
app.post('/api/complaints', authenticateToken, async (req, res) => {
  try {
    const { title, category, priority, description, image, location, isAnonymous, isEmergency } = req.body || {};

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Issue description must be at least 10 characters.' });
    }
    if (!location || (!location.address && !location.district && (location.latitude === undefined || location.longitude === undefined))) {
      return res.status(400).json({ error: 'Please provide GPS coordinates or a manual location address.' });
    }

    let imageUrl = null;
    if (image) {
      imageUrl = saveBase64Image(image);
    }

    const existing = db.prepare('SELECT id, tracking_id, title, category, description, status, area, district FROM complaints').all();
    const aiResult = await analyzeComplaint(
      { title: title || '', description, category: category || '', location },
      existing
    );

    const finalCategory = category && category !== 'Auto' ? category : aiResult.category;
    const finalPriority = isEmergency ? 'Critical' : priority || aiResult.priority;
    const finalTitle = (title || '').trim() || `${finalCategory} reported in ${location.area || location.village || location.district || 'Municipal Zone'}`;
    const trackingId = generateTrackingId();
    const dnaSignature = generateDnaSignature(location.district || location.area, finalCategory);
    const now = new Date().toISOString();
    const slaHours = getSlaHoursForPriority(finalPriority);
    const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const department = aiResult.department || CATEGORY_TO_DEPT[finalCategory] || 'General Municipal Administration';

    // Find matching Village/City President authority in jurisdiction if available
    const matchedAuth = db
      .prepare(
        `SELECT email FROM users WHERE role = 'authority' AND authority_tier = 'Village / City President' AND (lower(village) = lower(?) OR lower(district) = lower(?)) LIMIT 1`
      )
      .get(location.village || location.area || '', location.district || '');
    const assignedAuthority = matchedAuth?.email || 'president@civicconnect.gov.in';

    const info = db
      .prepare(
        `INSERT INTO complaints (
          tracking_id, dna_signature, citizen_id, citizen_name, citizen_email, is_anonymous,
          title, category, description, image_url, latitude, longitude, address, area, village, taluk, district,
          status, priority, current_tier, assigned_department, assigned_authority,
          ai_categorized, ai_mode, ai_summary, ai_suggested_department, ai_reasoning, is_duplicate_of,
          sla_deadline, is_emergency, upvotes, is_sample, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, 'Village / City President', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
      )
      .run(
        trackingId,
        dnaSignature,
        req.user.id || null,
        req.user.name || req.user.email,
        req.user.email,
        isAnonymous ? 1 : 0,
        finalTitle,
        finalCategory,
        description.trim(),
        imageUrl,
        Number(location.latitude || 13.0827),
        Number(location.longitude || 80.2707),
        location.address || `${location.area || ''}, ${location.district || ''}`,
        location.area || location.village || 'Municipal Ward',
        location.village || location.area || '',
        location.taluk || '',
        location.district || 'Chennai',
        finalPriority,
        department,
        assignedAuthority,
        aiResult.mode,
        aiResult.summary,
        aiResult.department,
        aiResult.reasoning,
        aiResult.duplicateCheck?.parentId || null,
        slaDeadline,
        isEmergency ? 1 : 0,
        now,
        now
      );

    const complaintId = info.lastInsertRowid;
    const insertEvent = db.prepare(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertEvent.run(
      complaintId,
      now,
      'Submitted',
      'Citizen submitted complaint',
      `Tracking ID ${trackingId} generated.`,
      isAnonymous ? 'Anonymous Citizen' : req.user.name || req.user.email,
      'citizen',
      'Village / City President'
    );
    insertEvent.run(
      complaintId,
      now,
      'Submitted',
      `AI triage (${aiResult.mode === 'live-ai' ? 'Gemini AI' : 'Demo Mode'})`,
      `Categorized as ${finalCategory} (${finalPriority} priority) → Routed to ${department} & Village / City President.`,
      'CivicConnect AI',
      'system',
      'Village / City President'
    );

    // Reward citizen points
    db.prepare('UPDATE users SET points = points + 25 WHERE email = ?').run(req.user.email);

    // Notify citizen & authority
    createNotification(
      req.user.email,
      trackingId,
      `Complaint ${trackingId} Submitted`,
      `Your report "${finalTitle}" was prioritized as ${finalPriority} and routed to the Village / City President.`,
      'success'
    );
    createNotification(
      assignedAuthority,
      trackingId,
      `New ${finalPriority} Priority Assignment: ${trackingId}`,
      `${finalTitle} (${location.area || location.district || 'Jurisdiction'}) requires review within SLA.`,
      finalPriority === 'Critical' ? 'alert' : 'info'
    );

    const created = db.prepare('SELECT * FROM complaints WHERE id = ?').get(complaintId);
    res.status(201).json({
      complaint: formatComplaintRow(created, req.user.email),
      aiAnalysis: aiResult,
    });
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(400).json({ error: err.message || 'Failed to submit complaint.' });
  }
});

// Upvote complaint
app.post('/api/complaints/:id/upvote', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM complaints WHERE tracking_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Complaint not found.' });

  const voterKey = req.user?.email || req.ip || 'guest';
  const existing = db.prepare('SELECT 1 FROM complaint_upvotes WHERE complaint_id = ? AND user_email = ?').get(row.id, voterKey);
  if (existing) {
    db.prepare('DELETE FROM complaint_upvotes WHERE complaint_id = ? AND user_email = ?').run(row.id, voterKey);
    db.prepare('UPDATE complaints SET upvotes = MAX(0, upvotes - 1) WHERE id = ?').run(row.id);
  } else {
    db.prepare('INSERT INTO complaint_upvotes (complaint_id, user_email) VALUES (?, ?)').run(row.id, voterKey);
    db.prepare('UPDATE complaints SET upvotes = upvotes + 1 WHERE id = ?').run(row.id);
  }
  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(row.id);
  res.json({ complaint: formatComplaintRow(updated, req.user?.email) });
});

// Citizen Feedback after resolution
app.post('/api/complaints/:id/feedback', authenticateToken, (req, res) => {
  const { rating, feedback } = req.body || {};
  const row = db.prepare('SELECT * FROM complaints WHERE tracking_id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Complaint not found.' });
  if (row.status !== 'Resolved') {
    return res.status(400).json({ error: 'Feedback can only be submitted after the complaint is resolved.' });
  }
  if (req.user.role === 'citizen' && row.citizen_email !== req.user.email) {
    return res.status(403).json({ error: 'You can only rate your own submitted complaints.' });
  }
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE complaints SET rating = ?, feedback = ?, updated_at = ? WHERE id = ?').run(
    numRating,
    (feedback || '').trim(),
    now,
    row.id
  );
  db.prepare(
    `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    now,
    'Resolved',
    `Citizen rated resolution ${numRating}/5`,
    (feedback || 'No written comment provided.').trim(),
    req.user.name || req.user.email,
    'citizen',
    row.current_tier
  );

  const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(row.id);
  res.json({ complaint: formatComplaintRow(updated, req.user.email) });
});

// Admin Update (Priority, Assignment, Status, Remarks)
app.patch('/api/complaints/:id/admin', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { priority, status, currentTier, assignedDepartment, assignedAuthority, remarks } = req.body || {};
    const row = db.prepare('SELECT * FROM complaints WHERE tracking_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    const nextPriority = priority || row.priority;
    const nextStatus = status || row.status;
    const nextTier = currentTier || row.current_tier;
    const nextDept = assignedDepartment || row.assigned_department;
    const nextAuth = assignedAuthority !== undefined ? assignedAuthority : row.assigned_authority;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE complaints SET priority = ?, status = ?, current_tier = ?, assigned_department = ?, assigned_authority = ?, updated_at = ? WHERE id = ?`
    ).run(nextPriority, nextStatus, nextTier, nextDept, nextAuth, now, row.id);

    const changes = [];
    if (priority && priority !== row.priority) changes.push(`Priority → ${priority}`);
    if (currentTier && currentTier !== row.current_tier) changes.push(`Assigned Tier → ${currentTier}`);
    if (assignedDepartment && assignedDepartment !== row.assigned_department) changes.push(`Dept → ${assignedDepartment}`);
    if (status && status !== row.status) changes.push(`Status → ${status}`);

    const actionText = changes.length > 0 ? `Admin Update: ${changes.join(' | ')}` : 'Admin Review & Remark';
    db.prepare(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)`
    ).run(row.id, now, nextStatus, actionText, (remarks || 'Updated by System Administrator').trim(), req.user.name || req.user.email, nextTier);

    createNotification(
      row.citizen_email,
      row.tracking_id,
      `Update on ${row.tracking_id}: ${nextStatus}`,
      `${actionText}${remarks ? ` — "${remarks}"` : ''}`,
      nextStatus === 'Resolved' ? 'success' : 'info'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(row.id);
    res.json({ complaint: formatComplaintRow(updated, req.user.email) });
  } catch (err) {
    console.error('Admin update error:', err);
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
});

// Government Authority Action (Progress, Remarks, Resolve, Escalate)
app.patch('/api/complaints/:id/authority', authenticateToken, requireRole('authority', 'admin'), (req, res) => {
  try {
    const { actionType, remarks, status } = req.body || {};
    const row = db.prepare('SELECT * FROM complaints WHERE tracking_id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    if (req.user.role === 'authority' && row.current_tier !== req.user.authorityTier) {
      return res.status(403).json({
        error: `This complaint is currently at ${row.current_tier}. Only that tier or System Admin can modify it.`,
      });
    }

    const now = new Date().toISOString();
    let nextStatus = row.status;
    let nextTier = row.current_tier;
    let actionLabel = 'Authority Progress Update';

    if (actionType === 'escalate') {
      const idx = TIER_ORDER.indexOf(row.current_tier);
      if (idx === -1 || idx >= TIER_ORDER.length - 1) {
        return res.status(400).json({ error: 'Already at the highest authority tier (District Collector).' });
      }
      nextTier = TIER_ORDER[idx + 1];
      nextStatus = 'Escalated';
      actionLabel = `Escalated to ${nextTier}`;
    } else if (actionType === 'resolve') {
      nextStatus = 'Resolved';
      actionLabel = `Resolved by ${req.user.authorityTier || 'Authority'}`;
    } else if (actionType === 'reject') {
      if (!remarks || remarks.trim().length < 8) {
        return res.status(400).json({ error: 'Please provide at least 8 characters explaining the rejection.' });
      }
      nextStatus = 'Rejected';
      actionLabel = `Rejected by ${req.user.authorityTier || 'Authority'}`;
    } else {
      nextStatus = status || 'In Progress';
      actionLabel = `Progress Updated (${nextStatus})`;
    }

    db.prepare(`UPDATE complaints SET status = ?, current_tier = ?, updated_at = ? WHERE id = ?`).run(
      nextStatus,
      nextTier,
      now,
      row.id
    );

    db.prepare(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id,
      now,
      nextStatus,
      actionLabel,
      (remarks || 'Action recorded via Authority Portal').trim(),
      req.user.name || req.user.email,
      req.user.role,
      nextTier
    );

    createNotification(
      row.citizen_email,
      row.tracking_id,
      `${row.tracking_id}: ${actionLabel}`,
      remarks ? `${actionLabel} — Remarks: "${remarks}"` : `Your complaint ${row.tracking_id} status is now ${nextStatus}.`,
      nextStatus === 'Resolved' ? 'success' : nextStatus === 'Escalated' ? 'warning' : 'info'
    );

    const updated = db.prepare('SELECT * FROM complaints WHERE id = ?').get(row.id);
    res.json({ complaint: formatComplaintRow(updated, req.user.email) });
  } catch (err) {
    console.error('Authority update error:', err);
    res.status(500).json({ error: 'Failed to process authority action.' });
  }
});

// Auto-escalate overdue complaints
app.post('/api/complaints/auto-escalate', authenticateToken, requireRole('admin', 'authority'), (req, res) => {
  const nowIso = new Date().toISOString();
  const overdue = db
    .prepare(
      `SELECT * FROM complaints WHERE status NOT IN ('Resolved', 'Rejected') AND datetime(sla_deadline) < datetime(?) AND current_tier != 'District Collector'`
    )
    .all(nowIso);

  let escalatedCount = 0;
  for (const row of overdue) {
    const idx = TIER_ORDER.indexOf(row.current_tier);
    if (idx !== -1 && idx < TIER_ORDER.length - 1) {
      const nextTier = TIER_ORDER[idx + 1];
      db.prepare(`UPDATE complaints SET status = 'Escalated', current_tier = ?, updated_at = ? WHERE id = ?`).run(
        nextTier,
        nowIso,
        row.id
      );
      db.prepare(
        `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, 'Escalated', ?, ?, 'SLA Watchdog', 'system', ?)`
      ).run(row.id, nowIso, `Auto-escalated to ${nextTier}`, 'SLA deadline exceeded without resolution.', nextTier);

      createNotification(
        row.citizen_email,
        row.tracking_id,
        `${row.tracking_id} Auto-Escalated`,
        `Because the SLA deadline passed, your complaint was automatically escalated to ${nextTier}.`,
        'warning'
      );
      escalatedCount++;
    }
  }
  res.json({ escalatedCount });
});

// Notifications
app.get('/api/notifications', authenticateToken, (req, res) => {
  const list = db
    .prepare('SELECT * FROM notifications WHERE user_email = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 50')
    .all(req.user.email);
  res.json({
    notifications: list.map((n) => ({
      id: n.id,
      trackingId: n.tracking_id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: Boolean(n.is_read),
      createdAt: n.created_at,
    })),
  });
});

app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_email = ?').run(req.params.id, req.user.email);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_email = ?').run(req.user.email);
  res.json({ ok: true });
});

// Analytics (Live vs Sample clearly separated)
app.get('/api/analytics', (req, res) => {
  const scope = req.query.scope || 'all'; // 'all' | 'live' | 'sample'
  let rows = db.prepare('SELECT * FROM complaints').all();
  const liveCount = rows.filter((r) => r.is_sample === 0).length;
  const sampleCount = rows.filter((r) => r.is_sample === 1).length;

  if (scope === 'live') rows = rows.filter((r) => r.is_sample === 0);
  else if (scope === 'sample') rows = rows.filter((r) => r.is_sample === 1);

  const total = rows.length;
  const pending = rows.filter((r) => r.status === 'Submitted' || r.status === 'In Progress' || r.status === 'Escalated').length;
  const inProgress = rows.filter((r) => r.status === 'In Progress').length;
  const escalated = rows.filter((r) => r.status === 'Escalated').length;
  const resolved = rows.filter((r) => r.status === 'Resolved').length;
  const highPriority = rows.filter((r) => r.priority === 'High' || r.priority === 'Critical').length;

  const categoryMap = {};
  for (const r of rows) {
    categoryMap[r.category] = (categoryMap[r.category] || 0) + 1;
  }
  const byCategory = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthBuckets = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthBuckets[key] = { label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`, submitted: 0, resolved: 0 };
  }
  for (const r of rows) {
    const cd = new Date(r.created_at);
    const cKey = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`;
    if (monthBuckets[cKey]) monthBuckets[cKey].submitted++;
    if (r.status === 'Resolved') {
      const ud = new Date(r.updated_at);
      const uKey = `${ud.getFullYear()}-${String(ud.getMonth() + 1).padStart(2, '0')}`;
      if (monthBuckets[uKey]) monthBuckets[uKey].resolved++;
    }
  }
  const monthlyStats = Object.values(monthBuckets);

  const authorityPerformance = TIER_ORDER.map((tier) => {
    const tierRows = rows.filter((r) => r.current_tier === tier);
    const tierResolved = tierRows.filter((r) => r.status === 'Resolved').length;
    const tierPending = tierRows.length - tierResolved;
    return {
      tier,
      total: tierRows.length,
      resolved: tierResolved,
      pending: tierPending,
      resolutionRate: tierRows.length > 0 ? Math.round((tierResolved / tierRows.length) * 100) : 0,
    };
  });

  res.json({
    scope,
    counts: { live: liveCount, sample: sampleCount },
    summary: { total, pending, inProgress, escalated, resolved, highPriority },
    byCategory,
    monthlyStats,
    authorityPerformance,
  });
});

// Contact form
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  db.prepare('INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)').run(
    name.trim(),
    email.trim(),
    (subject || 'General Inquiry').trim(),
    message.trim(),
    new Date().toISOString()
  );
  res.status(201).json({ ok: true, message: 'Inquiry recorded in municipal support queue.' });
});

// Serve built frontend when dist/ exists in production mode
const DIST_DIR = path.resolve(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`CivicConnect API Server running on http://localhost:${PORT}`);
});
