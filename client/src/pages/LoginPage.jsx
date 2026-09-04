import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from 'react-bootstrap';
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
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-auth-wrapper">
      <div className="tf-auth-card">
        {/* Header with Logo and ThemeToggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="tf-auth-logo" style={{ margin: 0 }}>
            <img src="/logo.png" alt="TaskForge" style={{ width: 40, height: 40, borderRadius: '30%' }} />
            <span><span style={{ color: 'var(--tf-accent)' }}>Task</span>Forge</span>
          </div>
          <div className="tf-nav-group">
            <ThemeToggle />
          </div>
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 650, marginBottom: 4, letterSpacing: '-0.3px' }}>Sign in.</h2>
        <p className="tf-auth-subtitle">Manage your boards and tasks in one place.</p>

        {error && (
          <Alert variant="danger" className="py-2.5 px-3 mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
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
            className="btn btn-primary"
            style={{ width: '100%', height: 44, fontSize: 15, fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--tf-text-muted)', marginTop: 24, marginBottom: 0 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--tf-ink)', textDecoration: 'underline', fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
