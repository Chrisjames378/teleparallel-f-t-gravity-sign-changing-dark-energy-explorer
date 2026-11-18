import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Zap } from 'lucide-react';
import {
  autoFitBestChi2,
  computeCosmologyCurves,
  evaluateAtRedshift,
  getDefaultParams,
  runMcmcBenchmark,
  type BenchmarkSuiteResult,
  type CosmologyParams,
  type ModelBranch,
} from './physics/cosmology';
import { TelemetryRibbon } from './components/TelemetryRibbon';
import { TimelineScrubber } from './components/TimelineScrubber';
import { ScienceCharts } from './components/ScienceCharts';
import { TorsionViewport3D } from './components/TorsionViewport3D';
import { ParameterControls } from './components/ParameterControls';
import { CosmologistHub } from './components/CosmologistHub';
import { BenchmarkModal } from './components/BenchmarkModal';

export default function App() {
  const [params, setParams] = useState<CosmologyParams>(() => getDefaultParams('basic'));
  const [z, setZ] = useState<number>(1.5);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [benchmarkModalOpen, setBenchmarkModalOpen] = useState<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkSuiteResult>(() =>
    runMcmcBenchmark(getDefaultParams('basic'))
  );

  const { curves, chi2, S8 } = useMemo(() => computeCosmologyCurves(params), [params]);

  const epoch = useMemo(() => {
    const idx = Math.min(curves.length - 1, Math.max(0, Math.round((z / 3.0) * (curves.length - 1))));
    return evaluateAtRedshift(z, params, curves[idx]?.fs8);
  }, [z, params, curves]);

  // Smooth cosmic expansion playback from early universe (z=3) toward present (z=0)
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      setZ((prev) => {
        const next = prev - dt * 0.38;
        if (next <= 0) {
          return 3.0;
        }
        return Number(next.toFixed(2));
      });
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  const handleSelectBranch = useCallback((branch: ModelBranch) => {
    const defaults = getDefaultParams(branch);
    setParams(defaults);
    if (branch !== 'lcdm') {
      setZ(defaults.zTrans);
    }
  }, []);

  const handleAutoFit = useCallback(() => {
    const fitted = autoFitBestChi2(params);
    setParams(fitted);
    setBenchmarkResult(runMcmcBenchmark(fitted));
  }, [params]);

  const handleRunBenchmark = useCallback(() => {
    const result = runMcmcBenchmark(params);
    setBenchmarkResult(result);
    setBenchmarkModalOpen(true);
  }, [params]);

  const handleRefreshBenchmarkQuiet = useCallback(() => {
    setBenchmarkResult(runMcmcBenchmark(params));
  }, [params]);

  const handleExportJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      modelParameters: params,
      currentEpoch: epoch,
      derivedS8: S8,
      observationalFit: chi2,
      curves,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teleparallel-ft-${params.branch}-z${z.toFixed(2)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [params, epoch, S8, chi2, curves, z]);

  return (
    <div className="min-h-screen flex flex-col bg-[#07090E] text-slate-100">
      {/* Top Navigation Header (3-zone contract) */}
      <header className="sticky top-0 z-40 bg-[#07090E]/95 border-b border-slate-800 px-4 lg:px-8 py-3.5 flex items-center justify-between gap-8">
        <a
          href="#overview"
          className="text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          Teleparallel f(T) Explorer
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <a href="#overview" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Telemetry
          </a>
          <a href="#observables" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Observables
          </a>
          <a href="#torsion-manifold" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Torsion Manifold
          </a>
          <a href="#parameters-ai" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Parameters &amp; AI
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="px-4 py-2 rounded-lg bg-[#0D121D] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </header>

      {/* Main Observatory Workspace */}
      <main className="flex-grow max-w-[1480px] w-full mx-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Workspace Calibration Toolbar */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/70">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-100 text-balance">
              Teleparallel f(T) Gravity &amp; Sign-Changing Dark Energy Explorer
            </h1>
            <p className="text-xs text-slate-400">
              Observational Datasets: DESI DR1 BAO · Pantheon+ SNe Ia · Cosmic Chronometers · BOSS/eBOSS RSD · SH0ES
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="inline-flex rounded-lg bg-[#0D121D] p-1 border border-slate-800">
              {(
                [
                  ['basic', 'Basic f(T) (k=3)'],
                  ['extended', 'Extended f(T)+Λ (k=4)'],
                  ['lcdm', 'Standard ΛCDM'],
                ] as Array<[ModelBranch, string]>
              ).map(([branch, label]) => (
                <button
                  key={branch}
                  type="button"
                  onClick={() => handleSelectBranch(branch)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    params.branch === branch
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAutoFit}
              className="px-3.5 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Auto-Fit Best χ²</span>
            </button>

            <button
              type="button"
              onClick={handleRunBenchmark}
              className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Benchmark Suite</span>
            </button>
          </div>
        </section>

        {/* Telemetry Ribbon */}
        <TelemetryRibbon epoch={epoch} params={params} S8={S8} chi2={chi2} />

        {/* Interactive Redshift Timeline Scrubber */}
        <TimelineScrubber
          z={z}
          onChangeZ={(nextZ) => {
            setIsPlaying(false);
            setZ(nextZ);
          }}
          isPlaying={isPlaying}
          onTogglePlay={() => setIsPlaying((prev) => !prev)}
          onJumpToTransition={() => {
            setIsPlaying(false);
            setZ(params.zTrans);
          }}
          params={params}
          epoch={epoch}
        />

        {/* Dual Scientific D3 Charts */}
        <ScienceCharts
          curves={curves}
          params={params}
          z={z}
          onSelectZ={(nextZ) => {
            setIsPlaying(false);
            setZ(nextZ);
          }}
          benchmarkResult={benchmarkResult}
          onRunBenchmark={handleRefreshBenchmarkQuiet}
        />

        {/* Three.js 3D Spacetime Torsion Manifold */}
        <TorsionViewport3D epoch={epoch} params={params} />

        {/* Parameter Controls & Hybrid AI Cosmologist Hub */}
        <section id="parameters-ai" className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <ParameterControls
            params={params}
            onChangeParams={setParams}
            onResetDefaults={() => handleSelectBranch(params.branch)}
          />
          <CosmologistHub
            params={params}
            epoch={epoch}
            S8={S8}
            chi2={chi2}
            onApplySuggestedParams={(suggested) => {
              setParams((prev) => ({
                ...prev,
                branch: prev.branch === 'lcdm' ? 'basic' : prev.branch,
                zTrans: Number(suggested.zTrans.toFixed(2)),
                H0: Number(suggested.H0.toFixed(2)),
                OmegaM0: Number(suggested.OmegaM0.toFixed(3)),
                alphaT: Number(suggested.alphaT.toFixed(2)),
                betaLambda: Number(suggested.betaLambda.toFixed(3)),
              }));
            }}
          />
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-4 px-4 lg:px-8 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4 max-w-[1480px] w-full mx-auto">
        <span>Teleparallel f(T) Gravity &amp; Sign-Changing Dark Energy Explorer</span>
        <span className="font-mono">
          Flat FLRW Metric · RK4 Growth Solver · Numerical Simpson Distance Integrator
        </span>
      </footer>

      <BenchmarkModal
        open={benchmarkModalOpen}
        onClose={() => setBenchmarkModalOpen(false)}
        result={benchmarkResult}
        onLoadParams={(loaded) => {
          setParams(loaded);
          if (loaded.branch !== 'lcdm') {
            setZ(loaded.zTrans);
          }
        }}
      />
    </div>
  );
}
