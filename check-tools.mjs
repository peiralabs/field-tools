#!/usr/bin/env node
/* Pre-publish gate for the field tools.
 *
 * Checks, in order of how badly each one has bitten us before:
 *   1. every <script> block parses
 *   2. no RAW control characters (a literal one gets stripped by clipboard
 *      pipelines and silently broke a published tool — escapes only)
 *   3. no unfilled ARTIFACT_URL placeholders
 *   4. publication safety: example IPs stay inside the documentation ranges
 *   5. the shared profile/AI layers are freshly injected
 *   6. structural bits every tool must carry
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'ftcheck-'));
const files = readdirSync(here).filter(f => f.endsWith('.html')).sort();
const problems = [];
const warn = [];

// 10.0.x.x and the 100.64.0.0 range base are the only literals the blog's
// security scanner allows; anything else that looks like a host IP is a leak risk.
const IP = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
const ipAllowed = (a, b, c, d) => {
  if (a === 10 && b === 0) return true;                       // 10.0.0.0/16, RFC 1918 private space
  if (a === 100 && b === 64 && c === 0 && d === 0) return true; // literal CGNAT range base
  if (a === 0 || a === 127) return true;                      // 0.0.0.0 / loopback
  if (a === 255 || (a === 192 && b === 0 && c === 2)) return true; // masks, TEST-NET-1
  return false;
};

for (const f of files) {
  const s = readFileSync(join(here, f), 'utf8');
  const tag = f.padEnd(30);

  // 1. syntax
  const blocks = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!blocks.length) problems.push(`${tag} no <script> block`);
  blocks.forEach((b, i) => {
    const p = join(tmp, `${f}.${i}.js`);
    writeFileSync(p, b);
    try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
    catch (e) {
      problems.push(`${tag} script ${i} fails to parse: ${String(e.stderr).split('\n')[0]}`);
    }
  });

  // 2. raw control characters (tab/newline/CR excepted)
  const ctrl = [...s].some(ch => {
    const c = ch.charCodeAt(0);
    return c < 32 && c !== 9 && c !== 10 && c !== 13;
  });
  if (ctrl) problems.push(`${tag} contains a RAW control character — use an \\xNN escape`);

  // 3. placeholder artifact URLs
  if (s.includes('artifacts/PENDING')) problems.push(`${tag} still has an unfilled ARTIFACT_URL`);

  // 4. addresses
  for (const m of s.matchAll(IP)) {
    const [a, b, c, d] = m.slice(1).map(Number);
    if ([a, b, c, d].some(n => n > 255)) continue;            // version strings etc
    if (!ipAllowed(a, b, c, d)) problems.push(`${tag} non-documentation IP: ${m[0]}`);
  }

  // 5 + 6. structure
  if (!s.includes('id="pbar"')) problems.push(`${tag} missing the lab-profile bar`);
  if (!/<!-- PROFILE:JS -->\n[\s\S]*LabProfile/.test(s)) problems.push(`${tag} profile layer not injected`);
  if (!s.includes('peira.dev')) problems.push(`${tag} missing the peira.dev credit`);
  if (!/docmeta">peira\.dev · FT-\d\d/.test(s)) warn.push(`${tag} doc header is not the standard FT-nn form`);
}

// 5b. injection freshness
try {
  execFileSync(process.execPath, [join(here, 'inject-profile.mjs'), '--check'], { stdio: 'pipe' });
} catch (e) {
  problems.push(`shared layer is STALE — run inject-profile.mjs (${String(e.stdout || e.stderr).trim()})`);
}

warn.forEach(w => console.log('⚠ ' + w));
if (problems.length) {
  console.error('\n✗ ' + problems.length + ' problem(s):');
  problems.forEach(p => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ ${files.length} tools pass: syntax, control chars, artifact URLs, addresses, structure`);
