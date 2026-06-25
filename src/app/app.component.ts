import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { AboutSectionComponent } from './components/about-section/about-section.component';
import { ContactSectionComponent } from './components/contact-section/contact-section.component';
import { CvSectionComponent } from './components/cv-section/cv-section.component';
import { IntroSectionComponent } from './components/intro-section/intro-section.component';
import { ProjectsSectionComponent } from './components/projects-section/projects-section.component';
import { SiteFooterComponent } from './components/site-footer/site-footer.component';
import { SiteHeaderComponent } from './components/site-header/site-header.component';
import { BackgroundCanvasComponent } from './components/background-canvas/background-canvas.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    SiteHeaderComponent,
    IntroSectionComponent,
    ProjectsSectionComponent,
    AboutSectionComponent,
    ContactSectionComponent,
    CvSectionComponent,
    SiteFooterComponent,
    BackgroundCanvasComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private mainElement: HTMLElement | null = null;
  private headerElement: HTMLElement | null = null;
  private footerElement: HTMLElement | null = null;
  private articleElements: HTMLElement[] = [];
  private removeListeners: Array<() => void> = [];
  private projectScriptsPromise: Promise<void> | null = null;

  ngAfterViewInit(): void {
    if (typeof document === 'undefined') {
      return;
    }

    this.mainElement = document.getElementById('main');
    this.headerElement = document.getElementById('header');
    this.footerElement = document.getElementById('footer');
    this.articleElements = Array.from(document.querySelectorAll<HTMLElement>('#main > article'));

    this.initializeArticleNavigation();
    document.body.classList.remove('is-preload');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('portfolio-page-ready'));
    }
  }

  ngOnDestroy(): void {
    this.removeListeners.forEach((removeListener) => removeListener());
    this.removeListeners = [];
  }

  private initializeArticleNavigation(): void {
    if (!this.mainElement || typeof window === 'undefined') {
      return;
    }

    this.mainElement.style.display = 'none';
    this.articleElements.forEach((article) => {
      article.style.display = 'none';
      this.ensureCloseControl(article);
      article.addEventListener('click', this.stopArticleClick);
      this.removeListeners.push(() => article.removeEventListener('click', this.stopArticleClick));
    });

    const hashLinkClickListener = (event: Event) => {
      const target = event.target as Element | null;
      const link = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      const hash = link?.getAttribute('href');
      if (!hash || hash.length < 2) {
        return;
      }

      const article = this.articleElements.find((item) => `#${item.id}` === hash);
      if (!article) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (window.location.hash === hash) {
        this.showArticle(article);
        return;
      }

      window.location.hash = hash;
    };
    document.addEventListener('click', hashLinkClickListener);
    this.removeListeners.push(() => document.removeEventListener('click', hashLinkClickListener));

    const hashChangeListener = (event: HashChangeEvent) => {
      event.preventDefault();
      this.syncArticleFromHash();
    };
    window.addEventListener('hashchange', hashChangeListener);
    this.removeListeners.push(() => window.removeEventListener('hashchange', hashChangeListener));

    const keyListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.body.classList.contains('is-article-visible')) {
        this.clearHash();
      }
    };
    window.addEventListener('keyup', keyListener);
    this.removeListeners.push(() => window.removeEventListener('keyup', keyListener));

    const bodyClickListener = () => {
      if (document.body.classList.contains('is-article-visible')) {
        this.clearHash();
      }
    };
    document.body.addEventListener('click', bodyClickListener);
    this.removeListeners.push(() => document.body.removeEventListener('click', bodyClickListener));

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    this.syncArticleFromHash();
  }

  private ensureCloseControl(article: HTMLElement): void {
    if (article.querySelector('.close')) {
      return;
    }

    const closeControl = document.createElement('div');
    closeControl.className = 'close';
    closeControl.textContent = 'Close';
    closeControl.setAttribute('role', 'button');
    closeControl.setAttribute('tabindex', '0');
    closeControl.setAttribute('aria-label', 'Close section');

    const close = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearHash();
    };

    closeControl.addEventListener('click', close);
    closeControl.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        close(event);
      }
    });
    article.appendChild(closeControl);
  }

  private syncArticleFromHash(): void {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) {
      this.hideArticles();
      return;
    }

    const article = this.articleElements.find((item) => item.id === id);
    if (!article) {
      return;
    }

    this.showArticle(article);
  }

  private showArticle(activeArticle: HTMLElement): void {
    document.body.classList.add('is-article-visible');
    if (this.headerElement) this.headerElement.style.display = 'none';
    if (this.footerElement) this.footerElement.style.display = 'none';
    if (this.mainElement) this.mainElement.style.display = 'block';

    this.articleElements.forEach((article) => {
      const isActive = article === activeArticle;
      article.classList.toggle('active', isActive);
      article.style.display = isActive ? 'block' : 'none';
    });

    if (activeArticle.id === 'work') {
      void this.loadProjectCarousel();
    }

    window.scrollTo(0, 0);
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent('portfolio-article-open', { detail: { id: activeArticle.id } }));
    });
  }

  private hideArticles(): void {
    document.body.classList.remove('is-article-visible');
    if (this.headerElement) this.headerElement.style.display = '';
    if (this.footerElement) this.footerElement.style.display = '';
    if (this.mainElement) this.mainElement.style.display = 'none';

    this.articleElements.forEach((article) => {
      article.classList.remove('active');
      article.style.display = 'none';
    });
  }

  private clearHash(): void {
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search);
    }
    this.hideArticles();
  }



  private readonly stopArticleClick = (event: Event): void => {
    event.stopPropagation();
  };

  private loadProjectCarousel(): Promise<void> {
    if (this.projectScriptsPromise) {
      return this.projectScriptsPromise;
    }

    this.renderProjectLoadingState();
    this.projectScriptsPromise = this.loadScript('assets/js/marked.min.js')
      .then(() => this.loadScript('assets/js/githubProjects.js'))
      .catch((error) => {
        this.projectScriptsPromise = null;
        console.error('[Portfolio] Project carousel failed to load.', error);
        throw error;
      });

    return this.projectScriptsPromise;
  }

  private renderProjectLoadingState(): void {
    const container = document.getElementById('github-projects');
    if (!container || container.children.length > 0) {
      return;
    }

    container.innerHTML = `
      <div class="github-projects__loader" aria-live="polite">
        <div class="github-projects__spinner" role="status" aria-label="Loading GitHub projects"></div>
      </div>
    `;
  }

  private loadScript(source: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-portfolio-script="${source}"]`);
      if (existing) {
        if (existing.dataset['loaded'] === 'true') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${source}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = source;
      script.async = false;
      script.dataset['portfolioScript'] = source;
      script.onload = () => {
        script.dataset['loaded'] = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`Failed to load script: ${source}`));
      document.body.appendChild(script);
    });
  }
}
