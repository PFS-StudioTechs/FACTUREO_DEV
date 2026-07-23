import React from 'react';
import type { LucaChatMessage } from '@/hooks/useLucaConversation';
import { parseActionData, stripActionData } from '@/lib/luca/actionData';
import { Icon } from '@/components/ui/Icon';
import { InvoiceConfirm, type FactureData } from './actions/InvoiceConfirm';
import { ClientConfirm, type ClientActionData } from './actions/ClientConfirm';
import { EntrepriseConfirm, type EntrepriseActionData } from './actions/EntrepriseConfirm';
import { ForecastConfirm, type ForecastActionData } from './actions/ForecastConfirm';
import { ExpenseConfirm, type ExpenseActionData } from './actions/ExpenseConfirm';
import { FinaliserFactureConfirm, type FinaliserFactureActionData } from './actions/FinaliserFactureConfirm';
import { RelanceConfirm, type RelanceActionData } from './actions/RelanceConfirm';

export const LucaMessage = ({ message, onDelete }: { message: LucaChatMessage; onDelete?: (id: string) => void }) => {
  const isUser = message.role === 'user';
  const factureData = isUser ? null : parseActionData<FactureData>(message.content, 'FACTURE_DATA');
  const clientData = isUser ? null : parseActionData<ClientActionData>(message.content, 'CLIENT_DATA');
  const entrepriseData = isUser ? null : parseActionData<EntrepriseActionData>(message.content, 'ENTREPRISE_DATA');
  const forecastData = isUser ? null : parseActionData<ForecastActionData>(message.content, 'PREVISIONNEL_DATA');
  const expenseData = isUser ? null : parseActionData<ExpenseActionData>(message.content, 'NOTE_FRAIS_DATA');
  const finaliserData = isUser ? null : parseActionData<FinaliserFactureActionData>(message.content, 'FINALISER_FACTURE_DATA');
  const relanceData = isUser ? null : parseActionData<RelanceActionData>(message.content, 'RELANCE_DATA');
  let displayText = message.content;
  if (factureData) displayText = stripActionData(displayText, 'FACTURE_DATA');
  if (clientData) displayText = stripActionData(displayText, 'CLIENT_DATA');
  if (entrepriseData) displayText = stripActionData(displayText, 'ENTREPRISE_DATA');
  if (forecastData) displayText = stripActionData(displayText, 'PREVISIONNEL_DATA');
  if (expenseData) displayText = stripActionData(displayText, 'NOTE_FRAIS_DATA');
  if (finaliserData) displayText = stripActionData(displayText, 'FINALISER_FACTURE_DATA');
  if (relanceData) displayText = stripActionData(displayText, 'RELANCE_DATA');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{
        display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
        alignItems: 'center', gap: 4, width: '100%',
      }}>
        {!isUser && onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            title="Supprimer ce message"
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 'var(--r-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6,
            }}
          >
            <Icon name="trash" size={12} />
          </button>
        )}
        <div style={{
          maxWidth: '85%',
          background: isUser ? 'var(--accent-soft)' : 'var(--bg-3)',
          border: `1px solid ${isUser ? 'var(--border-accent)' : 'var(--border)'}`,
          borderRadius: 'var(--r-3)',
          padding: '8px 12px',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--text-1)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {displayText || (!isUser && '…')}
        </div>
        {isUser && onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            title="Supprimer ce message"
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 'var(--r-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6,
            }}
          >
            <Icon name="trash" size={12} />
          </button>
        )}
      </div>
      {factureData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <InvoiceConfirm data={factureData} />
        </div>
      )}
      {clientData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <ClientConfirm data={clientData} />
        </div>
      )}
      {entrepriseData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <EntrepriseConfirm data={entrepriseData} />
        </div>
      )}
      {forecastData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <ForecastConfirm data={forecastData} />
        </div>
      )}
      {expenseData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <ExpenseConfirm data={expenseData} />
        </div>
      )}
      {finaliserData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <FinaliserFactureConfirm data={finaliserData} />
        </div>
      )}
      {relanceData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <RelanceConfirm data={relanceData} />
        </div>
      )}
    </div>
  );
};
