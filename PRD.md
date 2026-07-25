# Product Requirements Document (PRD)
**Project Name:** Global FX Risk & Correlation Dashboard  
**Date:** April 2026 (Ongoing)  

## 1. Product Vision & Scope
The Global FX Risk & Correlation Dashboard is a high-performance financial analytics tool designed to assess and visualize daily volatility and correlation shifts across major global currencies. The primary goal is to help users algorithmically evaluate risk spreads and identify mathematically optimal portfolio diversification opportunities (minimum variance pairs).

## 2. Architecture & Technology Stack
- **Frontend Framework:** Next.js 16 (App Router), React 19
- **Design System:** Tailwind CSS v4 (Customized Spotify-style dark theme, CSS-first `@theme` configuration)
- **Database:** Neon Serverless PostgreSQL
- **ORM:** Prisma v7 (driver-adapter mode via `@prisma/adapter-neon` + `@neondatabase/serverless`)
- **Data Ingestion API:** `yahoo-finance2` (v4 `chart()` spec)
- **Math Engine:** `simple-statistics` (Pearson Coefficient, Standard Deviation)
- **Deployment Platform:** Netlify (Edge caching & Cron Scheduled Functions)
- **Geographic Modeling:** `d3-geo` / `d3-zoom` / `topojson-client`, Equal Earth projection
- **Tooling:** TypeScript 6.x, ESLint 9.x flat config (`eslint.config.mjs`)

### 2.1. Dependency Modernization (July 2026)
A full dependency refresh moved every package to its latest usable release:
- **Next.js 16.2.2 → 16.2.11, React 19.2.4 → 19.2.8** alongside matching type packages.
- **Tailwind CSS 3.4 → 4.3:** `tailwind.config.ts` was removed in favour of an `@theme` block in `app/globals.css`; PostCSS now loads `@tailwindcss/postcss` and autoprefixer was dropped. Runtime-interpolated colour classes (`text-${...}`) were replaced with static `RISK_TEXT` / `RISK_BORDER` / `RISK_BG` lookup maps, because v4 only emits utilities whose complete class names appear in source.
- **Prisma 5.22 → 7.9:** the datasource `url` moved out of `schema.prisma` into a new `prisma.config.ts`, and `PrismaClient` is now instantiated with the Neon driver adapter (WebSocket transport, better suited to scale-to-zero serverless invocations than raw TCP).
- **yahoo-finance2 3.14 → 4.0:** the `chart()` contract is unchanged, so the ingestion function needed no rewrite.
- **`next lint` removal:** Next 16 dropped the command; linting now runs `eslint .` against a flat config.
- **Deliberate pins:** TypeScript remains on 6.x (Next 16's type checker and `typescript-eslint` both reject TS 7.0) and ESLint on 9.x (`eslint-plugin-react`, a transitive dependency of `eslint-config-next`, has no ESLint 10 release). Revisit when upstream support ships.

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
- **Styling & Theming:** Light and dark themes, selectable via a persisted in-app toggle and defaulting to the operating-system preference. Both are expressed through semantic CSS custom properties (`surface`, `ink`, `edge`, `risk-*`, `holding-*`) declared in `app/globals.css`, so components name roles rather than colours. Each theme carries its own validated values instead of inverting the other: the dark-theme green and red reach only ~2.6:1 and ~3.3:1 on a white surface, short of the 4.5:1 that text requires. Preference is applied by an inline pre-paint script, so a dark-mode user never sees a light flash.
- **Map Legibility:** Land now clears the ocean by 3.4:1 in dark mode, against the 1.5:1 that the previous translucent-white fill managed; in light mode the geography is defined by a 3.4:1 coastline stroke rather than the fill. The darkening radial vignette that suppressed overall brightness has been removed.
- **Global Calendar Ribbon:** A dynamic overarching native `<input type="date">` Ribbon initializing at the current Day spanning backwards structurally generating the temporal `get`/`lte` bounds scaling the global Database responses accurately across specific time spans.
- **D3 Topographical Asset Map:** Rendered directly with `d3-geo` and `d3-zoom` (no wrapper library) on an **Equal Earth** projection. Equal Earth is equal-area, so each region occupies a fair share of the map — a Mercator-family projection would inflate Russia and Scandinavia while shrinking Africa, which misleads on a dashboard whose purpose is cross-region comparison. Supports pinch/scroll zoom, drag panning, and a longitude rotation slider that genuinely re-projects rather than translating. TopoJSON is served from the app's own origin, removing a runtime dependency on a third-party CDN.
- **Marker Tooltips:** The hovered marker is re-ordered to paint last, and its tooltip is rendered in an HTML layer above the entire SVG, so a neighbouring flag can never overlap it — the failure mode in the dense Caribbean and Northern European clusters. Tooltips are fully opaque, sit above the flag by default, and flip below when the marker is close enough to the top edge to be clipped.
- **Reactive Risk Rankings:** A live updating sidebar mapping current Ann. Volatility spreads actively incorporating semantic `Ascending/Descending` toggle sorting hooked directly into localized visual feedback statements conditionally explaining the resulting lists explicitly.
- **Interactive Portfolio Optimizer:** Users choose four currencies through native `<select>` controls; the allocation is then solved rather than assumed. Weights are the **long-only minimum-variance solution** for the chosen holdings, derived from annualized volatility and the pairwise correlation matrix, so changing any holding re-solves every weight and the headline `Global Risk` figure. Duplicate holdings are blocked at the control level, and the opening selection is the lowest-risk combination discovered across the whole currency universe (see 3.4).

### 3.4. Minimum-Variance Engine (`lib/portfolio.ts`)
- **Exact long-only solver:** A long-only minimum-variance optimum places positive weight on some subset of holdings and zero on the rest; restricted to that subset it is the closed-form solution `w = Σ⁻¹1 / (1ᵀΣ⁻¹1)`. The solver enumerates all subsets (15 for four holdings), solves each by Gauss-Jordan elimination with partial pivoting, discards infeasible ones, and keeps the lowest variance. This is exact, not approximate.
- **Lowest-risk default:** Greedy forward selection followed by exhaustive single-swap refinement. Verified to reproduce the true optimum of a full `C(38, 4)` exhaustive search (73,815 combinations) on live data, in ~10 ms versus ~700 ms.
- **Degenerate inputs:** Hard-pegged (zero-volatility) currencies, perfectly correlated holdings, singular covariance sub-matrices, and currencies missing from the dataset are all handled explicitly rather than producing a spuriously risk-free portfolio.
- **Correlation basis:** The engine correlates **daily returns**, not price levels. Correlating levels measures shared trend rather than co-movement of risk, and portfolio variance depends on the latter.
- **Chart encoding:** The allocation donut uses a categorical palette held deliberately separate from the green/blue/red risk palette, so an arc never reads as a risk verdict. Palette validated for lightness band, chroma floor, colour-vision-deficiency separation and contrast against the chart surface.

## 4. Maintenance Guidelines
- Every structural feature addition, framework upgrade, or new data source requested must be appended concurrently into this PRD document AND summarized sequentially in the `README.md` file dynamically.
