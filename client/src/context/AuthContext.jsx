import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, getWorkspace } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      if (parsed.workspaceId) {
        getWorkspace(parsed.workspaceId)
          .then((res) => setWorkspace(res.data))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loginUser = async (email, password) => {
    const res = await apiLogin({ email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    if (res.data.user.workspaceId) {
      const ws = await getWorkspace(res.data.user.workspaceId);
      setWorkspace(ws.data);
    }
    return res.data;
  };

  const registerUser = async (name, email, password, role) => {
    const res = await apiRegister({ name, email, password, role });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const refreshWorkspace = async () => {
    if (!user?.workspaceId) return;
    const res = await getWorkspace(user.workspaceId);
    setWorkspace(res.data);
  };

  const updateLocalUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setWorkspace(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, workspace, loading, loginUser, registerUser, logout, refreshWorkspace, updateLocalUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
