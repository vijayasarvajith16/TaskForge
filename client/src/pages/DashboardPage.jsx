import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkload, getLeaderboard } from '../api';
import NavActionGroup from '../components/NavActionGroup';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import { Spinner } from 'react-bootstrap';
import {
  BarChart3, Trophy, ArrowLeft, TrendingUp, CheckSquare,
  AlertTriangle, Users, LayoutDashboard,
} from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

function StatCard({ icon, label, value, metricSub }) {
  return (
    <div style={{
      background: 'var(--tf-canvas)',
      border: '1px solid var(--tf-hairline)',
      borderRadius: 'var(--tf-radius-md)',
      padding: '22px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flex: '1 1 200px',
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: '30%',
        background: 'var(--tf-canvas-soft)',
        border: '1px solid var(--tf-hairline-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div className="tf-mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--tf-ink)', margin: 0, lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-ink)', margin: '4px 0 2px' }}>{label}</div>
        {metricSub && (
          <div style={{ fontSize: 11, color: 'var(--tf-text-muted)' }}>{metricSub}</div>
        )}
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
  }, [user?.workspaceId]);

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
    <div style={{ minHeight: '100vh', background: 'var(--tf-canvas)', display: 'flex', flexDirection: 'column' }}>

      {/* Floating Navbar */}
      <div className="tf-navbar-wrapper">
        <div className="tf-navbar">
          <a onClick={() => navigate('/boards')} className="tf-navbar-brand" style={{ cursor: 'pointer' }}>
            <img src="/logo.png" alt="TaskForge" className="brand-logo" />
            <span><span className="tf-brand-blue">Task</span>Forge</span>
          </a>
          <WorkspaceSwitcher />

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="tf-navbar-btn" onClick={() => navigate('/boards')}>
              <ArrowLeft size={14} /> Boards
            </button>
            <button className="tf-navbar-btn" onClick={() => navigate('/workspace')}>
              <Users size={14} /> Organization
            </button>
            <NavActionGroup token={localStorage.getItem('token')} />
            <div className="tf-avatar" title={user?.name}>{initials(user?.name)}</div>
            <button className="tf-navbar-btn danger" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

        {/* Page Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="tf-eyebrow">Executive Intelligence</div>
          <h1 style={{ fontSize: 26, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
            Operational Analytics.
          </h1>
          <p className="tf-subtitle" style={{ fontSize: 14, margin: '4px 0 0' }}>
            Sprint throughput, active bottleneck distribution, and engineer velocity metrics.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 80 }}><Spinner animation="border" variant="primary" /></div>
        ) : (
          <>
            {/* ── Summary Stat KPI Cards ── */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
              <StatCard
                icon={<CheckSquare size={20} color="var(--col-done)" />}
                label="Completed Issues" value={totalDone} metricSub="Verified merged in sprint"
              />
              <StatCard
                icon={<TrendingUp size={20} color="var(--col-inprogress)" />}
                label="In-Flight Issues" value={totalOpen} metricSub="Currently in progress"
              />
              <StatCard
                icon={<Users size={20} color="var(--tf-accent)" />}
                label="Active Engineers" value={workload.length} metricSub="Assigned across boards"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* ── Workload Distribution ── */}
              <div style={{
                background: 'var(--tf-canvas)',
                border: '1px solid var(--tf-hairline)',
                borderRadius: 'var(--tf-radius-md)',
                padding: '24px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <BarChart3 size={16} style={{ color: 'var(--tf-accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                    Workload Allocation.
                  </h3>
                </div>
                <p className="tf-subtitle" style={{ fontSize: 12.5, marginBottom: 20 }}>
                  Active issue volume distributed across team members
                </p>

                {workload.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--tf-text-faint)', padding: '36px 0', fontSize: 13 }}>
                    No assigned tasks found
                  </div>
                ) : (
                  workload.map((m) => {
                    const pct = Math.round((m.openTasks / maxOpen) * 100);
                    return (
                      <div key={m._id.toString()} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="tf-avatar" style={{ width: 24, height: 24, fontSize: 10 }}>
                              {initials(m.name)}
                            </div>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tf-ink)' }}>{m.name}</span>
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 'var(--tf-radius-full)',
                              background: 'var(--tf-canvas-soft)', color: 'var(--tf-text-muted)',
                              border: '1px solid var(--tf-hairline-soft)', textTransform: 'capitalize',
                            }}>
                              {m.role?.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="tf-mono" style={{ fontSize: 11.5, color: 'var(--tf-text-muted)' }}>
                            {m.openTasks} open · {m.doneTasks} resolved
                          </span>
                        </div>

                        <div className="tf-progress-track">
                          <div
                            className="tf-progress-fill"
                            style={{
                              width: `${pct}%`,
                              background: m.openTasks > 3
                                ? 'var(--col-blocked)'
                                : m.openTasks > 1
                                  ? 'var(--col-inprogress)'
                                  : 'var(--col-todo)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ── Sprint Velocity Leaderboard ── */}
              <div style={{
                background: 'var(--tf-canvas)',
                border: '1px solid var(--tf-hairline)',
                borderRadius: 'var(--tf-radius-md)',
                padding: '24px 28px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Trophy size={16} style={{ color: '#f59e0b' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                    Velocity Leaderboard.
                  </h3>
                </div>
                <p className="tf-subtitle" style={{ fontSize: 12.5, marginBottom: 20 }}>
                  Completion rate rankings and SLA delivery adherence
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {leaderboard.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--tf-text-faint)', padding: '36px 0', fontSize: 13 }}>
                      No completion metrics recorded yet
                    </div>
                  ) : (
                    leaderboard.map((m, i) => (
                      <div
                        key={m._id.toString()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', borderRadius: 'var(--tf-radius-sm)',
                          background: i === 0 ? 'var(--tf-canvas-soft)' : 'transparent',
                          border: i === 0 ? '1px solid var(--tf-hairline)' : '1px solid var(--tf-hairline-soft)',
                        }}
                      >
                        <span className="tf-mono" style={{ fontSize: 14, fontWeight: 700, width: 22, textAlign: 'center', color: i === 0 ? '#f59e0b' : 'var(--tf-text-muted)' }}>
                          #{i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tf-ink)' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--tf-text-muted)', textTransform: 'capitalize' }}>
                            {m.role?.replace('_', ' ')}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 'var(--tf-radius-full)', fontSize: 11, fontWeight: 600,
                            background: 'rgba(22, 163, 74, 0.1)', color: 'var(--col-done)',
                            border: '1px solid rgba(22, 163, 74, 0.2)',
                          }}>
                            {m.tasksCompleted} resolved
                          </span>

                          {m.overdueCount > 0 && (
                            <span style={{
                              padding: '2px 8px', borderRadius: 'var(--tf-radius-full)', fontSize: 11, fontWeight: 600,
                              background: 'rgba(220, 38, 38, 0.1)', color: 'var(--col-danger)',
                              border: '1px solid rgba(220, 38, 38, 0.2)',
                            }}>
                              {m.overdueCount} overdue
                            </span>
                          )}

                          <span className="tf-mono" style={{
                            fontSize: 13, fontWeight: 700,
                            color: m.completionRate >= 80 ? 'var(--col-done)' : m.completionRate >= 50 ? 'var(--col-blocked)' : 'var(--col-danger)',
                          }}>
                            {m.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
