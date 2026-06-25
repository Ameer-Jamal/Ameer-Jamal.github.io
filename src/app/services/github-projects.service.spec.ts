import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { GitHubProjectsService } from './github-projects.service';

describe('GitHubProjectsService', () => {
  let service: GitHubProjectsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(GitHubProjectsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load cached local projects before external GitHub APIs', () => {
    let projectNames: string[] = [];

    service.getProjects(2).subscribe((projects) => {
      projectNames = projects.map((project) => project.name);
    });

    const localRequest = httpMock.expectOne('assets/data/github-highlight-repos.json');
    localRequest.flush([
      {
        name: 'Cached One',
        description: 'Local project',
        language: 'TypeScript',
        url: 'https://github.com/Ameer-Jamal/cached-one',
        stars: 3,
        forks: 1,
        openIssues: 0,
        updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        name: 'Cached Two',
        description: 'Local project',
        language: 'Python',
        url: 'https://github.com/Ameer-Jamal/cached-two',
        stars: 2,
        forks: 0,
        openIssues: 0,
        updatedAt: '2026-01-02T00:00:00Z'
      }
    ]);

    httpMock.expectNone('https://gh-pinned-repos.egoist.dev/?username=Ameer-Jamal');
    httpMock.expectNone('https://api.github.com/users/Ameer-Jamal/repos?per_page=100&sort=updated');
    expect(projectNames).toEqual(['Cached One', 'Cached Two']);
  });
});
