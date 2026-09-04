import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Spinner } from 'react-bootstrap';
import ThemeToggle from '../components/ThemeToggle';

export default function RegisterPage() {
  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]       = useState('member');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerUser(name, email, password, role);
      navigate('/workspace');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please check input parameters.');
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

        <h2 style={{ fontSize: 26, fontWeight: 650, marginBottom: 4 }}>Create account.</h2>
        <p className="tf-auth-subtitle">Provision your engineer identity in TaskForge.</p>

        {error && (
          <Alert variant="danger" className="py-2.5 px-3 mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Alex Rivera"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Corporate Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@company.com"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Initial Role Profile</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="member">Member (Engineer / Contributor)</option>
              <option value="head">Head (Engineering Director / Admin)</option>
              <option value="joint_head">Joint Head (Tech Lead / Scrum Master)</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn button-primary"
            style={{ width: '100%', height: 42, fontSize: 14 }}
            disabled={loading}
          >
            {loading ? <Spinner size="sm" /> : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--tf-text-muted)', marginTop: 24, marginBottom: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--tf-ink)', textDecoration: 'underline', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
