#!/usr/bin/env node
// One-off migration: walk the `recipe-images` Supabase Storage bucket and
// downscale any image whose longest side exceeds MAX_DIMENSION. Safe to re-run
// — already-small images are skipped.
//
// Setup (once):
//   npm install --no-save @supabase/supabase-js sharp
//
// Run (dry-run first to see what would change):
//   SUPABASE_URL=https://<project>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<your service role key> \
//   node scripts/downscale-storage-images.mjs --dry-run
//
// Then for real:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/downscale-storage-images.mjs
//
// The service role key is the SERVICE_ROLE (not anon) key — copy it from
// Supabase dashboard → Settings → API. Keep it secret.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'recipe-images';
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 85;
const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function formatBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

async function listAllObjects(prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 1000;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      // Directories have an `id` of null in older versions; safer to check metadata.
      if (entry.id) out.push(prefix ? `${prefix}/${entry.name}` : entry.name);
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function processOne(path) {
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr) throw new Error(`download failed: ${dlErr.message}`);
  const originalBytes = Buffer.from(await blob.arrayBuffer());
  const originalSize = originalBytes.length;

  const meta = await sharp(originalBytes).metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (!longest) {
    return { path, status: 'skipped', reason: 'no dimensions' };
  }
  if (longest <= MAX_DIMENSION) {
    return { path, status: 'skipped', reason: `already ${longest}px` };
  }

  const resized = await sharp(originalBytes)
    .rotate() // respect EXIF orientation
    .resize({
      width: meta.width >= meta.height ? MAX_DIMENSION : undefined,
      height: meta.height > meta.width ? MAX_DIMENSION : undefined,
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (DRY_RUN) {
    return {
      path,
      status: 'would-resize',
      from: `${longest}px / ${formatBytes(originalSize)}`,
      to: `${MAX_DIMENSION}px / ${formatBytes(resized.length)}`,
    };
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, resized, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  return {
    path,
    status: 'resized',
    from: `${longest}px / ${formatBytes(originalSize)}`,
    to: `${MAX_DIMENSION}px / ${formatBytes(resized.length)}`,
  };
}

async function main() {
  console.log(`Scanning bucket "${BUCKET}"${DRY_RUN ? ' (DRY RUN — no uploads)' : ''}...`);
  const paths = await listAllObjects();
  console.log(`Found ${paths.length} files.`);

  let resized = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    process.stdout.write(`[${i + 1}/${paths.length}] ${path} ... `);
    try {
      const result = await processOne(path);
      if (result.status === 'skipped') {
        skipped++;
        console.log(`skip (${result.reason})`);
      } else {
        resized++;
        console.log(`${result.status}: ${result.from} → ${result.to}`);
      }
    } catch (e) {
      failed++;
      console.log(`FAILED: ${e.message}`);
    }
  }

  console.log('');
  console.log(`Done. resized=${resized} skipped=${skipped} failed=${failed}`);
  if (DRY_RUN) console.log('Re-run without --dry-run to apply changes.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
