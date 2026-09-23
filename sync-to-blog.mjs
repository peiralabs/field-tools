#!/usr/bin/env node
/* Copy each field tool into the blog repo's public/tools/<slug>/index.html.
 *
 * Run this after any tool change and commit the result in the blog repo.
 * Blog-only SEO tags and related-reading links are preserved (see below).
 * Run check-tools.mjs first; this script refuses to sync if the gate fails.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BLOG = join(here, '..', 'myofficelab-blog', 'public', 'tools');

// source file -> published slug. Slugs for FT-01..04 are fixed by the URLs
// already live and indexed; never rename those.
const MAP = {
  'sizing-calculator.html':        'sizing-calculator',
  'node-failure-simulator.html':   'node-failure-simulator',
  'backup-tier-planner.html':      'backup-planner',
  'overlay-network-diagnostic.html':'network-diagnostic',
  'homelab-troubleshooter-ai.html':'troubleshooter',
  'log-triage.html':               'log-triage',
  'compose-review.html':           'compose-review',
  'explain-command.html':          'explain-command',
  'power-loss-playbook.html':      'power-loss-playbook',
  'blast-radius.html':             'blast-radius',
  'bus-factor.html':               'bus-factor',
  'power-cost-calculator.html':    'power-cost-calculator',
};

try {
  execFileSync(process.execPath, [join(here, 'check-tools.mjs')], { stdio: 'pipe' });
} catch (e) {
  console.error('✗ check-tools.mjs failed — not syncing.');
  console.error(String(e.stdout || '') + String(e.stderr || ''));
  process.exit(1);
}

if (!existsSync(BLOG)) { console.error('✗ blog public/tools not found at ' + BLOG); process.exit(1); }

// Blog-only content lives in the blog copies between marker comments:
//   <!-- blog:head --> … <!-- /blog:head -->   (SEO/Open Graph tags, after <title>)
//   <!-- blog:foot --> … <!-- /blog:foot -->   (Related-reading links, before </body>)
// Each sync re-inserts those blocks around the fresh source, so SEO and
// internal links added on the blog side survive. Anything else that exists
// only in a blog copy aborts the sync instead of being silently overwritten.
const BLOCK = /<!-- blog:(head|foot) -->\n[\s\S]*?<!-- \/blog:\1 -->\n/g;

function blocksOf(html) {
  const out = {};
  for (const m of html.matchAll(BLOCK)) out[m[1]] = m[0];
  return out;
}

function withBlocks(body, blocks, slug) {
  let html = body;
  if (blocks.head) {
    const at = html.indexOf('</title>\n');
    if (at < 0) throw new Error(`${slug}: source has no </title> to anchor the blog:head block`);
    html = html.slice(0, at + 9) + blocks.head + html.slice(at + 9);
  }
  if (blocks.foot) {
    const at = html.lastIndexOf('</body>');
    if (at < 0) throw new Error(`${slug}: source has no </body> to anchor the blog:foot block`);
    html = html.slice(0, at) + blocks.foot + html.slice(at);
  }
  return html;
}

// Pass 1: plan every write and refuse the whole sync on any unmarked drift.
const plan = [];
const drift = [];
for (const [src, slug] of Object.entries(MAP)) {
  const body = readFileSync(join(here, src), 'utf8');
  const dest = join(BLOG, slug, 'index.html');
  const before = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
  let next = body;
  if (before !== null) {
    const blocks = blocksOf(before);
    const unmarked = before.replace(BLOCK, '');
    // Blog-side markup outside the markers that the source doesn't have either
    // would be lost by overwriting. Known blog-only signatures:
    const sigs = ['og:title', 'rel="canonical"', 'class="related-reading"'];
    for (const sig of sigs) {
      if (unmarked.includes(sig) && !body.includes(sig)) drift.push(`/tools/${slug}/ has unmarked "${sig}"`);
    }
    next = withBlocks(body, blocks, slug);
  }
  plan.push({ slug, dest, before, next });
}
if (drift.length) {
  console.error('✗ blog copies contain blog-only markup outside <!-- blog:head/foot --> markers — not syncing:');
  for (const d of drift) console.error('  ' + d);
  console.error('  Wrap that markup in markers in the blog repo (or move it into the source), then rerun.');
  process.exit(1);
}

// Pass 2: write.
let changed = 0;
for (const { slug, dest, before, next } of plan) {
  mkdirSync(dirname(dest), { recursive: true });
  if (before !== next) { writeFileSync(dest, next); changed++; console.log(`  updated /tools/${slug}/`); }
}
console.log(`✓ synced ${Object.keys(MAP).length} tools to the blog (${changed} changed)`);
