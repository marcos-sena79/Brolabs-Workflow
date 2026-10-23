// Notificação sonora via Web Audio API — sem assets de áudio no repo (item 3.3).

export type SoundEvent = 'notification' | 'unblocked' | 'timer';

let audioCtx: AudioContext | null = null;
let resumeHooked = false;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    // Autoplay policy: retoma o contexto após o primeiro gesto do usuário (uma vez)
    if (!resumeHooked) {
      resumeHooked = true;
      const onResume = () => {
        if (audioCtx?.state === 'suspended') void audioCtx.resume().catch(() => {});
      };
      window.addEventListener('pointerdown', onResume, { once: true });
      window.addEventListener('keydown', onResume, { once: true });
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  // envelope ADSR simples
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/**
 * Toca um som de notificação. Nunca lança — UI nunca bloqueada por áudio.
 * Volume 0 = mudo. document.hidden = silencioso.
 */
export function playSound(event: SoundEvent, volume = 0.5, timbre: 'soft' | 'digital' = 'soft'): void {
  try {
    if (typeof document !== 'undefined' && document.hidden) return;
    const vol = Math.min(Math.max(volume, 0), 1);
    if (vol === 0) return;
    const ctx = getCtx();
    if (!ctx) return;

    const base = timbre === 'digital' ? 880 : 660;
    switch (event) {
      case 'notification':
        tone(ctx, base, 0, 0.14, vol * 0.25);
        tone(ctx, base * 1.25, 0.12, 0.16, vol * 0.2);
        break;
      case 'unblocked':
        tone(ctx, base, 0, 0.12, vol * 0.22);
        tone(ctx, base * 1.5, 0.11, 0.18, vol * 0.25);
        break;
      case 'timer':
        tone(ctx, base * 0.75, 0, 0.07, vol * 0.18);
        break;
    }
  } catch {
    // silencioso
  }
}
