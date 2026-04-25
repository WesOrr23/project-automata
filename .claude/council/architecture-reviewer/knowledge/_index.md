---
agent: architecture-reviewer
type: index
indexed-dir: knowledge
schema-version: 1
last-updated: 2026-04-25
---

# Architecture Knowledge — Index

- [engine-ui-separation](engine-ui-separation.md) — engine has zero React deps; one known crack in creationReducer
- [immutability-discipline](immutability-discipline.md) — engine operations return new automatons; reference equality used as no-op signal
- [state-id-management](state-id-management.md) — numeric auto-incremented IDs in engine, display labels in UI layer
- [type-system-conventions](type-system-conventions.md) — Sets for uniqueness, no classes, dependencies-first ordering
- [granular-prop-convention](granular-prop-convention.md) — UI components take primitives, not engine objects; "Prop" suffix; established iter 2
- [external-dependency-boundary](external-dependency-boundary.md) — typed → opaque → typed funnel; one module owns the dependency; established iter 3 (GraphViz)
- [result-type-error-model](result-type-error-model.md) — engine returns `Result<T>` with typed `EngineError` variants; established iter 11
- [keyboard-scope-stack](keyboard-scope-stack.md) — module-level stack of keyboard scopes; replaces independent listeners with blacklists; established iter 11
