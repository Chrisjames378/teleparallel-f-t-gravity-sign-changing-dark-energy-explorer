import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = 'gemini-4-hydrogen';

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured on the server.');
  }
  return new GoogleGenAI({ apiKey });
}

interface CosmologySnapshot {
  branch: string;
  z: number;
  zTrans: number;
  w0: number;
  H0: number;
  OmegaM0: number;
  alphaT: number;
  betaLambda: number;
  sigma80: number;
  S8: number;
  OmegaDE_at_z: number;
  wDE_at_z: number | null;
  q_at_z: number;
  T_at_z: number;
  totalChi2: number;
  lcdmChi2: number;
  deltaChi2: number;
  h0TensionSigma: number;
  s8TensionSigma: number;
}

function buildCosmologyContextPrompt(snapshot: CosmologySnapshot): string {
  const branchLabel =
    snapshot.branch === 'basic'
      ? 'Basic f(T) Sign-Changing (k=3)'
      : snapshot.branch === 'extended'
        ? 'Extended f(T)+Lambda (k=4)'
        : 'Standard Lambda-CDM (k=2)';

  return [
    `Current Teleparallel f(T) Explorer State:`,
    `- Active Branch: ${branchLabel}`,
    `- Redshift Epoch: z = ${snapshot.z.toFixed(2)}`,
    `- Transition Redshift: z_trans = ${snapshot.zTrans.toFixed(2)}`,
    `- Present Dark Energy EoS Baseline: w0 = ${snapshot.w0.toFixed(2)}`,
    `- Hubble Constant: H0 = ${snapshot.H0.toFixed(2)} km/s/Mpc`,
    `- Matter Density: Omega_m0 = ${snapshot.OmegaM0.toFixed(4)}`,
    `- Torsion Coupling Steepness: alpha_T = ${snapshot.alphaT.toFixed(2)}`,
    `- Extended Cosmological Shift: beta_Lambda = ${snapshot.betaLambda.toFixed(3)}`,
    `- Primordial Clustering: sigma8,0 = ${snapshot.sigma80.toFixed(3)}, derived S8 = ${snapshot.S8.toFixed(3)}`,
    `- Epoch Telemetry at z=${snapshot.z.toFixed(2)}: Omega_DE(z) = ${snapshot.OmegaDE_at_z.toFixed(4)}, w_DE(z) = ${
      snapshot.wDE_at_z === null ? 'POLE_SINGULARITY' : snapshot.wDE_at_z.toFixed(3)
    }, q(z) = ${snapshot.q_at_z.toFixed(3)}, T(z) = ${snapshot.T_at_z.toFixed(0)} (km/s/Mpc)^2`,
    `- Observational Likelihood: chi2 = ${snapshot.totalChi2.toFixed(2)} (Lambda-CDM baseline = ${snapshot.lcdmChi2.toFixed(
      2
    )}, Delta_chi2 = ${snapshot.deltaChi2 >= 0 ? '+' : ''}${snapshot.deltaChi2.toFixed(2)})`,
    `- Tensions: H0 vs SH0ES = ${snapshot.h0TensionSigma.toFixed(2)} sigma, S8 vs KiDS-1000 = ${snapshot.s8TensionSigma.toFixed(
      2
    )} sigma`,
  ].join('\n');
}

const SYSTEM_INSTRUCTION = [
  'You are an expert theoretical and observational cosmologist specializing in Teleparallel Gravity f(T),',
  'sign-changing dark energy (Lambda_s CDM and smooth hyperbolic torsion transitions), DESI DR1 BAO, Pantheon+ SNe Ia,',
  'Cosmic Chronometers, Redshift-Space Distortions (f*sigma8), and the H0 / S8 cosmological tensions.',
  'Always reference the exact parameter values and chi-squared telemetry provided in the user context.',
  'Be mathematically precise, clear, and concise (around 180-320 words unless asked for an in-depth derivation).',
  'Use clean Unicode physics notation (Omega_DE, z_trans, H0, S8, chi2, w_DE, q(z)) rather than raw LaTeX delimiters that break plain-text readability.',
].join(' ');

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', model: MODEL_ID });
  });

  app.post('/api/cosmologist/chat', async (req, res) => {
    const { message, snapshot, previousInteractionId } = req.body as {
      message?: string;
      snapshot?: CosmologySnapshot;
      previousInteractionId?: string | null;
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'A prompt message is required.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = createAiClient();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI client initialization failed.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const contextBlock = snapshot ? `${buildCosmologyContextPrompt(snapshot)}\n\nUser Question:\n` : '';
      const fullInput = `${contextBlock}${message}`;

      const stream = await ai.interactions.create({
        model: MODEL_ID,
        input: fullInput,
        system_instruction: SYSTEM_INSTRUCTION,
        generation_config: {
          thinking_level: 'high',
        },
        ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
        stream: true,
      });

      let interactionId: string | null = null;

      for await (const event of stream) {
        const evt = event as unknown as Record<string, unknown>;
        const eventType = String(evt.event_type ?? '');

        if (eventType === 'interaction.created') {
          const interaction = evt.interaction as Record<string, unknown> | undefined;
          if (interaction?.id) {
            interactionId = String(interaction.id);
            sendEvent({ type: 'meta', interactionId });
          }
        } else if (eventType === 'step.delta') {
          const delta = evt.delta as Record<string, unknown> | undefined;
          if (!delta) continue;
          if (delta.type === 'text' && typeof delta.text === 'string') {
            sendEvent({ type: 'text', text: delta.text });
          } else if (delta.type === 'thought_summary' && typeof delta.content === 'object' && delta.content !== null) {
            const content = delta.content as Record<string, unknown>;
            if (typeof content.text === 'string') {
              sendEvent({ type: 'thought', text: content.text });
            }
          } else if (typeof delta.thought === 'string') {
            sendEvent({ type: 'thought', text: delta.thought });
          }
        } else if (eventType === 'interaction.completed') {
          const interaction = evt.interaction as Record<string, unknown> | undefined;
          if (interaction?.id) {
            interactionId = String(interaction.id);
          }
          sendEvent({
            type: 'done',
            interactionId,
            usage: interaction?.usage ?? null,
          });
        }
      }

      res.end();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Gemini Interactions API request failed.';
      sendEvent({ type: 'error', error: errorMessage });
      res.end();
    }
  });

  app.post('/api/cosmologist/analyze', async (req, res) => {
    const { snapshot } = req.body as { snapshot?: CosmologySnapshot };
    if (!snapshot) {
      res.status(400).json({ error: 'Cosmology snapshot is required.' });
      return;
    }

    let ai: GoogleGenAI;
    try {
      ai = createAiClient();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI client initialization failed.' });
      return;
    }

    try {
      const interaction = await ai.interactions.create({
        model: MODEL_ID,
        input: `${buildCosmologyContextPrompt(
          snapshot
        )}\n\nEvaluate this cosmological state against DESI DR1 BAO, Pantheon+, Cosmic Chronometers, and SH0ES/S8 tensions. Recommend an optimal parameter tuple (zTrans, H0, OmegaM0, alphaT, betaLambda) within valid physical bounds.`,
        system_instruction:
          'Return a rigorous observational cosmology assessment and optimal teleparallel f(T) parameter suggestion.',
        generation_config: {
          thinking_level: 'high',
        },
        response_format: {
          type: Type.OBJECT,
          properties: {
            verdict: {
              type: Type.STRING,
              description: 'Concise 2-3 sentence physical assessment of the current f(T) fit and sign transition.',
            },
            tensionSummary: {
              type: Type.STRING,
              description: 'Evaluation of H0 and S8 tension relief under this parameter set.',
            },
            suggestedParams: {
              type: Type.OBJECT,
              properties: {
                zTrans: { type: Type.NUMBER },
                w0: { type: Type.NUMBER },
                H0: { type: Type.NUMBER },
                OmegaM0: { type: Type.NUMBER },
                alphaT: { type: Type.NUMBER },
                betaLambda: { type: Type.NUMBER },
              },
              required: ['zTrans', 'w0', 'H0', 'OmegaM0', 'alphaT', 'betaLambda'],
            },
          },
          required: ['verdict', 'tensionSummary', 'suggestedParams'],
        },
      });

      const lastStep = interaction.steps?.at(-1);
      let rawJson = interaction.output_text ?? '';
      if (lastStep && lastStep.type === 'model_output') {
        const textPart = lastStep.content?.find((c) => c.type === 'text');
        if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
          rawJson = textPart.text.trim();
        }
      }

      const parsed = JSON.parse(rawJson);
      res.json({ interactionId: interaction.id, analysis: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate cosmological parameters.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Teleparallel f(T) Explorer server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
