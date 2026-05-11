import React from 'react';

interface LogoProps {
  mark?: boolean;
  size?: number;
  color?: string;
  accent?: string;
}

const Monogram = ({ size, accent }: { size: number; accent: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect width="28" height="28" rx="6" fill={accent} />
    <path
      d="M8 8h12 M8 8v12 M8 15h7 M8 20h5"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Logo = ({
  mark = false,
  size = 28,
  color = 'var(--text-1)',
  accent = 'var(--accent)',
}: LogoProps) => {
  if (mark) {
    return <Monogram size={size} accent={accent} />;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Monogram size={size} accent={accent} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: Math.round(size * 0.64),
          color,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'baseline',
        }}
      >
        Factur
        <span style={{ position: 'relative', display: 'inline-block' }}>
          é
          <span
            aria-hidden
            style={{
              position: 'absolute',
              bottom: -2,
              left: 0,
              right: 0,
              height: 2,
              background: accent,
              borderRadius: 1,
            }}
          />
        </span>
        o
      </span>
    </span>
  );
};
