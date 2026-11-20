// The collage renderer: paints a cover at any output size onto a 2D context.
//
// Everything is vector work — crops, gutters, the sunset grade, halftone and grain are all
// generated here on the canvas. No image is fetched and no font file is loaded; the only
// pixels from outside are the user's own photos.
//
// The look is built in layers, bottom up:
//   1. the ink under everything, so gutters read as printed board, not as gaps
//   2. one panel per template slot, each a cover-fit crop of a photo with its own pan and zoom
//   3. a per-panel grade: warm sky wash, cool shadow lift, a soft vertical band of glare
//   4. gutters drawn as bright edges — a hairline of light then a shadow, like cut card
//   5. the headline band, its rule, the caption lettering and the credit line
//   6. grain and a vignette over the whole sheet, which binds the panels into one print

import { drawCaption, drawKicker } from './lettering.js';

const INK = '#160818';
const BAND_TOP = '#2a0b23';
const BAND_BOT = '#0d0410';

/** A tiny tiled noise canvas, built once and reused as a pattern for the grain pass. */
let noisePattern = null;
function grainPattern(ctx) {
  if (noisePattern) return noisePattern;
  const tile = document.createElement('canvas');
  tile.width = 180;
  tile.height = 180;
  const tctx = tile.getContext('2d');
  const data = tctx.createImageData(tile.width, tile.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 210;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  tctx.putImageData(data, 0, 0);
  noisePattern = ctx.createPattern(tile, 'repeat');
  return noisePattern;
}

/** Halftone dots, tiled, for the band and the glare strip. */
let dotPattern = null;
function halftonePattern(ctx, size) {
  if (dotPattern) return dotPattern;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 24;
  const tctx = tile.getContext('2d');
  tctx.fillStyle = '#000';
  tctx.beginPath();
  tctx.arc(6, 6, 2.1, 0, Math.PI * 2);
  tctx.arc(18, 18, 2.1, 0, Math.PI * 2);
  tctx.fill();
  dotPattern = ctx.createPattern(tile, 'repeat');
  return dotPattern;
}

/** How much room a photo has to slide inside a panel, at a given zoom. Shared with the editor's drag. */
export function panelSlack(panel, photo, zoom) {
  if (!photo) return { slackX: 0, slackY: 0 };
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const s = Math.max(panel.w / iw, panel.h / ih) * (zoom || 1);
  return { slackX: Math.max(0, iw * s - panel.w), slackY: Math.max(0, ih * s - panel.h) };
}

/**
 * Draws one photo into a panel rectangle, cover-fit, with the panel's pan and zoom applied.
 * focus/focusY: 0..1 within the slack, zoom: 1..3 multiplier on the cover scale.
 */
function drawPanelPhoto(ctx, panel, slot, photo) {
  const { x, y, w, h } = panel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#2a1330';
  ctx.fillRect(x, y, w, h);
  if (photo) {
    const iw = photo.naturalWidth || photo.width;
    const ih = photo.naturalHeight || photo.height;
    const zoom = slot?.zoom ?? 1.08;
    const base = Math.max(w / iw, h / ih);
    const s = base * zoom;
    const dw = iw * s;
    const dh = ih * s;
    const slackX = Math.max(0, dw - w);
    const slackY = Math.max(0, dh - h);
    const fx = slot?.focusX ?? 0.5;
    const fy = slot?.focusY ?? 0.42;
    const dx = x - slackX * fx;
    const dy = y - slackY * fy;
    ctx.filter = 'saturate(1.5) contrast(1.12) brightness(0.99)';
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';

    // a dark warm multiply at the edges pulls the eye to the face and deepens the shadows, the way
    // a printed poster's ink sits heavier towards the trim
    const edge = ctx.createRadialGradient(
      x + w * 0.5, y + h * 0.40, Math.min(w, h) * 0.12,
      x + w * 0.5, y + h * 0.40, Math.max(w, h) * 0.78,
    );
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(0.62, 'rgba(120,30,70,0.10)');
    edge.addColorStop(1, 'rgba(38,4,44,0.48)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** Warm sunset wash on the upper half, cool plum in the lower, per panel. */
function gradePanel(ctx, panel, strength) {
  const { x, y, w, h } = panel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // the sunset printed over the photo: a hot orange sky, magenta through the middle, deep plum at
  // the foot. Overlay keeps the photo's own light and shadow while pushing every hue towards the
  // poster's palette, so skin stays alive and the water keeps its teal.
  const hue = ctx.createLinearGradient(x, y, x + w * 0.10, y + h);
  hue.addColorStop(0, `rgba(255,128,44,${0.62 * strength})`);
  hue.addColorStop(0.34, `rgba(255,96,120,${0.44 * strength})`);
  hue.addColorStop(0.68, `rgba(150,52,160,${0.46 * strength})`);
  hue.addColorStop(1, `rgba(52,20,110,${0.60 * strength})`);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = hue;
  ctx.fillRect(x, y, w, h);

  // and a second, lighter pass in colour mode to unify the hues without moving the tones
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.22 * strength;
  ctx.fillStyle = hue;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;

  const lift = ctx.createLinearGradient(x, y, x, y + h);
  lift.addColorStop(0, `rgba(255,168,96,${0.22 * strength})`);
  lift.addColorStop(0.42, 'rgba(255,120,130,0)');
  lift.addColorStop(1, `rgba(40,16,96,${0.34 * strength})`);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = lift;
  ctx.fillRect(x, y, w, h);

  // split-tone: teal lifted into the shadows, so the warm sky has something cold to sit against
  const cool = ctx.createLinearGradient(x, y + h * 0.46, x, y + h);
  cool.addColorStop(0, 'rgba(40,180,200,0)');
  cool.addColorStop(1, `rgba(34,168,196,${0.20 * strength})`);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = cool;
  ctx.fillRect(x, y, w, h);

  // the sun: a soft bloom high in the frame
  const glow = ctx.createRadialGradient(
    x + w * 0.58, y + h * 0.16, 0,
    x + w * 0.58, y + h * 0.16, Math.max(w, h) * 0.70,
  );
  glow.addColorStop(0, `rgba(255,206,132,${0.34 * strength})`);
  glow.addColorStop(0.30, `rgba(255,120,110,${0.16 * strength})`);
  glow.addColorStop(1, 'rgba(24,0,36,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);

  // a narrow glare band across the panel, like light catching a glossy print
  const glare = ctx.createLinearGradient(x, y + h * 0.62, x + w, y + h * 0.38);
  glare.addColorStop(0, 'rgba(255,160,90,0)');
  glare.addColorStop(0.46, `rgba(255,196,128,${0.18 * strength})`);
  glare.addColorStop(0.54, `rgba(255,120,170,${0.13 * strength})`);
  glare.addColorStop(1, 'rgba(255,160,90,0)');
  ctx.fillStyle = glare;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** Gutter hairlines: light on the top/left of each panel, shadow on the bottom/right. */
function drawGutters(ctx, panels, gutter, unit) {
  const hair = Math.max(1, unit * 0.0016);
  panels.forEach((p) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,180,120,0.30)';
    ctx.lineWidth = hair;
    ctx.strokeRect(p.x + hair / 2, p.y + hair / 2, p.w - hair, p.h - hair);
    ctx.strokeStyle = 'rgba(8,0,12,0.55)';
    ctx.lineWidth = hair * 2.2;
    ctx.beginPath();
    ctx.moveTo(p.x + hair, p.y + p.h - hair * 2);
    ctx.lineTo(p.x + p.w - hair, p.y + p.h - hair * 2);
    ctx.moveTo(p.x + p.w - hair * 2, p.y + hair);
    ctx.lineTo(p.x + p.w - hair * 2, p.y + p.h - hair);
    ctx.stroke();
    ctx.restore();
  });
  void gutter;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The little print stamp in the top corners: volume and sheet size, in tracked caps. */
function drawStamps(ctx, o, W, H, unit) {
  const pad = unit * 0.028;
  const size = Math.max(8, unit * 0.0155);
  drawKicker(ctx, o.stampLeft || 'VICE EDITION', pad, pad + size, size, 'rgba(255,226,190,0.86)', 'left', 0.28);
  drawKicker(ctx, o.stampRight || 'No. 06', W - pad, pad + size, size, 'rgba(255,226,190,0.86)', 'right', 0.28);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,226,190,0.34)';
  ctx.lineWidth = Math.max(1, unit * 0.0012);
  ctx.beginPath();
  ctx.moveTo(pad, pad + size * 1.9);
  ctx.lineTo(pad + unit * 0.10, pad + size * 1.9);
  ctx.moveTo(W - pad - unit * 0.10, pad + size * 1.9);
  ctx.lineTo(W - pad, pad + size * 1.9);
  ctx.stroke();
  ctx.restore();
}

/**
 * Paints a whole cover.
 * o = { W, H, unit, panels: [{x,y,w,h}], slots: [{photoIndex, focus, focusY, zoom}],
 *       photos: [Image], caption, kicker, credit, grade, grain, showBand }
 */
export function renderCover(ctx, o) {
  const { W, H } = o;
  const unit = Math.min(W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  const panels = o.panels;
  const slots = o.slots;
  panels.forEach((p, i) => {
    const slot = slots[i % Math.max(1, slots.length)] || slots[0];
    const photo = o.photos[slot?.photoIndex ?? 0] ?? o.photos[0] ?? null;
    drawPanelPhoto(ctx, p, slot, photo);
    gradePanel(ctx, p, o.grade ?? 1);
  });

  drawGutters(ctx, panels, o.gutter ?? 1, unit);
  drawStamps(ctx, o, W, H, unit);

  if (o.showBand !== false) {
    const bandH = o.bandH;
    const bandY = H - bandH;

    // the headline slab: a deep plum that darkens to black at the foot
    const slab = ctx.createLinearGradient(0, bandY, 0, H);
    slab.addColorStop(0, BAND_TOP);
    slab.addColorStop(0.55, '#1a0719');
    slab.addColorStop(1, BAND_BOT);
    ctx.fillStyle = slab;
    ctx.fillRect(0, bandY, W, bandH);

    // halftone tooth across the slab, faint, so the flat fill does not look plastic
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = halftonePattern(ctx, unit);
    ctx.fillRect(0, bandY, W, bandH);
    ctx.restore();

    // the hot rule on top of the band, doubled: a bright line and its bloom
    const rule = ctx.createLinearGradient(0, 0, W, 0);
    rule.addColorStop(0, '#ff6b3d');
    rule.addColorStop(0.34, '#ffd166');
    rule.addColorStop(0.66, '#ff5a8a');
    rule.addColorStop(1, '#8e4bff');
    ctx.fillStyle = rule;
    ctx.fillRect(0, bandY - unit * 0.0035, W, unit * 0.0035);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bloom = ctx.createLinearGradient(0, bandY, 0, bandY + unit * 0.07);
    bloom.addColorStop(0, 'rgba(255,140,90,0.30)');
    bloom.addColorStop(1, 'rgba(255,140,90,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, bandY, W, unit * 0.07);
    ctx.restore();

    // caption, then a credit line beneath it
    const sidePad = unit * 0.055;
    const creditH = unit * 0.044;
    const capBox = {
      x: sidePad,
      y: bandY + unit * 0.020,
      w: W - sidePad * 2,
      h: bandH - unit * 0.020 - creditH,
    };
    drawCaption(ctx, o.caption, capBox, {
      rim: o.rim ?? '#ff3f74',
      key: o.key ?? '#14030f',
      fillA: o.fillA ?? '#fff8e2',
      fillB: o.fillB ?? '#ffb43c',
      condense: 0.80,
      skew: -0.06,
      lead: 0.02,
    });

    const credits = [o.kicker || '', o.credit || ''].filter(Boolean).join('   ·   ');
    if (credits) {
      drawKicker(ctx, credits, W / 2, H - creditH * 0.62, Math.max(7, unit * 0.0145), 'rgba(255,222,196,0.78)', 'center', 0.24);
    }
  }

  // grain: overlay noise keeps the flat gradients from banding and ties panels together
  if ((o.grain ?? 1) > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16 * (o.grain ?? 1);
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // vignette, then a warm bloom in the top third
  const vig = ctx.createRadialGradient(W / 2, H * 0.46, unit * 0.22, W / 2, H * 0.46, unit * 0.92);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10,0,14,0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();
}

/** A rounded chip used by the editor overlay (kept here so the editor draws in one place). */
export function drawChip(ctx, x, y, w, h, fill, radius = 8) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}
