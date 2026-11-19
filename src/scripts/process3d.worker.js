import { createProcessScene } from './process3d.js';

let scene = null;
const queued = [];

self.addEventListener('message', async ({ data: m }) => {
  if (m.type === 'init') {
    try {
      scene = await createProcessScene(m.canvas, {
        ...m.opts,
        onNotes: (pos, alpha) => self.postMessage({ type: 'notes', pos, alpha }),
      });
      queued.splice(0).forEach(run);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err?.message || err) });
    }
    return;
  }
  if (scene) run(m);
  else queued.push(m);
});

function run(m) {
  if (m.type === 'setProgress') scene.setProgress(m.p);
  else if (m.type === 'setSize') scene.setSize(m.w, m.h);
  else if (m.type === 'start') scene.start();
  else if (m.type === 'stop') scene.stop();
}
