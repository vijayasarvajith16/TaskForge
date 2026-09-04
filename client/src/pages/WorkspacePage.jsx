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
  CheckCircle2, XCircle, ArrowLeft, Zap, Shield, Crown, User,
  Plus, Check, Building,
} from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1]?.[0] || '')).toUpperCase();
}

const ROLE_CONFIG = {
  head:       { color: '#f5cd47', bg: 'rgba(245,205,71,0.12)', icon: Crown,  label: 'Head' },
  joint_head: { color: 'var(--tf-accent)', bg: 'var(--tf-accent-dim)', icon: Shield, label: 'Joint Head' },
  member:     { color: 'var(--tf-text-muted)', bg: 'rgba(255,255,255,0.06)', icon: User, label: 'Member' },
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
      setSuccess('Invite code regenerated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to regenerate invite'); }
  };

  const copyCode = () => {
    if (!workspace) return;
    navigator.clipboard.writeText(workspace.inviteCode);
    setSuccess('Copied invite code!');
    setTimeout(() => setSuccess(''), 1800);
  };

  const handleSaveWebhook = async (e) => {
    e.preventDefault(); setWebhookSaving(true); setWebhookStatus(null);
    try {
      await saveWebhook(workspace._id, { webhookUrl, webhookProvider });
      await refreshWorkspace();
      setWebhookStatus({ ok: true, message: 'Webhook saved.' });
    } catch (err) {
      setWebhookStatus({ ok: false, message: err.response?.data?.error || 'Failed to save' });
    } finally { setWebhookSaving(false); }
  };

  const handleTestWebhook = async () => {
    setWebhookTesting(true); setWebhookStatus(null);
    try {
      await testWebhook(workspace._id);
      setWebhookStatus({ ok: true, message: 'Test message sent — check your channel!' });
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
        {/* Navbar */}
        <div className="tf-navbar-wrapper">
          <div className="tf-navbar">
            <a onClick={() => navigate('/boards')} className="tf-navbar-brand" style={{ cursor: 'pointer', textDecoration: 'none' }}>
              <img src="/logo.png" alt="TaskForge" className="brand-logo" />
              <span><span className="tf-brand-blue">Task</span>Forge</span>
            </a>
            <WorkspaceSwitcher />

            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="tf-navbar-btn" onClick={() => navigate('/boards')}>
                <ArrowLeft size={14} /> Boards
              </button>
              <NavActionGroup token={localStorage.getItem('token')} />
              <div className="tf-avatar" title={user?.name}>{initials(user?.name)}</div>
              <button className="tf-navbar-btn danger" onClick={logout}>
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px 32px', maxWidth: 840, margin: '0 auto', width: '100%' }}>
          {success && <Alert variant="success" className="py-2.5 px-3 mb-4" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
          {error && <Alert variant="danger" className="py-2.5 px-3 mb-4" dismissible onClose={() => setError('')}>{error}</Alert>}

          {/* ── Active Workspace Info Card ── */}
          <div style={{
            background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)',
            borderRadius: 24, padding: '28px 32px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '30%',
                background: 'var(--tf-ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: 'var(--tf-on-primary)',
              }}>
                {workspace.name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  {workspace.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--tf-text-muted)' }}>
                    Your role: <strong style={{ color: 'var(--tf-ink)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</strong>
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                    background: 'var(--tf-accent-dim)', color: 'var(--tf-accent)',
                  }}>Active</span>
                </div>
              </div>
            </div>

            {/* Invite code — visible to all, regenerate only head/joint_head */}
            <div style={{
              background: 'var(--tf-canvas-soft)', border: '1px solid var(--tf-hairline-soft)',
              borderRadius: 16, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Workspace Invite Code
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '3px', color: 'var(--tf-ink)', fontFamily: 'monospace', marginTop: 2 }}>
                  {workspace.inviteCode}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="tf-navbar-btn" onClick={copyCode}>
                  <Copy size={13} /> Copy
                </button>
                {canManage && (
                  <button type="button" className="tf-navbar-btn" onClick={handleRegenInvite} title="Generate new code">
                    <RefreshCw size={13} /> Regenerate
                  </button>
                )}
              </div>
            </div>

            {/* Members section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Users size={16} style={{ color: 'var(--tf-accent)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  Members ({workspace.members?.length || 0})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {workspace.members?.map((m) => {
                  const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                  const RoleIcon = cfg.icon;
                  const isYou = m._id.toString() === user?._id?.toString();

                  return (
                    <div
                      key={m._id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 16,
                        background: isYou ? 'var(--tf-canvas-soft)' : 'transparent',
                        border: isYou ? '1px solid var(--tf-hairline)' : '1px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="tf-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {initials(m.name)}
                        </div>
                        <div>
                          <span style={{ fontSize: 13.5, fontWeight: isYou ? 650 : 500, color: 'var(--tf-ink)' }}>
                            {m.name} {isYou && <span style={{ fontSize: 11, color: 'var(--tf-accent)', fontWeight: 600 }}>(you)</span>}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--tf-text-faint)', marginLeft: 8 }}>
                            {m.email}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11.5, fontWeight: 600,
                        padding: '3px 9px', borderRadius: 9999,
                        color: cfg.color, background: cfg.bg,
                      }}>
                        <RoleIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Webhook card (head/joint_head only) ── */}
          {canManage && (
            <div style={{
              background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)',
              borderRadius: 24, padding: '24px 32px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Webhook size={16} style={{ color: 'var(--tf-accent)' }} />
                <h3 style={{ fontSize: 15, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                  Discord / Slack Integrations
                </h3>
              </div>
              <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
                Post automatic escalation alerts and completed task updates directly into your team channel.
              </p>

              {webhookStatus && (
                <Alert
                  variant={webhookStatus.ok ? 'success' : 'danger'}
                  className="py-2 small d-flex align-items-center gap-2 mb-3"
                  dismissible
                  onClose={() => setWebhookStatus(null)}
                >
                  {webhookStatus.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {webhookStatus.message}
                </Alert>
              )}

              <form onSubmit={handleSaveWebhook}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <select
                    className="tf-input"
                    value={webhookProvider}
                    onChange={(e) => setWebhookProvider(e.target.value)}
                    style={{ maxWidth: 130 }}
                  >
                    <option value="slack">Slack</option>
                    <option value="discord">Discord</option>
                  </select>
                  <input
                    type="url"
                    className="tf-input"
                    placeholder={webhookProvider === 'slack' ? 'https://hooks.slack.com/…' : 'https://discord.com/api/webhooks/…'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="tf-navbar-btn active" disabled={webhookSaving || !webhookUrl}>
                    {webhookSaving ? <Spinner size="sm" className="me-1" /> : null} Save Webhook
                  </button>
                  <button
                    type="button"
                    className="tf-navbar-btn"
                    onClick={handleTestWebhook}
                    disabled={webhookTesting || !workspace?.webhookUrl}
                  >
                    {webhookTesting ? <Spinner size="sm" className="me-1" /> : <Send size={12} />} Test
                  </button>
                  {workspace?.webhookUrl && (
                    <button type="button" className="tf-navbar-btn danger" onClick={handleDeleteWebhook}>
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
                {workspace?.webhookUrl && (
                  <p style={{ fontSize: 12, color: 'var(--col-done)', marginTop: 8, marginBottom: 0 }}>
                    ✓ Webhook active ({workspace.webhookProvider})
                  </p>
                )}
              </form>
            </div>
          )}

          {/* ── Multi-Workspace Manager Section ── */}
          <div style={{
            background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)',
            borderRadius: 24, padding: '24px 32px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Building size={16} style={{ color: 'var(--tf-accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 650, color: 'var(--tf-ink)', margin: 0 }}>
                All Your Workspaces ({workspaces.length})
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
              You can belong to multiple workspaces with independent roles in each.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {workspaces.map((ws) => {
                const isActive = ws.workspaceId === currentWorkspace?.workspaceId;
                return (
                  <div
                    key={ws.workspaceId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 16,
                      background: isActive ? 'var(--tf-canvas-soft)' : 'transparent',
                      border: isActive ? '1px solid var(--tf-hairline)' : '1px solid var(--tf-hairline-soft)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--tf-ink)' }}>{ws.name}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'var(--tf-field)', color: 'var(--tf-text-muted)', textTransform: 'capitalize' }}>
                          {ws.role?.replace('_', ' ')}
                        </span>
                        {isActive && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Check size={12} /> Active
                          </span>
                        )}
                      </div>
                    </div>

                    {!isActive && (
                      <button
                        type="button"
                        className="tf-navbar-btn"
                        onClick={() => switchWorkspace(ws.workspaceId)}
                        style={{ height: 32, fontSize: 12, padding: '0 12px' }}
                      >
                        Switch to this
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add / Join Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Create Another Workspace */}
              <div style={{
                background: 'var(--tf-canvas-soft)', border: '1px solid var(--tf-hairline-soft)',
                borderRadius: 16, padding: '16px 20px',
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 4 }}>
                  Create Another Workspace
                </h4>
                <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', marginBottom: 12 }}>
                  You will become the Head of this workspace.
                </p>
                <form onSubmit={handleCreate}>
                  <input
                    type="text"
                    className="tf-input"
                    style={{ marginBottom: 10 }}
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                    required
                    placeholder="e.g. Design Guild"
                  />
                  <button type="submit" className="tf-navbar-btn active" disabled={loading} style={{ width: '100%' }}>
                    {loading ? <Spinner size="sm" /> : <><Plus size={13} /> Create</>}
                  </button>
                </form>
              </div>

              {/* Join via Invite Code */}
              <div style={{
                background: 'var(--tf-canvas-soft)', border: '1px solid var(--tf-hairline-soft)',
                borderRadius: 16, padding: '16px 20px',
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 650, color: 'var(--tf-ink)', marginBottom: 4 }}>
                  Join Another Workspace
                </h4>
                <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', marginBottom: 12 }}>
                  Enter an 8-character invite code.
                </p>
                <form onSubmit={handleJoin}>
                  <input
                    type="text"
                    className="tf-input"
                    style={{ marginBottom: 10, letterSpacing: '1px', textTransform: 'uppercase' }}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    required
                    maxLength={8}
                    placeholder="e.g. DEMO2026"
                  />
                  <button type="submit" className="tf-navbar-btn" disabled={loading} style={{ width: '100%' }}>
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

  // ── No workspace yet: first-time onboarding view ────────────────────────────
  return (
    <div className="tf-auth-wrapper" style={{ alignItems: 'flex-start', paddingTop: 80 }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <img src="/logo.png" alt="TaskForge" style={{ width: 40, height: 40, borderRadius: '30%' }} />
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--tf-text-strong)', letterSpacing: '-0.5px' }}>
              <span style={{ color: 'var(--tf-accent)' }}>Task</span>Forge
            </span>
          </div>
          <p style={{ color: 'var(--tf-text-muted)', fontSize: 14 }}>
            Create your first workspace or join an existing one with an invite code.
          </p>
        </div>

        {error && <Alert variant="danger" className="py-2 small mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{error}</Alert>}
        {success && <Alert variant="success" className="py-2 small mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{success}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Create */}
          <div style={{
            background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)',
            borderRadius: 24, padding: '24px',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tf-text-strong)', marginBottom: 4 }}>
              Create Workspace
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
              Start fresh and invite your team.
            </p>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Workspace name</label>
                <input
                  type="text"
                  className="tf-input"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                  placeholder="e.g. HR Team Alpha"
                />
              </div>
              <button type="submit" className="tf-navbar-btn active" style={{ width: '100%', height: 40 }} disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Create Workspace'}
              </button>
            </form>
          </div>

          {/* Join */}
          <div style={{
            background: 'var(--tf-canvas)', border: '1px solid var(--tf-hairline)',
            borderRadius: 24, padding: '24px',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tf-text-strong)', marginBottom: 4 }}>
              Join Workspace
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
              Have an 8-character invite code?
            </p>
            <form onSubmit={handleJoin}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: 12, fontWeight: 600 }}>Invite Code</label>
                <input
                  type="text"
                  className="tf-input"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  maxLength={8}
                  placeholder="e.g. DEMO2026"
                  style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                />
              </div>
              <button type="submit" className="tf-navbar-btn" style={{ width: '100%', height: 40 }} disabled={loading}>
                {loading ? <Spinner size="sm" /> : 'Join Workspace'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
