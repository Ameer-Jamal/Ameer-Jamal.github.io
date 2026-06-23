import { Component } from '@angular/core';

@Component({
  selector: 'app-site-header',
  standalone: true,
  templateUrl: './site-header.component.html'
})
export class SiteHeaderComponent {
  onLogoClick(event: MouseEvent): void {
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      const customEvent = new CustomEvent('logo-blackhole-trigger');
      window.dispatchEvent(customEvent);
    }
  }
}
