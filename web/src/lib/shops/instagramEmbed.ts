// Validates and normalizes an Instagram post/reel/tv URL into the exact
// permalink shape the official embed blockquote needs (scheme + host +
// trailing slash, no query string/tracking params). Returns null for
// anything that isn't a recognizable Instagram post URL.
const INSTAGRAM_POST_PATTERN = /^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([^/?#]+)/i;

export function getInstagramEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(INSTAGRAM_POST_PATTERN);
  if (!match) return null;
  return `https://www.instagram.com/${match[1]}/${match[2]}/`;
}
