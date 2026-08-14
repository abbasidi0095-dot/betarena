"use client";

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function blip(freq: number, duration = 0.08, type: OscillatorType = "sine") {
  const context = audioCtx();
  if (!context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  } catch {
    // audio is best-effort only
  }
}

function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("betarena-sound") === "1";
}

export function playSelectSound(wasActive: boolean) {
  if (!soundEnabled()) return;
  blip(wasActive ? 330 : 440, 0.06, "triangle");
}

export function playWinSound() {
  if (!soundEnabled()) return;
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => blip(f, 0.12, "sine"), i * 90),
  );
}
