import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.mjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'civicconnect.db');
export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('citizen', 'admin', 'authority')),
      authority_tier TEXT,
      district TEXT,
      taluk TEXT,
      village TEXT,
      points INTEGER DEFAULT 100,
      trust_score INTEGER DEFAULT 80,
      badges TEXT DEFAULT '["Newcomer"]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT NOT NULL UNIQUE,
      dna_signature TEXT NOT NULL UNIQUE,
      citizen_id INTEGER,
      citizen_name TEXT,
      citizen_email TEXT,
      is_anonymous INTEGER DEFAULT 0,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      latitude REAL DEFAULT 13.0827,
      longitude REAL DEFAULT 80.2707,
      address TEXT,
      area TEXT,
      village TEXT,
      taluk TEXT,
      district TEXT,
      status TEXT NOT NULL DEFAULT 'Submitted',
      priority TEXT NOT NULL DEFAULT 'Medium',
      current_tier TEXT NOT NULL DEFAULT 'Village / City President',
      assigned_department TEXT,
      assigned_authority TEXT,
      ai_categorized INTEGER DEFAULT 0,
      ai_mode TEXT DEFAULT 'demo-mode',
      ai_summary TEXT,
      ai_suggested_department TEXT,
      ai_reasoning TEXT,
      is_duplicate_of TEXT,
      sla_deadline TEXT NOT NULL,
      is_emergency INTEGER DEFAULT 0,
      upvotes INTEGER DEFAULT 0,
      rating INTEGER,
      feedback TEXT,
      is_sample INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      remarks TEXT,
      actor TEXT NOT NULL,
      actor_role TEXT,
      tier TEXT,
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      tracking_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaint_upvotes (
      complaint_id INTEGER NOT NULL,
      user_email TEXT NOT NULL,
      PRIMARY KEY (complaint_id, user_email),
      FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  if (userCount === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, authority_tier, district, taluk, village, points, trust_score, badges, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedUsers = [
      // Citizens
      ['Citizen Demo', 'user@civic.gov', hashPassword('password'), 'citizen', null, 'Chennai', 'Mambalam', 'Royapettah', 320, 88, '["Verified Citizen","Active Reporter"]', now],
      ['Rahul S.', 'rahul.citizen@civic.tn', hashPassword('Citizen@2026'), 'citizen', null, 'Chennai', 'Mambalam', 'Royapettah', 1450, 95, '["Diamond Citizen","Community Watch"]', now],
      ['Priya M.', 'priya.citizen@civic.tn', hashPassword('Citizen@2026'), 'citizen', null, 'Madurai', 'Madurai East', 'Keelavalavu', 1200, 92, '["Platinum Hero"]', now],
      ['Arjun K.', 'arjun.citizen@civic.tn', hashPassword('Citizen@2026'), 'citizen', null, 'Coimbatore', 'Pollachi', 'Anaikatti', 890, 86, '["Civic Sentinel"]', now],
      // System Admin
      ['Municipal System Admin', 'admin@civic.gov', hashPassword('admin123'), 'admin', 'System Administrator', null, null, null, 0, 100, '["State Oversight Admin"]', now],
      // Government Authorities (Tier 1: Village / City President)
      ['Village / City President (Demo)', 'president@civicconnect.gov.in', hashPassword('President@123'), 'authority', 'Village / City President', 'Chennai', 'Mambalam', 'Royapettah', 0, 100, '["Tier 1 Authority"]', now],
      ['Royapettah City President', 'president.royapettah@tn.gov', hashPassword('PresRoy@2026'), 'authority', 'Village / City President', 'Chennai', 'Mambalam', 'Royapettah', 0, 100, '["Tier 1 Authority"]', now],
      ['Keelavalavu Village President', 'president.keelavalavu@tn.gov', hashPassword('PresKvl@2026'), 'authority', 'Village / City President', 'Madurai', 'Madurai East', 'Keelavalavu', 0, 100, '["Tier 1 Authority"]', now],
      ['Anaikatti Village President', 'president.anaikatti@tn.gov', hashPassword('PresAna@2026'), 'authority', 'Village / City President', 'Coimbatore', 'Pollachi', 'Anaikatti', 0, 100, '["Tier 1 Authority"]', now],
      // Government Authorities (Tier 2: Taluk Officer)
      ['Taluk Officer (Demo)', 'taluk@civicconnect.gov.in', hashPassword('Taluk@123'), 'authority', 'Taluk Officer', 'Madurai', 'Madurai East', null, 0, 100, '["Tier 2 Authority"]', now],
      ['Madurai East Taluk Officer', 'taluk.madurai@tn.gov', hashPassword('TalukMad@2026'), 'authority', 'Taluk Officer', 'Madurai', 'Madurai East', null, 0, 100, '["Tier 2 Authority"]', now],
      ['Pollachi Taluk Officer', 'taluk.pollachi@tn.gov', hashPassword('TalukPol@2026'), 'authority', 'Taluk Officer', 'Coimbatore', 'Pollachi', null, 0, 100, '["Tier 2 Authority"]', now],
      ['Srirangam Taluk Officer', 'taluk.srirangam@tn.gov', hashPassword('TalukSri@2026'), 'authority', 'Taluk Officer', 'Tiruchirappalli', 'Srirangam', null, 0, 100, '["Tier 2 Authority"]', now],
      // Government Authorities (Tier 3: District Collector)
      ['District Collector (Demo)', 'collector@civicconnect.gov.in', hashPassword('Collector@123'), 'authority', 'District Collector', 'Coimbatore', null, null, 0, 100, '["Tier 3 Authority"]', now],
      ['Chennai District Collector', 'collector.chennai@tn.gov', hashPassword('Chn@2026'), 'authority', 'District Collector', 'Chennai', null, null, 0, 100, '["Tier 3 Authority"]', now],
      ['Madurai District Collector', 'collector.madurai@tn.gov', hashPassword('Mad@2026'), 'authority', 'District Collector', 'Madurai', null, null, 0, 100, '["Tier 3 Authority"]', now],
      ['Coimbatore District Collector', 'collector.coimbatore@tn.gov', hashPassword('Coimb@2026'), 'authority', 'District Collector', 'Coimbatore', null, null, 0, 100, '["Tier 3 Authority"]', now],
    ];

    for (const u of seedUsers) {
      insertUser.run(...u);
    }
  }

  const complaintCount = db.prepare('SELECT COUNT(*) as cnt FROM complaints').get().cnt;
  if (complaintCount === 0) {
    const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
    const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();
    const daysAgoDate = (d) => new Date(Date.now() - d * 86400 * 1000).toISOString();

    const insertComplaint = db.prepare(`
      INSERT INTO complaints (
        tracking_id, dna_signature, citizen_id, citizen_name, citizen_email, is_anonymous,
        title, category, description, image_url, latitude, longitude, address, area, village, taluk, district,
        status, priority, current_tier, assigned_department, assigned_authority,
        ai_categorized, ai_mode, ai_summary, ai_suggested_department, ai_reasoning,
        sla_deadline, is_emergency, upvotes, rating, feedback, is_sample, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEvent = db.prepare(`
      INSERT INTO complaint_events (complaint_id, timestamp, status, action, remarks, actor, actor_role, tier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleCases = [
      {
        tracking_id: 'CC-1001',
        dna: 'DNA-CHE-82X1-WATR',
        citizen_name: 'Citizen Demo',
        citizen_email: 'user@civic.gov',
        title: 'Severe water logging on Royapettah High Road',
        category: 'Water Logging',
        description: 'Post-rain water stagnation blocking two lanes on Royapettah High Road near the bus stop. Stormwater drains appear clogged.',
        lat: 13.0532,
        lng: 80.2625,
        address: 'Royapettah High Rd, Chennai',
        area: 'Royapettah',
        village: 'Royapettah',
        taluk: 'Mambalam',
        district: 'Chennai',
        status: 'In Progress',
        priority: 'High',
        tier: 'Village / City President',
        dept: 'Stormwater & Drainage',
        authority: 'president.royapettah@tn.gov',
        summary: 'Water logging blocking traffic on Royapettah High Road due to clogged stormwater drains.',
        reasoning: 'High priority due to commuter disruption and stagnant water hazard.',
        sla: hoursFromNow(48),
        upvotes: 142,
        created: hoursAgo(28),
        updated: hoursAgo(3),
        events: [
          [hoursAgo(28), 'Submitted', 'Citizen report filed', 'Logged with GPS coordinates.', 'Citizen Demo', 'citizen', 'Village / City President'],
          [hoursAgo(27), 'In Progress', 'AI triage completed & routed to City President', 'Priority set to High; assigned to Stormwater & Drainage.', 'CivicConnect AI (Demo)', 'system', 'Village / City President'],
          [hoursAgo(3), 'In Progress', 'Dewatering pump crew dispatched', 'Field engineers clearing clogged catch basin.', 'Royapettah City President', 'authority', 'Village / City President'],
        ],
      },
      {
        tracking_id: 'CC-1002',
        dna: 'DNA-CBE-93Y2-LITE',
        citizen_name: 'Arjun K.',
        citizen_email: 'arjun.citizen@civic.tn',
        title: '5 street lights non-functional near Anaikatti junction',
        category: 'Street Light',
        description: 'Series of 5 LED street lights have been completely dark for four nights near the Anaikatti village entrance, creating safety risks.',
        lat: 11.1042,
        lng: 76.7645,
        address: 'Main Village Rd, Anaikatti',
        area: 'Anaikatti',
        village: 'Anaikatti',
        taluk: 'Pollachi',
        district: 'Coimbatore',
        status: 'Submitted',
        priority: 'Medium',
        tier: 'Village / City President',
        dept: 'Electrical & Street Lighting',
        authority: 'president.anaikatti@tn.gov',
        summary: 'Outage of 5 street lights along Anaikatti village entrance.',
        reasoning: 'Medium priority electrical maintenance affecting evening pedestrian visibility.',
        sla: hoursFromNow(120),
        upvotes: 45,
        created: hoursAgo(14),
        updated: hoursAgo(14),
        events: [
          [hoursAgo(14), 'Submitted', 'Citizen report submitted', 'Awaiting inspection by Village President.', 'Arjun K.', 'citizen', 'Village / City President'],
        ],
      },
      {
        tracking_id: 'CC-1003',
        dna: 'DNA-MAD-44Z3-GARB',
        citizen_name: 'Priya M.',
        citizen_email: 'priya.citizen@civic.tn',
        title: 'Garbage pile-up near Keelavalavu community center',
        category: 'Garbage',
        description: 'Solid waste collection has not occurred for 4 days near the community center, causing foul odor and stray animal scavenging.',
        lat: 10.0245,
        lng: 78.4312,
        address: 'Panchayat Office St, Keelavalavu',
        area: 'Keelavalavu',
        village: 'Keelavalavu',
        taluk: 'Madurai East',
        district: 'Madurai',
        status: 'In Progress',
        priority: 'High',
        tier: 'Village / City President',
        dept: 'Sanitation & Solid Waste',
        authority: 'president.keelavalavu@tn.gov',
        summary: 'Four-day garbage accumulation near Keelavalavu community center.',
        reasoning: 'High priority sanitation risk due to multi-day accumulation.',
        sla: hoursFromNow(30),
        upvotes: 88,
        created: hoursAgo(48),
        updated: hoursAgo(4),
        events: [
          [hoursAgo(48), 'Submitted', 'Citizen report filed', 'Garbage overflow reported.', 'Priya M.', 'citizen', 'Village / City President'],
          [hoursAgo(4), 'In Progress', 'Sanitation compactor truck scheduled', 'Collection crew assigned for morning sweep.', 'Keelavalavu Village President', 'authority', 'Village / City President'],
        ],
      },
      {
        tracking_id: 'CC-1004',
        dna: 'DNA-MAD-99P2-WATR',
        citizen_name: 'Priya M.',
        citizen_email: 'priya.citizen@civic.tn',
        title: 'Potable water contamination in East Keelavalavu',
        category: 'Water Contamination',
        description: 'Municipal tap water appears brownish with a metallic odor across 30 households on Water Tank Street.',
        lat: 10.0285,
        lng: 78.435,
        address: 'Water Tank St, Keelavalavu',
        area: 'Keelavalavu',
        village: 'Keelavalavu',
        taluk: 'Madurai East',
        district: 'Madurai',
        status: 'Escalated',
        priority: 'Critical',
        tier: 'Taluk Officer',
        dept: 'Water Supply & Sewerage',
        authority: 'taluk.madurai@tn.gov',
        summary: 'Suspected potable water pipeline contamination affecting 30 households.',
        reasoning: 'Critical public health emergency affecting drinking water supply.',
        sla: hoursAgo(6),
        upvotes: 210,
        created: hoursAgo(72),
        updated: hoursAgo(8),
        events: [
          [hoursAgo(72), 'Submitted', 'Emergency complaint logged', 'Brown water supply reported.', 'Priya M.', 'citizen', 'Village / City President'],
          [hoursAgo(48), 'In Progress', 'Site inspected by Village President', 'Valve shut off pending lab water test.', 'Keelavalavu Village President', 'authority', 'Village / City President'],
          [hoursAgo(8), 'Escalated', 'Escalated to Taluk Officer', 'Requires Taluk water testing lab and pipeline replacement.', 'Keelavalavu Village President', 'authority', 'Taluk Officer'],
        ],
      },
      {
        tracking_id: 'CC-1005',
        dna: 'DNA-CBE-11L5-SAFE',
        citizen_name: 'Arjun K.',
        citizen_email: 'arjun.citizen@civic.tn',
        title: 'Sagging high-tension wires near primary school',
        category: 'Hanging Cables',
        description: 'High-tension power lines are sagging dangerously low over the pedestrian gate after high winds near Anaikatti Primary School.',
        lat: 11.109,
        lng: 76.769,
        address: 'Anaikatti Primary School Rd',
        area: 'Anaikatti',
        village: 'Anaikatti',
        taluk: 'Pollachi',
        district: 'Coimbatore',
        status: 'Escalated',
        priority: 'Critical',
        tier: 'District Collector',
        dept: 'Electrical & Street Lighting',
        authority: 'collector.coimbatore@tn.gov',
        summary: 'Hazardous low-hanging power cables outside primary school.',
        reasoning: 'Critical electrocution hazard in an active school zone.',
        sla: hoursAgo(12),
        upvotes: 340,
        created: hoursAgo(96),
        updated: hoursAgo(5),
        events: [
          [hoursAgo(96), 'Submitted', 'Emergency safety hazard filed', 'Sagging wires reported near school.', 'Arjun K.', 'citizen', 'Village / City President'],
          [hoursAgo(75), 'In Progress', 'Local EB shutdown requested', 'Temporary barricades placed.', 'Anaikatti Village President', 'authority', 'Village / City President'],
          [hoursAgo(48), 'Escalated', 'Escalated to Taluk Officer', 'SLA breached awaiting TNEB crew.', 'Anaikatti Village President', 'authority', 'Taluk Officer'],
          [hoursAgo(5), 'Escalated', 'Escalated to District Collector', 'Immediate District Collector intervention requested for school safety.', 'Pollachi Taluk Officer', 'authority', 'District Collector'],
        ],
      },
      {
        tracking_id: 'CC-1006',
        dna: 'DNA-CHN-55M1-ROAD',
        citizen_name: 'Rahul S.',
        citizen_email: 'rahul.citizen@civic.tn',
        title: 'Deep pothole causing traffic bottleneck on Mount Road',
        category: 'Pothole',
        description: 'Large crater-like pothole near Anna Salai signal causing sudden braking and two-wheeler skids.',
        lat: 13.0612,
        lng: 80.258,
        address: 'Anna Salai (Mount Road), Chennai',
        area: 'Royapettah',
        village: 'Royapettah',
        taluk: 'Mambalam',
        district: 'Chennai',
        status: 'Submitted',
        priority: 'High',
        tier: 'Village / City President',
        dept: 'Public Works & Roads',
        authority: 'president.royapettah@tn.gov',
        summary: 'Deep arterial pothole on Anna Salai creating vehicle hazard.',
        reasoning: 'High priority road safety issue on major arterial corridor.',
        sla: hoursFromNow(60),
        upvotes: 64,
        created: hoursAgo(6),
        updated: hoursAgo(6),
        events: [
          [hoursAgo(6), 'Submitted', 'Citizen report filed', 'Pothole logged with photo evidence.', 'Rahul S.', 'citizen', 'Village / City President'],
        ],
      },
      {
        tracking_id: 'CC-1007',
        dna: 'DNA-CHN-77R9-SAN',
        citizen_name: 'Citizen Demo',
        citizen_email: 'user@civic.gov',
        title: 'Broken drainage cover repaired on Cathedral Road',
        category: 'Drainage',
        description: 'Damaged concrete stormwater grate near Cathedral Road junction replaced and sealed.',
        lat: 13.049,
        lng: 80.254,
        address: 'Cathedral Rd, Royapettah, Chennai',
        area: 'Royapettah',
        village: 'Royapettah',
        taluk: 'Mambalam',
        district: 'Chennai',
        status: 'Resolved',
        priority: 'High',
        tier: 'Village / City President',
        dept: 'Stormwater & Drainage',
        authority: 'president.royapettah@tn.gov',
        summary: 'Broken stormwater drain cover replaced on Cathedral Road.',
        reasoning: 'Resolved within SLA after crew deployment.',
        sla: daysAgoDate(12),
        upvotes: 52,
        rating: 5,
        feedback: 'Replaced within 36 hours! Great coordination and prompt update.',
        created: daysAgoDate(18),
        updated: daysAgoDate(16),
        events: [
          [daysAgoDate(18), 'Submitted', 'Citizen report filed', 'Broken drain cover reported.', 'Citizen Demo', 'citizen', 'Village / City President'],
          [daysAgoDate(17), 'In Progress', 'Public Works crew assigned', 'New precast slab ordered.', 'Royapettah City President', 'authority', 'Village / City President'],
          [daysAgoDate(16), 'Resolved', 'Repair completed & verified', 'New reinforced drain cover installed and inspected.', 'Royapettah City President', 'authority', 'Village / City President'],
        ],
      },
      {
        tracking_id: 'CC-1008',
        dna: 'DNA-MAD-22W4-LEAK',
        citizen_name: 'Priya M.',
        citizen_email: 'priya.citizen@civic.tn',
        title: 'Main water pipeline leakage fixed near Market St',
        category: 'Water Leakage',
        description: 'Continuous clean water leakage from underground distribution joint near Keelavalavu Market Street.',
        lat: 10.022,
        lng: 78.429,
        address: 'Market St, Keelavalavu, Madurai',
        area: 'Keelavalavu',
        village: 'Keelavalavu',
        taluk: 'Madurai East',
        district: 'Madurai',
        status: 'Resolved',
        priority: 'Medium',
        tier: 'Taluk Officer',
        dept: 'Water Supply & Sewerage',
        authority: 'taluk.madurai@tn.gov',
        summary: 'Underground water joint leakage repaired at Market Street.',
        reasoning: 'Resolved at Taluk engineering level.',
        sla: daysAgoDate(35),
        upvotes: 39,
        rating: 4,
        feedback: 'Leakage stopped completely after gasket replacement.',
        created: daysAgoDate(42),
        updated: daysAgoDate(39),
        events: [
          [daysAgoDate(42), 'Submitted', 'Citizen report filed', 'Pipeline leak reported.', 'Priya M.', 'citizen', 'Village / City President'],
          [daysAgoDate(40), 'Escalated', 'Escalated to Taluk Water Division', 'Needed specialized clamp equipment.', 'Keelavalavu Village President', 'authority', 'Taluk Officer'],
          [daysAgoDate(39), 'Resolved', 'Pipeline joint sealed', 'Pressure restored and road patched.', 'Madurai East Taluk Officer', 'authority', 'Taluk Officer'],
        ],
      },
      {
        tracking_id: 'CC-1009',
        dna: 'DNA-TRI-33S8-DRAI',
        citizen_name: 'Kavitha R.',
        citizen_email: 'user@civic.gov',
        title: 'Sewage overflow near Srirangam South Street',
        category: 'Sewage Overflow',
        description: 'Sewage manhole overflowing onto pedestrian walkway near Srirangam South Street.',
        lat: 10.862,
        lng: 78.689,
        address: 'Srirangam South St, Tiruchirappalli',
        area: 'Srirangam',
        village: 'Srirangam Central',
        taluk: 'Srirangam',
        district: 'Tiruchirappalli',
        status: 'Resolved',
        priority: 'High',
        tier: 'District Collector',
        dept: 'Water Supply & Sewerage',
        authority: 'collector.madurai@tn.gov',
        summary: 'Major sewer blockage cleared via jetting tanker.',
        reasoning: 'Resolved after multi-tier escalation.',
        sla: daysAgoDate(60),
        upvotes: 175,
        rating: 5,
        feedback: 'Sanitation jetting team cleared the block and disinfected the street.',
        created: daysAgoDate(68),
        updated: daysAgoDate(64),
        events: [
          [daysAgoDate(68), 'Submitted', 'Citizen report filed', 'Sewage overflow logged.', 'Kavitha R.', 'citizen', 'Village / City President'],
          [daysAgoDate(66), 'Escalated', 'Escalated to Taluk Officer', 'Requires suction jetting vehicle.', 'Srirangam Ward Lead', 'authority', 'Taluk Officer'],
          [daysAgoDate(64), 'Resolved', 'Blockage cleared & sanitized', 'Jetting completed and lime disinfection applied.', 'Srirangam Taluk Officer', 'authority', 'Taluk Officer'],
        ],
      },
    ];

    for (const c of sampleCases) {
      const info = insertComplaint.run(
        c.tracking_id,
        c.dna,
        null,
        c.citizen_name,
        c.citizen_email,
        0,
        c.title,
        c.category,
        c.description,
        null,
        c.lat,
        c.lng,
        c.address,
        c.area,
        c.village,
        c.taluk,
        c.district,
        c.status,
        c.priority,
        c.tier,
        c.dept,
        c.authority,
        1,
        'demo-mode',
        c.summary,
        c.dept,
        c.reasoning,
        c.sla,
        c.priority === 'Critical' ? 1 : 0,
        c.upvotes,
        c.rating || null,
        c.feedback || null,
        1,
        c.created,
        c.updated
      );
      const complaintId = info.lastInsertRowid;
      for (const ev of c.events) {
        insertEvent.run(complaintId, ev[0], ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]);
      }
    }

    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_email, tracking_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertNotif.run(
      'user@civic.gov',
      'CC-1001',
      'Dewatering Crew Dispatched',
      'Royapettah City President updated CC-1001 to In Progress: Field engineers clearing clogged catch basin.',
      'info',
      0,
      hoursAgo(3)
    );
    insertNotif.run(
      'user@civic.gov',
      'CC-1007',
      'Complaint Resolved — Feedback Received',
      'CC-1007 (Broken drainage cover repaired) has been marked Resolved. Thank you for rating 5/5!',
      'success',
      1,
      daysAgoDate(16)
    );
  }
}

export function formatComplaintRow(row, userEmail = null) {
  if (!row) return null;
  const events = db
    .prepare('SELECT timestamp, status, action, remarks, actor, actor_role as actorRole, tier FROM complaint_events WHERE complaint_id = ? ORDER BY id ASC')
    .all(row.id);

  let votedByMe = false;
  if (userEmail) {
    const vote = db
      .prepare('SELECT 1 FROM complaint_upvotes WHERE complaint_id = ? AND user_email = ?')
      .get(row.id, userEmail);
    votedByMe = Boolean(vote);
  }

  return {
    id: row.tracking_id,
    dbId: row.id,
    trackingId: row.tracking_id,
    dnaSignature: row.dna_signature,
    citizenName: row.is_anonymous ? 'Anonymous Citizen' : row.citizen_name,
    citizenEmail: row.is_anonymous ? undefined : row.citizen_email,
    isAnonymous: Boolean(row.is_anonymous),
    title: row.title,
    category: row.category,
    description: row.description,
    image: row.image_url || undefined,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      address: row.address || '',
      area: row.area || '',
      village: row.village || '',
      taluk: row.taluk || '',
      district: row.district || '',
    },
    status: row.status,
    priority: row.priority,
    currentTier: row.current_tier,
    assignedDepartment: row.assigned_department,
    assignedAuthority: row.assigned_authority,
    aiCategorized: Boolean(row.ai_categorized),
    aiMode: row.ai_mode || 'demo-mode',
    aiSummary: row.ai_summary || '',
    aiSuggestedDepartment: row.ai_suggested_department || '',
    aiReasoning: row.ai_reasoning || '',
    parentCaseId: row.is_duplicate_of || undefined,
    slaDeadline: row.sla_deadline,
    isEmergency: Boolean(row.is_emergency),
    upvotes: row.upvotes || 0,
    votedByMe,
    rating: row.rating || undefined,
    feedback: row.feedback || undefined,
    isSample: Boolean(row.is_sample),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolveChain: events,
  };
}
