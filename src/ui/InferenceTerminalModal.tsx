import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemState } from '../engine/SystemState';
import { useNeuralSocket } from '../engine/useNeuralSocket';
import { neuralAudio } from '../audio/NeuralAudio';

const MODULES = [
  { id: 'synthesis', name: 'NEURAL SYNTHESIS', color: '#00f0ff', desc: 'Latent Manifold Denoising' },
  { id: 'aesthetic', name: 'AESTHETIC MOD', color: '#ff3366', desc: 'Spectral Style Steering' },
  { id: 'semantic', name: 'SEMANTIC ENGINE', color: '#aa66ff', desc: 'High-Dimensional Embedding Proximity' },
  { id: 'temporal', name: 'TEMPORAL PROCESSING', color: '#ffaa00', desc: 'Sequential Autoregressive Rollout' },
];

export const InferenceTerminalModal: React.FC = () => {
  const activeModal = useSystemState((s) => s.activeModal);
  const setActiveModal = useSystemState((s) => s.setActiveModal);
  const inference = useSystemState((s) => s.inference);
  const telemetry = useSystemState((s) => s.telemetry);
  const { dispatchInference } = useNeuralSocket();

  const [selectedModule, setSelectedModule] = useState(activeModal || 'synthesis');
  const [prompt, setPrompt] = useState('Superluminal tensor singularity collapsing into obsidian consciousness');
  const [steps, setSteps] = useState(25);
  const [intensity, setIntensity] = useState(0.85);
  const [isRunning, setIsRunning] = useState(false);
  const [activeHead, setActiveHead] = useState<number | null>(null);

  // 8x8 Attention Matrix State
  const [attentionWeights, setAttentionWeights] = useState<number[][]>(() =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.random() * 0.8 + 0.1))
  );

  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '[SYS.READY] Neural compute node linked to cluster.',
    '[TELEMETRY] WebSocket streaming at 500ms epoch intervals.',
    '[ATTENTION] 8-Head Multi-Head QKV Matrix online.',
  ]);
  const [lastOutput, setLastOutput] = useState<any>(null);

  // Continuous subtle attention weight pulsing
  useEffect(() => {
    const interval = setInterval(() => {
      setAttentionWeights((prev) =>
        prev.map((row) =>
          row.map((val) => {
            const delta = (Math.random() - 0.5) * (isRunning ? 0.4 : 0.08);
            return Math.min(1, Math.max(0.05, val + delta));
          })
        )
      );
    }, 180);
    return () => clearInterval(interval);
  }, [isRunning]);

  if (!activeModal) return null;

  const currentModule = MODULES.find((m) => m.id === selectedModule) || MODULES[0];

  const handleRunInference = async () => {
    setIsRunning(true);
    neuralAudio.playChirp(880, 0.15);
    setConsoleLogs((prev) => [
      ...prev,
      `[DISPATCH] Executing ${currentModule.name} across ${telemetry.activeNodes} nodes...`,
    ]);

    let payload: any = {};
    if (selectedModule === 'synthesis') {
      payload = { prompt, steps, seed: Math.floor(Math.random() * 999999) };
    } else if (selectedModule === 'aesthetic') {
      payload = { style: 'Obsidian Liquid Chrome', intensity, prompt };
    } else if (selectedModule === 'semantic') {
      payload = { query: prompt };
    } else if (selectedModule === 'temporal') {
      payload = { horizon: 16 };
    }

    const result = await dispatchInference(selectedModule, payload);
    setIsRunning(false);
    setLastOutput(result);

    if (result.success) {
      neuralAudio.playChirp(1200, 0.2);
      setConsoleLogs((prev) => [
        ...prev,
        `[SUCCESS] Compute converged with 0.0024 variance tolerance.`,
        result.textDescription ? `[OUTPUT] "${result.textDescription}"` : '',
        result.cosineProximity ? `[PROXIMITY] Cosine similarity: ${result.cosineProximity}` : '',
        result.spectralShift ? `[SHIFT] ${result.spectralShift}` : '',
      ].filter(Boolean));
    } else {
      setConsoleLogs((prev) => [...prev, `[FAIL] ${result.error || 'Execution failed'}`]);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-8 pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/85 backdrop-blur-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setActiveModal(null)}
        />

        {/* Modal Window */}
        <motion.div
          className="relative w-full max-w-5xl bg-black border border-white/20 rounded-xl shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col z-10"
          style={{ maxHeight: '90vh' }}
          initial={{ scale: 0.94, opacity: 0, y: 25 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 25 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: currentModule.color }} />
              <span className="font-mono text-xs uppercase tracking-widest text-white/90 font-bold">
                NEURAL COMPUTING ENGINE // SPATIAL DISPATCH TERMINAL
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] text-white/40">
                PIPELINE STATE: <span className="font-bold" style={{ color: currentModule.color }}>{inference.toUpperCase()}</span>
              </span>
              <button
                onClick={() => setActiveModal(null)}
                className="text-white/40 hover:text-white font-mono text-xs px-2.5 py-1 border border-white/15 hover:border-white/40 rounded transition-colors"
              >
                ESC ✕
              </button>
            </div>
          </div>

          {/* Module Selector Tabs */}
          <div className="flex border-b border-white/10 bg-black/60 overflow-x-auto no-scrollbar">
            {MODULES.map((m) => {
              const active = m.id === selectedModule;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModule(m.id);
                    neuralAudio.playChirp(600, 0.05);
                  }}
                  className={`px-5 py-3 font-mono text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 border-b-2 ${
                    active
                      ? 'border-cyan-400 text-white bg-white/[0.05]'
                      : 'border-transparent text-white/40 hover:text-white/80'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.name}
                </button>
              );
            })}
          </div>

          {/* Body Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 gap-6 overflow-y-auto">
            {/* Left Column: Interactive Inputs & Multi-Head Attention Tensor */}
            <div className="flex flex-col gap-5">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-white/50 mb-2">
                  // PROMPT TENSOR SPECIFICATION
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-white/[0.03] border border-white/15 focus:border-cyan-400/80 rounded-lg p-3 text-xs text-white font-mono outline-none transition-colors resize-none placeholder-white/20"
                  placeholder="Enter neural prompt..."
                />
              </div>

              {selectedModule === 'synthesis' && (
                <div>
                  <div className="flex justify-between font-mono text-[10px] text-white/50 mb-1">
                    <span>DENOISING STEPS</span>
                    <span className="text-cyan-400 font-bold">{steps} STEPS</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              )}

              {selectedModule === 'aesthetic' && (
                <div>
                  <div className="flex justify-between font-mono text-[10px] text-white/50 mb-1">
                    <span>STYLE STEERING INTENSITY</span>
                    <span className="text-pink-400 font-bold">{Math.round(intensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="w-full accent-pink-400 cursor-pointer"
                  />
                </div>
              )}

              {/* 8-Head Multi-Head Attention Matrix Inspector */}
              <div className="p-3 bg-white/[0.02] border border-white/10 rounded-lg">
                <div className="flex justify-between items-center mb-2 font-mono text-[10px] text-white/60">
                  <span>8-HEAD ATTENTION MATRIX (QKV)</span>
                  <span className="text-cyan-400 text-[9px]">{activeHead !== null ? `HEAD #${activeHead + 1} ACTIVE` : 'HOVER HEAD TO FOCUS'}</span>
                </div>
                <div className="grid grid-cols-8 gap-1 aspect-[2/1] w-full">
                  {attentionWeights.map((row, r) =>
                    row.map((val, c) => (
                      <div
                        key={`${r}-${c}`}
                        onMouseEnter={() => {
                          setActiveHead(r);
                          neuralAudio.playChirp(400 + val * 600, 0.03);
                        }}
                        onMouseLeave={() => setActiveHead(null)}
                        className="rounded-sm transition-all duration-150 cursor-crosshair"
                        style={{
                          backgroundColor: currentModule.color,
                          opacity: activeHead === r ? Math.min(1, val + 0.3) : val * 0.7,
                          transform: activeHead === r ? 'scale(1.15)' : 'scale(1)',
                        }}
                        title={`Head ${r + 1}, Key ${c + 1}: ${val.toFixed(3)}`}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Hardware telemetry readout */}
              <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-lg font-mono text-[10px] space-y-1 text-white/60">
                <div className="flex justify-between">
                  <span>TELEMETRY LINK:</span>
                  <span className={telemetry.online ? 'text-green-400 font-bold' : 'text-cyan-400'}>
                    {telemetry.online ? 'LIVE WS' : 'CLIENT SYNTHETIC'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SYSTEM LOAD:</span>
                  <span className="text-white">{telemetry.cpuUsage}% CPU</span>
                </div>
                <div className="flex justify-between">
                  <span>HOST MEMORY:</span>
                  <span className="text-white">{telemetry.memoryUsedMB} MB ({telemetry.memoryPercent}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>TENSOR THROUGHPUT:</span>
                  <span className="text-cyan-400">{telemetry.gflops.toLocaleString()} GFLOPS</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                onClick={handleRunInference}
                disabled={isRunning}
                className="w-full py-3.5 rounded-lg font-mono text-xs uppercase tracking-widest font-bold text-black transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer shadow-lg hover:shadow-cyan-500/20"
                style={{
                  backgroundColor: currentModule.color,
                }}
              >
                {isRunning ? 'EXECUTING MANIFOLD INFERENCE...' : `DISPATCH ${currentModule.name}`}
              </button>
            </div>

            {/* Right Column: Real-time Terminal Log & Output */}
            <div className="flex flex-col h-full min-h-[320px] bg-black/90 border border-white/10 rounded-lg p-4 font-mono text-xs overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-white/40 text-[10px]">
                <span>STREAM LOG</span>
                <span>TTY_01 // 60FPS</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 text-white/70 font-mono text-[11px] pr-2 no-scrollbar">
                {consoleLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`leading-relaxed ${
                      log.startsWith('[SUCCESS]')
                        ? 'text-green-400 font-bold'
                        : log.startsWith('[DISPATCH]')
                        ? 'text-cyan-400 font-bold'
                        : log.startsWith('[OUTPUT]')
                        ? 'text-white bg-white/5 p-2 rounded border border-white/10'
                        : 'text-white/50'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>

              {/* Visualized Output Banner */}
              {lastOutput && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-[10px] text-white/40 mb-1">CONVERGED TENSOR ARTIFACT:</div>
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/40 rounded text-cyan-300 text-xs leading-relaxed font-mono">
                    {lastOutput.textDescription || `Vector similarity: ${lastOutput.cosineProximity} | Loss: 0.0024`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
