import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { SandboxChargeTier } from '../../models/cosmic.types';
import { spawnStardustPuff } from '../particle-system';

export function releaseStellarLassoPower(engine: CosmicCanvasEngine, intensity: SandboxChargeTier = 'tap'): void {
  const launchSpeed = intensity === 'super' ? 24.0 : intensity === 'charged' ? 17.0 : 12.0;

  // Blast shockwave and shake screen for massive punch!
  engine.world.shockwaves.push({
    x: engine.world.mouse.x,
    y: engine.world.mouse.y,
    radius: 0,
    maxRadius: intensity === 'super' ? 280 : 180,
    speed: 8.5,
    alpha: 0.95,
    color: '255, 200, 50'
  });
  engine.world.shakeTimer = intensity === 'super' ? 24 : intensity === 'charged' ? 18 : 12;

  // Determine main shotgun launch direction based on mouse velocity
  let baseLaunchAngle = Math.random() * Math.PI * 2;
  const mouseSpeedSq = engine.world.mouseVelocity.x ** 2 + engine.world.mouseVelocity.y ** 2;
  const isMoving = mouseSpeedSq > 1.2;
  if (isMoving) {
    baseLaunchAngle = Math.atan2(engine.world.mouseVelocity.y, engine.world.mouseVelocity.x);
  }

  for (const p of engine.world.particles) {
    if (p.isLassoed) {
      p.isLassoed = false;

      // If stationary mouse release: blast outward from cursor center.
      // If dragging mouse release: fire in a tight shotgun cone (spread of 0.3 radians) in the drag direction!
      const angle = isMoving
        ? baseLaunchAngle + (Math.random() - 0.5) * 0.30
        : Math.atan2(p.y - engine.world.mouse.y, p.x - engine.world.mouse.x) + (Math.random() - 0.5) * 0.15;

      p.vx = Math.cos(angle) * (launchSpeed * (0.85 + Math.random() * 0.35));
      p.vy = Math.sin(angle) * (launchSpeed * (0.85 + Math.random() * 0.35));

      p.colorBlend = 1.0;

      // Spawn stardust sparks
      if (Math.random() < 0.45) {
        spawnStardustPuff(engine, p.x, p.y, p.colorPrefix);
      }
    }
  }
}
