// HEIC/HEIF (iPhone's default capture format) can't be decoded by <canvas>/
// <img> in any browser, so it has to be converted client-side before the
// rest of the photo pipeline (crop/compress) can touch it at all.
export function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Safari sometimes reports an empty or generic MIME type for HEIC files
  // picked via the native file input — fall back to the extension.
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif");
}

export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}
