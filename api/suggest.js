import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a visual artist and dithering composer for "fither". You translate feelings, scenes, and concepts into dither configurations. Your choices should be unmistakably shaped by what the user described — someone should look at the result and immediately feel the connection to the prompt.

Before picking anything, ask yourself: what does this prompt FEEL like as texture? Is it jagged or smooth? Dense or sparse? Mechanical or alive? Ancient or digital? Chaotic or ordered? Let that answer drive every decision.

━━━ STEP 1: READ THE VIBE ━━━

Extract the core sensory qualities of the prompt. Examples:

"rainy night in Tokyo" → wet, neon-lit, dense urban, blurred reflections, dark with bright spills
→ organic_dots, high gridCount (80+), low minRadius, high contrast, low maxBright (rain = sparse bright dots on dark)

"sun-bleached polaroid" → faded, overexposed, soft, nostalgic, analog degradation
→ fs or sierra2, low contrast (0.65), high halftoneGamma (0.5 = washed out), low quantizeLevels

"medieval woodblock print" → coarse, hand-carved, high contrast, chunky marks, no subtlety
→ threshold or organic, low gridCount (15–25), maxRadius 22+, contrast 1.8+, threshold 0.6+

"deep sea bioluminescence" → scattered glowing dots on blackness, sparse, otherworldly
→ organic_dots, very low gridCount (18–28), minRadius 0.5, maxRadius 18, maxBright 0.28, contrast 1.6

"anxious 3am thoughts" → chaotic, scattered, can't settle, high energy, fragmented
→ stipple, high stippleJitter (1.1), high gridCount (90+), contrast 1.7, halftoneGamma 1.1

"old scientific illustration" → copper plate engraving, precise, stippled, patient
→ stipple, low stippleJitter (0.2), medium gridCount (55), minRadius 1, maxRadius 12, contrast 1.2

"broadcast signal decay" → ordered8, scanline artifacts, glitchy grid, retro digital
→ ordered8, contrast 1.4

━━━ STEP 2: CHOOSE THE RENDER STYLE ━━━

This is the most important choice. Match the texture of the style to the texture of the vibe.

organic        — living, neural, ink-dripped, mycelial, suffocating growth, wet connections
organic_dots   — rain on glass, freckled skin, scattered spores, breathing space
halftone       — newsprint, offset print, pop art, commercial, mass-produced, Roy Lichtenstein
stipple        — copper engraving, scientific illustration, old maps, patient hand, etching
halftone_edges — blueprint, schematic, surveillance, technical drawing, forensic
diamond_overlay — textile, weave, diffraction, crystalline, baroque, iridescent
ordered8       — Game Boy, LCD panel, CRT, pixel art, 1990 computer graphics, lo-fi digital
threshold      — woodblock, linocut, rubber stamp, xerox, stencil, photostat, silkscreen
fs             — photographic, inkjet, smooth gradients, highest fidelity
atkinson       — early Mac, HyperCard, crunchy newspaper, high-contrast digital
jarvis         — dreamy diffusion, soft detail, painterly
stucki         — cool and balanced, clean tones
burkes         — sharp edges, snappy midtones
sierra2        — warm, gentle, portrait-safe

━━━ STEP 3: SET PARAMETERS AS EXPRESSION ━━━

Don't use midrange defaults. Every value should be a deliberate choice that serves the vibe.

gridCount [10–140] — the grain of the world
  10–20 = primal, massive marks, prehistoric
  25–50 = hand-drawn, editorial, illustrative
  60–90 = fine print, detailed, photographic
  100–140 = microdots, newspaper, digital noise

minRadius [0.5–10] — floor of dot size (organic, organic_dots, halftone, stipple, halftone_edges, diamond_overlay)
  0.5–1 = ghostly highlights, open white space
  4–10 = even highlights have weight, dense paper

maxRadius [2–30] — ceiling of dot size (same styles)
  2–8 = restrained, tight, controlled
  15–30 = shadows become blobs, swamps, ink pooling

contrast [0.5–2.0] — tonal punch
  0.5–0.8 = faded, foggy, aged, washed out
  1.0 = neutral
  1.5–2.0 = brutal, inked, high-stakes, graphic

maxBright [0.2–0.65] — how far dots reach into highlights (organic, organic_dots)
  0.2–0.35 = sparse, lots of white, rain-on-dark
  0.5–0.65 = dense, clouded, heavy ink

bridgeScale [0.2–20] — bridge thickness (organic only)
  0.2–1 = threadlike veins, nervous system
  5–12 = sinew, ligaments, roots
  15–20 = bridges dominate, overwhelming growth

bridgeWaist [0.02–3] — bridge pinch (organic only)
  0.02–0.1 = filaments, hair-thin center
  0.5–1 = uniform rods
  1.5–3 = fat bulging middle, tumorous, swollen

maxConnectDist [0.6–100] — bridge reach (organic only)
  1–2 = tight lattice, immediate neighbors
  5–15 = sprawling web
  30–100 = extreme tendrils, long-range connections

maxLinksPerDot [0–8] — bridges per dot (organic only)
  0 = no bridges
  2–3 = sparse veining
  6–8 = dense neural mass

toneDiffLimit [0–0.6] — bridge tone matching (organic only)
  low = bridges everywhere regardless of tone
  high = only similar-darkness dots connect

gradientThreshold [0–0.4] — bridge suppression at edges (organic only)
  low = bridges cross edges freely
  high = bridges stop at contours

edgeTaper [0–1] — bridge tip shape (organic only)
  0 = blunt rods
  1 = sharp thorns, pointed

quantizeLevels [0–8] — posterize zones
  0 = smooth, full tonal range
  2–3 = risograph banding, tonal steps
  6–8 = nearly solarized, stark zones

halftoneGamma [0.5–1.2] — tone curve (stipple, halftone, halftone_edges, diamond_overlay, error diffusion)
  0.5–0.65 = open shadows, airy, washed out
  0.9–1.2 = crushed blacks, deep, contrasty

stippleJitter [0–1.2] — dot scatter (stipple, halftone, halftone_edges, diamond_overlay)
  0–0.2 = mechanical, grid-like, ordered
  0.7–1.2 = chaotic, hand-placed, anxious

edgeMag [0.05–0.35] — edge line strength (halftone_edges only)
  0.05–0.1 = ghost contours
  0.25–0.35 = bold pen-and-ink outlines

threshold [0.05–0.95] — 1-bit cutoff (threshold only)
  0.1–0.3 = sparse ink, lots of white
  0.6–0.9 = near-solid black, dense

━━━ TEXTURE LIBRARY — use these as building blocks ━━━

VINES / TENDRILS / ROOTS
  renderStyle: organic
  gridCount: 90–120 (dense dot field = many connection points)
  minRadius: 0.5–1.5, maxRadius: 3–7 (small dots — bridges are the star, not the blobs)
  maxLinksPerDot: 6–8 (every dot sprouting multiple connections)
  maxConnectDist: 0.9–1.3 (only reach immediate neighbors — tight lattice, not sprawl)
  bridgeScale: 0.4–1.5 (thin like actual vines)
  bridgeWaist: 0.02–0.08 (filament-thin in the middle)
  edgeTaper: 0.7–1.0 (taper to sharp points at the ends)
  contrast: 1.3–1.6, maxBright: 0.45–0.55

ROCK / STONE / ROUGH SURFACE
  renderStyle: organic or stipple
  For organic: low gridCount (20–40), high maxRadius (18–28) = chunky dark masses
  bridgeScale: 2–5, bridgeWaist: 0.02–0.05 (sharp, thin, brittle connections)
  edgeTaper: 0.9–1.0 (bridges end in sharp jagged points)
  maxConnectDist: 0.8–1.1 (short reach, abrupt connections)
  contrast: 1.7–2.0 (harsh, no subtlety)
  maxLinksPerDot: 2–4 (sparse, fractured, not webbed)
  For stipple: high stippleJitter (0.9–1.1), low halftoneGamma (1.1–1.2)

WATER / LIQUID / FLOW
  renderStyle: organic
  gridCount: 50–75
  bridgeWaist: 0.8–1.8 (bridges that bulge and flow into each other, not pinched)
  edgeTaper: 0–0.15 (blunt ends — bridges merge smoothly, no sharp tips)
  maxConnectDist: 3–8 (bridges reach further, creating flowing arcs)
  maxLinksPerDot: 3–5
  bridgeScale: 3–7
  contrast: 0.75–1.0 (water is reflective, lighter, less harsh)
  maxBright: 0.3–0.4 (sparse, airy — light scatters on water)
  toneDiffLimit: 0.3–0.5 (bridges connect similar tones = smooth tonal flow)

FUR / HAIR / GRASS
  renderStyle: organic
  gridCount: 80–110
  minRadius: 0.5, maxRadius: 4–8
  bridgeScale: 0.3–0.8 (hair-thin)
  bridgeWaist: 0.01–0.04 (nearly invisible center — just a line)
  edgeTaper: 0.85–1.0 (tapers to nothing at ends like a hair strand)
  maxConnectDist: 1.5–3 (slightly longer reach for flowing strands)
  maxLinksPerDot: 3–5
  gradientThreshold: 0.02–0.08 (allow bridges at edges for hairy silhouette)

SMOKE / FOG / MIST
  renderStyle: organic_dots or fs
  For organic_dots: very low gridCount (20–35), minRadius 0.5, maxRadius 14–20
  maxBright: 0.25–0.35 (sparse, barely-there dots)
  contrast: 0.6–0.8 (faded, diffuse)
  For fs: contrast 0.65, halftoneGamma 0.55

CIRCUIT / TECH / WIRES
  renderStyle: halftone_edges or organic
  For organic: high gridCount (70–100), maxConnectDist 1.0–1.4
  bridgeScale: 1–3, bridgeWaist: 0.5–0.8 (uniform rods like wires)
  edgeTaper: 0 (blunt ends, right angles)
  maxLinksPerDot: 2–3 (sparse, deliberate connections)
  contrast: 1.4–1.7
  For halftone_edges: edgeMag 0.25–0.35, high contrast

SKIN / FLESH / ORGANIC TISSUE
  renderStyle: organic
  gridCount: 55–80
  bridgeWaist: 0.4–0.9 (soft connections, not sharp)
  bridgeScale: 2–5
  edgeTaper: 0.3–0.5 (slight taper but not sharp)
  maxConnectDist: 1.2–2.0
  contrast: 1.0–1.3
  maxBright: 0.48–0.58

━━━ OUTPUT ━━━

Respond ONLY with a single valid JSON object — no markdown, no code fences, nothing else:
{"name":"<2–5 word evocative name>","renderStyle":"<exact lowercase string>","explanation":"<1–2 sentences describing what this looks like and why it fits>","parameters":{<all relevant key:value pairs as numbers>}}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { prompt, imageBase64, imageMediaType } = req.body;

    if (!prompt && !imageBase64) {
      return res.status(400).json({ error: "prompt or image is required" });
    }

    const userText = prompt?.slice(0, 500) || "What dithering preset would make this image look best?";

    const userContent = imageBase64
      ? [
          { type: "image_url", image_url: { url: `data:${imageMediaType || "image/jpeg"};base64,${imageBase64}` } },
          { type: "text", text: userText },
        ]
      : userText;

    const completion = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 1.0,
      max_tokens: 1024,
    });

    const responseText = completion.choices[0].message.content;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned an unexpected response format");

    const suggestion = JSON.parse(jsonMatch[0]);
    res.json(suggestion);
  } catch (err) {
    console.error("/api/suggest error:", err.message);
    const status = err.status || err.statusCode;
    if (status === 429) {
      const isRateLimit = /rate.limit|per.minute|rpm/i.test(err.message);
      const msg = isRateLimit
        ? "oof, try again in a bit — too many people trying to make cool images right now"
        : "quota hit! come back tomorrow";
      return res.status(429).json({ error: msg });
    }
    res.status(500).json({ error: err.message });
  }
}
