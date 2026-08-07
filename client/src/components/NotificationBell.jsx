import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, Check } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import io from 'socket.io-client';

const formatTime = (dateStr) => {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
};

const cleanMessage = (msg) => msg.replace(/\[L\d\]\s*/, '');
const getLevel    = (msg) => { const m = msg.match(/\[L(\d)\]/); return m ? parseInt(m[1]) : 0; };

const LEVEL_COLORS = { 2: '#fc8181', 1: '#f5cd47', 0: 'var(--col-todo)' };

export default function NotificationBell({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const socketRef = useRef(null);
  const panelRef  = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (!token) return;
    const socket = io('http://localhost:3001', { auth: { token }, transports: ['websocket'] });
    socket.on('notification', (notif) => {
      setNotifications((p) => [notif, ...p]);
      setUnreadCount((p) => p + 1);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [token]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((p) => p.map((n) => n._id === id ? { ...n, read: true } : n));
      setUnreadCount((p) => Math.max(0, p - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((p) => p.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        className="tf-navbar-btn"
        onClick={() => setOpen(!open)}
        style={{ position: 'relative', padding: '0 10px' }}
        title="Notifications"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 3, right: 4,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', fontSize: 9, fontWeight: 700,
            width: 15, height: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, border: '1.5px solid var(--tf-navbar)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 42, zIndex: 300,
          width: 340, maxHeight: 420,
          background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
          borderRadius: 10, boxShadow: 'var(--tf-shadow-lg)',
          animation: 'dropDown 0.15s ease',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--tf-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text-strong)' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 700,
                  background: '#ef4444', color: '#fff',
                  borderRadius: 20, padding: '1px 7px',
                }}>
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--tf-accent)', fontSize: 11.5, fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--tf-text-muted)' }}>
                <Bell size={28} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, margin: 0 }}>No notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const level = getLevel(n.message);
                return (
                  <div
                    key={n._id}
                    onClick={() => !n.read && handleMarkRead(n._id)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--tf-border-soft)',
                      background: n.read ? 'transparent' : 'rgba(87,157,255,0.05)',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Level dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: LEVEL_COLORS[level] || LEVEL_COLORS[0],
                      flexShrink: 0, marginTop: 4,
                      boxShadow: `0 0 6px ${LEVEL_COLORS[level] || LEVEL_COLORS[0]}`,
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 12.5, lineHeight: 1.45, margin: '0 0 3px',
                        color: n.read ? 'var(--tf-text-muted)' : 'var(--tf-text-strong)',
                      }}>
                        {cleanMessage(n.message)}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--tf-text-muted)' }}>
                          {formatTime(n.createdAt)}
                        </span>
                        {level === 2 && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                            background: 'rgba(239,68,68,0.12)', color: '#fc8181',
                          }}>ESCALATED</span>
                        )}
                        {level === 1 && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 20,
                            background: 'rgba(245,205,71,0.12)', color: '#f5cd47',
                          }}>OVERDUE</span>
                        )}
                      </div>
                    </div>

                    {!n.read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--tf-accent)', flexShrink: 0, marginTop: 6,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
