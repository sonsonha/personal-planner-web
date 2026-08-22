/** Soft column packing for overlapping calendar blocks (minutes-based). */

export type OverlapBlock = {
  id: string;
  start: number; // minutes from midnight
  duration: number;
};

export type LaidOutBlock<T extends OverlapBlock> = T & {
  col: number;
  numCols: number;
};

export function resolveOverlapLayout<T extends OverlapBlock>(blocks: T[]): LaidOutBlock<T>[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.duration - a.duration);
  const colEndTimes: number[] = [];

  const assigned = sorted.map((block) => {
    const end = block.start + block.duration;
    let col = colEndTimes.findIndex((t) => t <= block.start);
    if (col === -1) col = colEndTimes.length;
    colEndTimes[col] = end;
    return { ...block, col, numCols: 1 };
  });

  for (const a of assigned) {
    const aEnd = a.start + a.duration;
    const concurrent = assigned.filter((b) => {
      const bEnd = b.start + b.duration;
      return b.start < aEnd && bEnd > a.start;
    });
    a.numCols = concurrent.reduce((max, b) => Math.max(max, b.col + 1), 1);
  }

  return assigned;
}

export function overlapGeometry(col: number, numCols: number, gapPx = 2) {
  const colW = 100 / Math.max(1, numCols);
  const leftPct = col * colW;
  const rightPct = 100 - (col + 1) * colW;
  return {
    left: `calc(${leftPct}% + ${gapPx}px)`,
    right: `calc(${rightPct}% + ${gapPx}px)`,
  };
}
