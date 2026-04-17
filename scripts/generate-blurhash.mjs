#!/usr/bin/env node
// Generate blurhash strings for all recipes that have an image_url but no blurhash.
// Requires: npm install --no-save @supabase/supabase-js sharp blurhash
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-blurhash.mjs

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { encode } from 'blurhash';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id,title,image_url,blurhash')
    .not('image_url', 'is', null);

  if (error) { console.error(error); process.exit(1); }

  const toProcess = recipes.filter((r) => r.image_url && !r.blurhash);
  console.log(`Found ${recipes.length} recipes with images, ${toProcess.length} need blurhash.`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const recipe = toProcess[i];
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${recipe.title} ... `);
    try {
      const res = await fetch(recipe.image_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      // Resize to small thumbnail for fast blurhash encoding
      const { data, info } = await sharp(buf)
        .resize(32, 32, { fit: 'cover' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const hash = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        4, // componentX
        3, // componentY
      );

      const { error: upErr } = await supabase
        .from('recipes')
        .update({ blurhash: hash })
        .eq('id', recipe.id);

      if (upErr) throw upErr;
      updated++;
      console.log(hash);
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
    }
  }

  console.log(`\nDone. updated=${updated} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
