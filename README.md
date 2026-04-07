# Matbeea - Global FX Risk & Correlation Dashboard

A secure, high-performance Full-Stack Application built with **Next.js (App Router)** designed to dynamically assess daily financial volatilities and Pearson Correlation shifts across **39 major global currencies**. By natively tracking historical closing data, the system optimizes portfolio combinations to lower variance statistically.

## Features

- **Global 2D Asset Map**: Dynamic azimuthal equidistant projection UI grouping currencies continentally, complete with interactive hovered tracking of Volatility ($\sigma$) and Correlation ($r$) stats.
- **Real-Time Algorithms**: Computes daily correlation vectors dynamically via `simple-statistics`, ensuring completely strictly typed rendering devoid of UI-breaking `NaN` or divide-by-zero artifacts.
- **Serverless PostgreSQL**: Hosted on [Neon.tech](https://neon.tech/) scaling-to-zero when unvisited while remaining natively type-synced through Prisma ORM.
- **Headless Ingestion Pipeline**: Integrates a `netlify.toml` specified cron job to pull deep time-series snapshots (Back into Q1 2024 at minimum) seamlessly via `yahoo-finance2` behind-the-scenes.
- **Premium Aesthetics**: Engineered with deep contrast dark-modes (`#121212`), sophisticated font weights, floating glassmorphism overlays, and neon functional accents natively orchestrated through TailwindCSS.

## Architecture

- **Frontend**: Next.js 15, React 19, TailwindCSS 3 
- **Backend / APIs**: Next.js Server Components / Endpoints + Netlify Scheduled Functions
- **Database Layer**: Neon Serverless Postgres + Prisma Client ORM
- **Market Sourcing**: Yahoo Finance Native Fetcher

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

This application relies on aggressive edge caching capabilities and uses Netlify-specific Scheduled Event bindings for the daily `yahoo-finance2` node cron:

```bash
# Deploys out of box safely via
npm run build
```
*(Note: A `postinstall` script ensures Netlify CI rebuilds natively compiled Prisma components accurately against Ubuntu servers).*
