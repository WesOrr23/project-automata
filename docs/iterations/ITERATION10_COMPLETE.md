# Iteration 10 — Aliveness + Smooth Tab Transitions (Complete)

## What shipped

The app still does exactly what it did at the end of iter 8 — but it doesn't *feel* the same. Two strands of change:

1. **Tool-menu tab swap is animated.** Clicking a different tab no longer instantly snaps the cards around. The old active card collapses while the new one expands over 300ms, eased on `cubic-bezier(0.2, 0.8, 0.2, 1)`. It reads as one motion, not two.

2. **Idle aliveness.** The start-state arrow breathes in opacity (0.85 ↔ 1.0 over 2s); accept-state inner rings breathe in scale (0.97 ↔ 1.0 over 3s). Together they give the canvas a sense of being awake at idle without ever being busy. Accept-ring breathing suspends during simulation so it can't compete with the active-blue / accept-green / reject-red coloring.

3. **Micro-interaction polish.** Every interactive element now shares a single hover / press vocabulary: 220ms ease-out-quart for chrome, 80ms ease-out transform for press feedback. Buttons squeeze to scale(0.97) on click; tool-menu icons float up and slightly grow on hover; pills translateY without scaling; notification toasts enter with a subtle spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 280ms).

Zero engine changes. Zero test changes. 212 tests pass, typecheck clean.

---

## Phase log

| Phase | Commit | Files | Tests added |
|---|---|---|---|
| Plan | `76a8a1c` | 1 | 0 |
| 1 — eased tab card transitions | `ca5e465` | 1 | 0 |
| 2 — idle breathing (start arrow + accept rings) | `793fae1` | 5 | 0 |
| 3 — hover / press / toast polish | `42da5bd` | 1 | 0 |
| 4 — docs + handoff | (this commit) | 3 | 0 |

Total: **212 tests passing** (unchanged from iter 8 close-out). Typecheck clean throughout.

---

## Design decisions

### Single motion vocabulary

All non-breathing transitions use one curve: `cubic-bezier(0.2, 0.8, 0.2, 1)` (material-style ease-out-quart). Durations are tiered:

- **220ms** for hover chrome (color / border / shadow / float)
- **80ms** for press transform (snappy tactile response)
- **300ms** for tab swap (slow enough to read as one gesture; fast enough to stay out of the way)
- **280ms** for toast entry (with a different curve — the spring)

The spring curve — `cubic-bezier(0.34, 1.56, 0.64, 1)` — is used exclusively for notification entry. It has a tiny overshoot at the end that reads as "arriving" instead of "sliding past."

### Breathing periods are intentionally different

Start arrow: 2s. Accept rings: 3s. Never synchronized. If they breathed in lock step they'd read as one stronger motion; unsynced, each fades into the background independently.

### Active card size animation via `flex-grow`

Animating height on a flex column is the usual dance. We chose `flex-grow` as the load-bearing property (0 for compact, 1 for active), plus a shared `flex-column` base on all cards. With `min-height: 0` baseline it transitions smoothly. The content reveal rides in parallel via `opacity` + `padding` on `.tool-menu-card-content`, using `@starting-style` for the first-mount fade-in (graceful no-op on older browsers).

### `isSimulating` threaded, not inferred

Rather than have each StateNode guess whether a simulation is running (from `isActive || resultStatus`), App.tsx derives a single boolean (`appMode === 'SIMULATING'`) and threads it through AutomatonCanvas → StateNode. One source of truth, one prop. Consistent across the canvas.

### Press feedback is on `:active`, not `:hover`

Hover is visual feedback that you're over a target. Press feedback is visual feedback that the click registered. They're different signals. The 80ms transform is short enough that the click never feels sluggish, but long enough to be perceivable — especially on buttons with longer hover transitions.

---

## What stayed the same / didn't change scope

- Every engine test.
- Every component's behavior.
- Every keyboard shortcut, popover, canvas-edit interaction.
- The existing simulation animations (pulse-edge-fired, pulse-die, pulse-canvas-*) are untouched. Nothing introduced competes with them.
- The `tool-menu-pill`, `tool-menu-icon`, `tool-menu-back`, and `.btn` still transition on the same properties they always did. Only the durations and curves changed.

---

## Out of scope (captured for follow-up)

- **`@media (prefers-reduced-motion: reduce)`** — should suspend the breathing keyframes and shorten hover transitions. Captured in the plan as a follow-up; not blocking.
- **Page-load entry animation for the canvas.** No strong opinion yet; would need a gate on "first render of this layout" to avoid firing on every layout recompute.
- **State mount / unmount animation** when a state is added or removed. Structural mount animations are a bigger scope (positions are GraphViz-computed async; easing between layouts is nontrivial).
- **Edge at-idle motion** — explicit non-goal. Simulation owns that visual channel.

---

## Hard rules satisfied (the bar)

- No edge motion at idle ✓
- No ambient gradients, particles, parallax ✓
- Never more than 2 elements in motion at once at idle — start-arrow + accept-ring breathing, different periods, both subtle ✓
- Existing simulation animations untouched ✓
- At idle, the user notices *one* gentle motion (the start-arrow breathing) without ever feeling the page is busy ✓

---

## How to run

```bash
npm test -- --run            # 212 passing
npx tsc --noEmit             # clean
npm run dev                  # browser at http://localhost:5174
```

Browser verification is deferred to the merging session (parallel agents can't share the dev server).

In the browser, the things to watch for:
1. **Idle canvas** — start arrow should be subtly breathing, accept rings subtly scaling. You shouldn't "notice" them unless you look.
2. **Tool menu tab clicks** — smooth grow/shrink of cards, not a jump.
3. **Hover a button / tool-menu icon / alphabet badge remove** — background + slight lift.
4. **Click a button** — squeeze feedback.
5. **Simulation running** — accept-ring breathing pauses; all pre-existing animations (step pulse, branch death, result coloring) intact.
