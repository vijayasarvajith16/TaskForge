import { useState, useEffect, useRef } from 'react';
import { Offcanvas, Badge, Form, Button, Spinner } from 'react-bootstrap';
import { Clock, User, Link2, MessageSquare, Activity, Send } from 'lucide-react';
import { getTaskDetail, addComment } from '../api';

export default function TaskDetailDrawer({ show, onHide, taskId, members, socket, boardId }) {
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('activity');
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (show && taskId) {
      loadDetail();
    }
  }, [show, taskId]);

  // Listen for live comments
  useEffect(() => {
    if (!socket || !taskId) return;

    const handler = ({ taskId: tId, comment }) => {
      if (tId === taskId) {
        setComments((prev) => {
          if (prev.some((c) => c._id === comment._id)) return prev;
          return [...prev, comment];
        });
      }
    };

    socket.on('comment_added', handler);
    return () => socket.off('comment_added', handler);
  }, [socket, taskId]);

  // Auto-scroll comments
  useEffect(() => {
    if (tab === 'comments') {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, tab]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await getTaskDetail(taskId);
      setTask(res.data.task);
      setActivity(res.data.activity);
      setComments(res.data.comments);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment(taskId, commentText.trim());
      setCommentText('');
    } catch {
      // ignore
    }
  };

  const getAssigneeName = () => {
    if (!task?.assignedTo) return 'Unassigned';
    const m = members?.find((m) => m._id.toString() === task.assignedTo.toString());
    return m?.name || 'Unknown';
  };

  const getUserName = (userId) => {
    const m = members?.find((m) => m._id.toString() === userId?.toString());
    return m?.name || 'Unknown';
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
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  const statusColors = {
    open: 'primary', in_progress: 'info', blocked: 'danger', done: 'success', locked: 'secondary',
  };

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: 440, borderLeft: '1px solid var(--tf-hairline)' }}>
      <Offcanvas.Header closeButton style={{ padding: '20px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
        <Offcanvas.Title style={{ fontSize: 18, fontWeight: 650, color: 'var(--tf-ink)' }}>Task Details</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="d-flex flex-column p-0">
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" style={{ color: 'var(--tf-ink)' }} size="sm" /></div>
        ) : !task ? (
          <div className="text-center text-muted py-5">Task not found</div>
        ) : (
          <>
            {/* Task info */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
              <h5 style={{ fontSize: 18, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 8 }}>{task.title}</h5>
              {task.description && <p style={{ fontSize: 13.5, color: 'var(--tf-text-muted)', marginBottom: 14 }}>{task.description}</p>}
              <div className="d-flex flex-wrap gap-2 mb-3">
                <span className="tf-chip" style={{ textTransform: 'capitalize' }}>
                  {task.status?.replace('_', ' ')}
                </span>
                {task.escalationLevel > 0 && (
                  <span className="tf-chip overdue">
                    Escalation L{task.escalationLevel}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--tf-text-muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span><User size={13} className="me-1" /> Assignee: <strong>{getAssigneeName()}</strong></span>
                {task.dueDate && (
                  <span><Clock size={13} className="me-1" /> Due: <strong>{new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                )}
                {task.dependsOn?.length > 0 && (
                  <span><Link2 size={13} className="me-1" /> Dependencies: <strong>{task.dependsOn.length} item{(task.dependsOn.length > 1 ? 's' : '')}</strong></span>
                )}
              </div>
            </div>

            {/* Segmented Control Tabs */}
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
              <div className="segmented-control-track" style={{ width: '100%' }}>
                <button
                  className={`segmented-control-item ${tab === 'activity' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setTab('activity')}
                >
                  <Activity size={13} className="me-1" /> Activity
                </button>
                <button
                  className={`segmented-control-item ${tab === 'comments' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setTab('comments')}
                >
                  <MessageSquare size={13} className="me-1" /> Comments ({comments.length})
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0, padding: '16px 24px' }}>
              {tab === 'activity' ? (
                <div>
                  {activity.length === 0 ? (
                    <p className="text-muted small text-center py-4">No activity yet</p>
                  ) : (
                    activity.map((a, i) => (
                      <div key={a._id?.toString() || i} className="d-flex gap-3 py-2 border-bottom border-light" style={{ fontSize: '0.85rem' }}>
                        <div
                          style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                            backgroundColor: a.action === 'completed' ? '#16a34a' : a.action === 'commented' ? '#0066ff' : a.action === 'moved' ? '#d97706' : '#707070',
                          }}
                        />
                        <div>
                          <span style={{ color: 'var(--tf-ink)', fontWeight: 500 }}>{a.detail}</span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--tf-text-muted)', marginTop: 2 }}>{formatTime(a.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column" style={{ minHeight: '100%' }}>
                  {comments.length === 0 ? (
                    <p className="text-muted small text-center py-4">No comments yet</p>
                  ) : (
                    comments.map((c, i) => (
                      <div key={c._id?.toString() || i} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--tf-ink)' }}>
                            {c.userName || getUserName(c.userId)}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--tf-text-muted)' }}>{formatTime(c.createdAt)}</span>
                        </div>
                        <div style={{ backgroundColor: 'var(--tf-canvas-soft)', padding: '10px 14px', borderRadius: 16, fontSize: '0.85rem', color: 'var(--tf-ink)' }}>
                          {c.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Comment input */}
            {tab === 'comments' && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--tf-hairline-soft)' }}>
                <Form onSubmit={handleComment} className="d-flex gap-2">
                  <Form.Control
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment…"
                  />
                  <Button variant="primary" type="submit" disabled={!commentText.trim()}>
                    <Send size={14} />
                  </Button>
                </Form>
              </div>
            )}
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
