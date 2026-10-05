/**
 * Photo compression, done on the phone before anything is uploaded.
 *
 * A modern phone camera produces 4–8 MB per photo. Over a weak mobile
 * connection that can take minutes and often fails halfway. Resizing to
 * 1600px on the long edge and re-encoding as JPEG typically brings a site
 * photo under 400 KB, which is good enough to see cracked blockwork or a
 * delivery note and small enough to actually arrive.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.75;

export function targetDimensions(width, height, maxEdge = MAX_EDGE) {
  if (width <= maxEdge && height <= maxEdge) return { width, height };

  const scale = maxEdge / Math.max(width, height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Returns a compressed JPEG File. If anything goes wrong the original is
 * returned unchanged — a large photo is better than no photo.
 */
export async function compressImage(file, { maxEdge = MAX_EDGE, quality = QUALITY } = {}) {
  if (!file.type.startsWith('image/')) return file;

  try {
    const img = await loadImage(file);
    const { width, height } = targetDimensions(img.width, img.height, maxEdge);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
