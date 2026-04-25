---
agent: typescript-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: c6da931..30eace9
duration-ms: 161114
schema-version: 1
---

# Historical review: iter 7 → iter 8 (NFA support)

## Diff received

Range covers iter-7 close-out (preview UX) through iter-8 NFA support (Phases 1–6). Architect's review flagged that `AutomatonLike<T>` was born in this range and revised their position toward "borderline acceptable, not premature abstraction." Cross-checking from the TS domain.

## My assessment

I disagree with the architect's revision. Reinforcing the prior `generic-constraints.md` position with new evidence rather than revising it.

## Findings

- `AutomatonLike<T extends TransitionLike>` was introduced in commit `1493832` (iter-7 follow-up, NOT the NFA phases). At birth it contained one `as unknown as T` cast inside `computePreview` for the synthesized new-transition literal. Architect's "born clean" framing is factually incorrect — the cast was in the introducing commit.
- The introducing commit also added `App.tsx`'s `preview.transitions as Automaton['transitions']` cast to round-trip the generic result back to the concrete engine type. So at birth the abstraction caused **2** casts net (one inside, one at the caller), not zero.
- Single concrete caller in iter 7, single concrete caller still at `30eace9`. No union, no second instantiation, no plan for one. The architect's "would lose info under a union" defense has no referent.
- `SimulationStep.currentState → currentStates: Set<number>` migration (commit `db672a1`) introduced zero casts. Every callsite — engine, `useSimulation`, `App`, `AutomatonCanvas`, demo trace — operates on the Set directly. Exemplary type migration.
- `addTransitionDestination` / `removeTransitionDestination` signatures (commit `8eecacb`) are clean: monomorphic `Automaton → number → number → string | null → Automaton`. DFA-mode rejection is a runtime throw rather than a type-level split, which is the right call given the cost of splitting `Automaton` into a `DFA | NFA` discriminated union.

## Position

I do not revise `generic-constraints.md`'s verdict. I reinforce it with two new datums: (1) the cast was present in the introducing commit, and (2) the caller pays a second cast that the generic does not eliminate. The "no engine import in UI" motivation is invalid — `creationReducer.ts` is UI code, and UI is permitted to import engine.

## What I deliberately did not check

- Whether the architectural reasoning behind the `AutomatonLike` placement has merit beyond the type-level concern (architect's domain).
- Test coverage for the migrated callsites (qa-reviewer).
- Runtime correctness of DFA-mode throws in NFA-only primitives (qa-reviewer).

## Memory updates produced

- This journal entry.
- `generic-constraints.md` updated: added provenance of cast-at-birth, the caller's second cast, and a re-verified-as-of bump. Position reinforced.
- `cast-discipline.md` "Smells already catalogued" augmented with the App.tsx caller cast.

## Recommendation to architect

Read commit `1493832` directly. The "born clean" claim does not survive the diff. The right correction to the architect's revision is to withdraw it and align with cast-discipline + generic-constraints as written.

## Outcome

Historical pass complete. Architect's revision evaluated and not adopted. Cross-agent disagreement preserved for the auditor.
