import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, Check, Plus, Building2, ShieldCheck } from 'lucide-react';

export default function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!workspaces || workspaces.length === 0) {
    return null;
  }

  const roleLabel = {
    head: 'Head',
    joint_head: 'Joint Head',
    member: 'Member',
  };

  const initialLetter = currentWorkspace?.name ? currentWorkspace.name[0].toUpperCase() : 'W';

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="tf-navbar-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          padding: '0 12px 0 6px',
          background: 'var(--tf-canvas)',
          border: '1px solid var(--tf-hairline)',
          borderRadius: 'var(--tf-radius-full)',
          color: 'var(--tf-ink)',
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          transition: 'var(--tf-transition)',
        }}
        title="Switch active engineering workspace"
      >
        {/* 30% Squircle Organization Badge */}
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '30%',
            background: 'var(--tf-ink)',
            color: 'var(--tf-on-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initialLetter}
        </span>

        <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentWorkspace?.name || 'Workspace'}
        </span>

        {currentWorkspace?.role && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '1px 6px',
              borderRadius: 'var(--tf-radius-full)',
              background: 'var(--tf-canvas-soft)',
              color: 'var(--tf-text-muted)',
              border: '1px solid var(--tf-hairline-soft)',
            }}
          >
            {roleLabel[currentWorkspace.role] || currentWorkspace.role}
          </span>
        )}

        <ChevronDown
          size={12}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--tf-text-muted)',
            marginLeft: 2,
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 270,
            backgroundColor: 'var(--tf-canvas)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-sm)',
            boxShadow: 'var(--tf-shadow-subtle)',
            zIndex: 1100,
            padding: '6px',
            animation: 'dropDown 0.12s ease',
          }}
        >
          <div
            style={{
              padding: '6px 10px 4px',
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--tf-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Workspaces</span>
            <span className="tf-mono">{workspaces.length}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {workspaces.map((ws) => {
              const isSelected = ws.workspaceId === currentWorkspace?.workspaceId;
              const wsInitial = ws.name ? ws.name[0].toUpperCase() : 'W';

              return (
                <button
                  key={ws.workspaceId}
                  type="button"
                  onClick={() => {
                    switchWorkspace(ws.workspaceId);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: 'var(--tf-radius-full)',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--tf-canvas-soft)' : 'transparent',
                    color: 'var(--tf-ink)',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'var(--tf-transition)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--tf-canvas-soft)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '30%',
                        background: isSelected ? 'var(--tf-accent)' : 'var(--tf-ink)',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {wsInitial}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {ws.name}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--tf-text-muted)' }}>
                        {roleLabel[ws.role] || ws.role}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} style={{ color: 'var(--tf-accent)', flexShrink: 0, marginLeft: 6 }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--tf-hairline-soft)', margin: '5px 4px' }} />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/workspace');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--tf-radius-full)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--tf-accent)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--tf-transition)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--tf-accent-dim)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Plus size={13} />
            Manage & Join Workspaces
          </button>
        </div>
      )}
    </div>
  );
}
