import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { RepoRenderer, RepoSectionController } from './github-projects-carousel';

const GITHUB_USERNAME = 'Ameer-Jamal';
const MARKED_SRC = 'assets/js/marked.min.js';

/**
 * Hosts the GitHub projects carousel. The rendering/data logic lives in
 * github-projects-carousel.ts (ported verbatim from the old global script) and is
 * driven imperatively here so behavior matches the previous implementation exactly:
 * the carousel lazy-loads the first time the "work" article opens.
 */
@Component({
  selector: 'app-github-projects',
  standalone: true,
  template: '<div class="github-projects__grid" id="github-projects" #grid></div>'
})
export class GitHubProjectsComponent implements OnInit, OnDestroy {
  @ViewChild('grid', { static: true }) private readonly grid!: ElementRef<HTMLElement>;
  private hasLoaded = false;

  private readonly onArticleOpen = (event: Event): void => {
    const detail = (event as CustomEvent).detail as { id?: string } | undefined;
    if (detail?.id === 'work') {
      void this.loadCarousel();
    }
  };

  ngOnInit(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.addEventListener('portfolio-article-open', this.onArticleOpen);

    // Handle the case where the work article is already visible (e.g. deep link).
    if (typeof document !== 'undefined') {
      const workArticle = document.getElementById('work');
      if (workArticle?.classList.contains('active')) {
        void this.loadCarousel();
      }
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('portfolio-article-open', this.onArticleOpen);
    }
  }

  private async loadCarousel(): Promise<void> {
    if (this.hasLoaded) {
      return;
    }
    this.hasLoaded = true;

    const container = this.grid.nativeElement;
    const renderer = new RepoRenderer(container, { username: GITHUB_USERNAME });
    renderer.renderLoading();

    try {
      await this.loadMarked();
    } catch {
      // Markdown library is optional; the renderer falls back to basic markdown.
    }

    const controller = new RepoSectionController({
      container,
      username: GITHUB_USERNAME,
      renderer
    });
    await controller.init();
  }

  private loadMarked(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined' || (window as any).marked) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(`script[data-portfolio-script="${MARKED_SRC}"]`);
      if (existing) {
        if (existing.dataset['loaded'] === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${MARKED_SRC}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = MARKED_SRC;
      script.async = false;
      script.dataset['portfolioScript'] = MARKED_SRC;
      script.onload = () => {
        script.dataset['loaded'] = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${MARKED_SRC}`));
      document.body.appendChild(script);
    });
  }
}
