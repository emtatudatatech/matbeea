import { NextResponse } from 'next/server';
import prisma from '@/prisma/client';
import { sampleCorrelation, standardDeviation } from 'simple-statistics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const base = searchParams.get('base') || 'USD';
    
    // Fetch all records
    const allData = await prisma.fxDailyPrice.findMany({
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
    // Given the schedule may miss days differently, we align strictly by date
    const alignedData: Record<string, number[]> = {};
    const pairNames = Object.keys(grouped);
    
    pairNames.forEach(pair => {
      alignedData[pair] = [];
    });

    // Extremely basic alignment approach: only include days where all requested pairs have data.
    // In production, we forward-fill. For now, strict intersection.
    const validDates = dates.filter(t => {
      const d = new Date(t);
      return pairNames.every(pair => allData.find(x => x.currencyPair === pair && x.date.getTime() === t));
    });

    if (validDates.length < 2) {
      return NextResponse.json({ error: 'Insufficient aligned data for correlation.' }, { status: 400 });
    }

    pairNames.forEach(pair => {
      validDates.forEach(t => {
        const val = allData.find(x => x.currencyPair === pair && x.date.getTime() === t);
        if (val) alignedData[pair].push(val.closingPrice);
      });
    });

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
      validDaysUsed: validDates.length,
      baseCurrency: base
    });
  } catch (error) {
    console.error("Engine API Error:", error);
    return NextResponse.json({ error: 'Internal Server Error calculating correlations' }, { status: 500 });
  }
}
