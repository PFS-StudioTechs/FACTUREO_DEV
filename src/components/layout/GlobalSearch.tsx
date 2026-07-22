import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/Icon';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResults {
  invoices: { id: string; numero_facture: string; status: string | null }[];
  clients: { id: string; nom: string }[];
  companies: { id: string; nom: string }[];
}

const NAV_SHORTCUTS = [
  { label: 'Tableau de bord', icon: 'dashboard', path: '/', keywords: ['tableau', 'bord', 'dashboard', 'accueil'] },
  { label: 'Factures', icon: 'invoice', path: '/factures', keywords: ['facture', 'fact', 'invoice'] },
  { label: 'Clients', icon: 'users', path: '/clients', keywords: ['client'] },
  { label: 'Entreprises', icon: 'building', path: '/entreprises', keywords: ['entreprise', 'société', 'societe', 'company'] },
  { label: 'Notes de frais', icon: 'receipt', path: '/notes-de-frais', keywords: ['frais', 'note', 'dépense', 'depense', 'ndf'] },
  { label: 'Prévisionnel', icon: 'trending', path: '/previsionnel', keywords: ['prévisionnel', 'previsionnel', 'prévision', 'prevision', 'forecast'] },
  { label: 'Échéancier', icon: 'calendar', path: '/echeancier', keywords: ['échéancier', 'echeancier', 'échéance', 'echeance', 'obligation', 'fiscal'] },
  { label: 'Impayés & relances', icon: 'mail', path: '/relances', keywords: ['impayé', 'impaye', 'relance', 'retard', 'paiement'] },
  { label: 'Coffre documentaire', icon: 'fileCheck', path: '/coffre', keywords: ['coffre', 'document', 'ged', 'archive', 'conservation'] },
  { label: 'Assistant', icon: 'bell', path: '/assistant', keywords: ['assistant', 'attention', 'signal', 'alerte', 'rappel'] },
  { label: 'Paramètres', icon: 'settings', path: '/parametrage', keywords: ['paramètre', 'parametre', 'paramétrage', 'parametrage', 'settings'] },
];

export const GlobalSearch = ({ open, onClose }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const { data: results, isFetching } = useQuery<SearchResults>({
    queryKey: ['global-search', query],
    queryFn: async () => {
      const q = `%${query}%`;
      const [inv, cli, comp] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, numero_facture, status')
          .or(`numero_facture.ilike.${q},designation.ilike.${q},descriptif_mission.ilike.${q}`)
          .limit(5),
        supabase.from('clients').select('id, nom').ilike('nom', q).limit(5),
        supabase.from('companies').select('id, nom').ilike('nom', q).limit(5),
      ]);
      return {
        invoices: (inv.data || []) as { id: string; numero_facture: string; status: string | null }[],
        clients: (cli.data || []) as { id: string; nom: string }[],
        companies: (comp.data || []) as { id: string; nom: string }[],
      };
    },
    enabled: query.length >= 2,
  });

  const matchedNavs = query.length >= 2
    ? NAV_SHORTCUTS.filter(n =>
        n.keywords.some(k => k.includes(query.toLowerCase()) || query.toLowerCase().includes(k))
        || n.label.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const hasDbResults = results && (results.invoices.length > 0 || results.clients.length > 0 || results.companies.length > 0);
  const hasResults = matchedNavs.length > 0 || hasDbResults;
  const showEmpty = query.length >= 2 && !isFetching && !hasResults;

  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        style={{
          padding: 0,
          overflow: 'hidden',
          maxWidth: 560,
          gap: 0,
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          color: 'var(--text-1)',
        }}
        className="[&>button.absolute]:hidden"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Icon name="search" size={16} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une facture, client, page…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--text-1)',
              caretColor: 'var(--accent)',
            }}
          />
          {isFetching && <Icon name="refresh" size={14} color="var(--text-3)" />}
          <kbd style={{
            fontSize: 11,
            color: 'var(--text-3)',
            background: 'var(--bg-3)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 5px',
          }}>Esc</kbd>
        </div>

        {query.length < 2 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Saisir au moins 2 caractères pour rechercher
          </div>
        )}

        {showEmpty && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Aucun résultat pour « {query} »
          </div>
        )}

        {hasResults && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {matchedNavs.length > 0 && (
              <Section label="Pages">
                {matchedNavs.map(n => (
                  <ResultRow key={n.path} icon={n.icon} label={n.label} onClick={() => go(n.path)} />
                ))}
              </Section>
            )}
            {results && results.invoices.length > 0 && (
              <Section label="Factures">
                {results.invoices.map(inv => (
                  <ResultRow
                    key={inv.id}
                    icon="invoice"
                    label={inv.numero_facture}
                    sub={inv.status ?? undefined}
                    onClick={() => go('/factures')}
                  />
                ))}
              </Section>
            )}
            {results && results.clients.length > 0 && (
              <Section label="Clients">
                {results.clients.map(c => (
                  <ResultRow key={c.id} icon="users" label={c.nom} onClick={() => go('/clients')} />
                ))}
              </Section>
            )}
            {results && results.companies.length > 0 && (
              <Section label="Entreprises">
                {results.companies.map(c => (
                  <ResultRow key={c.id} icon="building" label={c.nom} onClick={() => go('/entreprises')} />
                ))}
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <div style={{
      padding: '8px 16px 4px',
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-3)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
    {children}
  </div>
);

const ResultRow = ({ icon, label, sub, onClick }: { icon: string; label: string; sub?: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 16px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--text-1)',
      fontSize: 13,
      textAlign: 'left',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
  >
    <Icon name={icon} size={14} color="var(--text-3)" />
    <span style={{ flex: 1 }}>{label}</span>
    {sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</span>}
    <Icon name="arrowRight" size={12} color="var(--text-3)" />
  </button>
);
