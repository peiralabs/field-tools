#!/usr/bin/env node
/* Capture one representative screenshot per tool into docs/screenshots/.
 *
 * The README shows every tool, and hand-cropped screenshots rot. This makes
 * them reproducible: each entry declares an optional setup step (so the tool is
 * shown doing something rather than sitting empty) and a pair of selectors
 * marking the region to clip.
 *
 * Requires a static server on the repo root and a local Chrome/Chromium:
 *   python3 -m http.server 8642
 *   node scripts/capture-screenshots.mjs
 *
 * Env: BASE (default http://localhost:8642), CHROME_BIN (default
 * /usr/bin/google-chrome). puppeteer-core must be installed:
 *   npm i --no-save puppeteer-core
 *
 * Everything captured is example data shipped with the tools — documentation
 * range addresses only, nothing from a real network.
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'docs', 'screenshots');
const BASE = process.env.BASE || 'http://localhost:8642';
const CHROME = process.env.CHROME_BIN || '/usr/bin/google-chrome';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click the service tile / grid cell whose visible name matches. */
const clickNamed = (sel, name) => `
  [...document.querySelectorAll(${JSON.stringify(sel)})]
    .find(el => el.textContent.includes(${JSON.stringify(name)}))?.click();
`;

const SHOTS = [
	{
		file: 'ft-01-sizing-calculator.png',
		page: 'sizing-calculator.html',
		range: ['.result', '.result'],
	},
	{
		file: 'ft-02-node-failure-simulator.png',
		page: 'node-failure-simulator.html',
		// kill a node so the verdict and the re-homed guests are visible
		setup: `document.querySelector('.kill[data-n="node3"]').click();`,
		range: ['h2', '#verdict'],
	},
	{
		file: 'ft-03-backup-planner.png',
		page: 'backup-tier-planner.html',
		range: ['table', '.summary'],
	},
	{
		file: 'ft-04-network-diagnostic.png',
		page: 'overlay-network-diagnostic.html',
		range: ['#card', '#card'],
	},
	{
		file: 'ft-05-troubleshooter.png',
		page: 'homelab-troubleshooter-ai.html',
		range: ['#aioff', '.panel'],
		pad: 6,
	},
	{
		file: 'ft-06-log-triage.png',
		page: 'log-triage.html',
		range: ['#aioff', '.panel'],
		pad: 6,
	},
	{
		file: 'ft-07-compose-review.png',
		page: 'compose-review.html',
		setup: `document.getElementById('demo').click();`,
		range: ['.checks', '.panel'],
	},
	{
		file: 'ft-08-explain-command.png',
		page: 'explain-command.html',
		setup: `document.querySelector('.examples span').click();`,
		range: ['.examples', '.panel'],
	},
	{
		file: 'ft-09-power-loss-playbook.png',
		page: 'power-loss-playbook.html',
		range: ['#budget', '.seq'],
	},
	{
		file: 'ft-10-blast-radius.png',
		page: 'blast-radius.html',
		setup: clickNamed('.svc', 'NAS'),
		range: ['h2', '#verdict'],
	},
	{
		file: 'ft-11-bus-factor.png',
		page: 'bus-factor.html',
		setup: `
      const fill = (k, v) => { const t = document.getElementById('f_' + k); t.value = v; t.dispatchEvent(new Event('change')); };
      fill('what', 'It stores every photo we have taken since 2009, runs the TV and film library, and controls the heating.');
      fill('irreplaceable', 'The photos and videos. Scanned passports, the house paperwork, medical letters.');
    `,
		range: ['#score', '.q'],
		pad: 6,
	},
];

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: 'new',
	args: ['--no-sandbox'],
});

let failed = 0;
for (const s of SHOTS) {
	const page = await browser.newPage();
	await page.setViewport({ width: 1000, height: 1500, deviceScaleFactor: 2 });
	try {
		await page.goto(`${BASE}/${s.page}`, { waitUntil: 'networkidle0', timeout: 30000 });
		if (s.setup) await page.evaluate(s.setup);
		await pause(400);

		const box = await page.evaluate((a, b, pad) => {
			const f = document.querySelector(a);
			const l = document.querySelector(b);
			if (!f || !l) return null;
			const fr = f.getBoundingClientRect();
			const lr = l.getBoundingClientRect();
			return {
				x: Math.max(0, Math.min(fr.left, lr.left) + scrollX - pad),
				y: Math.max(0, Math.min(fr.top, lr.top) + scrollY - pad),
				width: Math.max(fr.right, lr.right) - Math.min(fr.left, lr.left) + pad * 2,
				height: Math.max(fr.bottom, lr.bottom) - Math.min(fr.top, lr.top) + pad * 2,
			};
		}, s.range[0], s.range[1], s.pad ?? 20);

		if (!box) throw new Error(`selectors not found: ${s.range.join(' / ')}`);
		await page.screenshot({ path: join(OUT, s.file), clip: box });
		console.log(`  ✓ ${s.file}  ${Math.round(box.width)}×${Math.round(box.height)}`);
	} catch (e) {
		failed++;
		console.error(`  ✗ ${s.file}: ${e.message}`);
	}
	await page.close();
}

await browser.close();
console.log(failed ? `\n${failed} shot(s) failed` : `\nall ${SHOTS.length} shots captured`);
process.exit(failed ? 1 : 0);
