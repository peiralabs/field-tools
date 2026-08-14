# Contributing

Thanks for looking. This is a small project with an opinionated shape, so this document is mostly about *why* things are the way they are — if the reasoning doesn't hold for your change, say so in the issue and we'll work it out.

## The most valuable contribution

**Tell me when a tool is wrong.**

These tools state facts to strangers with no byline and no date attached. If the sizing calculator's RAM assumptions are off, or the compose reviewer repeats a Docker behaviour that changed three releases ago, that's worse than a crash — a crash is obvious, and a confident wrong answer isn't.

This has already happened once. The command explainer claimed `docker system prune -a --volumes` deletes named volumes. It doesn't, and hasn't since Docker 23.0 — [the flag removes only anonymous volumes](https://docs.docker.com/reference/cli/docker/volume/prune/). It was caught by sourcing the claim while writing a blog post, not by testing.

So: **wrong-claim reports are welcome and get priority.** Please include a link to the authoritative source (vendor docs, a man page, a standard) rather than a forum thread, because that's the bar the fix has to meet anyway.

## Ways to contribute

- **A wrong technical claim** → [issue](https://github.com/peiralabs/field-tools/issues/new/choose), with a source.
- **A bug** → issue, with the smallest input that reproduces it.
- **A new tool** → open an issue *first* and describe the question it answers. Not because I'm precious about it, but because the bar is "a question the internet can't already answer well", and that's worth agreeing before you spend an evening on it.
- **A fix or improvement** → pull request, straight in.

## The rules that aren't negotiable

These come from the constraint that every tool is also published as a Claude artifact.

**1. One file. No build step. No dependencies.**
A published artifact can't reference an external script, load a package, or run a bundler. Everything a tool needs is in its own `.html` — markup, styles, logic. If a change needs a build step, it can't ship.

**2. Never edit the injected blocks.**
Shared code lives in `_shared/` and is stamped into each tool between markers:

```html
<!-- PROFILE:JS -->
   ...generated, do not edit here...
<!-- /PROFILE:JS -->
```

Edit `_shared/`, then run the injector. Editing a copy inside a tool works exactly until someone runs the injector and silently overwrites you.

**3. Documentation-range example data only.**
Addresses come from `10.0.0.0/16` — that is, `10.0.x.x` — or the literal `100.64.0.0` range base. Hostnames are placeholders. Nothing from a real network, ever — these files are public and screenshots of them go in a public README. The gate enforces this.

**4. Escape sequences, never raw control characters.**
Write `\x01`, not a literal control byte. A raw one survived every local test and was then silently stripped by a clipboard, turning a regex into a syntax error and breaking a published tool. The gate blocks these now.

**5. Escape anything a user typed before it reaches `innerHTML`.**
Use the shared `LabProfile.esc()`. Service names, machine names and data-set names are all user input.

## Local workflow

No install needed to *use* a tool — just open the file. To change one:

```bash
git clone https://github.com/peiralabs/field-tools.git
cd field-tools

# edit _shared/… or a tool's own markup/logic, then:
node inject-profile.mjs      # restamp the shared layer into all 11 tools
node check-tools.mjs         # the gate — run this before every commit
```

To open a tool, just open the HTML file — no server required. A server is only needed for the screenshot script, which uses a headless browser:

```bash
python3 -m http.server 8642
npm i --no-save puppeteer-core
node scripts/capture-screenshots.mjs
```

CI runs `inject-profile.mjs --check` and `check-tools.mjs` on every push and pull request. If the gate is red, the PR doesn't merge — it catches stale injections and publication-safety slips, both of which are easy to do by accident.

## Design system

Tools share a printed-field-manual look. If you're adding one, copy an existing tool's `<style>` block as your starting point and change only the accent ink.

- **Paper** `#eeede6` with a faint drafting-blue grid · **cards** `#faf9f4` · **ink** `#1f211b`
- **Hairlines, not shadows.** Near-square corners. No glow.
- **One desaturated accent ink per tool** — the eleven already in use are orange, drafting blue, ochre, teal, oxblood, plum, forest, indigo, steel, mulberry, sepia.
- **Diagonal hatching** for warning and dead states, not solid fills.
- **Motion only on state change.** Nothing ambient, nothing decorative.
- Type is Chakra Petch (display) with IBM Plex Sans/Mono, with system fallbacks if the webfont is blocked.

Accessibility isn't optional here: anything clickable must be reachable by keyboard. If you make a `<div>` or `<span>` interactive it needs `tabindex="0"`, an appropriate `role`, and an Enter/Space handler — or better, use a real `<button>`.

## Pull requests

Small and focused beats large and comprehensive. In the description, please say what you changed and **why**, and confirm you ran the gate.

If your change touches a tool's behaviour, a before/after screenshot helps a lot — `scripts/capture-screenshots.mjs` regenerates them reproducibly.

By contributing you agree your work is licensed under the [MIT licence](LICENSE), same as the rest.

## Code of conduct

Be decent. The full text is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
