import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
document.documentElement.classList.add('js-on');
ScrollTrigger.config({ ignoreMobileResize: true });

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const lenis = new Lenis({ lerp: 0.085, smoothWheel: !reduced });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
if (import.meta.env.DEV) Object.assign(window, { __gsap: gsap, __lenis: lenis, __ST: ScrollTrigger });

const nav = $('[data-nav]');
const html = document.documentElement;
const burger = $('[data-burger]');
const setMenu = (open) => {
  html.classList.toggle('menu-open', open);
  burger?.setAttribute('aria-expanded', String(open));
  if (open) lenis.stop();
  else lenis.start();
};
const closeMenu = () => html.classList.contains('menu-open') && setMenu(false);
burger?.addEventListener('click', () => setMenu(!html.classList.contains('menu-open')));
addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : id.length > 1 ? $(id) : null;
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(target, { duration: 1.8 });
  })
);

ScrollTrigger.create({
  trigger: '[data-foot]',
  start: 'top 85%',
  end: '+=100000',
  toggleClass: { targets: nav, className: 'is-hidden' },
});
const darkSections = $$('[data-tone="dark"]');
let darkRanges = [], navMid = 0, navTone = '';
function measureNavTone() {
  navMid = nav.offsetTop + nav.offsetHeight / 2;
  darkRanges = darkSections.map((s) => {
    const box = s.parentElement?.classList.contains('pin-spacer') ? s.parentElement : s;
    const top = box.getBoundingClientRect().top + scrollY;
    return [top, top + box.offsetHeight];
  });
}
function updateNavTone() {
  const y = scrollY + navMid;
  const tone = darkRanges.some(([a, b]) => y >= a && y < b) ? 'dark' : 'light';
  if (tone !== navTone) { navTone = tone; nav.classList.toggle('is-light', tone === 'dark'); }
}
(function liquidGlass() {
  const chromium = navigator.userAgentData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
  if (!chromium || reduced || !matchMedia('(pointer: fine)').matches || (navigator.hardwareConcurrency || 4) < 4) return;
  const W = 256, H = 64, r = H / 2, band = r * 0.62;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = Math.min(W - r, Math.max(r, x + 0.5)), cy = r;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dist = Math.hypot(dx, dy) || 1;
      const t = Math.max(0, 1 - (r - dist) / band) ** 2;
      const i = (y * W + x) * 4;
      img.data[i] = 128 + (dx / dist) * t * 127 * 0.3;
      img.data[i + 1] = 128 + (dy / dist) * t * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  $('[data-liquid-map]')?.setAttribute('href', c.toDataURL());
  html.classList.add('lg');
})();
lenis.on('scroll', updateNavTone);
ScrollTrigger.addEventListener('refresh', () => { measureNavTone(); updateNavTone(); });
measureNavTone();
updateNavTone();

const IDLE = {
  head: { from: 0.8, to: -1.6, dur: 3.2, delay: 0 },
  arm: { from: 0.8, to: -1.8, dur: 3.1, delay: 0.4 },
  foot: { from: 2, to: -3.5, dur: 1.6, delay: 0 },
};
const moves = (el) => {
  const u = +el.dataset.unit;
  return {
    y: (v) => ({ yPercent: v * u }),
    origin: { transformOrigin: el.dataset.origin ?? '50% 50%', force3D: true },
  };
};
function idle(scene) {
  if (!scene) return [];
  const tweens = [];
  $$('[data-part]', scene).forEach((el) => {
    const { y, origin } = moves(el);
    if (el.dataset.part === 'steam') {
      tweens.push(gsap.fromTo(el, { ...y(4), rotation: 2, opacity: 1, ...origin }, { ...y(-10), rotation: -3, opacity: 0.5, ...origin, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true }));
      return;
    }
    const cfg = IDLE[el.dataset.part];
    if (!cfg) return;
    tweens.push(gsap.fromTo(el, { rotation: cfg.from, ...origin }, { rotation: cfg.to, ...origin, duration: cfg.dur, delay: cfg.delay + Math.random() * 0.4, ease: 'sine.inOut', repeat: -1, yoyo: true }));
  });
  const reader = $('[data-reader]', scene);
  if (reader) {
    const { y, origin } = moves(reader);
    tweens.push(gsap.to(reader, { ...y(-3), ...origin, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true }));
  }
  return tweens;
}

function loops(tweens) {
  let on = true;
  return (show) => {
    if (show === on) return;
    on = show;
    tweens.forEach((t) => (show ? t.resume() : t.pause()));
  };
}

const loader = $('[data-loader]');
const heroStages = $$('.hero__stage');
const heroWords = $$('[data-word]');

function heroIntro() {
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from(heroWords[0], { y: () => heroWords[0].offsetHeight * 1.05, duration: 1 }, 0)
    .from($('[data-stage-art]', heroStages[0]), { y: 90, opacity: 0, duration: 1.1 }, 0.05)
    .fromTo(heroStages[0], { '--i': 0 }, { '--i': 1, ease: 'power1.inOut', duration: 1.6 }, 0.25)
    .from('.hero__foot > *', { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.35)
    .add(revealFirstScene(), 1.45);
}

function revealFirstScene() {
  const scene = $('[data-hero-scene]');
  return gsap
    .timeline()
    .fromTo(scene, { clipPath: 'circle(0% at 50% 62%)' }, { clipPath: 'circle(145% at 50% 62%)', duration: 1.1, ease: 'power2.inOut' })
    .fromTo($('img', scene), { scale: 1.15 }, { scale: 1, duration: 1.6, ease: 'power2.out' }, 0)
    .set(scene, { clipPath: 'none' });
}

const decoded = (el) => {
  if (el instanceof HTMLImageElement) return el.decode();
  const img = new Image();
  img.src = el.href.baseVal;
  return img.decode();
};
function runLoader() {
  const root = document.documentElement;
  if (reduced || !loader || new URLSearchParams(location.search).has('noloader')) {
    loader?.remove();
    root.classList.remove('booting', 'show-loader');
    const first = revealFirstScene().delay(0.2);
    if (reduced) first.progress(1);
    return;
  }
  lenis.stop();
  window.scrollTo(0, 0);
  const bar = $('[data-loader-bar]', loader);
  const state = { p: 0 };
  const paint = () => bar.style.setProperty('--p', state.p / 100);
  const firstSeen = [$('[data-hero-scene] img'), ...$$('image', heroStages[0])].filter(Boolean);
  let done = 0;
  const jobs = firstSeen.map((el) =>
    decoded(el).catch(() => {}).then(() => {
      done++;
      gsap.to(state, { p: (done / firstSeen.length) * 90, duration: 0.3, ease: 'power1.out', onUpdate: paint, overwrite: true });
    })
  );
  const ready = Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 6000))]);
  let isReady = false, shownAt = root.classList.contains('show-loader') ? performance.now() : 0;
  root.classList.add('loader-armed');
  setTimeout(() => { if (!isReady && !shownAt) { root.classList.add('show-loader'); shownAt = performance.now(); } }, 400);
  const go = () => {
    heroIntro();
    root.classList.remove('booting');
  };
  ready.then(async () => {
    isReady = true;
    if (!shownAt) {
      loader.remove();
      lenis.start();
      go();
      return;
    }
    await new Promise((r) => setTimeout(r, Math.max(0, shownAt + 450 - performance.now())));
    gsap
      .timeline()
      .to(state, { p: 100, duration: 0.2, ease: 'power2.out', onUpdate: paint, overwrite: true })
      .add(go)
      .to(loader, { autoAlpha: 0, duration: 0.4, ease: 'power2.out' })
      .add(() => {
        loader.remove();
        root.classList.remove('show-loader');
        lenis.start();
      });
  });
}

function hero() {
  const poster = $('[data-hero-poster]');
  const caps = $$('[data-cap]');
  const colours = ['#8ea7a9', '#8f9c80', '#bd6d47', '#6f7a3b'];
  gsap.set(heroWords.slice(1), { yPercent: 105, visibility: 'visible' });
  const stageLoops = heroStages.map((s, i) => {
    if (i) {
      gsap.set(s, { opacity: 1, '--d': 0 });
      gsap.set($('[data-chair]', s), { opacity: 0 });
    }
    return loops(idle(s));
  });

  const scenes = $$('[data-hero-scene]', poster);

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut', duration: 1 },
    scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: () => `+=${heroStages.length * 170}%`, pin: true, scrub: 0.9 },
  });
  const revealScene = (i) =>
    tl.fromTo(scenes[i], { clipPath: 'circle(0% at 50% 62%)', opacity: 1 }, { clipPath: 'circle(145% at 50% 62%)', duration: 1, immediateRender: false })
      .fromTo($('img', scenes[i]), { scale: 1.15 }, { scale: 1, duration: 1.5, ease: 'power1.out', immediateRender: false }, '<')
      .set(scenes[i], { clipPath: 'none' })
      .to({}, { duration: 0.8 });

  tl.to({}, { duration: 0.8 });
  for (let i = 1; i < heroStages.length; i++) {
    const L = `s${i}`;
    const from = heroStages[i - 1], to = heroStages[i];
    tl.fromTo(scenes[i - 1], { opacity: 1 }, { opacity: 0, duration: 0.5, ease: 'power1.in', immediateRender: false }, L)
      .fromTo(heroWords[i - 1], { yPercent: 0 }, { yPercent: -105, immediateRender: false }, L)
      .fromTo(heroWords[i], { yPercent: 105 }, { yPercent: 0 }, L)
      .to(poster, { '--bg': colours[i] }, L)
      .to(caps[i - 1], { autoAlpha: 0, y: -14, duration: 0.5 }, L)
      .fromTo(caps[i], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false }, `${L}+=0.5`)
      .fromTo(from, { '--d': 1 }, { '--d': 0, duration: 0.45, ease: 'power1.in', immediateRender: false }, L)
      .fromTo($$('[data-chair]', from), { opacity: 1, y: 0 }, { opacity: 0, y: -40, duration: 0.5, ease: 'power2.in', immediateRender: false }, `${L}+=0.15`)
      .fromTo($$('[data-chair]', to), { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, `${L}+=0.4`)
      .fromTo(to, { '--d': 0 }, { '--d': 1, duration: 0.8, ease: 'power1.out', immediateRender: false }, `${L}+=0.6`)
      .to({}, { duration: 0.3 });
    revealScene(i);
  }
  tl.to({}, { duration: 0.3 })
    .to(poster, { scale: 0.92, borderRadius: 18, duration: 0.8, ease: 'power1.in' })
    .to('[data-hero-art]', { yPercent: -8, duration: 0.8, ease: 'power1.in' }, '<');

  const last = heroStages.length - 1;
  const shown = heroStages.map((_, i) => [i ? tl.labels[`s${i}`] : -Infinity, i < last ? tl.labels[`s${i + 1}`] + 1 : Infinity]);
  let onScreen = true;
  const syncLoops = () => {
    const t = tl.time();
    stageLoops.forEach((set, i) => set(onScreen && t >= shown[i][0] && t <= shown[i][1]));
  };
  tl.eventCallback('onUpdate', syncLoops);
  ScrollTrigger.create({
    start: -1,
    end: () => tl.scrollTrigger.end + innerHeight,
    refreshPriority: -1,
    onToggle: ({ isActive }) => { onScreen = isActive; syncLoops(); },
    onRefresh: ({ isActive }) => { onScreen = isActive; syncLoops(); },
  });
  syncLoops();
}

function manifesto() {
  const sec = $('[data-manifesto]');
  const words = $$('[data-mw]', sec);
  ScrollTrigger.create({
    trigger: sec,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: ({ progress: p }) => {
      const lit = Math.floor(p * 2.6 * (words.length + 0.5));
      words.forEach((el, i) => el.classList.toggle('is-on', i < lit));
    },
  });
  $$('[data-float]', sec).forEach((img, i) =>
    gsap.fromTo(img, { y: () => innerHeight * 0.55 * +img.dataset.float, rotate: i % 2 ? 6 : -6 }, {
      y: () => -innerHeight * 0.55 * +img.dataset.float,
      rotate: i % 2 ? -4 : 4,
      ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1.4 + i * 0.35, invalidateOnRefresh: true },
    })
  );
}

function hasWebGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

async function start3D(canvas, sec) {
  const notes = $$('[data-p3d-note]', sec);
  const r = canvas.getBoundingClientRect();
  const opts = {
    width: r.width,
    height: r.height,
    dpr: devicePixelRatio || 1,
    lite: matchMedia('(max-width: 900px), (max-height: 500px)').matches,
    paper: getComputedStyle(html).getPropertyValue('--paper').trim() || '#ede4d3',
    notesAt: notes.map((el) => el.dataset.at.split(',').map(Number)),
  };
  let boxes = null;
  const onNotes = (pos, alpha) =>
    notes.forEach((el, i) => {
      boxes ??= notes.map((n) => ({ left: n.firstElementChild.offsetLeft, w: n.firstElementChild.offsetWidth, W: canvas.clientWidth || innerWidth }));
      const { left, w, W } = boxes[i], pad = 10;
      const x = Math.min(Math.max(pos[i][0], pad - left), W - pad - left - w);
      el.style.transform = `translate(${x}px, ${pos[i][1]}px)`;
      el.style.opacity = alpha.toFixed(3);
    });
  addEventListener('resize', () => (boxes = null));
  const watchSize = (s) => {
    new ResizeObserver(([e]) => s.setSize(e.contentRect.width, e.contentRect.height)).observe(canvas);
    return s;
  };
  if ('transferControlToOffscreen' in canvas && typeof Worker !== 'undefined') {
    try {
      return watchSize(await workerScene(canvas.transferControlToOffscreen(), opts, onNotes));
    } catch (err) {
      console.warn('3D worker unavailable, drawing on the page instead', err);
      const fresh = canvas.cloneNode();
      canvas.replaceWith(fresh);
      canvas = fresh;
    }
  }
  const { createProcessScene } = await import('./process3d.js');
  return watchSize(await createProcessScene(canvas, { ...opts, onNotes }));
}

function workerScene(offscreen, opts, onNotes) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./process3d.worker.js', import.meta.url), { type: 'module' });
    const send = (m) => worker.postMessage(m);
    const handle = {
      setProgress: (p) => send({ type: 'setProgress', p }),
      setSize: (w, h) => send({ type: 'setSize', w, h }),
      start: () => send({ type: 'start' }),
      stop: () => send({ type: 'stop' }),
    };
    const fail = (err) => { worker.terminate(); reject(err); };
    worker.addEventListener('message', ({ data: m }) => {
      if (m.type === 'notes') onNotes(m.pos, m.alpha);
      else if (m.type === 'ready') resolve(handle);
      else if (m.type === 'error') fail(new Error(m.message));
    });
    worker.addEventListener('error', (e) => fail(e.error || new Error(e.message || 'worker failed to load')));
    worker.postMessage({ type: 'init', canvas: offscreen, opts }, [offscreen]);
  });
}

function process() {
  const sec = $('[data-process]');
  if (!sec) return;
  if (!hasWebGL()) return processImages();

  html.classList.add('p3d');
  const canvas = $('[data-p3d-canvas]', sec);
  const steps = $$('[data-p3d-step]', sec);
  const nodes = $$('[data-p3d-node]', sec);
  const track = $('[data-p3d-track]', sec);
  let scene = null, progress = 0, active = -1, visible = false;

  const ui = (p) => {
    track.style.setProperty('--p', p.toFixed(4));
    const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
    if (idx !== active) {
      active = idx;
      steps.forEach((s, i) => s.classList.toggle('is-on', i === idx));
      nodes.forEach((n, i) => { n.classList.toggle('is-on', i === idx); n.classList.toggle('is-done', i < idx); });
    }
  };
  ui(0);

  const st = ScrollTrigger.create({
    trigger: sec,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: ({ progress: p }) => { progress = p; ui(p); scene?.setProgress(p); },
  });
  const REST = [0.21, 0.49, 0.74, 0.97];
  $$('[data-p3d-go]', sec).forEach((b) =>
    b.addEventListener('click', () => {
      const at = REST[+b.dataset.p3dGo];
      if (at === undefined) return;
      lenis.scrollTo(st.start + (st.end - st.start) * at, { duration: 1.4 });
    })
  );
  ScrollTrigger.create({
    trigger: sec,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: ({ isActive }) => {
      visible = isActive;
      if (!scene) return;
      if (isActive) scene.start();
      else scene.stop();
    },
  });
  ScrollTrigger.create({
    trigger: sec,
    start: 'top bottom+=100%',
    once: true,
    onEnter: () =>
      start3D(canvas, sec)
        .then((s) => {
          scene = s;
          scene.setProgress(progress);
          if (visible) scene.start();
        })
        .catch((err) => {
          console.warn('3D process unavailable, using images', err);
          html.classList.remove('p3d');
          processImages();
          ScrollTrigger.refresh();
        }),
  });
}

function processImages() {
  const sec = $('[data-process]');
  const steps = $$('[data-step]', sec);
  const bar = $('[data-process-bar]', sec);
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: sec,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: ({ progress: p }) => {
        const idx = Math.min(steps.length - 1, Math.floor(p * steps.length));
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
        bar.style.transform = `scaleX(${p})`;
      },
    },
  });
  const settle = matchMedia('(max-width: 900px), (max-height: 500px)').matches ? 1 : 1.08;
  tl.fromTo('[data-p-sketch]', { scale: settle }, { scale: 1, duration: 1 }, 0)
    .to('[data-p-real]', { clipPath: 'inset(0 0 0 0%)', duration: 1, ease: 'power1.inOut' }, 1)
    .fromTo('[data-p-wipe]', { left: '100%' }, { left: '0%', duration: 1, ease: 'power1.inOut' }, 1)
    .to('[data-p-wipe]', { opacity: 0, duration: 0.1 }, 2)
    .to('[data-p-sketch]', { opacity: 0.22, duration: 0.4 }, 1.8)
    .to('[data-p-zoom]', { opacity: 1, duration: 0.4 }, 2.1)
    .fromTo('[data-p-zoom] img', { scale: 2.1 }, { scale: 2.8, duration: 0.9, ease: 'power1.inOut' }, 2.1)
    .to('[data-p-live]', { opacity: 1, duration: 0.4 }, 3.1)
    .fromTo('[data-p-live] img', { scale: 1.2 }, { scale: 1, duration: 0.9 }, 3.1);
}

function collection(mm) {
  mm.add('(min-width: 821px) and (min-height: 501px)', () => {
    const sec = $('[data-collection]');
    const track = $('[data-track]', sec);
    const bar = $('[data-col-bar]', sec);
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top top',
        end: () => '+=' + dist(),
        pin: '.collection__pin',
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: ({ progress }) => (bar.style.transform = `scaleX(${progress})`),
      },
    });
    return () => tween.kill();
  });
  mm.add('(max-width: 820px), (max-height: 500px)', () => {
    const sec = $('[data-collection]');
    const track = $('[data-track]', sec);
    const bar = $('[data-col-bar]', sec);
    const [prev, next] = $$('[data-col-go]', sec);
    const onScroll = () => {
      const max = track.scrollWidth - track.clientWidth;
      bar.style.transform = `scaleX(${max > 0 ? Math.max(0.06, track.scrollLeft / max) : 1})`;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    const step = (dir) => {
      const cards = track.children;
      const pitch = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
      track.scrollBy({ left: dir * pitch, behavior: 'smooth' });
    };
    const onPrev = () => step(-1), onNext = () => step(1);
    prev.addEventListener('click', onPrev);
    next.addEventListener('click', onNext);
    track.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      track.removeEventListener('scroll', onScroll);
      prev.removeEventListener('click', onPrev);
      next.removeEventListener('click', onNext);
      bar.style.transform = '';
    };
  });
}

function footer() {
  const woman = $('[data-foot-woman]');
  if (woman && !reduced) {
    const breathe = loops([gsap.to(woman, { y: -3, duration: 2.6, ease: 'sine.inOut', repeat: -1, yoyo: true })]);
    breathe(false);
    ScrollTrigger.create({
      trigger: '[data-foot]',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: ({ isActive }) => breathe(isActive),
      onRefresh: ({ isActive }) => breathe(isActive),
    });
  }
  const form = $('[data-form]');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    form.classList.add('is-sent');
  });
}

function reveals() {
  $$('[data-split]').forEach((el) =>
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 135,
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        }),
    })
  );

  ScrollTrigger.batch('[data-fade]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.from(els, { y: 36, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 }),
  });

  $$('[data-reveal-img]').forEach((el) =>
    gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.6,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    })
  );

  $$('[data-count-to]').forEach((el) => {
    const o = { v: 0 };
    el.textContent = '0';
    gsap.to(o, {
      v: +el.dataset.countTo,
      duration: 2,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = Math.round(o.v)),
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  stats();
  quote();
}

function quote() {
  const sec = $('[data-quote]');
  if (!sec) return;
  const pen = $('[data-quote-pen]', sec);
  const by = $('[data-quote-by]', sec);
  const words = SplitText.create($('[data-quote-text]', sec), { type: 'words', wordsClass: 'w', aria: 'none' }).words;
  const len = Math.ceil(pen.getTotalLength()) + 2;
  gsap.set(pen, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set(words, { opacity: 0, y: 12 });
  gsap.set(by, { opacity: 0, y: 8 });
  const tl = gsap
    .timeline({ paused: true })
    .to(pen, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
    .to(words, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.035 }, '-=0.7')
    .to(by, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, '-=0.25');
  ScrollTrigger.create({ trigger: sec, start: 'top 70%', once: true, onEnter: () => tl.play() });
}

function stats() {
  const box = $('[data-stats]');
  if (!box) return;
  const ticks = $$('.stat__tick', box);
  gsap
    .timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: box, start: 'top 90%', once: true } })
    .fromTo($$('.stat__ring', box), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 1.5, stagger: 0.18 }, 0)
    .fromTo($('.stat__pith', box), { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' }, 0.9)
    .fromTo(ticks, { opacity: 0.12 }, { opacity: 1, duration: 0.25, stagger: 1.8 / ticks.length, ease: 'none' }, 0)
    .fromTo($('.stat__bead', box), { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(3)' }, 0.6);
}

function boot() {
  if (reduced) {
    footer();
    runLoader();
    return;
  }
  const mm = gsap.matchMedia();
  hero();
  manifesto();
  hold(mm, '.studio', '.makers');
  process();
  collection(mm);
  hold(mm, '.spaces', '.quote');
  footer();
  reveals();
  runLoader();
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
}

function hold(mm, ...sels) {
  mm.add('(min-width: 901px) and (min-height: 501px)', () => {
    sels.forEach((sel) => {
      const el = $(sel);
      if (el) ScrollTrigger.create({ trigger: el, start: 'top top', end: '+=35%', pin: true });
    });
  });
}

document.fonts.ready.then(boot);
