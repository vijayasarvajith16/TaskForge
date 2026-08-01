require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDb } = require('./db');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// --- Start ---
const PORT = process.env.PORT || 3001;

async function start() {
  await connectDb(process.env.MONGODB_URI);
  app.listen(PORT, () => console.log(`TaskForge API listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
