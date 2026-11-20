// Fixed scenes for screenshots, chosen by `?shot=`:
//   ?shot=cover   the sheet alone, filling the window (the app's own exported art)
//   ?shot=editor  the whole studio, with photos already loaded and the rail in sync
//   ?shot=raw     the sheet alone at its native size, no window fitting (used for export tests)
//
// `photos` is a comma-separated list of names under samples/ (no extension), and `caption`,
// `kicker`, `credit`, `layout`, `size`, `grade` set the scene. Once the sheet is painted the app
// sets window.__shotReady, so a headless capture can wait for it instead of guessing.

const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

function samplePath(name) {
  const key = String(name || '').trim();
  return SAMPLES[key] ?? `samples/${key}.jpg`;
}

/** Puts the rail back in sync with a scene the query params just overwrote. */
function syncControls(state, app) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  set('caption', state.caption);
  set('kicker', state.kicker);
  set('credit', state.credit);
  set('zoom', state.slots[state.selected]?.zoom ?? 1);

  document.querySelectorAll('.layout').forEach((card) => {
    card.classList.toggle('active', card.dataset.id === state.layoutId);
  });
  document.querySelectorAll('.size').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.id === state.sizeId);
  });
  app.syncThumbs?.();
}

export async function runShot(shot, query, app) {
  const { state, render, syncSlots, takePhoto } = app;

  if (query.get('layout')) state.layoutId = query.get('layout');
  if (query.get('size')) state.sizeId = query.get('size');
  if (query.get('caption')) state.caption = query.get('caption');
  if (query.get('kicker')) state.kicker = query.get('kicker');
  if (query.get('credit')) state.credit = query.get('credit');
  if (query.get('grade')) state.grade = Number(query.get('grade'));

  const list = (query.get('photos') || query.get('photo') || 'pier')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const name of list) await takePhoto(samplePath(name), name);

  // one photo fills every panel; several spread across them in order
  syncSlots();
  if (state.photos.length === 1) {
    state.slots.forEach((s) => { s.photoIndex = 0; });
  } else {
    state.slots.forEach((s, i) => { s.photoIndex = i % state.photos.length; });
  }

  if (shot === 'cover' || shot === 'raw') {
    document.body.classList.add('shot-cover');
  }
  if (shot === 'editor') {
    document.body.classList.add('shot-editor');
  }

  render();
  syncControls(state, app);

  // two frames: one for layout, one for the canvas paint to land
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (document.fonts?.ready) await document.fonts.ready;
  render();
  await new Promise((r) => requestAnimationFrame(r));
  window.__shotReady = true;
}
