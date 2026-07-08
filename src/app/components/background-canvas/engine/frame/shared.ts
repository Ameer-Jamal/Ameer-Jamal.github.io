import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';

export function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  const width = r * 2.3;
  const height = r * 2.3;
  ctx.moveTo(x, y + height / 4);
  ctx.bezierCurveTo(x, y - height / 2, x - width / 2, y - height / 2, x - width / 2, y + height / 4);
  ctx.bezierCurveTo(x - width / 2, y + height * 0.75, x, y + height * 0.75, x, y + height * 0.95);
  ctx.bezierCurveTo(x, y + height * 0.75, x + width / 2, y + height * 0.75, x + width / 2, y + height / 4);
  ctx.bezierCurveTo(x + width / 2, y - height / 2, x, y - height / 2, x, y + height / 4);
}
