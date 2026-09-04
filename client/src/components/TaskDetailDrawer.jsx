import { useState, useEffect, useRef } from 'react';
import { Offcanvas, Spinner } from 'react-bootstrap';
import { Clock, User, Link2, MessageSquare, Activity, Send, ShieldAlert } from 'lucide-react';
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

  const issueId = task?._id ? `TF-${task._id.toString().slice(-4).toUpperCase()}` : 'TF-ISSUE';

  return (
    <Offcanvas show={show} onHide={onHide} placement="end" style={{ width: 460, borderLeft: '1px solid var(--tf-hairline)' }}>
      <Offcanvas.Header closeButton style={{ padding: '18px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="tf-badge-id">{issueId}</span>
          <Offcanvas.Title style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)' }}>
            Issue Inspector.
          </Offcanvas.Title>
        </div>
      </Offcanvas.Header>

      <Offcanvas.Body className="d-flex flex-column p-0">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" style={{ color: 'var(--tf-ink)' }} size="sm" />
          </div>
        ) : !task ? (
          <div className="text-center text-muted py-5">Issue not found</div>
        ) : (
          <>
            {/* ── Issue Core Info ── */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
              <h4 style={{ fontSize: 17, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 8, lineHeight: 1.3 }}>
                {task.title}
              </h4>
              {task.description && (
                <p style={{ fontSize: 13.5, color: 'var(--tf-text-muted)', marginBottom: 14, lineHeight: 1.45 }}>
                  {task.description}
                </p>
              )}

              {/* Status & Escalation Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                <span className="tf-chip" style={{ textTransform: 'capitalize' }}>
                  {task.status?.replace('_', ' ')}
                </span>
                {task.escalationLevel > 0 && (
                  <span className="tf-chip overdue" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ShieldAlert size={12} />
                    Escalation L{task.escalationLevel}
                  </span>
                )}
              </div>

              {/* IT Issue Metadata List */}
              <div style={{
                background: 'var(--tf-canvas-soft)',
                border: '1px solid var(--tf-hairline-soft)',
                borderRadius: 'var(--tf-radius-sm)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                fontSize: 12.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--tf-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <User size={13} /> Assignee
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--tf-ink)' }}>{getAssigneeName()}</span>
                </div>

                {task.dueDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--tf-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={13} /> Due Date
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--tf-ink)' }}>
                      {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                {task.dependsOn?.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--tf-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Link2 size={13} /> Dependencies
                    </span>
                    <span className="tf-mono" style={{ fontWeight: 600, color: 'var(--tf-accent)' }}>
                      {task.dependsOn.length} item{task.dependsOn.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Segmented Control Tabs (Activity / Comments) ── */}
            <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--tf-hairline-soft)' }}>
              <div className="segmented-control-track" style={{ width: '100%' }}>
                <button
                  className={`segmented-control-item ${tab === 'activity' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setTab('activity')}
                >
                  <Activity size={12} className="me-1" /> Activity
                </button>
                <button
                  className={`segmented-control-item ${tab === 'comments' ? 'active' : ''}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setTab('comments')}
                >
                  <MessageSquare size={12} className="me-1" /> Comments ({comments.length})
                </button>
              </div>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0, padding: '16px 24px' }}>
              {tab === 'activity' ? (
                <div>
                  {activity.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--tf-text-faint)', fontSize: 13, padding: '28px 0' }}>
                      No activity recorded yet
                    </p>
                  ) : (
                    activity.map((a, i) => (
                      <div
                        key={a._id?.toString() || i}
                        style={{
                          display: 'flex', gap: 12, padding: '8px 0',
                          borderBottom: '1px solid var(--tf-hairline-soft)',
                          fontSize: '13px',
                        }}
                      >
                        <div
                          style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                            backgroundColor: a.action === 'completed' ? 'var(--col-done)' : a.action === 'commented' ? 'var(--tf-accent)' : 'var(--tf-text-muted)',
                          }}
                        />
                        <div>
                          <span style={{ color: 'var(--tf-ink)', fontWeight: 500 }}>{a.detail}</span>
                          <div className="tf-mono" style={{ fontSize: '11px', color: 'var(--tf-text-muted)', marginTop: 2 }}>
                            {formatTime(a.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column" style={{ minHeight: '100%' }}>
                  {comments.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--tf-text-faint)', fontSize: 13, padding: '28px 0' }}>
                      No comments yet
                    </p>
                  ) : (
                    comments.map((c, i) => (
                      <div key={c._id?.toString() || i} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 650, color: 'var(--tf-ink)' }}>
                            {c.userName || getUserName(c.userId)}
                          </span>
                          <span className="tf-mono" style={{ fontSize: '11px', color: 'var(--tf-text-muted)' }}>
                            {formatTime(c.createdAt)}
                          </span>
                        </div>
                        <div style={{
                          backgroundColor: 'var(--tf-canvas-soft)',
                          border: '1px solid var(--tf-hairline-soft)',
                          padding: '8px 12px',
                          borderRadius: 'var(--tf-radius-sm)',
                          fontSize: '13px',
                          color: 'var(--tf-ink)',
                          lineHeight: 1.4,
                        }}>
                          {c.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* ── Comment Input Box ── */}
            {tab === 'comments' && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--tf-hairline-soft)' }}>
                <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment…"
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn button-primary"
                    type="submit"
                    disabled={!commentText.trim()}
                    style={{ width: 38, height: 38, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </Offcanvas.Body>
    </Offcanvas>
  );
}
