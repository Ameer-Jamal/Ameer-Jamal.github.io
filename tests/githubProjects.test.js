const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  RepositoryNormalizer,
  GitHubApiClient
} = require('../assets/js/githubProjects.js');

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
  test('returns pinned repositories when available', async () => {
    const pinnedPayload = [
      { repo: 'PinnedProject', description: 'Pinned', language: 'TypeScript', link: 'https://github.com/pinned', stars: 10 }
    ];

    const fetchStub = async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes('gh-pinned-repos')) {
        return {
          ok: true,
          async json() {
            return pinnedPayload;
          }
        };
      }

      // README is loaded from raw.githubusercontent.com first (avoids REST rate limits in the browser).
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/PinnedProject/')) {
        return {
          ok: true,
          async text() {
            return '# Hello\nThis is a README';
          }
        };
      }

      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].name, 'PinnedProject');
    assert.equal(repos[0].stars, 10);
    assert.equal(repos[0].readmeRaw.includes('# Hello'), true);
    assert.equal(repos[0].readmeHtmlUrl, 'https://github.com/someone/PinnedProject/blob/main/README.md');
  });

  test('falls back to GitHub API when pinned request fails', async () => {
    const githubPayload = [
      { name: 'Fallback', description: 'Repo', language: 'Python', html_url: 'https://github.com/fallback', stargazers_count: 7, pushed_at: '2023-02-02T00:00:00Z', fork: false, forks_count: 2, open_issues_count: 1 },
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
    assert.equal(repos[0].name, 'Fallback');
    assert.equal(repos[0].language, 'Python');
    assert.equal(repos[0].url, 'https://github.com/fallback');
    assert.equal(repos[0].readmeRaw.includes('Fallback README content'), true);
  });

  test('returns repositories even when README is missing', async () => {
    const githubPayload = [
      { name: 'NoReadmeRepo', description: 'Repo', language: 'Rust', html_url: 'https://github.com/noreadme', stargazers_count: 2, pushed_at: '2023-03-03T00:00:00Z', fork: false }
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
    assert.equal(repos[0].name, 'NoReadmeRepo');
    assert.equal(repos[0].readmeRaw, null);
    assert.equal(repos[0].readmeHtmlUrl, 'https://github.com/noreadme');
  });

  test('excludes configured repositories from results', async () => {
    const githubPayload = [
      { name: 'Ameer-Jamal', description: 'Personal profile', language: 'HTML', html_url: 'https://github.com/Ameer-Jamal', stargazers_count: 5, pushed_at: '2024-01-01T00:00:00Z', fork: false },
      { name: 'Ameer-Jamal.github.io', description: 'Portfolio site', language: 'HTML', html_url: 'https://github.com/Ameer-Jamal/Ameer-Jamal.github.io', stargazers_count: 10, pushed_at: '2024-02-01T00:00:00Z', fork: false },
      { name: 'ShownProject', description: 'Visible repo', language: 'TypeScript', html_url: 'https://github.com/Ameer-Jamal/shown', stargazers_count: 3, pushed_at: '2024-03-01T00:00:00Z', fork: false }
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

      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/ShownProject/')) {
        return {
          ok: true,
          async text() {
            return 'Visible README content';
          }
        };
      }

      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('Ameer-Jamal', { fetch: fetchStub });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].name, 'ShownProject');
    assert.equal(repos[0].readmeRaw.includes('Visible README content'), true);
  });
});
