'use client';
// Graphiques à une série (pas de légende : le titre de la carte nomme la série).
// Courbe : ligne 2 px, voile à 10 %, curseur vertical qui s'aligne sur la date la plus proche.
// Colonnes : ≤ 24 px, extrémité arrondie, chaque colonne a sa propre infobulle.
import { useEffect, useMemo, useRef, useState } from 'react';

const INK = '#76565e';
const GRID = '#efe3e5';
const SERIES = '#7a1f35';

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Maximum de l'axe : 4 graduations entières (1, 2 ou 5 × 10ⁿ par pas). */
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
function niceMax(v) {
  const raw = Math.max(1, v) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = STEPS.map((k) => k * pow).find((st) => st >= raw && Number.isInteger(st)) || 10 * pow;
  return Math.max(1, step) * 4;
}

export function AreaChart({ data, height = 240, format = (v) => v, label, xLabel = (d) => d.label }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const geo = useMemo(() => {
    if (!width || data.length < 2) return null;
    const max = niceMax(Math.max(...data.map((d) => d.value), 1));
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (i / (data.length - 1)) * w;
    const y = (v) => pad.top + h - (v / max) * h;
    const pts = data.map((d, i) => [x(i), y(d.value)]);
    const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0]},${pad.top + h} L${pad.left},${pad.top + h} Z`;
    const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
    const every = Math.ceil(data.length / Math.max(2, Math.floor(w / 70)));
    return { max, w, h, x, y, pts, line, area, ticks, every };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, data, height]);

  const onMove = (e) => {
    if (!geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.left) / geo.w) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div ref={ref} className="chart">
      {geo ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label} : total ${format(total)}, maximum ${format(Math.max(...data.map((d) => d.value)))}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? data.length) - 1));
          }}
          onBlur={() => setHover(null)}
          style={{ display: 'block', outline: 'none' }}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={geo.y(t)} y2={geo.y(t)} stroke={GRID} strokeWidth="1" />
              <text x={pad.left - 8} y={geo.y(t) + 4} fontSize="11" textAnchor="end" fill={INK} className="num">
                {format(Math.round(t * 10) / 10)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            (i % geo.every === 0 && data.length - 1 - i >= geo.every * 0.6) || i === data.length - 1 ? (
              <text key={d.key || i} x={geo.x(i)} y={height - 8} fontSize="11" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} fill={INK}>
                {xLabel(d)}
              </text>
            ) : null,
          )}
          <path d={geo.area} fill={SERIES} opacity="0.1" />
          <path d={geo.line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover != null ? (
            <>
              <line x1={geo.pts[hover][0]} x2={geo.pts[hover][0]} y1={pad.top} y2={pad.top + geo.h} stroke={INK} strokeWidth="1" />
              <circle cx={geo.pts[hover][0]} cy={geo.pts[hover][1]} r="5" fill={SERIES} stroke="#fff" strokeWidth="2" />
            </>
          ) : (
            <circle cx={geo.pts[geo.pts.length - 1][0]} cy={geo.pts[geo.pts.length - 1][1]} r="4.5" fill={SERIES} stroke="#fff" strokeWidth="2" />
          )}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {geo && hover != null ? (
        <div className="chart-tip" style={{ left: geo.pts[hover][0], top: geo.pts[hover][1] }}>
          <strong className="num">{format(data[hover].value)}</strong>
          <span>{data[hover].tooltip || xLabel(data[hover])}</span>
        </div>
      ) : null}
    </div>
  );
}

export function ColumnChart({ data, height = 220, format = (v) => v, label }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const pad = { top: 22, right: 8, bottom: 28, left: 40 };
  if (!data.length) return <p className="muted small">Pas encore de données.</p>;
  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const band = w / data.length;
  const bar = Math.min(24, band * 0.55);
  const y = (v) => pad.top + h - (v / max) * h;
  const last = data.length - 1;
  return (
    <div ref={ref} className="chart">
      {width ? (
        <svg width={width} height={height} role="img" aria-label={`${label} : ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`} style={{ display: 'block' }}>
          {[0, max / 4, max / 2, (3 * max) / 4, max].map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
              <text x={pad.left - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill={INK} className="num">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.left + band * i + band / 2;
            const top = y(d.value);
            const bottom = y(0);
            const r = Math.min(4, (bottom - top) / 2);
            const path = d.value > 0 ? `M${cx - bar / 2},${bottom} V${top + r} Q${cx - bar / 2},${top} ${cx - bar / 2 + r},${top} H${cx + bar / 2 - r} Q${cx + bar / 2},${top} ${cx + bar / 2},${top + r} V${bottom} Z` : '';
            return (
              <g
                key={d.label}
                tabIndex={0}
                role="button"
                aria-label={`${d.label} : ${format(d.value)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none' }}
              >
                <rect x={cx - band / 2} y={pad.top} width={band} height={h} fill={hover === i ? 'rgba(122,31,53,0.05)' : 'transparent'} />
                {path ? <path d={path} fill={SERIES} opacity={hover == null || hover === i ? 1 : 0.55} /> : null}
                <text x={cx} y={height - 8} fontSize="11" textAnchor="middle" fill={INK}>
                  {d.label}
                </text>
              </g>
            );
          })}
          {hover == null && data[last].value > 0 ? (
            <text x={pad.left + band * last + band / 2} y={y(data[last].value) - 7} fontSize="12" fontWeight="700" textAnchor="middle" fill="#2f1219" className="num">
              {format(data[last].value)}
            </text>
          ) : null}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hover != null && width ? (
        <div className="chart-tip" style={{ left: pad.left + band * hover + band / 2, top: y(data[hover].value) }}>
          <strong className="num">{format(data[hover].value)}</strong>
          <span>{data[hover].tooltip || data[hover].label}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Mini-courbe d'un indicateur (sans axes). */
export function Sparkline({ data, width = 88, height = 28, tone = 'dark' }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const color = tone === 'light' ? '#e9b9c1' : SERIES;
  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={`${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`} fill={color} opacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Bars({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  return (
    <div className="bars">
      {data.map((d) => (
        <div className="bar-row" key={d.label} title={`${d.label} : ${format(d.count)} (${Math.round((d.count / total) * 100)} %)`}>
          <span>{d.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="muted num" style={{ textAlign: 'right' }}>
            {format(d.count)}
          </span>
        </div>
      ))}
    </div>
  );
}
