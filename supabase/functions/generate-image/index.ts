// Supabase Edge Function: generate-image
// Proxies Pollinations.ai server-side so the browser doesn't hit CORS/origin
// blocks, and so the secret token stays out of client bundles.
//
// Deploy: copy this file's contents into a new Edge Function in the Supabase
// dashboard named "generate-image", set POLLINATIONS_TOKEN in the function's
// secrets, then deploy.

const POLLINATIONS_TOKEN = Deno.env.get('POLLINATIONS_TOKEN') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, seed, width = 1024, height = 576 } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid prompt' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      seed: String(seed ?? Math.floor(Math.random() * 1_000_000)),
      nologo: 'true',
      model: 'flux-realism',
      referrer: 'mcmichaelmunchies',
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
    const headers: Record<string, string> = {};
    if (POLLINATIONS_TOKEN) headers.Authorization = `Bearer ${POLLINATIONS_TOKEN}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      return new Response(
        JSON.stringify({ error: `Pollinations returned ${res.status}`, details: text.slice(0, 200) }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const blob = await res.blob();
    return new Response(blob, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': blob.type || 'image/jpeg' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
