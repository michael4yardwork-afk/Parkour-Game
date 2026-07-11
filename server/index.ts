import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { initDb } from './db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import communityRoutes from './routes/community';
import usersRoutes from './routes/users';
import { setupWebSocketServer } from './ws';

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '5mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/users', usersRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built frontend — process.cwd() is always the project root on both
// Hostinger (node server.cjs) and Replit (node server.cjs via npm run server)
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  // Bind to port FIRST so Hostinger's startup health check never times out
  setupWebSocketServer(httpServer);
  await new Promise<void>(resolve => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Delta Rush server running on http://0.0.0.0:${PORT}`);
      resolve();
    });
  });

  // Init DB after port is open — a slow or failed DB connection won't cause 503
  if (!process.env.DATABASE_URL) {
    console.error('WARNING: DATABASE_URL is not set. Database features will not work.');
    return;
  }
  try {
    await initDb();
    console.log('Database initialized.');
  } catch (err) {
    console.error('Database initialization failed (server still running):', err);
  }
}

start();
