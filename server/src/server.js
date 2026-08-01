require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectDb } = require('./db');
const { initSockets, userSocketMap } = require('./sockets');
const { startEscalationJob, runEscalation, setSocketRefs } = require('./jobs/escalation');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const templateRoutes = require('./routes/templates');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// Socket.io with CORS for Vite dev server
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Attach io to app so routes can access it for broadcasting
app.set('io', io);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Manual escalation trigger (for testing/demo)
app.post('/api/escalation/run', async (_req, res) => {
  try {
    await runEscalation();
    res.json({ message: 'Escalation job ran successfully' });
  } catch (err) {
    console.error('Manual escalation error:', err);
    res.status(500).json({ error: 'Escalation failed' });
  }
});

// --- Start ---
const PORT = process.env.PORT || 3001;

async function start() {
  await connectDb(process.env.MONGODB_URI);
  initSockets(io);

  // Wire escalation job with Socket.io refs for live push
  setSocketRefs(io, userSocketMap);
  startEscalationJob();

  server.listen(PORT, () => console.log(`TaskForge API + Socket.io listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
