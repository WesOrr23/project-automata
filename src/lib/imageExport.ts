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

/** Padding (in user-space units) added around the visible content
 *  bbox so exported content isn't flush against the canvas edge. */
const EXPORT_PADDING = 32;

export type ExportOptions = {
  /** When true, omit the white background rect — the file (PNG or
   *  SVG) renders with transparent areas wherever the FA isn't
   *  drawn. Default: false (white background). */
  transparent?: boolean;
};

/**
 * Build a self-contained SVG string ready for either direct download
 * or rendering into a canvas for PNG conversion. Frames around the
 * inner content group's actual bounding box (which includes states,
 * edges, edge labels, and the start arrow) so self-loops or labels
 * that protrude beyond the cluster bbox don't clip and don't make
 * the FA look off-center in the export.
 */
export function buildExportSVGString(
  liveSvg: SVGSVGElement,
  options: ExportOptions = {}
): { svgString: string; widthPx: number; heightPx: number } {
  // Measure FIRST on the live SVG (clone's getBBox is unreliable
  // until the clone is in the document). The inner content group is
  // the first <g> child that contains the FA — its getBBox returns
  // the union of every visible descendant. We measure on the
  // OUTERMOST transformed group ancestor of the FA so the bbox is
  // already in the SVG's outer coordinate space (no need to add
  // back the inner translate).
  const liveContentGroup = findContentGroup(liveSvg);
  if (!liveContentGroup) {
    throw new Error('Could not locate canvas content group for export');
  }
  // We need a bbox in the coordinate space the export viewBox uses —
  // i.e. the outer-group coords AFTER the pan/zoom transform is
  // stripped. Trick: temporarily clear the transform on the live
  // group, measure, restore. This only works because we're measuring
  // synchronously on the live DOM and the user can't perceive a
  // single-frame transform flicker (we restore before any paint).
  const savedTransform = liveContentGroup.getAttribute('transform');
  if (savedTransform !== null) liveContentGroup.removeAttribute('transform');
  const liveBBox = (liveContentGroup as SVGGraphicsElement).getBBox();
  if (savedTransform !== null) liveContentGroup.setAttribute('transform', savedTransform);

  const clone = liveSvg.cloneNode(true) as SVGSVGElement;

  // Reset the content group's transform so the export is at 1:1
  // scale, regardless of current pan/zoom.
  const outerGroups = clone.querySelectorAll(':scope > g[transform]');
  outerGroups.forEach((g) => g.removeAttribute('transform'));

  // Strip debug-overlay shapes (red dot + blue ring) — they're
  // toggleable in the live UI but never wanted in an export.
  const debugCircles = clone.querySelectorAll(
    'circle[fill="#ef4444"], circle[stroke="#3b82f6"]'
  );
  debugCircles.forEach((el) => el.remove());

  // Inline computed styles so the standalone file doesn't depend on
  // the document's stylesheets for fill/stroke/font.
  inlineComputedStyles(liveSvg, clone);

  // Frame: live bbox of the content group + symmetric padding on
  // every side. Result: visible content is geometrically centered.
  const minX = liveBBox.x - EXPORT_PADDING;
  const minY = liveBBox.y - EXPORT_PADDING;
  const width = liveBBox.width + EXPORT_PADDING * 2;
  const height = liveBBox.height + EXPORT_PADDING * 2;

  clone.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // xmlns is required for standalone SVG files (browsers display
  // inline SVG without it, but a saved file won't).
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Background rect (only when not transparent). Inserted as the
  // first child so it sits behind everything else.
  if (!options.transparent) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(minX));
    bg.setAttribute('y', String(minY));
    bg.setAttribute('width', String(width));
    bg.setAttribute('height', String(height));
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);
  }

  const svgString = new XMLSerializer().serializeToString(clone);
  return { svgString, widthPx: width, heightPx: height };
}

/** Find the FIRST <g> child of the SVG — the canvas-content group
 *  that wraps every visible FA element. */
function findContentGroup(svg: SVGSVGElement): SVGGElement | null {
  const child = svg.querySelector(':scope > g');
  return child as SVGGElement | null;
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
    const liveChild = liveChildren[i];
    const cloneChild = cloneChildren[i];
    if (!liveChild || !cloneChild) continue;
    inlineComputedStyles(liveChild, cloneChild);
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
  filename: string,
  options: ExportOptions = {}
): void {
  const { svgString } = buildExportSVGString(liveSvg, options);
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
  filename: string,
  options: ExportOptions = {},
  pixelScale: number = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { svgString, widthPx, heightPx } = buildExportSVGString(liveSvg, options);
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
