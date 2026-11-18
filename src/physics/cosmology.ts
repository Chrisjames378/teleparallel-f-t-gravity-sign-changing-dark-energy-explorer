import {
  FIDUCIAL_PLANCK_LCDM,
  HUBBLE_OBSERVATIONS,
  KIDS1000_PRIOR,
  PANTHEON_PLUS_RESIDUALS,
  RSD_GROWTH_DATA,
  SHOES_PRIOR,
} from './datasets';

export type ModelBranch = 'basic' | 'extended' | 'lcdm';

export interface CosmologyParams {
  branch: ModelBranch;
  zTrans: number; // Redshift of sign transition (0.60 - 2.50)
  w0: number; // Present dark energy equation of state baseline (-1.40 to -0.60)
  H0: number; // km/s/Mpc (65.0 - 78.0)
  OmegaM0: number; // Matter density parameter (0.22 - 0.36)
  alphaT: number; // Torsion transition steepness (0.10 - 2.50)
  betaLambda: number; // Bare Lambda offset for extended branch (-0.30 - 0.30)
  sigma80: number; // Present-day linear clustering amplitude (0.72 - 0.88)
}

export interface EpochEvaluation {
  z: number;
  a: number;
  lookbackGyr: number;
  E: number;
  H: number;
  H_1pz: number;
  OmegaDE: number;
  wDE: number | null;
  isPole: boolean;
  q: number;
  T: number;
  fTRatio: number;
  muResidual: number;
  fs8: number;
}

export interface Chi2Breakdown {
  hubbleChi2: number;
  sneChi2: number;
  rsdChi2: number;
  shoesChi2: number;
  totalChi2: number;
  lcdmTotalChi2: number;
  deltaChi2: number;
  kParams: number;
  aic: number;
  bic: number;
  h0TensionSigma: number;
  s8TensionSigma: number;
}

export interface CosmologyCurvePoint {
  z: number;
  OmegaDE: number;
  lcdmOmegaDE: number;
  wDE: number | null;
  H_1pz: number;
  lcdmH_1pz: number;
  muResidual: number;
  T: number;
  fTRatio: number;
  q: number;
  lcdmQ: number;
  fs8: number;
  lcdmFs8: number;
}

export interface McmcSample {
  step: number;
  H0: number;
  OmegaM0: number;
  zTrans: number;
  alphaT: number;
  S8: number;
  chi2: number;
}

export interface ContourCell {
  x: number; // OmegaM0
  y: number; // H0
  deltaChi2: number;
}

export interface BenchmarkBranchSummary {
  branch: ModelBranch;
  label: string;
  kParams: number;
  bestParams: CosmologyParams;
  chi2: number;
  deltaChi2VsLcdm: number;
  aic: number;
  bic: number;
  S8: number;
  h0TensionSigma: number;
  s8TensionSigma: number;
}

export interface BenchmarkSuiteResult {
  samples: McmcSample[];
  acceptanceRate: number;
  contourGrid: ContourCell[];
  contourBest: { OmegaM0: number; H0: number };
  summaries: BenchmarkBranchSummary[];
}

const C_KM_S = 299792.458;
const OMEGA_R0 = 9.2e-5;
const MPC_TO_GYR_FACTOR = 977.792; // 1 / H0(km/s/Mpc) * 977.792 = Gyr
const N_DATA_POINTS =
  HUBBLE_OBSERVATIONS.length + PANTHEON_PLUS_RESIDUALS.length + RSD_GROWTH_DATA.length + 1;

export function getDefaultParams(branch: ModelBranch = 'basic'): CosmologyParams {
  if (branch === 'lcdm') {
    return {
      branch: 'lcdm',
      zTrans: 1.5,
      w0: -1.0,
      H0: 67.8,
      OmegaM0: 0.312,
      alphaT: 0.0,
      betaLambda: 1.0,
      sigma80: 0.811,
    };
  }
  if (branch === 'extended') {
    return {
      branch: 'extended',
      zTrans: 1.55,
      w0: -1.02,
      H0: 73.2,
      OmegaM0: 0.296,
      alphaT: 1.35,
      betaLambda: 0.08,
      sigma80: 0.788,
    };
  }
  return {
    branch: 'basic',
    zTrans: 1.5,
    w0: -1.0,
    H0: 72.8,
    OmegaM0: 0.298,
    alphaT: 1.4,
    betaLambda: 0.0,
    sigma80: 0.79,
  };
}

function tanhSafe(x: number): number {
  return Math.tanh(x);
}

function sech2(x: number): number {
  const c = Math.cosh(x);
  if (c > 1e6) return 0;
  return 1 / (c * c);
}

export function computeOmegaDEAndDeriv(z: number, params: CosmologyParams): { omegaDE: number; dOmegaDEdz: number } {
  const omegaDE0 = 1 - params.OmegaM0 - OMEGA_R0;
  const opz = 1 + z;
  const expW = 3 * (1 + params.w0);
  const g = Math.abs(expW) < 1e-6 ? 1 : Math.pow(opz, expW);
  const dgdz = Math.abs(expW) < 1e-6 ? 0 : expW * Math.pow(opz, expW - 1);

  if (params.branch === 'lcdm' || params.alphaT < 0.01) {
    return { omegaDE: omegaDE0 * g, dOmegaDEdz: omegaDE0 * dgdz };
  }

  const beta = params.branch === 'extended' ? params.betaLambda : 0;
  const norm = tanhSafe(params.alphaT * params.zTrans);
  const safeNorm = Math.abs(norm) < 1e-6 ? 1e-6 : norm;
  const arg = params.alphaT * (params.zTrans - z);
  const ratio = tanhSafe(arg) / safeNorm;
  const dRatioDz = (-params.alphaT * sech2(arg)) / safeNorm;

  const s = (1 - beta) * ratio + beta;
  const dsdz = (1 - beta) * dRatioDz;

  const omegaDE = omegaDE0 * g * s;
  const dOmegaDEdz = omegaDE0 * (dgdz * s + g * dsdz);
  return { omegaDE, dOmegaDEdz };
}

export function computeE2AndDeriv(z: number, params: CosmologyParams): { E2: number; dE2dz: number; omegaDE: number; dOmegaDEdz: number } {
  const opz = 1 + z;
  const { omegaDE, dOmegaDEdz } = computeOmegaDEAndDeriv(z, params);
  const rawE2 = params.OmegaM0 * opz * opz * opz + OMEGA_R0 * opz * opz * opz * opz + omegaDE;
  const E2 = Math.max(0.05, rawE2);
  const dE2dz = 3 * params.OmegaM0 * opz * opz + 4 * OMEGA_R0 * opz * opz * opz + dOmegaDEdz;
  return { E2, dE2dz, omegaDE, dOmegaDEdz };
}

export function computeComovingDistanceMpc(z: number, params: CosmologyParams, steps = 36): number {
  if (z <= 0) return 0;
  const h = z / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const zi = i * h;
    const { E2 } = computeE2AndDeriv(zi, params);
    const invE = 1 / Math.sqrt(E2);
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * invE;
  }
  return (C_KM_S / params.H0) * ((h / 3) * sum);
}

export function computeLookbackTimeGyr(z: number, params: CosmologyParams, steps = 30): number {
  if (z <= 0) return 0;
  const h = z / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const zi = i * h;
    const { E2 } = computeE2AndDeriv(zi, params);
    const integrand = 1 / ((1 + zi) * Math.sqrt(E2));
    const weight = i === 0 || i === steps ? 1 : i % 2 === 1 ? 4 : 2;
    sum += weight * integrand;
  }
  return (MPC_TO_GYR_FACTOR / params.H0) * ((h / 3) * sum);
}

export function computeDistanceModulus(z: number, params: CosmologyParams): number {
  if (z <= 1e-5) return 0;
  const dC = computeComovingDistanceMpc(z, params, 28);
  const dL = (1 + z) * dC;
  return 5 * Math.log10(Math.max(1e-6, dL)) + 25;
}

const FIDUCIAL_PARAMS: CosmologyParams = {
  branch: 'lcdm',
  zTrans: 1.5,
  w0: -1.0,
  H0: FIDUCIAL_PLANCK_LCDM.H0,
  OmegaM0: FIDUCIAL_PLANCK_LCDM.OmegaM0,
  alphaT: 0,
  betaLambda: 1,
  sigma80: FIDUCIAL_PLANCK_LCDM.sigma80,
};

// Solve linear matter perturbation growth ODE delta''(ln a) + ... = 0 using RK4 from z=49 to z=0
export function solveGrowthCurve(
  params: CosmologyParams,
  zGrid: number[]
): { fs8AtGrid: number[]; S8: number; sigma8Eff: number } {
  const lnAStart = Math.log(1 / 50); // z = 49
  const lnAEnd = 0; // z = 0
  const N = 160;
  const h = (lnAEnd - lnAStart) / N;

  const evalGeffRatio = (z: number): number => {
    if (params.branch === 'lcdm' || params.alphaT < 0.01) return 1.0;
    const { omegaDE, E2 } = computeE2AndDeriv(z, params);
    // Teleparallel torsion coupling subtly suppresses growth when Omega_DE < 0 / high torsion
    const fTMod = 0.08 * (omegaDE / Math.max(0.2, E2)) - 0.055 * (1 - params.OmegaM0) * Math.tanh(params.alphaT * 0.6);
    return Math.max(0.82, Math.min(1.12, 1 / (1 - fTMod)));
  };

  const derivs = (lnA: number, delta: number, dDelta: number): [number, number] => {
    const a = Math.exp(lnA);
    const z = 1 / a - 1;
    const { E2, dE2dz } = computeE2AndDeriv(z, params);
    // d(ln H)/d(ln a) = -0.5 * (1+z) * dE2dz / E2
    const dLnHdLnA = -0.5 * ((1 + z) * dE2dz) / E2;
    const omegaMa = (params.OmegaM0 * (1 + z) * (1 + z) * (1 + z)) / E2;
    const geff = evalGeffRatio(z);
    const ddDelta = -(2 + dLnHdLnA) * dDelta + 1.5 * omegaMa * geff * delta;
    return [dDelta, ddDelta];
  };

  let lnA = lnAStart;
  let delta = Math.exp(lnAStart);
  let dDelta = delta;

  const trajectory: { z: number; delta: number; f: number }[] = [];

  for (let i = 0; i <= N; i++) {
    const a = Math.exp(lnA);
    const z = 1 / a - 1;
    const f = dDelta / Math.max(1e-12, delta);
    trajectory.push({ z, delta, f });

    if (i < N) {
      const [k1d, k1v] = derivs(lnA, delta, dDelta);
      const [k2d, k2v] = derivs(lnA + 0.5 * h, delta + 0.5 * h * k1d, dDelta + 0.5 * h * k1v);
      const [k3d, k3v] = derivs(lnA + 0.5 * h, delta + 0.5 * h * k2d, dDelta + 0.5 * h * k2v);
      const [k4d, k4v] = derivs(lnA + h, delta + h * k3d, dDelta + h * k3v);
      delta += (h / 6) * (k1d + 2 * k2d + 2 * k3d + k4d);
      dDelta += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      lnA += h;
    }
  }

  const delta0 = trajectory[trajectory.length - 1].delta;
  const fiducialDelta0 = 0.782; // normalized growth factor in fiducial cosmology
  const sigma8Eff = params.sigma80 * Math.pow(delta0 / fiducialDelta0, 0.35);
  const S8 = sigma8Eff * Math.sqrt(params.OmegaM0 / 0.3);

  const fs8AtGrid = zGrid.map((zq) => {
    // trajectory is ordered from high z to z=0
    for (let i = 0; i < trajectory.length - 1; i++) {
      const p1 = trajectory[i];
      const p2 = trajectory[i + 1];
      if (zq <= p1.z && zq >= p2.z) {
        const t = (p1.z - zq) / Math.max(1e-9, p1.z - p2.z);
        const dInterp = p1.delta + t * (p2.delta - p1.delta);
        const fInterp = p1.f + t * (p2.f - p1.f);
        return fInterp * sigma8Eff * (dInterp / delta0);
      }
    }
    const last = trajectory[trajectory.length - 1];
    return last.f * sigma8Eff;
  });

  return { fs8AtGrid, S8, sigma8Eff };
}

export function evaluateAtRedshift(z: number, params: CosmologyParams, growthFs8?: number): EpochEvaluation {
  const a = 1 / (1 + z);
  const { E2, dE2dz, omegaDE, dOmegaDEdz } = computeE2AndDeriv(z, params);
  const E = Math.sqrt(E2);
  const H = params.H0 * E;
  const H_1pz = H / (1 + z);

  let wDE: number | null = params.w0;
  let isPole = false;
  if (Math.abs(omegaDE) < 0.015 && params.branch !== 'lcdm' && params.alphaT >= 0.01) {
    wDE = null;
    isPole = true;
  } else if (Math.abs(omegaDE) >= 1e-6) {
    const rawW = -1 + ((1 + z) / (3 * omegaDE)) * dOmegaDEdz;
    wDE = Math.max(-6, Math.min(4, rawW));
  }

  const q = -1 + ((1 + z) / (2 * E2)) * dE2dz;
  const T = -6 * H * H;
  const fTRatio = omegaDE / Math.max(0.1, E2);
  const lookbackGyr = computeLookbackTimeGyr(z, params, 24);
  const muResidual = z > 0.005 ? computeDistanceModulus(z, params) - computeDistanceModulus(z, FIDUCIAL_PARAMS) : 0;

  let fs8 = growthFs8 ?? 0;
  if (growthFs8 === undefined) {
    fs8 = solveGrowthCurve(params, [z]).fs8AtGrid[0];
  }

  return {
    z,
    a,
    lookbackGyr,
    E,
    H,
    H_1pz,
    OmegaDE: omegaDE,
    wDE,
    isPole,
    q,
    T,
    fTRatio,
    muResidual,
    fs8,
  };
}

export function computeChi2(params: CosmologyParams): { breakdown: Chi2Breakdown; S8: number } {
  let hubbleChi2 = 0;
  for (const pt of HUBBLE_OBSERVATIONS) {
    const { E2 } = computeE2AndDeriv(pt.z, params);
    const hPred = params.H0 * Math.sqrt(E2);
    const diff = (hPred - pt.hz) / pt.err;
    hubbleChi2 += diff * diff;
  }

  let sneChi2 = 0;
  for (const pt of PANTHEON_PLUS_RESIDUALS) {
    const predResidual = computeDistanceModulus(pt.z, params) - computeDistanceModulus(pt.z, FIDUCIAL_PARAMS);
    const diff = (predResidual - pt.deltaMu) / pt.err;
    sneChi2 += diff * diff;
  }

  const rsdZ = RSD_GROWTH_DATA.map((d) => d.z);
  const { fs8AtGrid, S8 } = solveGrowthCurve(params, rsdZ);
  let rsdChi2 = 0;
  for (let i = 0; i < RSD_GROWTH_DATA.length; i++) {
    const diff = (fs8AtGrid[i] - RSD_GROWTH_DATA[i].fs8) / RSD_GROWTH_DATA[i].err;
    rsdChi2 += diff * diff;
  }

  const shoesDiff = (params.H0 - SHOES_PRIOR.H0) / SHOES_PRIOR.err;
  const shoesChi2 = shoesDiff * shoesDiff;

  const totalChi2 = hubbleChi2 + sneChi2 + rsdChi2 + shoesChi2;

  const kParams = params.branch === 'lcdm' ? 2 : params.branch === 'basic' ? 3 : 4;
  const aic = totalChi2 + 2 * kParams;
  const bic = totalChi2 + kParams * Math.log(N_DATA_POINTS);

  const h0TensionSigma = Math.abs(params.H0 - SHOES_PRIOR.H0) / SHOES_PRIOR.err;
  const s8TensionSigma = Math.abs(S8 - KIDS1000_PRIOR.S8) / KIDS1000_PRIOR.err;

  // Reference LCDM baseline chi2
  const lcdmBaseline = getDefaultParams('lcdm');
  let lcdmTotalChi2 = totalChi2;
  if (params.branch !== 'lcdm') {
    lcdmTotalChi2 = computeRawTotalChi2(lcdmBaseline);
  }

  return {
    S8,
    breakdown: {
      hubbleChi2,
      sneChi2,
      rsdChi2,
      shoesChi2,
      totalChi2,
      lcdmTotalChi2,
      deltaChi2: totalChi2 - lcdmTotalChi2,
      kParams,
      aic,
      bic,
      h0TensionSigma,
      s8TensionSigma,
    },
  };
}

function computeRawTotalChi2(params: CosmologyParams): number {
  let chi2 = 0;
  for (const pt of HUBBLE_OBSERVATIONS) {
    const { E2 } = computeE2AndDeriv(pt.z, params);
    const hPred = params.H0 * Math.sqrt(E2);
    const diff = (hPred - pt.hz) / pt.err;
    chi2 += diff * diff;
  }
  for (const pt of PANTHEON_PLUS_RESIDUALS) {
    const predResidual = computeDistanceModulus(pt.z, params) - computeDistanceModulus(pt.z, FIDUCIAL_PARAMS);
    const diff = (predResidual - pt.deltaMu) / pt.err;
    chi2 += diff * diff;
  }
  const rsdZ = RSD_GROWTH_DATA.map((d) => d.z);
  const { fs8AtGrid } = solveGrowthCurve(params, rsdZ);
  for (let i = 0; i < RSD_GROWTH_DATA.length; i++) {
    const diff = (fs8AtGrid[i] - RSD_GROWTH_DATA[i].fs8) / RSD_GROWTH_DATA[i].err;
    chi2 += diff * diff;
  }
  const shoesDiff = (params.H0 - SHOES_PRIOR.H0) / SHOES_PRIOR.err;
  chi2 += shoesDiff * shoesDiff;
  return chi2;
}

export function computeCosmologyCurves(params: CosmologyParams): {
  curves: CosmologyCurvePoint[];
  chi2: Chi2Breakdown;
  S8: number;
} {
  const zGrid: number[] = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    zGrid.push(Number(((i / steps) * 3.0).toFixed(3)));
  }

  const lcdmRef = getDefaultParams('lcdm');
  const { fs8AtGrid } = solveGrowthCurve(params, zGrid);
  const { fs8AtGrid: lcdmFs8Grid } = solveGrowthCurve(lcdmRef, zGrid);

  const curves: CosmologyCurvePoint[] = zGrid.map((z, idx) => {
    const ev = evaluateAtRedshift(z, params, fs8AtGrid[idx]);
    const evLcdm = evaluateAtRedshift(z, lcdmRef, lcdmFs8Grid[idx]);
    return {
      z,
      OmegaDE: ev.OmegaDE,
      lcdmOmegaDE: evLcdm.OmegaDE,
      wDE: ev.wDE,
      H_1pz: ev.H_1pz,
      lcdmH_1pz: evLcdm.H_1pz,
      muResidual: ev.muResidual,
      T: ev.T,
      fTRatio: ev.fTRatio,
      q: ev.q,
      lcdmQ: evLcdm.q,
      fs8: ev.fs8,
      lcdmFs8: evLcdm.fs8,
    };
  });

  const { breakdown, S8 } = computeChi2(params);
  return { curves, chi2: breakdown, S8 };
}

export function autoFitBestChi2(current: CosmologyParams): CosmologyParams {
  // Coordinate descent + refinement within physical priors
  let best = { ...current };
  let bestChi2 = computeRawTotalChi2(best);

  const bounds = {
    zTrans: [0.65, 2.45],
    w0: [-1.35, -0.65],
    H0: [65.5, 77.5],
    OmegaM0: [0.23, 0.355],
    alphaT: [0.2, 2.45],
    betaLambda: [-0.28, 0.28],
    sigma80: [0.73, 0.87],
  };

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const keys: Array<keyof typeof bounds> =
    current.branch === 'lcdm'
      ? ['H0', 'OmegaM0', 'sigma80']
      : current.branch === 'basic'
        ? ['zTrans', 'w0', 'H0', 'OmegaM0', 'alphaT', 'sigma80']
        : ['zTrans', 'w0', 'H0', 'OmegaM0', 'alphaT', 'betaLambda', 'sigma80'];

  const initialSteps: Record<keyof typeof bounds, number> = {
    zTrans: 0.16,
    w0: 0.06,
    H0: 1.0,
    OmegaM0: 0.014,
    alphaT: 0.2,
    betaLambda: 0.05,
    sigma80: 0.015,
  };

  for (let round = 0; round < 4; round++) {
    const scale = Math.pow(0.45, round);
    for (const key of keys) {
      const step = initialSteps[key] * scale;
      for (const dir of [-1, 1]) {
        const candidate: CosmologyParams = {
          ...best,
          [key]: clamp(best[key] + dir * step, bounds[key][0], bounds[key][1]),
        };
        const val = computeRawTotalChi2(candidate);
        if (val < bestChi2) {
          best = candidate;
          bestChi2 = val;
        }
      }
    }
  }

  return {
    ...best,
    zTrans: Number(best.zTrans.toFixed(2)),
    w0: Number(best.w0.toFixed(2)),
    H0: Number(best.H0.toFixed(2)),
    OmegaM0: Number(best.OmegaM0.toFixed(3)),
    alphaT: Number(best.alphaT.toFixed(2)),
    betaLambda: Number(best.betaLambda.toFixed(3)),
    sigma80: Number(best.sigma80.toFixed(3)),
  };
}

export function runMcmcBenchmark(activeParams: CosmologyParams): BenchmarkSuiteResult {
  // Deterministic PRNG for reproducible fast client-side Bayesian chains
  let seed = 421337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const randn = () => {
    const u1 = Math.max(1e-7, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  // Run 2D likelihood contour grid in (OmegaM0, H0)
  const omSteps = 18;
  const h0Steps = 18;
  const omMin = 0.24;
  const omMax = 0.35;
  const h0Min = 66.0;
  const h0Max = 76.5;

  const rawCells: { x: number; y: number; chi2: number }[] = [];
  let minGridChi2 = Infinity;
  let bestCell = { OmegaM0: activeParams.OmegaM0, H0: activeParams.H0 };

  for (let i = 0; i < omSteps; i++) {
    const om = omMin + (i / (omSteps - 1)) * (omMax - omMin);
    for (let j = 0; j < h0Steps; j++) {
      const h0 = h0Min + (j / (h0Steps - 1)) * (h0Max - h0Min);
      const chi2 = computeRawTotalChi2({ ...activeParams, OmegaM0: om, H0: h0 });
      rawCells.push({ x: om, y: h0, chi2 });
      if (chi2 < minGridChi2) {
        minGridChi2 = chi2;
        bestCell = { OmegaM0: om, H0: h0 };
      }
    }
  }

  const contourGrid: ContourCell[] = rawCells.map((c) => ({
    x: c.x,
    y: c.y,
    deltaChi2: c.chi2 - minGridChi2,
  }));

  // Metropolis-Hastings MCMC chain (600 steps)
  let current = autoFitBestChi2(activeParams);
  let currentChi2 = computeRawTotalChi2(current);
  let accepted = 0;
  const totalSteps = 550;
  const samples: McmcSample[] = [];

  for (let step = 0; step < totalSteps; step++) {
    const proposal: CosmologyParams = {
      ...current,
      H0: Math.max(65, Math.min(78, current.H0 + randn() * 0.45)),
      OmegaM0: Math.max(0.22, Math.min(0.36, current.OmegaM0 + randn() * 0.008)),
      zTrans:
        current.branch === 'lcdm'
          ? current.zTrans
          : Math.max(0.65, Math.min(2.45, current.zTrans + randn() * 0.08)),
      alphaT:
        current.branch === 'lcdm'
          ? 0
          : Math.max(0.2, Math.min(2.45, current.alphaT + randn() * 0.1)),
    };

    const propChi2 = computeRawTotalChi2(proposal);
    const logAlpha = -0.5 * (propChi2 - currentChi2);
    if (logAlpha >= 0 || Math.log(Math.max(1e-9, rand())) < logAlpha) {
      current = proposal;
      currentChi2 = propChi2;
      accepted++;
    }

    const s8 = current.sigma80 * Math.sqrt(current.OmegaM0 / 0.3);
    samples.push({
      step,
      H0: current.H0,
      OmegaM0: current.OmegaM0,
      zTrans: current.zTrans,
      alphaT: current.alphaT,
      S8: s8,
      chi2: currentChi2,
    });
  }

  // Compare all 3 branches
  const branches: Array<{ branch: ModelBranch; label: string }> = [
    { branch: 'basic', label: 'Basic f(T) (k=3)' },
    { branch: 'extended', label: 'Extended f(T)+Λ (k=4)' },
    { branch: 'lcdm', label: 'Standard ΛCDM (k=2)' },
  ];

  const fitSummaries = branches.map(({ branch, label }) => {
    const bestParams = autoFitBestChi2(getDefaultParams(branch));
    const { breakdown, S8 } = computeChi2(bestParams);
    return {
      branch,
      label,
      kParams: breakdown.kParams,
      bestParams,
      chi2: breakdown.totalChi2,
      deltaChi2VsLcdm: 0,
      aic: breakdown.aic,
      bic: breakdown.bic,
      S8,
      h0TensionSigma: breakdown.h0TensionSigma,
      s8TensionSigma: breakdown.s8TensionSigma,
    };
  });

  const lcdmChi2 = fitSummaries.find((s) => s.branch === 'lcdm')?.chi2 ?? 0;
  for (const s of fitSummaries) {
    s.deltaChi2VsLcdm = s.chi2 - lcdmChi2;
  }

  return {
    samples,
    acceptanceRate: accepted / totalSteps,
    contourGrid,
    contourBest: bestCell,
    summaries: fitSummaries,
  };
}
