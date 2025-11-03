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
    assert.equal(normalized.description, 'No description provided.');
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

    const fetchStub = async (url) => ({
      ok: true,
      async json() {
        return pinnedPayload;
      }
    });

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    assert.equal(repos.length, 1);
    assert.equal(repos[0].name, 'PinnedProject');
    assert.equal(repos[0].stars, 10);
  });

  test('falls back to GitHub API when pinned request fails', async () => {
    const githubPayload = [
      { name: 'Fallback', description: 'Repo', language: 'Python', html_url: 'https://github.com/fallback', stargazers_count: 7, pushed_at: '2023-02-02T00:00:00Z', fork: false },
      { name: 'Forked', fork: true }
    ];

    const fetchStub = async (url) => {
      if (String(url).includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
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
  });
});
