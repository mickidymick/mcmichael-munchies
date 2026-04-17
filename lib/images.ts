import { Platform } from 'react-native';
import { encode } from 'blurhash';

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_JPEG_QUALITY = 0.85;

export type DownscaleOptions = {
  maxDimension?: number;
  quality?: number;
};

/**
 * Downscales an image blob on web so uploads stay small and carousels/thumbnails
 * load fast. On native we return the blob unchanged — expo-image-picker's
 * quality setting already trims size, and we don't want to pull in
 * expo-image-manipulator just for this.
 */
export async function downscaleImageBlob(
  blob: Blob,
  { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_JPEG_QUALITY }: DownscaleOptions = {},
): Promise<Blob> {
  if (Platform.OS !== 'web') return blob;
  if (!blob.type.startsWith('image/')) return blob;

  try {
    const bitmap = await createImageBitmap(blob);
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= maxDimension) {
      bitmap.close?.();
      return blob;
    }
    const scale = maxDimension / longest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close?.();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const out: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        'image/jpeg',
        quality,
      ),
    );
    return out;
  } catch {
    return blob;
  }
}

/**
 * Generate a blurhash string from an image blob (web only).
 * Returns null on native or on failure.
 */
export async function generateBlurhash(blob: Blob): Promise<string | null> {
  if (Platform.OS !== 'web') return null;
  try {
    const bitmap = await createImageBitmap(blob);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return null; }
    ctx.drawImage(bitmap, 0, 0, size, size);
    bitmap.close?.();
    const imageData = ctx.getImageData(0, 0, size, size);
    return encode(imageData.data, size, size, 4, 3);
  } catch {
    return null;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch a URI into a blob and downscale on web. Used by recipe uploads and
 * vision extraction so both paths share the same size cap.
 */
export async function fetchAndDownscale(
  uri: string,
  options?: DownscaleOptions,
): Promise<{ blob: Blob; mimeType: string }> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const downscaled = await downscaleImageBlob(blob, options);
  return {
    blob: downscaled,
    mimeType: downscaled.type || blob.type || 'image/jpeg',
  };
}
