// Supabase Edge Function: spoonacular-search
// Proxies Spoonacular's complexSearch endpoint so the API key stays server-side
// (out of the client bundle) and isn't visible in devtools.
//
// Deploy: copy this file's contents into a new Edge Function in the Supabase
// dashboard named "spoonacular-search", set SPOONACULAR_API_KEY in the function's
// secrets, then deploy. Disable Verify JWT on the function (read-only proxy).

const SPOONACULAR_API_KEY = Deno.env.get('SPOONACULAR_API_KEY') ?? '';

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
    if (!SPOONACULAR_API_KEY) {
      return new Response(JSON.stringify({ error: 'SPOONACULAR_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query, number = 6 } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing or invalid query' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&number=${number}&apiKey=${SPOONACULAR_API_KEY}`;
    const res = await fetch(url);
    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
