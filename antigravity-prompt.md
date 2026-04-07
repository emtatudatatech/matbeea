# Google Antigravity Build Prompt: FX Risk & Correlation Dashboard (Netlify Target)

**System Objective:** Generate a secure, high-performance Full-Stack Application (Next.js) optimized for **Netlify deployment**. The application must act as a real-time FX Risk and Correlation Dashboard. It will analyze 27 major global currencies, compute risk profiles based on historical volatility, and identify optimal, low-correlation pairings.

**Zero-Defect & QA Protocol (Strict Execution):**
* **Type Safety:** The entire codebase MUST be written in strict TypeScript. Define precise interfaces for all database schemas, API responses, and mathematical arrays to prevent runtime errors.
* **Error Handling:** Implement comprehensive `try/catch` blocks on all API routes and database queries. If an API limit is hit or the database times out, the UI must gracefully display a fallback state, never a white screen of death.
* **Mathematical Accuracy Checks:** Implement unit tests or validation steps within the correlation engine to ensure arrays are perfectly aligned before calculating Pearson correlations. Prevent any `NaN` or `Divide-By-Zero` errors from reaching the client.

**Design System & Aesthetic:**
* **Theme:** "Spotify-Style" dark mode. Use a deep, rich black/charcoal background (`#121212` to `#181818`).
* **Typography:** Clean, geometric sans-serif (e.g., Inter or Circular) with high-contrast white and light grey text.
* **Accents:** Vibrant neon accents for data visualization (Neon Green for positive/low risk, Crimson for negative/high risk, Electric Blue for neutral/UI elements).
* **Layout:** Smooth, card-based UI with soft drop shadows, rounded corners (8px-12px), and frosted glass (`backdrop-filter`) for floating elements.
* **Responsiveness:** Define graceful mobile degradation (e.g., the global map collapses into a searchable list on mobile). Implement neon-accented skeleton loaders while data is fetching.

**Architecture & Backend Specifications (Netlify + Neon):**
* **Framework:** Next.js (App Router) to leverage Netlify's seamless edge network and serverless API routes. 
* **Data Pipeline:** Use `yahoo-finance2` (Node.js library) to securely pull real-time and historical daily closing prices.
* **Data Constraint:** The historical dataset fetched must strictly cover the period from **January 1, 2024, to the current date**.
* **Storage:** Utilize **PostgreSQL (via Neon.tech)**. Write optimized SQL queries or use an ORM like Prisma/Drizzle to manage time-series data.
* **Scheduled Data Ingestion:** Implement a **Netlify Scheduled Function** (cron job) to ingest the latest daily closing prices into the Neon database once per day. The frontend MUST ONLY query the database, never the Yahoo Finance API directly, to ensure instant load times and avoid rate limits.
* **Data Cleaning & Math Engine:** In the serverless API routes, handle missing weekend/holiday data via forward-filling logic before executing volatility and Pearson correlation calculations using lightweight JavaScript math libraries (e.g., `simple-statistics` or custom optimized functions).
* **Caching:** Utilize Next.js data caching and `revalidate` tags to cache the heavy correlation matrix calculations.

---

## Section 1: Hero Header & Interactive World Map
* **Navigation:** Implement a sticky top-navigation bar with smooth-scroll anchor links (Tabs: `Global Map`, `Risk Rankings`, `Portfolio Optimizer`, `Pair Analysis`).
* **Base Anchor:** Include a prominent global **"Base Currency" selector** in the header (Default: USD). Changing this triggers a recalculation of all metrics.
* **Map Visualization:** Render a responsive, interactive 2D map using an **azimuthal equidistant projection** (flat-earth style, centered on the North Pole). No 3D globes.
* **Styling:** Color-code the map by the 6 regions (Africa, Asia, Europe, Central America, The Caribbean, South America, Oceania). 
* **Interaction & Assets:** Place circular, clickable flag icons over the corresponding nations. Fetch all flag assets dynamically from **https://flagpedia.net/**.
* **Pop-up Logic:** On click, display a sleek tooltip containing:
    * **Current FX Value** (Real-time vs Base Currency).
    * **Highest Correlation:** [Flag/Currency] + Correlation Coefficient ($r$).
    * **Lowest Correlation:** [Flag/Currency] + Correlation Coefficient ($r$).

## Section 2: Risk Analysis & Rankings
* **Mathematical Logic:** Calculate risk using Annualized Volatility based on daily returns. 
    * Equation: $\sigma_{annual} = \sigma_{daily} \times \sqrt{252}$
* **UI Display:** Render a dynamically sorted leaderboard. Use horizontal bar charts to visually represent volatility spread.

## Section 3: The Correlation Optimizer
* **Objective:** Find uncorrelated return streams to mathematically lower risk.
* **Mathematical Logic:** Calculate Pearson correlation coefficient ($r$) between all currency pairs.
* **Portfolio Logic:** Compute a portfolio combination yielding the lowest overall variance.
    * **Strict Constraints:** Maximum 5% weight each for USD and GBP ($w \le 0.05$). 
* **UI Display:** Show the optimized basket and weights in a sleek neon donut chart.

## Section 4: Currency Pair Quick-Check
* **UI Component:** Two large, stylized dropdown menus (with Flagpedia icons) to select two currencies.
* **Output:** Instantly display the current exchange rate and their correlation score.
* **Color Indicator Logic:**
    * **Low Risk (Neon Green):** $r < 0.3$ (Highly uncorrelated).
    * **Medium Risk (Amber/Yellow):** $0.3 \le r \le 0.7$ (Moderate correlation).
    * **High Risk (Neon Red):** $r > 0.7$ (Highly correlated).