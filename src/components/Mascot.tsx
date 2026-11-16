import type { CSSProperties } from 'react';

export function Mascot({ size = 112, className = '' }: { size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <svg className={`mascot-art ${className}`} style={style} viewBox="0 0 220 220" role="img" aria-label="Pip, the cheerful pencil mascot">
      <defs>
        <linearGradient id="pip-yellow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF49A" /><stop offset="1" stopColor="#FFB928" />
        </linearGradient>
        <linearGradient id="pip-pink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB6B8" /><stop offset="1" stopColor="#F27D91" />
        </linearGradient>
      </defs>
      <g className="mascot-bounce" stroke="#80502F" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <g transform="rotate(-35 110 110)">
          <rect x="77" y="27" width="66" height="139" rx="17" fill="url(#pip-yellow)" />
          <path d="M77 47q0-20 20-20h26q20 0 20 20v17H77Z" fill="#FF9CA8" />
          <path d="M77 64h66" stroke="#E77C87" strokeWidth="4" />
          <path d="M77 166h66l-33 43Z" fill="#F4C58B" />
          <path d="m98 193 12 16 12-16-12-9Z" fill="#5A4638" strokeWidth="3" />
          <ellipse cx="98" cy="105" rx="7" ry="10" fill="#513724" stroke="none" />
          <ellipse cx="122" cy="105" rx="7" ry="10" fill="#513724" stroke="none" />
          <circle cx="100" cy="101" r="2.5" fill="white" stroke="none" />
          <circle cx="124" cy="101" r="2.5" fill="white" stroke="none" />
          <ellipse cx="88" cy="120" rx="9" ry="5" fill="#FF8E91" stroke="none" />
          <ellipse cx="132" cy="120" rx="9" ry="5" fill="#FF8E91" stroke="none" />
          <path d="M101 127q9 10 18 0" fill="none" strokeWidth="4" />
          <path d="M77 88q-20-8-24 9M143 88q20-8 24 9" fill="none" strokeWidth="6" />
          <path d="M91 166q-13 18-25 10M129 166q13 18 25 10" fill="none" strokeWidth="6" />
          <path d="M86 77h48" stroke="#E6A51D" strokeWidth="3" opacity=".65" />
        </g>
      </g>
      <path d="m35 60 5-11 5 11 11 5-11 5-5 11-5-11-11-5Z" fill="#FF9B57" />
      <path d="m177 37 4-9 4 9 9 4-9 4-4 9-4-9-9-4Z" fill="#72B8FF" />
      <path d="m42 177 3-7 3 7 7 3-7 3-3 7-3-7-7-3Z" fill="#FF8295" />
    </svg>
  );
}
