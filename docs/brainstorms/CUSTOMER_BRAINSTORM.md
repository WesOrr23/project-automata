# Customer Brainstorm — Who Uses This and What Do They Want?

> Deliberately customer-shaped, not engineer-shaped. Each section starts with a person, not a feature.

## Personas

### 1. Maya — second-year CS undergrad, taking Theory of Computation

- Sipser is on her shelf. She's two weeks into the automata unit.
- The lectures cover DFA → NFA → regex equivalences, then minimization, then closures. Each is a moving picture in her head she can't quite hold.
- She's been drawing automatons on graph paper. They get messy fast. She keeps getting δ wrong on transitions she already drew.
- She wants: **a way to draw them, run a string through them, and have the tool tell her she got it right.** Bonus: a way to play "is this DFA equivalent to that NFA" without doing it by hand.

### 2. Professor Chen — adjunct teaching the same course

- Hand-drawing 12-state automatons on the whiteboard is killing her wrists.
- She wants to **build a library of examples** she can pull up in lecture, run live in front of students, and email out as homework. The current PowerPoint workflow is dead.
- Bonus: assign students homework as automatons-as-files; receive their submissions; **batch-run a test string set** against each student's automaton.

### 3. Devesh — software engineer brushing up for a systems-design interview

- Last touched automata in undergrad. Has a phone screen in two weeks that mentions "regex engines."
- Wants to refresh **fast**. Doesn't want to read a textbook.
- Wants: **load a regex, see the equivalent NFA, see the converted DFA, see them run side-by-side.** Educational pipeline in one screen.

### 4. Luca — high-school CS teacher with a strong student

- A 16-year-old in his class is reading Sipser on her own. Luca doesn't want to lecture her — he wants to point her at a tool that lets her *play*.
- Wants: **a shareable URL** (no install, no account) that loads with a starter example, lets her edit and run, and saves to her local drive.

### 5. Selene — self-learner working through Hopcroft-Ullman

- No course, no professor. Just a textbook and a goal.
- Stuck on the exercise sets. Wants to **check her work**: "did I get this minimization right?"
- Wants: a tool that not only does the algorithm, but **shows her steps**.

---

## Feature backlog (customer-ranked)

Ranking by: how often I'd hear "I wish it could ___" if I demoed the current build.

### Tier 1 — would unblock a course

- **Save / load files (already iter-15).** Without this, every browser refresh nukes their work. Maya stops using the tool by week 3 if this isn't there.
- **Recents list (iter-15).** "Where was that DFA I built last week" — if the answer is "redraw it," they leave.
- **NFA → DFA conversion (iter-16).** This is the single most-assigned exercise type in every undergrad automata course. Tool that doesn't do this is a toy.
- **Regex → NFA (Thompson's construction).** The other half of the conversion pipeline. A regex input field that produces an NFA visually is *the* hook for Devesh's persona.
- **Step-by-step simulation with the input string visualized.** Currently the user enters a string and steps through; the string itself isn't visualized as a tape with a cursor. Adding a "tape view" with the cursor on the current symbol would make the connection between input and state-transition obvious.

### Tier 2 — would make it a serious tool

- **DFA minimization (Hopcroft).** Pair with NFA→DFA. After conversion, "now minimize" is the expected next button.
- **Equivalence testing (product construction).** "Is my answer to this exercise equivalent to the textbook's?" — this is the killer feature for Selene.
- **Shareable URL (compressed automaton in URL hash).** Encodes the automaton in the URL so sharing is paste-a-link. No backend required.
- **Multiple automatons in tabs / side panel.** Currently one-at-a-time. For "convert and compare" workflows, side-by-side beats single-view.
- **Export PNG / SVG.** Maya's homework is due as a PDF; she needs to embed the diagram.
- **Undo through the file boundary.** Open file, edit, "actually no" — currently the load erases history. Should it?

### Tier 3 — would delight specific personas

- **Lecture mode.** Full-screen, large fonts, no chrome. For Professor Chen.
- **Step-back through the simulation.** Currently step forward; should be able to step back without re-simulating.
- **Show δ as a table** (alternative view to graph). For students who think in tables.
- **Regular expression equivalence** (regex → DFA → minimize → compare). Power-user pipeline.
- **Pumping lemma demonstrator.** Pick a string `s`, decompose into `xyz`, "pump" `y` and watch the simulation; visual proof of non-regularity for specific languages. Niche but unique.
- **Deterministic finite transducer (DFT)** support — outputs not just accept/reject. Used in lexer construction. Would meaningfully expand the audience.
- **Pushdown automaton (PDA) support.** Different beast (stack machine), but the same UX vocabulary. Big lift.

### Tier 4 — nice-to-have polish

- **Keyboard-only editing.** Add state, transition, set start, mark accept — all from keys. For power users.
- **Color-coding states by their reachability or equivalence class.** Highlights that wouldn't otherwise be visible.
- **"Solve this language" practice mode.** Tool generates a regular language description; user builds an automaton; tool tests it on random strings.
- **Lookbehind / lookahead automata.** Educational value for regex internals.
- **Export to a textbook-friendly format** (LaTeX `tikz` or graphviz DOT). Professor Chen wants this for course notes.
- **Automaton → regex (state-elimination algorithm).** Closes the conversion loop.
- **Ambiguity highlight.** For NFAs, mark states/transitions that contribute to non-determinism.

### Tier 5 — speculative / probably no

- **Cloud sync / accounts.** Adds backend. Most personas explicitly value the no-backend simplicity.
- **Multi-user real-time editing.** Collaborative whiteboard model. Cool, but huge build, narrow audience.
- **Mobile / tablet support.** Drawing automatons on a phone is a bad experience no matter what we do.

---

## Cross-cutting observations from the personas

1. **The tool is fundamentally educational.** Every persona wants to *understand* something, not just produce an artifact. This argues for "show the steps" being a first-class concern in any algorithm we add (NFA→DFA, minimization, etc.).
2. **No-account / no-backend is a feature, not a missing feature.** Maya, Luca, and Selene all benefit from "open URL, it works." Adding accounts later is reversible; cluttering with login flows now is not.
3. **The graph view is the primary affordance.** Tables are a fallback. Most people learn automata visually. We've done this right; don't regress.
4. **File format matters more than file UI.** A clean, documented JSON schema means people can write their own importers/exporters. Argues for publishing the schema explicitly.

## Suggested next-quarter ordering

1. **Iter-15** — Save/load + recents (foundation).
2. **Iter-16** — NFA→DFA (the headline algorithm).
3. **Iter-17** — DFA minimization + equivalence testing (algorithm follow-throughs; small lift after iter-16).
4. **Iter-18** — Regex → NFA (Thompson's). Pairs with iter-16 to make the full conversion pipeline visible.
5. **Iter-19** — Shareable URL (low-cost feature with high persona impact for Luca/Maya).
6. **Iter-20** — Step-by-step algorithm visualization (apply to NFA→DFA + minimization in retrospect).
7. **Iter-21** — Tape view for simulation + export PNG/SVG.

After that, opportunistic: lecture mode, DFT support, regex-equivalence, pumping lemma demo, automaton→regex.

## What we're not building

- Anything cloud-side. No accounts, no sync, no multi-user editing.
- Mobile-first or touch-first input.
- Pushdown automata or Turing machines (different machine class — would split the audience).
- Lexer / parser generation (ANTLR's territory; we'd be the worst version of it).
