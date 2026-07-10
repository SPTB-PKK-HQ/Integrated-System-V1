'use client';

import { useCallback, useRef } from 'react';

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* */ }
}

export function useSound() {
  const volumeRef = useRef(parseFloat(localStorage.getItem('sfx_volume') || '0.5'));

  const play = useCallback((name: 'click' | 'success' | 'error') => {
    const v = volumeRef.current;
    if (v <= 0) return;
    switch (name) {
      case 'click': playTone(800, 0.08, 'sine', v * 0.3); break;
      case 'success': playTone(523, 0.1, 'sine', v * 0.4); setTimeout(() => playTone(659, 0.1, 'sine', v * 0.4), 100); setTimeout(() => playTone(784, 0.2, 'sine', v * 0.4), 200); break;
      case 'error': playTone(200, 0.3, 'sawtooth', v * 0.3); break;
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    volumeRef.current = v;
    localStorage.setItem('sfx_volume', String(v));
  }, []);

  return { play, setVolume, getVolume: () => volumeRef.current };
}
