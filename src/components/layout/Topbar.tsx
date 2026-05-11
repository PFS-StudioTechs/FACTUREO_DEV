import React from 'react';
import { Icon } from '@/components/ui/Icon';

interface TopbarProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  right?: React.ReactNode;
  theme: 'dark' | 'light';
  onTheme: () => void;
}

export const Topbar = ({ title, subtitle, breadcrumb, right, theme, onTheme }: TopbarProps) => (
  <header style={{
    height: 'var(--topbar-h)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '0 24px',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-1)',
    position: 'relative',
    zIndex: 1,
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
          {breadcrumb.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Icon name="chevronRight" size={11} />}
              <span>{b}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h1 style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-1)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {title}
        </h1>
        {subtitle && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</span>
        )}
      </div>
    </div>

    <div style={{ flex: 1 }} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {right}

      {/* Theme toggle */}
      <button
        onClick={onTheme}
        title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        style={{
          width: 32,
          height: 32,
          borderRadius: 'var(--r-3)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-2)',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-2)',
          cursor: 'pointer',
          transition: 'background 140ms ease, color 140ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
      </button>

      {/* Notifications */}
      <button style={{
        width: 32,
        height: 32,
        borderRadius: 'var(--r-3)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-2)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-2)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 140ms ease, color 140ms ease',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-1)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-2)'; e.currentTarget.style.color = 'var(--text-2)'; }}
      >
        <Icon name="bell" size={15} />
        <span style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: 'var(--accent)',
        }} />
      </button>
    </div>
  </header>
);
