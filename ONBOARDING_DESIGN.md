# Onboarding — Detection + Tutorial Button

## Wes asked: "How would you go about detecting when appropriate for onboarding? Will there then also be a tutorial button?"

## Detection model

**Three triggers, in priority order:**

### 1. First-launch (auto)
- On app mount, check `localStorage.getItem('automata-onboarding-v1')`.
- If `null` → show the onboarding overlay automatically.
- After dismissal (any close path) → write `'seen'`.
- Versioned key (`-v1`) so we can re-trigger for everyone if a major redesign warrants it (bump to `-v2`); old key becomes dead, new key is null on next visit.

### 2. Tutorial button (explicit)
- A persistent **`?` icon button** lives in the CommandBar's `⋯` overflow as **"Show tour"**. Click → re-shows the same overlay regardless of the localStorage flag.
- Why in `⋯`: it's a low-frequency action that doesn't deserve top-level real estate, and it's adjacent to "Save As" which is also a discoverable-but-not-primary action.
- Alternatives considered: floating `?` in a corner (cluttery — we just decommissioned the OperationsWidget for being a sibling chip), or a top-bar icon (steals real estate from common actions). The `⋯` placement keeps the chrome calm.

### 3. Stuck-state nudge (defer)
- Optional future trigger: if the user spawns the app, doesn't open any tab, doesn't click anything for ~60 seconds, and the canvas state still equals the initial sample → fade in a small "**New here? Click for a quick tour →**" chip pointing at the `?` button.
- I'd defer this. It risks being annoying, and the first-launch overlay should catch the same population. Build it if telemetry (later) suggests people are actually getting stuck.

## Overlay shape

A **dismissible step-through overlay** (not a full-screen tutorial). Three steps:

```
Step 1/3 — TOP-LEFT, pointing at the tool menu
  "Configure your alphabet, edit states & transitions, simulate."

Step 2/3 — TOP-CENTER, pointing at the CommandBar
  "Save your work, undo edits, run operations like NFA → DFA."

Step 3/3 — BOTTOM-RIGHT, pointing at the zoom controls
  "Zoom and pan to navigate the canvas. Click the percentage to fit."
```

Each step:
- A **highlight ring** around the target element (using a CSS `box-shadow: 0 0 0 9999px rgba(0,0,0,0.4)` cutout trick so the rest of the page dims).
- A **caption pill** anchored to the highlighted element with the step text + `Skip` / `Back` / `Next` buttons.
- `Esc` skips. Outside-click on the dim layer dismisses (counts as "seen"). Last step's Next becomes "Got it."

**Why this shape, not a full-screen modal:** the user should SEE the actual UI being described while they read about it. A modal hides the very thing it's teaching.

**Why three steps, not seven:** too many steps and the user clicks Skip on step 2. Three is the threshold where "if I can endure three I'll endure them all."

## Component sketch

```tsx
// src/components/Onboarding.tsx

type Step = {
  id: string;
  selector: string;          // CSS selector for the target element
  caption: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
};

const STEPS: Step[] = [
  { id: 'menu',      selector: '.tool-menu',                 caption: '...', placement: 'right' },
  { id: 'bar',       selector: '.command-bar',               caption: '...', placement: 'bottom' },
  { id: 'zoom',      selector: '.canvas-zoom-controls',      caption: '...', placement: 'left' },
];

export function Onboarding({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  // measure target via getBoundingClientRect; render the highlight + caption pill;
  // Esc, outside-click, and Next-on-last-step all call onDismiss.
}
```

```tsx
// src/hooks/useOnboarding.ts

export function useOnboarding() {
  const [visible, setVisible] = useState(() => localStorage.getItem('automata-onboarding-v1') === null);

  function dismiss() {
    localStorage.setItem('automata-onboarding-v1', 'seen');
    setVisible(false);
  }
  function show() { setVisible(true); }

  return { visible, dismiss, show };
}
```

App.tsx wires it. The `Show tour` item in the CommandBar's `⋯` calls `onboarding.show`.

## What does NOT belong in onboarding

- A textbook explanation of what a DFA / NFA is. The user is in a Theory class; we're not the textbook.
- Every feature. Three steps cover the surfaces; everything else is discovered by clicking.
- A welcome screen with a logo. The user is here to do work, not be greeted.

## Edge cases worth thinking through now

- **Onboarding shouldn't block the URL-share flow** (when iter-21 lands sharable URLs): if the URL hash carries an automaton, dismiss onboarding immediately and load the file. The user came here to see something specific; don't make them sit through the tour first.
- **Mobile / small viewport**: the highlight cutout trick works fine; the captions might overflow. Constrain caption max-width to viewport width minus 32px.
- **Telemetry hooks**: not now. Eventually we'd want to know "what fraction of first-launchers complete the tour vs skip" — wire up only when there's a plan to act on the data.

## Recommendation

Tie the implementation to **iter-21 (Onboarding + Shareable URL)** as proposed in `STUDENT_USABILITY_BRAINSTORM.md`. Both are about "first contact" — share-link onboarding flow + first-launch tour are the two primary entry experiences. Building them together means decisions on one inform the other (e.g., share-link must skip the tour gracefully).

Estimated cost: 1 component + 1 hook + ~150 lines of CSS for the highlight cutout + caption styling + 4-line additions to App and CommandBar to wire it up. Half a day of work for the tour itself; another half-day for the share-link half.
