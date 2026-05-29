import * as THREE from 'three';

const fitCache = new Map<THREE.Texture, THREE.Texture>();

/**
 * Detects the bounding box of non-transparent pixels in the texture image and
 * scales the content to fill the full canvas. This normalises textures whose
 * hexagonal artwork is inset from the image edges (transparent padding), making
 * them cover the UV hex exactly the same way brick/ore do.
 *
 * Full-coverage images (brick, ore) are returned as-is after a fast scan at
 * 128×128 resolution detects no inset.
 */
export function fitTextureToHex(texture: THREE.Texture): THREE.Texture {
  if (fitCache.has(texture)) return fitCache.get(texture)!;

  const img = texture.image as HTMLImageElement;
  if (!img?.complete) return texture;

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Scan at reduced resolution for speed
  const S = 128;
  const scanCanvas = document.createElement('canvas');
  scanCanvas.width = S;
  scanCanvas.height = S;
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true })!;
  scanCtx.drawImage(img, 0, 0, S, S);
  const { data } = scanCtx.getImageData(0, 0, S, S);

  let minX = S, maxX = 0, minY = S, maxY = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (data[(y * S + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // No transparent inset found — return original unchanged
  if (minX <= 1 && minY <= 1 && maxX >= S - 2 && maxY >= S - 2) {
    fitCache.set(texture, texture);
    return texture;
  }

  if (maxX <= minX || maxY <= minY) {
    fitCache.set(texture, texture);
    return texture;
  }

  // Map bounding box back to original image coordinates
  const ratio = origW / S;
  const srcX = Math.floor(minX * ratio);
  const srcY = Math.floor(minY * ratio);
  const srcW = Math.ceil((maxX - minX + 1) * ratio);
  const srcH = Math.ceil((maxY - minY + 1) * ratio);

  // Scale so the content fills the canvas (uniform scale, centered)
  const scale = Math.max(origW / srcW, origH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const drawX = (origW - drawW) / 2;
  const drawY = (origH - drawH) / 2;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = origW;
  outCanvas.height = origH;
  const outCtx = outCanvas.getContext('2d')!;
  outCtx.drawImage(img, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);

  const newTex = new THREE.CanvasTexture(outCanvas);
  newTex.flipY = texture.flipY;
  newTex.colorSpace = texture.colorSpace;
  newTex.needsUpdate = true;

  fitCache.set(texture, newTex);
  return newTex;
}
