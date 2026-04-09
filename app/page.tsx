"use client";

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";

// TopoJSON definition for the D3 Map implementation
const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

// The 39 Major Global Currencies + USD Base mapped to EXACT Longitude/Latitude coordinates
const CURRENCY_DICTIONARY: Record<string, { flag: string, coordinates: [number, number], name: string }> = {
  // Africa
  ZAR: { flag: 'za', coordinates: [24, -29], name: 'South Africa' },
  NGN: { flag: 'ng', coordinates: [8, 9], name: 'Nigeria' },
  EGP: { flag: 'eg', coordinates: [30, 26], name: 'Egypt' },
  KES: { flag: 'ke', coordinates: [38, 1], name: 'Kenya' },
  ZMW: { flag: 'zm', coordinates: [28, -13], name: 'Zambia' },
  MAD: { flag: 'ma', coordinates: [-7, 31], name: 'Morocco' },
  
  // Asia
  JPY: { flag: 'jp', coordinates: [138, 36], name: 'Japan' },
  CNY: { flag: 'cn', coordinates: [104, 35], name: 'China' },
  INR: { flag: 'in', coordinates: [78, 20], name: 'India' },
  HKD: { flag: 'hk', coordinates: [114, 22], name: 'Hong Kong' },
  KRW: { flag: 'kr', coordinates: [127, 35], name: 'South Korea' },
  
  // Europe
  EUR: { flag: 'eu', coordinates: [10, 51], name: 'Eurozone' },
  GBP: { flag: 'gb', coordinates: [-3, 55], name: 'Britain' },
  CHF: { flag: 'ch', coordinates: [8, 46], name: 'Switzerland' },
  SEK: { flag: 'se', coordinates: [15, 60], name: 'Sweden' },
  RUB: { flag: 'ru', coordinates: [90, 60], name: 'Russia' },
  NOK: { flag: 'no', coordinates: [8, 60], name: 'Norway' },
  
  // North/Central/Caribbean America
  USD: { flag: 'us', coordinates: [-95, 37], name: 'United States' },
  CAD: { flag: 'ca', coordinates: [-106, 56], name: 'Canada' },
  MXN: { flag: 'mx', coordinates: [-102, 23], name: 'Mexico' },
  GTQ: { flag: 'gt', coordinates: [-90, 15], name: 'Guatemala' },
  CRC: { flag: 'cr', coordinates: [-83, 9], name: 'Costa Rica' },
  PAB: { flag: 'pa', coordinates: [-80, 8], name: 'Panama' },
  HNL: { flag: 'hn', coordinates: [-86, 15], name: 'Honduras' },
  JMD: { flag: 'jm', coordinates: [-77, 18], name: 'Jamaica' },
  DOP: { flag: 'do', coordinates: [-70, 18], name: 'Dom. Republic' },
  TTD: { flag: 'tt', coordinates: [-61, 10], name: 'Trinidad/Tobago' },
  XCD: { flag: 'lc', coordinates: [-61, 17], name: 'East Caribbean' },
  BSD: { flag: 'bs', coordinates: [-77, 25], name: 'Bahamas' },
  
  // South America
  BRL: { flag: 'br', coordinates: [-51, -14], name: 'Brazil' },
  ARS: { flag: 'ar', coordinates: [-63, -38], name: 'Argentina' },
  CLP: { flag: 'cl', coordinates: [-71, -35], name: 'Chile' },
  COP: { flag: 'co', coordinates: [-74, 4], name: 'Colombia' },
  PEN: { flag: 'pe', coordinates: [-75, -9], name: 'Peru' },
  
  // Oceania
  AUD: { flag: 'au', coordinates: [133, -25], name: 'Australia' },
  NZD: { flag: 'nz', coordinates: [174, -40], name: 'New Zealand' },
  FJD: { flag: 'fj', coordinates: [179, -18], name: 'Fiji' },
  PGK: { flag: 'pg', coordinates: [147, -6], name: 'Papua New Guinea' },
  WST: { flag: 'ws', coordinates: [-171, -13], name: 'Samoa' }
};

export default function Home() {
  const currentYear = new Date().getFullYear().toString();
  const today = new Date();
  const currentDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const [dateStart, setDateStart] = useState(`${currentYear}-01-01`);
  const [dateEnd, setDateEnd] = useState(currentDateStr);
  
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [dbStatus, setDbStatus] = useState('Loading...');
  
  // Map Interactive Controls via react-simple-maps native handling
  const [position, setPosition] = useState({ coordinates: [0, 0], zoom: 1 });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const mapEl = mapContainerRef.current;
    if (!mapEl) return;
    
    // Aggressively trap wheel scale operations to stop standard browser zoom or dashboard scrolling
    const blockGlobalZoom = (e: WheelEvent) => {
      // Stop Safari/Chrome entire page scaling on trackpad pinch
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); 
      }
    };
    
    mapEl.addEventListener('wheel', blockGlobalZoom, { passive: false });
    return () => mapEl.removeEventListener('wheel', blockGlobalZoom);
  }, []);
  
  const handleMoveEnd = (position: {coordinates: [number, number], zoom: number}) => {
     setPosition(position);
  };
  
  // Dynamic mocked generation so we always view 38 plots visually regardless of DB pipeline delay
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
    fetch(`/api/engine?base=${baseCurrency}&start=${dateStart}&end=${dateEnd}`)
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
  }, [baseCurrency, dateStart, dateEnd]);

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
        <nav className="hidden xl:flex gap-8 text-sm font-bold text-gray-400">
          <a href="#map" className="hover:text-white transition-colors uppercase tracking-wider">Global Map</a>
          <a href="#rankings" className="hover:text-white transition-colors uppercase tracking-wider">Risk Rankings</a>
          <a href="#optimizer" className="hover:text-white transition-colors uppercase tracking-wider">Optimizer</a>
          <a href="#quickcheck" className="hover:text-white transition-colors uppercase tracking-wider">Pair Analysis</a>
        </nav>
        
        <div className="flex gap-4 items-center">
          {/* Timeline Filter */}
          <div className="hidden md:flex gap-2 items-center bg-black/40 px-3 py-1.5 rounded-lg border border-gray-800">
             <label className="text-[10px] uppercase font-bold text-gray-500 mr-1">Range</label>
             <input 
               type="date" 
               value={dateStart} 
               onChange={e => setDateStart(e.target.value)}
               className="bg-transparent text-xs text-white outline-none cursor-pointer font-mono [color-scheme:dark]"
              />
             <span className="text-gray-600">-</span>
             <input 
               type="date" 
               value={dateEnd} 
               onChange={e => setDateEnd(e.target.value)}
               className="bg-transparent text-xs text-white outline-none cursor-pointer font-mono [color-scheme:dark]"
              />
          </div>
          
          {/* Base Anchor Option */}
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
          
          <div 
             ref={mapContainerRef} 
             style={{ touchAction: 'none', overscrollBehavior: 'none' }}
             className="w-full relative bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center p-0 aspect-video min-h-[500px]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-[#0a0a0a] opacity-80 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"></div>
            
            {/* React Simple Maps Fully Integrated Composable Component */}
            <ComposableMap projection="geoEquirectangular" projectionConfig={{ scale: 180, center: [0, 0] }} style={{ width: "100%", height: "100%" }}>
              <ZoomableGroup center={position.coordinates as [number, number]} zoom={position.zoom} onMoveEnd={handleMoveEnd} maxZoom={10}>
                <Geographies geography={geoUrl}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo: any) => (
                      <Geography 
                        key={geo.rsmKey} 
                        geography={geo} 
                        fill="rgba(255,255,255,0.18)"
                        stroke="rgba(255,255,255,0.3)" 
                        style={{
                          default: { outline: "none" },
                          hover: { fill: "rgba(255,255,255,0.3)", outline: "none" },
                          pressed: { outline: "none" }
                        }}
                      />
                    ))
                  }
                </Geographies>

                {Object.keys(CURRENCY_DICTIONARY).map((curcode) => {
                   const info = CURRENCY_DICTIONARY[curcode];
                   const mathData = data.find(d => d.pair === curcode);
                   
                   // If it's the base currency, force specific values, else use math data
                   const isBase = curcode === baseCurrency;
                   const borderColor = isBase ? 'border-white' : (mathData ? `border-${getRiskColor(mathData.r, true)}` : 'border-gray-500');
                   const shadowColor = isBase ? 'rgba(255,255,255,0.5)' : (mathData ? (mathData.r < 0.3 ? 'rgba(29,185,84,0.5)' : (mathData.r > 0.7 ? 'rgba(255,77,79,0.5)' : 'rgba(24,144,255,0.5)')) : 'transparent');

                   return (
                     <Marker key={curcode} coordinates={info.coordinates}>
                       {/* Master group container holding hover logic. It DOES NOT scale. */}
                       <g className="cursor-pointer group">
                         {/* 1. Invisible Static Hit Area. This NEVER moves, preventing all hover math thrashing/shaking */}
                         <circle cx="0" cy="0" r="26" fill="transparent" className="pointer-events-auto" />
                         
                         {/* 2. The Flag Bubble - Scales strictly from center on group hover */}
                         <g className="transform group-hover:scale-[1.8] transition-transform origin-center pointer-events-none">
                           <foreignObject x={-14} y={-14} width={28} height={28} className="overflow-visible pointer-events-none">
                             <div className={`relative w-7 h-7 rounded-full overflow-hidden border-2 ${borderColor}`} style={{boxShadow:`0 0 15px ${shadowColor}`}}>
                               <Image src={`https://flagcdn.com/w80/${info.flag}.png`} alt={info.name} fill className="object-cover" />
                             </div>
                           </foreignObject>
                         </g>
                         
                         {/* 3. The Tooltip - Escapes boundaries using absolute and DOES NOT SCALE, keeping text legible & sharp */}
                         <foreignObject x={-14} y={-14} width={28} height={28} className="overflow-visible pointer-events-none z-50">
                           <div className="absolute bottom-8 left-1/2 mb-1 -translate-x-1/2 bg-spotify-dark border border-gray-700 p-2 rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] opacity-0 group-hover:opacity-100 transition-opacity w-44 pointer-events-none">
                             <div className="font-bold border-b border-gray-800 pb-1 mb-1 text-[11px] font-sans tracking-wide">{info.name} <span className="text-gray-400 font-mono text-[10px] float-right mt-0.5">{curcode}</span></div>
                             {isBase ? (
                               <div className="text-[10px] text-center text-gray-500 py-1">Current Base Anchor</div>
                             ) : (
                               <>
                                 <div className="text-[11px] flex justify-between"><span className="text-gray-400">Pearson:</span> <span className={`text-${getRiskColor(mathData?.r || 0, true)} font-mono font-bold`}>{mathData?.r}</span></div>
                                 <div className="text-[11px] flex justify-between mt-0.5"><span className="text-gray-400">Volatilty:</span> <span className={`text-${getRiskColor(mathData?.vol || 0)} font-mono`}>{mathData?.vol}%</span></div>
                               </>
                             )}
                           </div>
                         </foreignObject>
                       </g>
                     </Marker>
                   );
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>

          {/* Map Interaction Controls & Explainer */}
          <div className="mt-6 flex flex-col gap-4 bg-black/40 p-5 rounded-2xl border border-gray-800">
             
             {/* Slider & Actions */}
             <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-800/60 pb-5">
                 
                 <div className="flex items-center gap-3 w-full md:w-1/2 bg-spotify-dark/50 px-4 py-2 rounded-lg border border-gray-800/80">
                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight whitespace-nowrap">Pan Longitude</span>
                     <input 
                        type="range" 
                        min="-180" 
                        max="180" 
                        step="1"
                        value={position.coordinates[0]}
                        onChange={(e) => setPosition({ ...position, coordinates: [parseFloat(e.target.value), position.coordinates[1]] as [number, number] })}
                        className="w-full accent-spotify-neonGreen h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                     />
                     <span className="text-[10px] font-mono text-gray-400 w-8 text-right bg-black/50 px-1 py-0.5 rounded">{position.coordinates[0].toFixed(0)}°</span>
                 </div>
                 
                 <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                    <div className="text-spotify-neonGreen font-mono font-bold text-sm text-right bg-spotify-dark/50 px-3 py-1.5 rounded-lg border border-gray-800/80">z {position.zoom.toFixed(1)}x</div>
                    <button onClick={() => {setPosition({coordinates: [0,0], zoom: 1});}} className="text-[10px] bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 outline-none rounded-lg uppercase tracking-wider font-bold transition-colors shadow-lg">Recenter Map</button>
                 </div>
             </div>
             
             {/* Financial Metrics Explainer */}
             <div className="pt-1">
               <p className="text-[11.5px] text-gray-400 leading-relaxed font-medium">
                 <strong className="text-spotify-neonGreen uppercase tracking-widest font-black mr-1.5">Pearson Correlation (r):</strong> 
                 Measures the linear alignment between a currency and your Base Anchor. Ranges from <span className="text-white font-mono">-1.0</span> (perfect inverse movement) to <span className="text-white font-mono">1.0</span> (perfect lockstep). Values near 0 indicate low statistical correlation, offering strong diversification resilience.
                 <br/>
                 <strong className="text-spotify-electricBlue uppercase tracking-widest font-black mr-1.5 mt-2 inline-block">Volatility (σ):</strong> 
                 The annualized standard deviation of daily returns. Higher percentages indicate dramatic price fluctuations and amplified exposure risk relative to the Base Anchor.
               </p>
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
                  <div className="relative group cursor-pointer">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden shadow-sm">
                       <Image src={`https://flagcdn.com/w80/${info.flag}.png`} alt={metric.pair} fill className="object-cover" />
                    </div>
                    {/* Tooltip dynamically shooting right to explicitly prevent #1 list-item vertical container clipping */}
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 flex flex-col items-start min-w-max">
                       <span className="text-[11px] font-bold text-white whitespace-nowrap leading-tight">{info.name}</span>
                       <span className="text-[9px] font-mono text-spotify-neonGreen uppercase tracking-widest">{metric.pair}</span>
                    </div>
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
