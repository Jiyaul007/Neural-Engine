import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSystemState, ManifoldMode } from '../engine/SystemState';
import { useMLServer } from '../engine/useMLServer';

export const MicroDataUI: React.FC = () => {
  const scrollProgress = useSystemState((s) => s.scroll.progress);
  const scrollPhase = useSystemState((s) => s.scroll.phase);
  const inference = useSystemState((s) => s.inference);
  const gpuBackend = useSystemState((s) => s.gpuBackend);
  const particleCount = useSystemState((s) => s.particleCount);
  const telemetry = useSystemState((s) => s.telemetry);
  const setActiveModal = useSystemState((s) => s.setActiveModal);
  
  const manifoldMode = useSystemState((s) => s.manifoldMode);
  const setManifoldMode = useSystemState((s) => s.setManifoldMode);
  const cameraMode = useSystemState((s) => s.cameraMode);
  const setCameraMode = useSystemState((s) => s.setCameraMode);
  const audioEnabled = useSystemState((s) => s.audioEnabled);
  const toggleAudio = useSystemState((s) => s.toggleAudio);

  const { status: mlStatus } = useMLServer();
  const [fps, setFps] = useState(60);

  // FPS calculation loop
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let handle: number;

    const tick = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      handle = requestAnimationFrame(tick);
    };

    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, []);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '1') setManifoldMode('core');
      else if (e.key === '2') setManifoldMode('torus');
      else if (e.key === '3') setManifoldMode('helix');
      else if (e.key === '4') setManifoldMode('lattice');
      else if (e.key === '5') setManifoldMode('singularity');
      else if (e.key.toLowerCase() === 'c') setCameraMode(cameraMode === 'cinematic' ? 'orbit' : 'cinematic');
      else if (e.key.toLowerCase() === 'm') toggleAudio();
      else if (e.key.toLowerCase() === 't') setActiveModal('synthesis');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode, setCameraMode, setManifoldMode, toggleAudio, setActiveModal]);

  const MANIFOLDS: { id: ManifoldMode; label: string; key: string }[] = [
    { id: 'core', label: 'CORE', key: '1' },
    { id: 'torus', label: 'TORUS', key: '2' },
    { id: 'helix', label: 'HELIX', key: '3' },
    { id: 'lattice', label: 'LATTICE', key: '4' },
    { id: 'singularity', label: 'SINGULARITY', key: '5' },
  ];

  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-20 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.12em] p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: inference !== 'boot' ? 1 : 0 }}
      transition={{ duration: 1.2, delay: 0.3 }}
      style={{ color: '#888' }}
    >
      {/* Top Left: Coordinates & Server Connection */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 flex flex-col gap-0.5 pointer-events-auto">
        <span className="text-white/90 font-bold tracking-widest">[0x00A1] NEURAL ENGINE // CORE</span>
        <span>GEO: 47.3812°N 122.3215°W</span>
        <span className="flex items-center gap-2 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${telemetry.online ? 'bg-green-400 animate-ping' : 'bg-cyan-400'}`} />
          <span className={telemetry.online ? 'text-green-400 font-bold' : 'text-cyan-400'}>
            SERVER: {telemetry.online ? 'WS TELEMETRY LIVE' : 'CLIENT SYNTHETIC'}
          </span>
        </span>
      </div>

      {/* Top Right: System State, Audio Toggle, and Terminal Dispatch */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="text-right">
          <span className="text-white/50 text-[9px]">SYSTEM STATE: </span>
          <span className="font-bold tracking-widest text-xs" style={{ color: inference === 'idle' ? '#00f0ff' : '#ffaa00' }}>
            {inference.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Synthesizer Toggle */}
          <button
            onClick={toggleAudio}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border transition-all cursor-pointer flex items-center gap-1.5 ${
              audioEnabled
                ? 'bg-cyan-950/40 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-white/5 border-white/15 text-white/40 hover:text-white/70'
            }`}
            title="Toggle procedural neural soundscape (M)"
          >
            <span>{audioEnabled ? '🔊 AUDIO ON' : '🔈 AUDIO OFF'}</span>
            <span className="text-[8px] text-white/30">[M]</span>
          </button>

          {/* Camera Mode Toggle */}
          <button
            onClick={() => setCameraMode(cameraMode === 'cinematic' ? 'orbit' : 'cinematic')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-widest border transition-all cursor-pointer flex items-center gap-1.5 ${
              cameraMode === 'orbit'
                ? 'bg-amber-950/40 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(255,170,0,0.2)]'
                : 'bg-white/5 border-white/15 text-white/40 hover:text-white/70'
            }`}
            title="Toggle Free 3D Orbit Inspection (C)"
          >
            <span>{cameraMode === 'orbit' ? '🪐 FREE ORBIT' : '🎥 SCROLL CAM'}</span>
            <span className="text-[8px] text-white/30">[C]</span>
          </button>

          {/* Open Terminal */}
          <button
            onClick={() => setActiveModal('synthesis')}
            className="px-3 py-1 bg-cyan-500/10 hover:bg-cyan-400 hover:text-black border border-cyan-400/50 rounded text-[9px] text-cyan-300 font-bold tracking-widest transition-all cursor-pointer shadow-md"
            title="Open Neural Terminal (T)"
          >
            TERMINAL [T]
          </button>
        </div>
      </div>

      {/* Top Center: Manifold Geometry Morphing Selector */}
      <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-1 bg-black/60 backdrop-blur-md px-3 py-1.5 border border-white/10 rounded-full pointer-events-auto">
        <span className="text-[8px] text-white/40 mr-1.5 tracking-wider">MANIFOLD:</span>
        {MANIFOLDS.map((m) => {
          const isActive = manifoldMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setManifoldMode(m.id)}
              className={`px-2 py-0.5 rounded-full text-[8px] tracking-wider font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isActive
                  ? 'bg-cyan-400 text-black shadow-[0_0_8px_rgba(0,240,255,0.4)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{m.label}</span>
              <span className={isActive ? 'text-black/60' : 'text-white/20'}>[{m.key}]</span>
            </button>
          );
        })}
      </div>

      {/* Bottom Left: Real Hardware & GPU Telemetry + ML Server Status */}
      <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6 flex flex-col gap-0.5 pointer-events-auto">
        <span className="text-white/70 font-semibold">
          GPU: {gpuBackend.toUpperCase()} | FPS: {fps}
        </span>
        <span>
          HOST CPU: {telemetry.cpuUsage}% | RAM: {telemetry.memoryUsedMB}MB ({telemetry.memoryPercent}%)
        </span>
        <span>
          COMPUTE: {telemetry.gflops.toLocaleString()} GFLOPS | SWARM: {particleCount.toLocaleString()} PTS
        </span>
        {/* ML Server Status */}
        {mlStatus.connected ? (
          <span style={{ color: '#33ff99' }}>
            ML.SERVER: ONLINE | LATENCY: {mlStatus.latency}ms
          </span>
        ) : (
          <motion.span
            style={{ color: '#ff4444' }}
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            ML.SERVER: OFFLINE
          </motion.span>
        )}
      </div>

      {/* Bottom Right: Scroll Telemetry & Phase Indicator */}
      <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col gap-0.5 text-right pointer-events-auto">
        <span>PIPELINE PROGRESS</span>
        <span className="text-white font-bold text-xs tracking-wider">
          {(scrollProgress * 100).toFixed(1)}%
        </span>
        <span className="text-cyan-400 font-bold">PHASE // {scrollPhase}</span>
      </div>
    </motion.div>
  );
};
