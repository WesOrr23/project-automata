# Project Automata — User Testing Tasks

Hey! Thanks for helping me out with this. This is a tool I've been building
for visualizing and simulating finite automata (DFAs and NFAs). You're
familiar with FAs from class so the *concepts* will be obvious — what I'm
really testing is the **interface**, not your understanding of automata
theory.

There's no time pressure, but a typical run takes about **20–30 minutes**.

## Ground rules

- **Don't ask me how to do anything.** If you can't figure it out, that's
  a finding — write it down and try something else.
- **Think aloud.** Saying "I'm looking for X and don't see it" is way more
  useful to me than silently figuring it out.
- **Write down anything that surprises you** — good or bad. "I expected
  X, got Y" is gold even when Y was actually fine.
- The app autosaves nothing — refresh the page if you want to start over.

## Setup

1. Open the app at `<URL Wes will give you>`.
2. The first time you load it, a brief tour will pop up. Read it or skip
   it — your call. If you skip, see if you can find a way to get it
   back later.
3. There's a sample DFA already loaded. Don't worry about understanding
   what it does — you're going to replace it.

---

## Task 1 — First impressions (5 min)

**Don't touch anything for the first minute.** Just look at the screen
and answer these in your head, then write a sentence each:

1. What do you think this tool is for?
2. What would you click first?
3. Where do you think you'd start building your own FA?

Then poke around freely for 3–4 minutes. Don't try to accomplish
anything specific. Just see what's where.

> **Things I'm curious about** (don't read until you've poked around):
> - Does the layout make sense? Where do you expect to find things?
> - Are the three sidebar tabs' purposes clear from their names?

---

## Task 2 — Build your first DFA (10 min)

**Build a DFA that accepts binary strings ending in `00`.**

The alphabet is `{0, 1}`. You'll need a few states. Sketch it on paper
first if that helps — but the goal is to get it into the app, not to
prove you can solve the theory problem.

When you think it's done, **don't run it yet**. Just look at it on the
canvas and decide whether it looks right.

> **Things I'm curious about**:
> - How did you start? (Add states first? Add transitions first?)
> - Did anything feel awkward or take more clicks than it should?
> - Was anything not where you expected?

---

## Task 3 — Test it (5 min)

Now run your DFA against some test inputs:

- `0` → should reject
- `00` → should accept
- `100` → should accept
- `0010` → should reject
- `1100` → should accept
- `10101010` → should reject

Try them one at a time first to watch the simulation. Then see if you
can find a faster way to test all six at once.

> **Things I'm curious about**:
> - Did you notice the play/step controls? Did you use them?
> - Did you find the "faster way"? How long did it take?
> - When a string was rejected, did you understand *why*?

---

## Task 4 — Make a change and undo it (5 min)

Modify your DFA to accept strings ending in `01` instead of `00`. Don't
rebuild from scratch — just edit what you have.

Then **undo your changes** to get back to the "ends in 00" version.

> **Things I'm curious about**:
> - How did you find the edit affordances? Were they obvious?
> - Did you find undo without searching?
> - If you got stuck, what tripped you up?

---

## Task 5 — Share your work (5 min)

You want to send your "ends in 00" DFA to a friend in two formats:
1. As an editable file they can open in this same tool
2. As an image they can paste into a class assignment

Find both export paths.

> **Things I'm curious about**:
> - Were both exports easy to find?
> - Did the exported image look the way you expected?
> - Anything you wish was different about either export?

---

## Wrap-up questions (5 min)

Answer in 1–2 sentences each. Be honest — "I don't know" or "I didn't
notice" is a totally fine answer.

1. **What was the most confusing part?** (One thing.)
2. **What was the most pleasant surprise?** (Anything that worked
   better than you expected.)
3. **What's missing that you wish was there?**
4. If you had to teach someone else to use this in 30 seconds,
   **what would you tell them first?**
5. **Did the three sidebar tabs make sense?** (Define → Construct →
   Simulate.) Would you have named them differently?
6. **Did you notice the keyboard shortcuts?** (Hint: ⌘N, ⌘O, ⌘S, ⌘Z,
   etc.) Did you use any?
7. **The little tour that popped up at the start** — was it helpful,
   or did it get in the way?
8. **Any visual element that you think is off?** (Spacing, color,
   placement, weight — anything.)

---

## What to send back

Just a doc, email, message, anything. Doesn't need to be polished. The
running commentary you wrote during the tasks is the most valuable part
— I'd rather read 20 messy bullet points than 5 polished paragraphs.

Thanks again. Beer's on me.

— Wes
