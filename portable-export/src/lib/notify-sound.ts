// Sonido corto de notificación (WebAudio, sin assets externos).
let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = ctx ?? new AudioCtor();
  return ctx;
}

/**
 * Los navegadores móviles bloquean el audio hasta que el usuario toca la
 * pantalla. Llamamos esto una vez al primer toque para dejar el canal listo,
 * así los avisos posteriores suenan sin fallar.
 */
export function unlockNotificationSound() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  const arm = () => {
    const c = getCtx();
    if (!c) return;
    void c.resume();
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.01);
    } catch {
      /* ignorar */
    }
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("touchstart", arm);
    window.removeEventListener("keydown", arm);
  };
  window.addEventListener("pointerdown", arm, { once: false });
  window.addEventListener("touchstart", arm, { once: false });
  window.addEventListener("keydown", arm, { once: false });
}

/** Vibra el teléfono si el sistema lo permite. */
export function vibrateNotification() {
  if (typeof navigator === "undefined") return;
  if (localStorage.getItem("vip-sound") === "off") return;
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
  } catch {
    /* sin vibración */
  }
}

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("vip-sound") === "off") return;
  vibrateNotification();
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") void c.resume();
    const now = c.currentTime;
    [880, 1180].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch {
    /* silencio si el navegador bloquea el audio */
  }
}

export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("vip-sound") !== "off";
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("vip-sound", enabled ? "on" : "off");
}
