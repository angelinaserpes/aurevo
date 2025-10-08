export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, sampleCount = 1, aspectRatio, imageSize } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });

    const body = {
      instances: [{ prompt }],
      parameters: {
        sampleCount,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(imageSize ? { imageSize } : {})
      }
    };

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      return res.status(502).json({ error: `Upstream error ${resp.status}: ${text}` });
    }

    const data = await resp.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) return res.status(500).json({ error: 'No image bytes returned' });

    return res.status(200).json({ imageBase64: base64 });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unexpected server error' });
  }
}
