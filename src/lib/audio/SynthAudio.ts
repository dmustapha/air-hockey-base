/**
 * SynthAudio - Synthesized arcade sounds using Web Audio API
 * No external files needed - generates all sounds programmatically
 *
 * "Neon Voltage" - Electric cyber sports aesthetic
 */

class SynthAudio {
  private static instance: SynthAudio;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private initialized = false;
  private muted = false;

  // Volume levels (0-1)
  private masterVolume = 0.8;
  private sfxVolume = 1.0;
  private musicVolume = 0.5;

  private constructor() {}

  static getInstance(): SynthAudio {
    if (!SynthAudio.instance) {
      SynthAudio.instance = new SynthAudio();
    }
    return SynthAudio.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.initialized = true;
  }

  async unlock(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private getMasterGain(): GainNode {
    if (!this.masterGain) {
      this.getContext();
    }
    return this.masterGain!;
  }

  // ═══════════════════════════════════════════════════════════
  // VOLUME CONTROL
  // ═══════════════════════════════════════════════════════════

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    }
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.masterVolume;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  // ═══════════════════════════════════════════════════════════
  // SOUND SYNTHESIS HELPERS
  // ═══════════════════════════════════════════════════════════

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'square',
    volume: number = 0.3,
    attack: number = 0.01,
    decay: number = 0.1
  ): void {
    if (this.muted) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    // ADSR envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * this.sfxVolume, now + attack);
    gain.gain.linearRampToValueAtTime(volume * this.sfxVolume * 0.7, now + attack + decay);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(gain);
    gain.connect(this.getMasterGain());

    osc.start(now);
    osc.stop(now + duration);
  }

  private playNoise(
    duration: number,
    volume: number = 0.2,
    filterFreq: number = 2000
  ): void {
    if (this.muted) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Create white noise
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * this.sfxVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterGain());

    noise.start(now);
  }

  // ═══════════════════════════════════════════════════════════
  // PADDLE HIT SOUNDS (5 intensity levels)
  // ═══════════════════════════════════════════════════════════

  playHit(velocity: number): void {
    // Map velocity to intensity 0-4
    let intensity: number;
    if (velocity < 3) intensity = 0;
    else if (velocity < 8) intensity = 1;
    else if (velocity < 15) intensity = 2;
    else if (velocity < 25) intensity = 3;
    else intensity = 4;

    const baseFreq = 200 + intensity * 100;
    const volume = 0.2 + intensity * 0.15;
    const duration = 0.08 + intensity * 0.04;

    // Main impact tone
    this.playTone(baseFreq, duration, 'square', volume, 0.005, 0.02);

    // High click
    this.playTone(baseFreq * 4, 0.03, 'sine', volume * 0.5, 0.001, 0.01);

    // Add noise for heavier hits
    if (intensity >= 2) {
      this.playNoise(duration * 0.5, volume * 0.3, 3000 + intensity * 500);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // WALL BOUNCE
  // ═══════════════════════════════════════════════════════════

  playWallBounce(): void {
    // Metallic ping
    this.playTone(800, 0.08, 'sine', 0.15, 0.001, 0.02);
    this.playTone(1200, 0.05, 'sine', 0.1, 0.001, 0.01);
  }

  // ═══════════════════════════════════════════════════════════
  // GOAL SOUNDS
  // ═══════════════════════════════════════════════════════════

  playGoal(isPlayer: boolean): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    if (isPlayer) {
      // Victory fanfare - ascending arpeggio
      const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        setTimeout(() => {
          this.playTone(freq, 0.3, 'square', 0.25, 0.01, 0.05);
          this.playTone(freq * 2, 0.2, 'sine', 0.15, 0.01, 0.03);
        }, i * 80);
      });

      // Bass hit
      this.playTone(130, 0.4, 'sine', 0.4, 0.01, 0.1);
    } else {
      // Opponent scored - descending tone
      this.playTone(400, 0.3, 'sawtooth', 0.2, 0.01, 0.1);
      setTimeout(() => this.playTone(300, 0.3, 'sawtooth', 0.15, 0.01, 0.1), 100);
      setTimeout(() => this.playTone(200, 0.4, 'sawtooth', 0.1, 0.01, 0.15), 200);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // COUNTDOWN
  // ═══════════════════════════════════════════════════════════

  playCountdownBeep(): void {
    this.playTone(880, 0.1, 'square', 0.3, 0.005, 0.02);
  }

  playCountdownGo(): void {
    // "GO!" - rising sweep + chord
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);

    gain.gain.setValueAtTime(0.4 * this.sfxVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);

    osc.connect(gain);
    gain.connect(this.getMasterGain());

    osc.start(now);
    osc.stop(now + 0.3);

    // Chord stab
    [523, 659, 784].forEach(freq => {
      this.playTone(freq, 0.25, 'square', 0.2, 0.01, 0.05);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // MATCH EVENTS
  // ═══════════════════════════════════════════════════════════

  playMatchPoint(): void {
    // Warning pulse
    this.playTone(440, 0.15, 'square', 0.25, 0.01, 0.03);
    setTimeout(() => this.playTone(440, 0.15, 'square', 0.25, 0.01, 0.03), 200);
    setTimeout(() => this.playTone(660, 0.2, 'square', 0.3, 0.01, 0.05), 400);
  }

  playMatchEnd(): void {
    // Final horn
    this.playTone(220, 0.5, 'sawtooth', 0.3, 0.02, 0.1);
    this.playTone(277, 0.5, 'sawtooth', 0.25, 0.02, 0.1);
    this.playTone(330, 0.5, 'sawtooth', 0.2, 0.02, 0.1);
  }

  playVictory(): void {
    // Triumphant fanfare
    const melody = [
      { freq: 523, delay: 0 },
      { freq: 659, delay: 150 },
      { freq: 784, delay: 300 },
      { freq: 1047, delay: 450 },
      { freq: 784, delay: 600 },
      { freq: 1047, delay: 750 },
    ];

    melody.forEach(({ freq, delay }) => {
      setTimeout(() => {
        this.playTone(freq, 0.25, 'square', 0.25, 0.01, 0.05);
        this.playTone(freq / 2, 0.3, 'sine', 0.2, 0.01, 0.08);
      }, delay);
    });
  }

  playDefeat(): void {
    // Sad descending tones
    const notes = [392, 349, 330, 262]; // G4, F4, E4, C4
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.35, 'triangle', 0.2, 0.02, 0.1);
      }, i * 200);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UI SOUNDS
  // ═══════════════════════════════════════════════════════════

  playClick(): void {
    this.playTone(1000, 0.05, 'square', 0.2, 0.001, 0.01);
    this.playTone(1500, 0.03, 'sine', 0.1, 0.001, 0.005);
  }

  playHover(): void {
    this.playTone(2000, 0.03, 'sine', 0.08, 0.001, 0.01);
  }

  playBack(): void {
    this.playTone(800, 0.06, 'square', 0.15, 0.001, 0.02);
    this.playTone(600, 0.08, 'square', 0.12, 0.001, 0.02);
  }

  playToggle(isOn: boolean): void {
    if (isOn) {
      this.playTone(880, 0.05, 'sine', 0.2, 0.001, 0.01);
      setTimeout(() => this.playTone(1320, 0.05, 'sine', 0.15, 0.001, 0.01), 30);
    } else {
      this.playTone(1320, 0.05, 'sine', 0.15, 0.001, 0.01);
      setTimeout(() => this.playTone(880, 0.05, 'sine', 0.2, 0.001, 0.01), 30);
    }
  }

  playError(): void {
    this.playTone(200, 0.15, 'sawtooth', 0.25, 0.005, 0.03);
    setTimeout(() => this.playTone(150, 0.2, 'sawtooth', 0.2, 0.005, 0.05), 100);
  }

  playPanelOpen(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(0.15 * this.sfxVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);

    osc.connect(gain);
    gain.connect(this.getMasterGain());

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPanelClose(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);

    gain.gain.setValueAtTime(0.12 * this.sfxVolume, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);

    osc.connect(gain);
    gain.connect(this.getMasterGain());

    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.initialized = false;
    }
  }
}

export default SynthAudio;
