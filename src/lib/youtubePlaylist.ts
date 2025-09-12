// Lightweight YouTube playlist scraper without API key.
// Uses public CORS proxies to fetch the playlist HTML and extracts video IDs.

const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

export function extractPlaylistId(url: string): string | null {
  try {
    const u = new URL(url);
    const list = u.searchParams.get('list');
    if (list) return list;
  } catch {
    // not a full URL? Try to accept raw playlist ID
    if (/^[A-Za-z0-9_-]+$/.test(url)) return url;
  }
  return null;
}

export async function fetchPlaylistVideoIds(playlistIdOrUrl: string, maxItems = 50): Promise<string[]> {
  const playlistId = extractPlaylistId(playlistIdOrUrl) || playlistIdOrUrl;
  const target = `https://www.youtube.com/playlist?list=${playlistId}`;

  let lastError: any;
  for (const proxy of PROXIES) {
    const proxied = proxy(target);
    try {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 12000);
      const resp = await fetch(proxied, { signal: controller.signal });
      clearTimeout(to);
      if (!resp.ok) continue;
      const html = await resp.text();
      const ids = extractVideoIdsFromHtml(html);
      if (ids.length) return ids.slice(0, maxItems);
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  if (lastError) {
    console.warn('All proxies failed for playlist fetch:', lastError);
  }
  return [];
}

function extractVideoIdsFromHtml(html: string): string[] {
  const ids = new Set<string>();
  // Look for watch?v=VIDEOID patterns
  const re = /watch\?v=([A-Za-z0-9_-]{11})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }

  // Also parse JSON initialData blocks if present
  try {
    const jsonMatches = html.match(/\{\"responseContext[\s\S]*?\}\);/g) || [];
    for (const jm of jsonMatches) {
      const trimmed = jm.replace(/\);$/, '');
      const data = JSON.parse(trimmed);
      const contents = JSON.stringify(data);
      const re2 = /\"videoId\":\"([A-Za-z0-9_-]{11})\"/g;
      let m2: RegExpExecArray | null;
      while ((m2 = re2.exec(contents)) !== null) {
        ids.add(m2[1]);
      }
    }
  } catch {
    // ignore JSON parse failures
  }

  return Array.from(ids);
}
