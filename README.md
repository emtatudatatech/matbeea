# Matbeea - Global FX Risk & Correlation Dashboard

A secure, high-performance Full-Stack Application built with **Next.js (App Router)** designed to dynamically assess daily financial volatilities and Pearson Correlation shifts across **39 major global currencies**. By natively tracking historical closing data, the system optimizes portfolio combinations to lower variance statistically.

## Features

- **Global Interactive Map (`react-simple-maps`)**: Dynamic D3-backed TopoJSON projection utilizing pinch-to-zoom mapping, geographic panning horizontal sliders, and hover-state tracking of localized $\sigma$ and Pearson nodes.
- **Serverless PostgreSQL**: Hosted on [Neon.tech](https://neon.tech/) scaling-to-zero when unvisited while remaining natively type-synced through Prisma ORM with defensive `createMany` bulk-batching to respect edge execution limits.
- **Headless Ingestion Pipeline**: Integrates a `netlify.toml` specified cron job to pull deep time-series snapshots (Back into Q1 2024 at minimum) seamlessly via `yahoo-finance2.chart()` architecture.
- **Real-Time LOCF Mathematical Engine**: Computes daily correlation vectors dynamically via `simple-statistics`, bridging misaligned global market holidays automatically strictly utilizing algorithmic Last-Observation-Carried-Forward (LOCF) alignment strategies.
- **Dynamic Interaction Modules**: Engineered with high-contrast UI layers overlaying interactive Native dropdown asset-selection logic to manually mock complex Portfolio Variances dynamically over a live localized Timeline Filter component.

## Architecture

- **Frontend**: Next.js 15, React 19, TailwindCSS 3 
- **Backend / APIs**: Next.js Server Components / Endpoints + Netlify Scheduled Functions
- **Database Layer**: Neon Serverless Postgres + Prisma Client ORM
- **Market Sourcing**: Yahoo Finance v3 (`chart()` Engine)
- **Geographic Mapping**: `react-simple-maps` (D3 & TopoJSON)

## Covered Currencies 

The database ingests standard currency combinations indexed against USD (`*=USD=X`) across multiple regional hubs:
- **Europe/Britain**: `EUR`, `GBP`, `CHF`, `SEK`, `NOK`, `RUB`
- **APAC & Oceania**: `JPY`, `CNY`, `KRW`, `INR`, `AUD`, `NZD`, `HKD`, `TWD`, etc.
- **The Americas**: `CAD`, `MXN`, `BRL`, `ARS`, `CLP`, `JMD`, etc.
- **Africa**: `ZAR`, `NGN`, `EGP`, `KES`, `ZMW`, `MAD`

## Local Data Initialization
Before developing, configure an `.env.local` pointing securely to your Neon instance.

```bash
# Push Prisma Schema Structure
npx prisma db push

# Generate Prisma Client (crucial for local/Netlify)
npx prisma generate 

# Test Dev UI
npm run dev
```

## Netlify Deployment 

This application relies on aggressive edge caching capabilities and strictly adheres to the **Netlify V2 Scheduled Functions** specification:
- The `sync-fx-data.ts` cron job utilizes natively typed Web `Request` and `Response` objects.
- Security and timing are centrally codified in `netlify.toml` via the `[functions."sync-fx-data"]` directive mapping to a `@daily` UTC invocation schedule.

```bash
# Deploys out of box safely via
npm run build
```
*(Note: A `postinstall` script ensures Netlify CI rebuilds natively compiled Prisma components accurately against Ubuntu servers).*

## Application
Access the application's latest version here: [FX Risk Dashboard](https://splendid-jelly-8ac936.netlify.app/)