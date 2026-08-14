# Security Policy

## The short version

These are static HTML files. There is no server, no database, no API key, no user account, and no build pipeline. That makes the attack surface small — but "small" is not "none", and this document is honest about where it isn't.

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
| **Markdown rendering (AI tools)** | Model output is rendered as HTML by a small purpose-built renderer. It HTML-escapes the whole input *before* any pattern matching. A construction that smuggles markup through is in scope. |
| **Prompt injection (AI tools)** | Pasted content — a log, a compose file, a command — is untrusted input to a model. Content engineered to make the tool emit dangerous advice (for example, rating a destructive command as safe) is a genuine finding and I want to know. |
| **`cors-server.py`** | A development helper that serves this directory with `Access-Control-Allow-Origin: *`. It binds to `127.0.0.1` only. If you find a way it can serve beyond loopback as shipped, that's in scope. |

### Out of scope

- **The tools' advice being wrong.** That is a bug and a valuable one — [open a normal issue](https://github.com/peiralabs/field-tools/issues/new/choose) rather than a security advisory.
- **The AI tools sending your input to Anthropic.** That is the documented design: they run on *your* Claude account via the in-artifact API. Nothing is sent to me.
- **The Google Fonts request.** Documented in the README. Delete the `<link>` and self-host if you'd rather not make it.
- **Anything requiring an attacker to already control your browser or machine.**
- Missing security headers on a `file://` page, or clickjacking of a tool with no authenticated state to steal.

## Notes for anyone reviewing the code

- Shared code lives in `_shared/` and is **stamped into** each tool by `inject-profile.mjs`. Review `_shared/`, not the eleven duplicated copies — and if you fix something there, run the injector so all eleven get it.
- `check-tools.mjs` runs in CI and blocks raw control characters, unfilled placeholder URLs, and any address outside the documentation ranges. It is a safety net, not a substitute for reading the diff.
- No tool sets a cookie, registers a service worker, or writes anywhere except `localStorage` on its own origin.
- There are no dependencies. Nothing is installed at runtime, so there is no supply chain to compromise. `puppeteer-core` is used only to regenerate screenshots and never ships in a tool.
