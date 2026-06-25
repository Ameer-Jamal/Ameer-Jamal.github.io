import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { SiteHeaderComponent } from './components/site-header/site-header.component';
import { CvSectionComponent } from './components/cv-section/cv-section.component';
import { ProjectsSectionComponent } from './components/projects-section/projects-section.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the site title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Ameer Jamal');
  });

  it('should render the main portfolio shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-site-header')).toBeTruthy();
    expect(compiled.querySelector('article#intro')).toBeTruthy();
    expect(compiled.querySelector('article#work')).toBeTruthy();
    expect(compiled.querySelector('article#contact')).toBeTruthy();
    expect(compiled.querySelector('article#CV')).toBeTruthy();
    expect(compiled.querySelector('app-site-footer')).toBeTruthy();
    expect(compiled.querySelector('app-background-canvas')).toBeTruthy();
  });

  it('should hide the portfolio wrapper during cosmic loading', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const wrapper = compiled.querySelector('#wrapper') as HTMLElement;

    document.body.classList.add('is-cosmic-loading');

    try {
      expect(getComputedStyle(wrapper).opacity).toBe('0');
    } finally {
      document.body.classList.remove('is-cosmic-loading');
    }
  });

  it('should open an article when a hash nav link is clicked even if the hash already matches', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const cvLink = compiled.querySelector('a[href="#CV"]') as HTMLAnchorElement;

    history.pushState(null, '', '#CV');
    document.body.classList.remove('is-article-visible');

    cvLink.click();

    expect(document.body.classList.contains('is-article-visible')).toBeTrue();
    expect((compiled.querySelector('#CV') as HTMLElement).classList.contains('active')).toBeTrue();
  });
});

describe('SiteHeaderComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent]
    }).compileComponents();
  });

  it('should keep the primary hash navigation links', () => {
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = Array.from(compiled.querySelectorAll('nav a')).map((link) => link.getAttribute('href'));

    expect(links).toEqual(['#CV', '#work', '#contact']);
  });

  it('should dispatch the logo blackhole event when the logo is clicked', () => {
    const fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.detectChanges();
    const eventSpy = jasmine.createSpy('logoEvent');
    window.addEventListener('logo-blackhole-trigger', eventSpy);

    try {
      const logo = fixture.nativeElement.querySelector('.logo') as HTMLElement;
      logo.click();

      expect(eventSpy).toHaveBeenCalled();
    } finally {
      window.removeEventListener('logo-blackhole-trigger', eventSpy);
    }
  });
});

describe('CvSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CvSectionComponent]
    }).compileComponents();
  });

  it('should expose a direct CV link', () => {
    const fixture = TestBed.createComponent(CvSectionComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const directLink = compiled.querySelector('.cv-mobile-actions a') as HTMLAnchorElement | null;

    expect(directLink?.href).toContain('drive.google.com/file/d/1Dcp2m2-4s_p2sHZBjeadJB4t7lOPe2jm');
    expect(directLink?.target).toBe('_blank');
  });

  it('should load the CV preview when the CV article opens', () => {
    const fixture = TestBed.createComponent(CvSectionComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('iframe')).toBeNull();

    window.dispatchEvent(new CustomEvent('portfolio-article-open', { detail: { id: 'CV' } }));
    fixture.detectChanges();

    expect(compiled.querySelector('iframe')).toBeTruthy();
  });
});

describe('ProjectsSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsSectionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
  });

  it('should render the Angular GitHub projects component', () => {
    const fixture = TestBed.createComponent(ProjectsSectionComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#github-projects')).toBeTruthy();
  });
});
