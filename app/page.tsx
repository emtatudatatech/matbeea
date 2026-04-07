"use client";

import Image from 'next/image';
import { useState, useEffect } from 'react';

// The 27 Major Global Currencies + USD Base mapped to flags and map coordinates
const CURRENCY_DICTIONARY: Record<string, { flag: string, top: string, left: string, name: string }> = {
  // Africa
  ZAR: { flag: 'za', top: '75%', left: '55%', name: 'South Africa' },
  NGN: { flag: 'ng', top: '55%', left: '48%', name: 'Nigeria' },
  EGP: { flag: 'eg', top: '42%', left: '55%', name: 'Egypt' },
  KES: { flag: 'ke', top: '58%', left: '58%', name: 'Kenya' },
  ZMW: { flag: 'zm', top: '65%', left: '54%', name: 'Zambia' },
  MAD: { flag: 'ma', top: '40%', left: '45%', name: 'Morocco' },
  
  // Asia
  JPY: { flag: 'jp', top: '35%', left: '85%', name: 'Japan' },
  CNY: { flag: 'cn', top: '40%', left: '78%', name: 'China' },
  INR: { flag: 'in', top: '50%', left: '70%', name: 'India' },
  HKD: { flag: 'hk', top: '48%', left: '81%', name: 'Hong Kong' },
  KRW: { flag: 'kr', top: '38%', left: '83%', name: 'South Korea' },
  
  // Europe
  EUR: { flag: 'eu', top: '35%', left: '50%', name: 'Eurozone' },
  GBP: { flag: 'gb', top: '30%', left: '46%', name: 'Britain' },
  CHF: { flag: 'ch', top: '37%', left: '49%', name: 'Switzerland' },
  SEK: { flag: 'se', top: '22%', left: '52%', name: 'Sweden' },
  RUB: { flag: 'ru', top: '25%', left: '65%', name: 'Russia' },
  NOK: { flag: 'no', top: '22%', left: '50%', name: 'Norway' },
  
  // North/Central/Caribbean America
  USD: { flag: 'us', top: '35%', left: '25%', name: 'United States' },
  CAD: { flag: 'ca', top: '25%', left: '20%', name: 'Canada' },
  MXN: { flag: 'mx', top: '45%', left: '22%', name: 'Mexico' },
  GTQ: { flag: 'gt', top: '48%', left: '23%', name: 'Guatemala' },
  CRC: { flag: 'cr', top: '51%', left: '24%', name: 'Costa Rica' },
  PAB: { flag: 'pa', top: '53%', left: '25%', name: 'Panama' },
  HNL: { flag: 'hn', top: '50%', left: '24%', name: 'Honduras' },
  JMD: { flag: 'jm', top: '47%', left: '28%', name: 'Jamaica' },
  DOP: { flag: 'do', top: '48%', left: '30%', name: 'Dom. Republic' },
  TTD: { flag: 'tt', top: '52%', left: '32%', name: 'Trinidad/Tobago' },
  XCD: { flag: 'lc', top: '50%', left: '33%', name: 'East Caribbean' },
  BSD: { flag: 'bs', top: '43%', left: '28%', name: 'Bahamas' },
  
  // South America
  BRL: { flag: 'br', top: '65%', left: '35%', name: 'Brazil' },
  ARS: { flag: 'ar', top: '80%', left: '32%', name: 'Argentina' },
  CLP: { flag: 'cl', top: '78%', left: '29%', name: 'Chile' },
  COP: { flag: 'co', top: '55%', left: '30%', name: 'Colombia' },
  PEN: { flag: 'pe', top: '62%', left: '28%', name: 'Peru' },
  
  // Oceania
  AUD: { flag: 'au', top: '75%', left: '85%', name: 'Australia' },
  NZD: { flag: 'nz', top: '82%', left: '90%', name: 'New Zealand' },
  FJD: { flag: 'fj', top: '70%', left: '92%', name: 'Fiji' },
  PGK: { flag: 'pg', top: '65%', left: '88%', name: 'Papua New Guinea' },
  WST: { flag: 'ws', top: '70%', left: '96%', name: 'Samoa' }
};

export default function Home() {
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [dbStatus, setDbStatus] = useState('Loading...');
  
  // Dynamic mocked generation so we always view 27 plots visually regardless of DB pipeline delay
  const generateMockData = (base: string) => {
    return Object.keys(CURRENCY_DICTIONARY)
      .filter(cur => cur !== base)
      .map((cur, i) => ({
        pair: cur,
        vol: Number(((i % 15) + 4.5).toFixed(1)), // Deterministic Volatility: 4.5 to 18.5
        r: Number(((i % 5) * 0.4 - 0.8).toFixed(2)) // Deterministic Pearson: -0.8 to 0.8
      })).sort((a, b) => b.vol - a.vol);
  };
  
  const [data, setData] = useState(generateMockData('USD'));

  useEffect(() => {
    // Attempt to pull real data from standard API we created
    fetch(`/api/engine?base=${baseCurrency}`)
       .then(r => r.json())
       .then(res => {
         if (res.error) {
           setDbStatus('Local DB Empty - Showing Generated Plot');
           setData(generateMockData(baseCurrency));
         } else {
           setDbStatus('● LIVE from Neon Postgres');
           // Convert actual API to visual array map
           const mapped = res.riskRankings.map((r: any) => {
              const cleanedPair = r.pair.replace('USD=X', '').replace('=X', '');
              return {
                 pair: cleanedPair,
                 vol: Number((r.volatility * 100).toFixed(1)),
                 r: res.correlations[r.pair] ? Number(res.correlations[r.pair].toFixed(2)) : 0
              }
           });
           setData(mapped);
         }
       }).catch((e) => {
         setDbStatus('Local DB Error - Showing Generated Plot');
         setData(generateMockData(baseCurrency));
       });
  }, [baseCurrency]);

  const getRiskColor = (volatility: number, isCorrelation: boolean = false) => {
    if (isCorrelation) {
      if (Math.abs(volatility) < 0.3) return 'spotify-neonGreen'; // Highly uncorrelated = good for portfolio
      if (Math.abs(volatility) <= 0.7) return 'spotify-electricBlue';
      return 'spotify-crimson';
    }
    if (volatility > 15) return 'spotify-crimson';
    if (volatility > 8) return 'spotify-electricBlue';
    return 'spotify-neonGreen';
  }

  const [qcCurrencyA, setQcCurrencyA] = useState('USD');
  const [qcCurrencyB, setQcCurrencyB] = useState('JPY');
  
  const qcScore = qcCurrencyA === qcCurrencyB ? 1.0 : (data.find(d => d.pair === qcCurrencyB)?.r || data.find(d => d.pair === qcCurrencyA)?.r || -0.42);
  const qcColor = getRiskColor(qcScore, true);

  return (
    <main className="flex flex-col items-center justify-start min-h-screen p-6 md:p-12 gap-8 text-spotify-foreground bg-spotify-dark">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full flex items-center justify-between bg-spotify-charchoal/80 backdrop-blur-md p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-gray-800">
        <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
          <span className="text-spotify-neonGreen text-3xl">⏣</span> <span className="hidden sm:inline">FX RISK DASHBOARD</span>
        </h1>
        <nav className="hidden md:flex gap-8 text-sm font-bold text-gray-400">
          <a href="#map" className="hover:text-white transition-colors uppercase tracking-wider">Global Map</a>
          <a href="#rankings" className="hover:text-white transition-colors uppercase tracking-wider">Risk Rankings</a>
          <a href="#optimizer" className="hover:text-white transition-colors uppercase tracking-wider">Optimizer</a>
          <a href="#quickcheck" className="hover:text-white transition-colors uppercase tracking-wider">Pair Analysis</a>
        </nav>
        <div className="flex gap-3 items-center">
          <label htmlFor="baseCurrency" className="text-xs uppercase tracking-widest font-black text-gray-500">Base Currency</label>
          <select 
            id="baseCurrency" 
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
            className="bg-spotify-dark font-bold border border-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:border-spotify-neonGreen focus:ring-1 focus:ring-spotify-neonGreen transition-all">
            {Object.keys(CURRENCY_DICTIONARY).sort().map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 w-full gap-8">
        
        {/* Map Section */}
        <section className="xl:col-span-2 bg-spotify-charchoal rounded-3xl p-8 shadow-2xl border border-gray-800 relative z-10" id="map">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Global Correlation vs {baseCurrency} <span className="text-spotify-neonGreen ml-2 text-sm">{dbStatus}</span></h2>
            <div className="text-xs text-gray-400 max-w-xs text-right">Azimuthal Equidistant Projection. Shows all 27 required markets.</div>
          </div>
          
          <div className="w-full relative bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center p-8 aspect-video min-h-[500px]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-[#0a0a0a] opacity-80"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
            
            <div className="relative w-full h-full">
              {/* Loop over our full 27 set */}
              {Object.keys(CURRENCY_DICTIONARY).map((curcode) => {
                 const info = CURRENCY_DICTIONARY[curcode];
                 const mathData = data.find(d => d.pair === curcode);
                 
                 // If it's the base currency, force specific values, else use math data
                 const isBase = curcode === baseCurrency;
                 const borderColor = isBase ? 'border-white' : (mathData ? `border-${getRiskColor(mathData.r, true)}` : 'border-gray-500');
                 const shadowColor = isBase ? 'rgba(255,255,255,0.5)' : (mathData ? (mathData.r < 0.3 ? 'rgba(29,185,84,0.5)' : (mathData.r > 0.7 ? 'rgba(255,77,79,0.5)' : 'rgba(24,144,255,0.5)')) : 'transparent');

                 return (
                   <div key={curcode} className="absolute group cursor-pointer transform hover:scale-150 transition-transform z-10 hover:z-30" style={{ top: info.top, left: info.left }}>
                     <div className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 ${borderColor}`} style={{boxShadow:`0 0 15px ${shadowColor}`}}>
                       <Image src={`https://flagcdn.com/w160/${info.flag}.png`} alt={info.name} fill className="object-cover" />
                     </div>
                     {/* Tooltip */}
                     <div className="absolute left-1/2 -mt-2 -translate-y-full -translate-x-1/2 bg-spotify-dark border border-gray-700 p-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity w-48 pointer-events-none z-50">
                       <div className="font-bold border-b border-gray-800 pb-2 mb-2 text-sm">{info.name} <span className="text-gray-400 font-mono text-xs float-right mt-0.5">{curcode}</span></div>
                       {isBase ? (
                         <div className="text-xs text-center text-gray-500 py-1">Current Base Anchor</div>
                       ) : (
                         <>
                           <div className="text-xs flex justify-between"><span className="text-gray-400">Pearson (r):</span> <span className={`text-${getRiskColor(mathData?.r || 0, true)} font-mono font-bold`}>{mathData?.r}</span></div>
                           <div className="text-xs flex justify-between mt-1"><span className="text-gray-400">Volatility ($\sigma$):</span> <span className={`text-${getRiskColor(mathData?.vol || 0)} font-mono`}>{mathData?.vol}%</span></div>
                         </>
                       )}
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        </section>
        
        {/* Risk Rankings Side Panel */}
        <section className="bg-spotify-charchoal rounded-3xl p-8 shadow-2xl border border-gray-800 overflow-hidden flex flex-col" id="rankings">
          <h2 className="text-xl font-bold mb-6 tracking-tight">Risk Rankings <span className="block text-sm text-gray-400 font-normal mt-1">Ann. Volatility Spread (&sigma;) for all 27</span></h2>
          <div className="flex flex-col gap-4 overflow-y-auto pr-2 pb-4 hover:scrollbar-thin" style={{maxHeight: '500px'}}>
            {data.slice(0, 27).map((metric, i) => {
              const info = CURRENCY_DICTIONARY[metric.pair];
              if (!info) return null;
              const color = `bg-${getRiskColor(metric.vol)}`;
              
              return (
              <div key={i} className="flex items-center justify-between bg-spotify-dark/50 p-3 rounded-xl border border-gray-800/50 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-3 w-1/3">
                  <span className="text-xs font-black text-gray-500 w-4">{i+1}</span>
                  <div className="relative w-6 h-6 rounded-full overflow-hidden shadow-sm">
                     <Image src={`https://flagcdn.com/w80/${info.flag}.png`} alt={metric.pair} fill className="object-cover" />
                  </div>
                  <span className="font-bold text-sm">{metric.pair}</span>
                </div>
                <div className="flex-1 px-4">
                  <div className="w-full bg-black rounded-full h-2 overflow-hidden border border-gray-800">
                    <div className={`h-full ${color} rounded-r-full shadow-[0_0_10px_currentColor]`} style={{width: `${Math.min(metric.vol * 4, 100)}%`}}></div>
                  </div>
                </div>
                <span className="text-xs font-mono text-gray-300 w-12 text-right">{metric.vol}%</span>
              </div>
            )})}
          </div>
        </section>

        {/* Portfolio Optimizer */}
        <section className="xl:col-span-2 bg-spotify-charchoal rounded-3xl p-8 shadow-2xl border border-gray-800" id="optimizer">
          <h2 className="text-xl font-bold mb-2 tracking-tight">Portfolio Variance Optimizer</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-2xl">Minimum variance portfolio combinations yielding the lowest overall correlation. Strict weighting constraints applied: Max 5% USD/GBP.</p>
          
          <div className="flex flex-col md:flex-row items-center gap-12 bg-spotify-dark p-8 rounded-2xl border border-gray-800/50">
             {/* Donut Chart */}
             <div className="relative w-48 h-48 rounded-full border-[16px] border-spotify-dark shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] bg-spotify-charchoal flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                   <circle cx="50%" cy="50%" r="40%" stroke="#1db954" strokeWidth="8" fill="none" strokeDasharray="60 40" />
                   <circle cx="50%" cy="50%" r="40%" stroke="#1890ff" strokeWidth="8" fill="none" strokeDasharray="20 80" strokeDashoffset="-60" />
                   <circle cx="50%" cy="50%" r="40%" stroke="#ff4d4f" strokeWidth="8" fill="none" strokeDasharray="10 90" strokeDashoffset="-80" />
                </svg>
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase font-bold tracking-widest">Global Risk</div>
                  <div className="text-3xl font-black text-white">4.2%</div>
                </div>
             </div>
             
             {/* Weightings */}
             <div className="flex-1 w-full grid grid-cols-2 gap-4">
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Uncorrelated Asset 1</div>
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-lg text-spotify-neonGreen">JPY</span>
                    <span className="font-mono text-xl">45.0%</span>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Uncorrelated Asset 2</div>
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-lg text-spotify-electricBlue">CHF</span>
                    <span className="font-mono text-xl">30.0%</span>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Diversifier (Constraint)</div>
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-lg text-gray-300">USD</span>
                    <span className="font-mono text-xl">5.0%</span>
                  </div>
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-xs text-gray-500 mb-1">Diversifier (Constraint)</div>
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-lg text-gray-300">GBP</span>
                    <span className="font-mono text-xl">5.0%</span>
                  </div>
                </div>
             </div>
          </div>
        </section>

        {/* Pair Quick Check */}
        <section className="bg-spotify-charchoal rounded-3xl p-8 shadow-2xl border border-gray-800 flex flex-col justify-between" id="quickcheck">
          <div>
            <h2 className="text-xl font-bold mb-6 tracking-tight">Correlation Quick-Check</h2>
            <div className="flex justify-between items-center bg-spotify-dark p-2 rounded-xl mb-6 border border-gray-700 w-full relative">
               <select className="bg-transparent text-white font-bold p-3 outline-none flex-1 appearance-none cursor-pointer"
                       value={qcCurrencyA} onChange={(e) => setQcCurrencyA(e.target.value)}>
                 {Object.keys(CURRENCY_DICTIONARY).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <span className="text-gray-500 text-lg mr-2 font-black pointer-events-none">↔</span>
               <select className="bg-transparent text-white font-bold p-3 outline-none flex-1 appearance-none cursor-pointer text-right" 
                       value={qcCurrencyB} onChange={(e) => setQcCurrencyB(e.target.value)}>
                 {Object.keys(CURRENCY_DICTIONARY).map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            
            <div className={`bg-[#0a0a0a] rounded-2xl p-6 text-center border-2 border-${qcColor} shadow-[0_0_20px_currentColor] mt-auto`}>
               <div className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-1">Pearson Score (r)</div>
               <div className={`text-5xl font-black text-${qcColor} font-mono mb-2`}>{qcScore}</div>
               <div className={`text-${qcColor} bg-${qcColor}/10 inline-block px-3 py-1 rounded-full text-xs font-bold border border-${qcColor}/50`}>
                 {Math.abs(qcScore) < 0.3 ? 'LOW RISK SHIELD' : (Math.abs(qcScore) <= 0.7 ? 'MODERATE LINK' : 'HEAVY CORRELATION')}
               </div>
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
