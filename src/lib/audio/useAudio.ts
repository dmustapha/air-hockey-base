/**
 * useAudio - React hook for audio system integration
 * Provides memoized callbacks and automatic lifecycle management
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import AudioManager from './AudioManager';
import { MusicName, SFXName, SFXOptions, UseAudioReturn } from './types';

/**
 * React hook for interacting with the audio system
 *
 * @example
 * ```tsx
 * function GameComponent() {
 *   const { playHit, playGoal, playMusic, unlock } = useAudio();
 *
 *   // On first user interaction
 *   const handleStart = async () => {
 *     await unlock();
 *     playMusic('gameplay');
 *   };
 *
 *   // On paddle collision (velocity from physics)
 *   const onPaddleHit = (velocity: number) => {
 *     playHit(velocity);
 *   };
 * }
 * ```
 */
export function useAudio(): UseAudioReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const managerRef = useRef<AudioManager | null>(null);

  // Initialize on mount
  useEffect(() => {
    const manager = AudioManager.getInstance();
    managerRef.current = manager;

    // Initialize async
    manager.init().then(() => {
      setIsInitialized(manager.isInitialized());
      setIsUnlocked(manager.isUnlocked());
      setIsMuted(manager.isMuted());
    });

    // Cleanup on unmount (optional - singleton persists)
    return () => {
      // Don't dispose - other components may still use audio
      // manager.dispose();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════

  const unlock = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;

    await manager.unlock();
    setIsUnlocked(true);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // SFX
  // ═══════════════════════════════════════════════════════════

  const playSFX = useCallback((name: SFXName, options?: SFXOptions) => {
    managerRef.current?.playSFX(name, options);
  }, []);

  const playHit = useCallback((velocity: number) => {
    managerRef.current?.playHit(velocity);
  }, []);

  const playWallBounce = useCallback(() => {
    managerRef.current?.playWallBounce();
  }, []);

  const playGoal = useCallback((isPlayer: boolean) => {
    managerRef.current?.playGoal(isPlayer);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // UI SOUNDS
  // ═══════════════════════════════════════════════════════════

  const playClick = useCallback(() => {
    managerRef.current?.playClick();
  }, []);

  const playHover = useCallback(() => {
    managerRef.current?.playHover();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // MUSIC
  // ═══════════════════════════════════════════════════════════

  const playMusic = useCallback((track: MusicName) => {
    managerRef.current?.playMusic(track);
  }, []);

  const pauseMusic = useCallback(() => {
    managerRef.current?.pauseMusic();
  }, []);

  const resumeMusic = useCallback(() => {
    managerRef.current?.resumeMusic();
  }, []);

  const stopMusic = useCallback(() => {
    managerRef.current?.stopMusic();
  }, []);

  const fadeToTrack = useCallback((track: MusicName, duration?: number) => {
    managerRef.current?.fadeToTrack(track, duration);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // AMBIENT
  // ═══════════════════════════════════════════════════════════

  const playAmbient = useCallback(() => {
    managerRef.current?.playAmbient();
  }, []);

  const stopAmbient = useCallback(() => {
    managerRef.current?.stopAmbient();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // GLOBAL CONTROLS
  // ═══════════════════════════════════════════════════════════

  const mute = useCallback(() => {
    managerRef.current?.setMuted(true);
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    managerRef.current?.setMuted(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = managerRef.current?.toggleMute() ?? false;
    setIsMuted(newMuted);
    return newMuted;
  }, []);

  return {
    // State
    isInitialized,
    isUnlocked,
    isMuted,

    // Initialization
    unlock,

    // SFX
    playSFX,
    playHit,
    playWallBounce,
    playGoal,

    // UI Sounds
    playClick,
    playHover,

    // Music
    playMusic,
    pauseMusic,
    resumeMusic,
    stopMusic,
    fadeToTrack,

    // Ambient
    playAmbient,
    stopAmbient,

    // Global controls
    mute,
    unmute,
    toggleMute,
  };
}

/**
 * Hook for automatic unlock on first user interaction
 * Use this at the app root level
 *
 * @example
 * ```tsx
 * function App() {
 *   useAutoUnlock();
 *   return <Game />;
 * }
 * ```
 */
export function useAutoUnlock(): void {
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    const handleInteraction = async () => {
      if (hasUnlockedRef.current) return;
      hasUnlockedRef.current = true;

      const manager = AudioManager.getInstance();
      await manager.unlock();

      // Remove listeners after unlock
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
}

export default useAudio;
