import React, { useEffect, useRef, useState } from 'react';
import type { SprintBurndown } from '../utils/burndown';
import { formatDate, formatHours } from '../utils/agileHelpers';

/*
 * Cores validadas (dataviz validate_palette): real indigo #4f46e5 (claro) / #7c83f5 (escuro);
 * ideal é referência neutra #64748b, diferenciada também pelo tracejado.
 */
const REAL_STROKE = 'stroke-[#4f46e5] dark:stroke-[#7c83f5]';
const REAL_FILL = 'fill-[#4f46e5] dark:fill-[#7c83f5]';
const IDEAL_STROKE = 'stroke-[#64748b]';
const SURFACE_STROKE = 'stroke-white dark:stroke-slate-900';

const HEIGHT = 260;
const M = { top: 16, right: 64, bottom: 28, left: 44 };

const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Máximo "redondo" do eixo Y e seus ticks. */
function niceScale(max: number, ticks = 4): number[] {
  const raw = Math.max(1, max) / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  return Array.from({ length: ticks + 1 }, (_, i) => Math.round(i * step * 10) / 10);
}

export const SprintBurndownChart: React.FC<{ burndown: SprintBurndown; today: string }> = ({ burndown, today }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(Math.max(280, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points } = burndown;
  const n = points.length;
  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const yTicks = niceScale(Math.max(burndown.totalEstimated, ...points.map((p) => p.remaining ?? 0)));
  const yMax = yTicks[yTicks.length - 1] || 1;

  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;

  const idealPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.ideal)}`).join(' ');
  const actual = points.map((p, i) => ({ i, v: p.remaining })).filter((p): p is { i: number; v: number } => p.v !== null);
  const actualPath = actual.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');
  const last = actual[actual.length - 1];

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 48))));
  const todayIndex = points.findIndex((p) => p.date === today);

  const handleMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((px / rect.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const hp = hover !== null ? points[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 8), width - 180) : 0;

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" className={IDEAL_STROKE} strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            Ideal
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="18" y2="3" className={REAL_STROKE} strokeWidth="2" strokeLinecap="round" />
            </svg>
            Restante real
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showTable ? 'Ver gráfico' : 'Ver tabela'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto max-h-72 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-left sticky top-0">
              <tr>
                <th className="px-3 py-2 font-semibold">Dia</th>
                <th className="px-3 py-2 font-semibold text-right">Ideal</th>
                <th className="px-3 py-2 font-semibold text-right">Restante real</th>
                <th className="px-3 py-2 font-semibold text-right">Realizado no dia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1.5 font-sans">{formatDate(p.date)}{p.date === today ? ' (hoje)' : ''}</td>
                  <td className="px-3 py-1.5 text-right">{formatHours(p.ideal)}</td>
                  <td className="px-3 py-1.5 text-right">{p.remaining === null ? '—' : formatHours(p.remaining)}</td>
                  <td className="px-3 py-1.5 text-right">{p.loggedOnDay ? formatHours(p.loggedOnDay) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative w-full select-none">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Burndown: ${formatHours(burndown.remaining)} restantes de ${formatHours(burndown.totalEstimated)} estimadas`}
            className="block overflow-visible"
          >
            {/* Grid + eixo Y */}
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={M.left}
                  x2={M.left + innerW}
                  y1={y(t)}
                  y2={y(t)}
                  className={t === 0 ? 'stroke-slate-300 dark:stroke-slate-700' : 'stroke-slate-200/70 dark:stroke-slate-800'}
                  strokeWidth="1"
                />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                  {t}h
                </text>
              </g>
            ))}

            {/* Eixo X */}
            {points.map((p, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text
                  key={p.date}
                  x={x(i)}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${p.date === today ? 'fill-slate-700 dark:fill-slate-200 font-semibold' : 'fill-slate-400'}`}
                >
                  {shortDate(p.date)}
                </text>
              ) : null
            )}

            {/* Hoje */}
            {todayIndex >= 0 && (
              <g>
                <line
                  x1={x(todayIndex)}
                  x2={x(todayIndex)}
                  y1={M.top}
                  y2={M.top + innerH}
                  className="stroke-slate-300 dark:stroke-slate-600"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text x={x(todayIndex)} y={M.top - 4} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[10px] font-semibold">
                  Hoje
                </text>
              </g>
            )}

            <path d={idealPath} fill="none" className={IDEAL_STROKE} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
            {actual.length > 1 && (
              <path d={actualPath} fill="none" className={REAL_STROKE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* Rótulo direto no último ponto real */}
            {last && (
              <g>
                <circle cx={x(last.i)} cy={y(last.v)} r="4.5" className={`${REAL_FILL} ${SURFACE_STROKE}`} strokeWidth="2" />
                <text x={x(last.i) + 9} y={y(last.v)} dy="0.32em" className="fill-slate-700 dark:fill-slate-200 text-[11px] font-semibold">
                  {formatHours(last.v)}
                </text>
              </g>
            )}

            {/* Crosshair */}
            {hp && hover !== null && (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1" />
                <circle cx={x(hover)} cy={y(hp.ideal)} r="4" className={`fill-[#64748b] ${SURFACE_STROKE}`} strokeWidth="2" />
                {hp.remaining !== null && (
                  <circle cx={x(hover)} cy={y(hp.remaining)} r="5" className={`${REAL_FILL} ${SURFACE_STROKE}`} strokeWidth="2" />
                )}
              </g>
            )}

            <rect
              x={M.left - 12}
              y={M.top}
              width={innerW + 24}
              height={innerH}
              fill="transparent"
              onPointerMove={handleMove}
              onPointerDown={handleMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>

          {hp && hover !== null && (
            <div
              className="absolute z-20 pointer-events-none min-w-[160px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 text-[11px]"
              style={{ left: tooltipLeft, top: M.top }}
            >
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {formatDate(hp.date)}
                {hp.date === today ? ' · hoje' : ''}
              </p>
              <div className="space-y-0.5 text-slate-600 dark:text-slate-300">
                <p className="flex justify-between gap-4">
                  <span>Restante real</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {hp.remaining === null ? '—' : formatHours(hp.remaining)}
                  </span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Ideal</span>
                  <span className="font-mono">{formatHours(hp.ideal)}</span>
                </p>
                <p className="flex justify-between gap-4">
                  <span>Realizado no dia</span>
                  <span className="font-mono">{hp.loggedOnDay ? formatHours(hp.loggedOnDay) : '—'}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
