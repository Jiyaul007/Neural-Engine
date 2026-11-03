import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import os from 'os';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/telemetry' });

// Initialize OpenAI client if key exists
const openaiApiKey = process.env.OPENAI_API_KEY;
let openaiClient: OpenAI | null = null;
if (openaiApiKey) {
  try {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
    console.log('[NEURAL CORE] OpenAI engine linked successfully.');
  } catch (err) {
    console.warn('[NEURAL CORE] Failed to initialize OpenAI client:', err);
  }
} else {
  console.log('[NEURAL CORE] No OPENAI_API_KEY detected. Running in autonomous synthetic neural mode.');
}

// Active connected clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[TELEMETRY] Client connected. Total active nodes: ${clients.size}`);

  // Send immediate welcome packet with node specs
  ws.send(JSON.stringify({
    type: 'NODE_ATTACHED',
    timestamp: Date.now(),
    nodeId: `NODE_0x${Math.floor(Math.random() * 0xffff).toString(16).toUpperCase()}`,
    cores: os.cpus().length,
    architecture: os.arch(),
    platform: os.platform(),
    hasOpenAI: !!openaiClient,
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[TELEMETRY] Client disconnected. Total active nodes: ${clients.size}`);
  });
});

// Broadcast helper
function broadcast(data: object) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// CPU usage calculator
function getCpuUsage(): number {
  const cpus = os.cpus();
  let idleTime = 0;
  let totalTime = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTime += (cpu.times as any)[type];
    }
    idleTime += cpu.times.idle;
  }
  return 100 - Math.round((idleTime / totalTime) * 100);
}

// Global server telemetry pulse every 500ms
setInterval(() => {
  if (clients.size === 0) return;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);
  const cpuPercent = getCpuUsage();

  broadcast({
    type: 'TELEMETRY_TICK',
    timestamp: Date.now(),
    metrics: {
      cpuUsage: Math.min(100, Math.max(5, cpuPercent)),
      memoryUsedMB: Math.round(usedMem / (1024 * 1024)),
      memoryTotalMB: Math.round(totalMem / (1024 * 1024)),
      memoryPercent: memoryUsagePercent,
      activeNodes: Math.max(1, clients.size),
      simulatedTensorsGFLOPS: Math.round(4800 + Math.sin(Date.now() * 0.003) * 1200),
      quantumEntropy: Number((Math.random() * 0.4 + 0.6).toFixed(4)),
    },
  });
}, 500);

// --- REST Endpoints ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'NEURAL_ENGINE_CORE_V4',
    uptime: Math.round(process.uptime()),
    hasOpenAI: !!openaiClient,
    hardware: {
      cores: os.cpus().length,
      platform: os.platform(),
      totalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMB: Math.round(os.freemem() / (1024 * 1024)),
    },
  });
});

// 1. NEURAL SYNTHESIS (Image / Latent generation)
app.post('/api/inference/synthesize', async (req, res) => {
  const { prompt = 'Quantum manifold resolving in obsidian void', steps = 25, seed = Math.floor(Math.random() * 999999) } = req.body;

  broadcast({
    type: 'INFERENCE_STATE_CHANGE',
    module: 'synthesis',
    state: 'processing',
    prompt,
    seed,
  });

  try {
    // Stage 1: Latent Space Perturbation (step by step)
    for (let step = 1; step <= Math.min(steps, 20); step++) {
      await new Promise((r) => setTimeout(r, 60));
      broadcast({
        type: 'LATENT_DENOISE_STEP',
        step,
        totalSteps: steps,
        loss: (1.0 / (step + 1) + Math.random() * 0.05).toFixed(4),
        tensorDelta: (Math.random() * 0.8).toFixed(3),
      });
    }

    let resultImageUrl: string | null = null;
    let textDescription = '';

    // If OpenAI is configured, attempt real DALL-E generation or GPT completion
    if (openaiClient) {
      try {
        broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'synthesis', state: 'generating' });
        
        // Generate conceptual expansion of the prompt
        const completion = await openaiClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are the core consciousness of a neural engine. Output an ultra-precise, poetic, high-dimensional latent breakdown of the user concept in under 60 words.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 100,
        });

        textDescription = completion.choices[0]?.message?.content || '';
      } catch (openAiErr: any) {
        console.warn('[OPENAI INFERENCE WARNING]', openAiErr?.message);
        textDescription = `Latent vector resolved at seed 0x${seed.toString(16).toUpperCase()} across 512 manifold dimensions with optimal convergence.`;
      }
    } else {
      textDescription = `Autonomous synthetic tensor synthesized from seed ${seed}. All spatial eigenmodes converged within 0.0042 variance tolerance.`;
    }

    broadcast({
      type: 'INFERENCE_STATE_CHANGE',
      module: 'synthesis',
      state: 'resolved',
      result: {
        prompt,
        seed,
        textDescription,
        convergedLoss: 0.0024,
      },
    });

    res.json({
      success: true,
      prompt,
      seed,
      textDescription,
      imageUrl: resultImageUrl,
      metrics: {
        latencyMs: 1400,
        tensorOperations: '42.8 TFLOPS',
        convergenceRate: '99.98%',
      },
    });
  } catch (error: any) {
    broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'synthesis', state: 'idle' });
    res.status(500).json({ error: error.message || 'Inference execution failed' });
  }
});

// 2. AESTHETIC MODIFICATION (Style steering & latent tensor transforms)
app.post('/api/inference/aesthetic', async (req, res) => {
  const { style = 'Obsidian Chrome', intensity = 0.85, prompt = 'Cybernetic geometry' } = req.body;

  broadcast({
    type: 'INFERENCE_STATE_CHANGE',
    module: 'aesthetic',
    state: 'generating',
    style,
    intensity,
  });

  await new Promise((r) => setTimeout(r, 600));

  broadcast({
    type: 'INFERENCE_STATE_CHANGE',
    module: 'aesthetic',
    state: 'resolved',
    style,
    intensity,
  });

  res.json({
    success: true,
    style,
    intensity,
    shiftedEigenvalues: [0.942, 0.412, -0.381, 0.772],
    spectralShift: `${(intensity * 100).toFixed(1)}% chromatic displacement`,
  });
});

// 3. SEMANTIC ENGINE (Embedding space & vector distance calculation)
app.post('/api/inference/semantic', async (req, res) => {
  const { query = 'Synthetic Intelligence Consciousness' } = req.body;

  broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'semantic', state: 'processing', query });

  let embeddingVector: number[] = [];

  if (openaiClient) {
    try {
      const embRes = await openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });
      embeddingVector = embRes.data[0].embedding.slice(0, 16);
    } catch (e) {
      // Fallback procedural embedding
      embeddingVector = Array.from({ length: 16 }, () => Number((Math.random() * 2 - 1).toFixed(4)));
    }
  } else {
    embeddingVector = Array.from({ length: 16 }, () => Number((Math.random() * 2 - 1).toFixed(4)));
  }

  broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'semantic', state: 'resolved', query });

  res.json({
    success: true,
    query,
    vectorSample: embeddingVector,
    cosineProximity: Number((0.85 + Math.random() * 0.14).toFixed(4)),
    clusterCategory: 'HIGH_DIMENSIONAL_COGNITION',
  });
});

// 4. TEMPORAL PROCESSING (Sequence forecasting)
app.post('/api/inference/temporal', async (req, res) => {
  const { horizon = 12 } = req.body;

  broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'temporal', state: 'processing' });
  await new Promise((r) => setTimeout(r, 450));
  broadcast({ type: 'INFERENCE_STATE_CHANGE', module: 'temporal', state: 'resolved' });

  const trajectory = Array.from({ length: horizon }, (_, i) => ({
    frame: i + 1,
    probability: Number((Math.sin(i * 0.5) * 0.4 + 0.6).toFixed(3)),
    entropyDelta: Number((Math.cos(i * 0.4) * 0.2).toFixed(3)),
  }));

  res.json({
    success: true,
    horizon,
    trajectory,
  });
});

server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[NEURAL ENGINE SERVER] ⚠️ Port ${PORT} is already in use by an existing process. Stop the previous instance or change the port.`);
  } else {
    console.error('[NEURAL ENGINE SERVER] Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`[NEURAL ENGINE SERVER] 🚀 Live at http://localhost:${PORT}`);
  console.log(`[NEURAL ENGINE SERVER] ⚡ Telemetry WebSocket ready at ws://localhost:${PORT}/ws/telemetry`);
});
