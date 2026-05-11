import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const ROUTE_META: { path: string; title: string; breadcrumb?: string[] }[] = [
  { path: '/parametrage',    title: 'Paramètres',      breadcrumb: ['Administration', 'Paramètres'] },
  { path: '/utilisateurs',   title: 'Utilisateurs',    breadcrumb: ['Administration', 'Utilisateurs'] },
  { path: '/entreprises',    title: 'Entreprises',     breadcrumb: ['Espace', 'Entreprises'] },
  { path: '/clients',        title: 'Clients',         breadcrumb: ['Espace', 'Clients'] },
  { path: '/factures',       title: 'Factures',        breadcrumb: ['Espace', 'Factures'] },
  { path: '/previsionnel',   title: 'Prévisionnel',    breadcrumb: ['Espace', 'Prévisionnel'] },
  { path: '/notes-de-frais', title: 'Notes de frais',  breadcrumb: ['Espace', 'Notes de frais'] },
  { path: '/',               title: 'Tableau de bord' },
];

const getMeta = (pathname: string) =>
  ROUTE_META.find(r => r.path === '/' ? pathname === '/' : pathname.startsWith(r.path))
  ?? { title: 'Facturéo' };

const AppShell = () => {
  const location = useLocation();

  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('factureo-theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('factureo-theme', theme);
  }, [theme]);

  const meta = getMeta(location.pathname);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-0)', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Topbar
          title={meta.title}
          breadcrumb={meta.breadcrumb}
          theme={theme}
          onTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
