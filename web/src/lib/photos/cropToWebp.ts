export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImageElement(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Afbeelding kon niet worden gelezen."));
    img.src = imageSrc;
  });
}

// Draws the cropped region onto a canvas scaled to at most maxDimension on
// its long edge, then encodes straight to WebP — crop, resize, and
// compress all happen in this one canvas pass rather than a separate
// compression library/step.
export async function cropToWebp(
  imageSrc: string,
  crop: CropPixels,
  maxDimension: number,
  quality: number,
): Promise<Blob> {
  const img = await loadImageElement(imageSrc);

  const scale = Math.min(1, maxDimension / Math.max(crop.width, crop.height));
  const outputWidth = Math.round(crop.width * scale);
  const outputHeight = Math.round(crop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas wordt niet ondersteund in deze browser.");
  }
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, outputWidth, outputHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Foto comprimeren is mislukt."));
      },
      "image/webp",
      quality,
    );
  });
}
