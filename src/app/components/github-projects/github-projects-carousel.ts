/* eslint-disable */
// @ts-nocheck
/**
 * GitHub projects carousel logic, ported verbatim from the former
 * src/assets/js/githubProjects.js global script into a bundled ES module so it is
 * owned by the Angular GitHubProjectsComponent. Behavior is intentionally unchanged.
 */
const global = (typeof window !== 'undefined' ? window : globalThis);

    const isLocalEnv = typeof window !== 'undefined'
        && window.location
        && window.location.hostname === 'localhost';

    const noop = () => {};
    const bindConsole = (method) => {
        if (!isLocalEnv || typeof console === 'undefined' || typeof console[method] !== 'function') {
            return noop;
        }
        return console[method].bind(console);
    };

    const logger = {
        info: bindConsole('info'),
        warn: bindConsole('warn'),
        error: bindConsole('error')
    };

    const EXCLUDED_REPO_NAMES_LOWER = new Set([
        'ameer-jamal',
        'ameer-jamal.github.io',
        'class-cloud-repo',
        'minmax-tictactoe',
        'realsoft-training-repo',
        'madaincorp'
    ]);

    function normalizeProjectUrl(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            return null;
        }

        try {
            const parsed = new URL(value.trim());
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return null;
            }

            return parsed.toString();
        } catch (_error) {
            return null;
        }
    }

    function getProjectHomepage(repo) {
        const homepage = normalizeProjectUrl(repo && repo.homepage);
        const repositoryUrl = normalizeProjectUrl(repo && repo.url);
        if (!homepage || homepage === repositoryUrl) {
            return null;
        }

        return homepage;
    }

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
                description: pinnedRepo.description || '',
                language: pinnedRepo.language || 'Not specified',
                url: pinnedRepo.link || pinnedRepo.url || '#',
                stars: Number.isFinite(starValue) ? starValue : 0,
                updatedAt: pinnedRepo.updated_at || null,
                forks: typeof pinnedRepo.forks === 'number' ? pinnedRepo.forks : 0,
                openIssues: typeof pinnedRepo.open_issues === 'number' ? pinnedRepo.open_issues : 0,
                watchers: typeof pinnedRepo.watchers === 'number' ? pinnedRepo.watchers : null,
                defaultBranch: pinnedRepo.default_branch || null,
                homepage: normalizeProjectUrl(pinnedRepo.homepage)
            };
        }

        static fromGitHub(githubRepo) {
            if (!githubRepo || typeof githubRepo !== 'object') {
                throw new TypeError('githubRepo must be an object');
            }

            return {
                name: githubRepo.name || 'Untitled Project',
                description: githubRepo.description || '',
                language: githubRepo.language || 'Not specified',
                url: githubRepo.html_url || '#',
                stars: typeof githubRepo.stargazers_count === 'number' ? githubRepo.stargazers_count : 0,
                forks: typeof githubRepo.forks_count === 'number' ? githubRepo.forks_count : 0,
                openIssues: typeof githubRepo.open_issues_count === 'number' ? githubRepo.open_issues_count : 0,
                watchers: typeof githubRepo.watchers_count === 'number' ? githubRepo.watchers_count : null,
                defaultBranch:
                    typeof githubRepo.default_branch === 'string' && githubRepo.default_branch !== ''
                        ? githubRepo.default_branch
                        : null,
                homepage: normalizeProjectUrl(githubRepo.homepage),
                updatedAt: githubRepo.pushed_at || githubRepo.updated_at || null
            };
        }
    }

    class GitHubApiClient {
        constructor(username: any, options: any = {}) {
            if (!username) {
                throw new Error('username is required');
            }

            this.username = username;
            const defaultFetch = typeof global.fetch === 'function'
                ? global.fetch.bind(global)
                : () => Promise.reject(new Error('Fetch API is not available in this environment.'));

            this.fetcher = options.fetch || defaultFetch;
            this.pinnedServiceUrl = options.pinnedServiceUrl || 'https://gh-pinned-repos.egoist.dev/';
            const limitOption = options.repoLimit;
            this.repoLimit = Number.isInteger(limitOption) && limitOption > 0 ? limitOption : null;
        }

        async fetchRepositories() {
            let repositories = [];
            try {
                repositories = await this.fetchFromGitHubApi();
            } catch (apiError) {
                logger.warn('[GitHubProjects] GitHub API request failed; will try static fallback.', apiError);
            }

            if (!repositories.length) {
                const fallbackRepos = await this.fetchStaticFallbackRepositories();
                if (fallbackRepos.length > 0) {
                    logger.info('[GitHubProjects] Using static fallback repository list.', {
                        total: fallbackRepos.length
                    });
                    repositories = fallbackRepos;
                }
            }

            const filtered = this.filterExcluded(repositories);
            const sorted = this.sortRepositories(filtered);
            const limited = this.applyRepoLimit(sorted);
            const annotated = await this.annotateWithReadmeMetadata(limited);
            const enriched = await this.enrichRepositories(annotated);
            logger.info('[GitHubProjects] Rendering GitHub API repositories.', {
                username: this.username,
                total: enriched.length
            });
            return enriched;
        }

        async fetchPinnedRepositories() {
            const url = new URL(this.pinnedServiceUrl);
            url.searchParams.set('username', this.username);

            logger.info('[GitHubProjects] Requesting pinned repositories.', {
                url: url.toString()
            });

            let response;
            try {
                response = await this.fetcher(url.toString());
            } catch (error) {
                logger.error('[GitHubProjects] Network error while fetching pinned repositories.', error);
                throw error;
            }
            if (!response.ok) {
                const status = typeof response.status === 'number' ? response.status : 'unknown';
                const statusText = response.statusText || 'No status text';
                logger.warn('[GitHubProjects] Pinned repositories request failed.', {
                    status,
                    statusText
                });
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
            logger.info('[GitHubProjects] Requesting repositories from GitHub API.', { url });

            let response;
            try {
                response = await this.fetcher(url, {
                    headers: {
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
            } catch (error) {
                logger.error('[GitHubProjects] Network error while fetching repositories from GitHub API.', error);
                throw error;
            }
            if (!response.ok) {
                const status = typeof response.status === 'number' ? response.status : 'unknown';
                const statusText = response.statusText || 'No status text';
                logger.error('[GitHubProjects] GitHub API request failed.', {
                    status,
                    statusText
                });
                throw new Error('GitHub API request failed');
            }

            const data = await response.json();
            if (!Array.isArray(data)) {
                return [];
            }

            const filtered = data.filter((repo) => !repo.fork);
            return filtered.map((repo) => RepositoryNormalizer.fromGitHub(repo));
        }

        async fetchStaticFallbackRepositories() {
            const paths = ['assets/data/github-highlight-repos.json'];
            for (const relativePath of paths) {
                let resolvedUrl = relativePath;
                try {
                    if (typeof global.location !== 'undefined' && global.location && global.location.href) {
                        resolvedUrl = new URL(relativePath, global.location.href).toString();
                    }
                } catch (parseError) {
                    logger.warn('[GitHubProjects] Could not resolve fallback URL.', parseError);
                }

                try {
                    const response = await this.fetcher(resolvedUrl);
                    if (!response.ok) {
                        logger.warn('[GitHubProjects] Fallback file request failed.', {
                            status: response.status,
                            url: resolvedUrl
                        });
                        continue;
                    }
                    const data = await response.json();
                    if (!Array.isArray(data) || data.length === 0) {
                        continue;
                    }

                    return data.map((item) => ({
                        name: item.name || 'Untitled Project',
                        description: typeof item.description === 'string' ? item.description : '',
                        language: item.language || 'Not specified',
                        url: item.url || '#',
                        stars: typeof item.stars === 'number' ? item.stars : 0,
                        forks: typeof item.forks === 'number' ? item.forks : 0,
                        openIssues: typeof item.openIssues === 'number' ? item.openIssues : 0,
                        watchers: null,
                        defaultBranch:
                            typeof item.defaultBranch === 'string' && item.defaultBranch !== ''
                                ? item.defaultBranch
                                : (typeof item.default_branch === 'string' && item.default_branch !== ''
                                    ? item.default_branch
                                    : null),
                        homepage: normalizeProjectUrl(item.homepage),
                        updatedAt: item.updatedAt || null
                    }));
                } catch (error) {
                    logger.warn('[GitHubProjects] Unable to load static fallback repositories.', error);
                }
            }

            return [];
        }

        /**
         * Loads precomputed README availability from the shipped highlight JSON so we can
         * skip probing repositories that have no README (avoids noisy 404 requests).
         * Best-effort: any failure resolves to an empty map and normal probing resumes.
         */
        async loadReadmeMetadata() {
            if (this._readmeMetadataPromise) {
                return this._readmeMetadataPromise;
            }

            this._readmeMetadataPromise = (async () => {
                const map = new Map();
                const relativePath = 'assets/data/github-highlight-repos.json';
                let resolvedUrl = relativePath;
                try {
                    if (typeof global.location !== 'undefined' && global.location && global.location.href) {
                        resolvedUrl = new URL(relativePath, global.location.href).toString();
                    }
                } catch (_error) {
                    resolvedUrl = relativePath;
                }

                try {
                    const response = await this.fetcher(resolvedUrl);
                    if (!response || !response.ok) {
                        return map;
                    }
                    const data = await response.json();
                    if (!Array.isArray(data)) {
                        return map;
                    }
                    for (const item of data) {
                        if (!item || typeof item.name !== 'string') {
                            continue;
                        }
                        // Only entries that carry a readmeRawUrl key have actually been checked.
                        if (Object.prototype.hasOwnProperty.call(item, 'readmeRawUrl')) {
                            map.set(item.name.trim().toLowerCase(), {
                                readmeChecked: true,
                                readmeRawUrl: item.readmeRawUrl || null,
                                readmeHtmlUrl: item.readmeHtmlUrl || null
                            });
                        }
                    }
                } catch (_error) {
                    // Metadata is best-effort; fall back to live probing.
                }
                return map;
            })();

            return this._readmeMetadataPromise;
        }

        async annotateWithReadmeMetadata(repositories = []) {
            if (!repositories.length) {
                return repositories;
            }
            const metadata = await this.loadReadmeMetadata();
            if (!metadata || metadata.size === 0) {
                return repositories;
            }
            return repositories.map((repo) => {
                const key = repo && repo.name ? String(repo.name).trim().toLowerCase() : '';
                const meta = key ? metadata.get(key) : null;
                return meta ? Object.assign({}, repo, { readmeMeta: meta }) : repo;
            });
        }

        sortRepositories(repositories = []) {
            return [...repositories].sort((a, b) => {
                const starDelta = (b.stars || 0) - (a.stars || 0);
                if (starDelta !== 0) {
                    return starDelta;
                }
                const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return dateB - dateA;
            });
        }

        filterExcluded(repositories = []) {
            return repositories.filter((repo) => {
                if (!repo || !repo.name) {
                    return false;
                }
                const normalized = String(repo.name).trim().toLowerCase();
                return !EXCLUDED_REPO_NAMES_LOWER.has(normalized);
            });
        }

        applyRepoLimit(repositories = []) {
            if (!this.repoLimit) {
                return repositories;
            }
            return repositories.slice(0, this.repoLimit);
        }

        async enrichRepositories(repositories = []) {
            if (!repositories.length) {
                return [];
            }

            const enriched = [];
            for (const repo of repositories) {
                try {
                    const readme = await this.fetchReadme(repo);
                    enriched.push(Object.assign({}, repo, {
                        readmeRaw: readme ? readme.text : null,
                        readmeHtmlUrl: readme && readme.htmlUrl ? readme.htmlUrl : repo.url,
                        readmeRawUrl: readme && readme.rawUrl ? readme.rawUrl : null,
                        readmeRawBaseUrl: readme && readme.rawBaseUrl ? readme.rawBaseUrl : null,
                        readmeHtmlBaseUrl: readme && readme.htmlBaseUrl ? readme.htmlBaseUrl : null
                    }));
                } catch (error) {
                    logger.warn('[GitHubProjects] Unable to load README for a repository.', {
                        message: error && error.message ? error.message : 'Unknown error'
                    });
                    enriched.push(Object.assign({}, repo, {
                        readmeRaw: null,
                        readmeHtmlUrl: repo.url,
                        readmeRawUrl: null,
                        readmeRawBaseUrl: null,
                        readmeHtmlBaseUrl: null
                    }));
                }
            }

            return enriched;
        }

        /**
         * Public repos: load README from raw.githubusercontent.com first (no REST auth → avoids 403 rate limits).
         * Falls back to REST /readme only on non-404 failures (e.g. rate limits, uncommon filenames).
         */
        async fetchReadme(repo) {
            if (!repo || !repo.name) {
                return null;
            }

            // Precomputed metadata says this repo has no README anywhere: skip the
            // probe entirely so we don't fire a request that is guaranteed to 404.
            if (repo.readmeMeta && repo.readmeMeta.readmeChecked && !repo.readmeMeta.readmeRawUrl) {
                return null;
            }

            const fromRaw = await this.fetchReadmeFromRaw(repo);
            if (fromRaw && fromRaw.text) {
                return fromRaw;
            }
            if (fromRaw && fromRaw.notFound) {
                return null;
            }

            return this.fetchReadmeFromApi(repo);
        }

        async fetchReadmeFromRaw(repo) {
            const repoName = repo.name;
            const owner = this.username;
            const encodedRepo = encodeURIComponent(repoName);
            const branch = repo.defaultBranch || 'main';
            const file = 'README.md';
            const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, '/');
            const url = `https://raw.githubusercontent.com/${owner}/${encodedRepo}/${encodedBranch}/${file}`;

            try {
                const response = await this.fetcher(url);
                if (!response) {
                    return null;
                }
                if (response.status === 404) {
                    return { notFound: true };
                }
                if (!response.ok) {
                    return null;
                }
                const text = typeof response.text === 'function'
                    ? await response.text()
                    : '';
                const trimmed = typeof text === 'string' ? text.trim() : '';
                if (!trimmed) {
                    return { notFound: true };
                }
                const rawBase = `https://raw.githubusercontent.com/${owner}/${encodedRepo}/${encodedBranch}/`;
                const htmlBase = `https://github.com/${owner}/${encodedRepo}/blob/${encodedBranch}/`;
                return {
                    text: trimmed,
                    htmlUrl: `${htmlBase}${file}`,
                    rawUrl: url,
                    rawBaseUrl: rawBase,
                    htmlBaseUrl: htmlBase
                };
            } catch (_error) {
                return null;
            }
        }

        async fetchReadmeFromApi(repo) {
            const repoName = repo.name;
            const encodedName = encodeURIComponent(repoName);
            const url = `https://api.github.com/repos/${this.username}/${encodedName}/readme`;

            let response;
            try {
                response = await this.fetcher(url, {
                    headers: {
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
            } catch (_error) {
                return null;
            }

            if (response.status === 404 || !response.ok) {
                return null;
            }

            let data;
            try {
                data = await response.json();
            } catch (_parseError) {
                return null;
            }

            if (!data || typeof data !== 'object') {
                return null;
            }

            const encoding = data.encoding || 'base64';
            const content = typeof data.content === 'string'
                ? decodeReadmeContent(data.content, encoding)
                : null;

            return {
                text: content ? content.trim() : null,
                htmlUrl: data.html_url || data.download_url || repo.url,
                rawUrl: data.download_url || null,
                rawBaseUrl: deriveBaseUrl(data.download_url),
                htmlBaseUrl: deriveBaseUrl(data.html_url)
            };
        }
    }

    class RepoRenderer {
        constructor(container: any, { doc = document, username = null }: any = {}) {
            if (!container) {
                throw new Error('A container element is required');
            }
            this.container = container;
            this.doc = doc;
            this.username = username;
        }

        renderLoading() {
            this.container.innerHTML = '';
            const loader = this.doc.createElement('div');
            loader.className = 'github-projects__loader';

            const spinner = this.doc.createElement('div');
            spinner.className = 'github-projects__spinner';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-label', 'Loading GitHub projects');

            loader.appendChild(spinner);
            this.container.appendChild(loader);
        }

        renderError({ message, showLink } = {}) {
            this.container.innerHTML = '';
            const error = this.doc.createElement('div');
            error.className = 'github-projects__status github-projects__status--error';

            if (showLink && this.username) {
                const link = this.doc.createElement('a');
                link.href = `https://github.com/${this.username}?tab=repositories`;
                link.target = '_blank';
                link.rel = 'noopener';
                link.textContent = 'Click here to view my GitHub projects';
                error.appendChild(link);
            } else if (message) {
                error.textContent = message;
            } else {
                error.textContent = 'Something went wrong. Please try again later.';
            }

            this.container.appendChild(error);
        }

        renderRepositories(repositories) {
            this.container.innerHTML = '';

            if (!repositories || repositories.length === 0) {
                logger.info('[GitHubProjects] No repositories available after fetch.', {
                    total: repositories ? repositories.length : 0
                });
                this.renderError({ message: 'No public projects found just yet. Please check back soon!' });
                return;
            }

            const markdownRenderer = new MarkdownRenderer({ doc: this.doc });
            const responsiveShell = this.doc.createElement('div');
            responsiveShell.className = 'github-projects__responsive-shell';

            const carousel = new RepoCarousel(this.doc, repositories, {
                markdownRenderer,
                username: this.username
            });

            const mobileCarousel = new RepoCarousel(this.doc, repositories, {
                markdownRenderer,
                username: this.username,
                rootClassName: 'github-projects__mobile-carousel'
            });

            responsiveShell.appendChild(carousel.getElement());
            responsiveShell.appendChild(mobileCarousel.getElement());
            this.container.appendChild(responsiveShell);
        }
    }

    class RepoCarousel {
        constructor(doc, repositories, options = {}) {
            this.doc = doc;
            this.repositories = Array.isArray(repositories) ? repositories : [];
            this.total = this.repositories.length;
            this.currentIndex = 0;
            this.markdownRenderer = options.markdownRenderer || new MarkdownRenderer({ doc: this.doc });
            this.username = options.username || null;
            this.expandedDialog = null;
            this.rootClassName = options.rootClassName || 'github-projects__carousel';
            this.handleExpandedKeydown = (event) => {
                if (event.key === 'Escape') {
                    this.closeExpandedProject();
                }
            };

            this.root = this.doc.createElement('div');
            this.root.className = this.rootClassName;

            this.prevButton = this.createNavButton('previous', '‹');
            this.nextButton = this.createNavButton('next', '›');

            this.cardHost = this.doc.createElement('div');
            this.cardHost.className = 'github-projects__carousel-card';

            this.positionIndicator = this.doc.createElement('p');
            this.positionIndicator.className = 'github-projects__position';

            this.root.appendChild(this.prevButton);
            this.root.appendChild(this.cardHost);
            this.root.appendChild(this.nextButton);
            this.root.appendChild(this.positionIndicator);

            this.prevButton.addEventListener('click', () => this.goToPrevious());
            this.nextButton.addEventListener('click', () => this.goToNext());

            this.update();
        }

        getElement() {
            return this.root;
        }

        goToPrevious() {
            if (this.total <= 1) {
                return;
            }
            this.currentIndex = (this.currentIndex - 1 + this.total) % this.total;
            this.update(-1);
        }

        goToNext() {
            if (this.total <= 1) {
                return;
            }
            this.currentIndex = (this.currentIndex + 1) % this.total;
            this.update(1);
        }

        update(direction = 0) {
            this.cardHost.innerHTML = '';

            if (!this.total) {
                const fallback = this.doc.createElement('p');
                fallback.className = 'github-projects__status';
                fallback.textContent = 'No repositories to display.';
                this.cardHost.appendChild(fallback);
                this.prevButton.disabled = true;
                this.nextButton.disabled = true;
                this.positionIndicator.textContent = '';
                return;
            }

            const repo = this.repositories[this.currentIndex];
            const card = this.createCard(repo);
            if (this.isMobileCarousel()) {
                this.moveMobileNavIntoCard(card);
            }
            if (direction > 0) {
                card.classList.add('github-projects__card--enter-next');
            } else if (direction < 0) {
                card.classList.add('github-projects__card--enter-prev');
            }
            this.cardHost.appendChild(card);

            if (direction !== 0) {
                const win = this.doc && this.doc.defaultView ? this.doc.defaultView : null;
                const scheduler = win && typeof win.requestAnimationFrame === 'function'
                    ? win.requestAnimationFrame.bind(win)
                    : (typeof requestAnimationFrame === 'function'
                        ? requestAnimationFrame
                        : (callback) => setTimeout(callback, 0));
                scheduler(() => {
                    card.classList.add('github-projects__card--enter-active');
                });
                card.addEventListener('transitionend', () => {
                    card.classList.remove('github-projects__card--enter-next', 'github-projects__card--enter-prev', 'github-projects__card--enter-active');
                }, { once: true });
            }

            const disableNav = this.total <= 1;
            this.prevButton.disabled = disableNav;
            this.nextButton.disabled = disableNav;
            this.positionIndicator.textContent = `Project ${this.currentIndex + 1} of ${this.total}`;
        }

        isMobileCarousel() {
            return this.rootClassName.indexOf('github-projects__mobile-carousel') !== -1;
        }

        moveMobileNavIntoCard(card) {
            const header = card.querySelector('.github-projects__card-header');
            if (!header) {
                return;
            }

            const controls = this.doc.createElement('div');
            controls.className = 'github-projects__mobile-card-nav';
            controls.appendChild(this.prevButton);
            controls.appendChild(this.nextButton);
            header.appendChild(controls);
        }

        createNavButton(direction, label) {
            const button = this.doc.createElement('button');
            button.type = 'button';
            button.className = `github-projects__nav github-projects__nav--${direction}`;
            button.setAttribute('aria-label', `${direction === 'previous' ? 'Previous' : 'Next'} project`);
            button.textContent = label;
            return button;
        }

        createCard(repo) {
            const card = this.doc.createElement('div');
            card.className = 'github-projects__card';

            const header = this.doc.createElement('div');
            header.className = 'github-projects__card-header';

            const title = this.doc.createElement('h4');
            title.className = 'github-projects__card-title';
            title.textContent = repo.name;
            header.appendChild(title);

            const badges = this.doc.createElement('div');
            badges.className = 'github-projects__badges';
            badges.appendChild(this.createBadge(repo.language || 'Not specified'));
            const homepage = getProjectHomepage(repo);
            if (homepage) {
                badges.appendChild(this.createBadge('Live'));
            }
            const expandButton = this.doc.createElement('button');
            expandButton.type = 'button';
            expandButton.className = 'github-projects__expand';
            expandButton.setAttribute('aria-label', `Expand ${repo.name} project details`);
            const expandIcon = this.doc.createElement('span');
            expandIcon.className = 'fas fa-expand-alt';
            expandIcon.setAttribute('aria-hidden', 'true');
            expandButton.appendChild(expandIcon);
            expandButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.openExpandedProject(repo);
            });
            if (!this.isMobileCarousel()) {
                badges.appendChild(expandButton);
            }
            header.appendChild(badges);
            card.appendChild(header);

            if (repo.description && repo.description.trim().length > 0) {
                const description = this.doc.createElement('p');
                description.className = 'github-projects__card-description';
                description.textContent = repo.description;
                card.appendChild(description);
            }

            const meta = this.doc.createElement('div');
            meta.className = 'github-projects__card-meta';
            const stats = this.doc.createElement('ul');
            stats.className = 'github-projects__stats';
            this.appendRepoStats(stats, repo, { compact: this.isMobileCarousel() });
            meta.appendChild(stats);

            const readme = this.doc.createElement('div');
            readme.className = 'github-projects__readme';
            const readmeHtml = this.renderReadme(repo);
            if (readmeHtml) {
                readme.innerHTML = readmeHtml;
            } else {
                readme.classList.add('github-projects__readme--empty');
                if (repo.url && repo.url !== '#') {
                    const fallbackLink = this.doc.createElement('a');
                    fallbackLink.href = `${repo.url}#readme`;
                    fallbackLink.target = '_blank';
                    fallbackLink.rel = 'noopener';
                    fallbackLink.textContent = 'View README on GitHub';
                    readme.appendChild(fallbackLink);
                }
            }

            const actions = this.doc.createElement('div');
            actions.className = 'github-projects__links';

            const repoLink = this.doc.createElement('a');
            repoLink.className = 'github-projects__card-link';
            repoLink.href = repo.url;
            repoLink.target = '_blank';
            repoLink.rel = 'noopener';
            repoLink.textContent = 'View Repository';

            actions.appendChild(repoLink);

            if (homepage) {
                const demoLink = this.doc.createElement('a');
                demoLink.className = 'github-projects__card-link';
                demoLink.href = homepage;
                demoLink.target = '_blank';
                demoLink.rel = 'noopener';
                demoLink.textContent = 'Open Project';
                actions.appendChild(demoLink);
            }


            card.appendChild(meta);
            card.appendChild(readme);
            card.appendChild(actions);

            return card;
        }

        createMobileCard(repo, index) {
            const card = this.doc.createElement('div');
            card.className = 'github-projects__mobile-card';

            const header = this.doc.createElement('div');
            header.className = 'github-projects__mobile-card-header';

            const title = this.doc.createElement('h4');
            title.className = 'github-projects__mobile-card-title';
            title.textContent = repo.name;
            header.appendChild(title);

            const badges = this.doc.createElement('div');
            badges.className = 'github-projects__mobile-badges';
            badges.appendChild(this.createBadge(repo.language || 'Not specified'));
            const homepage = getProjectHomepage(repo);
            if (homepage) {
                badges.appendChild(this.createBadge('Live'));
            }
            header.appendChild(badges);
            card.appendChild(header);

            if (repo.description && repo.description.trim().length > 0) {
                const description = this.doc.createElement('p');
                description.className = 'github-projects__mobile-description';
                description.textContent = repo.description;
                card.appendChild(description);
            }

            const meta = this.doc.createElement('ul');
            meta.className = 'github-projects__mobile-meta';
            if ((repo.stars || 0) > 0) {
                meta.appendChild(this.createStatItem('Stars', formatNumber(repo.stars)));
            }
            meta.appendChild(this.createStatItem('Updated', repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : 'Recently updated'));
            card.appendChild(meta);

            const actions = this.doc.createElement('div');
            actions.className = 'github-projects__mobile-actions';

            const detailsButton = this.doc.createElement('button');
            detailsButton.type = 'button';
            detailsButton.className = 'github-projects__mobile-details';
            detailsButton.textContent = 'Details';
            detailsButton.setAttribute('aria-label', `Open ${repo.name} project details`);
            detailsButton.addEventListener('click', () => this.openExpandedProject(repo));
            actions.appendChild(detailsButton);

            const repoLink = this.doc.createElement('a');
            repoLink.className = 'github-projects__card-link';
            repoLink.href = repo.url;
            repoLink.target = '_blank';
            repoLink.rel = 'noopener';
            repoLink.textContent = 'Repository';
            actions.appendChild(repoLink);

            if (homepage) {
                const demoLink = this.doc.createElement('a');
                demoLink.className = 'github-projects__card-link';
                demoLink.href = homepage;
                demoLink.target = '_blank';
                demoLink.rel = 'noopener';
                demoLink.textContent = 'Open';
                actions.appendChild(demoLink);
            }

            card.appendChild(actions);

            const position = this.doc.createElement('p');
            position.className = 'github-projects__mobile-position';
            position.textContent = `${index + 1} of ${this.total}`;
            card.appendChild(position);

            return card;
        }

        openExpandedProject(repo) {
            this.closeExpandedProject();

            const overlay = this.doc.createElement('div');
            overlay.className = 'github-projects__dialog';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', `${repo.name} project details`);

            const panel = this.doc.createElement('div');
            panel.className = 'github-projects__dialog-panel';
            panel.addEventListener('click', (event) => event.stopPropagation());

            const closeButton = this.doc.createElement('button');
            closeButton.type = 'button';
            closeButton.className = 'github-projects__dialog-close';
            closeButton.setAttribute('aria-label', 'Close expanded project');
            const closeIcon = this.doc.createElement('span');
            closeIcon.className = 'fas fa-times';
            closeIcon.setAttribute('aria-hidden', 'true');
            closeButton.appendChild(closeIcon);
            closeButton.addEventListener('click', () => this.closeExpandedProject());

            const header = this.doc.createElement('div');
            header.className = 'github-projects__dialog-header';

            const titleGroup = this.doc.createElement('div');
            const title = this.doc.createElement('h3');
            title.className = 'github-projects__dialog-title';
            title.textContent = repo.name;
            titleGroup.appendChild(title);

            if (repo.description && repo.description.trim().length > 0) {
                const description = this.doc.createElement('p');
                description.className = 'github-projects__dialog-description';
                description.textContent = repo.description;
                titleGroup.appendChild(description);
            }

            const badges = this.doc.createElement('div');
            badges.className = 'github-projects__badges';
            badges.appendChild(this.createBadge(repo.language || 'Not specified'));
            const homepage = getProjectHomepage(repo);
            if (homepage) {
                badges.appendChild(this.createBadge('Live'));
            }

            header.appendChild(titleGroup);
            header.appendChild(badges);

            const stats = this.doc.createElement('ul');
            stats.className = 'github-projects__stats github-projects__stats--expanded';
            this.appendRepoStats(stats, repo, { compact: false });

            const readme = this.doc.createElement('div');
            readme.className = 'github-projects__readme github-projects__readme--expanded';
            const readmeHtml = this.renderReadme(repo);
            if (readmeHtml) {
                readme.innerHTML = readmeHtml;
            } else if (repo.url && repo.url !== '#') {
                readme.classList.add('github-projects__readme--empty');
                const fallbackLink = this.doc.createElement('a');
                fallbackLink.href = `${repo.url}#readme`;
                fallbackLink.target = '_blank';
                fallbackLink.rel = 'noopener';
                fallbackLink.textContent = 'View README on GitHub';
                readme.appendChild(fallbackLink);
            }

            const actions = this.doc.createElement('div');
            actions.className = 'github-projects__links github-projects__links--expanded';

            const repoLink = this.doc.createElement('a');
            repoLink.className = 'github-projects__card-link';
            repoLink.href = repo.url;
            repoLink.target = '_blank';
            repoLink.rel = 'noopener';
            repoLink.textContent = 'View Repository';
            actions.appendChild(repoLink);

            if (homepage) {
                const demoLink = this.doc.createElement('a');
                demoLink.className = 'github-projects__card-link';
                demoLink.href = homepage;
                demoLink.target = '_blank';
                demoLink.rel = 'noopener';
                demoLink.textContent = 'Open Project';
                actions.appendChild(demoLink);
            }

            panel.appendChild(closeButton);
            panel.appendChild(header);
            panel.appendChild(stats);
            panel.appendChild(readme);
            panel.appendChild(actions);
            overlay.appendChild(panel);
            overlay.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.closeExpandedProject();
            });

            this.doc.body.appendChild(overlay);
            this.doc.body.classList.add('github-projects-dialog-open');
            this.doc.addEventListener('keydown', this.handleExpandedKeydown);
            this.expandedDialog = overlay;
            closeButton.focus();
        }

        closeExpandedProject() {
            if (!this.expandedDialog) {
                return;
            }

            this.expandedDialog.remove();
            this.expandedDialog = null;
            this.doc.body.classList.remove('github-projects-dialog-open');
            this.doc.removeEventListener('keydown', this.handleExpandedKeydown);
        }

        createBadge(label) {
            const badge = this.doc.createElement('span');
            badge.className = 'github-projects__badge';
            badge.textContent = label;
            return badge;
        }

        appendRepoStats(statsEl, repo, options = {}) {
            const compact = Boolean(options.compact);
            if (compact) {
                statsEl.classList.add('github-projects__stats--compact');
            }

            if (!compact) {
                statsEl.appendChild(this.createStatItem('Language', repo.language || 'Not specified'));
            }
            if ((repo.stars || 0) > 0) {
                statsEl.appendChild(compact
                    ? this.createCompactStatItem('fa-star', `${formatNumber(repo.stars)} stars`, formatNumber(repo.stars))
                    : this.createStatItem('Stars', formatNumber(repo.stars)));
            }
            if ((repo.forks || 0) > 0) {
                statsEl.appendChild(compact
                    ? this.createCompactStatItem('fa-code-branch', `${formatNumber(repo.forks)} forks`, formatNumber(repo.forks))
                    : this.createStatItem('Forks', formatNumber(repo.forks)));
            }
            if ((repo.openIssues || 0) > 0) {
                statsEl.appendChild(compact
                    ? this.createCompactStatItem('fa-exclamation-circle', `${formatNumber(repo.openIssues)} open issues`, formatNumber(repo.openIssues))
                    : this.createStatItem('Open Issues', formatNumber(repo.openIssues)));
            }
            if ((repo.watchers || 0) > 0) {
                statsEl.appendChild(compact
                    ? this.createCompactStatItem('fa-eye', `${formatNumber(repo.watchers)} watchers`, formatNumber(repo.watchers))
                    : this.createStatItem('Watchers', formatNumber(repo.watchers)));
            }
            const updatedValue = repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : 'Recently updated';
            statsEl.appendChild(compact
                ? this.createCompactStatItem('fa-clock', `Updated ${updatedValue}`, updatedValue)
                : this.createStatItem('Updated', updatedValue));
        }

        createStatItem(label, value) {
            const item = this.doc.createElement('li');
            const labelSpan = this.doc.createElement('span');
            labelSpan.className = 'github-projects__stat-label';
            labelSpan.textContent = `${label}:`;
            const valueSpan = this.doc.createElement('span');
            valueSpan.className = 'github-projects__stat-value';
            valueSpan.textContent = value;
            item.appendChild(labelSpan);
            item.appendChild(valueSpan);
            return item;
        }

        createCompactStatItem(iconClass, ariaLabel, value) {
            const item = this.doc.createElement('li');
            item.setAttribute('aria-label', ariaLabel);
            const icon = this.doc.createElement('span');
            icon.className = `fas ${iconClass} github-projects__stat-icon`;
            icon.setAttribute('aria-hidden', 'true');
            const valueSpan = this.doc.createElement('span');
            valueSpan.className = 'github-projects__stat-value';
            valueSpan.textContent = value;
            item.appendChild(icon);
            item.appendChild(valueSpan);
            return item;
        }

        renderReadme(repo) {
            if (!repo || !repo.readmeRaw) {
                return null;
            }
            return this.markdownRenderer.render(repo.readmeRaw, {
                baseRawUrl: repo.readmeRawBaseUrl,
                baseHtmlUrl: repo.readmeHtmlBaseUrl
            });
        }
    }

    class MarkdownRenderer {
        constructor({ doc } = {}) {
            this.doc = doc || (typeof document !== 'undefined' ? document : null);
            const globalMarked = typeof globalThis !== 'undefined' && globalThis.marked ? globalThis.marked : null;
            if (globalMarked && typeof globalMarked.parse === 'function') {
                this.parseMarkdown = (markdown) => globalMarked.parse(markdown, {
                    mangle: false,
                    headerIds: false,
                    breaks: true
                });
            } else if (typeof globalMarked === 'function') {
                this.parseMarkdown = (markdown) => globalMarked(markdown, {
                    mangle: false,
                    headerIds: false,
                    breaks: true
                });
            } else {
                this.parseMarkdown = (markdown) => this.basicMarkdown(markdown);
            }
        }

        render(markdown, options = {}) {
            if (!markdown || typeof markdown !== 'string') {
                return null;
            }

            const parsed = this.parseMarkdown(markdown);
            if (!this.doc) {
                return parsed;
            }

            const sanitized = this.sanitize(parsed, options);
            if (!sanitized) {
                return null;
            }

            if (Number.isFinite(options.maxLength)) {
                return this.truncate(sanitized, options.maxLength);
            }

            return sanitized;
        }

        basicMarkdown(markdown) {
            const escaped = markdown
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `<p>${escaped.replace(/\r?\n\r?\n/g, '</p><p>')}</p>`;
        }

        sanitize(html, context = {}) {
            if (!this.doc) {
                return html;
            }

            const container = this.doc.createElement('div');
            container.innerHTML = html;
            const allowedTags = new Set([
                'a', 'p', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'hr', 'img'
            ]);
            const allowedAttributes = {
                a: new Set(['href', 'title']),
                img: new Set(['src', 'alt', 'title'])
            };

            const stack = [container];
            while (stack.length > 0) {
                const node = stack.pop();
                for (let child = node.firstChild; child; ) {
                    const nextSibling = child.nextSibling;
                    if (child.nodeType === 8) {
                        node.removeChild(child);
                    } else if (child.nodeType === 1) {
                        const tagName = child.tagName.toLowerCase();
                        if (!allowedTags.has(tagName)) {
                            this.unwrapNode(child);
                        } else {
                            this.sanitizeAttributes(child, tagName, allowedAttributes, context);
                            stack.push(child);
                        }
                    } else {
                        stack.push(child);
                    }
                    child = nextSibling;
                }
            }

            return container.innerHTML.trim();
        }

        sanitizeAttributes(element, tagName, allowedAttributes, context) {
            for (let i = element.attributes.length - 1; i >= 0; i -= 1) {
                const attr = element.attributes[i];
                const attrName = attr.name.toLowerCase();
                if (attrName.startsWith('on') || attrName === 'style') {
                    element.removeAttribute(attr.name);
                    continue;
                }

                const allowed = allowedAttributes[tagName];
                if (allowed && !allowed.has(attrName)) {
                    element.removeAttribute(attr.name);
                }
            }

            if (tagName === 'a') {
                const safeHref = this.rewriteLink(element.getAttribute('href'), context.baseHtmlUrl);
                if (!safeHref) {
                    this.unwrapNode(element);
                    return;
                }
                element.setAttribute('href', safeHref);
                element.setAttribute('target', '_blank');
                element.setAttribute('rel', 'noopener');
            } else if (tagName === 'img') {
                const safeSrc = this.rewriteMedia(element.getAttribute('src'), context.baseRawUrl);
                if (!safeSrc) {
                    element.parentNode.removeChild(element);
                    return;
                }
                element.setAttribute('src', safeSrc);
                element.setAttribute('loading', 'lazy');
                element.setAttribute('decoding', 'async');
            }
        }

        rewriteLink(href, baseHtmlUrl) {
            if (!href) {
                return null;
            }
            const trimmed = href.trim();
            if (!trimmed) {
                return null;
            }
            if (/^javascript:/i.test(trimmed)) {
                return null;
            }
            if (trimmed.startsWith('#')) {
                return trimmed;
            }
            try {
                return new URL(trimmed, baseHtmlUrl || undefined).toString();
            } catch (error) {
                if (/^https?:/i.test(trimmed) || /^mailto:/i.test(trimmed)) {
                    return trimmed;
                }
                return null;
            }
        }

        rewriteMedia(src, baseRawUrl) {
            if (!src) {
                return null;
            }
            const trimmed = src.trim();
            if (/^javascript:/i.test(trimmed)) {
                return null;
            }
            if (/^https?:/i.test(trimmed) || /^data:image\//i.test(trimmed)) {
                return trimmed;
            }
            try {
                return new URL(trimmed, baseRawUrl || undefined).toString();
            } catch (error) {
                return null;
            }
        }

        unwrapNode(element) {
            const parent = element.parentNode;
            if (!parent) {
                return;
            }
            while (element.firstChild) {
                parent.insertBefore(element.firstChild, element);
            }
            parent.removeChild(element);
        }

        truncate(html, limit) {
            if (!this.doc || !Number.isFinite(limit)) {
                return html;
            }
            const container = this.doc.createElement('div');
            container.innerHTML = html;
            let total = 0;
            const showText = (this.doc.defaultView && this.doc.defaultView.NodeFilter && this.doc.defaultView.NodeFilter.SHOW_TEXT)
                || (typeof NodeFilter !== 'undefined' ? NodeFilter.SHOW_TEXT : 4);
            const walker = this.doc.createTreeWalker(container, showText);
            const nodesToRemove = [];

            while (true) {
                const node = walker.nextNode();
                if (!node) {
                    break;
                }
                const text = node.textContent || '';
                if (!text.trim()) {
                    continue;
                }

                if (total + text.length > limit) {
                    const allowed = limit - total;
                    if (allowed > 0) {
                        node.textContent = text.slice(0, allowed).trimEnd() + '…';
                    } else {
                        nodesToRemove.push(node);
                    }
                    this.collectFollowingNodes(node, container, nodesToRemove);
                    break;
                }
                total += text.length;
            }

            nodesToRemove.forEach((node) => {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });

            return container.innerHTML;
        }

        collectFollowingNodes(node, root, bucket) {
            let current = node;
            while (current && current !== root) {
                let sibling = current.nextSibling;
                while (sibling) {
                    bucket.push(sibling);
                    sibling = sibling.nextSibling;
                }
                current = current.parentNode;
            }
        }
    }

    class RepoSectionController {
        constructor({ containerId, container, username, renderer, apiClient }: any = {}) {
            this.containerId = containerId;
            this.container = container || null;
            this.username = username;
            this.renderer = renderer;
            this.apiClient = apiClient;
        }

        async init() {
            try {
                const containerElement = this.getContainer();
                this.renderer = this.renderer || new RepoRenderer(containerElement, { username: this.username });
                this.apiClient = this.apiClient || new GitHubApiClient(this.username);

                this.renderer.renderLoading();
                const repos = await this.apiClient.fetchRepositories();
                this.renderer.renderRepositories(repos);
            } catch (error) {
                const containerElement = this.safeGetContainer();
                if (containerElement) {
                    const fallbackRenderer = this.renderer || new RepoRenderer(containerElement, { username: this.username });
                    fallbackRenderer.renderError({ showLink: true });
                }
                logger.error('[GitHubProjects] Unable to initialize GitHub project section.', error);
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
            if (this.container) {
                return this.container;
            }
            if (!this.containerId) {
                return null;
            }
            return document.getElementById(this.containerId);
        }
    }

    function decodeReadmeContent(content, encoding) {
        if (typeof content !== 'string') {
            return null;
        }

        if (encoding === 'base64') {
            try {
                return decodeBase64(content);
            } catch (error) {
                logger.warn('[GitHubProjects] Failed to decode base64 README content.', error);
                return null;
            }
        }

        return content;
    }

    function decodeBase64(input) {
        if (typeof input !== 'string') {
            throw new TypeError('input must be a base64 encoded string');
        }

        if (typeof Buffer !== 'undefined') {
            return Buffer.from(input, 'base64').toString('utf8');
        }

        if (typeof globalThis.atob === 'function') {
            const binary = globalThis.atob(input);
            const length = binary.length;
            const bytes = new Uint8Array(length);
            for (let i = 0; i < length; i += 1) {
                bytes[i] = binary.charCodeAt(i);
            }
            if (typeof TextDecoder !== 'undefined') {
                return new TextDecoder('utf-8').decode(bytes);
            }
            let result = '';
            for (let i = 0; i < bytes.length; i += 1) {
                result += String.fromCharCode(bytes[i]);
            }
            return result;
        }

        throw new Error('Base64 decoding is not supported in this environment.');
    }

    function deriveBaseUrl(url) {
        if (typeof url !== 'string') {
            return null;
        }
        const trimmed = url.trim();
        if (!trimmed) {
            return null;
        }
        const lastSlash = trimmed.lastIndexOf('/');
        if (lastSlash === -1) {
            return null;
        }
        return trimmed.slice(0, lastSlash + 1);
    }

    function formatNumber(value) {
        if (!Number.isFinite(value)) {
            return '0';
        }
        if (value >= 1000) {
            return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
        }
        return String(value);
    }

export {
    RepositoryNormalizer,
    GitHubApiClient,
    MarkdownRenderer,
    RepoRenderer,
    RepoCarousel,
    RepoSectionController
};
