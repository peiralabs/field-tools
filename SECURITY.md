# Security Policy

## The short version

These are static HTML files. There is no server, no database, no user account, and no build pipeline. That makes the attack surface small — but "small" is not "none", and this document is honest about where it isn't.

One thing deserves saying up front, because it changed in August 2026: the four model-backed tools can now be pointed at a provider of your choosing, which means **you may type an API key into one of these pages**. That key is held in `sessionStorage` (gone when the tab closes) unless you explicitly tick "remember on this device", is never written into your Lab Profile, and is sent to exactly one place — the provider you selected. It never reaches me, because there is nowhere for it to reach: no server exists. If you find a path by which a key leaks anywhere else, that is the single most serious thing you could report here.

## Reporting a vulnerability

**Please report privately first.** Two ways, either is fine:

- **[Open a private security advisory](https://github.com/peiralabs/field-tools/security/advisories/new)** — preferred, keeps everything in one place.
- **Email `josh@peiralabs.com`** if you'd rather not use GitHub.

Please include what you found, the file involved, and the smallest input that reproduces it. A proof-of-concept HTML snippet is ideal.

I maintain this alongside a full-time job, so: expect an acknowledgement within a few days, not a few hours. I'll tell you honestly if something will take a while or if I've decided not to fix it, and I'm happy to credit you in the fix commit unless you'd rather I didn't.

**Please don't** open a public issue for something exploitable, and please don't test against `peira.dev` itself — everything you need reproduces locally by opening the file.

## Supported versions

Only the current `main`. These are single files with no release train; if something is wrong, the fix lands on `main` and the published artifacts are refreshed.

Note that **a published Claude artifact cannot be edited in place** — refreshing one mints a new URL. So a security fix here means: fix on `main`, republish the artifact, update the links. If you find something serious in a published artifact, say so explicitly in your report so I prioritise the republish.

## Threat model

What these tools actually do, and therefore what could actually go wrong.

### In scope

| Area | The concern |
|---|---|
| **Rendered user input** | Every tool renders text you typed — service names, machine names, data-set names — back into the page. All of it is escaped through a shared `esc()` before it reaches `innerHTML`. A bypass is a real finding. |
| **Lab profile import** | The **JSON** import accepts a pasted profile. It is parsed with `JSON.parse` (never `eval`) and every field is escaped on render, but a crafted profile that achieves script execution or corrupts another tool's state is in scope. |
| **Markdown rendering (AI tools)** | Model output is rendered as HTML by a small purpose-built renderer. It HTML-escapes the whole input *before* any pattern matching, renders no links at all (so there is no `javascript:` vector), and never interpolates into an attribute. A construction that smuggles markup through is in scope — and it matters more now that the model may be an endpoint neither of us controls. |
| **API key handling (BYOK)** | A key you paste lives in `sessionStorage` by default, moves to `localStorage` only if you tick remember, and is cleared by "forget". It is deliberately kept out of the Lab Profile because the profile is designed to be exported as JSON and rendered into a shareable lab record. Any path that puts a key into the profile, into an export, into a URL, or onto any host other than the provider you chose is a serious finding. |
| **Endpoint you configure** | You can point the tools at an arbitrary OpenAI-compatible base URL. Doing so sends your key and your input to that host — that is inherent to the feature, and the panel says so. What *is* in scope: the tool sending them anywhere you did not configure. |
| **Prompt injection (AI tools)** | Pasted content — a log, a compose file, a command — is untrusted input to a model. Content engineered to make the tool emit dangerous advice (for example, rating a destructive command as safe) is a genuine finding and I want to know. |
| **`cors-server.py`** | A development helper that serves this directory with `Access-Control-Allow-Origin: *`. It binds to `127.0.0.1` only. If you find a way it can serve beyond loopback as shipped, that's in scope. |

### Out of scope

- **The tools' advice being wrong.** That is a bug and a valuable one — [open a normal issue](https://github.com/peiralabs/field-tools/issues/new/choose) rather than a security advisory.
- **The AI tools sending your input to the provider you selected.** That is the whole design. On claude.ai they run on *your* Claude account via the in-artifact API; elsewhere they call the provider you configured, directly from your browser. Either way nothing is sent to me.
- **A key you pasted being readable by scripts on the same origin.** Any credential in browser storage is readable by same-origin script — that is how browsers work, not a flaw in these files. It is precisely why the default is session-scoped and why remembering is opt-in. A same-origin *injection* that reads it, on the other hand, is very much in scope (see rendered input and markdown rendering above).
- **The Google Fonts request.** Documented in the README. Delete the `<link>` and self-host if you'd rather not make it.
- **Anything requiring an attacker to already control your browser or machine.**
- Missing security headers on a `file://` page, or clickjacking of a tool with no authenticated state to steal.

## Notes for anyone reviewing the code

- Shared code lives in `_shared/` and is **stamped into** each tool by `inject-profile.mjs`. Review `_shared/`, not the eleven duplicated copies — and if you fix something there, run the injector so all eleven get it.
- `check-tools.mjs` runs in CI and blocks raw control characters, unfilled placeholder URLs, and any address outside the documentation ranges. It is a safety net, not a substitute for reading the diff.
- No tool sets a cookie, registers a service worker, or writes anywhere except `localStorage` on its own origin.
- There are no dependencies. Nothing is installed at runtime, so there is no supply chain to compromise. `puppeteer-core` is used only to regenerate screenshots and never ships in a tool.
