import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import {
  DB_DRIVER,
  DbNotConfiguredError,
  checkDbHealth,
  execute,
  formatComplaintRow,
  initDatabase,
  queryAll,
  queryGet,
} from './db.mjs';
import {
  authenticateToken,
  hashPassword,
  optionalAuth,
  requireRole,
  signToken,
  verifyPassword,
} from './auth.mjs';
import {
  CATEGORY_TO_DEPT,
  analyzeComplaint,
  analyzeForAuthority,
  chatAssistant,
} from './ai.mjs';

const app = express();
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

const configuredOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      if (
        /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '8mb' }));

if (!IS_SERVERLESS) {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  app.use('/uploads', express.static(UPLOADS_DIR, { fallthrough: false }));
}

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

function saveImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  if (dataUrl.startsWith('/uploads/') || dataUrl.startsWith('https://')) return dataUrl;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Invalid image format. Only PNG, JPG, or WEBP images are allowed.');
  }
  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const maxBytes = IS_SERVERLESS ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error(`Image exceeds maximum ${IS_SERVERLESS ? '2 MB' : '5 MB'} file size.`);
  }
  if (IS_SERVERLESS) {
    // Store validated image safely inside persistent database on serverless hosts
    return dataUrl;
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const filename = `complaint-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

async function generateTrackingId() {
  const random = Math.floor(1000 + Math.random() * 9000);
  const candidate = `CC-${random}`;
  const exists = await queryGet('SELECT 1 AS found FROM complaints WHERE tracking_id = ?', [candidate]);
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

async function createNotification(userEmail, trackingId, title, message, type = 'info') {
  if (!userEmail) return;
  await execute(
    `INSERT INTO notifications (user_email, tracking_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [userEmail, trackingId, title, message, type, new Date().toISOString()]
  );
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
    points: Number(u.points || 0),
    trustScore: Number(u.trust_score || 80),
    badges: (() => {
      try {
        return JSON.parse(u.badges || '[]');
      } catch {
        return [];
      }
    })(),
  };
}

// Health check (reports DB connectivity & AI mode transparently)
app.get('/api/health', async (req, res) => {
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length >= 10);
  const dbHealth = await checkDbHealth();
  if (dbHealth.connected) {
    try {
      await initDatabase();
    } catch (err) {
      dbHealth.connected = false;
      dbHealth.error = err.message;
    }
  }
  res.status(dbHealth.connected ? 200 : 503).json({
    ok: dbHealth.connected,
    service: 'CivicConnect API',
    environment: IS_SERVERLESS ? 'vercel-serverless' : 'node-server',
    dbDriver: DB_DRIVER,
    dbConnected: dbHealth.connected,
    dbError: dbHealth.error || undefined,
    aiMode: aiConfigured ? 'live-ai' : 'demo-mode',
    timestamp: new Date().toISOString(),
  });
});

// Ensure database is initialized for all other API routes
app.use('/api', async (req, res, next) => {
  try {
    await initDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

// Auth: Register Citizen
app.post('/api/auth/register', async (req, res, next) => {
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

    const existing = await queryGet('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const now = new Date().toISOString();
    const info = await execute(
      `INSERT INTO users (name, email, password_hash, role, authority_tier, district, taluk, village, points, trust_score, badges, created_at)
       VALUES (?, ?, ?, 'citizen', NULL, ?, ?, ?, 100, 80, ?, ?)`,
      [cleanName, cleanEmail, hashPassword(password), district || 'Chennai', taluk || '', village || '', '["Newcomer"]', now],
      { returnId: true }
    );

    const created = await queryGet('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
    const userPayload = sanitizeUser(created);
    const token = signToken(userPayload);
    res.status(201).json({ user: userPayload, token });
  } catch (err) {
    next(err);
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password, portal } = req.body || {};
    const cleanEmail = (email || '').toLowerCase().trim();
    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRow = await queryGet('SELECT * FROM users WHERE email = ?', [cleanEmail]);
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
    next(err);
  }
});

// Auth: Current User
app.get('/api/auth/me', authenticateToken, async (req, res, next) => {
  try {
    const userRow = await queryGet('SELECT * FROM users WHERE email = ?', [req.user.email]);
    if (!userRow) return res.status(404).json({ error: 'User not found.' });
    const unreadRow = await queryGet(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_email = ? AND is_read = 0',
      [userRow.email]
    );
    res.json({ user: sanitizeUser(userRow), unreadNotifications: Number(unreadRow?.cnt || 0) });
  } catch (err) {
    next(err);
  }
});

// AI: Analyze complaint
app.post('/api/ai/analyze', async (req, res, next) => {
  try {
    const { title, description, category, location } = req.body || {};
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Please enter at least 10 characters in the description for AI analysis.' });
    }
    const existing = await queryAll('SELECT id, tracking_id, title, category, description, status, area, district FROM complaints');
    const analysis = await analyzeComplaint({ title, description, category, location }, existing);
    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// AI: Authority SLA analysis
app.post('/api/ai/admin-analyze', authenticateToken, requireRole('admin', 'authority'), async (req, res, next) => {
  try {
    const { trackingId } = req.body || {};
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ?', [trackingId]);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });
    const result = await analyzeForAuthority(row);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// AI: Chat assistant
app.post('/api/ai/chat', async (req, res, next) => {
  try {
    const { query } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query cannot be empty.' });
    }
    const reply = await chatAssistant(query);
    res.json(reply);
  } catch (err) {
    next(err);
  }
});

// Complaints: List
app.get('/api/complaints', optionalAuth, async (req, res, next) => {
  try {
    const { search = '', status = 'all', priority = 'all', category = 'all', tier = 'all', mine = 'false', dataMode = 'all' } = req.query;
    let rows = await queryAll('SELECT * FROM complaints ORDER BY created_at DESC, id DESC');

    if (mine === 'true' && req.user) {
      rows = rows.filter((r) => r.citizen_email === req.user.email);
    }
    if (dataMode === 'live') {
      rows = rows.filter((r) => Number(r.is_sample) === 0);
    } else if (dataMode === 'sample') {
      rows = rows.filter((r) => Number(r.is_sample) === 1);
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

    const formatted = await Promise.all(rows.map((r) => formatComplaintRow(r, req.user?.email)));
    res.json({ complaints: formatted });
  } catch (err) {
    next(err);
  }
});

// Complaints: Single by tracking_id or dna_signature
app.get('/api/complaints/:id', optionalAuth, async (req, res, next) => {
  try {
    const key = req.params.id;
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ? OR dna_signature = ?', [key, key]);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });
    res.json({ complaint: await formatComplaintRow(row, req.user?.email) });
  } catch (err) {
    next(err);
  }
});

// Complaints: Create
app.post('/api/complaints', authenticateToken, async (req, res, next) => {
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
      imageUrl = saveImage(image);
    }

    const existing = await queryAll('SELECT id, tracking_id, title, category, description, status, area, district FROM complaints');
    const aiResult = await analyzeComplaint(
      { title: title || '', description, category: category || '', location },
      existing
    );

    const finalCategory = category && category !== 'Auto' ? category : aiResult.category;
    const finalPriority = isEmergency ? 'Critical' : priority || aiResult.priority;
    const finalTitle = (title || '').trim() || `${finalCategory} reported in ${location.area || location.village || location.district || 'Municipal Zone'}`;
    const trackingId = await generateTrackingId();
    const dnaSignature = generateDnaSignature(location.district || location.area, finalCategory);
    const now = new Date().toISOString();
    const slaHours = getSlaHoursForPriority(finalPriority);
    const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();
    const department = aiResult.department || CATEGORY_TO_DEPT[finalCategory] || 'General Municipal Administration';

    const matchedAuth = await queryGet(
      `SELECT email FROM users WHERE role = 'authority' AND authority_tier = 'Village / City President' AND (LOWER(village) = LOWER(?) OR LOWER(district) = LOWER(?)) LIMIT 1`,
      [location.village || location.area || '', location.district || '']
    );
    const assignedAuthority = matchedAuth?.email || 'president@civicconnect.gov.in';

    const info = await execute(
      `INSERT INTO complaints (
        tracking_id, dna_signature, citizen_id, citizen_name, citizen_email, is_anonymous,
        title, category, description, image_url, latitude, longitude, address, area, village, taluk, district,
        status, priority, current_tier, assigned_department, assigned_authority,
        ai_categorized, ai_mode, ai_summary, ai_suggested_department, ai_reasoning, is_duplicate_of,
        sla_deadline, is_emergency, upvotes, is_sample, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, 'Village / City President', ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [
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
        now,
      ],
      { returnId: true }
    );

    const complaintId = info.lastInsertRowid;
    await execute(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        now,
        'Submitted',
        'Citizen submitted complaint',
        `Tracking ID ${trackingId} generated.`,
        isAnonymous ? 'Anonymous Citizen' : req.user.name || req.user.email,
        'citizen',
        'Village / City President',
      ]
    );
    await execute(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        complaintId,
        now,
        'Submitted',
        `AI triage (${aiResult.mode === 'live-ai' ? 'Gemini AI' : 'Demo Mode'})`,
        `Categorized as ${finalCategory} (${finalPriority} priority) → Routed to ${department} & Village / City President.`,
        'CivicConnect AI',
        'system',
        'Village / City President',
      ]
    );

    await execute('UPDATE users SET points = points + 25 WHERE email = ?', [req.user.email]);

    await createNotification(
      req.user.email,
      trackingId,
      `Complaint ${trackingId} Submitted`,
      `Your report "${finalTitle}" was prioritized as ${finalPriority} and routed to the Village / City President.`,
      'success'
    );
    await createNotification(
      assignedAuthority,
      trackingId,
      `New ${finalPriority} Priority Assignment: ${trackingId}`,
      `${finalTitle} (${location.area || location.district || 'Jurisdiction'}) requires review within SLA.`,
      finalPriority === 'Critical' ? 'alert' : 'info'
    );

    const created = await queryGet('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    res.status(201).json({
      complaint: await formatComplaintRow(created, req.user.email),
      aiAnalysis: aiResult,
    });
  } catch (err) {
    if (err.message?.includes('Invalid image') || err.message?.includes('exceeds maximum')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

// Upvote complaint
app.post('/api/complaints/:id/upvote', optionalAuth, async (req, res, next) => {
  try {
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    const voterKey = req.user?.email || req.ip || 'guest';
    const existing = await queryGet('SELECT 1 as found FROM complaint_upvotes WHERE complaint_id = ? AND user_email = ?', [
      row.id,
      voterKey,
    ]);
    if (existing) {
      await execute('DELETE FROM complaint_upvotes WHERE complaint_id = ? AND user_email = ?', [row.id, voterKey]);
      await execute('UPDATE complaints SET upvotes = CASE WHEN upvotes > 0 THEN upvotes - 1 ELSE 0 END WHERE id = ?', [row.id]);
    } else {
      await execute('INSERT INTO complaint_upvotes (complaint_id, user_email) VALUES (?, ?)', [row.id, voterKey]);
      await execute('UPDATE complaints SET upvotes = upvotes + 1 WHERE id = ?', [row.id]);
    }
    const updated = await queryGet('SELECT * FROM complaints WHERE id = ?', [row.id]);
    res.json({ complaint: await formatComplaintRow(updated, req.user?.email) });
  } catch (err) {
    next(err);
  }
});

// Citizen Feedback after resolution
app.post('/api/complaints/:id/feedback', authenticateToken, async (req, res, next) => {
  try {
    const { rating, feedback } = req.body || {};
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ?', [req.params.id]);
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
    await execute('UPDATE complaints SET rating = ?, feedback = ?, updated_at = ? WHERE id = ?', [
      numRating,
      (feedback || '').trim(),
      now,
      row.id,
    ]);
    await execute(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        now,
        'Resolved',
        `Citizen rated resolution ${numRating}/5`,
        (feedback || 'No written comment provided.').trim(),
        req.user.name || req.user.email,
        'citizen',
        row.current_tier,
      ]
    );

    const updated = await queryGet('SELECT * FROM complaints WHERE id = ?', [row.id]);
    res.json({ complaint: await formatComplaintRow(updated, req.user.email) });
  } catch (err) {
    next(err);
  }
});

// Admin Update
app.patch('/api/complaints/:id/admin', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const { priority, status, currentTier, assignedDepartment, assignedAuthority, remarks } = req.body || {};
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Complaint not found.' });

    const nextPriority = priority || row.priority;
    const nextStatus = status || row.status;
    const nextTier = currentTier || row.current_tier;
    const nextDept = assignedDepartment || row.assigned_department;
    const nextAuth = assignedAuthority !== undefined ? assignedAuthority : row.assigned_authority;
    const now = new Date().toISOString();

    await execute(
      `UPDATE complaints SET priority = ?, status = ?, current_tier = ?, assigned_department = ?, assigned_authority = ?, updated_at = ? WHERE id = ?`,
      [nextPriority, nextStatus, nextTier, nextDept, nextAuth, now, row.id]
    );

    const changes = [];
    if (priority && priority !== row.priority) changes.push(`Priority → ${priority}`);
    if (currentTier && currentTier !== row.current_tier) changes.push(`Assigned Tier → ${currentTier}`);
    if (assignedDepartment && assignedDepartment !== row.assigned_department) changes.push(`Dept → ${assignedDepartment}`);
    if (status && status !== row.status) changes.push(`Status → ${status}`);

    const actionText = changes.length > 0 ? `Admin Update: ${changes.join(' | ')}` : 'Admin Review & Remark';
    await execute(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, 'admin', ?)`,
      [row.id, now, nextStatus, actionText, (remarks || 'Updated by System Administrator').trim(), req.user.name || req.user.email, nextTier]
    );

    await createNotification(
      row.citizen_email,
      row.tracking_id,
      `Update on ${row.tracking_id}: ${nextStatus}`,
      `${actionText}${remarks ? ` — "${remarks}"` : ''}`,
      nextStatus === 'Resolved' ? 'success' : 'info'
    );

    const updated = await queryGet('SELECT * FROM complaints WHERE id = ?', [row.id]);
    res.json({ complaint: await formatComplaintRow(updated, req.user.email) });
  } catch (err) {
    next(err);
  }
});

// Government Authority Action
app.patch('/api/complaints/:id/authority', authenticateToken, requireRole('authority', 'admin'), async (req, res, next) => {
  try {
    const { actionType, remarks, status } = req.body || {};
    const row = await queryGet('SELECT * FROM complaints WHERE tracking_id = ?', [req.params.id]);
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

    await execute(`UPDATE complaints SET status = ?, current_tier = ?, updated_at = ? WHERE id = ?`, [
      nextStatus,
      nextTier,
      now,
      row.id,
    ]);

    await execute(
      `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        now,
        nextStatus,
        actionLabel,
        (remarks || 'Action recorded via Authority Portal').trim(),
        req.user.name || req.user.email,
        req.user.role,
        nextTier,
      ]
    );

    await createNotification(
      row.citizen_email,
      row.tracking_id,
      `${row.tracking_id}: ${actionLabel}`,
      remarks ? `${actionLabel} — Remarks: "${remarks}"` : `Your complaint ${row.tracking_id} status is now ${nextStatus}.`,
      nextStatus === 'Resolved' ? 'success' : nextStatus === 'Escalated' ? 'warning' : 'info'
    );

    const updated = await queryGet('SELECT * FROM complaints WHERE id = ?', [row.id]);
    res.json({ complaint: await formatComplaintRow(updated, req.user.email) });
  } catch (err) {
    next(err);
  }
});

// Auto-escalate overdue complaints
app.post('/api/complaints/auto-escalate', authenticateToken, requireRole('admin', 'authority'), async (req, res, next) => {
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const openRows = await queryAll(
      `SELECT * FROM complaints WHERE status NOT IN ('Resolved', 'Rejected') AND current_tier != 'District Collector'`
    );
    const overdue = openRows.filter((r) => new Date(r.sla_deadline).getTime() < nowMs);

    let escalatedCount = 0;
    for (const row of overdue) {
      const idx = TIER_ORDER.indexOf(row.current_tier);
      if (idx !== -1 && idx < TIER_ORDER.length - 1) {
        const nextTier = TIER_ORDER[idx + 1];
        await execute(`UPDATE complaints SET status = 'Escalated', current_tier = ?, updated_at = ? WHERE id = ?`, [
          nextTier,
          nowIso,
          row.id,
        ]);
        await execute(
          `INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier) VALUES (?, ?, 'Escalated', ?, ?, 'SLA Watchdog', 'system', ?)`,
          [row.id, nowIso, `Auto-escalated to ${nextTier}`, 'SLA deadline exceeded without resolution.', nextTier]
        );
        await createNotification(
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
  } catch (err) {
    next(err);
  }
});

// Notifications
app.get('/api/notifications', authenticateToken, async (req, res, next) => {
  try {
    const list = await queryAll(
      'SELECT * FROM notifications WHERE user_email = ? ORDER BY created_at DESC, id DESC LIMIT 50',
      [req.user.email]
    );
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
  } catch (err) {
    next(err);
  }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res, next) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_email = ?', [req.params.id, req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/notifications/read-all', authenticateToken, async (req, res, next) => {
  try {
    await execute('UPDATE notifications SET is_read = 1 WHERE user_email = ?', [req.user.email]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Analytics
app.get('/api/analytics', async (req, res, next) => {
  try {
    const scope = req.query.scope || 'all';
    let rows = await queryAll('SELECT * FROM complaints');
    const liveCount = rows.filter((r) => Number(r.is_sample) === 0).length;
    const sampleCount = rows.filter((r) => Number(r.is_sample) === 1).length;

    if (scope === 'live') rows = rows.filter((r) => Number(r.is_sample) === 0);
    else if (scope === 'sample') rows = rows.filter((r) => Number(r.is_sample) === 1);

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
  } catch (err) {
    next(err);
  }
});

// Contact form
app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    await execute('INSERT INTO contact_messages (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, ?)', [
      name.trim(),
      email.trim(),
      (subject || 'General Inquiry').trim(),
      message.trim(),
      new Date().toISOString(),
    ]);
    res.status(201).json({ ok: true, message: 'Inquiry recorded in municipal support queue.' });
  } catch (err) {
    next(err);
  }
});

// Unknown API route JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err instanceof DbNotConfiguredError) {
    return res.status(503).json({ error: err.message, code: 'DB_NOT_CONFIGURED' });
  }
  console.error('Unhandled API error:', err);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error.' });
});

export default app;
