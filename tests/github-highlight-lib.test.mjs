import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildHighlightList,
  EXCLUDED_REPO_NAMES_LOWER,
  mapGitHubRepoToHighlight,
  shouldIncludeRepo,
} from '../scripts/github-highlight-lib.mjs';

describe('shouldIncludeRepo', () => {
  it('excludes forks', () => {
    assert.equal(
      shouldIncludeRepo({
        name: 'cool-app',
        fork: true,
        private: false,
      }),
      false,
    );
  });

  it('excludes private repos', () => {
    assert.equal(
      shouldIncludeRepo({
        name: 'secret',
        fork: false,
        private: true,
      }),
      false,
    );
  });

  it('excludes portfolio noise names (case-insensitive)', () => {
    assert.equal(
      shouldIncludeRepo({
        name: 'Ameer-Jamal.github.io',
        fork: false,
        private: false,
      }),
      false,
    );
    assert.equal(
      shouldIncludeRepo({
        name: 'ameer-jamal',
        fork: false,
        private: false,
      }),
      false,
    );
  });

  it('includes a normal public repo', () => {
    assert.equal(
      shouldIncludeRepo({
        name: 'class-cloud-repo',
        fork: false,
        private: false,
      }),
      true,
    );
  });

  it('rejects missing name', () => {
    assert.equal(shouldIncludeRepo(null), false);
    assert.equal(shouldIncludeRepo({ fork: false }), false);
  });
});

describe('mapGitHubRepoToHighlight', () => {
  it('maps GitHub API fields to fallback shape', () => {
    const row = mapGitHubRepoToHighlight({
      name: 'demo',
      description: 'Hello',
      language: 'TypeScript',
      html_url: 'https://github.com/o/demo',
      stargazers_count: 3,
      forks_count: 1,
      open_issues_count: 0,
      pushed_at: '2024-06-01T12:00:00Z',
    });
    assert.deepEqual(row, {
      name: 'demo',
      description: 'Hello',
      language: 'TypeScript',
      url: 'https://github.com/o/demo',
      stars: 3,
      forks: 1,
      openIssues: 0,
      updatedAt: '2024-06-01T12:00:00Z',
    });
  });

  it('uses defaults for missing fields', () => {
    const row = mapGitHubRepoToHighlight({
      name: 'x',
      fork: false,
      private: false,
    });
    assert.equal(row.description, '');
    assert.equal(row.language, 'Not specified');
    assert.equal(row.url, '#');
    assert.equal(row.stars, 0);
    assert.equal(row.updatedAt, null);
  });
});

describe('buildHighlightList', () => {
  it('filters, maps, and sorts by stars descending', () => {
    const list = buildHighlightList([
      {
        name: 'low',
        fork: false,
        private: false,
        stargazers_count: 1,
        html_url: 'https://github.com/o/low',
      },
      {
        name: 'high',
        fork: false,
        private: false,
        stargazers_count: 99,
        html_url: 'https://github.com/o/high',
      },
      {
        name: 'forked',
        fork: true,
        private: false,
        stargazers_count: 1000,
      },
      {
        name: 'ameer-jamal.github.io',
        fork: false,
        private: false,
      },
    ]);
    assert.equal(list.length, 2);
    assert.equal(list[0].name, 'high');
    assert.equal(list[1].name, 'low');
  });

  it('returns empty for non-array', () => {
    assert.deepEqual(buildHighlightList(null), []);
    assert.deepEqual(buildHighlightList(undefined), []);
  });
});

describe('EXCLUDED_REPO_NAMES_LOWER', () => {
  it('matches githubProjects.js excludes', () => {
    assert.ok(EXCLUDED_REPO_NAMES_LOWER.has('ameer-jamal'));
    assert.ok(EXCLUDED_REPO_NAMES_LOWER.has('ameer-jamal.github.io'));
  });
});
