const { getDb } = require('../db');

/**
 * Fire-and-forget webhook notification.
 * Never throws — delivery is best-effort.
 *
 * @param {string} workspaceId
 * @param {string} message  - plain-text message body
 * @param {object} options
 * @param {number}  [options.level]   - 1 or 2 for escalation colour coding
 * @param {'success'|'danger'} [options.color] - override embed colour
 */
function notifyWebhook(workspaceId, message, options = {}) {
  // Kick off asynchronously — caller is never blocked
  setImmediate(() => _send(workspaceId, message, options).catch((err) => {
    console.error('[Webhook] Unexpected error:', err.message);
  }));
}

async function _send(workspaceId, message, options) {
  let workspace;
  try {
    const { ObjectId } = require('mongodb');
    workspace = await getDb()
      .collection('workspaces')
      .findOne({ _id: new ObjectId(workspaceId) }, { projection: { webhookUrl: 1, webhookProvider: 1 } });
  } catch (err) {
    console.error('[Webhook] DB lookup failed:', err.message);
    return;
  }

  if (!workspace?.webhookUrl) return; // no-op when not configured

  const { webhookUrl, webhookProvider } = workspace;

  // Determine embed colour (Discord decimal, Slack hex-ish unused for now)
  let embedColor = 0x6366f1; // indigo default
  if (options.color === 'success' || options.level === undefined) embedColor = 0x22c55e; // green
  if (options.color === 'danger' || options.level === 2) embedColor = 0xef4444; // red
  if (options.level === 1) embedColor = 0xf59e0b; // amber

  let payload;
  if (webhookProvider === 'slack') {
    payload = {
      text: message,
    };
  } else {
    // Discord — use an embed for a richer look
    payload = {
      content: message,
      embeds: [{
        description: message,
        color: embedColor,
      }],
    };
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000), // 8 s hard timeout
    });
    if (!resp.ok) {
      console.error(`[Webhook] Delivery failed — HTTP ${resp.status} from ${webhookProvider}`);
    }
  } catch (err) {
    console.error(`[Webhook] POST failed (${webhookProvider}):`, err.message);
  }
}

module.exports = { notifyWebhook };
