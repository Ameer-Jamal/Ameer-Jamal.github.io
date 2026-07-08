import type { CosmicCanvasEngine } from '../cosmic-canvas-engine';
import { getMaxParticles, getMaxParticles as _unusedGetMaxParticles } from '../cosmic-world';
import { playSupernovaPop } from '../audio';
import { isSandboxPowerChannelActive } from '../state-machine';
import { releaseStellarLassoPower } from './stellar-lasso';
import { getSandboxChargeProgress } from './charge';

export function updateAndDrawSandboxElements(engine: CosmicCanvasEngine, width: number, height: number): void {
    const hypergateActive = engine.world.wormholeHypergateTimer > 0;

    // Clean up completely collapsed black holes
    engine.world.sandboxBlackholes = engine.world.sandboxBlackholes.filter(
      sbh => !sbh.isDying || sbh.radius > 0
    );

    // 1. Sandbox Black holes — persistent until CLEAR or replaced
    for (const sbh of engine.world.sandboxBlackholes) {
      const panelWidth = width <= 600 ? 280 : 380;
      const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;
      if (engine.world.isSandboxOpen && sbh.x > activeWidth && engine.world.draggedBlackhole !== sbh) {
        sbh.x = Math.max(activeWidth - 25, sbh.x - 3.5);
      }

      if (sbh.isDying) {
        sbh.radius -= sbh.maxRadius / 30; // Collapse to 0 over 30 frames (0.5s)
        if (sbh.radius < 0) {
          sbh.radius = 0;
        }
      } else {
        sbh.timer++;
        if (sbh.timer < 60) {
          sbh.radius = sbh.maxRadius * (sbh.timer / 60);
        } else {
          sbh.radius = sbh.maxRadius;
        }
      }

      const sbhRadius = sbh.radius;
      const pulse = Math.sin(Date.now() / 80 + sbh.x) * sbhRadius * 0.2;

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbh.pullRadius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(230, 100, 255, ${0.08 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 1;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius, 0, Math.PI * 2);
      engine.world.ctx.fillStyle = 'rgba(2, 4, 10, 0.98)';
      engine.world.ctx.fill();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.45 + pulse, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(230, 100, 255, ${0.65 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 2.0;
      engine.world.ctx.stroke();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(sbh.x, sbh.y, sbhRadius * 1.2 + pulse * 0.5, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * (sbh.radius / sbh.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.0;
      engine.world.ctx.stroke();
    }

    // 1.5. Sandbox Chrono Wells
    engine.world.sandboxChronoWells = engine.world.sandboxChronoWells.filter(
      cw => !cw.isDying || cw.radius > 0
    );

    for (const cw of engine.world.sandboxChronoWells) {
      const panelWidth = width <= 600 ? 280 : 380;
      const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;
      if (engine.world.isSandboxOpen && cw.x > activeWidth && engine.world.draggedChronoWell !== cw) {
        cw.x = Math.max(activeWidth - 25, cw.x - 3.5);
      }

      if (cw.isDying) {
        cw.radius -= cw.maxRadius / 30; // Collapse to 0 over 30 frames (0.5s)
        if (cw.radius < 0) {
          cw.radius = 0;
        }
      } else {
        cw.timer++;
        if (cw.timer < 60) {
          cw.radius = cw.maxRadius * (cw.timer / 60);
        } else {
          cw.radius = cw.maxRadius;
        }
      }

      const pulse = Math.sin(Date.now() / 80 + cw.x) * cw.radius * 0.08;
      const radius = cw.radius + pulse;

      // Draw glowing chrono bubble fill
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(cw.x, cw.y, radius, 0, Math.PI * 2);
      const radGrad = engine.world.ctx.createRadialGradient(cw.x, cw.y, 8, cw.x, cw.y, radius);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
      radGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.08)');
      radGrad.addColorStop(1.0, `rgba(0, 240, 255, ${0.2 * (cw.radius / cw.maxRadius)})`);
      engine.world.ctx.fillStyle = radGrad;
      engine.world.ctx.fill();

      // Draw rotating dashed clock ring
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(cw.x, cw.y, radius, Date.now() / 1500 + cw.x, Date.now() / 1500 + cw.x + Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 * (cw.radius / cw.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);

      // Draw sweeping clock hand
      const sweepAngle = ((Date.now() / 1000) + cw.x) % (Math.PI * 2);
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(cw.x, cw.y);
      engine.world.ctx.lineTo(cw.x + Math.cos(sweepAngle) * radius, cw.y + Math.sin(sweepAngle) * radius);
      engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${0.22 * (cw.radius / cw.maxRadius)})`;
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.stroke();
    }

    // 1.7. Sandbox Planets
    engine.world.sandboxPlanets = engine.world.sandboxPlanets.filter(
      pl => !pl.isDying || (pl.deathTimer !== undefined && pl.deathTimer > 0)
    );

    for (const pl of engine.world.sandboxPlanets) {
      const panelWidth = width <= 600 ? 280 : 380;
      const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;
      if (engine.world.isSandboxOpen && pl.x > activeWidth && engine.world.draggedPlanet !== pl) {
        pl.x = Math.max(activeWidth - 25, pl.x - 3.5);
      }

      if (pl.isDying) {
        if (pl.deathTimer === undefined) pl.deathTimer = 30;
        pl.deathTimer--;
        pl.radius -= pl.radius / 10;
        if (pl.radius < 0.5) pl.radius = 0;
      } else {
        // Decay damage flash counter
        if (pl.damageFlash > 0) pl.damageFlash--;

        // Spin fragments like asteroids
        if (pl.isFragment && pl.rotation !== undefined && pl.rotationSpeed !== undefined) {
          pl.rotation += pl.rotationSpeed;
        }

        // Update velocity & position for planetary pieces
        if (pl.vx !== undefined && pl.vy !== undefined) {
          pl.x += pl.vx;
          pl.y += pl.vy;
          pl.vx *= 0.96; // soft space drag
          pl.vy *= 0.96;

          // Bounce off canvas boundaries
          const bounceFactor = 0.65;
          if (pl.x - pl.radius < 0) {
            pl.x = pl.radius;
            pl.vx = -pl.vx * bounceFactor;
          } else if (pl.x + pl.radius > width) {
            pl.x = width - pl.radius;
            pl.vx = -pl.vx * bounceFactor;
          }

          if (pl.y - pl.radius < 0) {
            pl.y = pl.radius;
            pl.vy = -pl.vy * bounceFactor;
          } else if (pl.y + pl.radius > height) {
            pl.y = height - pl.radius;
            pl.vy = -pl.vy * bounceFactor;
          }
        }
      }

      const radius = pl.radius;
      if (radius <= 0) continue;

      let theme;
      try {
        theme = JSON.parse(pl.color);
      } catch (e) {
        theme = {
          name: 'emerald',
          inner: 'rgba(100, 255, 180, 1)',
          mid: 'rgba(20, 180, 120, 1)',
          outer: 'rgba(5, 50, 35, 1)',
          glow: 'rgba(0, 255, 140, 0.45)',
          sparkColor: 'rgba(50, 255, 180,'
        };
      }

      // Draw planet atmosphere glow (with safe non-negative radii to prevent Canvas DOM Exceptions)
      // Asteroid fragments skip the glow and ring — they are bare rocky chunks.
      if (!pl.isFragment) {
        const rGlow0 = Math.max(0.1, radius - 4);
        const rGlow1 = Math.max(0.1, radius + 12);
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(pl.x, pl.y, rGlow1, 0, Math.PI * 2);
        const glowGrad = engine.world.ctx.createRadialGradient(pl.x, pl.y, rGlow0, pl.x, pl.y, rGlow1);
        glowGrad.addColorStop(0, theme.glow);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        engine.world.ctx.fillStyle = glowGrad;
        engine.world.ctx.fill();
      }

      // Draw the body — spinning asteroid polygon for fragments,
      // smooth radial-gradiant sphere for full planets.
      if (pl.isFragment) {
        const rBody1 = Math.max(0.1, radius);
        const verts = pl.vertices;
        const rot = pl.rotation ?? 0;
        const vcount = verts ? verts.length : 6;

        engine.world.ctx.beginPath();
        for (let k = 0; k < vcount; k++) {
          const a = (Math.PI * 2 * k) / vcount + rot;
          const r = rBody1 * (verts ? verts[k] : (0.7 + 0.3 * Math.sin(k)));
          const vx = pl.x + Math.cos(a) * r;
          const vy = pl.y + Math.sin(a) * r;
          if (k === 0) engine.world.ctx.moveTo(vx, vy);
          else engine.world.ctx.lineTo(vx, vy);
        }
        engine.world.ctx.closePath();

        // Rocky asteroid fill with a subtle radial gradient
        const grad = engine.world.ctx.createRadialGradient(
          pl.x - radius * 0.15, pl.y - radius * 0.15, radius * 0.05,
          pl.x, pl.y, rBody1
        );
        grad.addColorStop(0, '#8a8a8a');
        grad.addColorStop(0.45, '#5a5a5a');
        grad.addColorStop(1, '#2a2a2a');
        engine.world.ctx.fillStyle = grad;
        engine.world.ctx.fill();

        // Crisp rocky edge
        engine.world.ctx.strokeStyle = '#1a1a1a';
        engine.world.ctx.lineWidth = 1.8;
        engine.world.ctx.stroke();

        // Subtle highlight edge inside
        engine.world.ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
        engine.world.ctx.lineWidth = 1.0;
        engine.world.ctx.stroke();
      } else {
        const rBody0 = Math.max(0.1, radius * 0.1);
        const rBody1 = Math.max(0.1, radius);
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(pl.x, pl.y, rBody1, 0, Math.PI * 2);
        const planetGrad = engine.world.ctx.createRadialGradient(pl.x - radius * 0.3, pl.y - radius * 0.3, rBody0, pl.x, pl.y, rBody1);
        planetGrad.addColorStop(0, theme.inner);
        planetGrad.addColorStop(0.65, theme.mid);
        planetGrad.addColorStop(1.0, theme.outer);
        engine.world.ctx.fillStyle = planetGrad;
        engine.world.ctx.fill();
      }

      // Damage flash overlay — white pulse when hit but not shattered
      if (!pl.isDying && pl.damageFlash > 0) {
        engine.world.ctx.beginPath();
        if (pl.isFragment) {
          const rBody1 = Math.max(0.1, radius);
          const verts = pl.vertices;
          const rot = pl.rotation ?? 0;
          const vcount = verts ? verts.length : 6;
          for (let k = 0; k < vcount; k++) {
            const a = (Math.PI * 2 * k) / vcount + rot;
            const r = rBody1 * (verts ? verts[k] : 0.8);
            const vx = pl.x + Math.cos(a) * r;
            const vy = pl.y + Math.sin(a) * r;
            if (k === 0) engine.world.ctx.moveTo(vx, vy);
            else engine.world.ctx.lineTo(vx, vy);
          }
          engine.world.ctx.closePath();
        } else {
          engine.world.ctx.arc(pl.x, pl.y, Math.max(0.1, radius), 0, Math.PI * 2);
        }
        const flashAlpha = pl.damageFlash / 6 * 0.55;
        engine.world.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        engine.world.ctx.fill();
      }

      // Draw thin elegant ring system if it is sapphire or ruby theme (planet only, not fragment)
      if (!pl.isFragment && (theme.name === 'sapphire' || theme.name === 'ruby')) {
        engine.world.ctx.save();
        engine.world.ctx.translate(pl.x, pl.y);
        engine.world.ctx.rotate(-Math.PI / 6);
        engine.world.ctx.scale(1.8, 0.35);
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(0, 0, Math.max(0.1, radius * 1.05), 0, Math.PI * 2);
        engine.world.ctx.strokeStyle = theme.name === 'sapphire' ? 'rgba(120, 200, 255, 0.45)' : 'rgba(255, 160, 120, 0.45)';
        engine.world.ctx.lineWidth = 3.0;
        engine.world.ctx.stroke();
        engine.world.ctx.restore();
      }

      // Draw a subtle orbit gravity range indicator ring (faded dotted line at pl.radius + 250)
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(pl.x, pl.y, radius + 250, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(255, 255, 255, 0.04)`;
      engine.world.ctx.lineWidth = 0.8;
      engine.world.ctx.setLineDash([4, 12]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
    }

    // 2. Sandbox Wormholes
    const wLen = engine.world.wormholes.length;
    for (let i = 0; i < wLen; i++) {
      const wh = engine.world.wormholes[i];
      const panelWidth = width <= 600 ? 280 : 380;
      const activeWidth = engine.world.isSandboxOpen ? Math.max(100, width - panelWidth) : width;
      if (engine.world.isSandboxOpen && wh.x > activeWidth && engine.world.draggedWormhole !== wh) {
        wh.x = Math.max(activeWidth - 25, wh.x - 3.5);
      }

      wh.pulsePhase += 0.05;

      const pulse = Math.sin(wh.pulsePhase) * 4;
      const radius = wh.radius + pulse;

      const grad = engine.world.ctx.createRadialGradient(wh.x, wh.y, 2, wh.x, wh.y, radius * 1.5);
      const colorStr = wh.type === 'ENTRY' ? '0, 240, 255' : '255, 100, 230';
      grad.addColorStop(0, `rgba(10, 15, 30, 0.9)`);
      grad.addColorStop(0.5, `rgba(${colorStr}, 0.5)`);
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      engine.world.ctx.fillStyle = grad;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(wh.x, wh.y, radius * 1.5, 0, Math.PI * 2);
      engine.world.ctx.fill();

      engine.world.ctx.beginPath();
      engine.world.ctx.arc(wh.x, wh.y, radius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = `rgba(${colorStr}, 0.85)`;
      engine.world.ctx.lineWidth = 2.5;
      engine.world.ctx.stroke();

      engine.world.ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const spiralAngle = wh.pulsePhase + (j * Math.PI) / 2;
        const sx = wh.x + Math.cos(spiralAngle) * (radius * 0.7);
        const sy = wh.y + Math.sin(spiralAngle) * (radius * 0.7);
        engine.world.ctx.moveTo(wh.x, wh.y);
        engine.world.ctx.quadraticCurveTo(wh.x + Math.sin(spiralAngle)*radius*0.4, wh.y + Math.cos(spiralAngle)*radius*0.4, sx, sy);
      }
      engine.world.ctx.strokeStyle = `rgba(${colorStr}, 0.45)`;
      engine.world.ctx.lineWidth = 1.0;
      engine.world.ctx.stroke();
    }

    if (engine.world.wormholes.length === 2 && hypergateActive) {
      const entry = engine.world.wormholes[0];
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(entry.x, entry.y, entry.radius * 2.2, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      engine.world.ctx.lineWidth = 2;
      engine.world.ctx.setLineDash([8, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
    }

    // 3. Anti-Gravity repulsion field visual (while gravity paused on click/hold)
    if (engine.world.activePower === 'REPELLER' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
      engine.world.ctx.save();
      const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.2;
      const fieldRadius = 220 + charge * 220;
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, fieldRadius, 0, Math.PI * 2);
      const repelGrad = engine.world.ctx.createRadialGradient(engine.world.mouse.x, engine.world.mouse.y, 18, engine.world.mouse.x, engine.world.mouse.y, fieldRadius);
      repelGrad.addColorStop(0, 'rgba(255, 100, 180, 0.06)');
      repelGrad.addColorStop(0.55, 'rgba(255, 80, 120, 0.14)');
      repelGrad.addColorStop(1.0, 'rgba(255, 60, 100, 0.28)');
      engine.world.ctx.fillStyle = repelGrad;
      engine.world.ctx.fill();
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, fieldRadius, 0, Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(255, 120, 180, 0.35)';
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([6, 10]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);
      engine.world.ctx.restore();
    }

    // 4. Chrono Well bubble visual (always active around mouse cursor when selected)
    if (engine.world.activePower === 'TIME_DILATION' && engine.world.mouse.active && engine.world.mouse.x !== -1000) {
      engine.world.ctx.save();
      const charge = engine.world.isMouseDown ? getSandboxChargeProgress(engine) : 0.25;
      const bubbleRadius = 180 + charge * 180;

      // Draw glowing chrono bubble background
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, bubbleRadius, 0, Math.PI * 2);
      const radGrad = engine.world.ctx.createRadialGradient(engine.world.mouse.x, engine.world.mouse.y, 10, engine.world.mouse.x, engine.world.mouse.y, bubbleRadius);
      radGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
      radGrad.addColorStop(0.8, 'rgba(0, 240, 255, 0.10)');
      radGrad.addColorStop(1.0, 'rgba(0, 240, 255, 0.24)');
      engine.world.ctx.fillStyle = radGrad;
      engine.world.ctx.fill();

      // Draw outer rotating dashed clock ring
      engine.world.ctx.beginPath();
      engine.world.ctx.arc(engine.world.mouse.x, engine.world.mouse.y, bubbleRadius, Date.now() / 1200, Date.now() / 1200 + Math.PI * 2);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      engine.world.ctx.lineWidth = 1.5;
      engine.world.ctx.setLineDash([8, 12]);
      engine.world.ctx.stroke();
      engine.world.ctx.setLineDash([]);

      // Draw inner sweeping radar time-line
      const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);
      engine.world.ctx.beginPath();
      engine.world.ctx.moveTo(engine.world.mouse.x, engine.world.mouse.y);
      engine.world.ctx.lineTo(engine.world.mouse.x + Math.cos(sweepAngle) * bubbleRadius, engine.world.mouse.y + Math.sin(sweepAngle) * bubbleRadius);
      engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      engine.world.ctx.lineWidth = 2.0;
      engine.world.ctx.stroke();

      engine.world.ctx.restore();
    }

    // 5. Nebular Wind Visual (while gravity paused + mouse held)
    if (engine.world.activePower === 'NEBULAR_WIND' && isSandboxPowerChannelActive(engine) && engine.world.mouse.active && engine.world.mouse.x !== -1000 && engine.world.isMouseDown) {
      const windSpeedSq = engine.world.mouseVelocity.x * engine.world.mouseVelocity.x + engine.world.mouseVelocity.y * engine.world.mouseVelocity.y;
      if (windSpeedSq > 0.5) {
        engine.world.ctx.save();
        const count = 5;
        engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        engine.world.ctx.lineWidth = 1.0;

        const speed = Math.sqrt(windSpeedSq);
        const vxNorm = engine.world.mouseVelocity.x / speed;
        const vyNorm = engine.world.mouseVelocity.y / speed;

        for (let j = 0; j < count; j++) {
          const r = Math.random() * 80;
          const theta = Math.random() * Math.PI * 2;
          const ox = Math.cos(theta) * r;
          const oy = Math.sin(theta) * r;

          const startX = engine.world.mouse.x + ox - vxNorm * 100;
          const startY = engine.world.mouse.y + oy - vyNorm * 100;
          const endX = engine.world.mouse.x + ox + vxNorm * 120;
          const endY = engine.world.mouse.y + oy + vyNorm * 120;

          engine.world.ctx.beginPath();
          engine.world.ctx.moveTo(startX, startY);
          engine.world.ctx.bezierCurveTo(
            startX + vxNorm * 50 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 50 + (Math.random() - 0.5) * 30,
            startX + vxNorm * 100 + (Math.random() - 0.5) * 30,
            startY + vyNorm * 100 + (Math.random() - 0.5) * 30,
            endX,
            endY
          );
          engine.world.ctx.stroke();
        }
        engine.world.ctx.restore();
      }
    }

    // 6. Draw active Stellar Lasso drawn rope path
    if (engine.world.activePower === 'STELLAR_LASSO' && engine.world.lassoPath && engine.world.lassoPath.length > 1) {
      // If pointer is released, shrink the trail points to snap collapse!
      if (!engine.world.isMouseDown) {
        const tip = engine.world.lassoPath[engine.world.lassoPath.length - 1];
        for (let i = 0; i < engine.world.lassoPath.length; i++) {
          engine.world.lassoPath[i].x += (tip.x - engine.world.lassoPath[i].x) * 0.28;
          engine.world.lassoPath[i].y += (tip.y - engine.world.lassoPath[i].y) * 0.28;
        }

        const start = engine.world.lassoPath[0];
        const dist = Math.sqrt((start.x - tip.x) ** 2 + (start.y - tip.y) ** 2);
        if (dist < 4.0 || engine.world.lassoPath.length <= 2) {
          engine.world.lassoPath = [];
          if (engine.world.lassoReleaseQueued) {
            engine.world.lassoReleaseQueued = false;
            releaseStellarLassoPower(engine, engine.world.lassoReleaseTier);
          }
        }
      }

      if (engine.world.lassoPath && engine.world.lassoPath.length > 1) {
        engine.world.ctx.save();

        // Draw outer glowing neon purple plasma aura
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(engine.world.lassoPath[0].x, engine.world.lassoPath[0].y);
        for (let i = 1; i < engine.world.lassoPath.length; i++) {
          engine.world.ctx.lineTo(engine.world.lassoPath[i].x, engine.world.lassoPath[i].y);
        }
        engine.world.ctx.strokeStyle = 'rgba(100, 0, 255, 0.24)';
        engine.world.ctx.lineWidth = 10.0;
        engine.world.ctx.lineCap = 'round';
        engine.world.ctx.lineJoin = 'round';
        engine.world.ctx.stroke();

        // Draw middle cyan electric rope core
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(engine.world.lassoPath[0].x, engine.world.lassoPath[0].y);
        for (let i = 1; i < engine.world.lassoPath.length; i++) {
          engine.world.ctx.lineTo(engine.world.lassoPath[i].x, engine.world.lassoPath[i].y);
        }
        engine.world.ctx.strokeStyle = 'rgba(0, 220, 255, 0.88)';
        engine.world.ctx.lineWidth = 3.5;
        engine.world.ctx.lineCap = 'round';
        engine.world.ctx.lineJoin = 'round';
        // Give it a dashed pattern so it looks like a braided energy rope!
        engine.world.ctx.setLineDash([7, 4]);
        engine.world.ctx.stroke();

        // Draw inner white-hot crackling wire core
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(engine.world.lassoPath[0].x, engine.world.lassoPath[0].y);
        for (let i = 1; i < engine.world.lassoPath.length; i++) {
          engine.world.ctx.lineTo(engine.world.lassoPath[i].x, engine.world.lassoPath[i].y);
        }
        engine.world.ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        engine.world.ctx.lineWidth = 1.2;
        engine.world.ctx.lineCap = 'round';
        engine.world.ctx.lineJoin = 'round';
        engine.world.ctx.setLineDash([]);
        engine.world.ctx.stroke();

        // Draw a glowing capture indicator loop at the tip of the lasso
        const tip = engine.world.lassoPath[engine.world.lassoPath.length - 1];
        const pulseRadius = 15 + Math.sin(Date.now() / 100) * 3;
        engine.world.ctx.beginPath();
        engine.world.ctx.arc(tip.x, tip.y, pulseRadius, 0, Math.PI * 2);
        engine.world.ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
        engine.world.ctx.lineWidth = 1.5;
        engine.world.ctx.stroke();

        engine.world.ctx.restore();
      }
    }

    // 7. Update and Draw Quantum Splitter spatial rifts
    if (engine.world.quantumRifts && engine.world.quantumRifts.length > 0) {
      const expired = engine.world.quantumRifts.filter(f => f.life <= 0.015);

      if (expired.length > 0) {
        let sumX = 0;
        let sumY = 0;
        let totalLength = 0;

        for (const r of expired) {
          sumX += (r.x1 + r.x2) / 2;
          sumY += (r.y1 + r.y2) / 2;
          const dx = r.x2 - r.x1;
          const dy = r.y2 - r.y1;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }

        const midX = sumX / expired.length;
        const midY = sumY / expired.length;

        // Scale explosion density and radius dynamically based on the length of the slashed rifts!
        const particleCount = Math.max(14, Math.min(35, Math.floor(totalLength / 10)));
        const explosionRadius = Math.max(110, Math.min(220, totalLength * 0.65));

        // Launch a single massive, glorious shockwave
        engine.world.shockwaves.push({
          x: midX,
          y: midY,
          radius: 0,
          maxRadius: explosionRadius,
          speed: 6.5,
          alpha: 1.0,
          color: '0, 240, 255'
        });

        // Spawn a dense, vibrant particle fountain that bypasses performance-heavy flocking loops
        for (let j = 0; j < particleCount; j++) {
          const angle = (j / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          const spd = Math.random() * 5.0 + 3.0; // high ejection velocity
          engine.world.particles.push({
            x: midX,
            y: midY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            baseVx: Math.cos(angle) * spd * 0.1,
            baseVy: Math.sin(angle) * spd * 0.1,
            radius: Math.random() * 1.3 + 0.6,
            baseRadius: Math.random() * 1.3 + 0.6,
            colorBlend: 1.0,
            wobbleTimer: 0,
            colorPrefix: Math.random() < 0.5 ? 'rgba(0, 240, 255,' : 'rgba(255, 0, 240,',
            flockable: false, // Prevents N^2 CPU overhead on distance checks
            life: Math.random() * 0.22 + 0.18, // short lifespan
            birthProgress: 1.0,
            deathProgress: 0,
            isDying: false,
            behaviorState: 'CRUISE',
            behaviorTimer: 50,
            speedFactor: 1.0,
            isLassoed: false
          });
        }
        playSupernovaPop();
      }

      engine.world.quantumRifts = engine.world.quantumRifts.filter(f => f.life > 0.015);
      for (const f of engine.world.quantumRifts) {
        f.life -= 0.0036; // Expire and explode in half the time (~4.5-5 seconds!)

        const alpha = f.life;
        if (alpha <= 0.01) continue;

        const dx = f.x2 - f.x1;
        const dy = f.y2 - f.y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        // A. Draw physical gaping tear in reality (opens up a dark void polygon!)
        const voidWidth = 14.0 * Math.min(1.0, alpha * 2.0); // wide in the middle, narrow at ends

        engine.world.ctx.save();
        engine.world.ctx.beginPath();
        engine.world.ctx.moveTo(f.x1 - nx * 2, f.y1 - ny * 2);

        const steps = 6;
        const ptsLeft: { x: number; y: number }[] = [];
        const ptsRight: { x: number; y: number }[] = [];

        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const factor = Math.sin(t * Math.PI); // widest at center, 0 at ends
          const wobble = Math.sin(Date.now() / 35 + s) * 3.5;
          const wLeft = (voidWidth * factor) + wobble;
          const wRight = -(voidWidth * factor) - wobble;

          ptsLeft.push({
            x: f.x1 + dx * t + nx * wLeft,
            y: f.y1 + dy * t + ny * wLeft
          });

          ptsRight.push({
            x: f.x1 + dx * t + nx * wRight,
            y: f.y1 + dy * t + ny * wRight
          });
        }

        for (const p of ptsLeft) {
          engine.world.ctx.lineTo(p.x, p.y);
        }
        engine.world.ctx.lineTo(f.x2 - nx * 2, f.y2 - ny * 2);

        for (let s = ptsRight.length - 1; s >= 0; s--) {
          const p = ptsRight[s];
          engine.world.ctx.lineTo(p.x, p.y);
        }

        engine.world.ctx.closePath();

        // Clip rendering to the reality tear slit boundary
        engine.world.ctx.save();
        engine.world.ctx.clip();

        // A. Draw deep void backdrop
        engine.world.ctx.fillStyle = '#04010d';
        engine.world.ctx.fillRect(Math.min(f.x1, f.x2) - 40, Math.min(f.y1, f.y2) - 40, Math.abs(dx) + 80, Math.abs(dy) + 80);

        // B. Swirling portal color nebulae inside the dimensional rift
        const centerX = (f.x1 + f.x2) / 2;
        const centerY = (f.y1 + f.y2) / 2;
        const portalRad = Math.max(2.0, (len / 2) + Math.sin(Date.now() / 150) * 12);

        const portalGrad = engine.world.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, portalRad);
        portalGrad.addColorStop(0, 'rgba(120, 0, 255, 0.55)');
        portalGrad.addColorStop(0.55, 'rgba(255, 0, 160, 0.35)');
        portalGrad.addColorStop(0.85, 'rgba(0, 230, 255, 0.22)');
        portalGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

        engine.world.ctx.fillStyle = portalGrad;
        engine.world.ctx.fillRect(Math.min(f.x1, f.x2) - 40, Math.min(f.y1, f.y2) - 40, Math.abs(dx) + 80, Math.abs(dy) + 80);

        // C. Draw swirling galaxy spirals inside the rift opening
        const timeFactor = Date.now() / 600;
        engine.world.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let j = 0; j < 8; j++) {
          const px = centerX + Math.cos(timeFactor + j) * (portalRad * 0.45 * (j / 8));
          const py = centerY + Math.sin(timeFactor + j) * (portalRad * 0.45 * (j / 8));
          engine.world.ctx.beginPath();
          engine.world.ctx.arc(px, py, 1.3, 0, Math.PI * 2);
          engine.world.ctx.fill();
        }

        engine.world.ctx.restore();

        // D. Outlines & Arcs around the portal borders
        engine.world.ctx.strokeStyle = `rgba(255, 0, 210, ${alpha * 0.95})`;
        engine.world.ctx.lineWidth = 3.2;
        engine.world.ctx.stroke();

        engine.world.ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.85})`;
        engine.world.ctx.lineWidth = 1.25;
        engine.world.ctx.stroke();

        // Draw micro arcing reality discharge inside the void gap
        if (Math.random() < 0.22 && ptsLeft.length > 0) {
          const arcIdx = Math.floor(Math.random() * ptsLeft.length);
          engine.world.ctx.beginPath();
          engine.world.ctx.moveTo(ptsLeft[arcIdx].x, ptsLeft[arcIdx].y);
          engine.world.ctx.lineTo(
            (ptsLeft[arcIdx].x + ptsRight[arcIdx].x) / 2 + (Math.random() - 0.5) * 10,
            (ptsLeft[arcIdx].y + ptsRight[arcIdx].y) / 2 + (Math.random() - 0.5) * 10
          );
          engine.world.ctx.lineTo(ptsRight[arcIdx].x, ptsRight[arcIdx].y);
          engine.world.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          engine.world.ctx.lineWidth = 1.0;
          engine.world.ctx.stroke();
        }

        engine.world.ctx.restore();

        // E. Fucking crazy dimensional star spewing: 45% chance per frame to spit stars!
        if (Math.random() < 0.05 && engine.world.particles.length < getMaxParticles(engine.world) * 1.15) {
          const t = Math.random();
          const rx = f.x1 + dx * t;
          const ry = f.y1 + dy * t;

          const ejectSpeed = Math.random() * 5.0 + 4.5;
          const perpDirection = Math.random() < 0.5 ? 1 : -1;
          const evx = nx * perpDirection * ejectSpeed;
          const evy = ny * perpDirection * ejectSpeed;

          const colorPrefix = Math.random() < 0.5 ? 'rgba(0, 240, 255,' : 'rgba(255, 0, 240,';

          engine.world.particles.push({
            x: rx,
            y: ry,
            vx: evx,
            vy: evy,
            baseVx: evx * 0.1,
            baseVy: evy * 0.1,
            radius: Math.random() * 0.8 + 0.5,
            baseRadius: Math.random() * 0.8 + 0.5,
            colorBlend: 1.0,
            wobbleTimer: 0,
            colorPrefix,
            flockable: false,
            life: Math.random() * 0.35 + 0.25, // short lifespan
            birthProgress: 1.0,
            deathProgress: 0,
            isDying: false,
            behaviorState: 'CRUISE',
            behaviorTimer: 50,
            speedFactor: 1.0,
            isLassoed: false
          });
        }
      }
    }
  }
