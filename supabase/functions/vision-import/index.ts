// Supabase Edge Function: vision-import
// Proxies Google Gemini's vision API so the key stays server-side and only
// authenticated users can spend tokens. Accepts one or more base64 images +
// a prompt, returns the extracted text for the client to parse as JSON.
//
// Deploy: copy this file's contents into a new Edge Function in the Supabase
// dashboard named "vision-import", set GEMINI_API_KEY in the function's
// secrets, then deploy. Turn Verify JWT OFF — this function verifies the
// user itself (the platform verifier can't handle ES256 asymmetric tokens).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const MODEL = 'gemini-2.5-flash';
const MAX_IMAGES = 6;

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

type ImagePart = { mimeType: string; data: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return jsonResponse({ error: 'GEMINI_API_KEY is not configured' }, 500);
    }

    // Manual auth check (platform JWT verify is off to support asymmetric keys).
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401);
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const body = await req.json();
    const { images, prompt } = body as { images?: ImagePart[]; prompt?: string };

    if (!Array.isArray(images) || images.length === 0) {
      return jsonResponse({ error: 'images must be a non-empty array' }, 400);
    }
    if (images.length > MAX_IMAGES) {
      return jsonResponse({ error: `Maximum ${MAX_IMAGES} images per request` }, 400);
    }
    if (!prompt || typeof prompt !== 'string') {
      return jsonResponse({ error: 'prompt is required' }, 400);
    }
    for (const img of images) {
      if (!img?.data || !img?.mimeType) {
        return jsonResponse({ error: 'each image needs mimeType and data' }, 400);
      }
    }

    const parts = [
      ...images.map((img) => ({
        inline_data: { mime_type: img.mimeType, data: img.data },
      })),
      { text: prompt },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 429) {
        const raw = String(data?.error?.message ?? '');
        const isDaily = /per day|PerDay/i.test(raw);
        const friendly = isDaily
          ? 'Daily extraction limit reached. Please try again tomorrow, or use Paste Text mode in the meantime.'
          : 'Too many extractions right now. Please wait a minute and try again, or use Paste Text mode.';
        return jsonResponse({ error: friendly }, 429);
      }
      return jsonResponse(
        { error: data?.error?.message ?? `Gemini returned ${res.status}` },
        res.status,
      );
    }

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('')
      .trim();

    if (!text) {
      return jsonResponse({ error: 'Gemini returned no text content' }, 502);
    }

    return jsonResponse({ text }, 200);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
