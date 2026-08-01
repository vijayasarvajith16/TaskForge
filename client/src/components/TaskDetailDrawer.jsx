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
    <Offcanvas show={show} onHide={onHide} placement="end" className="bg-dark text-light border-secondary" style={{ width: 440 }}>
      <Offcanvas.Header closeButton closeVariant="white" className="border-bottom border-secondary pb-2">
        <Offcanvas.Title className="fs-6 fw-bold">Task Details</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body className="d-flex flex-column p-0">
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="primary" size="sm" /></div>
        ) : !task ? (
          <div className="text-center text-secondary py-5">Task not found</div>
        ) : (
          <>
            {/* Task info */}
            <div className="px-3 py-3 border-bottom border-secondary">
              <h6 className="fw-bold mb-2">{task.title}</h6>
              {task.description && <p className="text-secondary small mb-2">{task.description}</p>}
              <div className="d-flex flex-wrap gap-2 mb-2">
                <Badge bg={statusColors[task.status] || 'secondary'} className="text-capitalize">
                  {task.status?.replace('_', ' ')}
                </Badge>
                {task.escalationLevel > 0 && (
                  <Badge bg={task.escalationLevel >= 2 ? 'danger' : 'warning'} text={task.escalationLevel >= 2 ? undefined : 'dark'}>
                    Escalation L{task.escalationLevel}
                  </Badge>
                )}
              </div>
              <div className="small text-secondary d-flex flex-column gap-1">
                <span><User size={12} className="me-1" /> {getAssigneeName()}</span>
                {task.dueDate && (
                  <span><Clock size={12} className="me-1" /> Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                )}
                {task.dependsOn?.length > 0 && (
                  <span><Link2 size={12} className="me-1" /> {task.dependsOn.length} dependenc{task.dependsOn.length > 1 ? 'ies' : 'y'}</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="d-flex border-bottom border-secondary">
              <button
                className={`btn btn-sm flex-fill rounded-0 border-0 ${tab === 'activity' ? 'text-primary border-bottom border-primary' : 'text-secondary'}`}
                style={{ borderBottom: tab === 'activity' ? '2px solid' : 'none' }}
                onClick={() => setTab('activity')}
              >
                <Activity size={13} className="me-1" /> Activity
              </button>
              <button
                className={`btn btn-sm flex-fill rounded-0 border-0 ${tab === 'comments' ? 'text-primary border-bottom border-primary' : 'text-secondary'}`}
                style={{ borderBottom: tab === 'comments' ? '2px solid' : 'none' }}
                onClick={() => setTab('comments')}
              >
                <MessageSquare size={13} className="me-1" /> Comments ({comments.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
              {tab === 'activity' ? (
                <div className="px-3 py-2">
                  {activity.length === 0 ? (
                    <p className="text-secondary small text-center py-3">No activity yet</p>
                  ) : (
                    activity.map((a, i) => (
                      <div key={a._id?.toString() || i} className="d-flex gap-2 py-2 border-bottom border-secondary" style={{ fontSize: '0.78rem' }}>
                        <div
                          style={{
                            width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                            backgroundColor: a.action === 'completed' ? '#22c55e' : a.action === 'commented' ? '#6366f1' : a.action === 'moved' ? '#f59e0b' : '#64748b',
                          }}
                        />
                        <div>
                          <span className="text-light">{a.detail}</span>
                          <div className="text-secondary" style={{ fontSize: '0.65rem' }}>{formatTime(a.timestamp)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="px-3 py-2 d-flex flex-column" style={{ minHeight: '100%' }}>
                  {comments.length === 0 ? (
                    <p className="text-secondary small text-center py-3">No comments yet</p>
                  ) : (
                    comments.map((c, i) => (
                      <div key={c._id?.toString() || i} className="mb-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="fw-semibold" style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>
                            {c.userName || getUserName(c.userId)}
                          </span>
                          <span className="text-secondary" style={{ fontSize: '0.6rem' }}>{formatTime(c.createdAt)}</span>
                        </div>
                        <div className="text-light small mt-1 p-2 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
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
              <div className="px-3 py-2 border-top border-secondary">
                <Form onSubmit={handleComment} className="d-flex gap-2">
                  <Form.Control
                    size="sm"
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment…"
                    className="bg-dark text-light border-secondary"
                  />
                  <Button variant="primary" size="sm" type="submit" disabled={!commentText.trim()}>
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
