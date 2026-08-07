import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createWorkspace, joinWorkspace, generateInvite,
  saveWebhook, testWebhook, deleteWebhook,
} from '../api';
import { Alert, Spinner } from 'react-bootstrap';
import {
  Users, Copy, RefreshCw, LogOut, Webhook, Send, Trash2,
  CheckCircle2, XCircle, ArrowLeft, Zap, Shield, Crown, User,
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
  const { user, workspace, logout, refreshWorkspace, updateLocalUser } = useAuth();
  const navigate = useNavigate();

  const [wsName, setWsName]   = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Webhook
  const [webhookUrl, setWebhookUrl]       = useState('');
  const [webhookProvider, setWebhookProvider] = useState('slack');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);

  const canManage = user?.role === 'head' || user?.role === 'joint_head';

  useEffect(() => {
    if (user?.workspaceId && !workspace) refreshWorkspace();
  }, [user]);

  useEffect(() => {
    if (workspace?.webhookUrl) {
      setWebhookUrl(workspace.webhookUrl);
      setWebhookProvider(workspace.webhookProvider || 'slack');
    }
  }, [workspace]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await createWorkspace({ name: wsName });
      updateLocalUser({ workspaceId: res.data._id, role: 'head' });
      await refreshWorkspace();
      setSuccess('Workspace created!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workspace');
    } finally { setLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = await joinWorkspace(joinCode);
      updateLocalUser({ workspaceId: res.data.workspace._id });
      await refreshWorkspace();
      setSuccess('Joined workspace!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join workspace');
    } finally { setLoading(false); }
  };

  const handleRegenInvite = async () => {
    try {
      await generateInvite(workspace._id);
      await refreshWorkspace();
      setSuccess('Invite code regenerated!');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to regenerate invite'); }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(workspace.inviteCode);
    setSuccess('Copied!');
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
      setWebhookUrl(''); setWebhookProvider('slack');
      await refreshWorkspace();
      setWebhookStatus({ ok: true, message: 'Webhook removed.' });
    } catch (err) {
      setWebhookStatus({ ok: false, message: err.response?.data?.error || 'Failed to remove' });
    }
  };

  // ── Workspace view ─────────────────────────────────────────────────────────
  if (workspace) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--tf-bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Navbar */}
        <div className="tf-navbar">
          <a className="tf-navbar-brand" style={{ cursor: 'default' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={15} color="#fff" />
            </div>
            <span><span className="tf-brand-blue">Task</span>Forge</span>
          </a>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="tf-navbar-btn" onClick={() => navigate('/boards')}>
              <ArrowLeft size={13} /> Boards
            </button>
            <div className="tf-avatar" title={user?.name}>{initials(user?.name)}</div>
            <button className="tf-navbar-btn danger" onClick={logout}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '28px 32px', maxWidth: 780, margin: '0 auto', width: '100%' }}>
          {success && <Alert variant="success" className="py-2 small mb-3" dismissible onClose={() => setSuccess('')}>{success}</Alert>}
          {error && <Alert variant="danger" className="py-2 small mb-3" dismissible onClose={() => setError('')}>{error}</Alert>}

          {/* ── Workspace info card ── */}
          <div style={{
            background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 46, height: 46, borderRadius: 10,
                background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 800, color: '#fff',
              }}>
                {workspace.name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                  {workspace.name}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', margin: 0 }}>
                  {workspace.members?.length || 0} members
                </p>
              </div>
            </div>

            {/* Invite code */}
            <p className="tf-section-header">Invite Code</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                flex: 1, padding: '8px 14px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--tf-border)',
                fontSize: 16, fontWeight: 700, letterSpacing: 3, color: 'var(--tf-accent)',
              }}>
                {workspace.inviteCode}
              </code>
              <button className="tf-icon-btn" onClick={copyCode} title="Copy">
                <Copy size={14} />
              </button>
              {canManage && (
                <button className="tf-icon-btn" onClick={handleRegenInvite} title="Regenerate">
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>

          {/* ── Members card ── */}
          <div style={{
            background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
            borderRadius: 12, padding: '20px 24px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Users size={15} style={{ color: 'var(--tf-accent)' }} />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>Members</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {workspace.members?.map((m) => {
                const rc = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                const RIcon = rc.icon;
                return (
                  <div key={m._id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--tf-border-soft)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {initials(m.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-text-strong)', margin: 0 }}>{m.name}</p>
                      <p style={{ fontSize: 11.5, color: 'var(--tf-text-muted)', margin: 0 }}>{m.email}</p>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 20,
                      background: rc.bg, color: rc.color,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      <RIcon size={10} /> {rc.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Integrations card (admins only) ── */}
          {canManage && (
            <div style={{
              background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
              borderRadius: 12, padding: '20px 24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Webhook size={15} style={{ color: 'var(--tf-accent)' }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tf-text-strong)', margin: 0 }}>
                  Integrations
                </h3>
              </div>
              <p style={{ fontSize: 12, color: 'var(--tf-text-muted)', marginBottom: 16 }}>
                Post escalation alerts and task completions to Slack or Discord.
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
                    className="form-select"
                    value={webhookProvider}
                    onChange={(e) => setWebhookProvider(e.target.value)}
                    style={{ maxWidth: 120 }}
                  >
                    <option value="slack">Slack</option>
                    <option value="discord">Discord</option>
                  </select>
                  <input
                    type="url"
                    className="form-control"
                    placeholder={webhookProvider === 'slack' ? 'https://hooks.slack.com/…' : 'https://discord.com/api/webhooks/…'}
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="submit" className="tf-navbar-btn active" disabled={webhookSaving || !webhookUrl}>
                    {webhookSaving ? <Spinner size="sm" className="me-1" /> : null} Save
                  </button>
                  <button
                    type="button"
                    className="tf-navbar-btn"
                    onClick={handleTestWebhook}
                    disabled={webhookTesting || !workspace?.webhookUrl}
                    title={!workspace?.webhookUrl ? 'Save a URL first' : undefined}
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
                  <p style={{ fontSize: 11.5, color: 'var(--col-done)', marginTop: 8, marginBottom: 0 }}>
                    ✓ Webhook active ({workspace.webhookProvider})
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No workspace: create or join ───────────────────────────────────────────
  return (
    <div className="tf-auth-wrapper" style={{ alignItems: 'flex-start', paddingTop: 80 }}>
      <div style={{ width: '100%', maxWidth: 720 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg,var(--tf-accent) 0%,#ae4cfc 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={22} color="#fff" />
            </div>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--tf-text-strong)', letterSpacing: '-0.5px' }}>
              <span style={{ color: 'var(--tf-accent)' }}>Task</span>Forge
            </span>
          </div>
          <p style={{ color: 'var(--tf-text-muted)', fontSize: 14 }}>
            Create a workspace or join one with an invite code
          </p>
        </div>

        {error && <Alert variant="danger" className="py-2 small mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{error}</Alert>}
        {success && <Alert variant="success" className="py-2 small mb-4" style={{ maxWidth: 480, margin: '0 auto 16px' }}>{success}</Alert>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Create */}
          <div style={{
            background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
            borderRadius: 12, padding: '24px',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-text-strong)', marginBottom: 4 }}>
              Create Workspace
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
              Start fresh and invite your team.
            </p>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Workspace name</label>
                <input
                  type="text"
                  className="form-control"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  required
                  placeholder="e.g. HR Team Alpha"
                />
              </div>
              <button
                type="submit"
                className="tf-navbar-btn active"
                disabled={loading}
                style={{ width: '100%', height: 38, fontWeight: 600, justifyContent: 'center' }}
              >
                {loading ? <Spinner size="sm" className="me-1" /> : null}
                Create workspace
              </button>
            </form>
          </div>

          {/* Join */}
          <div style={{
            background: 'var(--tf-col-bg)', border: '1px solid var(--tf-border)',
            borderRadius: 12, padding: '24px',
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-text-strong)', marginBottom: 4 }}>
              Join Workspace
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--tf-text-muted)', marginBottom: 18 }}>
              Use an invite code from your team.
            </p>
            <form onSubmit={handleJoin}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Invite code</label>
                <input
                  type="text"
                  className="form-control"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  required
                  placeholder="e.g. A1B2C3D4"
                  style={{ letterSpacing: 2 }}
                />
              </div>
              <button
                type="submit"
                className="tf-navbar-btn"
                disabled={loading}
                style={{ width: '100%', height: 38, fontWeight: 600, justifyContent: 'center', background: 'rgba(255,255,255,0.08)' }}
              >
                {loading ? <Spinner size="sm" className="me-1" /> : null}
                Join workspace
              </button>
            </form>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            className="tf-navbar-btn"
            onClick={logout}
            style={{ margin: '0 auto', color: 'var(--tf-text-muted)' }}
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
