require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectDb } = require('./db');
const { applyRedisAdapter } = require('./redis');
const { initSockets } = require('./sockets');
const { startEscalationJob, runEscalation, setSocketRefs } = require('./jobs/escalation');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const templateRoutes = require('./routes/templates');
const notificationRoutes = require('./routes/notifications');
const pollRoutes = require('./routes/polls');

const app = express();
const server = http.createServer(app);

// Allowed origins — add your Vercel URL via CLIENT_URL env var
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
];

// Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
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
app.use('/api', pollRoutes);

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

  // Wire Redis adapter before initSockets so all rooms use it
  await applyRedisAdapter(io);

  initSockets(io);

  // Wire escalation job with Socket.io for live push
  setSocketRefs(io);
  startEscalationJob();

  server.listen(PORT, () => console.log(`TaskForge API + Socket.io listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
