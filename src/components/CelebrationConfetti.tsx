const pieces = Array.from({ length: 54 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 100}%`,
  delay: `${(index % 12) * 0.045}s`,
  drift: `${((index * 19) % 100) - 50}px`,
  rotate: `${(index * 53) % 180}deg`,
}));

export function CelebrationConfetti() {
  return (
    <div className="celebration-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            ['--drift' as string]: piece.drift,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}
