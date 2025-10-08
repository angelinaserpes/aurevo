// /api/generate.js
const VERSION = 'gen-v3-no-response-format';

export default async function handler(req, res) {
  try {
    // Diagnostics: open /api/generate in a browser to see this
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        runtime: 'node',
        version: VERSION,
        hasOPENAI_KEY: Boolean(process.env.OPENAI_API_KEY),
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Safe body parse (works even if req.body is empty)
    let payload = {};
    if (req.body && typeof req.body === 'object') {
      payload = req.body;
    } else {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      try { payload = JSON.parse(raw || '{}'); } catch {}
    }

    const { prompt, sampleCount = 1, size = '1024x1024' } = payload;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });

    // NOTE: no response_format here
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size,
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      // Return upstream response so we can see the *real* reason
      return res.status(502).json({ error: `OpenAI error ${r.status}: ${text}`, version: VERSION });
    }

    let out;
    try { out = JSON.parse(text); } catch {
      return res.status(502).json({ error: 'OpenAI returned non-JSON response', version: VERSION });
    }

    // Handle either base64 or URL result
    const datum = out?.data?.[0] || {};
    let b64 = datum.b64_json;

    if (!b64 && datum.url) {
      const imgResp = await fetch(datum.url);
      if (!imgResp.ok) return res.status(502).json({ error: `Image fetch failed: ${imgResp.status}`, version: VERSION });
      const buf = Buffer.from(await imgResp.arrayBuffer());
      b64 = buf.toString('base64');
    }

    if (!b64) return res.status(500).json({ error: 'No image returned', version: VERSION });

    return res.status(200).json({ imageBase64: b64, version: VERSION });
  } catch (e) {
    console.error('Generate crashed:', e);
    return res.status(500).json({ error: e.message || 'Unexpected server error', version: VERSION });
  }
}
