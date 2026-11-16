import type { CSSProperties } from 'react';

export function Mascot({ size = 112, className = '' }: { size?: number; className?: string }) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <svg
      className={`mascot-art ${className}`}
      style={style}
      viewBox="0 0 220 220"
      role="img"
      aria-label="Mầm, the Happy Study Club star mascot"
    >
      <defs>
        <linearGradient id="mam-star" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF49A" />
          <stop offset="1" stopColor="#FFC928" />
        </linearGradient>
        <linearGradient id="mam-bag" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A7F0D0" />
          <stop offset="1" stopColor="#54C99A" />
        </linearGradient>
      </defs>
      <g className="mascot-bounce" stroke="#8B542B" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M109 17 132 63 183 70 146 106 155 157 109 133 63 157 72 106 35 70 86 63Z" fill="url(#mam-star)" />
        <path d="M47 113c-16 2-25 15-22 29 3 13 17 20 31 13l17-10-8-25Z" fill="#FFD34F" />
        <path d="M164 107c14-7 30 1 33 15 3 13-7 26-21 27l-19-1-8-25Z" fill="#FFD34F" />
        <path d="M68 151c-13 17-9 35 4 42 12 7 27 1 30-13l4-20-25-17Z" fill="#FFD34F" />
        <path d="M126 159c-2 16 9 28 23 27 13-1 21-14 15-27l-10-18-25 7Z" fill="#FFD34F" />
        <path d="M39 131c-1-20 10-34 28-37l18 16-8 36-18 14c-15-4-21-14-20-29Z" fill="url(#mam-bag)" />
        <path d="M155 120c2-19 16-30 31-26 14 4 22 18 17 32l-8 26-26 8-16-17Z" fill="url(#mam-bag)" />
        <path d="M161 149c8-11 20-15 31-10l9 12-4 24-24 7-15-13Z" fill="#78D9B1" />
        <path d="M178 155h15v13h-15z" fill="#FFF7DE" strokeWidth="3" />
        <path d="M183 177l5-7 5 7-5 6Z" fill="#FFD84D" strokeWidth="2.5" />
        <ellipse cx="87" cy="91" rx="9" ry="13" fill="#55351F" stroke="none" />
        <ellipse cx="132" cy="91" rx="9" ry="13" fill="#55351F" stroke="none" />
        <circle cx="90" cy="86" r="3" fill="white" stroke="none" />
        <circle cx="135" cy="86" r="3" fill="white" stroke="none" />
        <ellipse cx="69" cy="112" rx="12" ry="7" fill="#FF9A91" stroke="none" opacity=".85" />
        <ellipse cx="151" cy="112" rx="12" ry="7" fill="#FF9A91" stroke="none" opacity=".85" />
        <path d="M96 111c8 12 20 12 28 0" fill="none" />
      </g>
      <path d="M24 57l5-10 5 10 10 5-10 5-5 10-5-10-10-5Z" fill="#FF9B57" />
      <path d="M184 36l4-8 4 8 8 4-8 4-4 8-4-8-8-4Z" fill="#72B8FF" />
      <path d="M42 180l3-6 3 6 6 3-6 3-3 6-3-6-6-3Z" fill="#FF8295" />
    </svg>
  );
}
