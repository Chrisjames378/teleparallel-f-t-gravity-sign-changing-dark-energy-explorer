import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type {
  BenchmarkSuiteResult,
  CosmologyCurvePoint,
  CosmologyParams,
} from '../physics/cosmology';
import {
  HUBBLE_OBSERVATIONS,
  PANTHEON_PLUS_RESIDUALS,
  RSD_GROWTH_DATA,
} from '../physics/datasets';

export type Chart1Tab = 'density' | 'eos' | 'hubble' | 'sne' | 'torsion';
export type Chart2Tab = 'decel' | 'growth' | 'contours' | 'posterior';

interface ScienceChartsProps {
  curves: CosmologyCurvePoint[];
  params: CosmologyParams;
  z: number;
  onSelectZ: (z: number) => void;
  benchmarkResult: BenchmarkSuiteResult;
  onRunBenchmark: () => void;
}

interface TooltipData {
  x: number;
  y: number;
  lines: string[];
}

export const ScienceCharts: React.FC<ScienceChartsProps> = ({
  curves,
  params,
  z,
  onSelectZ,
  benchmarkResult,
  onRunBenchmark,
}) => {
  const [chart1Tab, setChart1Tab] = useState<Chart1Tab>('density');
  const [chart2Tab, setChart2Tab] = useState<Chart2Tab>('decel');

  const svg1Ref = useRef<SVGSVGElement | null>(null);
  const svg2Ref = useRef<SVGSVGElement | null>(null);
  const wrap1Ref = useRef<HTMLDivElement | null>(null);
  const wrap2Ref = useRef<HTMLDivElement | null>(null);

  const [tooltip1, setTooltip1] = useState<TooltipData | null>(null);
  const [tooltip2, setTooltip2] = useState<TooltipData | null>(null);

  // Check if recent weakening of acceleration occurs (dq/dz < 0 near z = 0)
  const recentWeakening = useMemo(() => {
    if (curves.length < 4) return false;
    return curves[0].q > curves[3].q;
  }, [curves]);

  // Render Chart 1 with D3
  useEffect(() => {
    const svgEl = svg1Ref.current;
    const wrapEl = wrap1Ref.current;
    if (!svgEl || !wrapEl) return;

    const width = Math.max(360, wrapEl.clientWidth);
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 38, left: 54 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([0, 3.0]).range([0, innerW]);

    let yDomain: [number, number] = [-0.85, 0.9];
    if (chart1Tab === 'eos') yDomain = [-4.5, 3.5];
    else if (chart1Tab === 'hubble') yDomain = [52, 85];
    else if (chart1Tab === 'sne') yDomain = [-0.25, 0.25];
    else if (chart1Tab === 'torsion') yDomain = [-0.9, 0.9];

    const yScale = d3.scaleLinear().domain(yDomain).range([innerH, 0]);

    // Gridlines
    g.append('g')
      .attr('stroke', '#1E293B')
      .attr('stroke-opacity', 0.6)
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(() => ''));

    g.append('g')
      .attr('stroke', '#1E293B')
      .attr('stroke-opacity', 0.45)
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-innerH).tickFormat(() => ''));

    // Shaded negative zone for density or torsion
    if (chart1Tab === 'density' || chart1Tab === 'torsion') {
      const zeroY = yScale(0);
      if (zeroY < innerH) {
        g.append('rect')
          .attr('x', 0)
          .attr('y', zeroY)
          .attr('width', innerW)
          .attr('height', innerH - zeroY)
          .attr('fill', 'rgba(244, 63, 94, 0.08)');
      }
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', zeroY)
        .attr('y2', zeroY)
        .attr('stroke', '#475569')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1);
    } else if (chart1Tab === 'eos') {
      const minusOneY = yScale(-1);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', minusOneY)
        .attr('y2', minusOneY)
        .attr('stroke', '#F59E0B')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.2);
    } else if (chart1Tab === 'sne') {
      const zeroY = yScale(0);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', zeroY)
        .attr('y2', zeroY)
        .attr('stroke', '#F59E0B')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.2);
    }

    // Baseline LCDM curve where applicable
    if (chart1Tab === 'density') {
      const lcdmLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.lcdmOmegaDE));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('d', lcdmLine);

      const mainLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.OmegaDE));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#06B6D4')
        .attr('stroke-width', 2.4)
        .attr('d', mainLine);
    } else if (chart1Tab === 'eos') {
      const eosLine = d3
        .line<CosmologyCurvePoint>()
        .defined((d) => d.wDE !== null && Math.abs(d.wDE) < 4.4)
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.wDE ?? -1));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#A78BFA')
        .attr('stroke-width', 2.4)
        .attr('d', eosLine);

      if (params.branch !== 'lcdm') {
        g.append('line')
          .attr('x1', xScale(params.zTrans))
          .attr('x2', xScale(params.zTrans))
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', '#F43F5E')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', 0.8);
      }
    } else if (chart1Tab === 'hubble') {
      const lcdmLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.lcdmH_1pz));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('d', lcdmLine);

      const mainLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.H_1pz));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#06B6D4')
        .attr('stroke-width', 2.4)
        .attr('d', mainLine);

      // DESI DR1 & CC Error Bars + Points
      for (const pt of HUBBLE_OBSERVATIONS) {
        const cx = xScale(pt.z);
        const val = pt.hz / (1 + pt.z);
        const err = pt.err / (1 + pt.z);
        const yTop = yScale(Math.min(yDomain[1], val + err));
        const yBot = yScale(Math.max(yDomain[0], val - err));
        const isDesi = pt.survey.startsWith('DESI');
        const col = isDesi ? '#34D399' : '#94A3B8';

        g.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', yTop)
          .attr('y2', yBot)
          .attr('stroke', col)
          .attr('stroke-width', 1.3);
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', yScale(val))
          .attr('r', isDesi ? 3.5 : 2.8)
          .attr('fill', col);
      }
    } else if (chart1Tab === 'sne') {
      const sneLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.muResidual));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#06B6D4')
        .attr('stroke-width', 2.4)
        .attr('d', sneLine);

      for (const pt of PANTHEON_PLUS_RESIDUALS) {
        const cx = xScale(pt.z);
        g.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', yScale(pt.deltaMu + pt.err))
          .attr('y2', yScale(pt.deltaMu - pt.err))
          .attr('stroke', '#38BDF8')
          .attr('stroke-opacity', 0.7)
          .attr('stroke-width', 1.2);
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', yScale(pt.deltaMu))
          .attr('r', 3.2)
          .attr('fill', '#E0F2FE');
      }
    } else if (chart1Tab === 'torsion') {
      const torsionLine = d3
        .line<CosmologyCurvePoint>()
        .x((d) => xScale(d.z))
        .y((d) => yScale(d.fTRatio));
      g.append('path')
        .datum(curves)
        .attr('fill', 'none')
        .attr('stroke', '#22D3EE')
        .attr('stroke-width', 2.4)
        .attr('d', torsionLine);
    }

    // Current redshift vertical cursor
    g.append('line')
      .attr('x1', xScale(z))
      .attr('x2', xScale(z))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#E2E8F0')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.65);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .attr('color', '#64748B')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .attr('color', '#64748B')
      .style('font-family', 'JetBrains Mono, monospace')
      .style('font-size', '10px');

    // Interactive Overlay
    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event) {
        const [mx, my] = d3.pointer(event);
        const hoverZ = Math.max(0, Math.min(3, xScale.invert(mx)));
        const idx = Math.min(curves.length - 1, Math.max(0, Math.round((hoverZ / 3.0) * (curves.length - 1))));
        const pt = curves[idx];
        const lines: string[] = [`z = ${pt.z.toFixed(2)}`];
        if (chart1Tab === 'density') {
          lines.push(`Ω_DE = ${pt.OmegaDE.toFixed(3)}`, `ΛCDM = ${pt.lcdmOmegaDE.toFixed(3)}`);
        } else if (chart1Tab === 'eos') {
          lines.push(`w_DE = ${pt.wDE === null ? 'Pole' : pt.wDE.toFixed(3)}`);
        } else if (chart1Tab === 'hubble') {
          lines.push(`H/(1+z) = ${pt.H_1pz.toFixed(2)}`, `ΛCDM = ${pt.lcdmH_1pz.toFixed(2)}`);
        } else if (chart1Tab === 'sne') {
          lines.push(`Δμ = ${pt.muResidual >= 0 ? '+' : ''}${pt.muResidual.toFixed(3)} mag`);
        } else {
          lines.push(`f(T)/6H² = ${pt.fTRatio.toFixed(3)}`, `T = ${pt.T.toFixed(0)}`);
        }
        setTooltip1({ x: mx + margin.left, y: my + margin.top, lines });
      })
      .on('mouseleave', () => setTooltip1(null))
      .on('click', function (event) {
        const [mx] = d3.pointer(event);
        const clickedZ = Math.max(0, Math.min(3, Number(xScale.invert(mx).toFixed(2))));
        onSelectZ(clickedZ);
      });
  }, [curves, chart1Tab, z, params, onSelectZ]);

  // Render Chart 2 with D3
  useEffect(() => {
    const svgEl = svg2Ref.current;
    const wrapEl = wrap2Ref.current;
    if (!svgEl || !wrapEl) return;

    const width = Math.max(360, wrapEl.clientWidth);
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 38, left: 54 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (chart2Tab === 'decel' || chart2Tab === 'growth') {
      const xScale = d3.scaleLinear().domain([0, 3.0]).range([0, innerW]);
      const yDomain: [number, number] = chart2Tab === 'decel' ? [-1.05, 0.85] : [0.22, 0.62];
      const yScale = d3.scaleLinear().domain(yDomain).range([innerH, 0]);

      g.append('g')
        .attr('stroke', '#1E293B')
        .attr('stroke-opacity', 0.6)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(() => ''));

      g.append('g')
        .attr('stroke', '#1E293B')
        .attr('stroke-opacity', 0.45)
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(6).tickSize(-innerH).tickFormat(() => ''));

      if (chart2Tab === 'decel') {
        const zeroY = yScale(0);
        g.append('rect')
          .attr('x', 0)
          .attr('y', zeroY)
          .attr('width', innerW)
          .attr('height', innerH - zeroY)
          .attr('fill', 'rgba(6, 182, 212, 0.06)');
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerW)
          .attr('y1', zeroY)
          .attr('y2', zeroY)
          .attr('stroke', '#475569')
          .attr('stroke-dasharray', '4,4');

        const lcdmQ = d3
          .line<CosmologyCurvePoint>()
          .x((d) => xScale(d.z))
          .y((d) => yScale(d.lcdmQ));
        g.append('path')
          .datum(curves)
          .attr('fill', 'none')
          .attr('stroke', '#F59E0B')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,4')
          .attr('d', lcdmQ);

        const qLine = d3
          .line<CosmologyCurvePoint>()
          .x((d) => xScale(d.z))
          .y((d) => yScale(d.q));
        g.append('path')
          .datum(curves)
          .attr('fill', 'none')
          .attr('stroke', '#38BDF8')
          .attr('stroke-width', 2.4)
          .attr('d', qLine);
      } else {
        const lcdmG = d3
          .line<CosmologyCurvePoint>()
          .x((d) => xScale(d.z))
          .y((d) => yScale(d.lcdmFs8));
        g.append('path')
          .datum(curves)
          .attr('fill', 'none')
          .attr('stroke', '#F59E0B')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,4')
          .attr('d', lcdmG);

        const gLine = d3
          .line<CosmologyCurvePoint>()
          .x((d) => xScale(d.z))
          .y((d) => yScale(d.fs8));
        g.append('path')
          .datum(curves)
          .attr('fill', 'none')
          .attr('stroke', '#34D399')
          .attr('stroke-width', 2.4)
          .attr('d', gLine);

        for (const pt of RSD_GROWTH_DATA) {
          const cx = xScale(pt.z);
          g.append('line')
            .attr('x1', cx)
            .attr('x2', cx)
            .attr('y1', yScale(Math.min(yDomain[1], pt.fs8 + pt.err)))
            .attr('y2', yScale(Math.max(yDomain[0], pt.fs8 - pt.err)))
            .attr('stroke', '#94A3B8')
            .attr('stroke-width', 1.2);
          g.append('circle')
            .attr('cx', cx)
            .attr('cy', yScale(pt.fs8))
            .attr('r', 3.2)
            .attr('fill', '#E2E8F0');
        }
      }

      g.append('line')
        .attr('x1', xScale(z))
        .attr('x2', xScale(z))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#E2E8F0')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.65);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(6))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mousemove', function (event) {
          const [mx, my] = d3.pointer(event);
          const hoverZ = Math.max(0, Math.min(3, xScale.invert(mx)));
          const idx = Math.min(curves.length - 1, Math.max(0, Math.round((hoverZ / 3.0) * (curves.length - 1))));
          const pt = curves[idx];
          const lines =
            chart2Tab === 'decel'
              ? [`z = ${pt.z.toFixed(2)}`, `q(z) = ${pt.q.toFixed(3)}`, `ΛCDM q = ${pt.lcdmQ.toFixed(3)}`]
              : [`z = ${pt.z.toFixed(2)}`, `fσ₈ = ${pt.fs8.toFixed(3)}`, `ΛCDM = ${pt.lcdmFs8.toFixed(3)}`];
          setTooltip2({ x: mx + margin.left, y: my + margin.top, lines });
        })
        .on('mouseleave', () => setTooltip2(null))
        .on('click', function (event) {
          const [mx] = d3.pointer(event);
          const clickedZ = Math.max(0, Math.min(3, Number(xScale.invert(mx).toFixed(2))));
          onSelectZ(clickedZ);
        });
    } else if (chart2Tab === 'contours') {
      const xScale = d3.scaleLinear().domain([0.24, 0.35]).range([0, innerW]);
      const yScale = d3.scaleLinear().domain([66.0, 76.5]).range([innerH, 0]);
      const cellW = innerW / 18 + 1;
      const cellH = innerH / 18 + 1;

      const colorScale = (deltaChi2: number) => {
        if (deltaChi2 <= 2.3) return '#06B6D4'; // 1-sigma
        if (deltaChi2 <= 6.17) return '#0E7490'; // 2-sigma
        if (deltaChi2 <= 11.8) return '#164E63'; // 3-sigma
        return '#0B1324';
      };

      for (const cell of benchmarkResult.contourGrid) {
        g.append('rect')
          .attr('x', xScale(cell.x) - cellW / 2)
          .attr('y', yScale(cell.y) - cellH / 2)
          .attr('width', cellW)
          .attr('height', cellH)
          .attr('fill', colorScale(cell.deltaChi2))
          .attr('opacity', 0.88);
      }

      // SH0ES H0 1-sigma horizontal band
      g.append('rect')
        .attr('x', 0)
        .attr('y', yScale(74.08))
        .attr('width', innerW)
        .attr('height', yScale(72.0) - yScale(74.08))
        .attr('fill', 'rgba(245, 158, 11, 0.14)')
        .attr('stroke', '#F59E0B')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-opacity', 0.6);

      // Active model point
      g.append('circle')
        .attr('cx', xScale(params.OmegaM0))
        .attr('cy', yScale(params.H0))
        .attr('r', 5)
        .attr('fill', '#F8FAFC')
        .attr('stroke', '#07090E')
        .attr('stroke-width', 1.5);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(5))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');
    } else {
      // MCMC Trace of H0 across sampler steps
      const samples = benchmarkResult.samples;
      const xScale = d3.scaleLinear().domain([0, samples.length - 1]).range([0, innerW]);
      const hVals = samples.map((s) => s.H0);
      const minH = Math.min(66, Math.min(...hVals) - 0.5);
      const maxH = Math.max(76, Math.max(...hVals) + 0.5);
      const yScale = d3.scaleLinear().domain([minH, maxH]).range([innerH, 0]);

      g.append('g')
        .attr('stroke', '#1E293B')
        .attr('stroke-opacity', 0.6)
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(() => ''));

      const traceLine = d3
        .line<(typeof samples)[number]>()
        .x((d) => xScale(d.step))
        .y((d) => yScale(d.H0));

      g.append('path')
        .datum(samples)
        .attr('fill', 'none')
        .attr('stroke', '#34D399')
        .attr('stroke-width', 1.25)
        .attr('d', traceLine);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(73.04))
        .attr('y2', yScale(73.04))
        .attr('stroke', '#F59E0B')
        .attr('stroke-dasharray', '4,4');

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(xScale).ticks(5))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');

      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5))
        .attr('color', '#64748B')
        .style('font-family', 'JetBrains Mono, monospace')
        .style('font-size', '10px');
    }
  }, [curves, chart2Tab, z, params, benchmarkResult, onSelectZ]);

  const chart1TitleMap: Record<Chart1Tab, { title: string; subtitle: string }> = {
    density: {
      title: 'Effective Dark Energy Density Evolution',
      subtitle: 'Normalized Ω_DE(z) = ρ_DE(z) / ρ_crit,0 vs. Redshift z',
    },
    eos: {
      title: 'Effective Equation of State w_DE(z)',
      subtitle: 'Phantom divide & sign-reversal pole singularity at z = z_trans',
    },
    hubble: {
      title: 'Normalized Expansion Rate H(z)/(1+z)',
      subtitle: 'Model curve against DESI DR1 BAO (green) & Cosmic Chronometers',
    },
    sne: {
      title: 'Pantheon+ Distance Modulus Residuals Δμ(z)',
      subtitle: 'Hubble residual Δμ = μ_f(T) − μ_fiducial(ΛCDM) in magnitudes',
    },
    torsion: {
      title: 'Teleparallel Torsion Modification f(T)/6H²',
      subtitle: 'Dimensionless torsion Lagrangian contribution across redshift',
    },
  };

  const chart2TitleMap: Record<Chart2Tab, { title: string; subtitle: string }> = {
    decel: {
      title: 'Cosmic Acceleration & Deceleration q(z)',
      subtitle: 'q(z) < 0 indicates accelerating expansion; q(z) > 0 decelerating',
    },
    growth: {
      title: 'Linear Structure Growth Rate fσ₈(z)',
      subtitle: 'RK4 perturbation growth ODE against BOSS/eBOSS RSD measurements',
    },
    contours: {
      title: '2D Likelihood Contours (Ω_m0 vs. H₀)',
      subtitle: '1σ / 2σ / 3σ confidence regions with SH0ES H₀ band',
    },
    posterior: {
      title: 'Metropolis-Hastings MCMC Chain Trace H₀',
      subtitle: `550-step sampler trace · Acceptance ${(benchmarkResult.acceptanceRate * 100).toFixed(1)}%`,
    },
  };

  return (
    <section id="observables" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1 */}
      <div className="science-panel rounded-xl p-5 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{chart1TitleMap[chart1Tab].title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{chart1TitleMap[chart1Tab].subtitle}</p>
          </div>
          <div className="inline-flex flex-wrap rounded-lg bg-[#07090E] p-1 border border-slate-800 shrink-0">
            {(
              [
                ['density', 'Ω_DE(z)'],
                ['eos', 'EoS w_DE'],
                ['hubble', 'H(z) + DESI'],
                ['sne', 'Pantheon+'],
                ['torsion', 'Torsion f(T)'],
              ] as Array<[Chart1Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChart1Tab(key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chart1Tab === key ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={wrap1Ref}
          className="relative w-full h-[300px] bg-[#07090E] rounded-lg border border-slate-800/90 overflow-hidden"
        >
          <svg ref={svg1Ref} className="w-full h-full block" />
          {tooltip1 && (
            <div
              className="pointer-events-none absolute z-10 rounded-md bg-[#0D121D] border border-slate-700 px-2.5 py-1.5 text-[11px] font-mono tabular-nums text-slate-100 shadow-lg"
              style={{
                left: Math.min(tooltip1.x + 12, 260),
                top: Math.max(8, tooltip1.y - 36),
              }}
            >
              {tooltip1.lines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
          <span>← Present (z = 0)</span>
          <span className="text-rose-400">Shaded Red: Negative ρ_DE &lt; 0</span>
          <span>Click plot to scrub z →</span>
        </div>
      </div>

      {/* Chart 2 */}
      <div className="science-panel rounded-xl p-5 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-100">{chart2TitleMap[chart2Tab].title}</h2>
              {recentWeakening && chart2Tab === 'decel' && (
                <span className="text-[11px] font-mono text-amber-400">· Late Weakening</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{chart2TitleMap[chart2Tab].subtitle}</p>
          </div>
          <div className="inline-flex flex-wrap rounded-lg bg-[#07090E] p-1 border border-slate-800 shrink-0">
            {(
              [
                ['decel', 'q(z)'],
                ['growth', 'fσ₈(z)'],
                ['contours', 'χ² Contours'],
                ['posterior', 'MCMC Trace'],
              ] as Array<[Chart2Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setChart2Tab(key);
                  if (key === 'contours' || key === 'posterior') {
                    onRunBenchmark();
                  }
                }}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chart2Tab === key
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={wrap2Ref}
          className="relative w-full h-[300px] bg-[#07090E] rounded-lg border border-slate-800/90 overflow-hidden"
        >
          <svg ref={svg2Ref} className="w-full h-full block" />
          {tooltip2 && (
            <div
              className="pointer-events-none absolute z-10 rounded-md bg-[#0D121D] border border-slate-700 px-2.5 py-1.5 text-[11px] font-mono tabular-nums text-slate-100 shadow-lg"
              style={{
                left: Math.min(tooltip2.x + 12, 260),
                top: Math.max(8, tooltip2.y - 36),
              }}
            >
              {tooltip2.lines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-3 border-t border-slate-800/80">
          <span>
            {chart2Tab === 'contours' ? 'x: Ω_m0 ∈ [0.24, 0.35]' : chart2Tab === 'posterior' ? 'Chain Step' : '← Present (z = 0)'}
          </span>
          <span className="text-amber-400">Dotted / Band: Standard ΛCDM / SH0ES</span>
          <span>{chart2Tab === 'contours' ? 'y: H₀ [66–76.5]' : chart2Tab === 'posterior' ? 'H₀ [km/s/Mpc]' : 'Early (z = 3) →'}</span>
        </div>
      </div>
    </section>
  );
};
