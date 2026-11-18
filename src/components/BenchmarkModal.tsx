import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { BenchmarkSuiteResult, CosmologyParams } from '../physics/cosmology';

interface BenchmarkModalProps {
  open: boolean;
  onClose: () => void;
  result: BenchmarkSuiteResult;
  onLoadParams: (params: CosmologyParams) => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  open,
  onClose,
  result,
  onLoadParams,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bayesian MCMC Benchmark Suite"
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
    >
      <div className="science-panel rounded-xl max-w-4xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Bayesian Observational Benchmark Suite
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Joint likelihood across DESI DR1 BAO, Cosmic Chronometers, Pantheon+ SNe Ia, BOSS/eBOSS RSD, and SH0ES H₀.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close benchmark modal"
            className="p-1.5 rounded-lg bg-[#07090E] border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 pr-4 font-sans font-semibold">Model Branch</th>
                <th className="py-2.5 px-3">k</th>
                <th className="py-2.5 px-3">Best H₀</th>
                <th className="py-2.5 px-3">Best Ω_m0</th>
                <th className="py-2.5 px-3">z_trans</th>
                <th className="py-2.5 px-3">S₈</th>
                <th className="py-2.5 px-3">χ²</th>
                <th className="py-2.5 px-3">Δχ²</th>
                <th className="py-2.5 px-3">AIC</th>
                <th className="py-2.5 px-3">BIC</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {result.summaries.map((row) => (
                <tr key={row.branch} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4 font-sans font-medium text-slate-100">{row.label}</td>
                  <td className="py-3 px-3 text-slate-300">{row.kParams}</td>
                  <td className="py-3 px-3 text-amber-400">{row.bestParams.H0.toFixed(2)}</td>
                  <td className="py-3 px-3 text-slate-200">{row.bestParams.OmegaM0.toFixed(3)}</td>
                  <td className="py-3 px-3 text-cyan-400">
                    {row.branch === 'lcdm' ? '—' : row.bestParams.zTrans.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-emerald-400">{row.S8.toFixed(3)}</td>
                  <td className="py-3 px-3 text-slate-100">{row.chi2.toFixed(2)}</td>
                  <td
                    className={`py-3 px-3 ${
                      row.deltaChi2VsLcdm < 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {row.deltaChi2VsLcdm >= 0 ? `+${row.deltaChi2VsLcdm.toFixed(2)}` : row.deltaChi2VsLcdm.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-slate-300">{row.aic.toFixed(1)}</td>
                  <td className="py-3 px-3 text-slate-300">{row.bic.toFixed(1)}</td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        onLoadParams(row.bestParams);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Load</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="science-subpanel rounded-lg p-3.5">
            <span className="text-slate-400">MCMC Chain Acceptance</span>
            <div className="text-lg font-mono tabular-nums text-cyan-400 mt-1">
              {(result.acceptanceRate * 100).toFixed(1)}% ({result.samples.length} steps)
            </div>
          </div>
          <div className="science-subpanel rounded-lg p-3.5">
            <span className="text-slate-400">2D Contour Best-Fit</span>
            <div className="text-lg font-mono tabular-nums text-amber-400 mt-1">
              Ω_m0={result.contourBest.OmegaM0.toFixed(3)} · H₀={result.contourBest.H0.toFixed(2)}
            </div>
          </div>
          <div className="science-subpanel rounded-lg p-3.5">
            <span className="text-slate-400">H₀ &amp; S₈ Tension Relief</span>
            <div className="text-lg font-mono tabular-nums text-emerald-400 mt-1">
              {result.summaries[0].h0TensionSigma.toFixed(2)}σ H₀ · {result.summaries[0].s8TensionSigma.toFixed(2)}σ S₈
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
