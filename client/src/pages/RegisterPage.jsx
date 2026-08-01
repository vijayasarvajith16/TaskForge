import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';

export default function RegisterPage() {
  const { registerUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerUser(name, email, password, role);
      navigate('/workspace');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
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
              <h2 className="fw-bold d-flex align-items-center justify-content-center gap-2" style={{ letterSpacing: '-0.5px' }}>
                <img src="/logo.png" alt="TaskForge Logo" style={{ width: 32, height: 32 }} />
                <span><span className="text-primary">Task</span>Forge</span>
              </h2>
              <p className="text-secondary small mb-0">Create your account</p>
            </div>

            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="small text-secondary">Name</Form.Label>
                <Form.Control
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-dark text-light border-secondary"
                  placeholder="Your name"
                />
              </Form.Group>
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
                  minLength={6}
                  className="bg-dark text-light border-secondary"
                  placeholder="Min 6 characters"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="small text-secondary">Role</Form.Label>
                <Form.Select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-dark text-light border-secondary"
                >
                  <option value="member">Member</option>
                  <option value="head">Head</option>
                  <option value="joint_head">Joint Head</option>
                </Form.Select>
              </Form.Group>
              <Button type="submit" variant="primary" className="w-100 fw-semibold" disabled={loading}>
                {loading ? 'Creating…' : 'Create Account'}
              </Button>
            </Form>

            <p className="text-center text-secondary small mt-3 mb-0">
              Already have an account?{' '}
              <Link to="/login" className="text-primary text-decoration-none">
                Sign in
              </Link>
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
