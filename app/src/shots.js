// Fixed scenes for screenshots, chosen by `?shot=`:
//   ?shot=cover   the sheet alone, filling the window (the app's own exported art)
//   ?shot=editor  the whole studio with one or two photos loaded
// `photo` names a file under samples/ (no extension), `photos` a comma-separated list,
// `caption`, `kicker`, `credit`, `layout` and `size` set the scene. The app sets
// window.__shotReady once the sheet is painted, so a headless capture can wait on it.

const SAMPLES = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

function samplePath(name) {
  const key = String(name || '').trim();
  if (SAMPLES[key]) return SAMPLES[key];
  return `samples/${key}.jpg`;
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

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    document.getElementById('caption').value = state.caption;
    document.getElementById('kicker').value = state.kicker;
    document.getElementById('credit').value = state.credit;
  }

  render();
  // two frames: one for layout, one for the canvas paint to land
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.__shotReady = true;
}
