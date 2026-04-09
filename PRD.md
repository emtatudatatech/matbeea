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
- **Data Ingestion API:** `yahoo-finance2` (v3 `chart()` spec)
- **Math Engine:** `simple-statistics` (Pearson Coefficient, Standard Deviation)
- **Deployment Platform:** Netlify (Edge caching & Cron Scheduled Functions)
- **Geographic Modeling:** `react-simple-maps` (D3/TopoJSON projection)

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
- **Graceful Financial Fallbacks (LOCF):** Defends strictly against math errors (e.g. holiday market closures causing unequal array tick measurements) by enforcing **Last-Observation-Carried-Forward** bridging algorithms natively aligning varying temporal currencies.
- **Dynamic Boundary Filters:** Securely accepts string-based temporal `start` and `end` bounds queried safely through Prisma `gte` and `lte` arguments directly mapped to user interactions globally.

### 3.3. Interactive Dashboard UI
- **Styling:** Adheres strictly to a sophisticated, ultra-premium "Spotify-style" dark theme UI (utilizing deep charcoals, `#121212` backgrounds, and high-contrast neon accents, built exclusively with native Tailwind utilities).
- **Global Calendar Ribbon:** A dynamic overarching native `<input type="date">` Ribbon initializing at the current Day spanning backwards structurally generating the temporal `get`/`lte` bounds scaling the global Database responses accurately across specific time spans.
- **D3 Topographical Asset Map:** Built entirely upon `react-simple-maps` utilizing Azimuthal Equidistant mapping. Supports native pinch-to-zoom/pan logic and an external longitudinal pan-slider seamlessly re-mapping explicit TopoJSON layout structures.
- **Reactive Risk Rankings:** A live updating sidebar mapping current Ann. Volatility spreads actively incorporating semantic `Ascending/Descending` toggle sorting hooked directly into localized visual feedback statements conditionally explaining the resulting lists explicitly.
- **Interactive Portfolio Optimizer:** A dynamically driven heuristic simulator where users visually swap components natively leveraging hidden `<select>` DOM elements matching native styling text. React local-states seamlessly trigger formula algorithms bridging live DB Pearsons/Volatility records estimating dynamic `Global Risk` variance visually upon user-clicks in real-time.

## 4. Maintenance Guidelines
- Every structural feature addition, framework upgrade, or new data source requested must be appended concurrently into this PRD document AND summarized sequentially in the `README.md` file dynamically.
