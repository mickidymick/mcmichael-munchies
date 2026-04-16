// Supabase Edge Function: usda-proxy
// Proxies the two USDA FoodData Central endpoints used by lib/nutrition.ts
// (foods/search and food/{fdcId}) so the API key stays server-side.
//
// Deploy: copy this file's contents into a new Edge Function in the Supabase
// dashboard named "usda-proxy", set USDA_API_KEY in the function's secrets,
// then deploy. Disable Verify JWT on the function (read-only proxy).

const USDA_API_KEY = Deno.env.get('USDA_API_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!USDA_API_KEY) {
      return jsonResponse({ error: 'USDA_API_KEY is not configured' }, 500);
    }

    const body = await req.json();
    const { endpoint } = body;

    let url: string;
    if (endpoint === 'search') {
      const { query, pageSize = 5, dataType = 'SR Legacy' } = body;
      if (!query || typeof query !== 'string') {
        return jsonResponse({ error: 'Missing or invalid query' }, 400);
      }
      url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=${encodeURIComponent(dataType)}&api_key=${USDA_API_KEY}`;
    } else if (endpoint === 'detail') {
      const { fdcId } = body;
      if (typeof fdcId !== 'number') {
        return jsonResponse({ error: 'Missing or invalid fdcId' }, 400);
      }
      url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${USDA_API_KEY}`;
    } else {
      return jsonResponse({ error: 'endpoint must be "search" or "detail"' }, 400);
    }

    const res = await fetch(url);
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
