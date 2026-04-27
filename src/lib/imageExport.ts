/**
 * imageExport — convert the canvas SVG into a downloadable PNG or SVG
 * file, framed at the FA's natural size (cluster bbox + start-arrow
 * reserve + padding) regardless of the user's current pan/zoom.
 *
 * Why not just save the live SVG? Two reasons:
 *   1. The live SVG carries the user's transient pan/zoom transform
 *      and a viewBox covering the whole viewport. An export taken
 *      right after the user pans to a corner would crop the FA badly.
 *   2. The live SVG references CSS classes from the document's
 *      stylesheets (`.state-node-selectable circle { ... }` etc.).
 *      A standalone .svg file has no stylesheet — the elements would
 *      render as default unstyled black-on-white.
 *
 * So both export paths first clone the SVG, reset the inner-group
 * transform to identity, retarget viewBox to the FA cluster, strip
 * debug overlay shapes, inline computed styles onto every element
 * (so the file is self-contained), and add a white background rect.
 */

const STYLE_PROPS_TO_INLINE = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
] as const;

/** Padding (in user-space units) added around the cluster bbox so
 *  exported content isn't flush against the canvas edge. */
const EXPORT_PADDING = 32;

/** Reserve on the LEFT of the cluster bbox for the start arrow.
 *  Matches AutomatonCanvas's START_ARROW_RESERVE. */
const START_ARROW_RESERVE = 70;

type ClusterBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Build a self-contained SVG string ready for either direct download
 * or rendering into a canvas for PNG conversion. Caller provides the
 * live source SVG and the cluster bbox in inner-group coordinates
 * (same one AutomatonCanvas measures and passes to the viewport hook).
 */
export function buildExportSVGString(
  liveSvg: SVGSVGElement,
  cluster: ClusterBBox
): { svgString: string; widthPx: number; heightPx: number } {
  const clone = liveSvg.cloneNode(true) as SVGSVGElement;

  // Reset the content group's transform so the export is at 1:1
  // scale, regardless of current pan/zoom. The transform attribute
  // is set imperatively per render by useCanvasViewport; the cloned
  // node still carries the most recent value.
  // The transform owner is the FIRST <g> child of the SVG that has a
  // `transform` attribute set as a string like "translate(...) scale(...)"
  // — that's the canvas-content group. Resetting it to identity (no
  // attribute) keeps the inner-g translate(-START_ARROW_RESERVE 0)
  // intact, which is what we want.
  const outerGroups = clone.querySelectorAll(':scope > g[transform]');
  outerGroups.forEach((g) => g.removeAttribute('transform'));

  // Strip debug-overlay shapes (red dot + blue ring) — they're
  // toggleable in the live UI but never wanted in an export.
  const debugCircles = clone.querySelectorAll(
    'circle[fill="#ef4444"], circle[stroke="#3b82f6"]'
  );
  debugCircles.forEach((el) => el.remove());

  // Inline computed styles. Walk the LIVE element tree in parallel
  // with the clone and copy the subset of properties that affect
  // visual rendering.
  inlineComputedStyles(liveSvg, clone);

  // Frame: cluster bbox in inner-group coordinates is at
  // (cluster.x, cluster.y) sized cluster.width x cluster.height.
  // The inner-g translates by (-START_ARROW_RESERVE, 0), so the
  // visible content's left edge in outer-group coords is
  // (cluster.x - START_ARROW_RESERVE).
  // Add EXPORT_PADDING on every side; reserve extra room on the
  // left for the start arrow.
  const minX = cluster.x - START_ARROW_RESERVE - EXPORT_PADDING;
  const minY = cluster.y - EXPORT_PADDING;
  const width = cluster.width + START_ARROW_RESERVE + EXPORT_PADDING * 2;
  const height = cluster.height + EXPORT_PADDING * 2;

  clone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // xmlns is required for standalone SVG files (browsers display
  // inline SVG without it, but a saved file won't).
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // White background rect inserted as the first child so it sits
  // behind everything else.
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('x', String(minX));
  bg.setAttribute('y', String(minY));
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', '#ffffff');
  clone.insertBefore(bg, clone.firstChild);

  const svgString = new XMLSerializer().serializeToString(clone);
  return { svgString, widthPx: width, heightPx: height };
}

/** Walk live + clone trees in parallel; copy live computed styles to
 *  clone inline style. Recursive depth-first. */
function inlineComputedStyles(live: Element, clone: Element): void {
  if (live instanceof SVGElement || live instanceof HTMLElement) {
    const computed = window.getComputedStyle(live);
    const cloneEl = clone as SVGElement | HTMLElement;
    for (const prop of STYLE_PROPS_TO_INLINE) {
      const value = computed.getPropertyValue(prop);
      if (value) cloneEl.style.setProperty(prop, value);
    }
  }
  const liveChildren = live.children;
  const cloneChildren = clone.children;
  // Live and clone are structural mirrors (clone was made via
  // cloneNode(true) before we mutated the clone), but defensive about
  // length mismatch in case a future change reorders children.
  const len = Math.min(liveChildren.length, cloneChildren.length);
  for (let i = 0; i < len; i++) {
    inlineComputedStyles(liveChildren[i], cloneChildren[i]);
  }
}

/** Trigger a browser download of a Blob with the given filename. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Save the canvas as an .svg file. Self-contained (computed styles
 * inlined), framed to the FA's natural extent.
 */
export function exportCanvasAsSVG(
  liveSvg: SVGSVGElement,
  cluster: ClusterBBox,
  filename: string
): void {
  const { svgString } = buildExportSVGString(liveSvg, cluster);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/**
 * Save the canvas as a .png file. Renders the export-prepared SVG to
 * an offscreen canvas at `pixelScale`× the natural size (default 2 for
 * retina-ish output), then encodes as PNG.
 *
 * Returns a promise so callers can show a loading state and surface
 * errors via notifications. The default pixelScale (2) keeps the
 * output crisp on high-DPI screens without exploding file size.
 */
export function exportCanvasAsPNG(
  liveSvg: SVGSVGElement,
  cluster: ClusterBBox,
  filename: string,
  pixelScale: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { svgString, widthPx, heightPx } = buildExportSVGString(liveSvg, cluster);
    // Encode as a UTF-8 data URL. data: URLs avoid cross-origin
    // taint on the canvas (which would block toBlob()).
    const dataUrl =
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(widthPx * pixelScale);
      canvas.height = Math.round(heightPx * pixelScale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'));
          return;
        }
        downloadBlob(blob, filename);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('SVG → Image load failed'));
    img.src = dataUrl;
  });
}
