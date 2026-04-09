import prisma from '../../prisma/client';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

// 27 Major Global Currencies list against USD mapping loosely to regional pairs
export const CURRENCY_PAIRS = [
  'ZARUSD=X', 'NGNUSD=X', 'EGPUSD=X', 'KESUSD=X', 'ZMWUSD=X', 'MADUSD=X',
  'JPYUSD=X', 'CNYUSD=X', 'INRUSD=X', 'HKDUSD=X', 'KRWUSD=X',
  'EURUSD=X', 'GBPUSD=X', 'CHFUSD=X', 'SEKUSD=X', 'RUBUSD=X', 'NOKUSD=X',
  'CADUSD=X', 'MXNUSD=X', 'GTQUSD=X', 'CRCUSD=X', 'PABUSD=X', 'HNLUSD=X',
  'JMDUSD=X', 'DOPUSD=X', 'TTDUSD=X', 'XCDUSD=X', 'BSDUSD=X',
  'BRLUSD=X', 'ARSUSD=X', 'CLPUSD=X', 'COPUSD=X', 'PENUSD=X',
  'AUDUSD=X', 'NZDUSD=X', 'FJDUSD=X', 'PGKUSD=X', 'WSTUSD=X'
];

export default async (req: Request) => {
  try {
    const startDate = new Date('2024-01-01');
    const endDate = new Date();

    console.log(`Starting scheduled sync from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    let totalUpserted = 0;

    for (const pair of CURRENCY_PAIRS) {
      console.log(`Fetching data for ${pair}`);
      try {
        const historicalOptions = {
          period1: startDate,
          period2: endDate,
          interval: '1d' as const
        };
        const chartResult = await yahooFinance.chart(pair, historicalOptions);
        const results = chartResult.quotes || [];
        
        // Forward fill logic for missing days can be handled later or during grouping.
        // For now, let's just insert all Yahoo Finance dates which omits weekends.
        for (const dataPoint of results) {
          if (dataPoint.close !== null && dataPoint.close !== undefined) {
             await prisma.fxDailyPrice.upsert({
               where: {
                 currencyPair_date: {
                   currencyPair: pair,
                   date: dataPoint.date
                 }
               },
               update: {
                 closingPrice: dataPoint.close
               },
               create: {
                 currencyPair: pair,
                 date: dataPoint.date,
                 closingPrice: dataPoint.close
               }
             });
             totalUpserted++;
          }
        }
      } catch (err) {
        console.error(`Failed fetching for ${pair}:`, err);
      }
    }
    
    return new Response(JSON.stringify({ message: "Sync successful", totalUpserted }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error("Master Sync failed", error);
    return new Response(JSON.stringify({ error: "Sync failed" }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
};
