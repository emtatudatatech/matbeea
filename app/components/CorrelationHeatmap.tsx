"use client";

import { useMemo, useState } from 'react';
import { CURRENCY_DICTIONARY } from '@/lib/currencies';

const CELL = 16;
const GAP = 1;
const STEP = CELL + GAP;
const GUTTER = 46; // room for the row/column code labels

/**
 * Diverging bins. Correlation is polarity data, so the scale runs from one hue
 * through a neutral midpoint to the other — seven classes total, which is the
 * practical ceiling before adjacent classes stop being separable.
 */
const BINS = [
  { limit: -0.6, token: 'var(--corr-neg-3)', label: '≤ -0.6' },
  { limit: -0.3, token: 'var(--corr-neg-2)', label: '-0.6 to -0.3' },
  { limit: -0.1, token: 'var(--corr-neg-1)', label: '-0.3 to -0.1' },
  { limit: 0.1, token: 'var(--corr-zero)', label: '-0.1 to 0.1' },
  { limit: 0.3, token: 'var(--corr-pos-1)', label: '0.1 to 0.3' },
  { limit: 0.6, token: 'var(--corr-pos-2)', label: '0.3 to 0.6' },
  { limit: Infinity, token: 'var(--corr-pos-3)', label: '≥ 0.6' },
] as const;

const colorFor = (r: number) => (BINS.find(bin => r < bin.limit) ?? BINS[BINS.length - 1]).token;

type Props = {
  codes: string[];
  correlations: Record<string, Record<string, number>>;
};

type Cell = { row: string; col: string; r: number | null };

export default function CorrelationHeatmap({ codes, correlations }: Props) {
  const [hovered, setHovered] = useState<Cell | null>(null);
  const [showValues, setShowValues] = useState(false);

  const size = codes.length;
  const width = GUTTER + size * STEP;
  const height = GUTTER + size * STEP;

  const valueAt = useMemo(() => {
    return (row: string, col: string): number | null => {
      if (row === col) return 1;
      const direct = correlations[row]?.[col];
      if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
      const mirrored = correlations[col]?.[row];
      if (typeof mirrored === 'number' && Number.isFinite(mirrored)) return mirrored;
      return null;
    };
  }, [correlations]);

  // Flattened once rather than per render pass; 38 x 38 is ~1.4k cells.
  const cells = useMemo(() => {
    const list: { key: string; x: number; y: number; fill: string; cell: Cell }[] = [];
    codes.forEach((row, rowIndex) => {
      codes.forEach((col, colIndex) => {
        const r = valueAt(row, col);
        list.push({
          key: `${row}-${col}`,
          x: GUTTER + colIndex * STEP,
          y: GUTTER + rowIndex * STEP,
          fill: r === null ? 'var(--surface-sunken)' : colorFor(r),
          cell: { row, col, r },
        });
      });
    });
    return list;
  }, [codes, valueAt]);

  if (size === 0) {
    return (
      <div className="bg-surface-sunken p-8 rounded-2xl border border-edge text-center text-sm text-ink-muted">
        Waiting for market data before the correlation matrix can be built.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
        <h2 className="text-xl font-bold tracking-tight">Correlation Matrix</h2>
        <button
          onClick={() => setShowValues(current => !current)}
          aria-pressed={showValues}
          className="text-[10px] font-bold text-ink-muted bg-surface-sunken hover:bg-surface hover:text-ink px-3 py-2 rounded-lg uppercase tracking-wider transition-colors border border-edge shadow-sm"
        >
          {showValues ? 'Show heat-map' : 'Show values'}
        </button>
      </div>
      <p className="text-ink-muted text-sm mb-5 max-w-3xl">
        Pearson correlation of daily returns between every pair of the {size} currencies, each
        quoted against USD. <strong className="text-ink">Red</strong> pairs move together, so holding
        both concentrates risk; <strong className="text-ink">blue</strong> pairs move oppositely and
        hedge one another. Values near zero are unrelated — the diversification the optimizer looks
        for. The diagonal is a currency against itself, so it is always 1.
      </p>

      {/* Legend — the scale is diverging, so it is labelled at both poles and the midpoint. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5">
        <span className="text-[10px] uppercase tracking-widest font-black text-ink-muted">Inverse</span>
        <div className="flex items-center gap-1">
          {BINS.map(bin => (
            <div key={bin.label} className="flex flex-col items-center gap-1">
              <span
                className="block w-9 h-3.5 rounded-xs border border-edge"
                style={{ backgroundColor: bin.token }}
              />
              <span className="text-[9px] font-mono text-ink-faint whitespace-nowrap">{bin.label}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-widest font-black text-ink-muted">Lockstep</span>
      </div>

      {showValues ? (
        // Table view: the exact numbers, so the reading never depends on colour alone.
        <div className="overflow-auto rounded-2xl border border-edge" style={{ maxHeight: 560 }}>
          <table className="text-[10px] font-mono border-collapse">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-20 bg-surface-raised p-1.5 text-ink-muted">r</th>
                {codes.map(col => (
                  <th key={col} className="sticky top-0 z-10 bg-surface-raised p-1.5 text-ink-muted font-bold">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map(row => (
                <tr key={row}>
                  <th className="sticky left-0 z-10 bg-surface-raised p-1.5 text-ink-muted font-bold text-left">{row}</th>
                  {codes.map(col => {
                    const r = valueAt(row, col);
                    return (
                      <td
                        key={col}
                        className="p-1.5 text-center text-ink border border-edge"
                        style={{ backgroundColor: r === null ? 'var(--surface-sunken)' : colorFor(r) }}
                      >
                        {r === null ? '—' : r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="overflow-x-auto rounded-2xl border border-edge bg-surface-sunken p-3">
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`Correlation matrix heat map for ${size} currencies. Switch to the values view for the underlying numbers.`}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Column labels, rotated so three-letter codes fit a 16px column. */}
              {codes.map((code, index) => (
                <text
                  key={`col-${code}`}
                  x={GUTTER + index * STEP + CELL / 2}
                  y={GUTTER - 6}
                  transform={`rotate(-90 ${GUTTER + index * STEP + CELL / 2} ${GUTTER - 6})`}
                  textAnchor="start"
                  className="text-[9px] font-mono"
                  fill={hovered?.col === code ? 'var(--ink)' : 'var(--ink-faint)'}
                  fontWeight={hovered?.col === code ? 700 : 400}
                >
                  {code}
                </text>
              ))}

              {codes.map((code, index) => (
                <text
                  key={`row-${code}`}
                  x={GUTTER - 6}
                  y={GUTTER + index * STEP + CELL / 2 + 3}
                  textAnchor="end"
                  className="text-[9px] font-mono"
                  fill={hovered?.row === code ? 'var(--ink)' : 'var(--ink-faint)'}
                  fontWeight={hovered?.row === code ? 700 : 400}
                >
                  {code}
                </text>
              ))}

              {cells.map(({ key, x, y, fill, cell }) => (
                <rect
                  key={key}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                  onMouseEnter={() => setHovered(cell)}
                />
              ))}

              {/* Crosshair on the hovered cell, drawn last so it is never covered. */}
              {hovered && (() => {
                const rowIndex = codes.indexOf(hovered.row);
                const colIndex = codes.indexOf(hovered.col);
                if (rowIndex < 0 || colIndex < 0) return null;
                return (
                  <g pointerEvents="none">
                    <rect
                      x={GUTTER + colIndex * STEP - 1} y={GUTTER - 1}
                      width={CELL + 2} height={size * STEP}
                      fill="var(--ink)" opacity={0.08}
                    />
                    <rect
                      x={GUTTER - 1} y={GUTTER + rowIndex * STEP - 1}
                      width={size * STEP} height={CELL + 2}
                      fill="var(--ink)" opacity={0.08}
                    />
                    <rect
                      x={GUTTER + colIndex * STEP - 1} y={GUTTER + rowIndex * STEP - 1}
                      width={CELL + 2} height={CELL + 2}
                      fill="none" stroke="var(--ink)" strokeWidth={2}
                    />
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Readout rather than a floating tooltip: the grid is dense, and a card
              chasing the cursor would cover the neighbouring cells being compared. */}
          <div className="mt-3 flex items-center gap-3 min-h-[46px] bg-surface-sunken border border-edge rounded-xl px-4 py-2.5">
            {hovered ? (
              <>
                <span
                  className="w-3.5 h-3.5 rounded-xs border border-edge shrink-0"
                  style={{ backgroundColor: hovered.r === null ? 'var(--surface-sunken)' : colorFor(hovered.r) }}
                />
                <span className="text-sm text-ink font-bold">
                  {hovered.row} ↔ {hovered.col}
                </span>
                <span className="text-xs text-ink-muted truncate hidden sm:inline">
                  {CURRENCY_DICTIONARY[hovered.row]?.name} · {CURRENCY_DICTIONARY[hovered.col]?.name}
                </span>
                <span className="ml-auto font-mono text-lg text-ink shrink-0">
                  {hovered.r === null ? 'no data' : `r = ${hovered.r.toFixed(3)}`}
                </span>
              </>
            ) : (
              <span className="text-xs text-ink-muted">
                Hover any cell to read the exact coefficient for that pair.
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
