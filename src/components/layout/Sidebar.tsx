import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { Button, Avatar, Kbd } from '@/components/ui/primitives';

const NAV = [
  { id: 'dashboard',   label: 'Tableau de bord', icon: 'dashboard', path: '/',               count: undefined as number | undefined },
  { id: 'factures',    label: 'Factures',        icon: 'invoice',   path: '/factures',       count: undefined as number | undefined },
  { id: 'clients',     label: 'Clients',         icon: 'users',     path: '/clients',        count: undefined as number | undefined },
  { id: 'entreprises', label: 'Entreprises',     icon: 'building',  path: '/entreprises',    count: undefined as number | undefined },
  { id: 'frais',       label: 'Notes de frais',  icon: 'receipt',   path: '/notes-de-frais', count: undefined as number | undefined },
  { id: 'previ',       label: 'Prévisionnel',    icon: 'trending',  path: '/previsionnel',   count: undefined as number | undefined },
  { id: 'echeancier',  label: 'Échéancier',      icon: 'calendar',  path: '/echeancier',     count: undefined as number | undefined },
  { id: 'relances',    label: 'Impayés & relances', icon: 'mail',   path: '/relances',       count: undefined as number | undefined },
  { id: 'coffre',      label: 'Coffre',          icon: 'fileCheck', path: '/coffre',        count: undefined as number | undefined },
  { id: 'assistant',   label: 'Assistant',       icon: 'bell',      path: '/assistant',      count: undefined as number | undefined },
];

const ADMIN_NAV = [
  { id: 'utilisateurs', label: 'Utilisateurs', icon: 'shield', path: '/utilisateurs', count: undefined as number | undefined },
  { id: 'params', label: 'Paramètres', icon: 'settings', path: '/parametrage', count: undefined as number | undefined },
];

interface SidebarProps {
  onOpenDS?: () => void;
  onOpenSearch?: () => void;
}

export const Sidebar = ({ onOpenDS, onOpenSearch }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, pseudo, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      flexShrink: 0,
      background: 'var(--bg-1)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 12px',
      gap: 4,
      position: 'relative',
      zIndex: 2,
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Workspace switcher */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 8px',
          borderRadius: 'var(--r-3)',
          marginBottom: 12,
          width: '100%',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Logo size={26} mark />
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            Facturéo
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {pseudo || 'Mon espace'}
          </span>
        </span>
        <Icon name="chevronDown" size={14} color="var(--text-3)" />
      </button>

      {/* Search */}
      <button
        onClick={onOpenSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          height: 34,
          background: 'var(--bg-2)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--r-3)',
          color: 'var(--text-3)',
          fontSize: 13,
          marginBottom: 14,
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <Icon name="search" size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Recherche…</span>
        <Kbd>⌘K</Kbd>
      </button>

      {/* New invoice */}
      <Button
        variant="primary"
        size="md"
        icon="plus"
        onClick={() => navigate('/factures')}
        style={{ marginBottom: 16, justifyContent: 'flex-start', width: '100%' }}
      >
        Nouvelle facture
      </Button>

      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-3)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: '6px 8px 4px',
      }}>
        Espace
      </div>

      {/* Nav items */}
      {navItems.map(item => {
        const active = isActive(item.path);
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '7px 10px',
              height: 32,
              borderRadius: 'var(--r-3)',
              background: active ? 'var(--bg-3)' : 'transparent',
              color: active ? 'var(--text-1)' : 'var(--text-2)',
              fontSize: 13,
              fontWeight: active ? 500 : 400,
              transition: 'all 120ms ease',
              position: 'relative',
              width: '100%',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--bg-2)';
                e.currentTarget.style.color = 'var(--text-1)';
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-2)';
              }
            }}
          >
            {active && (
              <span style={{
                position: 'absolute',
                left: -4,
                top: 8,
                bottom: 8,
                width: 2,
                background: 'var(--accent)',
                borderRadius: 999,
              }} />
            )}
            <Icon name={item.icon} size={15} stroke={1.6} />
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
            {item.count != null && (
              <span style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-3)',
                fontWeight: 500,
              }}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Design system link */}
      <button
        onClick={onOpenDS}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px',
          height: 32,
          borderRadius: 'var(--r-3)',
          color: 'var(--text-3)',
          fontSize: 12,
          width: '100%',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--bg-2)';
          e.currentTarget.style.color = 'var(--text-2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-3)';
        }}
      >
        <Icon name="layers" size={14} />
        <span style={{ flex: 1, textAlign: 'left' }}>Design system</span>
      </button>

      {/* User block */}
      <div style={{
        marginTop: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px',
        borderRadius: 'var(--r-3)',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-subtle)',
      }}>
        <Avatar name={pseudo || user?.email || '?'} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pseudo || 'Utilisateur'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email || ''}
          </div>
        </div>
        <button
          onClick={signOut}
          style={{ color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0 }}
          title="Se déconnecter"
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <Icon name="arrowRight" size={14} />
        </button>
      </div>
    </aside>
  );
};
