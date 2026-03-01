/**
 * SynthAudio - Game SFX using HTML5 Audio elements
 *
 * Uses pre-rendered WAV files played via <audio> elements for maximum
 * compatibility with iOS webviews (Warpcast, etc.) where Web Audio API
 * is unreliable or completely blocked.
 *
 * Pattern borrowed from working Farcaster mini apps (Slay to Earn):
 *   - Preload Audio elements with preload="auto"
 *   - Play by resetting currentTime=0 and calling play()
 *   - Pool multiple elements per sound for overlapping playback
 */

type SfxName =
  | 'hit_0' | 'hit_1' | 'hit_2' | 'hit_3' | 'hit_4'
  | 'wall_bounce'
  | 'goal_player' | 'goal_opponent'
  | 'countdown_beep' | 'countdown_go'
  | 'match_point' | 'match_end'
  | 'victory' | 'defeat'
  | 'click' | 'hover' | 'back'
  | 'toggle_on' | 'toggle_off'
  | 'error'
  | 'panel_open' | 'panel_close';

const SFX_LIST: SfxName[] = [
  'hit_0', 'hit_1', 'hit_2', 'hit_3', 'hit_4',
  'wall_bounce',
  'goal_player', 'goal_opponent',
  'countdown_beep', 'countdown_go',
  'match_point', 'match_end',
  'victory', 'defeat',
  'click', 'hover', 'back',
  'toggle_on', 'toggle_off',
  'error',
  'panel_open', 'panel_close',
];

/** How many Audio elements to pool per sound (for overlapping plays) */
const POOL_SIZE = 3;

class SynthAudio {
  private static instance: SynthAudio;

  /** Pool of preloaded Audio elements per SFX name */
  private pools: Map<SfxName, HTMLAudioElement[]> = new Map();
  /** Round-robin index per pool */
  private poolIndex: Map<SfxName, number> = new Map();

  private initialized = false;
  private muted = false;

  private masterVolume = 0.8;
  private sfxVolume = 1.0;

  private constructor() {}

  static getInstance(): SynthAudio {
    if (!SynthAudio.instance) {
      SynthAudio.instance = new SynthAudio();
    }
    return SynthAudio.instance;
  }

  /**
   * Preload all SFX as HTML5 Audio elements.
   * No AudioContext needed — works everywhere HTML5 Audio works.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    for (const name of SFX_LIST) {
      const pool: HTMLAudioElement[] = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        const audio = new Audio(`/audio/sfx/${name}.wav`);
        audio.preload = 'auto';
        audio.addEventListener('error', () => {
          // WAV file missing or failed to load — play() will no-op gracefully
        });
        audio.load();
        pool.push(audio);
      }
      this.pools.set(name, pool);
      this.poolIndex.set(name, 0);
    }

    this.initialized = true;
  }

  /**
   * Retry playing any paused audio on user gesture.
   * iOS requires play() inside a user-initiated event.
   */
  unlock(): void {
    // Warm ALL pooled elements — iOS autoplay policy applies per-element
    for (const pool of this.pools.values()) {
      for (const el of pool) {
        if (el.paused) {
          el.volume = 0;
          el.play().then(() => {
            el.pause();
            el.currentTime = 0;
            el.volume = 1;
          }).catch(() => {});
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CORE PLAYBACK
  // ═══════════════════════════════════════════════════════════

  private play(name: SfxName, volume?: number): void {
    if (this.muted || !this.initialized) return;

    const pool = this.pools.get(name);
    if (!pool) return;

    const idx = this.poolIndex.get(name) ?? 0;
    const audio = pool[idx];
    this.poolIndex.set(name, (idx + 1) % POOL_SIZE);

    const effectiveVolume = (volume ?? 1) * this.sfxVolume * this.masterVolume;
    audio.volume = Math.max(0, Math.min(1, effectiveVolume));
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — will work after user gesture unlocks
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VOLUME CONTROL
  // ═══════════════════════════════════════════════════════════

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(_volume: number): void {
    // Music is handled by MusicPlayer — no-op here for interface compat
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isUnlocked(): boolean {
    return this.initialized; // HTML5 Audio doesn't have a "suspended" state
  }

  // ═══════════════════════════════════════════════════════════
  // GAMEPLAY SOUNDS
  // ═══════════════════════════════════════════════════════════

  playHit(velocity: number): void {
    let intensity: number;
    if (velocity < 3) intensity = 0;
    else if (velocity < 8) intensity = 1;
    else if (velocity < 15) intensity = 2;
    else if (velocity < 25) intensity = 3;
    else intensity = 4;

    this.play(`hit_${intensity}` as SfxName);
  }

  playWallBounce(): void {
    this.play('wall_bounce');
  }

  playGoal(isPlayer: boolean): void {
    this.play(isPlayer ? 'goal_player' : 'goal_opponent');
  }

  playCountdownBeep(): void {
    this.play('countdown_beep');
  }

  playCountdownGo(): void {
    this.play('countdown_go');
  }

  playMatchPoint(): void {
    this.play('match_point');
  }

  playMatchEnd(): void {
    this.play('match_end');
  }

  playVictory(): void {
    this.play('victory');
  }

  playDefeat(): void {
    this.play('defeat');
  }

  // ═══════════════════════════════════════════════════════════
  // UI SOUNDS
  // ═══════════════════════════════════════════════════════════

  playClick(): void {
    this.play('click');
  }

  playHover(): void {
    this.play('hover');
  }

  playBack(): void {
    this.play('back');
  }

  playToggle(isOn: boolean): void {
    this.play(isOn ? 'toggle_on' : 'toggle_off');
  }

  playError(): void {
    this.play('error');
  }

  playPanelOpen(): void {
    this.play('panel_open');
  }

  playPanelClose(): void {
    this.play('panel_close');
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  dispose(): void {
    for (const pool of this.pools.values()) {
      for (const audio of pool) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    }
    this.pools.clear();
    this.poolIndex.clear();
    this.initialized = false;
  }
}

export default SynthAudio;
