#!/usr/bin/env node
/**
 * CLI: fetch all public repos for OWNER from GitHub REST API and write highlight JSON
 * (same shape as githubProjects.js static fallback). Used by CI before Angular build.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildHighlightList } from './github-highlight-lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUT_FILE = join(ROOT, 'src/assets/data/github-highlight-repos.json');

function resolveToken() {
  return process.env.GH_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
}

function resolveOwner() {
  return process.env.GITHUB_REPOSITORY_OWNER || 'Ameer-Jamal';
}

/**
 * @param {string} owner
 * @param {string} token
 * @returns {Promise<object[]>}
 */
export async function fetchAllUserRepos(owner, token) {
  const all = [];
  let page = 1;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  for (;;) {
    const url = new URL(`https://api.github.com/users/${owner}/repos`);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'updated');
    url.searchParams.set('type', 'all');

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
    }
    /** @type {unknown} */
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) {
      break;
    }
    all.push(...chunk);
    if (chunk.length < 100) {
      break;
    }
    page += 1;
  }

  return all;
}

async function main() {
  const token = resolveToken();
  if (!token) {
    console.warn('No GH_PAT / GITHUB_TOKEN / GH_TOKEN; using unauthenticated GitHub API rate limits.');
  }

  const owner = resolveOwner();
  const raw = await fetchAllUserRepos(owner, token);
  const highlights = buildHighlightList(raw);
  const json = `${JSON.stringify(highlights, null, 2)}\n`;

  writeFileSync(OUT_FILE, json, 'utf8');
  console.log(`Wrote ${highlights.length} repos to ${OUT_FILE}`);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
