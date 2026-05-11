import React from 'react';

const SkeletonLine = ({ w, h = 10 }: { w: string; h?: number }) => (
  <div style={{
    width: w, height: h, borderRadius: 4,
    background: 'var(--bg-4)',
    animation: 'skeleton-shimmer 1.4s linear infinite',
  }} />
);

export const ExpenseSkeleton = () => (
  <>
    <style>{`
      @keyframes skeleton-shimmer {
        0%   { opacity: 0.6; }
        50%  { opacity: 1; }
        100% { opacity: 0.6; }
      }
    `}</style>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-4)', overflow: 'hidden',
        }}>
          <div style={{ height: 100, background: 'var(--bg-3)' }} />
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SkeletonLine w="70%" h={13} />
            <SkeletonLine w="50%" />
            <SkeletonLine w="40%" h={13} />
          </div>
        </div>
      ))}
    </div>
  </>
);
