import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/prisma/client';
import { sampleCorrelation, standardDeviation } from 'simple-statistics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base') || 'USD';
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    
    // Construct Prisma dynamic where constraints based on calendar parameters
    const whereClause: Prisma.FxDailyPriceWhereInput = {};
    if (startStr && endStr) {
       whereClause.date = {
          gte: new Date(startStr),
          lte: new Date(endStr)
       };
    }
    
    // Fetch specifically filtered records
    const allData = await prisma.fxDailyPrice.findMany({
      where: whereClause,
      orderBy: { date: 'asc' }
    });

    if (!allData || allData.length === 0) {
      return NextResponse.json({ error: 'No FX data available' }, { status: 404 });
    }

    // Grouping data by currency pair
    const grouped: Record<string, number[]> = {};
    const dates = Array.from(new Set(allData.map(d => d.date.getTime()))).sort();
    
    allData.forEach((row) => {
      if (!grouped[row.currencyPair]) {
        grouped[row.currencyPair] = [];
      }
      grouped[row.currencyPair].push(row.closingPrice);
    });

    // Ensure array length alignment for math.
    // Given global holidays miss days differently across 39 countries, we use strict LOCF (Last Observation Carried Forward).
    // EXCLUDE pairs with fewer than 50 data points so that anomaly currencies (like WST) don't lock down the entire global timeline matrix 
    const PAIR_THRESHOLD = 50; 
    const counts: Record<string, number> = {};
    allData.forEach(r => { counts[r.currencyPair] = (counts[r.currencyPair] || 0) + 1; });
    const validPairs = Object.keys(counts).filter(p => counts[p] >= PAIR_THRESHOLD);

    const pairNames = validPairs;
    const alignedData: Record<string, number[]> = {};
    pairNames.forEach(pair => alignedData[pair] = []);
    
    // Fast O(1) time-lookup map
    const lookup: Record<string, Record<number, number>> = {};
    allData.forEach(row => {
       if (!lookup[row.currencyPair]) lookup[row.currencyPair] = {};
       lookup[row.currencyPair][row.date.getTime()] = row.closingPrice;
    });

    const lastKnown: Record<string, number> = {};
    let validDaysUsed = 0;

    dates.forEach(t => {
       // 1. Update last known price if market was open
       pairNames.forEach(pair => {
          if (lookup[pair] && lookup[pair][t] !== undefined) {
             lastKnown[pair] = lookup[pair][t];
          }
       });

       // 2. Only record aligned vector if ALL currencies have booted up and registered at least 1 historical price
       const allMarketsSeeded = pairNames.every(pair => lastKnown[pair] !== undefined);
       if (allMarketsSeeded) {
          pairNames.forEach(pair => {
             alignedData[pair].push(lastKnown[pair]);
          });
          validDaysUsed++;
       }
    });

    if (validDaysUsed < 2) {
      return NextResponse.json({ error: 'Insufficient aligned data for correlation.' }, { status: 400 });
    }

    // Daily simple returns, computed once and reused for both volatility and correlation.
    // Correlation must be measured on returns rather than price levels: two currencies
    // that merely drift in the same direction produce a near-1 correlation on levels
    // while their day-to-day risk may be unrelated, and portfolio variance depends on
    // the co-movement of returns.
    const returnsByPair: Record<string, number[]> = {};
    pairNames.forEach(pair => {
      const prices = alignedData[pair];
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const previous = prices[i - 1];
        returns.push(previous === 0 ? 0 : (prices[i] - previous) / previous);
      }
      returnsByPair[pair] = returns;
    });

    // Compute Volatility (Risk)
    const riskRankings = pairNames.map(pair => {
      const returns = returnsByPair[pair];
      const dailyVolatility = returns.length > 1 ? standardDeviation(returns) : 0;
      const annualizedVolatility = dailyVolatility * Math.sqrt(252);
      return { pair, volatility: annualizedVolatility };
    }).sort((a, b) => b.volatility - a.volatility);

    const safeCorrelation = (a: number[], b: number[]): number => {
      // sampleCorrelation throws on short input and returns NaN for a flat series
      // (a hard-pegged currency), both of which we degrade to "no relationship".
      if (a.length !== b.length || a.length < 2) return 0;
      try {
        const r = sampleCorrelation(a, b);
        return Number.isFinite(r) ? r : 0;
      } catch {
        return 0;
      }
    };

    // Full pairwise Pearson matrix. The portfolio optimizer needs corr(i, j) between
    // arbitrary holdings — not just each currency against the base — to compute a
    // genuine portfolio variance, so the matrix is built once here rather than in the UI.
    const correlationMatrix: Record<string, Record<string, number>> = {};
    pairNames.forEach(pair => { correlationMatrix[pair] = {}; });

    for (let i = 0; i < pairNames.length; i++) {
      const a = pairNames[i];
      correlationMatrix[a][a] = 1;
      for (let j = i + 1; j < pairNames.length; j++) {
        const b = pairNames[j];
        // Kept at 6dp: coarser rounding can nudge the matrix out of positive
        // semi-definiteness, which would let the optimizer report an impossible
        // near-zero variance.
        const r = Number(safeCorrelation(returnsByPair[a], returnsByPair[b]).toFixed(6));
        correlationMatrix[a][b] = r;
        correlationMatrix[b][a] = r;
      }
    }

    // Correlations against the selected base, read straight off the matrix.
    const basePair = base === 'USD' ? 'EURUSD=X' : `${base}USD=X`; // simplified base matching logic
    const correlations: Record<string, number> = {};

    if (correlationMatrix[basePair]) {
      pairNames.forEach(pair => {
        if (pair !== basePair) {
          correlations[pair] = correlationMatrix[basePair][pair];
        }
      });
    }

    return NextResponse.json({
      riskRankings,
      correlations,
      correlationMatrix,
      validDaysUsed: validDaysUsed,
      baseCurrency: base
    });
  } catch (error) {
    console.error("Engine API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error calculating correlations' }, { status: 500 });
  }
}
