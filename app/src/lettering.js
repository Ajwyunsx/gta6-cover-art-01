// Poster lettering, drawn entirely with the Canvas 2D API.
//
// No font file ships with the app: the face is the machine's own bold narrow sans, which every
// desktop has, and the caption is scaled per line to fill the band edge to edge — that
// flush-width stack is what makes the lettering read as a poster title rather than a headline.
// Each line is painted in five passes: a soft drop shadow, a coloured rim, a dark keyline, a
// vertical two-colour fill, and a glass sheen. That stack gives the chunky screen-printed look.

const FACE =
  '"Liberation Sans Narrow", "Arial Narrow", "Helvetica Neue", "Roboto Condensed", "DejaVu Sans Condensed", system-ui, sans-serif';

/** Splits a caption into at most `maxLines` lines, balancing words, or on an explicit slash. */
export function splitCaption(text, maxLines = 2) {
  const raw = String(text ?? '').trim().toUpperCase();
  if (!raw) return [];
  if (raw.includes('/')) {
    return raw.split('/').map((part) => part.trim()).filter(Boolean).slice(0, Math.max(1, maxLines));
  }
  if (maxLines < 2) return [raw];
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words;
  let best = null;
  for (let i = 1; i < words.length; i += 1) {
    const left = words.slice(0, i).join(' ');
    const right = words.slice(i).join(' ');
    const score = Math.abs(left.length - right.length) + (left.length > 16 || right.length > 16 ? 10 : 0);
    if (!best || score < best.score) best = { lines: [left, right], score };
  }
  return best.lines;
}

const REF = 100;
function setFace(ctx, size) {
  ctx.font = `900 ${size}px ${FACE}`;
  ctx.letterSpacing = `${(size * 0.004).toFixed(2)}px`;
}

function measure(ctx, line, size) {
  setFace(ctx, size);
  const m = ctx.measureText(line);
  return {
    width: m.width,
    asc: m.actualBoundingBoxAscent || size * 0.73,
    desc: m.actualBoundingBoxDescent || size * 0.02,
  };
}

/**
 * Plans the block. One line is preferred: it is sized to fill the box's width, which is what makes
 * the title read as poster lettering. A long caption that would shrink below a comfortable size is
 * split in two, and that stack is then sized to fill the width again. A final pass shrinks the whole
 * stack if it would overflow the box's height.
 */
function plan(ctx, lines, box, condense, lead) {
  const sizes = lines.map((line) => {
    const m = measure(ctx, line, REF);
    const natural = (box.w / Math.max(1, m.width * condense)) * REF;
    return Math.min(natural, box.h * 0.98);
  });
  let total = 0;
  lines.forEach((line, i) => {
    const m = measure(ctx, line, sizes[i]);
    total += m.asc + m.desc;
    if (i) total += sizes[i - 1] * lead;
  });
  if (total > box.h) {
    const k = box.h / total;
    for (let i = 0; i < sizes.length; i += 1) sizes[i] *= k;
    total = box.h;
  }
  return { sizes, total };
}

/** The size a single line would come out at, before any height clamp. */
function singleLineSize(ctx, text, box, condense) {
  const m = measure(ctx, text, REF);
  return (box.w / Math.max(1, m.width * condense)) * REF;
}

function paintLine(ctx, line, size, look) {
  const { condense, skew } = look;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  setFace(ctx, size);

  // 1. the soft shadow, dropped and slightly blurred by a wide translucent stroke
  ctx.save();
  ctx.translate(0, size * 0.06);
  ctx.fillStyle = look.shadow ?? 'rgba(14,3,10,0.42)';
  ctx.fillText(line, 0, 0);
  ctx.restore();

  // 2. the colour rim: a thin halo, just wide enough to read the letters off any background
  ctx.strokeStyle = look.rim;
  ctx.lineWidth = Math.max(1.5, size * 0.135);
  ctx.strokeText(line, 0, 0);

  // 3. the dark keyline that separates the letters from whatever sits behind them
  ctx.strokeStyle = look.key;
  ctx.lineWidth = Math.max(1.2, size * 0.085);
  ctx.strokeText(line, 0, 0);

  // 4. the fill: pale at the crown, hot at the foot
  const fill = ctx.createLinearGradient(0, -size * 0.74, 0, 0);
  fill.addColorStop(0, look.fillA);
  fill.addColorStop(0.52, look.fillA);
  fill.addColorStop(0.78, look.fillB);
  fill.addColorStop(1, look.fillC ?? look.fillB);
  ctx.fillStyle = fill;
  ctx.fillText(line, 0, 0);

  // 5. a glass sheen across the upper third, then shade at the foot
  const sheen = ctx.createLinearGradient(0, -size * 0.74, 0, -size * 0.24);
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillText(line, 0, 0);

  const shade = ctx.createLinearGradient(0, -size * 0.18, 0, size * 0.02);
  shade.addColorStop(0, 'rgba(120,20,0,0)');
  shade.addColorStop(1, 'rgba(120,20,0,0.20)');
  ctx.fillStyle = shade;
  ctx.fillText(line, 0, 0);
}

/**
 * Draws `text` inside `box` as flush-width poster lettering.
 * look: { rim, key, fillA, fillB, condense, skew, lead, shadow }
 * Returns the painted block's height in px.
 */
export function drawCaption(ctx, text, box, look = {}) {
  const opts = {
    rim: '#ffb52e',
    key: '#1b0510',
    fillA: '#fffaf0',
    fillB: '#ffc247',
    fillC: '#ff8a1e',
    condense: 0.94,
    skew: -0.06,
    lead: 0.02,
    maxLines: 2,
    ...look,
  };

  // prefer one flush-width line; split only when a single line would come out small
  const whole = String(text ?? '').trim().toUpperCase();
  let lines;
  if (!whole) return 0;
  if (whole.includes('/')) lines = splitCaption(whole, opts.maxLines);
  else if (opts.maxLines < 2) lines = [whole];
  else lines = singleLineSize(ctx, whole, box, opts.condense) >= box.h * 0.52
    ? [whole]
    : splitCaption(whole, opts.maxLines);

  const { sizes, total } = plan(ctx, lines, box, opts.condense, opts.lead);
  let cursor = box.y + box.h / 2 - total / 2;

  ctx.save();
  ctx.translate(box.x + box.w / 2, 0);
  lines.forEach((line, i) => {
    const size = sizes[i];
    const m = measure(ctx, line, size);
    const baseline = cursor + m.asc;
    cursor += m.asc + m.desc + size * opts.lead;
    ctx.save();
    ctx.translate(0, baseline);
    ctx.transform(opts.condense, 0, opts.skew, 1, 0, 0);
    paintLine(ctx, line, size, opts);
    ctx.restore();
  });
  ctx.restore();
  return total;
}

/** Small tracked-out caps for taglines and credits. Returns the drawn width. */
export function drawKicker(ctx, text, x, y, size, color, alignment = 'center', tracking = 0.3) {
  const raw = String(text ?? '').toUpperCase();
  if (!raw.trim()) return 0;
  ctx.save();
  ctx.font = `700 ${Math.max(6, size)}px ${FACE}`;
  ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = alignment;
  ctx.fillStyle = color;
  const width = ctx.measureText(raw).width;
  ctx.fillText(raw, x, y);
  ctx.restore();
  return width;
}

/** The width drawKicker will paint, without painting it — used to size the stamp chips. */
export function measureKicker(ctx, text, size, tracking = 0.3) {
  const raw = String(text ?? '').toUpperCase();
  if (!raw.trim()) return 0;
  ctx.save();
  ctx.font = `700 ${Math.max(6, size)}px ${FACE}`;
  ctx.letterSpacing = `${(size * tracking).toFixed(2)}px`;
  const width = ctx.measureText(raw).width;
  ctx.restore();
  return width;
}
