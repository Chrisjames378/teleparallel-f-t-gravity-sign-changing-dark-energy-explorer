import React from 'react';
import { Pause, Play, Crosshair } from 'lucide-react';
import type { CosmologyParams, EpochEvaluation } from '../physics/cosmology';

interface TimelineScrubberProps {
  z: number;
  onChangeZ: (z: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onJumpToTransition: () => void;
  params: CosmologyParams;
  epoch: EpochEvaluation;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  z,
  onChangeZ,
  isPlaying,
  onTogglePlay,
  onJumpToTransition,
  params,
  epoch,
}) => {
  const regimeText =
    params.branch === 'lcdm'
      ? 'Constant Vacuum Regime (Ω_DE > 0)'
      : epoch.isPole
        ? 'Sign-Transition Singularity (ρ_DE = 0)'
        : epoch.OmegaDE < 0
          ? 'Negative Dark Energy Regime (ρ_DE < 0)'
          : 'Positive Accelerated Regime (ρ_DE > 0)';

  const regimeColor =
    params.branch === 'lcdm'
      ? 'text-cyan-400'
      : epoch.isPole
        ? 'text-amber-400'
        : epoch.OmegaDE < 0
          ? 'text-rose-400'
          : 'text-emerald-400';

  return (
    <section className="science-panel rounded-xl p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-slate-100">
              Cosmic Timeline Scrubber &amp; Reversal Reconstructor
            </h2>
            <span className={`text-xs font-mono ${regimeColor}`}>
              {regimeText}
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl">
            Scrub across redshift z to inspect the smooth teleparallel transition from negative dark energy (ρ_DE &lt; 0)
            in the early universe to positive late-time acceleration (ρ_DE &gt; 0) today.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause Expansion' : 'Simulate Expansion'}</span>
          </button>

          <button
            type="button"
            onClick={onJumpToTransition}
            disabled={params.branch === 'lcdm'}
            className="px-3.5 py-2 rounded-lg bg-[#07090E] hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Jump to z_trans ({params.zTrans.toFixed(2)})</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
          <span>z = 0.00 · Present (a = 1.000)</span>
          <span className="text-cyan-400 font-semibold">
            z = {z.toFixed(2)} · a = {epoch.a.toFixed(3)} · H(z) = {epoch.H.toFixed(1)} km/s/Mpc
          </span>
          <span>z = 3.00 · Early Epoch (a = 0.250)</span>
        </div>

        <input
          type="range"
          aria-label="Redshift Epoch z"
          min={0}
          max={3}
          step={0.01}
          value={z}
          onChange={(e) => onChangeZ(parseFloat(e.target.value))}
          className="cosmos-range w-full cursor-pointer"
        />
      </div>
    </section>
  );
};
