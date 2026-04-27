---
agent: security-reviewer
type: knowledge
topic: attack-surface
schema-version: 1
verified-as-of: dd6420b
last-updated: 2026-04-27
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
- **localStorage is in use** as of iter-15. Three keys: `automata-debug-overlay` (debug ⌘⇧D flag, value `'on'`/`'off'`), `automata-onboarding-v1` (first-launch tour seen flag, value `'seen'`), `automata-recents-v1` (saved-file recents list, JSON array of `{ id, name, snapshot, openedAt, saved }` capped at MAX_ENTRIES=10 / MAX_TOTAL_BYTES=1_000_000 / MAX_PER_ENTRY_BYTES=250_000). All writers wrap `setItem` in try/catch — quota and private-browsing failures degrade gracefully.
- No IndexedDB, no cookies.
- No network requests other than the initial bundle load.
- One external runtime dependency: GraphViz WASM, loaded as part of the bundle.

### What this means

- **No data exfiltration risk** — nothing leaves the browser. localStorage stays origin-bound.
- **localStorage persists across sessions on the same browser+origin.** On a personal machine that's the intended UX (recents survive). On a *shared* machine (e.g. a school computer lab) the next user sees the previous user's tour-completion flag, debug-overlay flag, and recents — including the free-text `description` field embedded in any saved snapshot. This is a mild privacy consideration, not a security one. If a "private mode" or shared-machine UX is ever introduced, the description-in-recents path is the first thing to revisit.
- **No server to attack** — there's no server.
- **No CSRF, no session fixation, no auth bypass** — none of these are applicable.

The threats that *do* apply, ordered by likelihood:

1. **Paste-bombs** — pasting very large strings into the input field. Mitigated by `maxLength` on relevant inputs and reasonable sizes elsewhere. Browser handles renderer DoS.
2. **Malformed sample JSON** — when sample-automaton loading is touched, malformed JSON could cause runtime errors. Mitigated by parse-then-validate.
3. **String interpolation into SVG attributes** — user labels rendered as SVG text content are escaped by React. Labels rendered into SVG attributes (`title=`, `d=`, etc.) require attention. The codebase mostly uses `<text>{label}</text>` which is safe.
4. **GraphViz WASM crashes** — the WASM module could crash on malformed DOT input. Mitigated by validating the source automaton before generating DOT.

### What is NOT a threat

- XSS via `dangerouslySetInnerHTML` — not used in this codebase. Confirmed via whole-codebase grep at HEAD `dd6420b`. No `eval`, `Function()` constructor, `document.write`, or production-side `innerHTML` either.
- **XSS via image-export round-trip** — verified safe. User-controlled state labels and transition symbols flow into SVG via React text children (`<text>{label}</text>`), never as attribute values. `cloneNode(true)` preserves text-node children verbatim, and `XMLSerializer().serializeToString()` re-encodes them as `&lt;.../&gt;` entities in the output. Empirically tested: a state label of `<script>alert(1)</script>` exports as visible literal text in the saved SVG, no script execution. PNG path is even safer (canvas rasterization disposes of the DOM).
- **Prototype pollution via `parseAutomataFile`** — not exploitable. The parser does direct property reads (`obj.kind`, `obj.formatVersion`, etc.), explicit object construction, and `new Set(...)` reconstruction. No `Object.assign`, no spread of arbitrary keys, no recursive merge. Strict shape-checking rejects anything not matching the `kind: "automata-file"` discriminator before any field extraction. A `__proto__` key in the input JSON sits as a harmless never-read own property.
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
