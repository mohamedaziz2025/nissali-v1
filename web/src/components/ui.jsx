'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Sparkline } from './Charts';
import Icon from './Icons';

export function Badge({ status, map }) {
  const [label, tone] = map[status] || [status, 'neutral'];
  return <span className={`badge ${tone}`}>{label}</span>;
}

/** Ancienne tuile (conservée pour les pages simples). */
export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`card stat ${tone || ''}`}>
      <div className={`label ${tone === 'hero' ? 'rose' : ''}`}>{label}</div>
      <div className="value num">{value}</div>
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Trend({ value, suffix = 'vs période précédente' }) {
  if (value == null) return null;
  const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`trend ${dir}`}>
        {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '•'} {Math.abs(value)} %
      </span>
      <span className="kpi-hint">{suffix}</span>
    </span>
  );
}

/** Indicateur clé : icône, libellé, valeur, tendance et mini-courbe facultatives. */
export function Kpi({ icon, label, value, hint, trend, trendSuffix, spark, tone }) {
  return (
    <div className={`card kpi ${tone || ''}`}>
      <div className="kpi-top">
        {icon ? (
          <span className="kpi-icon">
            <Icon name={icon} />
          </span>
        ) : null}
        <span>{label}</span>
      </div>
      <div className="kpi-value num">{value}</div>
      <div className="kpi-foot">
        {trend !== undefined && trend !== null ? <Trend value={trend} suffix={trendSuffix} /> : <span className="kpi-hint">{hint}</span>}
        {spark?.length > 1 ? <Sparkline data={spark} tone={tone === 'hero' ? 'light' : 'dark'} /> : null}
      </div>
    </div>
  );
}

const TONES = ['t1', 't2', 't3', 't4', 't5'];
export function Avatar({ name = '?', src, size }) {
  const n = [...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const initials = String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className={`avatar ${TONES[n % TONES.length]} ${size === 'lg' ? 'lg' : ''}`} aria-hidden="true" style={typeof size === 'number' ? { width: size, height: size, fontSize: Math.round(size * 0.36) } : undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        initials || '?'
      )}
    </span>
  );
}

export function Empty({ icon = 'sparkle', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      {title ? <strong>{title}</strong> : null}
      {children ? <span>{children}</span> : null}
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function CardHead({ title, subtitle, action }) {
  return (
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Tabs({ items, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {items.map((it) => {
        const [k, l] = Array.isArray(it) ? it : [it.key, it.label];
        return (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {l}
        </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint, error }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="error">{error}</small> : hint ? <small className="muted small">{hint}</small> : null}
    </label>
  );
}

export function Chips({ items, value, onChange, multi }) {
  const on = (k) => (multi ? (value || []).includes(k) : value === k);
  const toggle = (k) => {
    if (!multi) return onChange(k);
    const set = new Set(value || []);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    onChange([...set]);
  };
  return (
    <div className="chips">
      {items.map((i) => (
        <button type="button" key={String(i.key)} className={`chip ${on(i.key) ? 'on' : ''}`} onClick={() => toggle(i.key)} aria-pressed={on(i.key)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
        {footer ? <div className="row" style={{ justifyContent: 'flex-end' }}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="empty">
      <span className="muted">Chargement…</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card soft row between">
      <span>{error.message}</span>
      {onRetry ? (
        <button className="btn sm outline" onClick={onRetry}>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((text, tone = 'info') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <div className={`toast ${toast.tone === 'error' ? 'error' : ''}`} role="status">
          {toast.text}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
