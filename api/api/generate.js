export const config = { runtime: 'edge' }; // fast, runs on Vercel Edge

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({error:'Method not allowed'}), { status: 405 });
    }
    const { prompt, sampleCount = 1, aspectRatio, imageSize } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({error:'Missing prompt'}), { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({error:'Server missing GEMINI_API_KEY'}), { status: 500 });
    }

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
      return new Response(JSON.stringify({error:`Upstream error ${resp.status}: ${text}`}), { status: 502 });
    }

    const data = await resp.json();
    // Imagen returns base64 bytes at predictions[0].bytesBase64Encoded
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) {
      return new Response(JSON.stringify({error:'No image bytes returned'}), { status: 500 });
    }

    return new Response(JSON.stringify({ imageBase64: base64 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({error: e.message}), { status: 500 });
  }
}
