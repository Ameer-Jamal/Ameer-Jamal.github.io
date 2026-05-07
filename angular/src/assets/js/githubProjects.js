(function (global) {
    'use strict';

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
                homepage: pinnedRepo.homepage || null
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
                homepage: githubRepo.homepage || null,
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
            const limitOption = options.repoLimit;
            this.repoLimit = Number.isInteger(limitOption) && limitOption > 0 ? limitOption : null;
        }

        async fetchRepositories() {
            let repositories = [];
            try {
                const pinnedRepos = await this.fetchPinnedRepositories();
                if (Array.isArray(pinnedRepos) && pinnedRepos.length > 0) {
                    logger.info('[GitHubProjects] Rendering pinned repositories.', {
                        username: this.username,
                        total: pinnedRepos.length
                    });
                    repositories = pinnedRepos;
                }
            } catch (error) {
                logger.warn('[GitHubProjects] Failed to load pinned repositories, falling back to GitHub API.', error);
            }

            if (!repositories.length) {
                try {
                    repositories = await this.fetchFromGitHubApi();
                } catch (apiError) {
                    logger.warn('[GitHubProjects] GitHub API request failed; will try static fallback.', apiError);
                }
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
            const enriched = await this.enrichRepositories(limited);
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
                        homepage: item.homepage || null,
                        updatedAt: item.updatedAt || null
                    }));
                } catch (error) {
                    logger.warn('[GitHubProjects] Unable to load static fallback repositories.', error);
                }
            }

            return [];
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
            const excludedNames = new Set(['ameer-jamal', 'ameer-jamal.github.io']);
            return repositories.filter((repo) => {
                if (!repo || !repo.name) {
                    return false;
                }
                const normalized = String(repo.name).trim().toLowerCase();
                return !excludedNames.has(normalized);
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
                    logger.warn('[GitHubProjects] Unable to load README for repository.', {
                        repo: repo.name,
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
         * Falls back to REST /readme for uncommon filenames (e.g. README.rst).
         */
        async fetchReadme(repo) {
            if (!repo || !repo.name) {
                return null;
            }

            const fromRaw = await this.fetchReadmeFromRaw(repo);
            if (fromRaw && fromRaw.text) {
                return fromRaw;
            }

            return this.fetchReadmeFromApi(repo);
        }

        async fetchReadmeFromRaw(repo) {
            const repoName = repo.name;
            const owner = this.username;
            const encodedRepo = encodeURIComponent(repoName);
            const branches = [];
            if (repo.defaultBranch) {
                branches.push(repo.defaultBranch);
            }
            branches.push('main', 'master');
            const seenBranch = new Set();
            const orderedBranches = branches.filter((branch) => {
                if (!branch || seenBranch.has(branch)) {
                    return false;
                }
                seenBranch.add(branch);
                return true;
            });

            const files = ['README.md', 'Readme.md', 'readme.md'];

            for (let bi = 0; bi < orderedBranches.length; bi += 1) {
                const branch = orderedBranches[bi];
                const encodedBranch = encodeURIComponent(branch).replace(/%2F/g, '/');
                for (let fi = 0; fi < files.length; fi += 1) {
                    const file = files[fi];
                    const url = `https://raw.githubusercontent.com/${owner}/${encodedRepo}/${encodedBranch}/${file}`;
                    try {
                        const response = await this.fetcher(url);
                        if (!response || !response.ok) {
                            continue;
                        }
                        const text = typeof response.text === 'function'
                            ? await response.text()
                            : '';
                        const trimmed = typeof text === 'string' ? text.trim() : '';
                        if (!trimmed) {
                            continue;
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
                    } catch (error) {
                        logger.warn('[GitHubProjects] Raw README fetch failed.', {
                            repository: repoName,
                            url
                        }, error);
                    }
                }
            }

            return null;
        }

        async fetchReadmeFromApi(repo) {
            const repoName = repo.name;
            const encodedName = encodeURIComponent(repoName);
            const url = `https://api.github.com/repos/${this.username}/${encodedName}/readme`;

            logger.info('[GitHubProjects] Requesting repository README via API.', {
                username: this.username,
                repository: repoName,
                url
            });

            let response;
            try {
                response = await this.fetcher(url, {
                    headers: {
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
            } catch (error) {
                logger.error('[GitHubProjects] Network error while fetching README.', {
                    repository: repoName
                }, error);
                return null;
            }

            if (response.status === 404) {
                logger.info('[GitHubProjects] README not found via API.', {
                    repository: repoName
                });
                return null;
            }

            if (!response.ok) {
                const status = typeof response.status === 'number' ? response.status : 'unknown';
                logger.warn('[GitHubProjects] README API request failed.', {
                    repository: repoName,
                    status
                });
                return null;
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                logger.warn('[GitHubProjects] Failed to parse README API JSON.', {
                    repository: repoName
                }, parseError);
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
        constructor(container, { doc = document, username = null } = {}) {
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
            const carousel = new RepoCarousel(this.doc, repositories, {
                markdownRenderer,
                username: this.username
            });
            this.container.appendChild(carousel.getElement());
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

            this.root = this.doc.createElement('div');
            this.root.className = 'github-projects__carousel';

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

            const title = this.doc.createElement('h4');
            title.className = 'github-projects__card-title';
            title.textContent = repo.name;

            if (repo.description && repo.description.trim().length > 0) {
                const descriptionSection = this.doc.createElement('div');
                descriptionSection.className = 'github-projects__section';

                const descriptionHeading = this.doc.createElement('h5');
                descriptionHeading.className = 'github-projects__section-heading';
                descriptionHeading.textContent = 'Description';

                const description = this.doc.createElement('p');
                description.className = 'github-projects__card-description';
                description.textContent = repo.description;

                descriptionSection.appendChild(descriptionHeading);
                descriptionSection.appendChild(description);
                card.appendChild(descriptionSection);
            }

            const meta = this.doc.createElement('div');
            meta.className = 'github-projects__card-meta';
            const stats = this.doc.createElement('ul');
            stats.className = 'github-projects__stats';
            stats.appendChild(this.createStatItem('Language', repo.language || 'Not specified'));
            if ((repo.stars || 0) > 0) {
                stats.appendChild(this.createStatItem('Stars', formatNumber(repo.stars)));
            }
            if ((repo.forks || 0) > 0) {
                stats.appendChild(this.createStatItem('Forks', formatNumber(repo.forks)));
            }
            if ((repo.openIssues || 0) > 0) {
                stats.appendChild(this.createStatItem('Open Issues', formatNumber(repo.openIssues)));
            }
            if ((repo.watchers || 0) > 0) {
                stats.appendChild(this.createStatItem('Watchers', formatNumber(repo.watchers)));
            }
            stats.appendChild(this.createStatItem('Updated', repo.updatedAt ? new Date(repo.updatedAt).toLocaleDateString() : 'Recently updated'));
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

            if (repo.homepage) {
                const demoLink = this.doc.createElement('a');
                demoLink.className = 'github-projects__card-link';
                demoLink.href = repo.homepage;
                demoLink.target = '_blank';
                demoLink.rel = 'noopener';
                demoLink.textContent = 'View Live Site';
                actions.appendChild(demoLink);
            }


            card.appendChild(title);
            card.appendChild(meta);
            card.appendChild(readme);
            card.appendChild(actions);

            return card;
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

        renderReadme(repo) {
            if (!repo || !repo.readmeRaw) {
                return null;
            }
            return this.markdownRenderer.render(repo.readmeRaw, {
                maxLength: 1400,
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
        constructor({ containerId, username, renderer, apiClient }) {
            this.containerId = containerId;
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

    function scheduleInitializeProjectsSection() {
        const run = () => initializeProjectsSection();
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
        } else {
            setTimeout(run, 0);
        }
    }

    if (typeof document !== 'undefined') {
        scheduleInitializeProjectsSection();
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

    const exported = {
        RepositoryNormalizer,
        GitHubApiClient,
        MarkdownRenderer,
        RepoRenderer,
        RepoCarousel,
        RepoSectionController
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exported;
    } else {
        global.GitHubProjects = exported;
    }
})(typeof window !== 'undefined' ? window : globalThis);
