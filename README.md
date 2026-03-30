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

### Run with AI suggest (recommended)

Uses a small **Express** backend so your **Google AI key stays on the server** (`.env`, never committed).

1. Install [Node.js](https://nodejs.org/).
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey).
3. In this folder:

```bash
npm install
npm start
```

4. Open `http://localhost:3000` (or the port in `.env`). **Suggest** calls `POST /api/suggest` — no key in the browser.

Optional: leave the key field empty on the server; or paste **your own** key in the UI to call Gemini from the client (BYOK).

### Static-only (no AI proxy)

```bash
npx serve
```

Then open the printed local URL. For **Suggest**, paste a Gemini API key in AI mode, or use `npm start` above.

Deploy/share it:
- **GitHub Pages**: put these files in a repo, then enable Pages for the `main` branch.
- **Netlify**: drag-and-drop this folder in Netlify “Deploy manually”.
- **Cloudflare Pages**: upload as a static site (no build command needed).

## Run it (Processing)

- Install Processing (Java mode).
- Open `testing_file.pde`.
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

