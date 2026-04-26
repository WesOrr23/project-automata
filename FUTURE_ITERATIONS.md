# Future Iterations Backlog

> One-page sketches for iter-17 through iter-21+. Each gets a full `ITERATION{N}_PLAN.md` when it becomes the next iteration. This file is the backlog, not the plan.
>
> Ordering is informed by `CUSTOMER_BRAINSTORM.md` — read that first for persona-driven rationale.

## Iter-17 — DFA Minimization + Equivalence Testing

**Why now:** Pairs naturally with iter-16's NFA→DFA. The expected user flow is "convert, then minimize, then check it's equivalent to my reference." Both algorithms reuse the engine primitives iter-16 introduces (reachability, transition sets).

**Scope:**
- **Hopcroft's algorithm** for DFA minimization. O(n log n). Recommended over Moore's because it's more space-efficient on alphabets > 2 and is the textbook standard.
- **Product construction** for equivalence testing. Build the product DFA of A and B; A ≡ B iff (a) accept states of the product are exactly the diagonal where both A and B accept or both reject, OR (b) more practically, compute symmetric-difference DFA and check emptiness.
- **UI:** add "Minimize" and "Check equivalent to..." buttons to the Edit/Test tab area. Equivalence button needs a second-automaton picker (probably "load from file or pick from recents").

**Risks:** Minimization is well-defined only for complete DFAs. Need to handle partial DFAs (treat missing transitions as → trap state, then minimize, then strip trap if unused).

**Test strategy:** Textbook fixtures — the example DFA from Sipser §1.2 has a known minimum. Multiple equivalent NFAs (compute → minimize → assert structural equality up to relabeling).

---

## Iter-18 — Regex → NFA (Thompson's Construction)

**Why now:** The other half of the conversion pipeline. With iter-16 (NFA→DFA), iter-17 (minimize), and this, the user can take a regex all the way to its minimal DFA — which is the headline use case for Devesh's interview-prep persona.

**Scope:**
- **Regex parser.** Subset of POSIX-extended: union (`|`), concatenation, Kleene star (`*`), plus (`+`), question (`?`), grouping (`()`), character classes (`[abc]`, `[a-z]`), escapes (`\.`). Explicitly NOT: backreferences, lookahead/behind, anchors, named groups (those make the language non-regular or add complexity beyond scope).
- **Thompson's construction.** Each regex AST node becomes a small NFA fragment; concatenation/union/star wire fragments together via ε-transitions.
- **UI:** new "From regex" entry point (likely a tab or a button in the New Automaton flow). Input field + live preview of the constructed NFA.

**Risks:** Regex parsing is a rabbit hole. Mitigation: define the supported grammar explicitly in the plan doc; reject unsupported features with a clear error.

**Test strategy:** Hundreds of regex/string pairs from a textbook table; each must accept iff the corresponding regex matches.

---

## Iter-19 — Shareable URL

**Why now:** Low-cost, high-impact for the no-backend value proposition. After iter-15 establishes the JSON serialization, encoding it into a URL hash is a small step.

**Scope:**
- Serialize the current automaton to JSON, gzip-compress (via `pako` or browser-native CompressionStream), base64url-encode, write to `window.location.hash`.
- On page load, if hash is present, decode and load.
- "Share" button copies the current URL.
- Length budget: aim to keep typical automaton URLs under 2000 chars (works in every browser address bar, every messaging app).

**Risks:** URL hash limits vary by browser (~64KB Chrome, ~4KB old IE — moot now). Real risk is messaging apps stripping long URLs. Mitigation: warn if encoded length > 2000.

**Test strategy:** Round-trip every fixture automaton through encode/decode; assert structural equality.

---

## Iter-20 — Algorithm Visualization (Step-By-Step)

**Why now:** Maya and Selene both want to *see* the algorithm work, not just see its result. After iter-16+17 ship the algorithms, retrofitting "show me the steps" is the educational payoff.

**Scope:**
- For NFA→DFA: queue-driven subset construction; show each subset as it's discovered, each transition as it's added. Step-forward / step-back / play-through buttons.
- For minimization: partition refinement visualization — show the equivalence-class table refining each round.
- For equivalence: side-by-side product-construction step-through.

**Risks:** This is fundamentally a UI iteration on top of three existing algorithms. Risk is scope creep — don't try to do all three modes in one iteration. Recommend NFA→DFA first; minimization and equivalence as iter-21 candidates.

**Test strategy:** Snapshot the step trace for known fixtures; assert structural equality on the trace.

---

## Iter-21 — Tape View + Image Export

**Why now:** The current simulation shows the *automaton* during a run, but not the *input string*. Adding a tape view (input string with cursor on the current symbol) closes the visual loop. Image export (PNG/SVG) is the deliverable for Maya's homework PDF and Professor Chen's slides.

**Scope:**
- **Tape view:** horizontal strip above or below the canvas; input string laid out as cells; cursor on the current symbol; consumed prefix dimmed; remaining suffix bright. Steps in lockstep with the current state highlight.
- **Export PNG:** use `html2canvas` or render the SVG to a Canvas + `toDataURL`. Recommend SVG → Canvas (smaller, faster, no DOM-to-image gymnastics).
- **Export SVG:** the canvas content `<g>` is already an SVG; serialize it with the current viewport applied (or at scale=1?), wrap in a complete `<svg>` document, download.

**Risks:** SVG export needs to inline computed styles (CSS in stylesheets won't be present in the exported file). Mitigation: collect computed style on every element and inline.

**Test strategy:** Visual regression is overkill for this; structural-snapshot the exported SVG markup.

---

## Beyond iter-21 — Opportunistic backlog

Ranked by customer-impact-per-effort, not by sequence. Pick whichever fits an iteration's mood:

1. **Lecture mode** — full-screen, large fonts, no chrome. Probably 1 day of work, big delight for Professor Chen.
2. **Step-back through simulation** — currently forward-only. Add a back button + history. Small, useful.
3. **δ table view** — alternate view to graph. For students who think in tables.
4. **Pumping-lemma demonstrator** — niche but unique. Pick a string `s = xyz`, "pump" `y`, watch the simulation. Visual proof of non-regularity.
5. **Automaton → regex** (state-elimination algorithm). Closes the conversion loop. Medium algorithmic complexity.
6. **DFT support** (deterministic finite transducer — outputs symbols on each transition). Same UX vocabulary, used in lexer construction. Could become its own audience.
7. **Color-code states by reachability or equivalence class.** Subtle UI win once iter-17 is in.
8. **Keyboard-only editing.** Power-user mode. Nice but small audience.
9. **"Solve this language" practice mode.** Tool generates a description; user builds an automaton; tool tests. Big design lift, big educational value.
10. **LaTeX `tikz` export** — for Professor Chen's course notes. Niche format.
11. **Pushdown automata / Turing machines** — explicitly out of scope per `CUSTOMER_BRAINSTORM.md`. Different machine class; would split the audience.

## Cross-cutting items that aren't iterations

- **Reduced-motion media query.** Deferred from iter-10 → iter-12 → iter-14. Pick up at any point. ≤1 day of work.
- **Test-utils extraction.** Wait for a third occurrence of duplicated RTL fixtures.
- **Accessibility pass.** Keyboard navigation, ARIA labels, focus management. Should be its own iteration when it lands.
- **Performance pass.** Likely no issue at current scale (even a 50-state automaton renders fine), but at some point a synthetic 1000-state stress test would expose what breaks first.
- **Documentation site.** README is fine for now; eventually a one-page "what is this" + "how to use" + "supported features" site is worth building.
