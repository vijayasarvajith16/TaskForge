import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Spinner } from 'react-bootstrap';
import ThemeToggle from '../components/ThemeToggle';

export default function LoginPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginUser(email, password);
      navigate(localStorage.getItem('currentWorkspaceId') ? '/boards' : '/workspace');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-auth-wrapper">
      <div className="tf-auth-card">
        {/* Header with Logo and ThemeToggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div className="tf-auth-logo" style={{ margin: 0 }}>
            <img src="/logo.png" alt="TaskForge" style={{ width: 36, height: 36, borderRadius: '30%' }} />
            <span><span style={{ color: 'var(--tf-accent)' }}>Task</span>Forge</span>
          </div>
          <div className="tf-nav-group">
            <ThemeToggle />
          </div>
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 650, marginBottom: 4 }}>Sign in.</h2>
        <p className="tf-auth-subtitle">Access your engineering workspace and issue trackers.</p>

        {error && (
          <Alert variant="danger" className="py-2.5 px-3 mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Corporate Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn button-primary"
            style={{ width: '100%', height: 42, fontSize: 14 }}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--tf-text-muted)', marginTop: 24, marginBottom: 0 }}>
          Need an account?{' '}
          <Link to="/register" style={{ color: 'var(--tf-ink)', textDecoration: 'underline', fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
