export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ImageFrame extends ImageBounds {
  naturalWidth: number;
  naturalHeight: number;
  viewBox: string;
}

const MAX_SAMPLE_SIZE = 256;
const ALPHA_THRESHOLD = 1;
const CONTENT_MARGIN = 0.03;

/**
 * Find meaningful alpha bounds, preserving a small margin around soft edges.
 * No useful outer transparency means the original image needs no reframing.
 */
export function visibleBounds(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): ImageBounds | undefined {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    rgba.length < width * height * 4
  )
    return undefined;

  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);
    }
  }
  if (right < 0 || bottom < 0) return undefined;
  const margin = Math.max(
    1,
    Math.ceil(Math.max(right - left, bottom - top) * CONTENT_MARGIN),
  );
  left = Math.max(0, left - margin);
  top = Math.max(0, top - margin);
  right = Math.min(width, right + margin);
  bottom = Math.min(height, bottom + margin);
  if (left === 0 && top === 0 && right === width && bottom === height)
    return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Read only the image already loaded by the card. Canvas is used for a bounded
 * alpha sample, never to create an image asset or make another network request.
 * External images without canvas permission keep the regular <img> fallback.
 */
export function getImageFrame(image: HTMLImageElement): ImageFrame | undefined {
  try {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (
      image.complete === false ||
      !Number.isFinite(naturalWidth) ||
      !Number.isFinite(naturalHeight) ||
      naturalWidth <= 0 ||
      naturalHeight <= 0
    )
      return undefined;
    const scale = Math.min(
      1,
      MAX_SAMPLE_SIZE / Math.max(naturalWidth, naturalHeight),
    );
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = image.ownerDocument.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return undefined;
    context.drawImage(image, 0, 0, width, height);
    const bounds = visibleBounds(
      context.getImageData(0, 0, width, height).data,
      width,
      height,
    );
    if (!bounds) return undefined;
    // X/Y scales are separate because sampling dimensions are rounded.
    const x = (bounds.x * naturalWidth) / width;
    const y = (bounds.y * naturalHeight) / height;
    const frameWidth = (bounds.width * naturalWidth) / width;
    const frameHeight = (bounds.height * naturalHeight) / height;
    return {
      x,
      y,
      width: frameWidth,
      height: frameHeight,
      naturalWidth,
      naturalHeight,
      viewBox: `${x} ${y} ${frameWidth} ${frameHeight}`,
    };
  } catch {
    // Tainted canvas, unreadable pixel data or an image that disappeared.
    return undefined;
  }
}
