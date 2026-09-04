import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getWorkspace,
  getMyWorkspaces,
} from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to load and sync workspaces
  const loadWorkspaces = async (preferredWorkspaceId = null) => {
    try {
      const res = await getMyWorkspaces();
      const list = res.data || [];
      setWorkspaces(list);

      if (list.length === 0) {
        setCurrentWorkspace(null);
        setWorkspaceDetails(null);
        localStorage.removeItem('currentWorkspaceId');
        return null;
      }

      const storedId = preferredWorkspaceId || localStorage.getItem('currentWorkspaceId');
      const active = list.find((w) => w.workspaceId === storedId) || list[0];

      setCurrentWorkspace(active);
      localStorage.setItem('currentWorkspaceId', active.workspaceId);

      // Load full details for active workspace
      try {
        const detailsRes = await getWorkspace(active.workspaceId);
        setWorkspaceDetails(detailsRes.data);
      } catch (err) {
        console.error('Failed to load active workspace details:', err);
      }

      return active;
    } catch (err) {
      console.error('Failed to fetch user workspaces:', err);
      return null;
    }
  };

  // Rehydrate on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        loadWorkspaces().finally(() => setLoading(false));
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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

    await loadWorkspaces();
    return res.data;
  };

  const registerUser = async (name, email, password) => {
    const res = await apiRegister({ name, email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);

    await loadWorkspaces();
    return res.data;
  };

  const switchWorkspace = async (workspaceId) => {
    const target = workspaces.find((w) => w.workspaceId === workspaceId);
    if (!target) return;

    setCurrentWorkspace(target);
    localStorage.setItem('currentWorkspaceId', target.workspaceId);

    try {
      const detailsRes = await getWorkspace(target.workspaceId);
      setWorkspaceDetails(detailsRes.data);
    } catch (err) {
      console.error('Failed to load switched workspace details:', err);
    }
  };

  const refreshWorkspace = async () => {
    if (!currentWorkspace?.workspaceId) return;
    try {
      const res = await getWorkspace(currentWorkspace.workspaceId);
      setWorkspaceDetails(res.data);
    } catch (err) {
      console.error('Error refreshing workspace:', err);
    }
  };

  const refreshWorkspaces = async (targetWorkspaceId = null) => {
    return loadWorkspaces(targetWorkspaceId);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('currentWorkspaceId');
    setUser(null);
    setWorkspaces([]);
    setCurrentWorkspace(null);
    setWorkspaceDetails(null);
  };

  // Backwards-compatibility wrapper: ensures user.workspaceId and user.role return active workspace values
  const effectiveUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      workspaceId: currentWorkspace?.workspaceId || null,
      role: currentWorkspace?.role || 'member',
    };
  }, [user, currentWorkspace]);

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        workspace: workspaceDetails,
        currentWorkspace,
        workspaces,
        loading,
        loginUser,
        registerUser,
        logout,
        switchWorkspace,
        refreshWorkspace,
        refreshWorkspaces,
      }}
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
