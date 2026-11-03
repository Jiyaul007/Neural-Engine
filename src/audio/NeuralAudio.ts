// ── Procedural Web Audio API Neural Synthesizer ──
// Zero external audio files — 100% generated in real-time by math & oscillators.

class NeuralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private isMuted: boolean = true;
  private initialized: boolean = false;

  public init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // ── Sub-bass generative ambient drone ──
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
      this.droneFilter.connect(this.masterGain);

      // Low harmonic fundamental (55 Hz - A1)
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc1.type = 'sine';
      this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime);
      this.droneOsc1.connect(this.droneFilter);
      this.droneOsc1.start();

      // Detuned fifth (82.4 Hz - E2) for dark spatial tension
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneOsc2.type = 'sawtooth';
      this.droneOsc2.frequency.setValueAtTime(82.4, this.ctx.currentTime);
      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.droneOsc2.connect(osc2Gain);
      osc2Gain.connect(this.droneFilter);
      this.droneOsc2.start();

      this.initialized = true;
    } catch (e) {
      console.warn('[AUDIO] Web Audio Context failed to start:', e);
    }
  }

  public toggle(enable?: boolean): boolean {
    if (!this.initialized) this.init();
    if (!this.ctx || !this.masterGain) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = enable !== undefined ? !enable : !this.isMuted;

    const targetGain = this.isMuted ? 0 : 0.35;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    return !this.isMuted;
  }

  public getIsEnabled(): boolean {
    return !this.isMuted;
  }

  // Update drone harmonic filter based on scroll / server load
  public updateLoad(load: number, scrollVelocity: number) {
    if (!this.ctx || !this.droneFilter || this.isMuted) return;
    const baseFreq = 120 + load * 2.5 + Math.abs(scrollVelocity) * 200;
    this.droneFilter.frequency.setTargetAtTime(Math.min(baseFreq, 1200), this.ctx.currentTime, 0.2);
  }

  // High-tech holographic data chirp
  public playChirp(freq: number = 880, duration: number = 0.08) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.8, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  // Cinematic Sub-bass Impact / Shatter detonation
  public playShatterBoom() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, this.ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.3);
    } catch (e) {}
  }

  // Rapid generative token / matrix stream sound
  public playTokenPulse() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const notes = [440, 554.37, 659.25, 830.61, 987.77];
      const pitch = notes[Math.floor(Math.random() * notes.length)];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {}
  }

  // Deep physical quantum shockwave impact on user click
  public playQuantumImpact() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      // Sub-harmonic resonant body
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.5);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.6);

      // Glassy crystalline air transient
      const airOsc = this.ctx.createOscillator();
      const airGain = this.ctx.createGain();
      airOsc.type = 'triangle';
      airOsc.frequency.setValueAtTime(1450, now);
      airOsc.frequency.exponentialRampToValueAtTime(3200, now + 0.08);

      airGain.gain.setValueAtTime(0.08, now);
      airGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      airOsc.connect(airGain);
      airGain.connect(this.masterGain);

      airOsc.start(now);
      airOsc.stop(now + 0.12);
    } catch (e) {}
  }
}

export const neuralAudio = new NeuralAudioEngine();
