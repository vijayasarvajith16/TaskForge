import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkload, getLeaderboard } from '../api';
import NotificationBell from '../components/NotificationBell';
import { Spinner } from 'react-bootstrap';
import { BarChart3, Trophy, ArrowLeft, Zap, TrendingUp, CheckSquare, AlertTriangle } from 'lucide-react';

const medals = ['🥇', '🥈', '🥉'];

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: 'var(--tf-col-bg)',
      border: '1px solid var(--tf-border)',
      borderRadius: 10,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flex: '1 1 140px',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0, lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--tf-text-muted)', margin: '3px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [workload, setWorkload]     = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!user?.workspaceId) { navigate('/workspace'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [wl, lb] = await Promise.all([
        getWorkload(user.workspaceId),
        getLeaderboard(user.workspaceId),
      ]);
      setWorkload(wl.data);
      setLeaderboard(lb.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const totalDone = workload.reduce((s, m) => s + m.doneTasks, 0);
  const totalOpen = workload.reduce((s, m) => s + m.openTasks, 0);
  const maxOpen = Math.max(...workload.map((w) => w.openTasks), 1);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <div className="tf-navbar">
        <a className="tf-navbar-brand" style={{ cursor: 'default' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={15} color="#fff" />
          </div>
          <span><span className="tf-brand-blue">Task</span>Forge</span>
        </a>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="tf-navbar-btn" onClick={() => navigate('/boards')}>
            <ArrowLeft size={13} /> Boards
          </button>
          <NotificationBell token={localStorage.getItem('token')} />
          <span style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', padding: '0 4px' }}>{user?.name}</span>
          <button className="tf-navbar-btn danger" onClick={logout}>Sign out</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <p className="tf-section-header" style={{ margin: 0 }}>Analytics</p>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
            Team Dashboard
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}><Spinner animation="border" variant="primary" /></div>
        ) : (
          <>
            {/* ── Summary stat cards ── */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <StatCard
                icon={<CheckSquare size={18} color="var(--col-done)" />}
                label="Tasks completed" value={totalDone} color="var(--col-done)"
              />
              <StatCard
                icon={<TrendingUp size={18} color="var(--col-inprogress)" />}
                label="Tasks in progress" value={totalOpen} color="var(--col-inprogress)"
              />
              <StatCard
                icon={<AlertTriangle size={18} color="var(--col-blocked)" />}
                label="Team members" value={workload.length} color="var(--col-blocked)"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* ── Workload ── */}
              <div style={{
                background: 'var(--tf-col-bg)',
                border: '1px solid var(--tf-border)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <BarChart3 size={16} style={{ color: 'var(--tf-accent)' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                    Workload
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
                  Open tasks per team member
                </p>

                {workload.map((m) => (
                  <div key={m._id.toString()} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {m.name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text-strong)' }}>{m.name}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 20,
                          background: 'rgba(255,255,255,0.07)', color: 'var(--tf-text-muted)',
                          textTransform: 'capitalize',
                        }}>
                          {m.role?.replace('_', ' ')}
                        </span>
                      </div>
                      <span style={{ fontSize: 11.5, color: 'var(--tf-text-muted)' }}>
                        {m.openTasks} open · {m.doneTasks} done
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(m.openTasks / maxOpen) * 100}%`,
                        borderRadius: 4,
                        background: m.openTasks > 3
                          ? 'var(--col-blocked)'
                          : m.openTasks > 1
                            ? 'var(--col-inprogress)'
                            : 'var(--col-todo)',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Leaderboard ── */}
              <div style={{
                background: 'var(--tf-col-bg)',
                border: '1px solid var(--tf-border)',
                borderRadius: 12, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Trophy size={16} style={{ color: 'var(--col-blocked)' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                    Leaderboard
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
                  Completion rate ranking
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leaderboard.map((m, i) => (
                    <div key={m._id.toString()} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      background: i === 0 ? 'rgba(245,205,71,0.07)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${i === 0 ? 'rgba(245,205,71,0.15)' : 'var(--tf-border-soft)'}`,
                    }}>
                      <span style={{ fontSize: 18, width: 26, textAlign: 'center', flexShrink: 0 }}>
                        {medals[i] || `${i + 1}`}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text-strong)', margin: 0 }}>
                          {m.name}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--tf-text-muted)', margin: 0, textTransform: 'capitalize' }}>
                          {m.role?.replace('_', ' ')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: 'rgba(75,206,151,0.15)', color: 'var(--col-done)',
                        }}>
                          {m.tasksCompleted} done
                        </span>
                        {m.overdueCount > 0 && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: 'rgba(239,68,68,0.12)', color: '#fc8181',
                          }}>
                            {m.overdueCount} overdue
                          </span>
                        )}
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: m.completionRate >= 80
                            ? 'var(--col-done)'
                            : m.completionRate >= 50
                              ? 'var(--col-blocked)'
                              : '#fc8181',
                        }}>
                          {m.completionRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
