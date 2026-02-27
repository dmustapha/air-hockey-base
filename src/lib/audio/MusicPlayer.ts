/**
 * MusicPlayer - Background music system with crossfading
 * Handles loading, playing, and transitioning between music tracks
 *
 * Tracks:
 * - menu: Ambient synthwave for menu screens
 * - gameplay: Driving competitive music
 * - overtime: Intensified high-stakes music
 * - victory: Triumphant sting (short)
 * - defeat: Reflective sting (short)
 */

export type MusicTrack = 'menu' | 'gameplay' | 'overtime' | 'victory' | 'defeat';

interface TrackConfig {
  url: string;
  loop: boolean;
  volume: number; // Relative volume for this track
}

const TRACK_CONFIGS: Record<MusicTrack, TrackConfig> = {
  menu: { url: '/audio/music/menu-theme.mp3', loop: true, volume: 1.0 },
  gameplay: { url: '/audio/music/gameplay-loop.mp3', loop: true, volume: 1.0 },
  overtime: { url: '/audio/music/overtime.mp3', loop: true, volume: 1.0 },
  victory: { url: '/audio/music/victory.mp3', loop: false, volume: 1.0 },
  defeat: { url: '/audio/music/defeat.mp3', loop: false, volume: 1.0 },
};

const CROSSFADE_DURATION = 1.5; // seconds

class MusicPlayer {
  private static instance: MusicPlayer;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private buffers: Map<MusicTrack, AudioBuffer> = new Map();
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGain: GainNode | null = null;
  private currentTrack: MusicTrack | null = null;

  private nextSource: AudioBufferSourceNode | null = null;
  private nextGain: GainNode | null = null;

  private initialized = false;
  private loading = false;
  private muted = false;
  private volume = 0.6; // 60% default music volume
  private tracksAvailable = false;

  private constructor() {}

  static getInstance(): MusicPlayer {
    if (!MusicPlayer.instance) {
      MusicPlayer.instance = new MusicPlayer();
    }
    return MusicPlayer.instance;
  }

  async init(audioContext?: AudioContext): Promise<void> {
    if (this.initialized) return;

    this.ctx = audioContext || new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.initialized = true;

    // Try to preload tracks (non-blocking)
    this.preloadTracks();
  }

  private async preloadTracks(): Promise<void> {
    if (this.loading) return;
    this.loading = true;

    const trackNames: MusicTrack[] = ['menu', 'gameplay', 'overtime', 'victory', 'defeat'];

    for (const track of trackNames) {
      try {
        await this.loadTrack(track);
      } catch {
        // Track not available - that's okay, music is optional
        console.debug(`Music track not available: ${track}`);
      }
    }

    this.tracksAvailable = this.buffers.size > 0;
    this.loading = false;
  }

  private async loadTrack(track: MusicTrack): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    if (this.buffers.has(track)) return this.buffers.get(track)!;

    const config = TRACK_CONFIGS[track];

    try {
      const response = await fetch(config.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      this.buffers.set(track, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  async play(track: MusicTrack): Promise<void> {
    if (!this.ctx || !this.masterGain || !this.initialized) return;

    // If same track already playing, do nothing
    if (this.currentTrack === track && this.currentSource) return;

    // Try to load track if not loaded
    let buffer: AudioBuffer | undefined = this.buffers.get(track);
    if (!buffer) {
      const loaded = await this.loadTrack(track);
      if (!loaded) return; // Track not available
      buffer = loaded;
    }

    const config = TRACK_CONFIGS[track];

    // If something is playing, crossfade
    if (this.currentSource && this.currentGain) {
      await this.crossfadeTo(track, buffer, config);
    } else {
      // Nothing playing, just start
      this.startTrack(track, buffer, config);
    }
  }

  private startTrack(track: MusicTrack, buffer: AudioBuffer, config: TrackConfig): void {
    if (!this.ctx || !this.masterGain) return;

    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();

    source.buffer = buffer;
    source.loop = config.loop;

    gain.gain.value = this.muted ? 0 : config.volume;

    source.connect(gain);
    gain.connect(this.masterGain);

    source.start(0);

    // Handle track end for non-looping tracks
    if (!config.loop) {
      source.onended = () => {
        if (this.currentTrack === track) {
          this.currentSource = null;
          this.currentGain = null;
          this.currentTrack = null;
        }
      };
    }

    this.currentSource = source;
    this.currentGain = gain;
    this.currentTrack = track;
  }

  private async crossfadeTo(
    track: MusicTrack,
    buffer: AudioBuffer,
    config: TrackConfig
  ): Promise<void> {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // Create new source
    const newSource = this.ctx.createBufferSource();
    const newGain = this.ctx.createGain();

    newSource.buffer = buffer;
    newSource.loop = config.loop;

    // Start silent, fade in
    newGain.gain.setValueAtTime(0, now);
    newGain.gain.linearRampToValueAtTime(
      this.muted ? 0 : config.volume,
      now + CROSSFADE_DURATION
    );

    newSource.connect(newGain);
    newGain.connect(this.masterGain);

    // Fade out current
    if (this.currentGain) {
      this.currentGain.gain.setValueAtTime(this.currentGain.gain.value, now);
      this.currentGain.gain.linearRampToValueAtTime(0, now + CROSSFADE_DURATION);
    }

    // Start new track
    newSource.start(0);

    // Stop old track after crossfade
    const oldSource = this.currentSource;
    setTimeout(() => {
      try {
        oldSource?.stop();
      } catch { /* already stopped */ }
    }, CROSSFADE_DURATION * 1000);

    // Handle track end for non-looping tracks
    if (!config.loop) {
      newSource.onended = () => {
        if (this.currentTrack === track) {
          this.currentSource = null;
          this.currentGain = null;
          this.currentTrack = null;
        }
      };
    }

    // Update references
    this.currentSource = newSource;
    this.currentGain = newGain;
    this.currentTrack = track;
  }

  stop(fadeOut = true): void {
    if (!this.ctx || !this.currentSource || !this.currentGain) return;

    const now = this.ctx.currentTime;

    if (fadeOut) {
      this.currentGain.gain.setValueAtTime(this.currentGain.gain.value, now);
      this.currentGain.gain.linearRampToValueAtTime(0, now + 0.5);

      const source = this.currentSource;
      setTimeout(() => {
        try {
          source?.stop();
        } catch { /* already stopped */ }
      }, 500);
    } else {
      try {
        this.currentSource.stop();
      } catch { /* already stopped */ }
    }

    this.currentSource = null;
    this.currentGain = null;
    this.currentTrack = null;
  }

  pause(): void {
    if (!this.ctx) return;

    if (this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  resume(): void {
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.volume,
        (this.ctx?.currentTime || 0) + 0.1
      );
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.currentGain) {
      const config = this.currentTrack ? TRACK_CONFIGS[this.currentTrack] : { volume: 1 };
      this.currentGain.gain.linearRampToValueAtTime(
        muted ? 0 : config.volume,
        (this.ctx?.currentTime || 0) + 0.1
      );
    }
  }

  getCurrentTrack(): MusicTrack | null {
    return this.currentTrack;
  }

  isPlaying(): boolean {
    return this.currentSource !== null;
  }

  hasTracksAvailable(): boolean {
    return this.tracksAvailable;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Convenience methods for common transitions
  playMenuMusic(): void {
    this.play('menu');
  }

  playGameMusic(): void {
    this.play('gameplay');
  }

  playOvertimeMusic(): void {
    this.play('overtime');
  }

  playVictory(): void {
    this.stop(false);
    this.play('victory');
  }

  playDefeat(): void {
    this.stop(false);
    this.play('defeat');
  }

  stopMusic(): void {
    this.stop(true);
  }
}

export default MusicPlayer;
