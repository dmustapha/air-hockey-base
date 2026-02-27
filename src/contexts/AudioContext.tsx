'use client';

/**
 * AudioContext - React context for complete game audio
 *
 * Integrates:
 * - SynthAudio: Synthesized SFX (works immediately, no files)
 * - MusicPlayer: Background music with crossfading (requires audio files)
 * - AmbientSoundscape: Synthesized ambient layers (works immediately)
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import SynthAudio from '@/lib/audio/SynthAudio';
import MusicPlayer from '@/lib/audio/MusicPlayer';
import AmbientSoundscape, { type AmbientState } from '@/lib/audio/AmbientSoundscape';
import { useSettingsStore } from '@/stores/settingsStore';

interface AudioContextValue {
  isInitialized: boolean;
  isMuted: boolean;

  // Gameplay sounds
  playHit: (velocity: number) => void;
  playPaddleHit: () => void;
  playWallBounce: () => void;
  playGoal: (isPlayer: boolean) => void;
  playGoalScored: () => void;
  playCountdownBeep: () => void;
  playCountdownGo: () => void;
  playMatchPoint: () => void;
  playMatchEnd: () => void;
  playVictory: () => void;
  playDefeat: () => void;

  // UI sounds
  playClick: () => void;
  playButtonClick: () => void;
  playHover: () => void;
  playBack: () => void;
  playToggle: (isOn: boolean) => void;
  playError: () => void;
  playPanelOpen: () => void;
  playPanelClose: () => void;

  // Music
  playMenuMusic: () => void;
  playGameMusic: () => void;
  playOvertimeMusic: () => void;
  playVictoryMusic: () => void;
  playDefeatMusic: () => void;
  stopMusic: () => void;

  // Ambient
  setAmbientState: (state: AmbientState) => void;
  startAmbient: () => void;
  stopAmbient: () => void;

  // Controls
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function useAudioContext(): AudioContextValue {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
}

// Aliases for backward compatibility
export const useAudio = useAudioContext;
export function useAudioOptional(): AudioContextValue | null {
  return useContext(AudioContext);
}

interface AudioProviderProps {
  children: React.ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const synthRef = useRef<SynthAudio | null>(null);
  const musicRef = useRef<MusicPlayer | null>(null);
  const ambientRef = useRef<AmbientSoundscape | null>(null);

  const audioSettings = useSettingsStore((state) => state.settings.audio);

  // Initialize all audio systems
  useEffect(() => {
    const initAudio = async () => {
      // Initialize SynthAudio (SFX)
      const synth = SynthAudio.getInstance();
      synthRef.current = synth;
      await synth.init();

      // Initialize MusicPlayer
      const music = MusicPlayer.getInstance();
      musicRef.current = music;
      await music.init();

      // Initialize AmbientSoundscape
      const ambient = AmbientSoundscape.getInstance();
      ambientRef.current = ambient;
      await ambient.init();

      setIsInitialized(true);
    };

    initAudio();

    return () => {
      // Don't dispose - singletons shared across app
    };
  }, []);

  // Sync volume settings
  useEffect(() => {
    const synth = synthRef.current;
    const music = musicRef.current;
    const ambient = ambientRef.current;

    if (synth) {
      synth.setMasterVolume(audioSettings.masterVolume / 100);
      synth.setSFXVolume(audioSettings.sfxVolume / 100);
    }

    if (music) {
      music.setVolume((audioSettings.musicVolume / 100) * (audioSettings.masterVolume / 100));
    }

    if (ambient) {
      const ambientVolume = 'ambientVolume' in audioSettings
        ? (audioSettings as { ambientVolume: number }).ambientVolume
        : 70;
      ambient.setVolume((ambientVolume / 100) * (audioSettings.masterVolume / 100));
    }
  }, [audioSettings]);

  // Auto-unlock on first interaction
  useEffect(() => {
    const handleInteraction = async () => {
      await synthRef.current?.unlock();
      // Note: Ambient NOT auto-started to preserve game performance
      // Call startAmbient() explicitly if desired

      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // GAMEPLAY SOUNDS
  // ═══════════════════════════════════════════════════════════

  const playHit = useCallback((velocity: number) => {
    synthRef.current?.playHit(velocity);
  }, []);

  const playPaddleHit = useCallback(() => {
    synthRef.current?.playHit(10);
  }, []);

  const playWallBounce = useCallback(() => {
    synthRef.current?.playWallBounce();
  }, []);

  const playGoal = useCallback((isPlayer: boolean) => {
    synthRef.current?.playGoal(isPlayer);
    ambientRef.current?.triggerGoal();
  }, []);

  const playGoalScored = useCallback(() => {
    synthRef.current?.playGoal(true);
    ambientRef.current?.triggerGoal();
  }, []);

  const playCountdownBeep = useCallback(() => {
    synthRef.current?.playCountdownBeep();
  }, []);

  const playCountdownGo = useCallback(() => {
    synthRef.current?.playCountdownGo();
  }, []);

  const playMatchPoint = useCallback(() => {
    synthRef.current?.playMatchPoint();
    ambientRef.current?.setState('matchPoint');
  }, []);

  const playMatchEnd = useCallback(() => {
    synthRef.current?.playMatchEnd();
  }, []);

  const playVictory = useCallback(() => {
    synthRef.current?.playVictory();
  }, []);

  const playDefeat = useCallback(() => {
    synthRef.current?.playDefeat();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // UI SOUNDS
  // ═══════════════════════════════════════════════════════════

  const playClick = useCallback(() => {
    synthRef.current?.playClick();
  }, []);

  const playButtonClick = useCallback(() => {
    synthRef.current?.playClick();
  }, []);

  const playHover = useCallback(() => {
    synthRef.current?.playHover();
  }, []);

  const playBack = useCallback(() => {
    synthRef.current?.playBack();
  }, []);

  const playToggle = useCallback((isOn: boolean) => {
    synthRef.current?.playToggle(isOn);
  }, []);

  const playError = useCallback(() => {
    synthRef.current?.playError();
  }, []);

  const playPanelOpen = useCallback(() => {
    synthRef.current?.playPanelOpen();
  }, []);

  const playPanelClose = useCallback(() => {
    synthRef.current?.playPanelClose();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // MUSIC
  // ═══════════════════════════════════════════════════════════

  const playMenuMusic = useCallback(() => {
    musicRef.current?.playMenuMusic();
    ambientRef.current?.setState('menu');
  }, []);

  const playGameMusic = useCallback(() => {
    musicRef.current?.playGameMusic();
    ambientRef.current?.setState('active');
  }, []);

  const playOvertimeMusic = useCallback(() => {
    musicRef.current?.playOvertimeMusic();
    ambientRef.current?.setState('overtime');
  }, []);

  const playVictoryMusic = useCallback(() => {
    musicRef.current?.playVictory();
  }, []);

  const playDefeatMusic = useCallback(() => {
    musicRef.current?.playDefeat();
  }, []);

  const stopMusic = useCallback(() => {
    musicRef.current?.stopMusic();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // AMBIENT
  // ═══════════════════════════════════════════════════════════

  const setAmbientState = useCallback((state: AmbientState) => {
    ambientRef.current?.setState(state);
  }, []);

  const startAmbient = useCallback(async () => {
    await ambientRef.current?.start();
  }, []);

  const stopAmbient = useCallback(() => {
    ambientRef.current?.stop();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════════════

  const toggleMute = useCallback(() => {
    const newMuted = synthRef.current?.toggleMute() ?? false;
    musicRef.current?.setMuted(newMuted);
    ambientRef.current?.setMuted(newMuted);
    setIsMuted(newMuted);
  }, []);

  const setMutedState = useCallback((muted: boolean) => {
    synthRef.current?.setMuted(muted);
    musicRef.current?.setMuted(muted);
    ambientRef.current?.setMuted(muted);
    setIsMuted(muted);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════

  const value: AudioContextValue = {
    isInitialized,
    isMuted,
    // Gameplay
    playHit,
    playPaddleHit,
    playWallBounce,
    playGoal,
    playGoalScored,
    playCountdownBeep,
    playCountdownGo,
    playMatchPoint,
    playMatchEnd,
    playVictory,
    playDefeat,
    // UI
    playClick,
    playButtonClick,
    playHover,
    playBack,
    playToggle,
    playError,
    playPanelOpen,
    playPanelClose,
    // Music
    playMenuMusic,
    playGameMusic,
    playOvertimeMusic,
    playVictoryMusic,
    playDefeatMusic,
    stopMusic,
    // Ambient
    setAmbientState,
    startAmbient,
    stopAmbient,
    // Controls
    toggleMute,
    setMuted: setMutedState,
  };

  return (
    <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
  );
}

export default AudioContext;
