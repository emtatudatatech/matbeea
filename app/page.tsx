"use client";

import Image from 'next/image';
import { useState, useEffect, useMemo } from 'react';
import WorldMap from './components/WorldMap';
import ThemeToggle from './components/ThemeToggle';
import CorrelationHeatmap from './components/CorrelationHeatmap';
import { lowestRiskAllocation, minimumVarianceAllocation, type AssetStats } from '@/lib/portfolio';
import {
  CURRENCY_DICTIONARY,
  getRiskTone,
  RISK_BG,
  RISK_BG_SOFT,
  RISK_BORDER,
  RISK_BORDER_SOFT,
  RISK_TEXT,
} from '@/lib/currencies';

// Shape returned by /api/engine, mapped into the visual metric rows below.
type EngineRanking = {
  pair: string;
  volatility: number;
};

/** Number of currencies the optimizer allocates across. */
const HOLDING_SLOTS = 4;

// Categorical identity colours for the optimizer holdings, held deliberately
// separate from the risk palette so a donut arc never reads as a risk verdict.
// Each theme has its own validated steps; these resolve through CSS variables so
// the chart follows the active theme.
const HOLDING_COLORS = [
  'var(--holding-1)',
  'var(--holding-2)',
  'var(--holding-3)',
  'var(--holding-4)',
];

const cleanPairCode = (pair: string) => pair.replace('USD=X', '').replace('=X', '');

// Deterministic stand-in correlations, so the optimizer stays usable and stable
// when the database is empty. Mirrors the shape of the real matrix.
//
// Each currency gets a unit vector of synthetic factor exposures and correlation
// is their dot product. That makes the matrix a Gram matrix, so it is positive
// semi-definite like a real correlation matrix — simply picking symmetric numbers
// would not be, and an indefinite covariance matrix lets the optimizer "hedge"
// its way to an impossible zero-risk portfolio.
//
// With more currencies than factors that Gram matrix is only semi-definite, so it
// is shrunk toward the identity. That keeps every eigenvalue comfortably above
// zero (and survives rounding) while leaving the diagonal at exactly 1.
const MOCK_FACTORS = 5;
const MOCK_SHRINKAGE = 0.7;

const generateMockCorrelations = (codes: string[]) => {
  const exposures = codes.map((_, i) => {
    const raw = Array.from({ length: MOCK_FACTORS }, (_, k) => Math.sin((i + 1) * (k + 1) * 1.7));
    const norm = Math.hypot(...raw) || 1;
    return raw.map(value => value / norm);
  });

  const matrix: Record<string, Record<string, number>> = {};
  codes.forEach(code => { matrix[code] = {}; });
  codes.forEach((a, i) => {
    matrix[a][a] = 1;
    for (let j = i + 1; j < codes.length; j++) {
      const b = codes[j];
      const dot = exposures[i].reduce((sum, value, k) => sum + value * exposures[j][k], 0);
      const r = Number((MOCK_SHRINKAGE * dot).toFixed(4));
      matrix[a][b] = r;
      matrix[b][a] = r;
    }
  });
  return matrix;
};

// Dynamic mocked generation so we always view 38 plots visually regardless of DB pipeline delay
const buildMockDataset = (base: string) => {
  const rows = Object.keys(CURRENCY_DICTIONARY)
    .filter(cur => cur !== base)
    .map((cur, i) => ({
      pair: cur,
      vol: Number(((i % 15) + 4.5).toFixed(1)), // Deterministic Volatility: 4.5 to 18.5
      r: Number(((i % 5) * 0.4 - 0.8).toFixed(2)) // Deterministic Pearson: -0.8 to 0.8
    }))
    .sort((a, b) => b.vol - a.vol);

  return { rows, correlations: generateMockCorrelations(rows.map(row => row.pair)) };
};

export default function Home() {
  const currentYear = new Date().getFullYear().toString();
  const today = new Date();
  const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [dateStart, setDateStart] = useState(`${currentYear}-01-01`);
  const [dateEnd, setDateEnd] = useState(currentDateStr);

  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [dbStatus, setDbStatus] = useState('Loading...');

  // Interactive Optimizer selection. `null` means "follow the computed lowest-risk
  // default"; once the user picks a currency their choice survives date/base changes.
  const [selection, setSelection] = useState<string[] | null>(null);

  // UI States
  const [rankSort, setRankSort] = useState<'desc' | 'asc'>('desc');

  const [dataset, setDataset] = useState(() => buildMockDataset('USD'));
  const data = dataset.rows;

  useEffect(() => {
    // Attempt to pull real data from standard API we created
    fetch(`/api/engine?base=${baseCurrency}&start=${dateStart}&end=${dateEnd}`)
       .then(r => r.json())
       .then(res => {
         if (res.error) {
           setDbStatus('Local DB Empty - Showing Generated Plot');
           setDataset(buildMockDataset(baseCurrency));
         } else {
           setDbStatus('● LIVE from Neon Postgres');
           // Convert actual API to visual array map
           const rows = res.riskRankings.map((r: EngineRanking) => ({
              pair: cleanPairCode(r.pair),
              vol: Number((r.volatility * 100).toFixed(1)),
              r: res.correlations[r.pair] ? Number(res.correlations[r.pair].toFixed(2)) : 0
           }));

           // Re-key the matrix from Yahoo tickers to the plain codes the UI uses.
           const rawMatrix: Record<string, Record<string, number>> = res.correlationMatrix ?? {};
           const correlations: Record<string, Record<string, number>> = {};
           Object.keys(rawMatrix).forEach(pair => {
              const row: Record<string, number> = {};
              Object.keys(rawMatrix[pair]).forEach(other => {
                 row[cleanPairCode(other)] = rawMatrix[pair][other];
              });
              correlations[cleanPairCode(pair)] = row;
           });

           setDataset({ rows, correlations });
         }
       }).catch(() => {
         setDbStatus('Local DB Error - Showing Generated Plot');
         setDataset(buildMockDataset(baseCurrency));
       });
  }, [baseCurrency, dateStart, dateEnd]);

  // --- Portfolio optimizer -------------------------------------------------
  // Volatilities stay in percentage points, so the resulting portfolio
  // volatility comes back in the same unit.
  const optimizerStats = useMemo<AssetStats>(() => {
    const volatility: Record<string, number> = {};
    dataset.rows.forEach(row => { volatility[row.pair] = row.vol; });
    return { volatility, correlation: dataset.correlations };
  }, [dataset]);

  const optimizerUniverse = useMemo(
    () => dataset.rows.map(row => row.pair).sort((a, b) => a.localeCompare(b)),
    [dataset]
  );

  const lowestRisk = useMemo(
    () => lowestRiskAllocation(optimizerUniverse, optimizerStats, HOLDING_SLOTS),
    [optimizerUniverse, optimizerStats]
  );

  // A stored selection goes stale when a currency drops out of the dataset (a
  // narrower date range can push it under the engine's minimum sample size).
  // Unknown codes have no volatility and would masquerade as risk-free, so they
  // are dropped and backfilled from the computed default.
  const holdings = useMemo(() => {
    if (!selection) return lowestRisk.codes;
    const valid = selection.filter(code => optimizerUniverse.includes(code));
    const filler = lowestRisk.codes.filter(code => !valid.includes(code));
    return [...valid, ...filler].slice(0, HOLDING_SLOTS);
  }, [selection, lowestRisk, optimizerUniverse]);

  const allocation = useMemo(
    () => minimumVarianceAllocation(holdings, optimizerStats),
    [holdings, optimizerStats]
  );

  const handleHoldingChange = (slot: number, code: string) => {
    const next = [...holdings];
    next[slot] = code;
    setSelection(next);
  };

  // Donut geometry. pathLength normalises the circumference to 100 so a dash
  // length is simply the weight in percent; the gap keeps arcs visually separate.
  const donutSegments = useMemo(() => {
    const SEGMENT_GAP = 1.2;
    const shares = allocation.weights.map(weight => weight * 100);
    return allocation.codes
      .map((code, index) => ({
        code,
        color: HOLDING_COLORS[index % HOLDING_COLORS.length],
        dash: Math.max(0, shares[index] - SEGMENT_GAP),
        // Where the arc starts: the cumulative share of everything before it.
        offset: shares.slice(0, index).reduce((sum, share) => sum + share, 0),
      }))
      .filter(segment => segment.dash > 0);
  }, [allocation]);

  const [qcCurrencyA, setQcCurrencyA] = useState('USD');
  const [qcCurrencyB, setQcCurrencyB] = useState('JPY');

  const qcScore = qcCurrencyA === qcCurrencyB ? 1.0 : (data.find(d => d.pair === qcCurrencyB)?.r || data.find(d => d.pair === qcCurrencyA)?.r || -0.42);
  const qcTone = getRiskTone(qcScore, true);

  return (
    <main className="flex flex-col items-center justify-start min-h-screen p-6 md:p-12 gap-8 text-ink bg-surface">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full flex flex-wrap items-center justify-between gap-4 bg-surface-raised/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-edge">
        <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
          <span className="text-risk-low text-3xl">⏣</span> <span className="hidden sm:inline">FX RISK DASHBOARD</span>
        </h1>
        <nav className="hidden xl:flex gap-8 text-sm font-bold text-ink-muted">
          <a href="#map" className="hover:text-ink transition-colors uppercase tracking-wider">Global Map</a>
          <a href="#rankings" className="hover:text-ink transition-colors uppercase tracking-wider">Risk Rankings</a>
          <a href="#matrix" className="hover:text-ink transition-colors uppercase tracking-wider">Matrix</a>
          <a href="#optimizer" className="hover:text-ink transition-colors uppercase tracking-wider">Optimizer</a>
          <a href="#quickcheck" className="hover:text-ink transition-colors uppercase tracking-wider">Pair Analysis</a>
        </nav>

        <div className="flex gap-3 items-center">
          {/* Timeline Filter */}
          <div className="hidden md:flex gap-2 items-center bg-surface-sunken px-3 py-1.5 rounded-lg border border-edge">
             <label htmlFor="dateStart" className="text-[10px] uppercase font-bold text-ink-muted mr-1">Range</label>
             <input
               id="dateStart"
               type="date"
               value={dateStart}
               onChange={e => setDateStart(e.target.value)}
               className="bg-transparent text-xs text-ink outline-hidden cursor-pointer font-mono"
              />
             <span className="text-ink-faint">-</span>
             <input
               aria-label="Range end date"
               type="date"
               value={dateEnd}
               onChange={e => setDateEnd(e.target.value)}
               className="bg-transparent text-xs text-ink outline-hidden cursor-pointer font-mono"
              />
          </div>

          {/* Base Anchor Option */}
          <label htmlFor="baseCurrency" className="text-xs uppercase tracking-widest font-black text-ink-muted hidden lg:inline">Base</label>
          <select
            id="baseCurrency"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="bg-surface-sunken font-bold border border-edge text-ink rounded-lg px-3 py-2 outline-hidden focus:border-risk-low focus:ring-1 focus:ring-risk-low transition-all">
            {Object.keys(CURRENCY_DICTIONARY).sort().map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 w-full gap-8">

        {/* Map Section */}
        <section className="xl:col-span-2 bg-surface-raised rounded-3xl p-8 shadow-lg border border-edge relative z-10" id="map">
          <WorldMap metrics={data} baseCurrency={baseCurrency} statusLabel={dbStatus} />
        </section>

        {/* Risk Rankings Side Panel */}
        <section className="bg-surface-raised rounded-3xl p-8 shadow-lg border border-edge overflow-hidden flex flex-col" id="rankings">
          <div className="flex justify-between items-start mb-3 gap-3">
             <h2 className="text-xl font-bold tracking-tight">Risk Rankings <span className="block text-sm text-ink-muted font-normal mt-1">Ann. Volatility Spread (&sigma;) for all {data.length}</span></h2>
             <button onClick={() => setRankSort(prev => prev === 'desc' ? 'asc' : 'desc')} className="text-[10px] font-bold text-ink-muted bg-surface-sunken hover:bg-surface px-3 py-2 rounded-lg uppercase tracking-wider transition-colors border border-edge hover:text-ink flex items-center shadow-sm shrink-0">
               Sort: {rankSort === 'desc' ? 'Highest First ↓' : 'Lowest First ↑'}
             </button>
          </div>

          <p className="text-[11px] text-ink-muted mb-5 bg-surface-sunken p-3 rounded-lg border border-edge leading-relaxed font-medium">
             {rankSort === 'desc'
                 ? 'Displaying the most highly volatile currencies at the top, descending to the most stable base-pegged anchors at the bottom.'
                 : 'Displaying the most stable, low-volatility currencies at the top, ascending to the highest risk assets.'}
          </p>

          <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-4" style={{maxHeight: '500px'}}>
            {[...data].sort((a,b) => rankSort === 'desc' ? b.vol - a.vol : a.vol - b.vol).map((metric, i) => {
              const info = CURRENCY_DICTIONARY[metric.pair];
              if (!info) return null;
              const color = RISK_BG[getRiskTone(metric.vol)];

              return (
              <div key={i} className="flex items-center justify-between bg-surface-sunken p-3 rounded-xl border border-edge hover:border-edge-strong transition-colors">
                <div className="flex items-center gap-3 w-1/3">
                  <span className="text-xs font-black text-ink-faint w-4">{i+1}</span>
                  <div className="relative group cursor-pointer">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden shadow-xs">
                       <Image src={`https://flagcdn.com/w80/${info.flag}.png`} alt={metric.pair} fill sizes="24px" className="object-cover" />
                    </div>
                    {/* Tooltip dynamically shooting right to explicitly prevent #1 list-item vertical container clipping */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-surface-raised border border-edge-strong px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 flex flex-col items-start min-w-max">
                       <span className="text-[11px] font-bold text-ink whitespace-nowrap leading-tight">{info.name}</span>
                       <span className="text-[9px] font-mono text-risk-low uppercase tracking-widest">{metric.pair}</span>
                    </div>
                  </div>
                  <span className="font-bold text-sm">{metric.pair}</span>
                </div>
                <div className="flex-1 px-4">
                  <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-edge">
                    <div className={`h-full ${color} rounded-r-full`} style={{width: `${Math.min(metric.vol * 4, 100)}%`}}></div>
                  </div>
                </div>
                <span className="text-xs font-mono text-ink-muted w-12 text-right">{metric.vol}%</span>
              </div>
            )})}
          </div>
        </section>

        {/* Correlation Matrix Heat-map */}
        <section className="xl:col-span-3 bg-surface-raised rounded-3xl p-8 shadow-lg border border-edge" id="matrix">
          <CorrelationHeatmap codes={optimizerUniverse} correlations={dataset.correlations} />
        </section>

        {/* Portfolio Optimizer */}
        <section className="xl:col-span-2 bg-surface-raised rounded-3xl p-8 shadow-lg border border-edge" id="optimizer">
          <div className="flex flex-wrap justify-between items-start gap-3 mb-2">
            <h2 className="text-xl font-bold tracking-tight">Portfolio Variance Optimizer</h2>
            <button
              onClick={() => setSelection(null)}
              disabled={selection === null}
              className="text-[10px] font-bold text-ink-muted bg-surface-sunken hover:bg-surface hover:text-ink px-3 py-2 rounded-lg uppercase tracking-wider transition-colors border border-edge shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-sunken disabled:hover:text-ink-muted"
            >
              Reset to lowest risk
            </button>
          </div>
          <p className="text-ink-muted text-sm mb-6 max-w-2xl">
            Weights are the long-only minimum-variance solution for whichever four currencies you
            hold, computed from their annualized volatility and the correlations between them —
            change a holding and every weight re-solves. The starting selection is the lowest-risk
            combination found across all {optimizerUniverse.length} currencies.
          </p>

          {allocation.codes.length === 0 ? (
            <div className="bg-surface-sunken p-8 rounded-2xl border border-edge text-center text-sm text-ink-muted">
              Waiting for market data before the optimizer can solve.
            </div>
          ) : (
          <div className="flex flex-col md:flex-row items-center gap-12 bg-surface-sunken p-8 rounded-2xl border border-edge">
             {/* Donut Chart — part-to-whole of the allocation, at a glance; the exact
                 figures live on the labelled cards beside it. */}
             <div className="relative w-48 h-48 shrink-0 rounded-full border-16 border-surface-sunken shadow-inner bg-surface-raised flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" aria-hidden="true">
                   {donutSegments.map(segment => (
                     <circle
                       key={segment.code}
                       cx="50%"
                       cy="50%"
                       r="40%"
                       pathLength={100}
                       stroke={segment.color}
                       strokeWidth="8"
                       fill="none"
                       strokeDasharray={`${segment.dash} ${100 - segment.dash}`}
                       strokeDashoffset={-segment.offset}
                     />
                   ))}
                </svg>
                <div className="text-center">
                  <div className="text-xs text-ink-muted uppercase font-bold tracking-widest">Global Risk</div>
                  <div className="text-3xl font-black text-ink">{allocation.volatility.toFixed(1)}%</div>
                  <div className="text-[10px] text-ink-faint font-medium">annualized &sigma;</div>
                </div>
             </div>

             {/* Weightings — each card is both the control and the legend entry. */}
             <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allocation.codes.map((code, index) => {
                  const info = CURRENCY_DICTIONARY[code];
                  return (
                    <div key={index} className="bg-surface-raised p-4 rounded-xl border border-edge hover:border-edge-strong transition-colors">
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: HOLDING_COLORS[index % HOLDING_COLORS.length] }}
                        />
                        <span className="text-xs text-ink-muted truncate">
                          Holding {index + 1}{info ? ` · ${info.name}` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-end gap-2">
                        <select
                          value={code}
                          aria-label={`Holding ${index + 1} currency`}
                          onChange={(e) => handleHoldingChange(index, e.target.value)}
                          className="font-bold text-lg text-ink bg-transparent outline-hidden cursor-pointer appearance-none w-24"
                        >
                          {optimizerUniverse.map(option => (
                            <option
                              key={option}
                              value={option}
                              disabled={option !== code && holdings.includes(option)}
                            >
                              {option}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono text-xl text-ink">{(allocation.weights[index] * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
          )}
        </section>

        {/* Pair Quick Check */}
        <section className="bg-surface-raised rounded-3xl p-8 shadow-lg border border-edge flex flex-col justify-between" id="quickcheck">
          <div>
            <h2 className="text-xl font-bold mb-6 tracking-tight">Correlation Quick-Check</h2>
            <div className="flex justify-between items-center bg-surface-sunken p-2 rounded-xl mb-6 border border-edge w-full relative">
               <select className="bg-transparent text-ink font-bold p-3 outline-hidden flex-1 appearance-none cursor-pointer"
                       aria-label="Quick-check currency A"
                       value={qcCurrencyA} onChange={(e) => setQcCurrencyA(e.target.value)}>
                 {Object.keys(CURRENCY_DICTIONARY).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <span className="text-ink-faint text-lg mr-2 font-black pointer-events-none">↔</span>
               <select className="bg-transparent text-ink font-bold p-3 outline-hidden flex-1 appearance-none cursor-pointer text-right"
                       aria-label="Quick-check currency B"
                       value={qcCurrencyB} onChange={(e) => setQcCurrencyB(e.target.value)}>
                 {Object.keys(CURRENCY_DICTIONARY).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>

            <div className={`bg-surface-sunken rounded-2xl p-6 text-center border-2 ${RISK_BORDER[qcTone]} mt-auto`}>
               <div className="text-sm text-ink-muted font-bold uppercase tracking-widest mb-1">Pearson Score (r)</div>
               <div className={`text-5xl font-black ${RISK_TEXT[qcTone]} font-mono mb-2`}>{qcScore}</div>
               <div className={`${RISK_TEXT[qcTone]} ${RISK_BG_SOFT[qcTone]} inline-block px-3 py-1 rounded-full text-xs font-bold border ${RISK_BORDER_SOFT[qcTone]}`}>
                 {Math.abs(qcScore) < 0.3 ? 'LOW RISK SHIELD' : (Math.abs(qcScore) <= 0.7 ? 'MODERATE LINK' : 'HEAVY CORRELATION')}
               </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
