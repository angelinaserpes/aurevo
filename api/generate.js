// /api/generate.js  — Node Serverless Function with diagnostics

export default async function handler(req, res) {
  try {
    // --- Lightweight diagnostics on GET ---
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        runtime: 'node',
        hasOPENAI_KEY: Boolean(process.env.OPENAI_API_KEY),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // --- Robust JSON body parse (works even if req.body is undefined) ---
    let payload = {};
    if (req.body && typeof req.body === 'object') {
      payload = req.body;
    } else {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try { payload = JSON.parse(raw || '{}'); } catch { payload = {}; }
    }

    const { prompt, sampleCount = 1 } = payload;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });

    // --- Call OpenAI Images API ---
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      })
    });

    const text = await r.text(); // capture full error bodies for debugging
    if (!r.ok) {
      return res.status(502).json({ error: `OpenAI error ${r.status}: ${text}` });
    }

    let out;
    try { out = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'OpenAI returned non-JSON response' });
    }

    const b64 = out?.data?.[0]?.b64_json;
    if (!b64) return res.status(500).json({ error: 'No image returned' });

    return res.status(200).json({ imageBase64: b64 });
  } catch (e) {
    console.error('Generate handler crashed:', e);
    return res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}
