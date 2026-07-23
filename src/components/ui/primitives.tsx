import React, { useState } from 'react';
import { Icon } from './Icon';

/* ─── Button ─── */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'subtle' | 'danger' | 'accent_facturx';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  onClick,
  style,
  ...rest
}: ButtonProps) => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    borderRadius: 'var(--r-3)',
    cursor: 'pointer',
    transition: 'all 140ms ease',
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
  };

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '6px 10px', fontSize: 13, height: 28 },
    md: { padding: '8px 14px', fontSize: 14, height: 36 },
    lg: { padding: '11px 18px', fontSize: 15, height: 44 },
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-on)',
      boxShadow: 'var(--shadow-accent), inset 0 1px 0 rgba(255,255,255,0.16)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-1)',
      border: '1px solid var(--border)',
    },
    subtle: {
      background: 'var(--bg-3)',
      color: 'var(--text-1)',
      border: '1px solid var(--border)',
    },
    danger: {
      background: 'var(--danger-soft)',
      color: 'var(--danger)',
      border: '1px solid var(--danger-soft)',
    },
    accent_facturx: {
      background: 'var(--accent-soft)',
      color: 'var(--accent-bright)',
      border: '1px solid var(--border-accent)',
    },
  };

  return (
    <button
      onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      onMouseEnter={e => {
        if (variant === 'primary') { e.currentTarget.style.background = 'var(--accent-bright)'; }
        else if (variant === 'ghost') { e.currentTarget.style.background = 'var(--bg-hover)'; }
        else if (variant === 'subtle') { e.currentTarget.style.background = 'var(--bg-4)'; }
      }}
      onMouseLeave={e => {
        const v = variants[variant];
        const el = e.currentTarget;
        if (typeof v.background === 'string') el.style.background = v.background;
        if (typeof v.boxShadow === 'string') el.style.boxShadow = v.boxShadow;
        if (typeof v.border === 'string') el.style.border = v.border;
        if (typeof v.color === 'string') el.style.color = v.color;
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 18 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 18 : 16} />}
    </button>
  );
};

/* ─── Pill ─── */
interface PillProps {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'solid';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  dot?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Pill = ({ tone = 'neutral', size = 'md', icon, dot, children, style }: PillProps) => {
  const tones: Record<string, { bg: string; fg: string; border: string }> = {
    neutral: { bg: 'var(--bg-3)',        fg: 'var(--text-2)',       border: 'var(--border)' },
    accent:  { bg: 'var(--accent-soft)', fg: 'var(--accent-bright)', border: 'var(--border-accent)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)',      border: 'transparent' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)',      border: 'transparent' },
    danger:  { bg: 'var(--danger-soft)',  fg: 'var(--danger)',       border: 'transparent' },
    info:    { bg: 'var(--info-soft)',    fg: 'var(--info)',         border: 'transparent' },
    solid:   { bg: 'var(--text-1)',       fg: 'var(--bg-0)',         border: 'transparent' },
  };

  const sizes: Record<string, React.CSSProperties> = {
    sm: { padding: '2px 7px',  fontSize: 11, height: 18, gap: 4 },
    md: { padding: '3px 9px',  fontSize: 12, height: 22, gap: 5 },
    lg: { padding: '5px 11px', fontSize: 13, height: 26, gap: 6 },
  };

  const t = tones[tone];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        fontWeight: 500,
        ...sizes[size],
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: t.fg,
            marginRight: 2,
          }}
        />
      )}
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
};

/* ─── Card ─── */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: number;
  hover?: boolean;
}

export const Card = ({ children, padding = 18, hover = false, style, onClick, ...rest }: CardProps) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } }) : undefined}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-4)',
        padding,
        position: 'relative',
        transition: 'transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease, border-color 200ms ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? 'var(--shadow-2), var(--accent-glow)' : 'var(--shadow-1)',
        borderColor: hovered ? 'var(--border-strong)' : 'var(--border)',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};

/* ─── FacturXBadge ─── */
interface FacturXBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  stamped?: boolean;
  style?: React.CSSProperties;
}

export const FacturXBadge = ({ size = 'md', stamped = false, style }: FacturXBadgeProps) => {
  const sizes = {
    sm: { padding: '2px 7px',  fontSize: 9.5,  gap: 4,  ic: 11, lh: 1.1 },
    md: { padding: '3px 9px',  fontSize: 10.5, gap: 5,  ic: 12, lh: 1.1 },
    lg: { padding: '5px 12px', fontSize: 12,   gap: 6,  ic: 14, lh: 1.15 },
  };
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        background: 'transparent',
        color: 'var(--accent-bright)',
        border: '1.5px solid var(--accent-bright)',
        borderRadius: 'var(--r-2)',
        padding: s.padding,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        fontSize: s.fontSize,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: s.lh,
        position: 'relative',
        transform: 'rotate(-2deg)',
        animation: stamped ? 'stamp 600ms cubic-bezier(.2,.8,.3,1.1) backwards' : 'none',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          opacity: 0.18,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='2'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0 0 0 1 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <Icon name="check" size={s.ic} stroke={2.4} />
      <span>FACTUR-X</span>
    </span>
  );
};

/* ─── Input ─── */
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  icon?: string;
  suffix?: React.ReactNode;
}

export const Input = ({ label, hint, icon, suffix, value, onChange, placeholder, type = 'text', style, ...rest }: InputProps) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && (
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{label}</span>
    )}
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-3)',
        padding: '8px 12px',
        height: 38,
        transition: 'border-color 140ms, box-shadow 140ms',
        ...style,
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'var(--accent)';
        e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {icon && <Icon name={icon} size={15} color="var(--text-3)" />}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 0,
          background: 'transparent',
          outline: 0,
          color: 'var(--text-1)',
          fontSize: 14,
          minWidth: 0,
        }}
        {...rest}
      />
      {suffix && (
        <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{suffix}</span>
      )}
    </span>
    {hint && (
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>
    )}
  </label>
);

/* ─── Avatar ─── */
interface AvatarProps {
  name?: string;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export const Avatar = ({ name = '?', size = 32, color, style }: AvatarProps) => {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color || `hsl(${hue}, 24%, 28%)`,
        color: '#fff',
        fontSize: size * 0.38,
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.02em',
        flexShrink: 0,
        border: '1px solid var(--border)',
        ...style,
      }}
    >
      {initials}
    </span>
  );
};

/* ─── Kbd ─── */
interface KbdProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Kbd = ({ children, style }: KbdProps) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 4px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 500,
      color: 'var(--text-2)',
      background: 'var(--bg-3)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-1)',
      boxShadow: 'inset 0 -1px 0 var(--border)',
      ...style,
    }}
  >
    {children}
  </kbd>
);

/* ─── Money ─── */
interface MoneyProps {
  value: string | number;
  currency?: string;
  size?: string | number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}

export const Money = ({ value, currency = '€', size, color, weight = 500, style }: MoneyProps) => (
  <span
    style={{
      fontFamily: 'var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      fontSize: size,
      fontWeight: weight,
      color,
      ...style,
    }}
  >
    {value}{currency ? ' ' + currency : ''}
  </span>
);

/* ─── Toggle ─── */
interface ToggleProps {
  on?: boolean;
  onChange?: (value: boolean) => void;
  label?: string;
  hint?: string;
}

export const Toggle = ({ on, onChange, label, hint }: ToggleProps) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
    <button
      type="button"
      onClick={() => onChange?.(!on)}
      style={{
        width: 34,
        height: 20,
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--bg-4)',
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--border)'),
        position: 'relative',
        flexShrink: 0,
        transition: 'background 180ms ease',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: on ? 15 : 1,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 180ms cubic-bezier(.2,.8,.3,1.1)',
          boxShadow: '0 1px 2px rgba(0,0,0,.3)',
        }}
      />
    </button>
    {label && (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{label}</span>
        {hint && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>}
      </span>
    )}
  </label>
);

/* ─── Progress ─── */
interface ProgressProps {
  value: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  height?: number;
}

export const Progress = ({ value, tone = 'accent', height = 4 }: ProgressProps) => {
  const fg: Record<string, string> = {
    accent:  'var(--accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger:  'var(--danger)',
  };

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: 999,
        background: 'var(--bg-4)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%',
          background: fg[tone],
          borderRadius: 999,
          transition: 'width 400ms ease',
        }}
      />
    </div>
  );
};
