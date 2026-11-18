import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { CosmologyParams } from '../physics/cosmology';

interface ParameterControlsProps {
  params: CosmologyParams;
  onChangeParams: (next: CosmologyParams) => void;
  onResetDefaults: () => void;
}

interface SliderRowProps {
  id: string;
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals: number;
  disabled?: boolean;
  description: string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  id,
  label,
  symbol,
  value,
  min,
  max,
  step,
  unit,
  decimals,
  disabled,
  description,
  onChange,
}) => {
  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-45' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-slate-200 flex items-center gap-2">
          <span>{label}</span>
          <span className="font-mono text-cyan-400">{symbol}</span>
        </label>
        <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs">
          <input
            type="number"
            aria-label={`${label} numeric value`}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={Number(value.toFixed(decimals))}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (!Number.isNaN(parsed)) {
                onChange(Math.max(min, Math.min(max, parsed)));
              }
            }}
            className="w-20 rounded bg-[#07090E] border border-slate-700 px-2 py-0.5 text-right text-slate-100 focus:outline-none focus:border-cyan-500"
          />
          {unit && <span className="text-[11px] text-slate-400">{unit}</span>}
        </div>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="cosmos-range w-full cursor-pointer disabled:cursor-not-allowed"
      />
      <p className="text-[11px] text-slate-400">{description}</p>
    </div>
  );
};

export const ParameterControls: React.FC<ParameterControlsProps> = ({
  params,
  onChangeParams,
  onResetDefaults,
}) => {
  const isLcdm = params.branch === 'lcdm';
  const isExtended = params.branch === 'extended';

  return (
    <div className="science-panel rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Teleparallel <span className="font-mono text-cyan-400">f(T)</span> Model Parameters
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Adjust torsion transition dynamics and cosmological priors in real time.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="px-3 py-1.5 rounded-lg bg-[#07090E] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="space-y-4">
        <SliderRow
          id="param-ztrans"
          label="Transition Redshift"
          symbol="z_trans"
          value={params.zTrans}
          min={0.65}
          max={2.45}
          step={0.01}
          decimals={2}
          disabled={isLcdm}
          description="Epoch where effective dark energy crosses zero (ρ_DE = 0)."
          onChange={(zTrans) => onChangeParams({ ...params, zTrans })}
        />

        <SliderRow
          id="param-h0"
          label="Hubble Constant"
          symbol="H₀"
          value={params.H0}
          min={65.0}
          max={78.0}
          step={0.1}
          unit="km/s/Mpc"
          decimals={2}
          description="Present-day expansion rate; SH0ES local distance ladder is 73.04 ± 1.04."
          onChange={(H0) => onChangeParams({ ...params, H0 })}
        />

        <SliderRow
          id="param-omm"
          label="Matter Density"
          symbol="Ω_m0"
          value={params.OmegaM0}
          min={0.22}
          max={0.36}
          step={0.002}
          decimals={3}
          description="Present baryonic + cold dark matter fraction (flatness sets Ω_DE,0 = 1 − Ω_m0)."
          onChange={(OmegaM0) => onChangeParams({ ...params, OmegaM0 })}
        />

        <SliderRow
          id="param-alphat"
          label="Torsion Steepness"
          symbol="α_T"
          value={params.alphaT}
          min={0.1}
          max={2.5}
          step={0.05}
          decimals={2}
          disabled={isLcdm}
          description="Hyperbolic sign-reversal steepness governing the width of the w_DE pole."
          onChange={(alphaT) => onChangeParams({ ...params, alphaT })}
        />

        <SliderRow
          id="param-betalambda"
          label="Bare Torsion Shift"
          symbol="β_Λ"
          value={params.betaLambda}
          min={-0.3}
          max={0.3}
          step={0.01}
          decimals={3}
          disabled={!isExtended}
          description="Active in Extended f(T)+Λ (k=4) branch; shifts asymptotic high-z vacuum floor."
          onChange={(betaLambda) => onChangeParams({ ...params, betaLambda })}
        />

        <SliderRow
          id="param-sigma8"
          label="Clustering Amplitude"
          symbol="σ₈,0"
          value={params.sigma80}
          min={0.72}
          max={0.88}
          step={0.005}
          decimals={3}
          description="Linear matter power spectrum RMS amplitude on 8 h⁻¹ Mpc scales."
          onChange={(sigma80) => onChangeParams({ ...params, sigma80 })}
        />
      </div>
    </div>
  );
};
