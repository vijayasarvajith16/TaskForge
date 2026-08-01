import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWorkload, getLeaderboard } from '../api';
import NotificationBell from '../components/NotificationBell';
import {
  Container, Card, Row, Col, Badge, Spinner, ProgressBar, Table, Button,
} from 'react-bootstrap';
import { BarChart3, Trophy, ArrowLeft, Users, LogOut } from 'lucide-react';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [workload, setWorkload] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const maxOpen = Math.max(...workload.map((w) => w.openTasks), 1);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-vh-100 bg-dark text-light">
      {/* Navbar */}
      <nav className="navbar navbar-dark bg-dark border-bottom border-secondary px-3">
        <div className="d-flex align-items-center gap-2">
          <Button variant="link" className="text-secondary p-0" onClick={() => navigate('/boards')}>
            <ArrowLeft size={18} />
          </Button>
          <span className="navbar-brand fw-bold mb-0">
            <span className="text-primary">Task</span>Forge
          </span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <NotificationBell token={localStorage.getItem('token')} />
          <Badge bg="secondary" className="text-capitalize">{user?.role?.replace('_', ' ')}</Badge>
          <span className="text-secondary small">{user?.name}</span>
          <Button variant="outline-danger" size="sm" onClick={logout}><LogOut size={14} /></Button>
        </div>
      </nav>

      <Container className="py-4" style={{ maxWidth: 1000 }}>
        {loading ? (
          <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
        ) : (
          <Row className="g-4">
            {/* ── Workload ─────────────── */}
            <Col lg={6}>
              <Card className="bg-dark border-secondary h-100">
                <Card.Body>
                  <h5 className="fw-bold mb-3">
                    <BarChart3 size={20} className="me-2 text-primary" />
                    Workload Overview
                  </h5>
                  <p className="text-secondary small mb-3">Open tasks per member (not done or locked)</p>

                  {workload.map((m) => (
                    <div key={m._id.toString()} className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <div className="d-flex align-items-center gap-2">
                          <span className="small fw-semibold text-light">{m.name}</span>
                          <Badge bg="secondary" style={{ fontSize: '0.55rem' }} className="text-capitalize">{m.role?.replace('_', ' ')}</Badge>
                        </div>
                        <span className="small text-secondary">
                          {m.openTasks} open · {m.doneTasks} done · {m.totalTasks} total
                        </span>
                      </div>
                      <ProgressBar
                        now={(m.openTasks / maxOpen) * 100}
                        variant={m.openTasks > 3 ? 'danger' : m.openTasks > 1 ? 'warning' : 'primary'}
                        style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      />
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>

            {/* ── Leaderboard ──────────── */}
            <Col lg={6}>
              <Card className="bg-dark border-secondary h-100">
                <Card.Body>
                  <h5 className="fw-bold mb-3">
                    <Trophy size={20} className="me-2 text-warning" />
                    Contribution Leaderboard
                  </h5>
                  <p className="text-secondary small mb-3">Tasks completed + completion rate</p>

                  <Table size="sm" variant="dark" borderless className="mb-0" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr className="text-secondary">
                        <th style={{ width: '10%' }}>#</th>
                        <th>Member</th>
                        <th className="text-center">Done</th>
                        <th className="text-center">Overdue</th>
                        <th className="text-center">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((m, i) => (
                        <tr key={m._id.toString()}>
                          <td className="fw-bold" style={{ fontSize: '1.1rem' }}>
                            {medals[i] || `${i + 1}.`}
                          </td>
                          <td>
                            <span className="fw-semibold text-light">{m.name}</span>
                            <Badge bg="secondary" className="ms-2 text-capitalize" style={{ fontSize: '0.5rem' }}>
                              {m.role?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="text-center">
                            <Badge bg="success">{m.tasksCompleted}</Badge>
                          </td>
                          <td className="text-center">
                            <Badge bg={m.overdueCount > 0 ? 'danger' : 'secondary'}>{m.overdueCount}</Badge>
                          </td>
                          <td className="text-center">
                            <span className={`fw-semibold ${m.completionRate >= 80 ? 'text-success' : m.completionRate >= 50 ? 'text-warning' : 'text-danger'}`}>
                              {m.completionRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
}
