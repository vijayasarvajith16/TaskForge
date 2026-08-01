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
    <div className="mb-3 px-2">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small fw-semibold text-secondary">
          <BarChart3 size={14} className="me-1" />Polls
        </span>
        {canManage && (
          <Button variant="outline-primary" size="sm" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => setShowCreate(!showCreate)}>
            <Plus size={12} /> New
          </Button>
        )}
      </div>

      {showCreate && (
        <Card className="bg-dark border-secondary mb-2">
          <Card.Body className="p-2">
            {error && <Alert variant="danger" className="py-1 small mb-2">{error}</Alert>}
            <Form onSubmit={handleCreate}>
              <Form.Control
                size="sm" className="bg-dark text-light border-secondary mb-2"
                placeholder="Poll question" value={question} onChange={(e) => setQuestion(e.target.value)}
              />
              {options.map((opt, i) => (
                <div key={i} className="d-flex gap-1 mb-1">
                  <Form.Control
                    size="sm" className="bg-dark text-light border-secondary"
                    placeholder={`Option ${i + 1}`} value={opt}
                    onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                  />
                  {options.length > 2 && (
                    <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                      <X size={12} />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="link" size="sm" className="p-0 text-primary mb-2" style={{ fontSize: '0.7rem' }}
                onClick={() => setOptions([...options, ''])}>+ Add option</Button>
              <Form.Control size="sm" type="datetime-local" className="bg-dark text-light border-secondary mb-2"
                value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
              <div className="d-flex gap-1 justify-content-end">
                <Button variant="outline-secondary" size="sm" style={{ fontSize: '0.7rem' }} onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" style={{ fontSize: '0.7rem' }}>Create</Button>
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
          <Card key={poll._id.toString()} className="bg-dark border-secondary mb-2">
            <Card.Body className="p-2">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <span className="small fw-semibold text-light">{poll.question}</span>
                {isClosed ? (
                  <Badge bg="secondary" style={{ fontSize: '0.55rem' }}>Closed</Badge>
                ) : (
                  <Badge bg="success" style={{ fontSize: '0.55rem' }}>Active</Badge>
                )}
              </div>
              {poll.options.map((opt, i) => {
                const count = opt.votes?.length || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const isMyVote = i === userVotedIndex;
                return (
                  <div key={i} className="mb-1" style={{ cursor: isClosed ? 'default' : 'pointer' }}
                    onClick={() => !isClosed && handleVote(poll._id.toString(), i)}>
                    <div className="d-flex justify-content-between align-items-center" style={{ fontSize: '0.72rem' }}>
                      <span className={isMyVote ? 'text-primary fw-semibold' : 'text-light'}>
                        {isMyVote && <Vote size={10} className="me-1" />}{opt.text}
                      </span>
                      <span className="text-secondary">{count} ({pct}%)</span>
                    </div>
                    <ProgressBar
                      now={pct} variant={isMyVote ? 'primary' : 'secondary'}
                      style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                    />
                  </div>
                );
              })}
              <div className="text-secondary mt-1" style={{ fontSize: '0.6rem' }}>
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {isClosed ? 'Closed' : `Closes ${new Date(poll.closesAt).toLocaleDateString()}`}
              </div>
            </Card.Body>
          </Card>
        );
      })}
    </div>
  );
}
