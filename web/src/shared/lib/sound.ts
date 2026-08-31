// WebAudio beeps + haptics (ported from the vanilla app). `enabled` gates sound.
let audioCtx: AudioContext | null = null;
export function beep(
  enabled: boolean,
  frequency?: number,
  duration?: number,
  delaySeconds?: number,
) {
  if (!enabled) return;
  try {
    if (!audioCtx) {
      const legacyWindow: Window & {
        webkitAudioContext?: typeof AudioContext;
      } = window;
      const AudioContextConstructor = window.AudioContext || legacyWindow.webkitAudioContext;
      if (!AudioContextConstructor) return;
      audioCtx = new AudioContextConstructor();
    }
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = frequency || 880;
    oscillator.type = "sine";
    const startTime = audioCtx.currentTime + (delaySeconds || 0);
    const beepDuration = duration || 0.18;
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + beepDuration);
    oscillator.start(startTime);
    oscillator.stop(startTime + beepDuration + 0.05);
  } catch {
    /* */
  }
}
export function vibrate(pattern: VibratePattern) {
  try {
    navigator.vibrate && navigator.vibrate(pattern);
  } catch {
    /* */
  }
}
