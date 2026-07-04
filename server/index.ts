import express from 'express';
import { initDb } from './db';
import authRoutes from './routes/auth';
import leaderboardRoutes from './routes/leaderboard';
import communityRoutes from './routes/community';
import usersRoutes from './routes/users';

const app = express();
const PORT = 3001;

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

async function start() {
  try {
    await initDb();
    console.log('Database initialized.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Delta Rush API running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
