import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useAuth();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
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

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="tf-nav-pill"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          padding: '6px 14px',
          fontWeight: 600,
          fontSize: 13,
          backgroundColor: 'var(--tf-surface)',
          border: '1px solid var(--tf-hairline)',
          borderRadius: 'var(--tf-radius-full)',
          color: 'var(--tf-text-strong)',
          transition: 'all 0.15s ease',
        }}
        title="Switch Workspace"
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: 'var(--tf-accent)',
            display: 'inline-block',
          }}
        />
        <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentWorkspace?.name || 'Workspace'}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--tf-text-muted)',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: 260,
            backgroundColor: 'var(--tf-surface)',
            border: '1px solid var(--tf-hairline)',
            borderRadius: 'var(--tf-radius-md)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
            zIndex: 1000,
            padding: '8px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--tf-text-muted)',
            }}
          >
            Workspaces ({workspaces.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto' }}>
            {workspaces.map((ws) => {
              const isSelected = ws.workspaceId === currentWorkspace?.workspaceId;
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
                    padding: '8px 10px',
                    borderRadius: 'var(--tf-radius-sm)',
                    border: 'none',
                    backgroundColor: isSelected ? 'var(--tf-field)' : 'transparent',
                    color: 'var(--tf-text-strong)',
                    fontSize: 13,
                    fontWeight: isSelected ? 600 : 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--tf-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ws.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--tf-text-muted)' }}>
                      {roleLabel[ws.role] || ws.role}
                    </span>
                  </div>

                  {isSelected && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--tf-accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, marginLeft: 8 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, backgroundColor: 'var(--tf-hairline)', margin: '6px 0' }} />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/workspace');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--tf-radius-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--tf-accent)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--tf-surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add or Join Workspace
          </button>
        </div>
      )}
    </div>
  );
}
