import { useState, useEffect } from 'react';
import { Card, Badge, Button, Form, ProgressBar, Alert } from 'react-bootstrap';
import { BarChart3, Plus, X, Vote } from 'lucide-react';
import { getPolls, createPoll, votePoll } from '../api';

export default function PollsPanel({ boardId, userId, canManage, socket }) {
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPolls();
  }, [boardId]);

  // Socket.io live updates
  useEffect(() => {
    if (!socket) return;
    const onCreated = ({ poll }) => setPolls((prev) => [poll, ...prev]);
    const onUpdated = ({ poll }) => setPolls((prev) => prev.map((p) => p._id.toString() === poll._id.toString() ? poll : p));
    socket.on('poll_created', onCreated);
    socket.on('poll_updated', onUpdated);
    return () => { socket.off('poll_created', onCreated); socket.off('poll_updated', onUpdated); };
  }, [socket]);

  const loadPolls = async () => {
    try {
      const res = await getPolls(boardId);
      setPolls(res.data);
    } catch { /* ignore */ }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const validOpts = options.filter((o) => o.trim());
    if (!question.trim() || validOpts.length < 2 || !closesAt) {
      setError('Question, at least 2 options, and close date are required');
      return;
    }
    try {
      await createPoll(boardId, { question: question.trim(), options: validOpts, closesAt });
      setQuestion('');
      setOptions(['', '']);
      setClosesAt('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create poll');
    }
  };

  const handleVote = async (pollId, optionIndex) => {
    try {
      await votePoll(pollId, optionIndex);
    } catch { /* ignore */ }
  };

  const now = new Date();

  if (polls.length === 0 && !canManage) return null;

  return (
    <div className="mb-3 px-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="form-label mb-0" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={15} style={{ color: 'var(--tf-accent)' }} /> Active Polls
        </span>
        {canManage && (
          <button className="tf-navbar-btn active" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setShowCreate(!showCreate)}>
            <Plus size={13} /> New Poll
          </button>
        )}
      </div>

      {showCreate && (
        <Card style={{ background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)', borderRadius: 16 }} className="mb-3">
          <Card.Body className="p-3">
            {error && <Alert variant="danger" className="py-2 small mb-2">{error}</Alert>}
            <Form onSubmit={handleCreate}>
              <Form.Control
                size="sm" className="mb-2"
                placeholder="Poll question" value={question} onChange={(e) => setQuestion(e.target.value)}
              />
              {options.map((opt, i) => (
                <div key={i} className="d-flex gap-2 mb-2">
                  <Form.Control
                    size="sm"
                    placeholder={`Option ${i + 1}`} value={opt}
                    onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                  />
                  {options.length > 2 && (
                    <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="link" size="sm" className="p-0 text-primary mb-3" style={{ fontSize: '0.8rem', fontWeight: 600 }}
                onClick={() => setOptions([...options, ''])}>+ Add option</Button>
              <Form.Control size="sm" type="datetime-local" className="mb-3"
                value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              <div className="d-flex gap-2 justify-content-end">
                <Button variant="outline-secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit">Create Poll</Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {polls.map((poll) => {
        const isClosed = new Date(poll.closesAt) < now;
        const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
        const userVotedIndex = poll.options.findIndex((o) => o.votes?.some((v) => v.toString() === userId));

        return (
          <Card key={poll._id.toString()} style={{ background: 'var(--tf-canvas-soft)', border: '1px solid var(--tf-hairline-soft)', borderRadius: 16 }} className="mb-2">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--tf-ink)' }}>{poll.question}</span>
                {isClosed ? (
                  <span className="tf-chip" style={{ fontSize: 10 }}>Closed</span>
                ) : (
                  <span className="tf-badge-popular" style={{ fontSize: 10 }}>Active</span>
                )}
              </div>
              {poll.options.map((opt, i) => {
                const count = opt.votes?.length || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = i === userVotedIndex;
                return (
                  <div key={i} className="mb-2" style={{ cursor: isClosed ? 'default' : 'pointer' }}
                    onClick={() => !isClosed && handleVote(poll._id.toString(), i)}>
                    <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: isMyVote ? 650 : 500, color: 'var(--tf-ink)' }}>
                        {isMyVote && <Vote size={12} className="me-1" style={{ color: 'var(--tf-accent)' }} />}{opt.text}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--tf-text-muted)' }}>{count} ({pct}%)</span>
                    </div>
                    <ProgressBar
                      now={pct} variant={isMyVote ? 'primary' : 'secondary'}
                      style={{ height: 6, borderRadius: 9999, backgroundColor: 'var(--tf-hairline)' }}
                    />
                  </div>
                );
              })}
              <div style={{ fontSize: 11, color: 'var(--tf-text-muted)', marginTop: 8 }}>
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {isClosed ? 'Closed' : `Closes ${new Date(poll.closesAt).toLocaleDateString()}`}
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}
