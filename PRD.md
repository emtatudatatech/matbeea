# Product Requirements Document (PRD)
**Project Name:** Global FX Risk & Correlation Dashboard  
**Date:** April 2026 (Ongoing)  

## 1. Product Vision & Scope
The Global FX Risk & Correlation Dashboard is a high-performance financial analytics tool designed to assess and visualize daily volatility and correlation shifts across major global currencies. The primary goal is to help users algorithmically evaluate risk spreads and identify mathematically optimal portfolio diversification opportunities (minimum variance pairs).

## 2. Architecture & Technology Stack
- **Frontend Framework:** Next.js 15 (App Router), React 19
- **Design System:** Tailwind CSS v3 (Customized Spotify-style dark theme)
- **Database:** Neon Serverless PostgreSQL
- **ORM:** Prisma v5
- **Data Ingestion API:** `yahoo-finance2`
- **Math Engine:** `simple-statistics` (Pearson Correlation, Standard Deviation)
- **Deployment Platform:** Netlify (Edge caching & Cron Scheduled Functions)

## 3. Core Features (Implemented)

### 3.1. Automated Data Pipeline (Netlify V2 Specifications)
- **Daily Cron Ingestion:** A Scheduled Function running strictly on the Netlify V2 architecture (returning standard Web `Response` objects without AWS proxy wrappers).
- **TOML Bound Schedule:** Timing is securely bound via `.toml` configuration to fire on a `@daily` UTC interval, seamlessly fetching historical ticks via `yahoo-finance2`.
- **Time-Series Storage:** Persists pricing arrays dynamically into the Neon Postgres database utilizing a uniquely indexed Prisma model schema for structured query extraction.
- **Covered Asset Universe:** Strictly monitors 39 global currencies against the U.S. Dollar.
  - **Africa:** ZAR, NGN, EGP, KES, ZMW, MAD
  - **Asia:** JPY, CNY, INR, HKD, KRW
  - **Europe:** EUR, GBP, CHF, SEK, RUB, NOK
  - **North/Central America & Caribbean:** USD, CAD, MXN, GTQ, CRC, PAB, HNL, JMD, DOP, TTD, XCD, BSD
  - **South America:** BRL, ARS, CLP, COP, PEN
  - **Oceania:** AUD, NZD, FJD, PGK, WST

### 3.2. Statistical Engine (`/api/engine`)
- **Annualized Volatility:** Parses arrays of daily price movements to calculate rolling percentage risk spreads mathematically.
- **Pearson Coefficient Algorithm:** Generates $r$ variables mapping cross-asset dependencies linearly (from +1 heavily correlated down to -1 negatively correlated risk shields).
- **Graceful Fallbacks:** Defends strictly against math errors (e.g. `NaN`, mismatched dataset arrays, missing ticks or empty local databases) by rendering secure deterministic mocked outputs recursively.

### 3.3. Interactive Dashboard UI
- **Styling:** Adheres strictly to a sophisticated, ultra-premium "Spotify-style" dark theme UI (utilizing deep charcoals, `#121212` backgrounds, and high-contrast neon accents, built exclusively with native Tailwind utilities).
- **Global 2D Asset Map:** An Azimuthal Equidistant layout dynamically plotting all 39 interactive global flags representing currencies geometrically. Each node features color-coded dynamic shadow-rings that visualize relationship risks on hover.
- **Risk Rankings:** A live updating sidebar calculating the standard deviation (Ann. Volatility spread) of all configured currencies recursively dynamically sorted from highest risk to safest.
- **Portfolio Variance Optimizer:** A visual minimum variance weighting distribution tool outlining statistical risk-reduction mixes.
- **Pair Analysis Tool:** A dropdown matrix evaluating immediate 1-to-1 Pearson Correlation connections rendering dynamically styled safety badges (e.g. "HEAVY CORRELATION" vs "LOW RISK SHIELD").

## 4. Maintenance Guidelines
- Every structural feature addition, framework upgrade, or new data source requested must be appended concurrently into this PRD document AND summarized sequentially in the `README.md` file dynamically.
