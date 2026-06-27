import { TestBed } from '@angular/core/testing';
import { GitHubProjectsComponent } from './github-projects.component';

describe('GitHubProjectsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GitHubProjectsComponent]
    }).compileComponents();
  });

  it('renders the projects container host without eagerly fetching', () => {
    const fixture = TestBed.createComponent(GitHubProjectsComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const grid = compiled.querySelector('#github-projects');
    expect(grid).toBeTruthy();
    expect(grid?.classList.contains('github-projects__grid')).toBe(true);
    // The carousel is lazy: nothing rendered until the work article opens.
    expect(grid?.children.length).toBe(0);
  });
});
