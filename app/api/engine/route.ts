import { NextResponse } from 'next/server';
import prisma from '@/prisma/client';
import { sampleCorrelation, standardDeviation } from 'simple-statistics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base') || 'USD';
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');
    
    // Construct Prisma dynamic where constraints based on calendar parameters
    const whereClause: any = {};
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

    // Compute Volatility (Risk)
    const riskRankings = pairNames.map(pair => {
      const prices = alignedData[pair];
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      const dailyVolatility = standardDeviation(returns);
      const annualizedVolatility = dailyVolatility * Math.sqrt(252);
      return { pair, volatility: annualizedVolatility };
    }).sort((a, b) => b.volatility - a.volatility);

    // Compute Math Engine Pearson Matrix for a few core pairs against the selected Base (simplified for fast API)
    const basePair = base === 'USD' ? 'EURUSD=X' : `${base}USD=X`; // simplified base matching logic
    const correlations: Record<string, number> = {};
    
    if (alignedData[basePair]) {
      pairNames.forEach(pair => {
        if (pair !== basePair) {
          try {
             const r = sampleCorrelation(alignedData[basePair], alignedData[pair]);
             correlations[pair] = Number.isNaN(r) ? 0 : r;
          } catch (e) {
             correlations[pair] = 0; // fallback gracefully
          }
        }
      });
    }

    return NextResponse.json({
      riskRankings,
      correlations,
      validDaysUsed: validDaysUsed,
      baseCurrency: base
    });
  } catch (error) {
    console.error("Engine API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error calculating correlations' }, { status: 500 });
  }
}
