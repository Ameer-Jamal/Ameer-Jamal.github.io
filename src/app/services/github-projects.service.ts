import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { GitHubProject } from '../models/github-project.model';

interface PinnedRepoResponse {
  repo?: string;
  name?: string;
  description?: string;
  language?: string;
  link?: string;
  url?: string;
  stars?: number | string;
  updated_at?: string;
  forks?: number;
  open_issues?: number;
}

interface GitHubRepoResponse {
  name?: string;
  description?: string;
  language?: string;
  html_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  updated_at?: string;
  pushed_at?: string;
  fork?: boolean;
}

interface CachedRepoResponse {
  name?: string;
  description?: string;
  language?: string;
  url?: string;
  stars?: number;
  forks?: number;
  openIssues?: number;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class GitHubProjectsService {
  private readonly username = 'Ameer-Jamal';
  private readonly cachedProjectsUrl = 'assets/data/github-highlight-repos.json';
  private readonly pinnedApi = `https://gh-pinned-repos.egoist.dev/?username=${this.username}`;
  private readonly reposApi = `https://api.github.com/users/${this.username}/repos?per_page=100&sort=updated`;

  constructor(private readonly http: HttpClient) {}

  getProjects(limit = 8): Observable<GitHubProject[]> {
    return this.getCachedProjects().pipe(
      switchMap((cachedProjects) => {
        if (cachedProjects.length > 0) {
          return of(cachedProjects);
        }
        return this.getLiveProjects();
      }),
      map((projects) => this.sortAndFilter(projects).slice(0, limit))
    );
  }

  private getCachedProjects(): Observable<GitHubProject[]> {
    return this.http.get<CachedRepoResponse[]>(this.cachedProjectsUrl).pipe(
      map((repos) => (Array.isArray(repos) ? repos.map((repo) => this.normalizeCachedRepo(repo)) : [])),
      catchError(() => of([]))
    );
  }

  private getLiveProjects(): Observable<GitHubProject[]> {
    return this.getPinnedProjects().pipe(
      switchMap((pinnedProjects) => {
        if (pinnedProjects.length > 0) {
          return of(pinnedProjects);
        }
        return this.getGitHubProjects();
      })
    );
  }

  private getPinnedProjects(): Observable<GitHubProject[]> {
    return this.http.get<PinnedRepoResponse[]>(this.pinnedApi).pipe(
      map((repos) => (Array.isArray(repos) ? repos.map((repo) => this.normalizePinnedRepo(repo)) : [])),
      catchError(() => of([]))
    );
  }

  private getGitHubProjects(): Observable<GitHubProject[]> {
    return this.http.get<GitHubRepoResponse[]>(this.reposApi).pipe(
      map((repos) => {
        if (!Array.isArray(repos)) {
          return [];
        }

        return repos
          .filter((repo) => !repo.fork)
          .map((repo) => this.normalizeGitHubRepo(repo));
      })
    );
  }

  private normalizePinnedRepo(repo: PinnedRepoResponse): GitHubProject {
    const stars = typeof repo.stars === 'number' ? repo.stars : Number.parseInt(repo.stars ?? '0', 10);

    return {
      name: repo.repo ?? repo.name ?? 'Untitled Project',
      description: repo.description ?? '',
      language: repo.language ?? 'Not specified',
      url: repo.link ?? repo.url ?? '#',
      stars: Number.isFinite(stars) ? stars : 0,
      forks: typeof repo.forks === 'number' ? repo.forks : 0,
      openIssues: typeof repo.open_issues === 'number' ? repo.open_issues : 0,
      updatedAt: repo.updated_at ?? null
    };
  }

  private normalizeCachedRepo(repo: CachedRepoResponse): GitHubProject {
    return {
      name: repo.name ?? 'Untitled Project',
      description: repo.description ?? '',
      language: repo.language ?? 'Not specified',
      url: repo.url ?? '#',
      stars: typeof repo.stars === 'number' ? repo.stars : 0,
      forks: typeof repo.forks === 'number' ? repo.forks : 0,
      openIssues: typeof repo.openIssues === 'number' ? repo.openIssues : 0,
      updatedAt: repo.updatedAt ?? null
    };
  }

  private normalizeGitHubRepo(repo: GitHubRepoResponse): GitHubProject {
    return {
      name: repo.name ?? 'Untitled Project',
      description: repo.description ?? '',
      language: repo.language ?? 'Not specified',
      url: repo.html_url ?? '#',
      stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
      forks: typeof repo.forks_count === 'number' ? repo.forks_count : 0,
      openIssues: typeof repo.open_issues_count === 'number' ? repo.open_issues_count : 0,
      updatedAt: repo.pushed_at ?? repo.updated_at ?? null
    };
  }

  private sortAndFilter(repositories: GitHubProject[]): GitHubProject[] {
    const excluded = new Set(['ameer-jamal', 'ameer-jamal.github.io']);

    return repositories
      .filter((repo) => !excluded.has(repo.name.trim().toLowerCase()))
      .sort((a, b) => {
        const starDelta = b.stars - a.stars;
        if (starDelta !== 0) {
          return starDelta;
        }

        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      });
  }
}
