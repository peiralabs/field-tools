#!/usr/bin/env node
/* Inline the shared Lab Profile layer into every field tool.
 *
 * The tools are deliberately single-file artifacts: they get published to
 * claude.ai and copied into the blog's public/tools/ verbatim, so they cannot
 * reference an external script. This script keeps the source of truth in
 * _shared/ and stamps it into each file between markers. Re-run it after any
 * change to _shared/profile.{css,js}.
 *
 *   node inject-profile.mjs          # write
 *   node inject-profile.mjs --check  # verify only, non-zero if stale
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes('--check');

const read = f => readFileSync(join(here, '_shared', f), 'utf8').replace(/\s+$/, '');

// A tool only receives the blocks whose markers it actually contains, so the
// non-AI tools stay free of the AI shell and vice versa.
// The bring-your-own-model layer rides inside the AI blocks rather than getting
// markers of its own: the four AI tools already carry AI:CSS and AI:JS, and those
// are exactly the files that need it. Order matters inside AI:JS — LLM and LLMUI
// must be defined before ai.js closes over them.
const BLOCKS = [
  { name: 'PROFILE:CSS', body: read('profile.css') },
  { name: 'PROFILE:JS', body: read('profile.js') },
  { name: 'AI:CSS', body: read('ai.css') + '\n' + read('llm.css') },
  { name: 'AI:JS', body: read('llm.js') + '\n\n' + read('llmui.js') + '\n\n' + read('ai.js') },
];

const files = readdirSync(here).filter(f => f.endsWith('.html')).sort();
let changed = 0, stale = [], skipped = [];

for (const f of files) {
  const path = join(here, f);
  const before = readFileSync(path, 'utf8');
  let after = before;
  let sawAny = false;

  for (const { name, body } of BLOCKS) {
    const open = `<!-- ${name} -->`;
    const close = `<!-- /${name} -->`;
    const i = after.indexOf(open);
    const j = after.indexOf(close);
    if (i === -1 && j === -1) continue;
    if (i === -1 || j === -1 || j < i) {
      console.error(`✗ ${f}: unbalanced ${name} markers`);
      process.exit(1);
    }
    sawAny = true;
    after = after.slice(0, i + open.length) + '\n' + body + '\n' + after.slice(j);
  }

  if (!sawAny) { skipped.push(f); continue; }
  if (after !== before) {
    changed++;
    stale.push(f);
    if (!check) writeFileSync(path, after);
  }
}

if (check) {
  if (stale.length) {
    console.error('✗ stale (re-run inject-profile.mjs): ' + stale.join(', '));
    process.exit(1);
  }
  console.log(`✓ all ${files.length - skipped.length} tools carry the current profile layer`);
} else {
  console.log(`✓ injected into ${files.length - skipped.length} tools (${changed} updated)`);
}
if (skipped.length) console.log('  no markers (skipped): ' + skipped.join(', '));
