// Sonido corto de notificación (WebAudio, sin assets externos).
let ctx: AudioContext | null = null;

export function playNotificationSound() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("vip-sound") === "off") return;
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    ctx = ctx ?? new AudioCtor();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [880, 1180].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx!.destination);
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
