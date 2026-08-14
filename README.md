# Claude Artifacts — peira.dev field tools

Eleven self-contained HTML field tools. Each one is a single file with no build
step and no external JS: they are copied verbatim into the blog's
`public/tools/<slug>/index.html` and published to claude.ai as artifacts.

**This directory is not a git repo.** The blog repo holds the only versioned
copies — run `sync-to-blog.mjs` and commit there after any change.

## Design system

Shared "printed field manual" look, deliberately avoiding documented AI-design
tells (dark-mode+glow, accent side-rails, cream+terracotta, tracked label above
heading): putty paper `#eeede6` with a faint drafting-blue graph grid, warm ink
text, hairline rules only (no soft shadows), square-ish corners, document header
with title + doc number + ink-chip swatch over a print double rule, dark
"terminal block" code samples, diagonal hatching for warn/dead states. Type:
Chakra Petch display + IBM Plex Sans/Mono via Google Fonts (system fallbacks if
the sandbox CSP blocks them — after publishing, verify the heading isn't plain).
One desaturated utilitarian ink per tool.

| # | File | Slug | Ink | What it does |
|---|---|---|---|---|
| FT-01 | `sizing-calculator.html` | sizing-calculator | safety orange | Pick services → node/RAM/storage recommendation |
| FT-02 | `node-failure-simulator.html` | node-failure-simulator | drafting blue | Kill a node, see what fits on the survivors |
| FT-03 | `backup-tier-planner.html` | backup-planner | ochre | Per-dataset 3-2-1 compliance with gap callouts |
| FT-04 | `overlay-network-diagnostic.html` | network-diagnostic | teal | Three-layer decision tree: route → ACL → host firewall |
| FT-05 | `homelab-troubleshooter-ai.html` | troubleshooter | oxblood | **AI** — describe a fault, get ranked causes |
| FT-06 | `log-triage.html` | log-triage | plum | **AI** — paste a log, get the line that matters |
| FT-07 | `compose-review.html` | compose-review | forest | **AI** — operational review of a compose file |
| FT-08 | `explain-command.html` | explain-command | indigo | **AI** — risk-rate a command, say if it can be undone |
| FT-09 | `power-loss-playbook.html` | power-loss-playbook | steel | Shutdown/boot order + battery timing budget + rack card |
| FT-10 | `blast-radius.html` | blast-radius | mulberry | Dependency cascade and SPOF ranking |
| FT-11 | `bus-factor.html` | bus-factor | sepia | Handover letter for whoever inherits the lab |

## Shared layers (`_shared/`)

`profile.js` / `profile.css` — the **lab profile**: one record per browser origin
that every tool reads and writes, so a lab described once flows into all of them.
Falls back to in-memory when `localStorage` is unavailable. Also generates the
Markdown "lab doc" and the `LabProfile.ctx()` summary the AI tools prepend to
their prompts.

`ai.js` / `ai.css` — the shell for the model-backed tools: a small markdown
renderer, the conversation runner, and `AI.guard()`, which renders the "runs on
claude.ai" notice when `window.claude.complete` is absent. That is what lets the
AI tools be self-hosted here *and* function as artifacts.

These are stamped into each single file by **`inject-profile.mjs`** between
`<!-- PROFILE:CSS -->` / `<!-- AI:JS -->` style markers. Edit `_shared/`, never
the copies inside a tool.

## Workflow

```
node inject-profile.mjs     # after any _shared/ change
node check-tools.mjs        # gate: syntax, control chars, artifact URLs, IPs
node sync-to-blog.mjs       # copy into the blog repo, then commit there
```

`check-tools.mjs` enforces the things that have actually bitten: JS that parses,
**no raw control characters** (a literal one gets stripped by clipboard pipelines
and silently killed a published tool — use `\xNN` escapes), no unfilled
`ARTIFACT_URL` placeholders, and example addresses confined to the documentation
ranges the blog scanner allows (`10.0.0.0/16`, literal `100.64.0.0`).

## Published artifacts

All eleven verified against the local file by line count, byte count and MD5
before publishing, and all returning 200. Mirrored in
`src/pages/tools/index.astro` — **update both together**.

| Tool | Public artifact URL |
|---|---|
| FT-01 Sizing Calculator | https://claude.ai/public/artifacts/2819e14f-a8c4-45b7-84fd-2ebfa508eb4c |
| FT-02 Node Failure Simulator | https://claude.ai/public/artifacts/617816e4-dbe1-499a-99a6-85cc7df269a9 |
| FT-03 3-2-1 Backup Planner | https://claude.ai/public/artifacts/82a29c54-a7e8-4c3d-9b29-ec986cb46905 |
| FT-04 Overlay Network Diagnostic | https://claude.ai/public/artifacts/e73f2b04-e238-4e82-8f52-7b9fa35842ed |
| FT-05 Homelab Troubleshooter | https://claude.ai/public/artifacts/aa503b55-3fc7-4da2-997b-10922d912c5a |
| FT-06 Log Triage | https://claude.ai/public/artifacts/9dedd019-780b-4879-a70e-80ed5eac81da |
| FT-07 Compose Review | https://claude.ai/public/artifacts/d5f1c723-f9eb-49d0-91bc-0b03e4a94226 |
| FT-08 Explain Before You Run | https://claude.ai/public/artifacts/2d8c8530-a672-4c28-bf38-5b945bce143b |
| FT-09 Power-Loss Playbook | https://claude.ai/public/artifacts/5454d01d-aa01-4a38-8839-b45059a7375e |
| FT-10 Blast Radius Mapper | https://claude.ai/public/artifacts/5ab90394-1abf-4a1b-a7fd-f0c5d17f8920 |
| FT-11 Bus Factor | https://claude.ai/public/artifacts/9104b77b-75fa-4f26-8fa6-d30a26ba3c1e |

**A published artifact cannot be updated in place** — unpublishing is permanent
and a new artifact must be created, which mints a new URL. Any change to a tool
therefore costs a republish *and* an edit to the table above and to
`index.astro`. peira.dev always serves the current build; only the remix copies
can lag.

**Known, accepted divergence:** the `ARTIFACT_URL` baked into a published AI
artifact points at its predecessor, because the URL does not exist until the
moment of publishing. It is inert there — the notice carrying that link renders
only when `window.claude.complete` is absent, i.e. never inside claude.ai. The
self-hosted copies, which are the ones that actually display it, carry the
current URL.

## Publishing (manual, per artifact)

1. `xclip -selection clipboard < <file>.html`, then claude.ai → new chat.
2. Click the composer, wait for hydration, `Ctrl+V`. The paste becomes a
   **PASTED** chip. It renders slowly — if a second paste lands as inline text
   as well, click into the text, `Ctrl+A`, `Delete`: that clears the text and
   leaves the chip.
3. Prompt: *"Create an HTML artifact with the exact contents of the attached
   file. Do not modify, reformat, shorten, or improve the code in any way -
   reproduce it verbatim, byte for byte. Report the line count and MD5 when
   done."* Then **click the send arrow** — Return only inserts a newline.
4. Check the reported line count/MD5 against `wc -l` and `md5sum` locally.
5. Artifact panel → **More options → Publish artifact → Publish & copy link**.
6. "Copy link" does **not** reach the X11 clipboard. Pull the URL out of the DOM
   instead: match `https://claude.ai/public/artifacts/[0-9a-f-]{36}`.
7. `curl -o /dev/null -w '%{http_code}'` the URL, then paste it into the tool's
   `ARTIFACT_URL`, re-run `check-tools.mjs`, and sync.

For the AI tools: the model call only works inside claude.ai. After publishing,
run one real query end-to-end to confirm.

## Rules that apply here (public content)

- Same laws as the blog: dummy IPs only, hostname placeholders, nothing derived
  from real lab topology, no screenshots of the real lab.
- Published artifacts are remixable by design — that's the point.
