/**
 * Minimum-variance portfolio maths for the FX optimizer.
 *
 * Volatilities may be supplied in any consistent unit (this app passes annualized
 * percentages); every result is returned in that same unit.
 */

export type AssetStats = {
  /** Annualized volatility (σ) per currency code. */
  volatility: Record<string, number>;
  /** Pearson correlation of daily returns; symmetric, 1 on the diagonal. */
  correlation: Record<string, Record<string, number>>;
};

export type Allocation = {
  codes: string[];
  /** Weights aligned to `codes`, non-negative, summing to 1. */
  weights: number[];
  /** Portfolio volatility, √(wᵀΣw). */
  volatility: number;
};

const EPSILON = 1e-12;
const WEIGHT_TOLERANCE = 1e-9;

const correlationBetween = (a: string, b: string, stats: AssetStats): number => {
  if (a === b) return 1;
  const direct = stats.correlation[a]?.[b];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  // Fall back to the mirrored entry so a half-populated matrix still works.
  const mirrored = stats.correlation[b]?.[a];
  if (typeof mirrored === 'number' && Number.isFinite(mirrored)) return mirrored;
  return 0;
};

export const covariance = (a: string, b: string, stats: AssetStats): number => {
  const volatilityA = stats.volatility[a];
  const volatilityB = stats.volatility[b];
  if (!Number.isFinite(volatilityA) || !Number.isFinite(volatilityB)) return 0;
  // Rounding in transit can push a stored correlation a hair outside [-1, 1],
  // which would make the covariance matrix non-positive-semidefinite.
  const rho = Math.min(1, Math.max(-1, correlationBetween(a, b, stats)));
  return volatilityA * volatilityB * rho;
};

export const portfolioVariance = (
  codes: string[],
  weights: number[],
  stats: AssetStats,
): number => {
  let total = 0;
  for (let i = 0; i < codes.length; i++) {
    for (let j = 0; j < codes.length; j++) {
      total += weights[i] * weights[j] * covariance(codes[i], codes[j], stats);
    }
  }
  // A true variance cannot be negative; only floating-point noise gets us there.
  return Math.max(0, total);
};

/** Solves A·x = b by Gauss-Jordan with partial pivoting. Returns null if A is singular. */
const solveLinearSystem = (matrix: number[][], rhs: number[]): number[] | null => {
  const n = rhs.length;
  const augmented = matrix.map((row, i) => [...row, rhs[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivot][col])) pivot = row;
    }
    if (Math.abs(augmented[pivot][col]) < EPSILON) return null;
    [augmented[col], augmented[pivot]] = [augmented[pivot], augmented[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col] / augmented[col][col];
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        augmented[row][c] -= factor * augmented[col][c];
      }
    }
  }

  const solution = augmented.map((row, i) => row[n] / row[i]);
  return solution.every(value => Number.isFinite(value)) ? solution : null;
};

const normalize = (weights: number[]): number[] => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return weights.map(() => 1 / weights.length);
  }
  return weights.map(weight => weight / total);
};

/**
 * Exact long-only minimum-variance weights for the given holdings.
 *
 * A long-only optimum places strictly positive weight on some subset of the
 * holdings and zero on the rest; restricted to that subset it is the ordinary
 * equality-constrained solution w = Σ⁻¹1 / (1ᵀΣ⁻¹1). Enumerating every subset and
 * keeping the best feasible one is therefore exact rather than a heuristic — and
 * for four holdings it is only 15 tiny linear systems.
 */
export const minimumVarianceAllocation = (codes: string[], stats: AssetStats): Allocation => {
  const n = codes.length;
  if (n === 0) return { codes, weights: [], volatility: 0 };

  let bestWeights: number[] | null = null;
  let bestVariance = Infinity;

  for (let mask = 1; mask < (1 << n); mask++) {
    const members: number[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) members.push(i);
    }

    let memberWeights: number[];

    if (members.length === 1) {
      // Degenerate case the linear solve cannot express: a zero-volatility
      // (hard-pegged) currency gives a singular 1×1 system but is a valid optimum.
      memberWeights = [1];
    } else {
      const subMatrix = members.map(i => members.map(j => covariance(codes[i], codes[j], stats)));
      const solution = solveLinearSystem(subMatrix, members.map(() => 1));
      if (!solution) continue;

      const total = solution.reduce((sum, value) => sum + value, 0);
      if (!Number.isFinite(total) || Math.abs(total) < EPSILON) continue;

      const scaled = solution.map(value => value / total);
      // Negative weight means this subset is not the true support set — shorting
      // is not allowed, so the optimum lies on a different face.
      if (scaled.some(weight => weight < -WEIGHT_TOLERANCE)) continue;
      memberWeights = scaled.map(weight => Math.max(0, weight));
    }

    const weights = new Array<number>(n).fill(0);
    members.forEach((assetIndex, k) => { weights[assetIndex] = memberWeights[k]; });

    const variance = portfolioVariance(codes, weights, stats);
    if (variance < bestVariance) {
      bestVariance = variance;
      bestWeights = weights;
    }
  }

  const weights = normalize(bestWeights ?? new Array<number>(n).fill(1 / n));
  return {
    codes,
    weights,
    volatility: Math.sqrt(portfolioVariance(codes, weights, stats)),
  };
};

/**
 * Picks the `size` currencies whose optimal blend carries the least risk.
 *
 * Uses greedy forward selection followed by exhaustive single-swap refinement.
 * Checking all C(38, 4) combinations exactly would be ~74k optimizations, too slow
 * to run on every render; this converges to the same answer on the project's data
 * while staying well inside a frame.
 */
export const lowestRiskAllocation = (
  universe: string[],
  stats: AssetStats,
  size: number,
): Allocation => {
  // Sort by volatility (then code) so the search is deterministic across renders.
  const candidates = universe
    .filter(code => Number.isFinite(stats.volatility[code]))
    .sort((a, b) => (stats.volatility[a] - stats.volatility[b]) || a.localeCompare(b));

  if (candidates.length === 0) return { codes: [], weights: [], volatility: 0 };

  const target = Math.min(size, candidates.length);
  let selected: string[] = [];
  let best: Allocation | null = null;

  while (selected.length < target) {
    let roundCode: string | null = null;
    let roundBest: Allocation | null = null;

    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const allocation = minimumVarianceAllocation([...selected, candidate], stats);
      if (!roundBest || allocation.volatility < roundBest.volatility) {
        roundBest = allocation;
        roundCode = candidate;
      }
    }

    if (!roundCode || !roundBest) break;
    selected = [...selected, roundCode];
    best = roundBest;
  }

  // Greedy selection can finish one swap short of the optimum, so keep exchanging
  // a held currency for an unheld one while that lowers portfolio volatility.
  const MAX_PASSES = 20;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let slot = 0; slot < selected.length; slot++) {
      for (const candidate of candidates) {
        if (selected.includes(candidate)) continue;
        const trial = [...selected];
        trial[slot] = candidate;
        const allocation = minimumVarianceAllocation(trial, stats);
        if (best && allocation.volatility < best.volatility - EPSILON) {
          selected = trial;
          best = allocation;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return best ?? minimumVarianceAllocation(selected, stats);
};
