// Turns a layout template plus an output size into pixels: panel rectangles, gutter, the
// headline band and the frame. Kept apart from render.js so the editor can hit-test the same
// rectangles the renderer paints.

const SIZES = [
  { id: 'square', label: 'Square', w: 1080, h: 1080, note: '1080 × 1080' },
  { id: 'portrait', label: 'Portrait', w: 1080, h: 1350, note: '1080 × 1350' },
  { id: 'wide', label: 'Landscape', w: 1920, h: 1080, note: '1920 × 1080' },
];

export function getSize(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

export { SIZES };

/** Band height as a share of the sheet: a wide sheet gets a slightly deeper slab. */
function bandShare(W, H) {
  const ratio = W / H;
  if (ratio > 1.35) return 0.285;
  if (ratio < 0.9) return 0.295;
  return 0.30;
}

/**
 * Geometry for one render.
 * Returns { W, H, unit, frame, gutter, bandH, bandY, panels: [{x,y,w,h,index}] }.
 */
export function compose(template, W, H) {
  const unit = Math.min(W, H);
  const frame = Math.round(unit * 0.021);
  const gutter = Math.max(2, Math.round(unit * 0.0055));
  const bandH = Math.round(H * bandShare(W, H));
  const bandY = H - bandH;

  const areaX = frame;
  const areaY = frame;
  const areaW = W - frame * 2;
  const areaH = bandY - frame * 1.15;

  const panels = template.panels().map((p, index) => {
    const x = areaX + p.x * areaW;
    const y = areaY + p.y * areaH;
    const w = p.w * areaW;
    const h = p.h * areaH;
    const half = gutter / 2;
    return {
      x: Math.round(x + (p.x > 0 ? half : 0)),
      y: Math.round(y + (p.y > 0 ? half : 0)),
      w: Math.round(w - (p.x > 0 ? half : 0) - (p.x + p.w < 0.999 ? half : 0)),
      h: Math.round(h - (p.y > 0 ? half : 0) - (p.y + p.h < 0.999 ? half : 0)),
      index,
      template: p,
    };
  });

  return { W, H, unit, frame, gutter, bandH, bandY, panels };
}

/** Which panel holds a point, in output pixels. */
export function panelAt(geo, x, y) {
  for (let i = geo.panels.length - 1; i >= 0; i -= 1) {
    const p = geo.panels[i];
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return p;
  }
  return null;
}
