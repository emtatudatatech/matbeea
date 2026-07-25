# Matbeea - Global FX Risk & Correlation Dashboard

A secure, high-performance Full-Stack Application built with **Next.js (App Router)** designed to dynamically assess daily financial volatilities and Pearson Correlation shifts across **39 major global currencies**. By natively tracking historical closing data, the system optimizes portfolio combinations to lower variance statistically.

## Features

- **Global Interactive Map (`d3-geo`)**: TopoJSON world rendered directly with `d3-geo` + `d3-zoom` on an **Equal Earth** projection — equal-area, so no region is visually inflated at another's expense. Supports pinch/scroll zoom, drag panning, a longitude rotation slider, and hover tracking of localized $\sigma$ and Pearson nodes. Map data is served from this app's own origin, not a third-party CDN.
- **Serverless PostgreSQL**: Hosted on [Neon.tech](https://neon.tech/) scaling-to-zero when unvisited while remaining natively type-synced through Prisma ORM with defensive `createMany` bulk-batching to respect edge execution limits.
- **Headless Ingestion Pipeline**: Integrates a `netlify.toml` specified cron job to pull deep time-series snapshots (Back into Q1 2024 at minimum) seamlessly via `yahoo-finance2.chart()` architecture.
- **Real-Time LOCF Mathematical Engine**: Computes daily correlation vectors dynamically via `simple-statistics`, bridging misaligned global market holidays automatically strictly utilizing algorithmic Last-Observation-Carried-Forward (LOCF) alignment strategies.
- **Dynamic Interaction Modules**: Engineered with high-contrast UI layers overlaying interactive Native dropdown asset-selection logic over a live localized Timeline Filter component.
- **Correlation Matrix Heat-map**: The full pairwise Pearson grid for every tracked currency, on a diverging blue↔red scale — blue pairs move oppositely and hedge, red pairs move together and concentrate risk, and near-zero pairs stay quiet. Hovering any cell reads out the exact coefficient with a row/column crosshair, and a "Show values" toggle swaps the grid for the underlying numbers so nothing depends on colour alone.
- **Minimum-Variance Portfolio Optimizer**: Pick any four currencies and the allocation is *solved*, not assumed — weights are the exact long-only minimum-variance solution built from annualized volatility and the full pairwise correlation matrix, so every weight and the headline risk figure re-solve on each change. The dashboard opens on the lowest-risk combination found across the entire currency universe. Solver lives in [`lib/portfolio.ts`](lib/portfolio.ts).

## Architecture

- **Frontend**: Next.js 16, React 19, TailwindCSS 4 
- **Backend / APIs**: Next.js Server Components / Endpoints + Netlify Scheduled Functions
- **Database Layer**: Neon Serverless Postgres + Prisma 7 Client ORM (via the `@prisma/adapter-neon` driver adapter)
- **Market Sourcing**: Yahoo Finance v4 (`chart()` Engine)
- **Geographic Mapping**: `d3-geo` + `d3-zoom` + `topojson-client` (Equal Earth projection)
- **Theming**: Light/dark via semantic CSS custom properties, with a persisted in-app toggle

### Theming

The UI is driven by semantic tokens (`surface`, `ink`, `edge`, `risk-*`, `holding-*`) declared in
`app/globals.css`. Each theme supplies its own values rather than inverting the other, because a
colour that clears contrast on a dark surface generally does not on a light one — the dark-mode
green and red reach only ~2.6:1 and ~3.3:1 against white. Components reference tokens
(`bg-surface-raised`, `text-ink-muted`) and never hardcode a palette colour, so both themes stay
correct from one set of class names.

Theme preference is stored in `localStorage` and applied by a small inline script in `app/layout.tsx`
before first paint, so a dark-mode user never sees a white flash. That script deliberately imports its
storage key from `lib/theme.ts` rather than from the client component — importing a value from a
`"use client"` module into the server layout yields a client-reference stub, not the string.

### Toolchain Notes

- **Tailwind CSS 4** is configured CSS-first: the palette lives in an `@theme` block inside `app/globals.css` and `tailwind.config.ts` no longer exists. PostCSS loads `@tailwindcss/postcss` (autoprefixer is now built in). Because v4 resolves only complete class names at build time, risk colours are looked up through the static `RISK_*` maps in `app/page.tsx` rather than being interpolated.
- **Prisma 7** no longer accepts `url` inside `schema.prisma`. The CLI reads the connection string from `prisma.config.ts`, while the runtime client is constructed with a Neon driver adapter in `prisma/client.ts`.
- **Linting** runs through the `eslint` CLI against the flat config in `eslint.config.mjs`; `next lint` was removed in Next 16.
- **Pinned deliberately**: `typescript` stays on 6.x and `eslint` on 9.x. TypeScript 7 is not yet supported by Next 16's type checker or by `typescript-eslint`, and ESLint 10 is not yet supported by `eslint-plugin-react` (pulled in via `eslint-config-next`). Both should be revisited once upstream support lands.

## Covered Currencies 

The database ingests standard currency combinations indexed against USD (`*=USD=X`) across multiple regional hubs:
- **Europe/Britain**: `EUR`, `GBP`, `CHF`, `SEK`, `NOK`, `RUB`
- **APAC & Oceania**: `JPY`, `CNY`, `KRW`, `INR`, `AUD`, `NZD`, `HKD`, `TWD`, etc.
- **The Americas**: `CAD`, `MXN`, `BRL`, `ARS`, `CLP`, `JMD`, etc.
- **Africa**: `ZAR`, `NGN`, `EGP`, `KES`, `ZMW`, `MAD`

## Local Data Initialization
Before developing, configure an `.env.local` pointing securely to your Neon instance. `DATABASE_URL` is
mandatory — `prisma/client.ts` fails fast with an explanatory error when it is absent.

```bash
# Push Prisma Schema Structure (reads DATABASE_URL via prisma.config.ts)
npx prisma db push

# Generate Prisma Client (crucial for local/Netlify)
npx prisma generate 

# Test Dev UI
npm run dev

# Typecheck and lint
npx tsc --noEmit
npm run lint
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