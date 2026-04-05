import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(__dirname));
app.use(express.json({ limit: "10mb" }));

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

const SYSTEM_PROMPT = `You are a dithering expert for "fither", a web-based image dithering app. You may receive the user's actual image — analyze its tonal range, subject, detail level, and contrast to inform your design.

Given the image (if any) and the vibe the user describes, invent a completely original dithering configuration from scratch. Do not pick from a preset list — generate your own parameter values that express the aesthetic.

Choose exactly one renderStyle:
- organic: blob dots with ink bridges connecting nearby dark dots (use for natural, inky, handmade vibes)
- organic_dots: like organic but no bridges — pure dot field
- halftone: classic AM halftone grid (newspaper, magazine, offset print)
- stipple: scattered stipple dots with jitter (engraving, illustration, pen-and-ink)
- halftone_edges: halftone + Sobel edge contour lines overlaid (technical, detailed)
- diamond_overlay: overlapping rotated diamond shapes with noise texture
- ordered8: Bayer 8×8 ordered dither (retro pixel, LCD, video game)
- threshold: pure binary 1-bit cutoff (stencil, stamp, linocut)
- fs: Floyd-Steinberg error diffusion (smooth photographic)
- atkinson: Atkinson error diffusion (crunchy newspaper, high contrast)
- jarvis: Jarvis-Judice-Ninke error diffusion (smooth, slightly softer than fs)
- stucki: Stucki error diffusion (balanced smooth tones)
- burkes: Burkes error diffusion (sharper edges than stucki)
- sierra2: Sierra-2 error diffusion (soft balanced tones)

Parameters — include all that are relevant to your chosen renderStyle, omit the rest:
- gridCount: 10–140 — dot grid density (lower=bigger dots, higher=finer; all styles)
- minRadius: 0.5–10 — minimum dot radius (organic, organic_dots, halftone, stipple, halftone_edges, diamond_overlay)
- maxRadius: 2–30 — maximum dot radius (same styles)
- contrast: 0.5–2.0 — pre-dither contrast (1=flat, 1.5=punchy; all styles)
- bridgeScale: 0.2–20 — bridge thickness (organic only)
- bridgeWaist: 0.02–3 — bridge middle pinch; lower=thinner, above 1=fatter than dots (organic only)
- maxConnectDist: 0.6–100 — bridge reach in grid cells (organic only)
- toneDiffLimit: 0–0.6 — max tone difference for bridge connections (organic only)
- gradientThreshold: 0–0.4 — edge detection threshold; higher=fewer bridges at edges (organic only)
- edgeTaper: 0–1 — how much bridges narrow at their ends (organic only)
- maxBright: 0.2–0.65 — max brightness that gets dots or bridges (organic, organic_dots)
- maxLinksPerDot: 0–8 — max bridge connections per dot; 0=no bridges (organic only)
- quantizeLevels: 0–8 — posterize zones before dithering; 0=off (all styles)
- stippleJitter: 0–1.2 — dot scatter randomness (stipple, halftone, halftone_edges, diamond_overlay)
- halftoneGamma: 0.5–1.2 — tone curve gamma (stipple, halftone, halftone_edges, diamond_overlay, error diffusion)
- edgeMag: 0.05–0.35 — edge line strength (halftone_edges only)
- threshold: 0.05–0.95 — 1-bit cutoff (threshold only)

Respond ONLY with a single valid JSON object — no markdown, no code fences, nothing else:
{"name":"<2–4 word creative name>","renderStyle":"<exact string>","explanation":"<1–2 sentences>","parameters":{<key:value pairs>}}`;

app.post("/api/suggest", async (req, res) => {
  try {
    const { prompt, imageBase64, imageMediaType } = req.body;

    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: "prompt or image is required" });
    }

    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });

    // Build parts — image first (if present), then text
    const parts = [];

    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: imageMediaType || "image/jpeg",
          data: imageBase64,
        },
      });
    }

    parts.push({
      text: prompt?.slice(0, 500) || "What dithering preset would make this image look best?",
    });

    const result = await model.generateContent(parts);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned an unexpected response format");

    const suggestion = JSON.parse(jsonMatch[0]);
    res.json(suggestion);
  } catch (err) {
    console.error("/api/suggest error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`fither — http://localhost:${PORT}`);
});
