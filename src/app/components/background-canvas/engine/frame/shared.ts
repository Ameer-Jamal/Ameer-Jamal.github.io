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

export function drawCosmicBlackHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number
): void {
  if (radius <= 0.1) return;
  
  const time = Date.now() / 450;

  // 1. Swirling Cosmic Neon Aurora (wavy curtains of light in Purple, Cyan, Magenta)
  ctx.save();
  for (let layer = 0; layer < 3; layer++) {
    const layerOffset = layer * (Math.PI / 3);
    const layerRad = radius * (1.7 + layer * 0.35);
    ctx.beginPath();
    
    const pointsCount = 36;
    for (let p = 0; p <= pointsCount; p++) {
      const angle = (p / pointsCount) * Math.PI * 2;
      const ripple = Math.sin(angle * 5 - time * 2.5 + layerOffset) * radius * 0.18;
      const rx = x + Math.cos(angle) * (layerRad + ripple);
      const ry = y + Math.sin(angle) * (layerRad + ripple);
      if (p === 0) {
        ctx.moveTo(rx, ry);
      } else {
        ctx.lineTo(rx, ry);
      }
    }
    ctx.closePath();
    
    // Original beautiful cosmic colors: Cyan, Purple, Magenta
    ctx.strokeStyle = layer === 0
      ? `rgba(130, 80, 255, ${0.28 * alpha * (1.0 - layer * 0.25)})` // Neon Purple
      : layer === 1
      ? `rgba(0, 240, 255, ${0.24 * alpha * (1.0 - layer * 0.25)})`  // Neon Cyan
      : `rgba(230, 100, 255, ${0.24 * alpha * (1.0 - layer * 0.25)})`; // Neon Magenta
    ctx.lineWidth = radius * 0.25;
    ctx.stroke();
  }

  // 2. Gravitational lensing outer corona (glowing violet/cyan aura matching original site look)
  const lensingGrad = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 3.5);
  lensingGrad.addColorStop(0, `rgba(230, 100, 255, ${0.30 * alpha})`); // Neon Magenta
  lensingGrad.addColorStop(0.4, `rgba(130, 80, 255, ${0.16 * alpha})`); // Neon Purple
  lensingGrad.addColorStop(0.85, `rgba(0, 240, 255, ${0.05 * alpha})`); // Neon Cyan
  lensingGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = lensingGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.5, 0, Math.PI * 2);
  ctx.fill();

  // 3. Accretion Disk (Neon Cyan & Neon Magenta loops)
  // Outer Neon Cyan accretion loop
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.55 + Math.sin(time * 1.2) * radius * 0.08, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 240, 255, ${0.68 * alpha})`;
  ctx.lineWidth = radius * 0.16;
  ctx.stroke();

  // Inner Neon Magenta accretion loop
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.28 + Math.cos(time * 1.6) * radius * 0.05, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(230, 100, 255, ${0.78 * alpha})`;
  ctx.lineWidth = radius * 0.09;
  ctx.stroke();

  // Event Horizon sharp outline
  ctx.beginPath();
  ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * alpha})`;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 4. Orbiting Gravity bent light whiskers (Cyan / Magenta)
  for (let i = 0; i < 3; i++) {
    const rotAngle = time * (1.3 + i * 0.25) + (i * Math.PI * 2 / 3);
    const orbitR = radius * (1.35 + i * 0.12);
    const px = x + Math.cos(rotAngle) * orbitR;
    const py = y + Math.sin(rotAngle) * orbitR;
    
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.cos(rotAngle + 0.35) * (radius * 0.5), py - Math.sin(rotAngle + 0.35) * (radius * 0.5));
    ctx.strokeStyle = i % 2 === 0 ? `rgba(0, 240, 255, ${0.70 * alpha})` : `rgba(230, 100, 255, ${0.70 * alpha})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // 5. Pure event horizon singularity core
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  
  ctx.restore();
}
