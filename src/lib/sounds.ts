let audioContext: AudioContext | null = null;
let unlocked = false;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

function unlockAudio() {
  const context = getAudioContext();
  if (!context) return;
  void context.resume().then(() => { unlocked = true; }).catch(() => undefined);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio);
}

function playTone(frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const context = getAudioContext();
  if (!context || !unlocked || context.state !== 'running') return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, context.currentTime + start);
  gain.gain.setValueAtTime(0.0001, context.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), context.currentTime + start + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(context.currentTime + start);
  oscillator.stop(context.currentTime + start + duration + 0.03);
}

export function playSubmissionCelebration() {
  // A bright, layered fanfare: louder and longer than ordinary UI feedback.
  const notes = [
    [523.25, 0.00], [659.25, 0.13], [783.99, 0.26],
    [1046.5, 0.42], [783.99, 0.72], [1046.5, 0.88],
    [1318.5, 1.08], [1568, 1.30],
  ] as const;
  notes.forEach(([frequency, start], index) => {
    playTone(frequency, start, index > 5 ? 0.62 : 0.42, index > 5 ? 0.34 : 0.27, 'sine');
    playTone(frequency * 2, start + 0.015, 0.22, 0.075, 'triangle');
  });
  playTone(392, 0.42, 1.05, 0.12, 'triangle');
  playTone(523.25, 0.78, 0.92, 0.10, 'triangle');
}

export function playNotificationSound() {
  // A short, softer two-note chime for incoming notifications.
  playTone(880, 0, 0.22, 0.13, 'sine');
  playTone(1174.66, 0.12, 0.34, 0.12, 'sine');
}
