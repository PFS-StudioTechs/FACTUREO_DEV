import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';

const NAV = [
  { id: 'dashboard', label: 'Accueil',   icon: 'dashboard', path: '/' },
  { id: 'factures',  label: 'Factures',  icon: 'invoice',   path: '/factures' },
  { id: 'clients',   label: 'Clients',   icon: 'users',     path: '/clients' },
  { id: 'frais',     label: 'Frais',     icon: 'receipt',   path: '/notes-de-frais' },
  { id: 'previ',     label: 'Prévi.',    icon: 'trending',  path: '/previsionnel' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 56,
      background: 'var(--bg-1)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(item => {
        const active = isActive(item.path);
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? 'var(--accent-bright)' : 'var(--text-3)',
              fontSize: 10,
              fontWeight: active ? 600 : 400,
              transition: 'color 120ms',
              position: 'relative',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 24,
                height: 2,
                borderRadius: 999,
                background: 'var(--accent)',
              }} />
            )}
            <Icon name={item.icon} size={20} stroke={active ? 2 : 1.5} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
