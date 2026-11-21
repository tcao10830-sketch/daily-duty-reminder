import { useEffect, type CSSProperties } from 'react';
import { Mascot } from './Mascot';

const colors = ['#FFD84D', '#FF914D', '#4F87FF', '#38C98B', '#EF8296', '#B78BFA', '#FFF2C7'];
const particles = Array.from({ length: 132 }, (_, index) => {
  const angle = (index * 137.508) * (Math.PI / 180);
  const distance = 24 + ((index * 19) % 48);
  const shape = index % 5 === 0 ? 'star' : index % 3 === 0 ? 'ribbon' : 'dot';
  return {
    id: index,
    color: colors[index % colors.length],
    shape,
    x: Math.cos(angle) * distance * 1.2,
    y: Math.sin(angle) * distance * 0.9,
    delay: (index % 11) * 0.018,
    duration: 1.25 + (index % 8) * 0.105,
    spin: (index % 2 === 0 ? 1 : -1) * (180 + (index % 5) * 110),
    size: 6 + (index % 5) * 2,
  };
});

export function SubmissionCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 3000);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="submission-celebration" role="status" aria-live="polite">
      <div className="celebration-burst" aria-hidden="true">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className={`burst-particle burst-${particle.shape}`}
            style={{
              '--burst-x': `${particle.x}vw`,
              '--burst-y': `${particle.y}vh`,
              '--burst-color': particle.color,
              '--burst-delay': `${particle.delay}s`,
              '--burst-duration': `${particle.duration}s`,
              '--burst-spin': `${particle.spin}deg`,
              '--burst-size': `${particle.size}px`,
            } as CSSProperties}
          >
            {particle.shape === 'star' ? '✦' : null}
          </span>
        ))}
      </div>
      <div className="celebration-message">
        <span className="celebration-sparkle" aria-hidden="true">✦</span>
        <strong>ĐÃ NỘP BÀI!</strong>
        <span>Nỗ lực của bạn đã được ghi nhận!</span>
        <span className="celebration-mini-stars" aria-hidden="true">✦　✧　✦</span>
      </div>
    </div>
  );
}
