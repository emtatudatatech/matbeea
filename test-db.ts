import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const allData = await prisma.fxDailyPrice.findMany({
      orderBy: { date: 'asc' }
  });
  console.log("Total rows:", allData.length);
  
  if (allData.length === 0) {
      console.log("DB is completely empty!");
      return;
  }

  const grouped: Record<string, number> = {};
  allData.forEach(r => {
      grouped[r.currencyPair] = (grouped[r.currencyPair] || 0) + 1;
  });
  console.log("Counts per pair:", grouped);
  
  const dates = Array.from(new Set(allData.map(d => d.date.getTime()))).sort();
  console.log("Total unique dates:", dates.length);

  // LOCF Engine Logic
  const pairNames = Array.from(new Set(allData.map(d => d.currencyPair)));
  const lookup: Record<string, Record<number, number>> = {};
  allData.forEach(row => {
     if (!lookup[row.currencyPair]) lookup[row.currencyPair] = {};
     lookup[row.currencyPair][row.date.getTime()] = row.closingPrice;
  });

  const lastKnown: Record<string, number> = {};
  let validDaysUsed = 0;
  dates.forEach(t => {
     pairNames.forEach(pair => {
        if (lookup[pair] && lookup[pair][t] !== undefined) {
           lastKnown[pair] = lookup[pair][t];
        }
     });
     const allMarketsSeeded = pairNames.every(pair => lastKnown[pair] !== undefined);
     if (allMarketsSeeded) {
        validDaysUsed++;
     }
  });

  console.log("Valid Days (all markets seeded):", validDaysUsed);
  if (validDaysUsed < 2) {
      console.log("LOCF failed because validDaysUsed < 2");
      const unseeded = pairNames.filter(pair => lastKnown[pair] === undefined);
      console.log("At the end, these markets NEVER got seeded:", unseeded);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
