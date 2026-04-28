# Docs

Project documentation, organized by purpose.

## `iterations/`
One canonical file per iteration, all following the structure of `ITERATION1_COMPLETE.md`. Completed iterations are named `*_COMPLETE.md`; the in-flight one is `*_IN_PROGRESS.md`.

Read these to understand **what shipped when, and why**.

## `reference/`
Long-lived reference material that doesn't belong to any one iteration:
- `ARCHITECTURAL_PATTERNS.md` — recurring patterns (functional automata, granular props, etc.)
- `CONFIG_GUIDE.md` — config-pane controls and what they do
- `QUICK_REFERENCE.md` — keyboard shortcuts, common operations
- `ONBOARDING_DESIGN.md` — first-run UX design
- `UI_ARCHITECTURE.md` — deep dive on UI infrastructure for cross-project reuse

## `brainstorms/`
Open-ended design exploration. These are *thinking documents*, not committed plans:
- `ADVANCED_OPS_BRAINSTORM.md` — ideas for operations beyond the standard set
- `CUSTOMER_BRAINSTORM.md` — who uses this and why
- `MENU_ARCHITECTURE_BRAINSTORM.md` — pre-iter-13 menu rethink
- `STUDENT_USABILITY_BRAINSTORM.md` — usability concerns for student users

## `planning/`
Single forward-looking document — what's next, working style, deferred items, friend-test tasks.
- `PLANNING.md` — roadmap, conventions, open backlog, known bugs, user-test tasks
