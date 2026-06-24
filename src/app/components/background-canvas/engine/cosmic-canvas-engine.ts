import {
  PerformanceTier,
  resolvePerformanceProfile
} from '../../../utils/performance-profile';
import { TOOLS_LIST } from '../models/cosmic.constants';
import { MousePower } from '../models/cosmic.types';
import { applyPerformanceTier, resetFpsGovernorStreaks, stopAnimationLoop, tickFpsGovernor } from './fps-governor';
import { draw } from './draw-frame';
import { initNebulas, initStars, initGalaxies, resizeCanvas } from './background-layers';
import { initParticles } from './particle-system';
import {
  clearSandboxElements,
  selectPower,
  toggleSandboxBar,
  toggleSandboxPin
} from './sandbox-powers';
import {
  onLogoBlackholeTrigger,
  onMouseDown,
  onMouseLeave,
  onMouseMove,
  onMouseUp,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp
} from './input-controller';
import { CosmicWorld, createCosmicWorld } from './cosmic-world';

export { TOOLS_LIST };

export class CosmicCanvasEngine {
  readonly world: CosmicWorld;
  private animateBound = () => this.animate();

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.world = createCosmicWorld(canvas, ctx);
  }

  init(): void {
    if (typeof window === 'undefined') return;
    this.world.performanceProfile = resolvePerformanceProfile();
    applyPerformanceTier(this, this.world.performanceProfile.tier, false);
    initNebulas(this);
    initParticles(this);
    this.animate();
  }

  destroy(): void {
    stopAnimationLoop(this);
  }

  startAnimation(): void {
    if (!this.world.animationPaused) return;
    this.world.animationPaused = false;
    resetFpsGovernorStreaks(this);
    this.animate();
  }

  pauseAnimation(): void {
    stopAnimationLoop(this);
    this.world.animationPaused = true;
  }

  handleResize(): void {
    resizeCanvas(this);
    initNebulas(this);
    initStars(this);
    initGalaxies(this);
    initParticles(this);
  }

  private animate(): void {
    if (this.world.animationPaused) return;
    tickFpsGovernor(this, typeof performance !== 'undefined' ? performance.now() : Date.now());
    draw(this);
    this.world.animationFrameId = requestAnimationFrame(this.animateBound);
  }

  applyPerformanceTier(tier: PerformanceTier, reinitParticles = true): void {
    applyPerformanceTier(this, tier, reinitParticles);
  }

  public toggleSandboxBar(): void { toggleSandboxBar(this); }
  public toggleSandboxPin(): void { toggleSandboxPin(this); }
  public selectPower(power: MousePower): void { selectPower(this, power); }
  public clearSandboxElements(): void { clearSandboxElements(this); }

  public onPointerMove(event: PointerEvent): void { onPointerMove(this, event); }
  public onPointerLeave(event: PointerEvent): void { onPointerLeave(this, event); }
  public onPointerCancel(event: PointerEvent): void { onPointerCancel(this, event); }
  public onPointerDown(event: PointerEvent): void { onPointerDown(this, event); }
  public onPointerUp(event: PointerEvent): void { onPointerUp(this, event); }
  public onMouseMove(event: MouseEvent): void { onMouseMove(this, event); }
  public onMouseLeave(): void { onMouseLeave(this); }
  public onMouseDown(event: MouseEvent): void { onMouseDown(this, event); }
  public onMouseUp(event: MouseEvent): void { onMouseUp(this, event); }
  public onLogoBlackholeTrigger(): void { onLogoBlackholeTrigger(this); }
}
