import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import app from './app.mjs';
import { initDatabase } from './db.mjs';

const PORT = Number(process.env.PORT || 5050);

// Serve built frontend when running standalone in production
const DIST_DIR = path.resolve(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`CivicConnect API Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
