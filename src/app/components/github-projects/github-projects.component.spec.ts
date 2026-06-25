import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { GitHubProjectsComponent } from './github-projects.component';
import { GitHubProjectsService } from '../../services/github-projects.service';
import { GitHubProject } from '../../models/github-project.model';

describe('GitHubProjectsComponent', () => {
  let fixture: ComponentFixture<GitHubProjectsComponent>;
  let projects$: Subject<GitHubProject[]>;

  const projects: GitHubProject[] = [
    {
      name: 'First Project',
      description: 'First description',
      language: 'TypeScript',
      url: 'https://github.com/Ameer-Jamal/first',
      stars: 3,
      forks: 1,
      openIssues: 0,
      updatedAt: '2026-01-01T00:00:00Z'
    },
    {
      name: 'Second Project',
      description: 'Second description',
      language: 'Python',
      url: 'https://github.com/Ameer-Jamal/second',
      stars: 2,
      forks: 0,
      openIssues: 1,
      updatedAt: '2026-01-02T00:00:00Z'
    }
  ];

  beforeEach(async () => {
    projects$ = new Subject<GitHubProject[]>();

    await TestBed.configureTestingModule({
      imports: [GitHubProjectsComponent],
      providers: [
        {
          provide: GitHubProjectsService,
          useValue: {
            getProjects: () => projects$.asObservable()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GitHubProjectsComponent);
  });

  it('should show a spinner while projects are loading', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.github-projects__spinner')).toBeTruthy();
    expect(compiled.textContent).not.toContain('First Project');
  });

  it('should render projects as a carousel and navigate between cards', () => {
    fixture.detectChanges();
    projects$.next(projects);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.github-projects__carousel')).toBeTruthy();
    expect(compiled.textContent).toContain('First Project');
    expect(compiled.textContent).toContain('Project 1 of 2');

    const nextButton = compiled.querySelector('.github-projects__nav--next') as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Second Project');
    expect(compiled.textContent).toContain('Project 2 of 2');

    const previousButton = compiled.querySelector('.github-projects__nav--previous') as HTMLButtonElement;
    previousButton.click();
    fixture.detectChanges();

    expect(compiled.textContent).toContain('First Project');
    expect(compiled.textContent).toContain('Project 1 of 2');
  });
});
