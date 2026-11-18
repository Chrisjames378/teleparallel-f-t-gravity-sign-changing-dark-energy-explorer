import React from 'react';
import type { Chi2Breakdown, CosmologyParams, EpochEvaluation } from '../physics/cosmology';

interface TelemetryRibbonProps {
  epoch: EpochEvaluation;
  params: CosmologyParams;
  S8: number;
  chi2: Chi2Breakdown;
}

export const TelemetryRibbon: React.FC<TelemetryRibbonProps> = ({ epoch, params, S8, chi2 }) => {
  const isNegativeDE = epoch.OmegaDE < -0.005;
  const isNearPole = epoch.isPole;

  const rhoColorClass = isNearPole
    ? 'text-amber-400'
    : isNegativeDE
      ? 'text-rose-400'
      : 'text-cyan-400';

  const deltaSign = chi2.deltaChi2 <= 0 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <section
      id="overview"
      aria-label="Real-time cosmological telemetry"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
    >
      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Cosmic Epoch (z)
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className="text-2xl font-semibold font-mono tabular-nums text-cyan-400">
            {epoch.z.toFixed(2)}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">
            {epoch.lookbackGyr.toFixed(2)} Gyr ago
          </span>
        </div>
      </div>

      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Dark Energy Ω_DE(z)
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className={`text-2xl font-semibold font-mono tabular-nums ${rhoColorClass}`}>
            {epoch.OmegaDE >= 0 ? `+${epoch.OmegaDE.toFixed(3)}` : epoch.OmegaDE.toFixed(3)}
          </span>
          <span className="text-[11px] font-mono text-slate-400">ρ_crit,0</span>
        </div>
      </div>

      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Hubble Constant H₀
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className="text-2xl font-semibold font-mono tabular-nums text-amber-400">
            {params.H0.toFixed(2)}
          </span>
          <span className="text-[11px] font-mono text-slate-400">km/s/Mpc</span>
        </div>
      </div>

      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Equation of State w_DE
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className="text-2xl font-semibold font-mono tabular-nums text-violet-300">
            {epoch.isPole || epoch.wDE === null ? 'Pole' : epoch.wDE.toFixed(2)}
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {epoch.isPole ? 'ρ_DE → 0' : `q=${epoch.q.toFixed(2)}`}
          </span>
        </div>
      </div>

      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Structure Growth S₈
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className="text-2xl font-semibold font-mono tabular-nums text-emerald-400">
            {S8.toFixed(3)}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-slate-400">
            {chi2.s8TensionSigma.toFixed(1)}σ KiDS
          </span>
        </div>
      </div>

      <div className="science-panel rounded-xl p-4 flex flex-col justify-between">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
          Observational Fit χ²
        </span>
        <div className="flex items-baseline justify-between gap-2 mt-2">
          <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
            {chi2.totalChi2.toFixed(1)}
          </span>
          <span className={`text-[11px] font-mono tabular-nums ${deltaSign}`}>
            {chi2.deltaChi2 >= 0 ? `+${chi2.deltaChi2.toFixed(1)}` : chi2.deltaChi2.toFixed(1)} vs ΛCDM
          </span>
        </div>
      </div>
    </section>
  );
};
