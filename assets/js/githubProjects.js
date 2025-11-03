(function (global) {
    'use strict';

    class RepositoryNormalizer {
        static fromPinned(pinnedRepo) {
            if (!pinnedRepo || typeof pinnedRepo !== 'object') {
                throw new TypeError('pinnedRepo must be an object');
            }

            const starValue = typeof pinnedRepo.stars === 'number'
                ? pinnedRepo.stars
                : Number.parseInt(pinnedRepo.stars, 10);

            return {
                name: pinnedRepo.repo || pinnedRepo.name || 'Untitled Project',
                description: pinnedRepo.description || 'No description provided.',
                language: pinnedRepo.language || 'Not specified',
                url: pinnedRepo.link || pinnedRepo.url || '#',
                stars: Number.isFinite(starValue) ? starValue : 0,
                updatedAt: pinnedRepo.updated_at || null
            };
        }

        static fromGitHub(githubRepo) {
            if (!githubRepo || typeof githubRepo !== 'object') {
                throw new TypeError('githubRepo must be an object');
            }

            return {
                name: githubRepo.name || 'Untitled Project',
                description: githubRepo.description || 'No description provided.',
                language: githubRepo.language || 'Not specified',
                url: githubRepo.html_url || '#',
                stars: typeof githubRepo.stargazers_count === 'number' ? githubRepo.stargazers_count : 0,
                updatedAt: githubRepo.pushed_at || githubRepo.updated_at || null
            };
        }
    }

    class GitHubApiClient {
        constructor(username, options = {}) {
            if (!username) {
                throw new Error('username is required');
            }

            this.username = username;
            const defaultFetch = typeof global.fetch === 'function'
                ? global.fetch.bind(global)
                : () => Promise.reject(new Error('Fetch API is not available in this environment.'));

            this.fetcher = options.fetch || defaultFetch;
            this.pinnedServiceUrl = options.pinnedServiceUrl || 'https://gh-pinned-repos.egoist.dev/';
            this.repoLimit = options.repoLimit || 6;
        }

        async fetchRepositories() {
            try {
                const pinnedRepos = await this.fetchPinnedRepositories();
                if (Array.isArray(pinnedRepos) && pinnedRepos.length > 0) {
                    return pinnedRepos.slice(0, this.repoLimit);
                }
            } catch (error) {
                console.warn('Failed to load pinned repositories, falling back to GitHub API.', error);
            }

            return this.fetchFromGitHubApi();
        }

        async fetchPinnedRepositories() {
            const url = new URL(this.pinnedServiceUrl);
            url.searchParams.set('username', this.username);

            const response = await this.fetcher(url.toString());
            if (!response.ok) {
                throw new Error('Pinned repositories request failed');
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }

            return data.map((repo) => RepositoryNormalizer.fromPinned(repo));
        }

        async fetchFromGitHubApi() {
            const url = `https://api.github.com/users/${this.username}/repos?per_page=100&sort=updated`;
            const response = await this.fetcher(url);
            if (!response.ok) {
                throw new Error('GitHub API request failed');
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }

            const filtered = data.filter((repo) => !repo.fork);
            const normalized = filtered.map((repo) => RepositoryNormalizer.fromGitHub(repo));
            normalized.sort((a, b) => b.stars - a.stars || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
            return normalized.slice(0, this.repoLimit);
        }
    }

    class RepoRenderer {
        constructor(container, doc = document) {
            if (!container) {
                throw new Error('A container element is required');
            }
            this.container = container;
            this.doc = doc;
        }

        renderLoading() {
            this.container.innerHTML = '';
            const loading = this.doc.createElement('p');
            loading.className = 'github-projects__status';
            loading.textContent = 'Loading GitHub projects...';
            this.container.appendChild(loading);
        }

        renderError(message) {
            this.container.innerHTML = '';
            const error = this.doc.createElement('p');
            error.className = 'github-projects__status github-projects__status--error';
            error.textContent = message;
            this.container.appendChild(error);
        }

        renderRepositories(repositories) {
            this.container.innerHTML = '';

            if (!repositories || repositories.length === 0) {
                this.renderError('No public projects found just yet. Please check back soon!');
                return;
            }

            repositories.forEach((repo) => {
                const card = this.doc.createElement('article');
                card.className = 'github-projects__card';

                const title = this.doc.createElement('h4');
                title.className = 'github-projects__card-title';
                title.textContent = repo.name;

                const description = this.doc.createElement('p');
                description.className = 'github-projects__card-description';
                description.textContent = repo.description;

                const meta = this.doc.createElement('p');
                meta.className = 'github-projects__card-meta';
                const language = repo.language ? `${repo.language}` : 'Not specified';
                const stars = `${repo.stars}★`;
                const updated = repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : 'Recently updated';
                meta.textContent = `${language} • ${stars} • ${updated}`;

                const link = this.doc.createElement('a');
                link.className = 'github-projects__card-link';
                link.href = repo.url;
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = 'View on GitHub';

                card.appendChild(title);
                card.appendChild(description);
                card.appendChild(meta);
                card.appendChild(link);

                this.container.appendChild(card);
            });
        }
    }

    class RepoSectionController {
        constructor({ containerId, username, renderer, apiClient }) {
            this.containerId = containerId;
            this.username = username;
            this.renderer = renderer;
            this.apiClient = apiClient;
        }

        async init() {
            try {
                const containerElement = this.getContainer();
                this.renderer = this.renderer || new RepoRenderer(containerElement);
                this.apiClient = this.apiClient || new GitHubApiClient(this.username);

                this.renderer.renderLoading();
                const repos = await this.apiClient.fetchRepositories();
                this.renderer.renderRepositories(repos);
            } catch (error) {
                const containerElement = this.safeGetContainer();
                if (containerElement) {
                    const fallbackRenderer = this.renderer || new RepoRenderer(containerElement);
                    fallbackRenderer.renderError('Unable to load GitHub projects right now. Please try again later.');
                }
                console.error('Unable to initialize GitHub project section.', error);
            }
        }

        getContainer() {
            const element = this.safeGetContainer();
            if (!element) {
                throw new Error(`Container with id "${this.containerId}" not found`);
            }
            return element;
        }

        safeGetContainer() {
            if (!this.containerId) {
                return null;
            }
            return document.getElementById(this.containerId);
        }
    }

    function initializeProjectsSection() {
        const controller = new RepoSectionController({
            containerId: 'github-projects',
            username: 'Ameer-Jamal'
        });
        controller.init();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeProjectsSection);
        } else {
            initializeProjectsSection();
        }
    }

    const exported = {
        RepositoryNormalizer,
        GitHubApiClient,
        RepoRenderer,
        RepoSectionController
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    } else {
        global.GitHubProjects = exported;
    }
})(typeof window !== 'undefined' ? window : globalThis);
