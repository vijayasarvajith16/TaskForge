import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createWorkspace, joinWorkspace, generateInvite,
  saveWebhook, testWebhook, deleteWebhook,
} from '../api';
import { Alert, Spinner } from 'react-bootstrap';
import NavActionGroup from '../components/NavActionGroup';
import WorkspaceSwitcher from '../components/WorkspaceSwitcher';
import {
  Users, Copy, RefreshCw, LogOut, Webhook, Send, Trash2,
  CheckCircle2, XCircle, ArrowLeft, Shield, Crown, User,
  Plus, Check, Building, LayoutDashboard,
} from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

const ROLE_CONFIG = {
  head:       { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: Crown,  label: 'Head' },
  joint_head: { color: 'var(--tf-accent)', bg: 'var(--tf-accent-dim)', icon: Shield, label: 'Joint Head' },
  member:     { color: 'var(--tf-text-muted)', bg: 'var(--tf-canvas-soft)', icon: User, label: 'Member' },
};

export default function WorkspacePage() {
  const {
    user,
    workspace,
    workspaces,
    currentWorkspace,
    switchWorkspace,
    refreshWorkspaces,
    refreshWorkspace,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [wsName, setWsName]     = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [loading, setLoading]   = useState(false);

  // Webhook
  const [webhookUrl, setWebhookUrl]           = useState('');
  const [webhookProvider, setWebhookProvider] = useState('slack');
  const [webhookSaving, setWebhookSaving]     = useState(false);
  const [webhookTesting, setWebhookTesting]   = useState(false);
  const [webhookStatus, setWebhookStatus]     = useState(null);

  const canManage = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (workspace?.webhookUrl) {
      setWebhookUrl(workspace.webhookUrl);
      setWebhookProvider(workspace.webhookProvider || 'slack');
    } else {
      setWebhookUrl('');
      setWebhookProvider('slack');
    }
  }, [workspace]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await createWorkspace({ name: wsName });
      await refreshWorkspaces(res.data._id);
      setSuccess(`Workspace "${res.data.name}" created!`);
      setWsName('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally { setLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await joinWorkspace(joinCode.trim().toUpperCase());
      await refreshWorkspaces(res.data.workspace._id);
      setSuccess(`Joined "${res.data.workspace.name}"!`);
      setJoinCode('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join workspace');
    } finally { setLoading(false); }
  };

  const handleRegenInvite = async () => {
    if (!workspace) return;
    try {
      await generateInvite(workspace._id);
      await refreshWorkspace();
      setSuccess('Invite code regenerated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to regenerate invite code'); }
  };

  const copyCode = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.inviteCode);
    setSuccess('Invite code copied to clipboard.');
    setTimeout(() => setSuccess(''), 1800);
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault(); setWebhookSaving(true); setWebhookStatus(null);
    try {
      await saveWebhook(workspace._id, { webhookUrl, webhookProvider });
      await refreshWorkspace();
      setWebhookStatus({ ok: true, message: 'Webhook endpoint updated successfully.' });
    } catch (err) {
      setWebhookStatus({ ok: false, message: err.response?.data?.error || 'Failed to save webhook' });
    } finally { setWebhookSaving(false); }
  };

  const handleTestWebhook = async () => {
    setWebhookTesting(true); setWebhookStatus(null);
    try {
      await testWebhook(workspace._id);
      setWebhookStatus({ ok: true, message: 'Test message dispatched — check your integration channel!' });
    } catch (err) {
      setWebhookStatus({ ok: false, message: err.response?.data?.error || 'Webhook test failed' });
    } finally { setWebhookTesting(false); }
  };

  const handleDeleteWebhook = async () => {
    setWebhookStatus(null);
    try {
      await deleteWebhook(workspace._id);
      await refreshWorkspace();
      setWebhookUrl('');
      setWebhookStatus({ ok: true, message: 'Webhook removed.' });
    } catch (err) {
      setWebhookStatus({ ok: false, message: 'Failed to delete webhook' });
    }
  };

  // ── Render workspace view ──────────────────────────────────────────
  if (workspace) {
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
              <button className="tf-navbar-btn" onClick={() => navigate('/dashboard')}>
                <LayoutDashboard size={14} /> Analytics
              </button>
              <NavActionGroup token={localStorage.getItem('token')} />
              <div className="tf-avatar" title={user?.name}>{initials(user?.name)}</div>
              <button className="tf-navbar-btn danger" onClick={logout}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 32px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
          {success && <Alert variant="success" className="py-2.5 px-3 mb-4" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
          {error && <Alert variant="danger" className="py-2.5 px-3 mb-4" dismissible onClose={() => setError('')}>{error}</Alert>}

          {/* ── Active Organization Info Card ── */}
          <div style={{
            background: 'var(--tf-canvas)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-md)',
            padding: '28px 32px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              {/* 30% Squircle Logo */}
              <div style={{
                width: 54, height: 54, borderRadius: '30%',
                background: 'var(--tf-ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: 'var(--tf-on-primary)',
                flexShrink: 0,
              }}>
                {workspace.name[0]?.toUpperCase()}
              </div>

              <div>
                <div className="tf-eyebrow">Organization Profile</div>
                <h2 style={{ fontSize: 24, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  {workspace.name}.
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--tf-text-muted)' }}>
                    Your role: <strong style={{ color: 'var(--tf-ink)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</strong>
                  </span>
                  <span className="tf-badge-popular" style={{ fontSize: 10 }}>Active</span>
                </div>
              </div>
            </div>

            {/* Invite Code Lockup */}
            <div style={{
              background: 'var(--tf-canvas-soft)',
              border: '1px solid var(--tf-hairline-soft)',
              borderRadius: 'var(--tf-radius-sm)',
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 24, flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <div className="tf-eyebrow">Enterprise Access Key</div>
                <div className="tf-mono" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '2px', color: 'var(--tf-ink)', marginTop: 2 }}>
                  {workspace.inviteCode}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn button-outline" style={{ height: 34, fontSize: 12.5 }} onClick={copyCode}>
                  <Copy size={12} style={{ display: 'inline', marginRight: 4 }} /> Copy Key
                </button>
                {canManage && (
                  <button type="button" className="btn button-outline" style={{ height: 34, fontSize: 12.5 }} onClick={handleRegenInvite} title="Regenerate access key">
                    <RefreshCw size={12} style={{ display: 'inline', marginRight: 4 }} /> Regenerate
                  </button>
                )}
              </div>
            </div>

            {/* Members Directory (Formal IT Data Table) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} style={{ color: 'var(--tf-accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                    Member Directory ({workspace.members?.length || 0})
                  </h3>
                </div>
              </div>

              <div style={{ borderRadius: 'var(--tf-radius-sm)', border: '1px solid var(--tf-hairline)', overflow: 'hidden' }}>
                <table className="tf-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>User Identity</th>
                      <th style={{ width: '35%' }}>Corporate Email</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Assigned Privilege</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.members?.map((m) => {
                      const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                      const RoleIcon = cfg.icon;
                      const isYou = m._id.toString() === user?._id?.toString();

                      return (
                        <tr key={m._id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div className="tf-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                                {initials(m.name)}
                              </div>
                              <span style={{ fontSize: 13.5, fontWeight: isYou ? 650 : 500, color: 'var(--tf-ink)' }}>
                                {m.name} {isYou && <span style={{ fontSize: 11, color: 'var(--tf-accent)', fontWeight: 600 }}>(you)</span>}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="tf-mono" style={{ fontSize: 12, color: 'var(--tf-text-muted)' }}>
                              {m.email}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 600,
                              padding: '2px 9px', borderRadius: 'var(--tf-radius-full)',
                              color: cfg.color, background: cfg.bg,
                              border: '1px solid var(--tf-hairline-soft)',
                            }}>
                              <RoleIcon size={11} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Webhooks & Automation Integrations Card ── */}
          {canManage && (
            <div style={{
              background: 'var(--tf-canvas)',
              border: '1px solid var(--tf-hairline)',
              borderRadius: 'var(--tf-radius-md)',
              padding: '24px 32px',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Webhook size={16} style={{ color: 'var(--tf-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  Automation & Webhook Endpoints.
                </h3>
              </div>
              <p className="tf-subtitle" style={{ fontSize: 13, marginBottom: 16 }}>
                Dispatch real-time escalation alerts, SLA violations, and resolved task events to Slack or Discord channels.
              </p>

              {webhookStatus && (
                <Alert
                  variant={webhookStatus.ok ? 'success' : 'danger'}
                  className="py-2.5 px-3 d-flex align-items-center gap-2 mb-3"
                  dismissible
                  onClose={() => setWebhookStatus(null)}
                >
                  {webhookStatus.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {webhookStatus.message}
                </Alert>
              )}

              <form onSubmit={handleSaveWebhook}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select
                    className="form-select"
                    value={webhookProvider}
                    onChange={(e) => setWebhookProvider(e.target.value)}
                    style={{ maxWidth: 130 }}
                  >
                    <option value="slack">Slack</option>
                    <option value="discord">Discord</option>
                  </select>
                  <input
                    type="url"
                    className="form-control"
                    placeholder={webhookProvider === 'slack' ? 'https://hooks.slack.com/services/…' : 'https://discord.com/api/webhooks/…'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="btn button-primary" disabled={webhookSaving || !webhookUrl} style={{ height: 34 }}>
                    {webhookSaving ? <Spinner size="sm" className="me-1" /> : null} Save Integration
                  </button>
                  <button
                    type="button"
                    className="btn button-outline"
                    onClick={handleTestWebhook}
                    disabled={webhookTesting || !workspace?.webhookUrl}
                    style={{ height: 34 }}
                  >
                    {webhookTesting ? <Spinner size="sm" className="me-1" /> : <Send size={12} style={{ display: 'inline', marginRight: 4 }} />} Test Dispatch
                  </button>
                  {workspace?.webhookUrl && (
                    <button type="button" className="btn btn-outline-danger" onClick={handleDeleteWebhook} style={{ height: 34, marginLeft: 'auto' }}>
                      <Trash2 size={12} style={{ display: 'inline', marginRight: 4 }} /> Remove Webhook
                    </button>
                  )}
                </div>
                {workspace?.webhookUrl && (
                  <p className="tf-mono" style={{ fontSize: 11.5, color: 'var(--col-done)', marginTop: 10, marginBottom: 0 }}>
                    ✓ Integration active ({workspace.webhookProvider})
                  </p>
                )}
              </form>
            </div>
          )}

          {/* ── Multi-Workspace Manager Hub ── */}
          <div style={{
            background: 'var(--tf-canvas)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-md)',
            padding: '24px 32px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Building size={16} style={{ color: 'var(--tf-accent)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                All Affiliated Workspaces ({workspaces.length}).
              </h3>
            </div>
            <p className="tf-subtitle" style={{ fontSize: 13, marginBottom: 18 }}>
              Manage and seamlessly switch between multiple independent organization scopes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {workspaces.map((ws) => {
                const isActive = ws.workspaceId === currentWorkspace?.workspaceId;
                const wsInitial = ws.name ? ws.name[0].toUpperCase() : 'W';
                return (
                  <div
                    key={ws.workspaceId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 'var(--tf-radius-sm)',
                      background: isActive ? 'var(--tf-canvas-soft)' : 'transparent',
                      border: isActive ? '1px solid var(--tf-hairline)' : '1px solid var(--tf-hairline-soft)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 28, height: 28, borderRadius: '30%',
                          background: isActive ? 'var(--tf-accent)' : 'var(--tf-ink)',
                          color: '#ffffff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                        }}
                      >
                        {wsInitial}
                      </span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--tf-ink)' }}>{ws.name}</span>
                          <span style={{
                            fontSize: 10.5, padding: '2px 8px', borderRadius: 'var(--tf-radius-full)',
                            background: 'var(--tf-field)', color: 'var(--tf-text-muted)', textTransform: 'capitalize',
                          }}>
                            {ws.role?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isActive ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={14} /> Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn button-outline"
                        onClick={() => switchWorkspace(ws.workspaceId)}
                        style={{ height: 32, fontSize: 12, padding: '0 14px' }}
                      >
                        Switch Scope
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add / Join Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Create Workspace */}
              <div style={{
                background: 'var(--tf-canvas-soft)',
                border: '1px solid var(--tf-hairline-soft)',
                borderRadius: 'var(--tf-radius-sm)',
                padding: '18px 20px',
              }}>
                <div className="tf-eyebrow">New Domain</div>
                <h4 style={{ fontSize: 15, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 4 }}>
                  Create Workspace.
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', marginBottom: 12 }}>
                  Initialize a new organization where you hold the Head role.
                </p>
                <form onSubmit={handleCreate}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ marginBottom: 10 }}
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    required
                    placeholder="e.g. SRE Platform Guild"
                  />
                  <button type="submit" className="btn button-primary" disabled={loading} style={{ width: '100%', height: 36 }}>
                    {loading ? <Spinner size="sm" /> : <><Plus size={13} style={{ display: 'inline', marginRight: 4 }} /> Create</>}
                  </button>
                </form>
              </div>

              {/* Join via Invite Code */}
              <div style={{
                background: 'var(--tf-canvas-soft)',
                border: '1px solid var(--tf-hairline-soft)',
                borderRadius: 'var(--tf-radius-sm)',
                padding: '18px 20px',
              }}>
                <div className="tf-eyebrow">Membership Request</div>
                <h4 style={{ fontSize: 15, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 4 }}>
                  Join with Invite Key.
                </h4>
                <p style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', marginBottom: 12 }}>
                  Enter an 8-character alphanumeric invite code.
                </p>
                <form onSubmit={handleJoin}>
                  <input
                    type="text"
                    className="form-control tf-mono"
                    style={{ marginBottom: 10, letterSpacing: '1px', textTransform: 'uppercase' }}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    required
                    maxLength={8}
                    placeholder="e.g. DEMO2026"
                  />
                  <button type="submit" className="btn button-outline" disabled={loading} style={{ width: '100%', height: 36 }}>
                    {loading ? <Spinner size="sm" /> : 'Join Workspace'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── First-time Onboarding View ─────────────────────────────────────────────
  return (
    <div className="tf-auth-wrapper" style={{ alignItems: 'flex-start', paddingTop: 80 }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <img src="/logo.png" alt="TaskForge" style={{ width: 40, height: 40, borderRadius: '30%' }} />
            <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-ink)', letterSpacing: '-0.3px' }}>
              <span style={{ color: 'var(--tf-accent)' }}>Task</span>Forge
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 650, color: 'var(--tf-ink)' }}>Welcome to TaskForge.</h2>
          <p className="tf-subtitle" style={{ fontSize: 14 }}>
            Initialize your first workspace or link to an existing enterprise with an invite key.
          </p>
        </div>

        {error && <Alert variant="danger" className="py-2.5 px-3 mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{error}</Alert>}
        {success && <Alert variant="success" className="py-2.5 px-3 mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{success}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Create */}
          <div style={{
            background: 'var(--tf-canvas)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-md)',
            padding: '28px 24px',
          }}>
            <div className="tf-eyebrow">New Domain</div>
            <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 6 }}>
              Create Organization.
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
              Start a new workspace for your engineering team.
            </p>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                className="form-control"
                style={{ marginBottom: 12 }}
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
                placeholder="e.g. Core Engineering"
              />
              <button type="submit" className="btn button-primary" disabled={loading} style={{ width: '100%', height: 40 }}>
                {loading ? <Spinner size="sm" /> : 'Create Workspace'}
              </button>
            </form>
          </div>

          {/* Join */}
          <div style={{
            background: 'var(--tf-canvas)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-md)',
            padding: '28px 24px',
          }}>
            <div className="tf-eyebrow">Invitation Key</div>
            <h3 style={{ fontSize: 16, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 6 }}>
              Join Existing Workspace.
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
              Enter the invite key provided by your workspace admin.
            </p>
            <form onSubmit={handleJoin}>
              <input
                type="text"
                className="form-control tf-mono"
                style={{ marginBottom: 12, letterSpacing: '1px', textTransform: 'uppercase' }}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                required
                maxLength={8}
                placeholder="e.g. DEMO2026"
              />
              <button type="submit" className="btn button-outline" disabled={loading} style={{ width: '100%', height: 40 }}>
                {loading ? <Spinner size="sm" /> : 'Join Workspace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
