import React from 'react';
import type { LucaChatMessage } from '@/hooks/useLucaConversation';
import { parseActionData, stripActionData } from '@/lib/luca/actionData';
import { InvoiceConfirm, type FactureData } from './actions/InvoiceConfirm';

export const LucaMessage = ({ message }: { message: LucaChatMessage }) => {
  const isUser = message.role === 'user';
  const factureData = isUser ? null : parseActionData<FactureData>(message.content, 'FACTURE_DATA');
  const displayText = factureData ? stripActionData(message.content, 'FACTURE_DATA') : message.content;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', width: '100%' }}>
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
      </div>
      {factureData && (
        <div style={{ width: '100%', maxWidth: '85%' }}>
          <InvoiceConfirm data={factureData} />
        </div>
      )}
    </div>
  );
};
