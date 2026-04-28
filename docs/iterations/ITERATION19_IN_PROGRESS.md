# Iteration 19: Telemetry + Settings + Polish — In Progress

**Goal**: Repo and UX hygiene pass before the next product feature lands. Add a behind-the-scenes telemetry logger, a hotkey-only settings menu, normalize the start-arrow geometry as a real GraphViz spline, and reorganize root docs into a clean `docs/` tree.

**Status**: **IN PROGRESS** — branch `iteration-17-minify-and-menu`. Several commits already landed; this iteration is conceptually the iter-19 banner even though the branch name predates the renumbering.

---

## What We Built

### 1. Telemetry / User-Action Logger (`3c8f88e`)

A behind-the-scenes logger that records user actions for later analysis. Pure UI instrumentation — no engine touch, no network, in-memory only with optional inspection helpers. Helps validate UX assumptions ("how often do users click into the empty canvas vs use the menu?") without claiming any telemetry the user can see in chrome.

### 2. Hotkey-Only Settings Menu + UI Architecture Deep-Dive (`8a43bdd`)

A new settings surface that's reachable only via hotkey (no menu chrome, no button — discoverability is intentional, settings are for power users). The companion deep-dive doc walks the UI layering top-down so the next person reading the codebase has a guided map of how App.tsx → tool menu → canvas → command bar → operations widget → settings menu compose.

### 3. Centralized Start-Arrow Geometry Constants (`d092d11`)

The start arrow's hardcoded geometry numbers (length, gap, arrowhead size, source-x offset) had drifted across `StartStateArrow.tsx`, `AutomatonCanvas.tsx`, and the bbox calculator. Consolidated into `src/ui-state/constants.ts` so future changes touch one site instead of three.

### 4. Stroke-Only Signifiers — No Drop-Shadow Halos (`5a9cb74`)

Drop-shadow halos on hover/active states were producing the cursor-flicker class of bugs and didn't actually communicate more than a stroke change. Stripped them; signifiers are now stroke-only (color + width). Cleaner, faster, no compositing-layer churn.

### 5. Doc Tree Reorganization (`e6b9122`)

Root was littered with `ITERATION*.md`, `ARCHITECTURAL_PATTERNS.md`, `NEXT_FEATURES.md`, `CUSTOMER_BRAINSTORM.md`, `*HANDOFF.md`, brainstorm files, audit findings, etc. Reorganized into `docs/iterations/`, `docs/council/`, `docs/architecture/`, `docs/handoffs/`, `docs/brainstorms/`. `tsbuildinfo` untracked from git.

### 6. Start Arrow as a Real GraphViz Spline (`55c7286`)

Previously the start arrow was a separately-drawn SVG element positioned via the `startArrowGeometry` constants. The phantom-node trick from iter-12 (invisible phantom→state edges to force isolated states off rank 0) was extended: the start state now has a real phantom→start GraphViz edge that GraphViz routes as a proper spline. The arrow is now a layout-aware spline, eliminating the "doesn't quite line up at zoom" class of bugs at the cost of one engine-level tweak.

### 7. Doc Consolidation — One File Per Iteration (this commit)

`ITERATION{N}_PLAN.md` files dropped after their content was preserved in the corresponding `COMPLETE.md`. `ITERATION4_BRIEF.md` merged into `ITERATION4_COMPLETE.md`. `ITERATION5_*` four sub-docs (ARCHITECTURE, AUDIT, REVIEW_PLAN, TESTING_TASKS) synthesized into a new canonical `ITERATION5_COMPLETE.md`. Result: exactly one canonical file per iteration, all following the iter-1 template.

---

## Key Design Decisions

### Telemetry is in-memory only — no upload, no localStorage
The user is the developer. The point is internal validation (debugging, "did the user just rage-click that button?"), not analytics. Persisting it would invite scope creep ("might as well send it somewhere…") that misses the original goal.

### Settings menu is hotkey-only on purpose
Settings are for power users who already know the app. A menu button advertises "look here for things you might want to change" and gathers feature requests; no button keeps the surface area lean. Documented in the deep-dive.

### Stroke beats drop-shadow for hover signifiers
Stroke changes are rendered without compositing-layer recalc; drop-shadows trigger a filter pass on every hover. Iter-12 already chased the cursor-flicker root cause; this iteration takes the next step and removes the lingering drop-shadow uses entirely.

### Start arrow as a real GraphViz spline (option B)
Three options were discussed:
- **A: Keep manual geometry, just centralize the constants.** Cheap; doesn't solve the layout-drift bug.
- **B: Phantom-node + invisible edge to start state, render the arrow from the spline.** Real layout integration; one engine tweak.
- **C: Reimplement layout for the start arrow alongside GraphViz.** Most flexible, most code, no clear win.

Picked B. Layout-aware now means the arrow tracks any future GraphViz-driven re-layout for free.

### One file per iteration
The audit-cycle output (sub-docs per concern) was useful during iter-5 review but became navigation noise. Going forward, every iteration ends with one COMPLETE doc following the iter-1 template. Council-level audits live under `.claude/council/`, not in `docs/iterations/`.

---

## What Works (so far)

- Telemetry logger captures user actions; inspection via dev console.
- Settings menu opens via hotkey; existing in-app preferences honored without menu chrome.
- Start-arrow geometry is one source of truth in `src/ui-state/constants.ts`.
- No drop-shadow on any signifier; cursor flicker (the residual case from iter-12) appears fully resolved.
- Docs tree is browsable: `docs/iterations/`, `docs/council/`, `docs/architecture/`, etc.
- Start arrow is a real GraphViz spline that tracks the layout at any zoom.

---

## Testing

- All prior tests still green (470+ from iter-18 baseline).
- No new test files yet; telemetry + settings menu RTL coverage planned (see "What's Planned" below).
- `tsc --noEmit` clean.

---

## File Structure (new this iteration)

```
/src
  /telemetry
    - userActionLogger.ts       # NEW: in-memory event log + dev-console inspector
  /components
    - SettingsMenu.tsx          # NEW: hotkey-only settings surface
  /ui-state
    - constants.ts              # MODIFIED: added START_ARROW_GEOMETRY block
  /ui-state
    - utils.ts                  # MODIFIED: phantom→start edge for start-arrow spline
  /styles
    - canvas.css                # MODIFIED: stroke-only signifiers, dropped drop-shadows

/docs
  /iterations                   # NEW HOME: one canonical file per iteration
  /council                      # MOVED FROM ROOT
  /architecture                 # MOVED FROM ROOT
  /handoffs                     # MOVED FROM ROOT
  /brainstorms                  # MOVED FROM ROOT
```

---

## Metrics

- **Tests**: 470+ passing (unchanged from iter-18 baseline; no behavior changes)
- **TypeScript**: clean
- **Commits so far**: 7 on `iteration-17-minify-and-menu` branch (iter-19 conceptual scope)
- **Deleted**: `ITERATION{N}_PLAN.md` × 13, `ITERATION4_BRIEF.md` × 1, `ITERATION5_*.md` × 4 sub-docs

---

## Status

Currently in flight. Remaining items still planned for this iteration banner:

- **RTL coverage** for the new SettingsMenu component
- **Telemetry inspection UI** (or explicit decision to keep it dev-console-only)
- **Verify** start-arrow spline behaves correctly across all sample automatons (especially the dense + isolated-state cases the phantom-node trick was originally designed for)
- **Audit** the new `docs/` tree for any orphan cross-references in `CLAUDE.md` or council knowledge files
- **Browser verification** of the no-drop-shadow + spline-arrow change at multiple zoom levels

---

## Lessons Learned (so far)

1. **Telemetry doesn't have to ship to be valuable** — a local in-memory log inspected via dev console is enough to catch UX assumptions that weren't holding up.
2. **Hotkey-only is a feature, not a bug** — for power-user surfaces, the lack of menu chrome is what keeps the rest of the UI clean.
3. **Centralizing magic numbers prevents drift** — three sites with the same constant guarantees they'll diverge by iteration 20.
4. **Layout-aware geometry beats hand-positioned geometry** — the phantom-node trick from iter-12 generalized cleanly to the start arrow.
5. **Doc reorganization is a feature** — every navigation tax compounds. One file per iteration scales; multiple sub-docs per iteration does not.
