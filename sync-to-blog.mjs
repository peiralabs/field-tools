#!/usr/bin/env node
/* Copy each field tool into the blog repo's public/tools/<slug>/index.html.
 *
 * The blog repo holds the only VERSIONED copies of these files — this directory
 * is not a git repo — so run this after any tool change and commit there.
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

let changed = 0;
for (const [src, slug] of Object.entries(MAP)) {
  const body = readFileSync(join(here, src), 'utf8');
  const dir = join(BLOG, slug);
  const dest = join(dir, 'index.html');
  mkdirSync(dir, { recursive: true });
  const before = existsSync(dest) ? readFileSync(dest, 'utf8') : null;
  if (before !== body) { writeFileSync(dest, body); changed++; console.log(`  updated /tools/${slug}/`); }
}
console.log(`✓ synced ${Object.keys(MAP).length} tools to the blog (${changed} changed)`);
