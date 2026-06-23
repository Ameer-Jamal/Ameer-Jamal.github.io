const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  RepositoryNormalizer,
  GitHubApiClient
} = require('../src/assets/js/githubProjects.js');

describe('RepositoryNormalizer', () => {
  test('fromGitHub normalizes repository fields', () => {
    const normalized = RepositoryNormalizer.fromGitHub({
      name: 'Demo',
      description: 'Example project',
      language: 'JavaScript',
      html_url: 'https://github.com/demo',
      stargazers_count: 4,
      pushed_at: '2023-01-01T00:00:00Z'
    });

    assert.equal(normalized.name, 'Demo');
    assert.equal(normalized.description, 'Example project');
    assert.equal(normalized.language, 'JavaScript');
    assert.equal(normalized.url, 'https://github.com/demo');
    assert.equal(normalized.stars, 4);
    assert.equal(normalized.updatedAt, '2023-01-01T00:00:00Z');
  });

  test('fromPinned applies sensible defaults when fields are missing', () => {
    const normalized = RepositoryNormalizer.fromPinned({});
    assert.equal(normalized.name, 'Untitled Project');
    assert.equal(normalized.description, '');
    assert.equal(normalized.language, 'Not specified');
    assert.equal(normalized.url, '#');
    assert.equal(normalized.stars, 0);
    assert.equal(normalized.updatedAt, null);
  });
});

describe('GitHubApiClient', () => {
  test('loads public GitHub repositories instead of limiting to pinned repositories', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'TypeScript', html_url: 'https://github.com/repolens', stargazers_count: 10, pushed_at: '2023-01-01T00:00:00Z', fork: false },
      { name: 'NewPublicProject', description: 'Repo', language: 'Go', html_url: 'https://github.com/new-public', stargazers_count: 5, pushed_at: '2023-01-02T00:00:00Z', fork: false }
    ];

    const fetchStub = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes('api.github.com/users/') && stringUrl.includes('/repos')) {
        return {
          ok: true,
          async json() {
            return githubPayload;
          }
        };
      }

      // README is loaded from raw.githubusercontent.com first (avoids REST rate limits in the browser).
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/RepoLens/')) {
        return {
          ok: true,
          async text() {
            return '# Hello\nThis is a README';
          }
        };
      }

      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/NewPublicProject/')) {
        return {
          ok: true,
          async text() {
            return '# New Public\nThis is a README';
          }
        };
      }

      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 2);
    assert.equal(repos[0].name, 'RepoLens');
    assert.equal(repos[0].stars, 10);
    assert.equal(repos[0].readmeRaw.includes('# Hello'), true);
    assert.equal(repos[0].readmeHtmlUrl, 'https://github.com/someone/RepoLens/blob/main/README.md');
    assert.equal(repos[1].name, 'NewPublicProject');
  });

  test('falls back to GitHub API when pinned request fails', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'Python', html_url: 'https://github.com/fallback', stargazers_count: 7, pushed_at: '2023-02-02T00:00:00Z', fork: false, forks_count: 2, open_issues_count: 1 },
      { name: 'Forked', fork: true }
    ];

    const fetchStub = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }

      if (stringUrl.includes('raw.githubusercontent.com')) {
        return { ok: false, status: 404 };
      }

      if (stringUrl.includes('/readme')) {
        return {
          ok: true,
          async json() {
            return {
              content: Buffer.from('Fallback README content').toString('base64'),
              encoding: 'base64',
              html_url: 'https://github.com/fallback/blob/main/README.md',
              download_url: 'https://raw.githubusercontent.com/fallback/main/README.md'
            };
          }
        };
      }

      return {
        ok: true,
        async json() {
          return githubPayload;
        }
      };
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].name, 'RepoLens');
    assert.equal(repos[0].language, 'Python');
    assert.equal(repos[0].url, 'https://github.com/fallback');
    assert.equal(repos[0].readmeRaw.includes('Fallback README content'), true);
  });

  test('returns repositories even when README is missing', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'Rust', html_url: 'https://github.com/noreadme', stargazers_count: 2, pushed_at: '2023-03-03T00:00:00Z', fork: false }
    ];

    const fetchStub = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }

      if (stringUrl.includes('raw.githubusercontent.com')) {
        return { ok: false, status: 404 };
      }

      if (stringUrl.includes('/readme')) {
        return { status: 404, ok: false, async json() { return {}; } };
      }

      return {
        ok: true,
        async json() {
          return githubPayload;
        }
      };
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].name, 'RepoLens');
    assert.equal(repos[0].readmeRaw, null);
    assert.equal(repos[0].readmeHtmlUrl, 'https://github.com/noreadme');
  });

  test('returns public repositories except explicit exclusions', async () => {
    const githubPayload = [
      { name: 'Ameer-Jamal', description: 'Personal profile', language: 'HTML', html_url: 'https://github.com/Ameer-Jamal', stargazers_count: 5, pushed_at: '2024-01-01T00:00:00Z', fork: false },
      { name: 'class-cloud-repo', description: 'Old repo', language: 'JavaScript', html_url: 'https://github.com/Ameer-Jamal/class-cloud-repo', stargazers_count: 10, pushed_at: '2024-02-01T00:00:00Z', fork: false },
      { name: 'RepoLens', description: 'Visible repo', language: 'TypeScript', html_url: 'https://github.com/Ameer-Jamal/RepoLens', stargazers_count: 3, pushed_at: '2024-03-01T00:00:00Z', fork: false },
      { name: 'NewPublicProject', description: 'Visible repo', language: 'Go', html_url: 'https://github.com/Ameer-Jamal/NewPublicProject', stargazers_count: 2, pushed_at: '2024-04-01T00:00:00Z', fork: false }
    ];

    const fetchStub = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }

      if (stringUrl.includes('api.github.com/users/') && stringUrl.includes('/repos')) {
        return {
          ok: true,
          async json() {
            return githubPayload;
          }
        };
      }

      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/RepoLens/')) {
        return {
          ok: true,
          async text() {
            return 'Visible README content';
          }
        };
      }

      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/NewPublicProject/')) {
        return {
          ok: true,
          async text() {
            return 'New public README content';
          }
        };
      }

      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('Ameer-Jamal', { fetch: fetchStub });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 2);
    assert.equal(repos[0].name, 'RepoLens');
    assert.equal(repos[1].name, 'NewPublicProject');
    assert.equal(repos[0].readmeRaw.includes('Visible README content'), true);
  });
});
