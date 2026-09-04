const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

// Singleton Redis clients — one for pub, one for sub (required by the adapter)
let pubClient = null;
let subClient = null;
let connectionFailed = false;

/**
 * Create and return the shared pub/sub Redis clients.
 * Returns null if REDIS_URL is not configured or connection failed (graceful degradation).
 */
function getRedisClients() {
  if (!REDIS_URL || connectionFailed) return null;
  if (pubClient) return { pubClient, subClient };

  const isTls = REDIS_URL.startsWith('rediss://');

  const redisOptions = {
    maxRetriesPerRequest: null, // required by the adapter — don't cap this
    connectTimeout: 10000,      // 10s connection timeout for cloud instances
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying on repeated failures
      return Math.min(times * 200, 1000);
    },
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  };

  pubClient = new Redis(REDIS_URL, redisOptions);
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('[Redis pub] error:', err.message));
  subClient.on('error', (err) => console.error('[Redis sub] error:', err.message));

  return { pubClient, subClient };
}

/**
 * Attach the Redis adapter to a Socket.io server instance.
 * If no REDIS_URL is set or connection fails, logs a warning and falls back to in-memory mode.
 */
async function applyRedisAdapter(io) {
  const clients = getRedisClients();
  if (!clients) {
    console.warn(
      '[Redis] REDIS_URL not set — using in-memory adapter. ' +
      'Multi-instance broadcasts will NOT work. Set REDIS_URL to enable.'
    );
    return;
  }

  const TIMEOUT_MS = 10000;
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Redis ping timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
  );

  try {
    await Promise.race([
      Promise.all([clients.pubClient.ping(), clients.subClient.ping()]),
      timeout,
    ]);
    io.adapter(createAdapter(clients.pubClient, clients.subClient));
    console.log('[Redis] Adapter connected —', REDIS_URL.replace(/:\/\/.*@/, '://***@'));
  } catch (err) {
    console.error('[Redis] Failed to connect adapter, falling back to in-memory:', err.message);
    connectionFailed = true;
    // Destroy stuck clients so they don't keep retrying in the background
    try { clients.pubClient.disconnect(); } catch (_) {}
    try { clients.subClient.disconnect(); } catch (_) {}
    pubClient = null;
    subClient = null;
  }
}

// ── User → Socket map (Redis-backed) ───────────────────────────────────────
// Stored as a Redis set per user: key = "usersockets:<userId>"

/**
 * Register a socket ID for a user.
 */
async function setUserSocket(userId, socketId) {
  const clients = getRedisClients();
  if (!clients) return; // in-memory fallback not needed — socket rooms handle delivery
  try {
    await clients.pubClient.sadd(`usersockets:${userId}`, socketId);
    // Auto-expire after 24h in case disconnect event is missed
    await clients.pubClient.expire(`usersockets:${userId}`, 86400);
  } catch (err) {
    console.error('[Redis] setUserSocket error:', err.message);
  }
}

/**
 * Remove a socket ID for a user.
 */
async function removeUserSocket(userId, socketId) {
  const clients = getRedisClients();
  if (!clients) return;
  try {
    await clients.pubClient.srem(`usersockets:${userId}`, socketId);
  } catch (err) {
    console.error('[Redis] removeUserSocket error:', err.message);
  }
}

/**
 * Get all socket IDs for a user across all server instances.
 * Returns an empty array if Redis is not configured.
 */
async function getUserSocketIds(userId) {
  const clients = getRedisClients();
  if (!clients) return [];
  try {
    return await clients.pubClient.smembers(`usersockets:${userId}`);
  } catch (err) {
    console.error('[Redis] getUserSocketIds error:', err.message);
    return [];
  }
}

module.exports = { applyRedisAdapter, setUserSocket, removeUserSocket, getUserSocketIds };
