import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import BoardsPage from './pages/BoardsPage';
import Board from './components/Board';
import DashboardPage from './pages/DashboardPage';
import { Spinner } from 'react-bootstrap';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'var(--tf-canvas)' }}>
        <Spinner animation="border" style={{ color: 'var(--tf-ink)' }} />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: 'var(--tf-canvas)' }}>
        <Spinner animation="border" style={{ color: 'var(--tf-ink)' }} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.workspaceId ? '/boards' : '/workspace'} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={user.workspaceId ? '/boards' : '/workspace'} /> : <RegisterPage />} />
      <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
      <Route path="/boards" element={<ProtectedRoute><BoardsPage /></ProtectedRoute>} />
      <Route path="/board/:boardId" element={<ProtectedRoute><Board /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
