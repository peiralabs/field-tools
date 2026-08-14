<!--
Thanks for this. Small and focused beats large and comprehensive — a PR that does
one thing gets reviewed and merged much faster than one that does five.
-->

## What does this change, and why?

<!-- The "why" matters more than the "what" — the diff already shows the what. -->

## Checklist

- [ ] I ran `node inject-profile.mjs` if I touched anything in `_shared/`
- [ ] `node check-tools.mjs` passes
- [ ] Any example data I added uses non-routable example addresses (`10.0.x.x`, i.e. `10.0.0.0/16`) and placeholder hostnames — nothing from a real network
- [ ] I didn't edit inside a generated block (between `<!-- PROFILE:JS -->` style markers)
- [ ] Anything newly clickable is reachable by keyboard (a real `<button>`, or `tabindex` + `role` + an Enter/Space handler)

## If this changes a technical claim

- [ ] I've linked an authoritative source (vendor docs, man page, standard) in the description

<!--
Wrong claims are the highest-value fixes in this repo, because these tools state facts
to people with no byline to check. A primary source makes the fix reviewable.
-->

## If this changes what a tool looks like

<!--
A before/after screenshot helps a lot. `node scripts/capture-screenshots.mjs`
regenerates them reproducibly — see CONTRIBUTING.md.
-->
