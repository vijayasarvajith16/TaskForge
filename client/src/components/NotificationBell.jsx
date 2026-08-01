import { useState, useEffect, useRef, useCallback } from 'react';
import { Badge, Dropdown } from 'react-bootstrap';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';
import io from 'socket.io-client';

export default function NotificationBell({ token }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [show, setShow] = useState(false);
  const socketRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // Silently ignore
    }
  }, []);

  // Initial load + poll every 30s
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Socket.io listener for live notifications
  useEffect(() => {
    if (!token) return;

    const socket = io('http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently ignore
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString();
  };

  // Strip the [L1]/[L2] marker for display
  const cleanMessage = (msg) => msg.replace(/\[L\d\]\s*/, '');

  const getLevel = (msg) => {
    const match = msg.match(/\[L(\d)\]/);
    return match ? parseInt(match[1]) : 0;
  };

  return (
    <Dropdown show={show} onToggle={(open) => setShow(open)} align="end">
      <Dropdown.Toggle
        as="div"
        style={{ cursor: 'pointer', position: 'relative', padding: '4px 8px' }}
        onClick={() => setShow(!show)}
      >
        <Bell size={18} className="text-light" />
        {unreadCount > 0 && (
          <Badge
            bg="danger"
            pill
            className="position-absolute"
            style={{
              top: -2,
              right: 0,
              fontSize: '0.6rem',
              minWidth: 16,
              lineHeight: '14px',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="bg-dark border-secondary shadow-lg p-0"
        style={{ width: 360, maxHeight: 420, overflowY: 'auto' }}
      >
        {/* Header */}
        <div
          className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom border-secondary"
          style={{ position: 'sticky', top: 0, backgroundColor: '#1e1e2e', zIndex: 1 }}
        >
          <span className="fw-semibold text-light small">Notifications</span>
          {unreadCount > 0 && (
            <span
              className="text-primary small"
              style={{ cursor: 'pointer', fontSize: '0.75rem' }}
              onClick={handleMarkAllRead}
            >
              <CheckCheck size={12} className="me-1" />
              Mark all read
            </span>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="text-center text-secondary py-4 small">
            <Bell size={24} className="mb-2 d-block mx-auto" style={{ opacity: 0.3 }} />
            No notifications
          </div>
        ) : (
          notifications.map((n) => {
            const level = getLevel(n.message);
            return (
              <div
                key={n._id}
                className="px-3 py-2 border-bottom border-secondary d-flex align-items-start gap-2"
                style={{
                  cursor: 'pointer',
                  backgroundColor: n.read ? 'transparent' : 'rgba(99, 102, 241, 0.06)',
                  transition: 'background-color 0.15s',
                }}
                onClick={() => !n.read && handleMarkRead(n._id)}
              >
                {/* Level indicator */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: level === 2 ? '#ef4444' : level === 1 ? '#f59e0b' : '#6366f1',
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
                <div className="flex-grow-1">
                  <div
                    className="small"
                    style={{
                      color: n.read ? '#888' : '#e0e0e0',
                      fontSize: '0.8rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {cleanMessage(n.message)}
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.65rem' }}>
                    <span className="text-secondary">{formatTime(n.createdAt)}</span>
                    {level === 2 && <Badge bg="danger" style={{ fontSize: '0.55rem' }}>Escalated</Badge>}
                    {level === 1 && <Badge bg="warning" text="dark" style={{ fontSize: '0.55rem' }}>Overdue</Badge>}
                  </div>
                </div>
                {!n.read && (
                  <Check size={14} className="text-primary flex-shrink-0" style={{ marginTop: 4 }} />
                )}
              </div>
            );
          })
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}
