import { ConstellationTemplate } from './cosmic.types';

type Pt = { x: number; y: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sample evenly spaced points along a line segment (inclusive of both ends). */
function sampleSegment(x1: number, y1: number, x2: number, y2: number, count: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    pts.push({ x: lerp(x1, x2, t), y: lerp(y1, y2, t) });
  }
  return pts;
}

const TOP = -0.42;
const BOTTOM = 0.42;
const A_HALF = 0.26;
const A_BAR_Y = 0.08;

/** Build a capital A around horizontal center cx. */
function buildLetterA(cx: number): Pt[] {
  return [
    ...sampleSegment(cx, TOP, cx - A_HALF, BOTTOM, 8),
    ...sampleSegment(cx, TOP, cx + A_HALF, BOTTOM, 8),
    ...sampleSegment(cx - A_HALF * 0.52, A_BAR_Y, cx + A_HALF * 0.52, A_BAR_Y, 5)
  ];
}

/** Build a capital Y (two arms meeting a junction, then a vertical stem). */
function buildLetterY(cx: number): Pt[] {
  const junctionY = -0.02;
  const arm = 0.24;
  return [
    ...sampleSegment(cx - arm, TOP, cx, junctionY, 6),
    ...sampleSegment(cx + arm, TOP, cx, junctionY, 6),
    ...sampleSegment(cx, junctionY, cx, BOTTOM, 6)
  ];
}

/** Normalized stroke vertices for A · Y · A (roughly -1..1 horizontal span). */
export const AYA_LETTER_POINTS: Pt[] = [
  ...buildLetterA(-0.72),
  ...buildLetterY(0),
  ...buildLetterA(0.72)
];

/** "I love you" message rendered as a star constellation below the name. */
export const ILOVEYOU_CONSTELLATION: ConstellationTemplate = {
  points: [
    // I
    { x: -1.35, y: -0.12 },
    { x: -1.35, y: 0.12 },
    // l
    { x: -1.05, y: -0.12 },
    { x: -1.05, y: 0.12 },
    // o
    { x: -0.82, y: 0 },
    { x: -0.72, y: -0.1 },
    { x: -0.62, y: 0 },
    { x: -0.72, y: 0.1 },
    // v
    { x: -0.48, y: -0.12 },
    { x: -0.38, y: 0.12 },
    { x: -0.28, y: -0.12 },
    // e
    { x: -0.12, y: 0 },
    { x: -0.02, y: -0.1 },
    { x: 0.08, y: -0.02 },
    { x: -0.02, y: 0.1 },
    { x: 0.08, y: 0.06 },
    // y
    { x: 0.28, y: -0.12 },
    { x: 0.38, y: 0.04 },
    { x: 0.48, y: -0.12 },
    { x: 0.32, y: 0.16 },
    // o
    { x: 0.68, y: 0 },
    { x: 0.78, y: -0.1 },
    { x: 0.88, y: 0 },
    { x: 0.78, y: 0.1 },
    // u
    { x: 1.05, y: -0.1 },
    { x: 1.05, y: 0.05 },
    { x: 1.2, y: 0.12 },
    { x: 1.2, y: -0.1 }
  ],
  connections: [
    [0, 1],
    [2, 3],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [8, 9], [9, 10],
    [11, 13], [13, 12], [12, 11], [11, 14], [14, 15],
    [16, 17], [18, 17], [17, 19],
    [20, 21], [21, 22], [22, 23], [23, 20],
    [24, 25], [25, 26], [26, 27]
  ]
};

export const AYA_CONSTELLATION: ConstellationTemplate = {
  points: [
    // First A (0 - 4)
    { x: -0.72, y: -0.42 },
    { x: -0.98, y: 0.42 },
    { x: -0.46, y: 0.42 },
    { x: -0.8552, y: 0.08 },
    { x: -0.5848, y: 0.08 },
    // Y (5 - 8)
    { x: -0.24, y: -0.42 },
    { x: 0.24, y: -0.42 },
    { x: 0, y: -0.02 },
    { x: 0, y: 0.42 },
    // Second A (9 - 13)
    { x: 0.72, y: -0.42 },
    { x: 0.46, y: 0.42 },
    { x: 0.98, y: 0.42 },
    { x: 0.5848, y: 0.08 },
    { x: 0.8552, y: 0.08 }
  ],
  connections: [
    [0, 1], [0, 2], [3, 4], // A
    [5, 7], [6, 7], [7, 8], // Y
    [9, 10], [9, 11], [12, 13] // A
  ]
};

export function getWorldLetterTargets(
  centerX: number,
  centerY: number,
  scale: number
): Pt[] {
  return AYA_LETTER_POINTS.map((p) => ({
    x: centerX + p.x * scale,
    y: centerY + p.y * scale
  }));
}

export function getAyaLetterScale(canvasWidth: number, canvasHeight: number): number {
  return Math.min(canvasWidth * 0.3, canvasHeight * 0.24, 360);
}
