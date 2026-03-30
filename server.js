import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

app.use(express.json({ limit: "1mb" }));

app.post("/api/suggest", async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !String(key).trim()) {
    return res.status(503).json({
      error: "Server has no GEMINI_API_KEY. Add it to .env and restart.",
    });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Missing JSON body: { prompt: string }" });
  }
  if (prompt.length > 120000) {
    return res.status(400).json({ error: "Prompt too long" });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        MODEL
      )}:generateContent?key=${encodeURIComponent(key.trim())}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const data = await r.json();
    if (!r.ok) {
      const msg = data.error?.message || `${r.status} ${r.statusText}`;
      return res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({ error: msg });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(502).json({ error: "Empty response from Gemini" });
    }

    return res.json({ text });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`fither — http://localhost:${PORT}`);
  console.log(`AI proxy: POST /api/suggest (GEMINI_API_KEY in .env)`);
});
