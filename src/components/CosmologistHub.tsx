import React, { useState } from 'react';
import { Send, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import type { Chi2Breakdown, CosmologyParams, EpochEvaluation } from '../physics/cosmology';

interface CosmologistHubProps {
  params: CosmologyParams;
  epoch: EpochEvaluation;
  S8: number;
  chi2: Chi2Breakdown;
  onApplySuggestedParams: (suggested: {
    zTrans: number;
    w0: number;
    H0: number;
    OmegaM0: number;
    alphaT: number;
    betaLambda: number;
  }) => void;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
}

interface StructuredAnalysis {
  verdict: string;
  tensionSummary: string;
  suggestedParams: {
    zTrans: number;
    w0: number;
    H0: number;
    OmegaM0: number;
    alphaT: number;
    betaLambda: number;
  };
}

const QUICK_PROMPTS = [
  'Why does w_DE(z) exhibit a pole at z_trans?',
  'How does negative ρ_DE at z > 1.5 relieve the H₀ tension?',
  'Explain the S₈ structure growth suppression in f(T) gravity.',
];

export const CosmologistHub: React.FC<CosmologistHubProps> = ({
  params,
  epoch,
  S8,
  chi2,
  onApplySuggestedParams,
}) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previousInteractionId, setPreviousInteractionId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedBanner, setAppliedBanner] = useState(false);

  const buildSnapshot = () => ({
    branch: params.branch,
    z: epoch.z,
    zTrans: params.zTrans,
    w0: params.w0,
    H0: params.H0,
    OmegaM0: params.OmegaM0,
    alphaT: params.alphaT,
    betaLambda: params.betaLambda,
    sigma80: params.sigma80,
    S8,
    OmegaDE_at_z: epoch.OmegaDE,
    wDE_at_z: epoch.wDE,
    q_at_z: epoch.q,
    T_at_z: epoch.T,
    totalChi2: chi2.totalChi2,
    lcdmChi2: chi2.lcdmTotalChi2,
    deltaChi2: chi2.deltaChi2,
    h0TensionSigma: chi2.h0TensionSigma,
    s8TensionSigma: chi2.s8TensionSigma,
  });

  const handleSendMessage = async (promptText?: string) => {
    const query = (promptText ?? input).trim();
    if (!query || isStreaming) return;

    setErrorMsg(null);
    if (!promptText) setInput('');

    const userTurnId = `user-${Date.now()}`;
    const assistantTurnId = `assistant-${Date.now()}`;

    setTurns((prev) => [
      ...prev,
      { id: userTurnId, role: 'user', text: query },
      { id: assistantTurnId, role: 'assistant', text: '', thought: '' },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/cosmologist/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          snapshot: buildSnapshot(),
          previousInteractionId,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({ error: 'Server returned an error.' }));
        throw new Error(errPayload.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Readable stream unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (!payloadStr) continue;
          const evt = JSON.parse(payloadStr) as {
            type: string;
            text?: string;
            interactionId?: string;
            error?: string;
          };

          if (evt.type === 'meta' && evt.interactionId) {
            setPreviousInteractionId(evt.interactionId);
          } else if (evt.type === 'thought' && evt.text) {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantTurnId ? { ...t, thought: (t.thought ?? '') + evt.text } : t
              )
            );
          } else if (evt.type === 'text' && evt.text) {
            setTurns((prev) =>
              prev.map((t) => (t.id === assistantTurnId ? { ...t, text: t.text + evt.text } : t))
            );
          } else if (evt.type === 'done' && evt.interactionId) {
            setPreviousInteractionId(evt.interactionId);
          } else if (evt.type === 'error') {
            throw new Error(evt.error || 'Interaction stream error.');
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reach Cosmologist Hub.';
      setErrorMsg(msg);
      setTurns((prev) => prev.filter((t) => t.id !== assistantTurnId || t.text.length > 0));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleRunStructuredDiagnosis = async () => {
    if (isAnalyzing) return;
    setErrorMsg(null);
    setIsAnalyzing(true);
    setAppliedBanner(false);

    try {
      const res = await fetch('/api/cosmologist/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: buildSnapshot() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAnalysis(data.analysis as StructuredAnalysis);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Structured diagnosis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="science-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Cosmologist Reasoning Hub
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live parameter diagnosis &amp; theoretical interpretation via Gemini Interactions API
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunStructuredDiagnosis}
          disabled={isAnalyzing}
          className="px-3.5 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-50 text-cyan-300 border border-cyan-500/35 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span>{isAnalyzing ? 'Evaluating Fit...' : 'Diagnose Current Fit'}</span>
        </button>
      </div>

      {/* Structured Diagnostic Output */}
      {analysis && (
        <div className="science-subpanel rounded-lg p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-cyan-400 font-semibold">Observational Diagnosis</span>
            <button
              type="button"
              onClick={() => {
                onApplySuggestedParams(analysis.suggestedParams);
                setAppliedBanner(true);
              }}
              className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/35 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
            >
              {appliedBanner ? <Check className="w-3 h-3" /> : null}
              <span>{appliedBanner ? 'Applied to Sliders' : 'Apply Suggested Params'}</span>
            </button>
          </div>
          <p className="text-slate-200 leading-relaxed">{analysis.verdict}</p>
          <p className="text-slate-400 leading-relaxed">{analysis.tensionSummary}</p>
          <div className="pt-1 font-mono tabular-nums text-[11px] text-slate-400">
            z_trans={analysis.suggestedParams.zTrans.toFixed(2)} · w₀={analysis.suggestedParams.w0.toFixed(2)} · H₀=
            {analysis.suggestedParams.H0.toFixed(2)} · Ω_m0={analysis.suggestedParams.OmegaM0.toFixed(3)} · α_T=
            {analysis.suggestedParams.alphaT.toFixed(2)}
          </div>
        </div>
      )}

      {/* Error Display */}
      {errorMsg && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/35 p-3 flex items-start gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Conversation History */}
      <div className="science-subpanel rounded-lg p-3.5 h-[260px] overflow-y-auto space-y-3 text-xs">
        {turns.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center space-y-3 px-4">
            <p className="text-slate-400 max-w-md leading-relaxed">
              Ask about the sign-changing dark energy transition, DESI DR1 BAO constraints, torsion scalar kinematics,
              or click <span className="text-cyan-400 font-medium">Diagnose Current Fit</span> above.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="px-2.5 py-1.5 rounded-md bg-[#0D121D] hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className={`space-y-1.5 ${turn.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                {turn.role === 'user' ? 'Investigator' : 'Cosmologist Agent'}
              </div>
              {turn.thought && (
                <details className="rounded bg-[#0D121D] border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-400">
                  <summary className="cursor-pointer font-mono text-slate-300">Reasoning Trace</summary>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{turn.thought}</p>
                </details>
              )}
              <div
                className={`inline-block rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap max-w-[92%] ${
                  turn.role === 'user'
                    ? 'bg-cyan-500/15 border border-cyan-500/30 text-slate-100 text-left'
                    : 'bg-[#0D121D] border border-slate-800 text-slate-200'
                }`}
              >
                {turn.text || (isStreaming && turn.role === 'assistant' ? 'Synthesizing cosmological response...' : '')}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Prompt Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about f(T) torsion, z_trans pole, DESI DR1, or S₈ tension..."
          className="flex-1 rounded-lg bg-[#07090E] border border-slate-700 px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
