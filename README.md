# Dither (Processing + Website)

This folder contains **Failenn's dither** — a **Processing** sketch (`testing_file.pde`) that renders an organic dot/bridge dither from an input image. The sketch window is sized to the image (with proportional white margin), not a fixed square.

It also contains a **p5.js website** (`index.html` + `sketch.js`) that you can host and share as a link.

## Website version (p5.js)

Files:
- `index.html`
- `sketch.js`
- `presets.js` (named looks matching PNGs in this folder)
- `style.css`

The **Preset** dropdown is the only style control: each entry in `presets.js` sets a `renderStyle` (organic, halftone, ordered, error diffusion, etc.) plus default sliders. Editing a slider switches to **Custom** but keeps the same algorithm as the last preset you picked.

Pick a preset, then adjust sliders; edit `presets.js` to merge or remove looks.

How to run locally (quick):
- Open `index.html` in a browser.

Notes:
- Browsers may block some features when opening a file directly. If that happens, use a tiny local server.

### Local server (optional)

Install [Node.js](https://nodejs.org/), then:

```bash
npm install
npm start
```

Open `http://localhost:3000` (or set `PORT` in `.env`). Same as static hosting, but avoids browser quirks when opening files directly.

Or use any static server, e.g. `npx serve`.

Deploy/share it:
- **GitHub Pages**: put these files in a repo, then enable Pages for the `main` branch.
- **Netlify**: drag-and-drop this folder in Netlify “Deploy manually”.
- **Cloudflare Pages**: upload as a static site (no build command needed).

## Run it (Processing)

- Install Processing (Java mode).
- Open `assets/testing_file.pde`.
- Put an image at `data/input.jpg` (or change `inputImagePath` in the code).
- Click **Run**.

Controls:
- `O`: open an image file picker
- `R`: re-render
- `S`: save `output.png`

## Export it as a Windows app

In Processing:
- **File → Export Application**
- Select **Windows**
- Export

If you want the exported app to work without picking a file each time:
- Ensure your image is in the sketch `data/` folder as `input.jpg` before exporting.

## Main tuning knobs

At the top of `testing_file.pde`:
- `gridCount`, `minRadius`, `maxRadius`: dot grid density + dot size range
- `bridgeScale`: overall bridge thickness
- `bridgeWaist`: how pinched the bridge is in the middle
- `maxConnectDist`, `toneDiffLimit`, `gradientThreshold`: connection rules
- `edgeTaper`: how much the bridge narrows near the ends

