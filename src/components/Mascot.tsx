import type { CSSProperties } from 'react';

type MascotPose = 'wave' | 'checklist' | 'thinking' | 'celebrate' | 'writing' | 'encourage';

const poseFiles: Record<MascotPose, string> = {
  wave: '/brand/mascot-wave.webp',
  checklist: '/brand/mascot-checklist.webp',
  thinking: '/brand/mascot-thinking.webp',
  celebrate: '/brand/mascot-celebrate.webp',
  writing: '/brand/mascot-writing.webp',
  encourage: '/brand/mascot-encourage.webp',
};

const poseLabels: Record<MascotPose, string> = {
  wave: 'Mascot vẫy tay',
  checklist: 'Mascot hoàn thành checklist',
  thinking: 'Mascot đang suy nghĩ',
  celebrate: 'Mascot ăn mừng',
  writing: 'Mascot đang viết',
  encourage: 'Mascot động viên',
};

export function Mascot({ size = 112, className = '', pose = 'encourage' }: { size?: number; className?: string; pose?: MascotPose }) {
  const style: CSSProperties = { width: size, height: size, objectFit: 'contain' };
  return (
    <img
      className={`mascot-art ${className}`}
      style={style}
      src={poseFiles[pose]}
      alt={poseLabels[pose]}
      loading="lazy"
      decoding="async"
    />
  );
}
