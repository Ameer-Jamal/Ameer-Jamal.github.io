import { GitHubApiClient, RepoRenderer, RepositoryNormalizer } from './github-projects-carousel';

describe('RepositoryNormalizer', () => {
  it('fromGitHub normalizes repository fields', () => {
    const normalized = RepositoryNormalizer.fromGitHub({
      name: 'Demo',
      description: 'Example project',
      language: 'JavaScript',
      html_url: 'https://github.com/demo',
      stargazers_count: 4,
      pushed_at: '2023-01-01T00:00:00Z'
    });

    expect(normalized.name).toBe('Demo');
    expect(normalized.description).toBe('Example project');
    expect(normalized.language).toBe('JavaScript');
    expect(normalized.url).toBe('https://github.com/demo');
    expect(normalized.stars).toBe(4);
    expect(normalized.updatedAt).toBe('2023-01-01T00:00:00Z');
  });

  it('fromPinned applies sensible defaults when fields are missing', () => {
    const normalized = RepositoryNormalizer.fromPinned({});
    expect(normalized.name).toBe('Untitled Project');
    expect(normalized.description).toBe('');
    expect(normalized.language).toBe('Not specified');
    expect(normalized.url).toBe('#');
    expect(normalized.stars).toBe(0);
    expect(normalized.updatedAt).toBeNull();
  });
});

describe('GitHubApiClient', () => {
  it('loads public GitHub repositories instead of limiting to pinned repositories', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'TypeScript', html_url: 'https://github.com/repolens', stargazers_count: 10, pushed_at: '2023-01-01T00:00:00Z', fork: false },
      { name: 'NewPublicProject', description: 'Repo', language: 'Go', html_url: 'https://github.com/new-public', stargazers_count: 5, pushed_at: '2023-01-02T00:00:00Z', fork: false }
    ];

    const fetchStub = async (url: string) => {
      const stringUrl = url;
      if (stringUrl.includes('api.github.com/users/') && stringUrl.includes('/repos')) {
        return { ok: true, async json() { return githubPayload; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/RepoLens/')) {
        return { ok: true, async text() { return '# Hello\nThis is a README'; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/NewPublicProject/')) {
        return { ok: true, async text() { return '# New Public\nThis is a README'; } };
      }
      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    expect(repos.length).toBe(2);
    expect(repos[0].name).toBe('RepoLens');
    expect(repos[0].stars).toBe(10);
    expect(repos[0].readmeRaw.includes('# Hello')).toBe(true);
    expect(repos[0].readmeHtmlUrl).toBe('https://github.com/someone/RepoLens/blob/main/README.md');
    expect(repos[1].name).toBe('NewPublicProject');
  });

  it('falls back to GitHub API when raw README is unavailable', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'Python', html_url: 'https://github.com/fallback', stargazers_count: 7, pushed_at: '2023-02-02T00:00:00Z', fork: false, forks_count: 2, open_issues_count: 1, default_branch: 'main' },
      { name: 'Forked', fork: true }
    ];

    const fetchStub = async (url: string) => {
      const stringUrl = url;
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com')) {
        return { ok: false, status: 403 };
      }
      if (stringUrl.includes('/readme')) {
        return {
          ok: true,
          async json() {
            return {
              content: btoa('Fallback README content'),
              encoding: 'base64',
              html_url: 'https://github.com/fallback/blob/main/README.md',
              download_url: 'https://raw.githubusercontent.com/fallback/main/README.md'
            };
          }
        };
      }
      return { ok: true, async json() { return githubPayload; } };
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub, repoLimit: 5 });
    const repos = await client.fetchRepositories();
    expect(repos.length).toBe(1);
    expect(repos[0].name).toBe('RepoLens');
    expect(repos[0].language).toBe('Python');
    expect(repos[0].url).toBe('https://github.com/fallback');
    expect(repos[0].readmeRaw.includes('Fallback README content')).toBe(true);
  });

  it('returns repositories even when README is missing', async () => {
    const githubPayload = [
      { name: 'RepoLens', description: 'Repo', language: 'Rust', html_url: 'https://github.com/noreadme', stargazers_count: 2, pushed_at: '2023-03-03T00:00:00Z', fork: false, default_branch: 'main' }
    ];

    let readmeApiCalls = 0;
    const fetchStub = async (url: string) => {
      const stringUrl = url;
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com')) {
        return { ok: false, status: 404 };
      }
      if (stringUrl.includes('/readme')) {
        readmeApiCalls += 1;
        return { status: 404, ok: false, async json() { return {}; } };
      }
      return { ok: true, async json() { return githubPayload; } };
    };

    const client = new GitHubApiClient('someone', { fetch: fetchStub });
    const repos = await client.fetchRepositories();
    expect(repos.length).toBe(1);
    expect(repos[0].name).toBe('RepoLens');
    expect(repos[0].readmeRaw).toBeNull();
    expect(repos[0].readmeHtmlUrl).toBe('https://github.com/noreadme');
    expect(readmeApiCalls).toBe(0);
  });

  it('returns public repositories except explicit exclusions', async () => {
    const githubPayload = [
      { name: 'Ameer-Jamal', description: 'Personal profile', language: 'HTML', html_url: 'https://github.com/Ameer-Jamal', stargazers_count: 5, pushed_at: '2024-01-01T00:00:00Z', fork: false },
      { name: 'class-cloud-repo', description: 'Old repo', language: 'JavaScript', html_url: 'https://github.com/Ameer-Jamal/class-cloud-repo', stargazers_count: 10, pushed_at: '2024-02-01T00:00:00Z', fork: false },
      { name: 'RepoLens', description: 'Visible repo', language: 'TypeScript', html_url: 'https://github.com/Ameer-Jamal/RepoLens', stargazers_count: 3, pushed_at: '2024-03-01T00:00:00Z', fork: false },
      { name: 'NewPublicProject', description: 'Visible repo', language: 'Go', html_url: 'https://github.com/Ameer-Jamal/NewPublicProject', stargazers_count: 2, pushed_at: '2024-04-01T00:00:00Z', fork: false }
    ];

    const fetchStub = async (url: string) => {
      const stringUrl = url;
      if (stringUrl.includes('gh-pinned-repos')) {
        return { ok: false, async json() { return []; } };
      }
      if (stringUrl.includes('api.github.com/users/') && stringUrl.includes('/repos')) {
        return { ok: true, async json() { return githubPayload; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/RepoLens/')) {
        return { ok: true, async text() { return 'Visible README content'; } };
      }
      if (stringUrl.includes('raw.githubusercontent.com') && stringUrl.includes('/NewPublicProject/')) {
        return { ok: true, async text() { return 'New public README content'; } };
      }
      throw new Error(`Unexpected URL in fetchStub: ${url}`);
    };

    const client = new GitHubApiClient('Ameer-Jamal', { fetch: fetchStub });
    const repos = await client.fetchRepositories();
    expect(repos.length).toBe(2);
    expect(repos[0].name).toBe('RepoLens');
    expect(repos[1].name).toBe('NewPublicProject');
    expect(repos[0].readmeRaw.includes('Visible README content')).toBe(true);
  });
});

describe('RepoRenderer carousel', () => {
  const repos = [
    { name: 'First Project', description: 'First description', language: 'TypeScript', url: 'https://github.com/Ameer-Jamal/first', stars: 3, forks: 1, openIssues: 0, updatedAt: '2026-01-01T00:00:00Z' },
    { name: 'Second Project', description: 'Second description', language: 'Python', url: 'https://github.com/Ameer-Jamal/second', stars: 2, forks: 0, openIssues: 1, updatedAt: '2026-01-02T00:00:00Z' }
  ];

  it('renders projects as a carousel and navigates between cards', () => {
    const container = document.createElement('div');
    const renderer = new RepoRenderer(container, { username: 'Ameer-Jamal' });
    renderer.renderRepositories(repos);

    expect(container.querySelector('.github-projects__carousel')).toBeTruthy();
    expect(container.textContent).toContain('First Project');
    expect(container.textContent).toContain('Project 1 of 2');

    const nextButton = container.querySelector('.github-projects__carousel .github-projects__nav--next') as HTMLButtonElement;
    nextButton.click();
    expect(container.textContent).toContain('Second Project');
    expect(container.textContent).toContain('Project 2 of 2');

    const previousButton = container.querySelector('.github-projects__carousel .github-projects__nav--previous') as HTMLButtonElement;
    previousButton.click();
    expect(container.textContent).toContain('First Project');
    expect(container.textContent).toContain('Project 1 of 2');
  });

  it('renders a friendly message when there are no repositories', () => {
    const container = document.createElement('div');
    const renderer = new RepoRenderer(container, { username: 'Ameer-Jamal' });
    renderer.renderRepositories([]);
    expect(container.querySelector('.github-projects__status--error')).toBeTruthy();
  });
});
