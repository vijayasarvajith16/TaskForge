import { useState, useEffect } from 'react';
import { Alert } from 'react-bootstrap';
import { BarChart3, Plus, X, Vote, Check } from 'lucide-react';
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
    <div style={{ padding: '0 32px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span className="tf-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
          <BarChart3 size={13} style={{ color: 'var(--tf-accent)' }} /> Team Consensus & Polls
        </span>
        {canManage && (
          <button
            className="tf-navbar-btn"
            style={{ height: 28, padding: '0 10px', fontSize: 12, border: '1px solid var(--tf-hairline)' }}
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus size={12} /> New Poll
          </button>
        )}
      </div>

      {showCreate && (
        <div style={{
          background: 'var(--tf-canvas)',
          border: '1px solid var(--tf-hairline)',
          borderRadius: 'var(--tf-radius-md)',
          padding: '18px 20px',
          marginBottom: 14,
          animation: 'modalUp 0.15s ease',
        }}>
          {error && <Alert variant="danger" className="py-2 small mb-3">{error}</Alert>}
          <form onSubmit={handleCreate}>
            <div style={{ marginBottom: 10 }}>
              <label className="form-label">Poll Question</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Should we adopt GraphQL for public API v2?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label className="form-label">Options</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="tf-icon-btn delete"
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="btn button-outline"
                style={{ height: 28, padding: '0 12px', fontSize: 12, marginTop: 4 }}
                onClick={() => setOptions([...options, ''])}
              >
                + Add option
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Closes At</label>
              <input
                type="datetime-local"
                className="form-control"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--tf-hairline-soft)' }}>
              <button type="button" className="btn button-outline" style={{ height: 32 }} onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button type="submit" className="btn button-primary" style={{ height: 32 }}>
                Publish Poll
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {polls.map((poll) => {
          const isClosed = new Date(poll.closesAt) < now;
          const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
          const userVotedIndex = poll.options.findIndex((o) => o.votes?.some((v) => v.toString() === userId));

          return (
            <div
              key={poll._id.toString()}
              style={{
                background: 'var(--tf-canvas)',
                border: '1px solid var(--tf-hairline)',
                borderRadius: 'var(--tf-radius-sm)',
                padding: '14px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--tf-ink)' }}>{poll.question}</span>
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
                  <div
                    key={i}
                    style={{ marginBottom: 10, cursor: isClosed ? 'default' : 'pointer' }}
                    onClick={() => !isClosed && handleVote(poll._id.toString(), i)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: '12.5px' }}>
                      <span style={{ fontWeight: isMyVote ? 650 : 500, color: 'var(--tf-ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isMyVote && <Check size={12} style={{ color: 'var(--tf-accent)' }} />}
                        {opt.text}
                      </span>
                      <span className="tf-mono" style={{ fontSize: 11, color: 'var(--tf-text-muted)' }}>
                        {count} ({pct}%)
                      </span>
                    </div>

                    <div className="tf-progress-track">
                      <div
                        className="tf-progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: isMyVote ? 'var(--tf-accent)' : 'var(--tf-ink-soft)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="tf-mono" style={{ fontSize: 10.5, color: 'var(--tf-text-faint)', marginTop: 8 }}>
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {isClosed ? 'Closed' : `Closes ${new Date(poll.closesAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
