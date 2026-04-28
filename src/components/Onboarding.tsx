/**
 * Onboarding — first-launch tour overlay.
 *
 * Three-step dim-overlay tour that highlights the tool menu, the
 * command bar, and the zoom controls in turn. Each step:
 *
 *   - dims the entire viewport (rgba(0,0,0,0.5)),
 *   - punches a "spotlight" hole around the target element using a
 *     huge box-shadow trick (no clip-path needed; works back to
 *     ancient browsers),
 *   - anchors a caption pill near the target with the step copy and
 *     Skip / Back / Next buttons.
 *
 * Dismissal paths: Esc, outside-click on the dim layer, and the
 * last step's "Got it" button. All three call onDismiss, which
 * writes the localStorage flag (via useOnboarding's dismiss()).
 *
 * NOT a full-screen modal: the user should SEE the actual UI being
 * described while reading about it. Modal-style tutorials hide the
 * very thing they're teaching.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

type Step = {
  id: string;
  selector: string;
  caption: string;
  // Where to anchor the caption pill relative to the highlighted target.
  placement: 'right' | 'left' | 'below' | 'above';
};

const STEPS: ReadonlyArray<Step> = [
  {
    id: 'menu',
    selector: '.tool-menu',
    caption: 'Define your type & alphabet, construct states & transitions, then simulate. The menu expands as you hover.',
    placement: 'right',
  },
  {
    id: 'bar',
    selector: '.command-bar',
    // The top bar is a *context* menu — its contents change with the
    // active stage. File ops are always there; Undo/Redo show in
    // Define + Construct; Tools (Convert / Minimize / Complement /
    // Compare) shows only in Construct; Export shows only in
    // Simulate. Caption copy authored by Wes.
    caption: 'This is the context menu. It shows relevant useful tools pertaining to the current stage of development, including file management, and additional less-frequently used tools.',
    placement: 'below',
  },
  {
    id: 'zoom',
    selector: '.canvas-zoom-controls',
    caption: 'Zoom and pan to navigate the canvas. The percentage shows your current zoom — click it to fit the whole automaton.',
    placement: 'left',
  },
];

const HIGHLIGHT_PADDING = 8;

type OnboardingProp = {
  visible: boolean;
  onDismiss: () => void;
};

export function Onboarding({ visible, onDismiss }: OnboardingProp) {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Reset to step 0 each time the tour opens; if the user re-shows it
  // mid-tour they should start from the top.
  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  // Measure the current step's target whenever step changes (or on
  // window resize while open). useLayoutEffect so the measurement
  // happens after layout but before paint, no flash.
  useLayoutEffect(() => {
    if (!visible) return;
    const step = STEPS[stepIndex];
    if (!step) return;
    function measure() {
      const stepInner = STEPS[stepIndex];
      if (!stepInner) return;
      const target = document.querySelector(stepInner.selector);
      if (!target) {
        setTargetRect(null);
        return;
      }
      setTargetRect(target.getBoundingClientRect());
    }
    measure();
    window.addEventListener('resize', measure);
    // Re-measure once a frame for the first ~600ms in case the menu's
    // hover/expand animation is mid-flight at step 1. Cheap polling
    // beats wiring into Framer's animation lifecycle.
    let frame: number;
    const start = Date.now();
    function tick() {
      measure();
      if (Date.now() - start < 600) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
    };
  }, [stepIndex, visible]);

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      onDismiss();
    } else {
      setStepIndex((i) => i + 1);
    }
  }
  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  // Keyboard nav. Esc dismisses; ← back; → / Space advance. Outside-
  // click on the dim layer also dismisses (caption stops propagation
  // so clicks INSIDE it don't count). Refs to next/back capture the
  // latest closure without re-binding the listener every step change.
  const nextRef = useRef(next);
  nextRef.current = next;
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    if (!visible) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onDismiss();
      } else if (event.key === 'ArrowRight' || event.key === ' ') {
        // Space and → advance. preventDefault on Space so the page
        // doesn't scroll under the dim overlay.
        event.preventDefault();
        nextRef.current();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        backRef.current();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onDismiss]);

  // Compute caption position from targetRect + placement.
  function captionStyle(): React.CSSProperties {
    if (!targetRect) return { display: 'none' };
    const step = STEPS[stepIndex];
    if (!step) return { display: 'none' };
    const gap = 16;
    switch (step.placement) {
      case 'right':
        return {
          left: targetRect.right + gap,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          right: window.innerWidth - targetRect.left + gap,
          top: targetRect.top + targetRect.height / 2,
          transform: 'translateY(-50%)',
        };
      case 'below':
        return {
          left: targetRect.left + targetRect.width / 2,
          top: targetRect.bottom + gap,
          transform: 'translateX(-50%)',
        };
      case 'above':
        return {
          left: targetRect.left + targetRect.width / 2,
          bottom: window.innerHeight - targetRect.top + gap,
          transform: 'translateX(-50%)',
        };
    }
  }

  // The "spotlight" effect: an absolutely-positioned div the size of
  // the target with a giant box-shadow that fills the rest of the
  // screen with the dim color. Pointer events disabled so the user
  // can't actually interact with the spotlit element either — the
  // tour is a guided read, not interactive.
  function spotlightStyle(): React.CSSProperties {
    if (!targetRect) return { display: 'none' };
    return {
      position: 'fixed',
      left: targetRect.left - HIGHLIGHT_PADDING,
      top: targetRect.top - HIGHLIGHT_PADDING,
      width: targetRect.width + HIGHLIGHT_PADDING * 2,
      height: targetRect.height + HIGHLIGHT_PADDING * 2,
      borderRadius: 12,
      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
      pointerEvents: 'none',
      zIndex: 9999,
    };
  }

  const isLast = stepIndex >= STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const step = STEPS[stepIndex];

  return (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          ref={overlayRef}
          className="onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          // Outside-click on the dim layer dismisses. The spotlight
          // and caption are rendered as siblings inside this layer —
          // clicks that bubble up here are "outside the spotlight."
          onClick={onDismiss}
          role="dialog"
          aria-label="Tour"
          aria-modal="true"
        >
          <div style={spotlightStyle()} />

          <div
            className="onboarding-caption"
            style={captionStyle()}
            // Stop bubbling so clicking INSIDE the caption doesn't
            // count as outside-click dismissal.
            onClick={(e) => e.stopPropagation()}
          >
            <div className="onboarding-caption-step">
              Step {stepIndex + 1} / {STEPS.length}
            </div>
            <div className="onboarding-caption-text">{step.caption}</div>
            <div className="onboarding-caption-actions">
              <button
                type="button"
                className="onboarding-button onboarding-button-skip"
                onClick={onDismiss}
                title="Skip the tour (Esc)"
              >
                <span>Skip</span>
                <kbd className="onboarding-kbd">esc</kbd>
              </button>
              <div style={{ flex: 1 }} />
              {!isFirst && (
                <button
                  type="button"
                  className="onboarding-button"
                  onClick={back}
                  title="Back (←)"
                >
                  <kbd className="onboarding-kbd">←</kbd>
                  <span>Back</span>
                </button>
              )}
              <button
                type="button"
                className="onboarding-button onboarding-button-primary"
                onClick={next}
                title={isLast ? 'Finish (→ or space)' : 'Next (→ or space)'}
              >
                <span>{isLast ? 'Got it' : 'Next'}</span>
                <kbd className="onboarding-kbd onboarding-kbd-on-primary">
                  {isLast ? 'space' : '→'}
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
