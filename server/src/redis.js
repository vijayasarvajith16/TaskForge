const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;

// Singleton Redis clients — one for pub, one for sub (required by the adapter)
let pubClient = null;
let subClient = null;

/**
 * Create and return the shared pub/sub Redis clients.
 * Returns null if REDIS_URL is not configured (graceful degradation).
 */
function getRedisClients() {
  if (!REDIS_URL) return null;
  if (pubClient) return { pubClient, subClient };

  pubClient = new Redis(REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: null,   // required by the adapter — don't cap this
  });
  subClient = pubClient.duplicate(); 

  pubClient.on('error', (err) => console.error('[Redis pub] error:', err.message));
  subClient.on('error', (err) => console.error('[Redis sub] error:', err.message));

  return { pubClient, subClient };
}

/**
 * Attach the Redis adapter to a Socket.io server instance.
 * If no REDIS_URL is set, logs a warning and skips (single-instance mode).
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

  try {
    await Promise.all([
      clients.pubClient.ping(),
      clients.subClient.ping(),
    ]);
    io.adapter(createAdapter(clients.pubClient, clients.subClient));
    console.log('[Redis] Adapter connected —', REDIS_URL.replace(/:\/\/.*@/, '://***@'));
  } catch (err) {
    console.error('[Redis] Failed to connect adapter, falling back to in-memory:', err.message);
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
