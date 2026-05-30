import * as THREE from 'three';

const fitCache = new Map<THREE.Texture, THREE.Texture>();

// Crops transparent padding from hex-shaped PNGs and scales content to cover the UV hex.
export function fitTextureToHex(texture: THREE.Texture): THREE.Texture {
  if (fitCache.has(texture)) return fitCache.get(texture)!;

  const img = texture.image as HTMLImageElement;
  if (!img?.complete) return texture;

  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

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

  if (minX <= 1 && minY <= 1 && maxX >= S - 2 && maxY >= S - 2) {
    fitCache.set(texture, texture);
    return texture;
  }

  if (maxX <= minX || maxY <= minY) {
    fitCache.set(texture, texture);
    return texture;
  }

  const ratio = origW / S;
  const srcX = Math.floor(minX * ratio);
  const srcY = Math.floor(minY * ratio);
  const srcW = Math.ceil((maxX - minX + 1) * ratio);
  const srcH = Math.ceil((maxY - minY + 1) * ratio);

  // Use Math.max (cover) so the hex content overshoots the canvas edges rather
  // than fitting inside — this ensures the UV hex samples opaque pixels everywhere.
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
  newTex.colorSpace = THREE.SRGBColorSpace;
  newTex.needsUpdate = true;

  fitCache.set(texture, newTex);
  return newTex;
}
