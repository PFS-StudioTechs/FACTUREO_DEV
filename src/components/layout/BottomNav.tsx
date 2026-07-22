import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Icon } from '@/components/ui/Icon';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Accueil',  icon: 'dashboard', path: '/' },
  { id: 'factures',  label: 'Factures', icon: 'invoice',   path: '/factures' },
  { id: 'clients',   label: 'Clients',  icon: 'users',     path: '/clients' },
  { id: 'frais',     label: 'Frais',    icon: 'receipt',   path: '/notes-de-frais' },
];

const MORE_NAV = [
  { id: 'entreprises', label: 'Entreprises',  icon: 'building', path: '/entreprises' },
  { id: 'previ',       label: 'Prévisionnel', icon: 'trending',  path: '/previsionnel' },
  { id: 'echeancier',  label: 'Échéancier',   icon: 'calendar',  path: '/echeancier' },
];

const ADMIN_NAV = [
  { id: 'utilisateurs', label: 'Utilisateurs', icon: 'shield',   path: '/utilisateurs' },
  { id: 'params',       label: 'Paramètres',   icon: 'settings', path: '/parametrage' },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const go = (path: string) => { navigate(path); setMoreOpen(false); };

  const moreItems = isAdmin ? [...MORE_NAV, ...ADMIN_NAV] : MORE_NAV;
  const anyMoreActive = moreItems.some(item => isActive(item.path));

  return (
    <>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 98,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Slide-up drawer */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 56,
        zIndex: 99,
        background: 'var(--bg-2)',
        borderTop: '1px solid var(--border)',
        borderRadius: '16px 16px 0 0',
        padding: '12px 12px 8px',
        transform: moreOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(.2,.7,.3,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,.3)',
        pointerEvents: moreOpen ? 'auto' : 'none',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border)',
          margin: '0 auto 14px',
        }} />

        {moreItems.map(item => {
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => go(item.path)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', borderRadius: 'var(--r-3)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent-bright)' : 'var(--text-1)',
                fontSize: 15, fontWeight: active ? 600 : 400,
                cursor: 'pointer', border: 'none',
              }}
            >
              <Icon name={item.icon} size={20} stroke={active ? 2 : 1.5} />
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {active && <Icon name="check" size={14} color="var(--accent-bright)" />}
            </button>
          );
        })}

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />

        <button
          onClick={async () => { setMoreOpen(false); await signOut(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px', borderRadius: 'var(--r-3)',
            color: 'var(--text-2)', fontSize: 15, fontWeight: 400,
            cursor: 'pointer', background: 'transparent', border: 'none',
          }}
        >
          <Icon name="arrowRight" size={20} stroke={1.5} />
          <span style={{ textAlign: 'left' }}>Se déconnecter</span>
        </button>
      </div>

      {/* Nav bar */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 56,
        background: 'var(--bg-1)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {MAIN_NAV.map(item => {
          const active = isActive(item.path);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 3, background: 'none', border: 'none', cursor: 'pointer',
                color: active ? 'var(--accent-bright)' : 'var(--text-3)',
                fontSize: 10, fontWeight: active ? 600 : 400,
                transition: 'color 120ms', position: 'relative',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 24, height: 2, borderRadius: 999, background: 'var(--accent)',
                }} />
              )}
              <Icon name={item.icon} size={20} stroke={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Plus */}
        <button
          onClick={() => setMoreOpen(o => !o)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 3, background: 'none', border: 'none', cursor: 'pointer',
            color: (moreOpen || anyMoreActive) ? 'var(--accent-bright)' : 'var(--text-3)',
            fontSize: 10, fontWeight: (moreOpen || anyMoreActive) ? 600 : 400,
            transition: 'color 120ms', position: 'relative',
          }}
        >
          {anyMoreActive && !moreOpen && (
            <span style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 24, height: 2, borderRadius: 999, background: 'var(--accent)',
            }} />
          )}
          <Icon name="moreH" size={20} stroke={moreOpen ? 2 : 1.5} />
          <span>Plus</span>
        </button>
      </nav>
    </>
  );
};
