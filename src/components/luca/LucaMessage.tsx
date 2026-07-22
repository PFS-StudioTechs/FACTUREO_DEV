import React from 'react';
import type { LucaChatMessage } from '@/hooks/useLucaConversation';

export const LucaMessage = ({ message }: { message: LucaChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
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
        {message.content || (!isUser && '…')}
      </div>
    </div>
  );
};
