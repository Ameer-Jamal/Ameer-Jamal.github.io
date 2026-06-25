/**
 * Pure helpers for building github-highlight-repos.json (carousel fallback).
 * Logic mirrors githubProjects.js explicit exclusions + non-fork filtering.
 */

export const EXCLUDED_REPO_NAMES_LOWER = new Set([
  'ameer-jamal',
  'ameer-jamal.github.io',
  'class-cloud-repo',
  'minmax-tictactoe',
  'realsoft-training-repo',
  'madaincorp',
]);

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
    defaultBranch:
      typeof repo.default_branch === 'string' && repo.default_branch !== ''
        ? repo.default_branch
        : null,
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

/**
 * Resolve where a repo's README lives (or confirm it has none) so the browser can
 * skip probing repos with no README and avoid noisy 404 requests at runtime.
 * Mirrors the client's lookup order: raw README.md first, then the REST /readme
 * endpoint (which also resolves non-standard filenames like README.rst).
 *
 * @param {string} owner
 * @param {{ name: string, defaultBranch?: string | null }} repo
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 * @returns {Promise<{ readmeRawUrl: string | null, readmeHtmlUrl: string | null }>}
 */
export async function probeReadme(owner, repo, fetchImpl = fetch, token = '') {
  const branch = repo.defaultBranch || 'main';
  const encodedRepo = encodeURIComponent(repo.name);
  const encodedBranch = encodeURIComponent(branch).replaceAll('%2F', '/');
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${encodedRepo}/${encodedBranch}/README.md`;

  try {
    const res = await fetchImpl(rawUrl, { method: 'HEAD' });
    if (res?.ok) {
      return {
        readmeRawUrl: rawUrl,
        readmeHtmlUrl: `https://github.com/${owner}/${encodedRepo}/blob/${encodedBranch}/README.md`,
      };
    }
  } catch {
    // fall through to the REST lookup
  }

  try {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetchImpl(`https://api.github.com/repos/${owner}/${encodedRepo}/readme`, { headers });
    if (res?.ok) {
      const data = await res.json();
      return {
        readmeRawUrl: data?.download_url || null,
        readmeHtmlUrl: data?.html_url || null,
      };
    }
  } catch {
    // no README resolvable
  }

  return { readmeRawUrl: null, readmeHtmlUrl: null };
}

/**
 * Annotate each highlight entry with precomputed README URLs (null when absent).
 *
 * @param {object[]} list
 * @param {string} owner
 * @param {typeof fetch} fetchImpl
 * @param {string} token
 */
export async function enrichHighlightsWithReadme(list, owner, fetchImpl = fetch, token = '') {
  if (!Array.isArray(list)) {
    return [];
  }
  const enriched = [];
  for (const repo of list) {
    const meta = await probeReadme(owner, repo, fetchImpl, token);
    enriched.push({ ...repo, readmeRawUrl: meta.readmeRawUrl, readmeHtmlUrl: meta.readmeHtmlUrl });
  }
  return enriched;
}
