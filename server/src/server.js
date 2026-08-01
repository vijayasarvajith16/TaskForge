require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { connectDb } = require('./db');
const { initSockets } = require('./sockets');

const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspaces');
const boardRoutes = require('./routes/boards');
const taskRoutes = require('./routes/tasks');
const templateRoutes = require('./routes/templates');

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

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// --- Start ---
const PORT = process.env.PORT || 3001;

async function start() {
  await connectDb(process.env.MONGODB_URI);
  initSockets(io);
  server.listen(PORT, () => console.log(`TaskForge API + Socket.io listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
