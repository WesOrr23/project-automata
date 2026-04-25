---
agent: security-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: synthetic-sec-001
duration-ms: 53127
schema-version: 1
---

# Synthetic verification: ImportPanel rejected

## Diff received

A proposed `ImportPanel` component introducing three new attack surfaces: paste-JSON import, fetch-from-URL import, and a `dangerouslySetInnerHTML` preview. Also missing length cap on the textarea, and no parse-then-validate on either import path.

## My assessment

REJECTED.

## What I checked

- `dangerouslySetInnerHTML` usage: textbook XSS sink — raw user input interpolated into HTML. Pasting `<img src=x onerror=alert(1)>` would execute. The plain `<small>{text.slice(0, 100)}</small>` would render identically and is auto-escaped by React. No justification for the dangerous variant exists in the diff.
- `JSON.parse` then `as Automaton`: violates parse-then-validate principle. Malformed shape would propagate into engine state and crash downstream code. Need a runtime validator (Sets from arrays, integer ID checks, transitions reference existing states, `nextStateId` consistent) at the boundary, plus try/catch on parse failure.
- Arbitrary URL fetch: invalidates the codebase's documented "no network requests other than initial bundle" and "no exfiltration risk" invariants in `attack-surface.md`. No URL scheme validation, no size cap, no error handling.
- No length cap on textarea: contradicts `maxLength` discipline established for other input boundaries (`InputPanel`, `AlphabetEditor`).

## What I deliberately did not check

- Type-system soundness of the `as Automaton` cast (typescript-reviewer's domain — they would also flag this).
- Test coverage for the import flow (qa-reviewer).
- UI/architecture fit: is `components/ImportPanel.tsx` the right placement? (architecture-reviewer)

## Memory updates produced

- This journal entry.
- No edits to `attack-surface.md` or `input-boundaries.md` — the diff is rejected and synthetic, so no codebase change has occurred. If a real import feature is approved, both knowledge files require substantial updates: dropping the "no network requests" claim, dropping the "no exfiltration risk" claim, and adding new input boundaries with their validation requirements.

## Outcome

Rejected. Hard rejection on `dangerouslySetInnerHTML`; combined with the URL-fetch and missing validation, the diff would invalidate four documented security invariants. If the user-facing intent (sharing automatons) is real, the right path is a constrained text-paste import with strict shape validation; URL fetch and HTML rendering of user input are not necessary for that goal.
