// Captures canonical UI states of the app as PNG screenshots.
// Run with the dev server already running on http://localhost:5174.
//
//   node design-export/capture.mjs
//
// Each screenshot is written to design-export/screenshots/.

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'screenshots');
const URL = 'http://localhost:5174';

const VIEWPORT = { width: 1400, height: 900 };

async function shot(page, name) {
  const path = resolve(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`  → ${name}.png`);
}

// Wait for the GraphViz layout to settle. The app debounces layout 120ms,
// then runs WASM async. Generous wait keeps screenshots stable.
async function waitForLayout(page) {
  await page.waitForTimeout(700);
}

// Click a tool-menu tab by its aria-label / title.
async function openTab(page, name) {
  await page.evaluate((tabName) => {
    for (const b of document.querySelectorAll('button')) {
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes(tabName.toLowerCase())) {
        b.click();
        return;
      }
    }
  }, name);
  await page.waitForTimeout(250);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  const page = await context.newPage();

  console.log('Loading app…');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await waitForLayout(page);

  console.log('01 — initial canvas (collapsed menu, sample DFA)');
  await shot(page, '01-initial-canvas');

  console.log('02 — Configure tab open (DFA mode)');
  await openTab(page, 'configure');
  await shot(page, '02-configure-dfa');

  console.log('03 — Configure tab open (NFA mode, ε symbol input visible)');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.speed-toggle-option')) {
      if (b.textContent === 'NFA') { b.click(); break; }
    }
  });
  await page.waitForTimeout(250);
  await shot(page, '03-configure-nfa');

  console.log('04 — Edit tab open, form at idle (canvas tip visible)');
  // Switch back to DFA to keep things simple
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.speed-toggle-option')) {
      if (b.textContent === 'DFA') { b.click(); break; }
    }
  });
  await page.waitForTimeout(200);
  await openTab(page, 'edit');
  await waitForLayout(page);
  await shot(page, '04-edit-idle');

  console.log('05 — Edit tab, source filled, picking destination');
  await page.evaluate(() => {
    document.querySelectorAll('.mini-transition-slot')[0].dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (const o of document.querySelectorAll('.state-picker-popover button')) {
      if (o.textContent === 'q0') { o.click(); break; }
    }
  });
  await page.waitForTimeout(300);
  await shot(page, '05-edit-source-picked');

  console.log('06 — Edit tab, transition loaded for editing (purple pulse)');
  // Reset and click an existing edge
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const e = document.querySelectorAll('g.transition-edge-clickable')[0];
    const r = e.getBoundingClientRect();
    e.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2,
    }));
  });
  await page.waitForTimeout(300);
  await shot(page, '06-edit-loaded-edge');

  console.log('07 — Edit tab, modify mode (structural change → red+blue preview)');
  await page.evaluate(() => {
    document.querySelectorAll('.mini-transition-slot')[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (const o of document.querySelectorAll('.state-picker-popover button')) {
      if (o.textContent === 'q2') { o.click(); break; }
    }
  });
  await waitForLayout(page);
  await shot(page, '07-edit-modify-structural');

  console.log('08 — State actions popover (clicked a state in EDIT mode)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    for (const n of document.querySelectorAll('g.state-node-selectable')) {
      if (n.querySelector('text')?.textContent === 'q0') {
        const r = n.getBoundingClientRect();
        n.dispatchEvent(new MouseEvent('click', {
          bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2,
        }));
        break;
      }
    }
  });
  await page.waitForTimeout(300);
  await shot(page, '08-state-actions-popover');

  console.log('09 — Simulate tab, before stepping');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await openTab(page, 'simulate');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const inp = document.querySelector('input[type="text"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, '01');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await shot(page, '09-simulate-input-ready');

  console.log('10 — Simulate, mid-step (active state highlighted, next edge blue)');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent?.trim() === 'Step') { b.click(); break; }
    }
  });
  await page.waitForTimeout(400);
  await shot(page, '10-simulate-mid-step');

  console.log('11 — Simulate, accepted (q2 green halo)');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent?.trim() === 'Step') { b.click(); break; }
    }
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent?.trim() === 'Step') { b.click(); break; }
    }
  });
  await page.waitForTimeout(500);
  await shot(page, '11-simulate-accepted');

  console.log('12 — Notification toast (alphabet error in NFA mode)');
  await openTab(page, 'configure');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.speed-toggle-option')) {
      if (b.textContent === 'NFA') { b.click(); break; }
    }
  });
  await page.waitForTimeout(200);
  await openTab(page, 'edit');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const alpha = Array.from(document.querySelectorAll('input')).find(
      (i) => i.placeholder === 'New symbol'
    );
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(alpha, 'e');
    alpha.dispatchEvent(new Event('input', { bubbles: true }));
    // Click Add
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent?.trim() === 'Add' && b.parentElement?.querySelector('input[placeholder="New symbol"]')) {
        b.click();
        break;
      }
    }
  });
  await page.waitForTimeout(400);
  await shot(page, '12-notification-reserved-e');

  console.log('13 — Edge consolidation in DFA mode (q0→q1 with two symbols)');
  // Switch back to DFA
  await openTab(page, 'configure');
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.speed-toggle-option')) {
      if (b.textContent === 'DFA') { b.click(); break; }
    }
  });
  await page.waitForTimeout(200);
  await openTab(page, 'edit');
  await waitForLayout(page);
  // Click q0→q0 (the '1' self-loop) → modify destination to q1 to consolidate q0→q1
  await page.evaluate(() => {
    // Find the '1' edge that's a q0 self-loop
    const edges = document.querySelectorAll('g.transition-edge-clickable');
    for (const e of edges) {
      const txt = e.querySelector('text')?.textContent;
      if (txt === '1') {
        const r = e.getBoundingClientRect();
        e.dispatchEvent(new MouseEvent('click', {
          bubbles: true, clientX: r.left + r.width/2, clientY: r.top + r.height/2,
        }));
        break;
      }
    }
  });
  await page.waitForTimeout(300);
  // Change dest to q1
  await page.evaluate(() => {
    document.querySelectorAll('.mini-transition-slot')[1].dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (const o of document.querySelectorAll('.state-picker-popover button')) {
      if (o.textContent === 'q1') { o.click(); break; }
    }
  });
  await page.waitForTimeout(200);
  // Click Modify
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('.transition-creator-action-row button')) {
      if (b.textContent === 'Modify') { b.click(); break; }
    }
  });
  await waitForLayout(page);
  await shot(page, '13-edge-consolidation');

  console.log('14 — Tool menu collapsed (just the icon rail)');
  // Click somewhere outside the menu so it collapses (or use the back button)
  await page.evaluate(() => {
    // Find the collapse button (the < arrow)
    for (const b of document.querySelectorAll('button')) {
      if (b.textContent?.trim() === '<' || b.getAttribute('aria-label')?.toLowerCase().includes('collapse')) {
        b.click();
        return;
      }
    }
  });
  await page.waitForTimeout(300);
  await shot(page, '14-menu-collapsed');

  await browser.close();
  console.log('\nDone — screenshots in design-export/screenshots/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
