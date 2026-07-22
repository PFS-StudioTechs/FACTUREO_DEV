import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GlobalSearch } from './GlobalSearch';
import { BottomNav } from './BottomNav';
import { LucaBubble } from '@/components/luca/LucaBubble';
import { useIsMobile } from '@/hooks/use-mobile';

const ROUTE_META: { path: string; title: string; breadcrumb?: string[] }[] = [
  { path: '/parametrage',    title: 'Paramètres',      breadcrumb: ['Administration', 'Paramètres'] },
  { path: '/utilisateurs',   title: 'Utilisateurs',    breadcrumb: ['Administration', 'Utilisateurs'] },
  { path: '/entreprises',    title: 'Entreprises',     breadcrumb: ['Espace', 'Entreprises'] },
  { path: '/clients',        title: 'Clients',         breadcrumb: ['Espace', 'Clients'] },
  { path: '/factures',       title: 'Factures',        breadcrumb: ['Espace', 'Factures'] },
  { path: '/previsionnel',   title: 'Prévisionnel',    breadcrumb: ['Espace', 'Prévisionnel'] },
  { path: '/notes-de-frais', title: 'Notes de frais',  breadcrumb: ['Espace', 'Notes de frais'] },
  { path: '/echeancier',     title: 'Échéancier',      breadcrumb: ['Espace', 'Échéancier'] },
  { path: '/relances',       title: 'Impayés & relances', breadcrumb: ['Espace', 'Impayés & relances'] },
  { path: '/coffre',         title: 'Coffre',          breadcrumb: ['Espace', 'Coffre'] },
  { path: '/',               title: 'Tableau de bord' },
];

const getMeta = (pathname: string) =>
  ROUTE_META.find(r => r.path === '/' ? pathname === '/' : pathname.startsWith(r.path))
  ?? { title: 'Facturéo' };

const AppShell = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);

  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('factureo-theme') as 'dark' | 'light') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('factureo-theme', theme);
  }, [theme]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const meta = getMeta(location.pathname);

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-0)', overflow: 'hidden' }}>
      {!isMobile && <Sidebar onOpenSearch={() => setSearchOpen(true)} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Topbar
          title={meta.title}
          breadcrumb={isMobile ? undefined : meta.breadcrumb}
          theme={theme}
          onTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        />
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: isMobile ? 56 : 0 }}>
          <Outlet />
        </main>
      </div>
      {isMobile && <BottomNav />}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <LucaBubble />
    </div>
  );
};

export default AppShell;
