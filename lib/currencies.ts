export type CurrencyInfo = {
  flag: string;
  coordinates: [number, number];
  name: string;
};

// The 39 Major Global Currencies + USD Base mapped to EXACT Longitude/Latitude coordinates
export const CURRENCY_DICTIONARY: Record<string, CurrencyInfo> = {
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

export type RiskTone = 'green' | 'blue' | 'red';

export const getRiskTone = (value: number, isCorrelation: boolean = false): RiskTone => {
  if (isCorrelation) {
    if (Math.abs(value) < 0.3) return 'green'; // Highly uncorrelated = good for portfolio
    if (Math.abs(value) <= 0.7) return 'blue';
    return 'red';
  }
  if (value > 15) return 'red';
  if (value > 8) return 'blue';
  return 'green';
};

// Tailwind resolves only complete class names at build time, so risk colours are
// looked up rather than interpolated. Each token flips with the active theme.
export const RISK_TEXT: Record<RiskTone, string> = {
  green: 'text-risk-low',
  blue: 'text-risk-mid',
  red: 'text-risk-high',
};

export const RISK_BORDER: Record<RiskTone, string> = {
  green: 'border-risk-low',
  blue: 'border-risk-mid',
  red: 'border-risk-high',
};

export const RISK_BG: Record<RiskTone, string> = {
  green: 'bg-risk-low',
  blue: 'bg-risk-mid',
  red: 'bg-risk-high',
};

export const RISK_BORDER_SOFT: Record<RiskTone, string> = {
  green: 'border-risk-low/50',
  blue: 'border-risk-mid/50',
  red: 'border-risk-high/50',
};

export const RISK_BG_SOFT: Record<RiskTone, string> = {
  green: 'bg-risk-low/10',
  blue: 'bg-risk-mid/10',
  red: 'bg-risk-high/10',
};

// CSS custom properties, so SVG attributes pick up the active theme.
export const RISK_VAR: Record<RiskTone, string> = {
  green: 'var(--risk-low)',
  blue: 'var(--risk-mid)',
  red: 'var(--risk-high)',
};
