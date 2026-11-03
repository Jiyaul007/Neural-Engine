import { create } from 'zustand';
import { SCROLL_PHASES } from './constants';
import { neuralAudio } from '../audio/NeuralAudio';
import { euclideanSequencer } from '../audio/EuclideanSequencer';

export interface HardwareTelemetry {
  cpuUsage: number;
  memoryUsedMB: number;
  memoryPercent: number;
  activeNodes: number;
  gflops: number;
  online: boolean;
}

export type ManifoldMode = 'core' | 'torus' | 'helix' | 'lattice' | 'singularity';

export interface ShockwaveState {
  x: number;
  y: number;
  time: number;
  strength: number;
}

export interface SystemState {
  time: number;
  deltaTime: number;
  
  pointer: { x: number; y: number; nx: number; ny: number; vx: number; vy: number; speed: number };
  shockwave: ShockwaveState;
  
  scroll: { progress: number; velocity: number; phase: string; phaseProgress: number };
  
  inference: 'boot' | 'idle' | 'processing' | 'generating' | 'resolved';
  
  activeFeature: string | null;
  hoveredFeature: string | null;
  activeModal: string | null;
  
  // Advanced Manifold & Spatial Controls
  manifoldMode: ManifoldMode;
  cameraMode: 'cinematic' | 'orbit';
  audioEnabled: boolean;
  
  serverLoad: number;
  gpuBackend: 'webgpu' | 'webgl2' | 'checking';
  particleCount: number;
  bootComplete: boolean;
  
  telemetry: HardwareTelemetry;
  lastInferenceResult: any;

  setPointer: (x: number, y: number, nx: number, ny: number, vx: number, vy: number, speed: number) => void;
  triggerShockwave: (x?: number, y?: number, strength?: number) => void;
  setScroll: (progress: number, velocity: number) => void;
  setInference: (state: SystemState['inference']) => void;
  setActiveFeature: (feature: string | null) => void;
  setHoveredFeature: (feature: string | null) => void;
  setActiveModal: (modal: string | null) => void;
  setManifoldMode: (mode: ManifoldMode) => void;
  setCameraMode: (mode: 'cinematic' | 'orbit') => void;
  toggleAudio: () => boolean;
  setGpuBackend: (backend: 'webgpu' | 'webgl2') => void;
  setBootComplete: (complete: boolean) => void;
  setTelemetry: (data: Partial<HardwareTelemetry>) => void;
  setLastInferenceResult: (res: any) => void;
  tick: (time: number, delta: number) => void;
}

export const useSystemState = create<SystemState>((set, get) => ({
  time: 0,
  deltaTime: 0,
  
  pointer: { x: 0, y: 0, nx: 0, ny: 0, vx: 0, vy: 0, speed: 0 },
  shockwave: { x: 0, y: 0, time: -10, strength: 0 },
  
  scroll: { progress: 0, velocity: 0, phase: 'INITIALIZATION', phaseProgress: 0 },
  
  inference: 'boot',
  
  activeFeature: null,
  hoveredFeature: null,
  activeModal: null,

  manifoldMode: 'core',
  cameraMode: 'cinematic',
  audioEnabled: false,
  
  serverLoad: 0,
  gpuBackend: 'checking',
  particleCount: 100000,
  bootComplete: false,

  telemetry: {
    cpuUsage: 12,
    memoryUsedMB: 1024,
    memoryPercent: 32,
    activeNodes: 1,
    gflops: 4800,
    online: false,
  },
  lastInferenceResult: null,
  
  setPointer: (x, y, nx, ny, vx, vy, speed) => set({ pointer: { x, y, nx, ny, vx, vy, speed } }),
  triggerShockwave: (x = 0, y = 0, strength = 1.0) => {
    set({ shockwave: { x, y, time: performance.now() / 1000, strength } });
    neuralAudio.playQuantumImpact();
  },
  
  setScroll: (progress, velocity) => {
    let currentPhase = SCROLL_PHASES.INITIALIZATION;
    for (const key of Object.keys(SCROLL_PHASES)) {
      const phase = SCROLL_PHASES[key as keyof typeof SCROLL_PHASES];
      if (progress >= phase.start && progress <= phase.end) {
        currentPhase = phase;
        break;
      }
    }
    
    let phaseProgress = 0;
    if (currentPhase.end > currentPhase.start) {
      phaseProgress = (progress - currentPhase.start) / (currentPhase.end - currentPhase.start);
    } else {
      phaseProgress = 1;
    }

    set({ 
      scroll: { 
        progress, 
        velocity, 
        phase: currentPhase.name, 
        phaseProgress 
      } 
    });

    neuralAudio.updateLoad(get().serverLoad, velocity);
    euclideanSequencer.setScrollProgress(progress);
  },
  
  setInference: (state) => {
    set({ inference: state });
    euclideanSequencer.setInferenceState(state);
    if (state === 'generating') {
      neuralAudio.playTokenPulse();
    }
  },
  setActiveFeature: (feature) => set({ activeFeature: feature }),
  setHoveredFeature: (feature) => {
    set({ hoveredFeature: feature });
    if (feature) {
      neuralAudio.playChirp(720, 0.06);
    }
  },
  setActiveModal: (modal) => {
    set({ activeModal: modal });
    if (modal) {
      neuralAudio.playChirp(1040, 0.1);
    }
  },

  setManifoldMode: (mode) => {
    set({ manifoldMode: mode });
    neuralAudio.playChirp(640, 0.12);
    euclideanSequencer.setManifoldMode(mode);
  },

  setCameraMode: (mode) => {
    set({ cameraMode: mode });
    neuralAudio.playChirp(520, 0.1);
  },

  toggleAudio: () => {
    const newState = neuralAudio.toggle();
    if (newState) {
      euclideanSequencer.start();
    } else {
      euclideanSequencer.stop();
    }
    set({ audioEnabled: newState });
    return newState;
  },

  setGpuBackend: (backend) => set({ gpuBackend: backend }),
  setBootComplete: (complete) => set({ bootComplete: complete }),
  
  setTelemetry: (data) => set((s) => ({ telemetry: { ...s.telemetry, ...data } })),
  setLastInferenceResult: (res) => set({ lastInferenceResult: res }),
  
  tick: (time, delta) => set((state) => {
    const load = state.telemetry.online ? state.telemetry.cpuUsage : 50 + Math.sin(time * 0.002) * 20 + Math.sin(time * 0.005) * 10;
    return {
      time,
      deltaTime: delta,
      serverLoad: load,
    };
  })
}));
