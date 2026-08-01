import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';

export default function LoginPage() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      navigate(data.user.workspaceId ? '/boards' : '/workspace');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-dark">
      <Container style={{ maxWidth: 440 }}>
        <Card className="bg-dark text-light border border-secondary shadow-lg">
          <Card.Body className="p-4">
            <div className="text-center mb-4">
              <h2 className="fw-bold" style={{ letterSpacing: '-0.5px' }}>
                <span className="text-primary">Task</span>Forge
              </h2>
              <p className="text-secondary small mb-0">Sign in to your account</p>
            </div>

            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="small text-secondary">Email</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-dark text-light border-secondary"
                  placeholder="you@example.com"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small text-secondary">Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-dark text-light border-secondary"
                  placeholder="••••••••"
                />
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100 fw-semibold" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </Form>

            <p className="text-center text-secondary small mt-3 mb-0">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary text-decoration-none">
                Register
              </Link>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
