// ── Euclidean Rhythm Sequencer ──
// Polyphonic Bjorklund-algorithm sequencer driven by Neural Engine state.
// 100% Web Audio API — zero external files.

interface Track {
  steps: number;
  pulses: number;
  freq: number;
  waveform: OscillatorType;
  filterFreq: number;
  volume: number;
  swing: number;
}

const MANIFOLD_TRACKS: Record<string, Track> = {
  core:        { steps: 16, pulses: 5,  freq: 55.0,  waveform: 'sine',     filterFreq: 200, volume: 0.30, swing: 0.00 },
  torus:       { steps: 12, pulses: 4,  freq: 82.4,  waveform: 'triangle', filterFreq: 400, volume: 0.25, swing: 0.10 },
  helix:       { steps: 24, pulses: 7,  freq: 110.0, waveform: 'sawtooth', filterFreq: 800, volume: 0.20, swing: 0.15 },
  lattice:     { steps: 8,  pulses: 3,  freq: 164.8, waveform: 'square',   filterFreq: 300, volume: 0.18, swing: 0.00 },
  singularity: { steps: 32, pulses: 11, freq: 32.7,  waveform: 'sine',     filterFreq: 150, volume: 0.35, swing: 0.25 },
};

// ── Bjorklund algorithm ──
// Distributes k pulses as evenly as possible across n steps.
function euclidean(steps: number, pulses: number): boolean[] {
  if (pulses <= 0) return new Array(steps).fill(false);
  if (pulses >= steps) return new Array(steps).fill(true);

  let pattern: boolean[][] = [];
  for (let i = 0; i < steps; i++) {
    pattern.push([i < pulses]);
  }

  let remainder = steps - pulses;
  let divisor = pulses;

  while (remainder > 1) {
    const newRemainder = divisor % remainder;
    const iterations = Math.min(remainder, divisor);

    for (let i = 0; i < iterations; i++) {
      if (i < remainder) {
        pattern[i] = [...pattern[i], ...pattern[pattern.length - 1 - i]];
      }
    }

    pattern = pattern.slice(0, remainder + newRemainder);
    divisor = remainder;
    remainder = newRemainder;
  }

  return pattern.flat();
}

// ── Generate an exponentially-decaying noise impulse response for reverb ──
function makeImpulseResponse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buffer;
}

class EuclideanSequencer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  private activeTrackKey: string = 'core';
  private scrollProgress: number = 0;
  private inferenceState: string = 'idle';
  private _masterVolume: number = 0.7;

  // Sequencer state per track
  private stepIndices: Record<string, number> = {};
  private patterns: Record<string, boolean[]> = {};

  // Scheduler
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime: number = 0;
  private isRunning: boolean = false;

  // Beat scheduling lookahead (seconds)
  private readonly LOOKAHEAD = 0.1;
  // Scheduler tick interval (ms)
  private readonly TICK_INTERVAL = 25;

  constructor() {
    for (const key of Object.keys(MANIFOLD_TRACKS)) {
      this.stepIndices[key] = 0;
      const t = MANIFOLD_TRACKS[key];
      this.patterns[key] = euclidean(t.steps, t.pulses);
    }
  }

  // ── Lazy AudioContext init (must be triggered by user gesture) ──
  private ensureContext(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') return true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      this.ctx = new AudioCtx();

      // Master compressor — ratio 4:1, fast attack, moderate release
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.05, this.ctx.currentTime);

      // Master gain (post-compressor)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this._masterVolume, this.ctx.currentTime);

      // Reverb send bus
      this.reverbConvolver = this.ctx.createConvolver();
      this.reverbConvolver.buffer = makeImpulseResponse(this.ctx, 2.5, 3.0);

      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0.22, this.ctx.currentTime);

      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.setValueAtTime(0.78, this.ctx.currentTime);

      // Signal chain: notes → dry/reverb split → compressor → masterGain → destination
      this.dryGain.connect(this.compressor);
      this.reverbConvolver.connect(this.reverbGain);
      this.reverbGain.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      return true;
    } catch (e) {
      console.warn('[EUCLIDEAN] AudioContext failed:', e);
      return false;
    }
  }

  // ── Compute BPM from system state ──
  private getBPM(): number {
    const base = 60 + this.scrollProgress * 80;
    const inferenceBoost = this.inferenceState === 'generating' ? 40 : 0;
    return Math.min(180, Math.max(60, base + inferenceBoost));
  }

  // ── Seconds per beat at current BPM ──
  private getSecondsPerBeat(): number {
    return 60 / this.getBPM();
  }

  // ── Schedule a single note event for a track at a given audio time ──
  private scheduleNote(track: Track, time: number): void {
    if (!this.ctx || !this.dryGain || !this.reverbConvolver) return;

    try {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = track.waveform;
      osc.frequency.setValueAtTime(track.freq, time);
      // Slight downward pitch bend
      osc.frequency.exponentialRampToValueAtTime(track.freq * 0.98, time + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(track.filterFreq, time);
      filter.Q.setValueAtTime(1.2, time);

      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(track.volume * this._masterVolume, time + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      // Route osc → filter → gain → dry + reverb parallel send
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.dryGain);
      gainNode.connect(this.reverbConvolver);

      osc.start(time);
      osc.stop(time + 0.2);

      // Clean up nodes after they've completed
      osc.onended = () => {
        try { osc.disconnect(); } catch (_) {}
        try { filter.disconnect(); } catch (_) {}
        try { gainNode.disconnect(); } catch (_) {}
      };
    } catch (e) {
      // Silently swallow scheduling errors
    }
  }

  // ── Core lookahead scheduler ──
  private scheduler(): void {
    if (!this.ctx || !this.isRunning) return;

    const spb = this.getSecondsPerBeat();

    while (this.nextNoteTime < this.ctx.currentTime + this.LOOKAHEAD) {
      // Tick all tracks, but only audibly schedule the active one
      for (const key of Object.keys(MANIFOLD_TRACKS)) {
        const track = MANIFOLD_TRACKS[key];
        const pattern = this.patterns[key];
        const step = this.stepIndices[key] % pattern.length;
        const isPulse = pattern[step];

        if (isPulse && key === this.activeTrackKey) {
          // Apply swing: odd steps are delayed by swing fraction of beat duration
          const isOddStep = step % 2 === 1;
          const swingOffset = isOddStep ? track.swing * spb : 0;
          this.scheduleNote(track, this.nextNoteTime + swingOffset);
        }

        this.stepIndices[key] = step + 1;
      }

      this.nextNoteTime += spb;
    }
  }

  // ── Public API ──

  public start(): void {
    if (this.isRunning) return;
    if (!this.ensureContext()) return;

    if (this.ctx!.state === 'suspended') {
      this.ctx!.resume();
    }

    this.isRunning = true;
    this.nextNoteTime = this.ctx!.currentTime + 0.05;

    // Reset step counters
    for (const key of Object.keys(MANIFOLD_TRACKS)) {
      this.stepIndices[key] = 0;
    }

    this.schedulerIntervalId = setInterval(() => this.scheduler(), this.TICK_INTERVAL);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.schedulerIntervalId !== null) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
  }

  public setManifoldMode(mode: string): void {
    if (MANIFOLD_TRACKS[mode]) {
      this.activeTrackKey = mode;
      // Re-generate pattern in case it was invalidated
      const t = MANIFOLD_TRACKS[mode];
      this.patterns[mode] = euclidean(t.steps, t.pulses);
      this.stepIndices[mode] = 0;
    }
  }

  public setScrollProgress(progress: number): void {
    this.scrollProgress = Math.max(0, Math.min(1, progress));
  }

  public setInferenceState(state: string): void {
    this.inferenceState = state;
  }

  public setMasterVolume(vol: number): void {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this._masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public dispose(): void {
    this.stop();
    try { this.ctx?.close(); } catch (_) {}
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbConvolver = null;
    this.reverbGain = null;
    this.dryGain = null;
  }
}

export const euclideanSequencer = new EuclideanSequencer();
