/** Extract the hostname from a URL, or null if invalid */
export function getDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Google favicon service URL for a given domain */
export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`;
}
