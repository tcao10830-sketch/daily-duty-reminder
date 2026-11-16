import { useEffect } from 'react';

const pieces = Array.from({ length: 58 }, (_, index) => ({
  id: index,
  left: (index * 37 + 11) % 100,
  delay: (index % 12) * 0.055,
  duration: 2.1 + (index % 7) * 0.22,
  rotation: (index * 53) % 360,
  color: ['#FFD84D', '#FF914D', '#4F87FF', '#38C98B', '#EF5B68', '#B78BFA'][index % 6],
  shape: index % 3,
}));

export function SubmissionCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4600);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="submission-celebration" role="status" aria-live="polite">
      <div className="celebration-confetti" aria-hidden="true">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className={`confetti-piece confetti-shape-${piece.shape}`}
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
      </div>
      <div className="celebration-message">
        <span className="celebration-sparkle" aria-hidden="true">✦ ✨ ✦</span>
        <strong>SUBMITTED!</strong>
        <span>Your hard work is on its way! 🎉</span>
      </div>
    </div>
  );
}
