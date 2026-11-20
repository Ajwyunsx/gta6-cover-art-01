// The editor: state, the live preview, panel dragging and the PNG export.
//
// The page is one canvas for art and one canvas laid over it for handles, both sized to the
// output pixels and scaled down by CSS, so what is on screen is exactly what gets exported.
// A `?shot=` query drives a fixed scene for the screenshots (./shots.js).

import { LAYOUTS, getLayout } from './layouts.js';
import { SIZES, getSize, compose, panelAt } from './compose.js';
import { renderCover, panelSlack } from './render.js';
import { runShot } from './shots.js';

const preview = document.getElementById('preview');
const overlay = document.getElementById('overlay');
const pctx = preview.getContext('2d');
const octx = overlay.getContext('2d');

const state = {
  layoutId: 'strips3',
  sizeId: 'square',
  caption: 'SUNSET HEIST',
  kicker: 'A city that never sleeps',
  credit: 'Shot on 35mm',
  grade: 1,
  grain: 1,
  photos: [],
  slots: [],
  selected: -1,
};

/** A photo record: an Image plus a thumbnail URL and the file's own name. */
function addPhoto(img, name, thumb) {
  state.photos.push({ img, name, thumb });
  return state.photos.length - 1;
}

function template() {
  return getLayout(state.layoutId);
}

/** Rebuilds the slot table for the current layout, keeping earlier crops where panels overlap. */
function syncSlots() {
  const panels = template().panels();
  const next = panels.map((p, i) => {
    const prev = state.slots[i];
    return {
      photoIndex: prev?.photoIndex ?? i % Math.max(1, state.photos.length),
      focusX: prev?.focusX ?? p.focusX,
      focusY: prev?.focusY ?? p.focusY,
      zoom: prev?.zoom ?? p.zoom,
    };
  });
  state.slots = next;
  if (state.selected >= next.length) state.selected = next.length - 1;
}

function geometry() {
  const size = getSize(state.sizeId);
  return compose(template(), size.w, size.h);
}

/** Sizes the two canvases on screen: the sheet keeps its aspect and fits the frame's box. */
function fitToFrame() {
  if (document.body.classList.contains('shot-cover')) {
    preview.style.width = '';
    preview.style.height = '';
    overlay.style.width = '';
    overlay.style.height = '';
    return;
  }
  const frame = document.getElementById('frame');
  const pad = 40;
  const availW = Math.max(160, frame.clientWidth - pad);
  const availH = Math.max(160, frame.clientHeight - pad);
  const aspect = preview.width / preview.height;
  let w = availW;
  let h = w / aspect;
  if (h > availH) {
    h = availH;
    w = h * aspect;
  }
  preview.style.width = `${Math.round(w)}px`;
  preview.style.height = `${Math.round(h)}px`;
  overlay.style.width = `${Math.round(w)}px`;
  overlay.style.height = `${Math.round(h)}px`;
}

let geo = geometry();

function render() {
  const size = getSize(state.sizeId);
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = overlay.width = size.w;
    preview.height = overlay.height = size.h;
  }
  geo = compose(template(), size.w, size.h);
  renderCover(pctx, {
    W: geo.W,
    H: geo.H,
    unit: geo.unit,
    panels: geo.panels,
    bandH: geo.bandH,
    slots: state.slots,
    photos: state.photos.map((p) => p.img),
    caption: state.caption,
    kicker: state.kicker,
    credit: state.credit,
    grade: state.grade,
    grain: state.grain,
    stampLeft: 'SUNSET EDITION',
    stampRight: 'VOL. 06',
  });
  drawHandles();
  fitToFrame();
  document.getElementById('layoutLabel').textContent = template().name;
  document.getElementById('sizeLabel').textContent = `${size.w} × ${size.h}`;
  document.getElementById('panelLabel').textContent =
    state.selected >= 0 ? `Panel ${state.selected + 1} selected` : state.photos.length ? 'Drag any panel to reposition' : 'No panel selected';
  const zoomer = document.getElementById('zoomer');
  zoomer.classList.toggle('on', state.selected >= 0 && state.photos.length > 0);
  if (state.selected >= 0 && state.slots[state.selected]) {
    document.getElementById('zoom').value = state.slots[state.selected].zoom;
  }
  syncThumbs();
}

/** Draws the selection hairline and the panel numbers on the overlay canvas. */
function drawHandles() {
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const unit = geo.unit;
  geo.panels.forEach((p, i) => {
    const slot = state.slots[i];
    const active = i === state.selected;
    octx.save();
    octx.strokeStyle = active ? 'rgba(255,194,71,0.95)' : 'rgba(255,240,225,0.16)';
    octx.lineWidth = active ? Math.max(2, unit * 0.005) : Math.max(1, unit * 0.0018);
    octx.setLineDash(active ? [] : [unit * 0.016, unit * 0.012]);
    octx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    octx.setLineDash([]);

    const label = String(i + 1);
    const r = Math.max(11, unit * 0.0175);
    const cx = p.x + r + unit * 0.012;
    const cy = p.y + p.h - r - unit * 0.012;
    octx.beginPath();
    octx.arc(cx, cy, r, 0, Math.PI * 2);
    octx.fillStyle = active ? 'rgba(255,194,71,0.96)' : 'rgba(12,5,16,0.62)';
    octx.fill();
    octx.strokeStyle = active ? 'rgba(30,10,4,0.6)' : 'rgba(255,235,215,0.4)';
    octx.lineWidth = Math.max(1, unit * 0.0014);
    octx.stroke();
    octx.fillStyle = active ? '#2a0f05' : 'rgba(255,236,218,0.85)';
    octx.font = `800 ${r * 1.15}px "Liberation Sans Narrow", "Arial Narrow", system-ui, sans-serif`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(label, cx, cy + r * 0.04);
    if (slot) {
      octx.font = `600 ${r * 0.78}px "Inter", system-ui, sans-serif`;
      octx.textAlign = 'left';
      octx.fillStyle = 'rgba(255,236,218,0.55)';
      octx.fillText(`photo ${slot.photoIndex + 1}`, cx + r * 1.4, cy + r * 0.04);
    }
    octx.restore();
  });
}

/* ── rail: thumbnails ─────────────────────────────────────────────── */

let thumbEls = [];

function syncThumbs() {
  const wrap = document.getElementById('thumbs');
  state.photos.forEach((p, i) => {
    let el = thumbEls[i];
    if (!el) {
      el = document.createElement('div');
      el.className = 'thumb';
      el.innerHTML = '<img alt=""><span class="n"></span><button class="kill" type="button" title="Remove photo">×</button>';
      wrap.appendChild(el);
      thumbEls[i] = el;
    }
    const img = el.querySelector('img');
    if (img.getAttribute('src') !== p.thumb) img.src = p.thumb;
    el.querySelector('.n').textContent = String(i + 1);
    const slot = state.selected >= 0 ? state.slots[state.selected] : null;
    el.classList.toggle('active', !!slot && slot.photoIndex === i);
    el.dataset.index = String(i);
  });
}

document.getElementById('thumbs').addEventListener('click', (e) => {
  const kill = e.target.closest('.kill');
  const thumb = e.target.closest('.thumb');
  if (!thumb) return;
  const index = Number(thumb.dataset.index);
  if (kill) {
    removePhoto(index);
    return;
  }
  if (state.selected >= 0 && state.slots[state.selected]) {
    state.slots[state.selected].photoIndex = index;
    render();
  } else if (state.photos.length) {
    state.slots.forEach((s) => { s.photoIndex = index; });
    render();
  }
});

function removePhoto(index) {
  if (state.photos.length <= 0) return;
  URL.revokeObjectURL(state.photos[index].thumb);
  state.photos.splice(index, 1);
  state.slots.forEach((s) => {
    if (s.photoIndex > index) s.photoIndex -= 1;
    if (s.photoIndex >= state.photos.length) s.photoIndex = Math.max(0, state.photos.length - 1);
  });
  const el = thumbEls.splice(index, 1)[0];
  if (el) el.remove();
  thumbEls = [];
  document.getElementById('thumbs').innerHTML = '';
  render();
}

/* ── rail: layout cards ───────────────────────────────────────────── */

function buildLayoutCards() {
  const wrap = document.getElementById('layouts');
  wrap.innerHTML = '';
  LAYOUTS.forEach((l) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'layout' + (l.id === state.layoutId ? ' active' : '');
    card.title = l.hint;
    card.dataset.id = l.id;
    const rects = l.panels().map((p) =>
      `<rect x="${(p.x * 100 + 1.2).toFixed(2)}" y="${(p.y * 26 + 1.2).toFixed(2)}" width="${(p.w * 100 - 2.4).toFixed(2)}" height="${(p.h * 26 - 2.4).toFixed(2)}" rx="1"/>`,
    ).join('');
    card.innerHTML = `<svg viewBox="0 0 100 26" preserveAspectRatio="none">${rects}</svg><span>${l.name}</span>`;
    wrap.appendChild(card);
  });
}

document.getElementById('layouts').addEventListener('click', (e) => {
  const card = e.target.closest('.layout');
  if (!card) return;
  state.layoutId = card.dataset.id;
  document.querySelectorAll('.layout').forEach((c) => c.classList.toggle('active', c === card));
  syncSlots();
  render();
});

function buildSizeCards() {
  const wrap = document.getElementById('sizes');
  wrap.innerHTML = '';
  SIZES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size' + (s.id === state.sizeId ? ' active' : '');
    btn.dataset.id = s.id;
    const maxSide = 18;
    const w = Math.round((s.w / Math.max(s.w, s.h)) * maxSide);
    const h = Math.round((s.h / Math.max(s.w, s.h)) * maxSide);
    btn.innerHTML = `<i style="width:${w}px;height:${h}px"></i><span>${s.label}</span>`;
    btn.title = s.note;
    wrap.appendChild(btn);
  });
}

document.getElementById('sizes').addEventListener('click', (e) => {
  const btn = e.target.closest('.size');
  if (!btn) return;
  state.sizeId = btn.dataset.id;
  document.querySelectorAll('.size').forEach((b) => b.classList.toggle('active', b === btn));
  render();
});

/* ── dragging on the sheet ────────────────────────────────────────── */

let drag = null;

function canvasPoint(e) {
  const rect = overlay.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * overlay.width;
  const y = ((e.clientY - rect.top) / rect.height) * overlay.height;
  return { x, y, scale: overlay.width / rect.width };
}

overlay.addEventListener('pointerdown', (e) => {
  if (!state.photos.length) return;
  const p = canvasPoint(e);
  const panel = panelAt(geo, p.x, p.y);
  if (!panel) return;
  state.selected = panel.index;
  const slot = state.slots[panel.index];
  const photo = state.photos[slot.photoIndex]?.img;
  const slack = panelSlack(geo.panels[panel.index], photo, slot.zoom);
  drag = { panel: panel.index, x: e.clientX, y: e.clientY, fx: slot.focusX, fy: slot.focusY, slack, scale: p.scale };
  overlay.setPointerCapture(e.pointerId);
  overlay.classList.add('dragging');
  render();
});

overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const slot = state.slots[drag.panel];
  const dx = (e.clientX - drag.x) * drag.scale;
  const dy = (e.clientY - drag.y) * drag.scale;
  if (drag.slack.slackX > 0) slot.focusX = clamp(drag.fx - dx / drag.slack.slackX, 0, 1);
  if (drag.slack.slackY > 0) slot.focusY = clamp(drag.fy - dy / drag.slack.slackY, 0, 1);
  render();
});

function endDrag(e) {
  if (!drag) return;
  drag = null;
  overlay.classList.remove('dragging');
  try { overlay.releasePointerCapture(e.pointerId); } catch { /* already released */ }
}
overlay.addEventListener('pointerup', endDrag);
overlay.addEventListener('pointercancel', endDrag);

overlay.addEventListener('wheel', (e) => {
  if (!state.photos.length) return;
  const p = canvasPoint(e);
  const panel = panelAt(geo, p.x, p.y);
  if (!panel) return;
  e.preventDefault();
  state.selected = panel.index;
  const slot = state.slots[panel.index];
  slot.zoom = clamp(slot.zoom + (e.deltaY > 0 ? -0.06 : 0.06), 1, 2.6);
  render();
}, { passive: false });

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ── rail: sliders and fields ─────────────────────────────────────── */

document.getElementById('grade').addEventListener('input', (e) => {
  state.grade = Number(e.target.value);
  render();
});
document.getElementById('grain').addEventListener('input', (e) => {
  state.grain = Number(e.target.value);
  render();
});
document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  render();
});
document.getElementById('kicker').addEventListener('input', (e) => {
  state.kicker = e.target.value;
  render();
});
document.getElementById('credit').addEventListener('input', (e) => {
  state.credit = e.target.value;
  render();
});
document.getElementById('zoom').addEventListener('input', (e) => {
  if (state.selected < 0) return;
  state.slots[state.selected].zoom = Number(e.target.value);
  render();
});
document.getElementById('fit').addEventListener('click', () => {
  if (state.selected < 0) return;
  const t = template().panels()[state.selected];
  if (!t) return;
  Object.assign(state.slots[state.selected], { focusX: t.focusX, focusY: t.focusY, zoom: t.zoom });
  render();
});

document.getElementById('shuffle').addEventListener('click', () => {
  if (!state.photos.length) return;
  const count = state.photos.length;
  state.slots.forEach((s) => {
    s.photoIndex = Math.floor(Math.random() * count);
    s.focusX = 0.28 + Math.random() * 0.44;
    s.focusY = 0.3 + Math.random() * 0.28;
  });
  render();
});

/* ── photos in ────────────────────────────────────────────────────── */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not read ${src}`));
    img.src = src;
  });
}

async function takeFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const index = addPhoto(img, file.name, url);
  if (state.photos.length === 1) {
    state.slots.forEach((s) => { s.photoIndex = 0; });
  } else if (state.selected >= 0) {
    state.slots[state.selected].photoIndex = index;
  }
  render();
  return index;
}

const input = document.getElementById('photo');
input.addEventListener('change', async (e) => {
  const files = [...(e.target.files ?? [])];
  setStatus(files.length > 1 ? `Reading ${files.length} photos…` : 'Reading photo…');
  for (const file of files) {
    try {
      await takeFile(file);
    } catch (err) {
      setStatus(String(err.message ?? err));
    }
  }
  setStatus(files.length ? `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded. Drag a panel to reposition.` : 'Ready.');
  input.value = '';
});

const drop = document.getElementById('drop');
['dragenter', 'dragover'].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', async (e) => {
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  for (const file of files) await takeFile(file);
  if (files.length) setStatus(`${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded.`);
});

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

/* ── export ───────────────────────────────────────────────────────── */

const EXPORT_NAMES = { square: '1080x1080', portrait: '1080x1350', wide: '1920x1080' };

function exportPng() {
  const size = getSize(state.sizeId);
  setStatus('Rendering PNG…');
  preview.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again.');
      return;
    }
    const name = `neon-six-cover-${EXPORT_NAMES[state.sizeId] ?? `${size.w}x${size.h}`}.png`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setStatus(`Saved ${name} · ${Math.round(blob.size / 1024)} KB`);
  }, 'image/png');
}

document.getElementById('export').addEventListener('click', exportPng);

/* ── boot ─────────────────────────────────────────────────────────── */

window.addEventListener('resize', fitToFrame);

buildLayoutCards();
buildSizeCards();
syncSlots();
render();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, {
    state,
    render,
    syncSlots,
    takePhoto: async (url, name) => {
      const img = await loadImage(url);
      return addPhoto(img, name || url.split('/').pop(), url);
    },
  }).catch((err) => {
    setStatus(String(err?.message ?? err));
    window.__shotReady = true;
  });
}

// expose a couple of handles for the screenshot driver, nothing else reads them
window.neonSix = { state, render, exportPng, loadImage, addPhoto, syncSlots };
