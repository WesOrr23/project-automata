# Iteration 10 — Aliveness + Smooth Tab Transitions

## Why this iteration exists

The app is functionally complete through iter 8 (DFA + NFA editing and simulation) but it still reads as "static" at idle. Transitions between tool-menu tabs happen instantly, buttons don't respond to press with any tactile feedback, and the canvas sits inert whenever no simulation is running. Nothing feels broken — but nothing feels alive either.

This iteration is a cosmetic pass. Not new features, not engine work, not a refactor: a set of small, carefully-chosen motion + transition cues that make the page feel responsive and breathing without ever becoming distracting. Most of the delta is CSS; the component layer gets a few surgical touch-ups where CSS alone can't hit the intent.

The bar: at idle, the user notices *one* gentle motion (the start-arrow breathing) without ever feeling the page is busy.

---

## Goals

1. **Smooth tool-menu tab transitions**: when the active card changes, the old active card collapses and the new one expands in a single coordinated ~300ms motion. The viewport-fit invariant (#1 rule) is preserved — active card still scrolls internally.

2. **Aliveness at idle** — two subtle ambient cues:
   - The start-state arrow breathes (opacity 0.85 ↔ 1.0, ~2s).
   - Accept-state inner rings breathe (scale 0.97 ↔ 1.0, ~3s). Suspended during simulation.

3. **Micro-feedback on interaction** — hovers, presses, and toast entries get eased transitions that were either missing or too blunt:
   - Buttons / pills / badges / state circles / tool-menu items get a 200–250ms ease-out transition on background / border / transform / shadow.
   - Press feedback: buttons scale(0.97) for ~80ms on `:active`.
   - Tool-menu icons hover float: translateY(-1px) + scale(1.05), eased.
   - State circle hover lift in EDIT mode: soft drop-shadow grows on hover, 200ms.
   - Notification toasts slide in with a subtle spring-ish curve.

### Hard constraints

- **No edge motion at idle.** Edge animations are reserved for the simulation's fired-edge pulse.
- **No constant ambient gradients, particles, or parallax.**
- **Never more than 2 elements moving at once at idle.** Start-arrow + accept-ring breathing can coexist because they're on different time bases and barely visible; anything else stays still.
- **Existing animations stay intact.** pulse-canvas-add / pulse-die / pulse-edge-fired / pulse-error / pulse-warning / mini-transition-pulse / state-node-pickable-breath / notification-slide-in all keep their current behavior. Breathing can't fight with them.
- **Engine / tests / types untouched.** This is a UI polish pass. No engine work.

---

## Phases

Each phase ends with: tests pass (`npx tsc --noEmit && npm test -- --run`) + commit. No browser verification this round — the merging session handles that.

### Phase 1 — Tool-menu tab transitions

Animate the compact ↔ active card swap in ToolMenu.

**Mechanics.** Every `.tool-menu-card` already has `transition: all 0.15s ease;` on background/border only — but the properties that actually change when a card swaps between compact and active are:
- `flex` (0 0 auto → 1 1 auto on activation)
- `min-height`
- `padding` (via the inner `.tool-menu-card-content`)
- the presence of the `.tool-menu-card-content` block itself (it renders only inside active cards)

The content node appearing / disappearing is the hard part. CSS can't animate a node mounting. Two options:

**Option A (chosen).** Keep the DOM structure but drive the collapse via max-height + opacity + padding on `.tool-menu-card-content`. Change the render: compact cards always include the `.tool-menu-card-content` element (empty) but with `hidden` styles applied so it takes zero space. The active card reveals it with transitioned max-height + padding + opacity. This means the card's *content element* always exists in the DOM; only its display collapses.

Simpler alternative we're NOT doing: animate by keeping the `<div className="tool-menu-card-content">` in all three cards but populated with content only when active. Rejected because rendering `configContent`/`editContent`/`simulateContent` in compact cards would still invoke those ReactNodes (they're JSX values, not lazy renderers), which could have unwanted side effects.

So the plan is:
- ToolMenu renders compact cards WITHOUT the content div (unchanged).
- For the active card, keep content as-is.
- The card's own size change (flex 0 vs 1) animates via a CSS transition on `flex-grow` / `max-height`. We animate `max-height` primarily — `flex-grow` transitions are flaky.
- Compact cards get `max-height: 44px` (measured header height). Active card gets `max-height: 100%` (or large enough, e.g. `max-height: 100vh`). CSS transitions on max-height are the standard workaround for "animate height change when content varies."
- Duration: 300ms. Timing: `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Also transition `padding` on `.tool-menu-card-content` (0 → var(--space-3)) and `opacity` (0 → 1) for the reveal.

**Viewport-fit invariant.** The active card already has `flex: 1 1 auto; min-height: 0;` and `.tool-menu-card-content` has `overflow-y: auto`. Those don't change. The only risk is that during the transition, the soon-to-be-active card hasn't grown yet while the soon-to-be-inactive card hasn't shrunk — worst case total content overflows briefly. That's acceptable because the outer `.tool-menu-open` has `overflow: hidden`, so overflow is clipped, not spilled.

**Scope boundary.** Only the compact ↔ active transition. Don't touch collapsed ↔ expanded ↔ open transitions — those already work via the existing 0.2s width/max-height transition.

**Touch points:**
- `src/index.css`: add transitions to `.tool-menu-card`, `.tool-menu-card.compact`, `.tool-menu-card.active`, `.tool-menu-card-content`.
- No ToolMenu.tsx changes expected (CSS only if we're lucky).

**Commit message sketch:** `Phase 1 (iter 10): eased tab card transitions in ToolMenu`

### Phase 2 — Idle aliveness: start-arrow + accept-ring breathing

Two infinite, low-amplitude keyframe animations.

**Start-state arrow breathing.** Opacity 0.85 ↔ 1.0 over 2s, ease-in-out, infinite. Applies to the whole `<g>` the arrow is inside. Implementation: add a class to `StartStateArrow`'s `<g>` and a `@keyframes start-arrow-breath` rule in index.css.

**Accept-state inner ring breathing.** Scale 0.97 ↔ 1.0 over 3s, ease-in-out, infinite. Applies only to the inner circle (the one that visually signals "accept"). Implementation: StateNode already renders a second `<circle>` for accept states; give it a class `accept-ring-breath` and transform-origin: center (cx, cy). SVG `transform: scale(...)` around an arbitrary origin is annoying — easier approach: set `transform-origin` to the numeric cx/cy via inline `style`, then animate `transform`.

**Simulation suspension.** When the simulation is active, the accept-ring breathing would compete with the active-state blue + resultStatus coloring. Suspend it. Detection: the StateNode already knows `isActive` and `resultStatus`. When either is truthy anywhere on the canvas — actually, simpler heuristic: suspend when THIS state is active or when ANY result status is set. Cleaner: suspend when `resultStatus !== null` on the canvas as a whole (passed down) OR when the local state is active. A single `isSimulating` flag passed from App.tsx is the easiest approach — it's already derivable from useSimulation.

Actually simplest: suspend when `resultStatus || isActive` on this particular state. A state that isn't participating can keep breathing softly; one that's showing a sim color stops. But then accepted states pulse while others don't — inconsistent. Let's go with: pass a single `isSimulating` flag from App.tsx to AutomatonCanvas to StateNode. When true, no breathing.

Start-arrow breathing does NOT suspend during simulation — it's semantic ("this is the entry point"), not competing with any sim visual, and the start-state arrow is a permanent marker. Keep it breathing throughout.

**Touch points:**
- `src/index.css`: two new `@keyframes` and two class rules.
- `src/components/StartStateArrow.tsx`: add `className="start-arrow-breath"` to the `<g>`.
- `src/components/StateNode.tsx`: add a `className` + inline `style={{ transformOrigin: 'cx cy px' }}` on the inner circle when accept + !simulating. Plus a new prop `isSimulating`.
- `src/components/AutomatonCanvas.tsx`: thread `isSimulating` through to StateNode.
- `src/App.tsx`: pass `isSimulating` to AutomatonCanvas. Derivable from useSimulation (e.g. `simulationStatus !== 'idle'` or the existence of a history).

**Commit message sketch:** `Phase 2 (iter 10): idle breathing — start arrow + accept rings`

### Phase 3 — Micro-interactions: hover / press / toast polish

The existing CSS has `transition: all 0.15s ease` on several elements, but some key ones lack it, and the duration/curve are inconsistent. Bring them all into the new vocabulary.

**Vocabulary.**
- Hover duration: 220ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Press duration: 80ms, `ease-out`.
- Toast entry: replace current `ease-out` with `cubic-bezier(0.34, 1.56, 0.64, 1)` (the subtle spring).

**Changes.**

1. `.btn`, `.btn-primary`, `.btn-warning`, `.btn-danger`:
   - Transition extended: `transition: background 0.22s cubic-bezier(0.2,0.8,0.2,1), border-color 0.22s cubic-bezier(0.2,0.8,0.2,1), transform 80ms ease-out, box-shadow 0.22s cubic-bezier(0.2,0.8,0.2,1);`
   - Add `:active { transform: scale(0.97); }`.

2. `.tool-menu-icon`, `.tool-menu-pill`, `.tool-menu-back`, `.tool-menu-card-header (via compact)`:
   - Same transition vocabulary.
   - Hover floats: add `transform: translateY(-1px) scale(1.05)` for `.tool-menu-icon:hover`. Pills and back get a subtler `translateY(-1px)` (no scale — they're wider and would feel off).

3. `.alphabet-badge-remove`, `.editor-row-action`, `.transition-grid-cell`:
   - Align to the hover vocabulary.

4. `.state-node-selectable` (EDIT-mode hover lift):
   - Existing rule already thickens stroke + adds drop-shadow. Just extend the transition to include `filter` at 200ms.

5. `.notification-toast`:
   - Change `animation: notification-slide-in 0.18s ease-out` to use the spring curve over 0.28s.

**Simulation-controls buttons** (if any) — check during implementation; they share `.btn` so should be covered by item 1.

**Hard rule check.** Press-scale is only on `:active`, not on hover. Hover lifts are no more than 1px. State-circle hover only fires in EDIT mode (the existing class-gating handles that). None of these can fight with simulation visuals because they're interactive-only — while the user is clicking around mid-sim, they're already engaged; a hover feedback isn't distracting, it's expected.

**Touch points:**
- `src/index.css` — whole phase is CSS.

**Commit message sketch:** `Phase 3 (iter 10): hover / press / toast polish`

### Phase 4 — Docs + handoff

- Write `ITERATION10_COMPLETE.md`.
- Update `CLAUDE.md` current-status line.
- Update `NEXT_SESSION_HANDOFF.md` (where things stand).

No code. One commit.

**Commit message sketch:** `Phase 4 (iter 10): ITERATION10_COMPLETE + handoff update`

---

## Decisions

- **Timing vocabulary chosen.** 220ms for hover, 80ms for press, 300ms for tab swap, 2s/3s for breathing, 280ms for toast. These are intentionally a little slower than the existing 150ms across the board — previous durations felt snappy but undifferentiated; the new timings make hovers feel intentional and transitions feel considered.
- **Curves.** `cubic-bezier(0.2, 0.8, 0.2, 1)` (material-style ease-out-quart) for the hover/tab vocabulary; `cubic-bezier(0.34, 1.56, 0.64, 1)` (subtle spring) only for toast entry.
- **No new JS-driven animation framework.** Everything is CSS keyframes / transitions. No `motion`, no `spring`, no refs to animate. React touch only for props that need to gate animations (e.g. `isSimulating`).
- **Single source for "is the sim running."** Derive in App.tsx from useSimulation state; pass as one boolean. Don't let each component try to infer it.

## Out of scope

- Page-load entry animation for the canvas.
- Animation when states are added/removed (structural mount animations).
- Layout re-flow animation when the automaton's topology changes.
- Edge motion at idle (explicit rule).
- Reduced-motion media query handling. Worth adding but outside this iteration's scope — capture as a follow-up.

## Follow-ups

- `@media (prefers-reduced-motion: reduce)` — suspend the breathing animations and shorten hover transitions for users who've opted out. Leave the hover/press colors alone; those aren't motion.
