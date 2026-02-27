/**
 * useSynthAudio - Simple hook for synthesized game sounds
 * Works immediately - no audio files needed
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import SynthAudio from './SynthAudio';

export function useSynthAudio() {
  const [isReady, setIsReady] = useState(false);
  const audioRef = useRef<SynthAudio | null>(null);

  useEffect(() => {
    const audio = SynthAudio.getInstance();
    audioRef.current = audio;
    audio.init().then(() => setIsReady(true));
  }, []);

  // Auto-unlock on first interaction
  useEffect(() => {
    const handleInteraction = async () => {
      await audioRef.current?.unlock();
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

  // Gameplay sounds
  const playHit = useCallback((velocity: number) => {
    audioRef.current?.playHit(velocity);
  }, []);

  const playWallBounce = useCallback(() => {
    audioRef.current?.playWallBounce();
  }, []);

  const playGoal = useCallback((isPlayer: boolean) => {
    audioRef.current?.playGoal(isPlayer);
  }, []);

  const playCountdownBeep = useCallback(() => {
    audioRef.current?.playCountdownBeep();
  }, []);

  const playCountdownGo = useCallback(() => {
    audioRef.current?.playCountdownGo();
  }, []);

  const playMatchPoint = useCallback(() => {
    audioRef.current?.playMatchPoint();
  }, []);

  const playMatchEnd = useCallback(() => {
    audioRef.current?.playMatchEnd();
  }, []);

  const playVictory = useCallback(() => {
    audioRef.current?.playVictory();
  }, []);

  const playDefeat = useCallback(() => {
    audioRef.current?.playDefeat();
  }, []);

  // UI sounds
  const playClick = useCallback(() => {
    audioRef.current?.playClick();
  }, []);

  const playHover = useCallback(() => {
    audioRef.current?.playHover();
  }, []);

  const playBack = useCallback(() => {
    audioRef.current?.playBack();
  }, []);

  const playToggle = useCallback((isOn: boolean) => {
    audioRef.current?.playToggle(isOn);
  }, []);

  const playError = useCallback(() => {
    audioRef.current?.playError();
  }, []);

  const playPanelOpen = useCallback(() => {
    audioRef.current?.playPanelOpen();
  }, []);

  const playPanelClose = useCallback(() => {
    audioRef.current?.playPanelClose();
  }, []);

  // Volume controls
  const setMasterVolume = useCallback((volume: number) => {
    audioRef.current?.setMasterVolume(volume / 100);
  }, []);

  const setSFXVolume = useCallback((volume: number) => {
    audioRef.current?.setSFXVolume(volume / 100);
  }, []);

  const toggleMute = useCallback(() => {
    return audioRef.current?.toggleMute() ?? false;
  }, []);

  return {
    isReady,
    // Gameplay
    playHit,
    playWallBounce,
    playGoal,
    playCountdownBeep,
    playCountdownGo,
    playMatchPoint,
    playMatchEnd,
    playVictory,
    playDefeat,
    // UI
    playClick,
    playHover,
    playBack,
    playToggle,
    playError,
    playPanelOpen,
    playPanelClose,
    // Controls
    setMasterVolume,
    setSFXVolume,
    toggleMute,
  };
}

export default useSynthAudio;
