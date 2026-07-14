import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import type { MousePower, SandboxTool } from '../models/cosmic.types';
import type { SandboxContextTarget } from '../engine/sandbox-context-target';

@Component({
  selector: 'app-cosmic-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cosmic-context-menu.component.html',
  styleUrl: './cosmic-context-menu.component.scss'
})
export class CosmicContextMenuComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('menu', { static: true }) private menuRef!: ElementRef<HTMLElement>;

  @Input({ required: true }) x = 0;
  @Input({ required: true }) y = 0;
  @Input() target: SandboxContextTarget | null = null;
  @Input({ required: true }) activePower: MousePower = 'DEFAULT';
  @Input() quickTools: SandboxTool[] = [];
  @Input() gameMode = false;

  @Output() vaporize = new EventEmitter<void>();
  @Output() resetSimulation = new EventEmitter<void>();
  @Output() triggerBigBang = new EventEmitter<void>();
  @Output() toggleGameMode = new EventEmitter<void>();
  @Output() powerSelected = new EventEmitter<MousePower>();

  displayX = 0;
  displayY = 0;
  positioned = false;

  private viewInitialized = false;
  private positionFrame: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => this.queuePositionUpdate());
    this.resizeObserver?.observe(this.menuRef.nativeElement);
    this.queuePositionUpdate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewInitialized && (changes['x'] || changes['y'] || changes['target'] || changes['quickTools'])) {
      this.positioned = false;
      this.queuePositionUpdate();
    }
  }

  ngOnDestroy(): void {
    if (this.positionFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.positionFrame);
    }
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onViewportResize(): void {
    this.queuePositionUpdate();
  }

  trackByToolId(_index: number, item: SandboxTool): MousePower {
    return item.id;
  }

  private queuePositionUpdate(): void {
    if (!this.viewInitialized || typeof window === 'undefined') {
      return;
    }
    if (this.positionFrame !== null) {
      cancelAnimationFrame(this.positionFrame);
    }
    this.positionFrame = requestAnimationFrame(() => {
      this.positionFrame = null;
      this.updatePosition();
    });
  }

  private updatePosition(): void {
    const viewportPadding = 10;
    const rect = this.menuRef.nativeElement.getBoundingClientRect();
    const maxX = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
    const maxY = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
    const opensLeft = this.x + rect.width + viewportPadding > window.innerWidth;
    const opensAbove = this.y + rect.height + viewportPadding > window.innerHeight;
    const preferredX = opensLeft ? this.x - rect.width : this.x;
    const preferredY = opensAbove ? this.y - rect.height : this.y;

    this.displayX = Math.min(maxX, Math.max(viewportPadding, preferredX));
    this.displayY = Math.min(maxY, Math.max(viewportPadding, preferredY));
    this.positioned = true;
    this.changeDetector.detectChanges();
  }
}
