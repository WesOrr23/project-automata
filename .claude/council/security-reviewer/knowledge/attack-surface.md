---
agent: security-reviewer
type: knowledge
topic: attack-surface
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Attack Surface

## Principle

This is a client-side educational tool. The realistic threat model is "the user pastes something weird and the app behaves badly." Not "an attacker compromises the app."

## Current state

### What exists

- A Vite-built static React app served from a single HTML page.
- All logic runs in the browser. No backend, no API endpoints.
- No authentication, no user accounts, no sessions.
- No persisted data: no local storage, no IndexedDB, no cookies.
- No network requests other than the initial bundle load.
- One external runtime dependency: GraphViz WASM, loaded as part of the bundle.

### What this means

- **No data exfiltration risk** — there's nothing to exfiltrate. The app holds the user's in-memory automaton; nothing leaves the browser.
- **No persistent account/state to compromise** — every page load is fresh.
- **No server to attack** — there's no server.
- **No CSRF, no session fixation, no auth bypass** — none of these are applicable.

The threats that *do* apply, ordered by likelihood:

1. **Paste-bombs** — pasting very large strings into the input field. Mitigated by `maxLength` on relevant inputs and reasonable sizes elsewhere. Browser handles renderer DoS.
2. **Malformed sample JSON** — when sample-automaton loading is touched, malformed JSON could cause runtime errors. Mitigated by parse-then-validate.
3. **String interpolation into SVG attributes** — user labels rendered as SVG text content are escaped by React. Labels rendered into SVG attributes (`title=`, `d=`, etc.) require attention. The codebase mostly uses `<text>{label}</text>` which is safe.
4. **GraphViz WASM crashes** — the WASM module could crash on malformed DOT input. Mitigated by validating the source automaton before generating DOT.

### What is NOT a threat

- XSS via `dangerouslySetInnerHTML` — not used in this codebase.
- Prototype pollution — no untrusted JSON merge happens.
- ReDoS — the regexes used (`parseEdgePos`, `parseEdgeLabel`) operate on small bounded GraphViz output, not user input directly.

## What to look for in diffs

- New input surfaces (form fields, paste handlers, drag/drop, file uploads, URL params).
- Any introduction of `dangerouslySetInnerHTML` — this should never appear without a strong justification.
- New use of `eval`, `Function()` constructor, dynamic `import()` of user-controlled paths.
- New external API calls (a future iteration might add export-to-cloud or share-via-URL).
- New use of `localStorage`, `sessionStorage`, `IndexedDB`, or `Cookie`.
- User-controlled strings interpolated into SVG attributes or CSS values.
- New external dependencies — flag for triage.

## What's fine

- React's normal text-content rendering of user-provided strings.
- Reading sample JSON via `import` from a static asset.
- Browser-native input controls with `maxLength` and reasonable validators.

## Provenance

Verified by reading `package.json`, `vite.config.ts`, source tree at commit `52bdb8e`. No backend, no auth, no persisted data confirmed.
