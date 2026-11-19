# Timbre Interior: scrollytelling site

UI-only Astro site for Timbre Interior (Sri Lankan teak and rattan furniture). No backend: the inquiry form shows a thank-you state.

```bash
npm install
npm run dev       # http://localhost:4321  (add ?noloader to skip the intro)
npm run build     # static site in dist/
npm run preview   # serve dist/
npm run lint      # oxlint (config: .oxlintrc.json)
```

## Sections (top to bottom)

| Section | What happens on scroll |
| --- | --- |
| Loader | Only shown if the first content isn't ready within 0.4 s |
| Hero (pinned) | Laurent, Otto, Marcel, Kaizen: each person is drawn into their chair, then their room opens behind them |
| Manifesto (pinned) | "People ignore design that ignores people." lights word by word; furniture floats past on a wood board |
| Studio / Makers | The workshop, the stats, Kaia and J. |
| Process (pinned) | "From sketch to seat": the Laurent chair built in 3D (web worker); image version without WebGL |
| Collection | Horizontal pin on desktop, swipe row with arrows on phones |
| Spaces / Quote | Hotels, cafés, retreats; Kaia's quote drawn in |
| Footer | Inquiry form; the reader sits on the wordmark |

## Where things live

- `src/components/`: one component per section; `FigureStage.astro` is a hero stage (chair, person, moving parts as layers)
- `src/data/`: products, chair cutouts, figure scales, traced line-art paths, `srcset.json` (generated)
- `src/scripts/main.js`: all motion (GSAP ScrollTrigger, SplitText, Lenis)
- `src/scripts/process3d.js` + `process3d.worker.js`: the 3D chair scene (three.js, OffscreenCanvas)
- `public/`: everything the site serves
- `assets-src/`: masters that are not served (cutout and figure PNGs, original photos, the logo PNG, the original chair model)
- `images/`: the brand's own posts and the reference drawings

## Regenerating assets

| Command | Makes |
| --- | --- |
| `node tools/cutout.mjs name:x,y,w,h` | Background-removed cutout PNG in `assets-src/cutouts/` |
| `node tools/webp.mjs` | `public/cutouts/*.webp` and `public/figures/*.webp` from the PNG masters |
| `node tools/responsive.mjs` | The smaller `-NNNw.webp` copies and `src/data/srcset.json` |
| `node tools/compress-glb.mjs` | `public/models/chair.glb` (JPEG texture, meshopt geometry) |
| `node tools/footer-reader.mjs` | The footer reader with her gaps closed |
| `node tools/favicon.mjs` | Favicons from `public/logo.svg` |
| `node tools/vectorize-logo.mjs` | `public/logo.svg` from `assets-src/logo.png` |
| `node tools/self-host-fonts.mjs` | `public/fonts/` and `src/styles/fonts.css` |
| `node tools/wood-texture.cjs out.png` | The manifesto wood grain |
| `node tools/trace-ref.mjs`, `node tools/otto-shoes.mjs`, `node tools/extract-lines.mjs` | Traced figure paths and line-art PNGs |

Notes: "Arc Armchair" and "Sling Lounger" are placeholder names; the Studio stats are placeholder copy.
