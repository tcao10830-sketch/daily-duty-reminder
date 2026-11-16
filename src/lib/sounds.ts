let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function tone(frequency: number, start: number, duration: number, volume = 0.045, type: OscillatorType = 'sine') {
  const context = getAudioContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.02);
}

export function playClickSound() {
  tone(660, 0, 0.055, 0.018, 'triangle');
}

export function playSubmitSound() {
  tone(523.25, 0, 0.16, 0.055);
  tone(659.25, 0.12, 0.18, 0.055);
  tone(783.99, 0.25, 0.24, 0.06);
  tone(1046.5, 0.42, 0.34, 0.05);
}

export function playNotificationSound() {
  tone(880, 0, 0.12, 0.035, 'sine');
  tone(1174.66, 0.11, 0.2, 0.04, 'sine');
}
