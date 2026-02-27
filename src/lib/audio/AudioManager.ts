/**
 * AudioManager - Singleton class for managing game audio
 * "Neon Voltage" Audio System
 *
 * Features:
 * - Music playback with crossfading
 * - Intensity-based SFX (velocity → hit intensity)
 * - Ambient atmospheric loops
 * - Zustand settings store integration
 * - Browser autoplay policy handling
 */

import { Howl, Howler } from 'howler';
import { AUDIO_CONFIG, isVariantConfig } from './sounds';
import {
  MusicName,
  SFXName,
  AmbientName,
  SFXOptions,
  velocityToIntensity,
  intensityToSFXName,
} from './types';
import { useSettingsStore } from '@/stores/settingsStore';

// Debounce helper for rapid-fire sounds
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

// Throttle helper for high-frequency sounds
function throttle<T extends (...args: number[]) => void>(
  fn: T,
  limit: number
): T {
  let lastCall = 0;
  return ((...args: number[]) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

class AudioManager {
  private static instance: AudioManager;

  // Sound storage
  private sounds: Map<string, Howl> = new Map();
  private music: Map<MusicName, Howl> = new Map();
  private ambient: Map<AmbientName, Howl> = new Map();

  // Current playback state
  private currentMusic: Howl | null = null;
  private currentMusicName: MusicName | null = null;
  private currentAmbient: Howl | null = null;

  // State flags
  private initialized = false;
  private unlocked = false;
  private muted = false;

  // Volume levels (0-1 scale internally)
  private masterVolume = 0.8;
  private sfxVolume = 1.0;
  private musicVolume = 0.5;
  private ambientVolume = 0.7;

  // Pending sounds queue (for before unlock)
  private pendingMusic: MusicName | null = null;
  private pendingAmbient = false;

  // Throttled/debounced handlers
  private throttledWallBounce: () => void;
  private throttledHit: (velocity: number) => void;

  // Store unsubscribe function
  private unsubscribeStore: (() => void) | null = null;

  private constructor() {
    // Throttle wall bounce to prevent spam (50ms minimum between plays)
    this.throttledWallBounce = throttle(() => {
      this.playRandomVariant('wallBounce');
    }, 50);

    // Throttle hits (30ms minimum)
    this.throttledHit = throttle((velocity: number) => {
      const intensity = velocityToIntensity(velocity);
      const sfxName = intensityToSFXName(intensity);
      this.playSFX(sfxName);
    }, 30);
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  async init(): Promise<void> {
    if (this.initialized) return;

    // Subscribe to Zustand settings store
    this.subscribeToStore();

    // Load music tracks
    for (const [name, config] of Object.entries(AUDIO_CONFIG.music)) {
      const howl = new Howl({
        src: [config.src],
        loop: config.loop ?? false,
        volume: this.calculateVolume('music', config.volume),
        preload: true,
        html5: true, // Better for long tracks
        onloaderror: (_, error) => {
          console.warn(`[Audio] Failed to load music: ${name}`, error);
        },
      });
      this.music.set(name as MusicName, howl);
    }

    // Load SFX
    for (const [name, config] of Object.entries(AUDIO_CONFIG.sfx)) {
      if (isVariantConfig(config)) {
        config.variants.forEach((src, i) => {
          const howl = new Howl({
            src: [src],
            volume: this.calculateVolume('sfx', config.volume),
            preload: true,
            onloaderror: (_, error) => {
              console.warn(`[Audio] Failed to load sound: ${name}-${i}`, error);
            },
          });
          this.sounds.set(`${name}-${i}`, howl);
        });
      } else {
        const howl = new Howl({
          src: [config.src],
          volume: this.calculateVolume('sfx', config.volume),
          preload: true,
          onloaderror: (_, error) => {
            console.warn(`[Audio] Failed to load sound: ${name}`, error);
          },
        });
        this.sounds.set(name, howl);
      }
    }

    // Load ambient
    for (const [name, config] of Object.entries(AUDIO_CONFIG.ambient)) {
      const howl = new Howl({
        src: [config.src],
        loop: config.loop ?? true,
        volume: this.calculateVolume('ambient', config.volume),
        preload: true,
        html5: true,
        onloaderror: (_, error) => {
          console.warn(`[Audio] Failed to load ambient: ${name}`, error);
        },
      });
      this.ambient.set(name as AmbientName, howl);
    }

    this.initialized = true;
  }

  /**
   * Unlock audio playback after user interaction
   * Call this on first click/tap/keypress
   */
  async unlock(): Promise<void> {
    if (this.unlocked) return;

    // Resume Howler's AudioContext
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume();
    }

    this.unlocked = true;

    // Play any pending sounds
    if (this.pendingMusic) {
      this.playMusic(this.pendingMusic);
      this.pendingMusic = null;
    }
    if (this.pendingAmbient) {
      this.playAmbient('arenaLoop');
      this.pendingAmbient = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  // ═══════════════════════════════════════════════════════════
  // ZUSTAND INTEGRATION
  // ═══════════════════════════════════════════════════════════

  private subscribeToStore(): void {
    // Get initial values
    const state = useSettingsStore.getState();
    this.masterVolume = state.settings.audio.masterVolume / 100;
    this.sfxVolume = state.settings.audio.sfxVolume / 100;
    this.musicVolume = state.settings.audio.musicVolume / 100;
    this.ambientVolume = state.settings.audio.ambientVolume / 100;

    // Subscribe to changes
    this.unsubscribeStore = useSettingsStore.subscribe((state) => {
      const audio = state.settings.audio;
      this.setMasterVolume(audio.masterVolume / 100);
      this.setSFXVolume(audio.sfxVolume / 100);
      this.setMusicVolume(audio.musicVolume / 100);
      this.setAmbientVolume(audio.ambientVolume / 100);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // VOLUME CONTROL
  // ═══════════════════════════════════════════════════════════

  private calculateVolume(
    channel: 'music' | 'sfx' | 'ambient',
    baseVolume?: number
  ): number {
    const base = baseVolume ?? 1;
    const channelVolume =
      channel === 'music'
        ? this.musicVolume
        : channel === 'sfx'
          ? this.sfxVolume
          : this.ambientVolume;
    return base * channelVolume * this.masterVolume;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateAllVolumes();
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    this.updateSFXVolumes();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateMusicVolumes();
  }

  setAmbientVolume(volume: number): void {
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    this.updateAmbientVolumes();
  }

  private updateAllVolumes(): void {
    this.updateSFXVolumes();
    this.updateMusicVolumes();
    this.updateAmbientVolumes();
  }

  private updateSFXVolumes(): void {
    for (const [name, howl] of this.sounds) {
      const sfxName = name.replace(/-\d+$/, '') as SFXName;
      const config = AUDIO_CONFIG.sfx[sfxName];
      if (config) {
        const baseVolume = isVariantConfig(config)
          ? config.volume ?? 1
          : config.volume ?? 1;
        howl.volume(this.calculateVolume('sfx', baseVolume));
      }
    }
  }

  private updateMusicVolumes(): void {
    for (const [name, howl] of this.music) {
      const config = AUDIO_CONFIG.music[name];
      howl.volume(this.calculateVolume('music', config.volume));
    }
  }

  private updateAmbientVolumes(): void {
    for (const [name, howl] of this.ambient) {
      const config = AUDIO_CONFIG.ambient[name];
      howl.volume(this.calculateVolume('ambient', config.volume));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MUTE CONTROL
  // ═══════════════════════════════════════════════════════════

  setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ═══════════════════════════════════════════════════════════
  // SFX PLAYBACK
  // ═══════════════════════════════════════════════════════════

  playSFX(name: SFXName, options?: SFXOptions): void {
    if (!this.initialized) return;

    const config = AUDIO_CONFIG.sfx[name];
    if (isVariantConfig(config)) {
      this.playRandomVariant(name, options);
    } else {
      const sound = this.sounds.get(name);
      if (sound) {
        if (options?.volume !== undefined) {
          sound.volume(options.volume * this.sfxVolume * this.masterVolume);
        }
        if (options?.rate !== undefined) {
          sound.rate(options.rate);
        }
        sound.play();
      }
    }
  }

  private playRandomVariant(name: string, options?: SFXOptions): void {
    const config = AUDIO_CONFIG.sfx[name as SFXName];
    if (!isVariantConfig(config)) return;

    const variantCount = config.variants.length;
    const randomIndex = Math.floor(Math.random() * variantCount);
    const sound = this.sounds.get(`${name}-${randomIndex}`);
    if (sound) {
      if (options?.rate !== undefined) {
        sound.rate(options.rate);
      }
      sound.play();
    }
  }

  // ─────────────────────────────────────────────────────────
  // Convenience methods for gameplay sounds
  // ─────────────────────────────────────────────────────────

  /**
   * Play paddle hit with intensity based on velocity
   * Uses throttling to prevent sound spam
   */
  playHit(velocity: number): void {
    this.throttledHit(velocity);
  }

  /**
   * Play wall bounce with random variant
   * Uses throttling to prevent sound spam
   */
  playWallBounce(): void {
    this.throttledWallBounce();
  }

  /**
   * Play goal sound
   * @param isPlayer - true for player goal, false for opponent
   */
  playGoal(isPlayer: boolean): void {
    this.playSFX(isPlayer ? 'goalPlayer' : 'goalOpponent');
  }

  playCountdownBeep(): void {
    this.playSFX('countdownBeep');
  }

  playCountdownGo(): void {
    this.playSFX('countdownGo');
  }

  playMatchPoint(): void {
    this.playSFX('matchPoint');
  }

  playMatchEnd(): void {
    this.playSFX('matchEnd');
  }

  // ─────────────────────────────────────────────────────────
  // UI Sounds
  // ─────────────────────────────────────────────────────────

  playClick(): void {
    this.playSFX('uiClick');
  }

  playHover(): void {
    this.playSFX('uiHover');
  }

  playBack(): void {
    this.playSFX('uiBack');
  }

  playToggle(isOn: boolean): void {
    this.playSFX(isOn ? 'uiToggleOn' : 'uiToggleOff');
  }

  playError(): void {
    this.playSFX('uiError');
  }

  playPanelOpen(): void {
    this.playSFX('panelOpen');
  }

  playPanelClose(): void {
    this.playSFX('panelClose');
  }

  // ═══════════════════════════════════════════════════════════
  // MUSIC PLAYBACK
  // ═══════════════════════════════════════════════════════════

  playMusic(name: MusicName, fadeIn = 1000): void {
    if (!this.initialized) return;

    // Queue if not unlocked yet
    if (!this.unlocked) {
      this.pendingMusic = name;
      return;
    }

    const nextTrack = this.music.get(name);
    if (!nextTrack) return;

    // If same track is already playing, do nothing
    if (this.currentMusicName === name && this.currentMusic?.playing()) {
      return;
    }

    // Fade out current music if playing
    if (this.currentMusic?.playing()) {
      const current = this.currentMusic;
      current.fade(current.volume(), 0, fadeIn / 2);
      current.once('fade', () => {
        current.stop();
      });
    }

    // Start new track with fade in
    const config = AUDIO_CONFIG.music[name];
    const targetVolume = this.calculateVolume('music', config.volume);

    nextTrack.volume(0);
    nextTrack.play();
    nextTrack.fade(0, targetVolume, fadeIn);

    this.currentMusic = nextTrack;
    this.currentMusicName = name;
  }

  /**
   * Crossfade to a new track
   */
  fadeToTrack(name: MusicName, duration = 2000): void {
    this.playMusic(name, duration);
  }

  stopMusic(fadeOut = 500): void {
    if (!this.currentMusic?.playing()) return;

    const current = this.currentMusic;
    current.fade(current.volume(), 0, fadeOut);
    current.once('fade', () => {
      current.stop();
    });

    this.currentMusic = null;
    this.currentMusicName = null;
  }

  pauseMusic(): void {
    this.currentMusic?.pause();
  }

  resumeMusic(): void {
    if (this.currentMusic && !this.currentMusic.playing()) {
      this.currentMusic.play();
    }
  }

  getCurrentMusic(): MusicName | null {
    return this.currentMusicName;
  }

  /**
   * Play victory/defeat stings (stops current music)
   */
  playVictory(): void {
    this.stopMusic(200);
    this.playMusic('victory', 100);
  }

  playDefeat(): void {
    this.stopMusic(200);
    this.playMusic('defeat', 100);
  }

  // ═══════════════════════════════════════════════════════════
  // AMBIENT PLAYBACK
  // ═══════════════════════════════════════════════════════════

  playAmbient(name: AmbientName = 'arenaLoop'): void {
    if (!this.initialized) return;

    // Queue if not unlocked yet
    if (!this.unlocked) {
      this.pendingAmbient = true;
      return;
    }

    const ambient = this.ambient.get(name);
    if (!ambient || ambient.playing()) return;

    ambient.play();
    this.currentAmbient = ambient;
  }

  stopAmbient(fadeOut = 500): void {
    if (!this.currentAmbient?.playing()) return;

    const current = this.currentAmbient;
    current.fade(current.volume(), 0, fadeOut);
    current.once('fade', () => {
      current.stop();
      // Reset volume for next play
      const config = AUDIO_CONFIG.ambient.arenaLoop;
      current.volume(this.calculateVolume('ambient', config.volume));
    });

    this.currentAmbient = null;
  }

  // ═══════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════

  dispose(): void {
    // Unsubscribe from store
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    // Stop and unload all sounds
    this.stopMusic(0);
    this.stopAmbient(0);

    for (const howl of this.sounds.values()) {
      howl.unload();
    }
    for (const howl of this.music.values()) {
      howl.unload();
    }
    for (const howl of this.ambient.values()) {
      howl.unload();
    }

    this.sounds.clear();
    this.music.clear();
    this.ambient.clear();
    this.initialized = false;
    this.unlocked = false;
  }
}

export default AudioManager;
