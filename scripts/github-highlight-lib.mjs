/**
 * Pure helpers for building github-highlight-repos.json (carousel fallback).
 * Logic mirrors angular/src/assets/js/githubProjects.js filterExcluded + non-fork filtering.
 */

export const EXCLUDED_REPO_NAMES_LOWER = new Set(['ameer-jamal', 'ameer-jamal.github.io']);

/**
 * @param {object | null | undefined} repo
 * @returns {boolean}
 */
export function shouldIncludeRepo(repo) {
  if (!repo || typeof repo.name !== 'string' || repo.name.trim() === '') {
    return false;
  }
  if (repo.fork === true) {
    return false;
  }
  if (repo.private === true) {
    return false;
  }
  const normalized = repo.name.trim().toLowerCase();
  return !EXCLUDED_REPO_NAMES_LOWER.has(normalized);
}

/**
 * @param {object} repo
 */
export function mapGitHubRepoToHighlight(repo) {
  return {
    name: repo.name,
    description: typeof repo.description === 'string' ? repo.description : '',
    language: repo.language != null && repo.language !== '' ? repo.language : 'Not specified',
    url: typeof repo.html_url === 'string' ? repo.html_url : '#',
    stars: typeof repo.stargazers_count === 'number' ? repo.stargazers_count : 0,
    forks: typeof repo.forks_count === 'number' ? repo.forks_count : 0,
    openIssues: typeof repo.open_issues_count === 'number' ? repo.open_issues_count : 0,
    updatedAt: repo.pushed_at ?? null,
  };
}

/**
 * @param {object[]} apiRepos
 */
export function buildHighlightList(apiRepos) {
  if (!Array.isArray(apiRepos)) {
    return [];
  }
  const list = apiRepos.filter(shouldIncludeRepo).map(mapGitHubRepoToHighlight);
  list.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
  return list;
}
