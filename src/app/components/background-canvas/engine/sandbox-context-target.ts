import type {
  SandboxBlackhole,
  SandboxChronoWell,
  SandboxMeteor,
  SandboxPlanet,
  Wormhole
} from '../models/cosmic.types';
import type { CosmicCanvasEngine } from './cosmic-canvas-engine';
import { explodeMeteor } from './sandbox-powers/meteor';
import { shatterPlanet } from './sandbox-powers/planet';

export type SandboxContextTarget =
  | { type: 'PLANET'; ref: SandboxPlanet; label: string }
  | { type: 'BLACK_HOLE'; ref: SandboxBlackhole; label: string }
  | { type: 'WORMHOLE'; ref: Wormhole; label: string }
  | { type: 'CHRONO_WELL'; ref: SandboxChronoWell; label: string }
  | { type: 'METEOR'; ref: SandboxMeteor; label: string };

function isWithinHitRadius(targetX: number, targetY: number, radius: number, x: number, y: number): boolean {
  const dx = targetX - x;
  const dy = targetY - y;
  const hitRadius = Math.max(35, radius + 15);
  return dx * dx + dy * dy <= hitRadius * hitRadius;
}

export function findSandboxContextTarget(
  engine: CosmicCanvasEngine,
  x: number,
  y: number
): SandboxContextTarget | null {
  const planet = engine.world.sandboxPlanets.find(
    candidate => !candidate.isDying && isWithinHitRadius(candidate.x, candidate.y, candidate.radius, x, y)
  );
  if (planet) {
    return { type: 'PLANET', ref: planet, label: '🪐 Planet Forge' };
  }

  const blackHole = engine.world.sandboxBlackholes.find(
    candidate => !candidate.isDying && isWithinHitRadius(candidate.x, candidate.y, candidate.radius, x, y)
  );
  if (blackHole) {
    return { type: 'BLACK_HOLE', ref: blackHole, label: '🕳️ Event Horizon' };
  }

  const wormhole = engine.world.wormholes.find(
    candidate => isWithinHitRadius(candidate.x, candidate.y, candidate.radius, x, y)
  );
  if (wormhole) {
    const portalLabel = wormhole.type === 'ENTRY' ? 'Entry' : 'Exit';
    return { type: 'WORMHOLE', ref: wormhole, label: `🌀 Wormhole ${portalLabel}` };
  }

  const chronoWell = engine.world.sandboxChronoWells.find(
    candidate => !candidate.isDying && isWithinHitRadius(candidate.x, candidate.y, candidate.radius, x, y)
  );
  if (chronoWell) {
    return { type: 'CHRONO_WELL', ref: chronoWell, label: '⏳ Chrono Well' };
  }

  const meteor = engine.world.sandboxMeteors.find(
    candidate => !candidate.exploded && isWithinHitRadius(candidate.x, candidate.y, candidate.radius, x, y)
  );
  return meteor ? { type: 'METEOR', ref: meteor, label: '☄️ Active Meteor' } : null;
}

export function vaporizeSandboxContextTarget(
  engine: CosmicCanvasEngine,
  target: SandboxContextTarget
): void {
  switch (target.type) {
    case 'PLANET':
      if (engine.world.sandboxPlanets.includes(target.ref)) {
        target.ref.health = 0;
        shatterPlanet(engine, target.ref);
      }
      break;
    case 'BLACK_HOLE':
      if (engine.world.sandboxBlackholes.includes(target.ref)) {
        target.ref.isDying = true;
      }
      break;
    case 'WORMHOLE': {
      const index = engine.world.wormholes.indexOf(target.ref);
      if (index !== -1) {
        engine.world.wormholes.splice(index, 1);
        engine.world.wormholeHypergateTimer = 0;
      }
      break;
    }
    case 'CHRONO_WELL':
      if (engine.world.sandboxChronoWells.includes(target.ref)) {
        target.ref.isDying = true;
      }
      break;
    case 'METEOR':
      if (engine.world.sandboxMeteors.includes(target.ref)) {
        explodeMeteor(engine, target.ref);
      }
      break;
  }
}
