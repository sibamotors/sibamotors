// Tiny Web Audio "blip" sounds for message send/receive — no binary asset
// files, works everywhere, and respects a per-browser mute toggle.

const SOUND_KEY = "sibamotor-sound-enabled";

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      sharedCtx = new Ctor();
    }
    if (sharedCtx.state === "suspended") void sharedCtx.resume();
    return sharedCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(freq: number, duration: number, delay = 0, gain = 0.07) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = audio.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Short ascending chirp played right after a message is sent. */
export function playSendSound() {
  if (!isSoundEnabled()) return;
  tone(760, 0.08);
  tone(1080, 0.09, 0.06);
}

/** Short descending chirp played when a new message arrives. */
export function playReceiveSound() {
  if (!isSoundEnabled()) return;
  tone(680, 0.1);
  tone(500, 0.14, 0.08);
}
