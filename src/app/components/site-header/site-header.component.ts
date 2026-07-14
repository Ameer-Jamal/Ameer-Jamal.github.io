import { Component } from '@angular/core';

@Component({
  selector: 'app-site-header',
  standalone: true,
  templateUrl: './site-header.component.html'
})
export class SiteHeaderComponent {
  private lastTriggerTime = 0;

  triggerLogoEasterEgg(event: Event): void {
    event.stopPropagation();
    
    // Prevent double triggers on mobile (touch + click emulation)
    const now = Date.now();
    if (now - this.lastTriggerTime < 500) {
      return;
    }
    this.lastTriggerTime = now;

    if (typeof window !== 'undefined') {
      const customEvent = new CustomEvent('logo-blackhole-trigger');
      window.dispatchEvent(customEvent);
    }
  }

  onLogoClick(event: MouseEvent): void {
    this.triggerLogoEasterEgg(event);
  }
}
