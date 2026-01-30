import { AfterViewInit, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit {
  private readonly scriptSources = [
    'assets/js/jquery.min.js',
    'assets/js/browser.min.js',
    'assets/js/breakpoints.min.js',
    'assets/js/util.js',
    'assets/js/main.js',
    'assets/js/marked.min.js',
    'assets/js/githubProjects.js'
  ];

  async ngAfterViewInit(): Promise<void> {
    if (typeof document === 'undefined') {
      return;
    }
    if (typeof window !== 'undefined' && (window as { __karma__?: unknown }).__karma__) {
      return;
    }

    try {
      for (const source of this.scriptSources) {
        await this.loadScript(source);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Portfolio] Script bootstrap failed.', error);
    }
  }

  private loadScript(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-portfolio-script="${source}"]`);
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = source;
      script.async = false;
      script.defer = false;
      script.dataset['portfolioScript'] = source;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${source}`));
      document.body.appendChild(script);
    });
  }
}
