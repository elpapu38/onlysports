// Convierte lo que el usuario pegó al cargar un canal (una URL de
// YouTube/Twitch/Vimeo, un enlace M3U8, etc.) en algo reproducible:
// una URL de embed (iframe) o una URL de stream cruda (<video>/hls.js).

export type EmbedKind = "youtube" | "twitch" | "vimeo" | "hls" | "video" | "link";

export interface ChannelEmbed {
  kind: EmbedKind;
  embedUrl?: string; // para iframes (youtube/twitch/vimeo)
  streamUrl?: string; // para <video>/hls.js (m3u8, mp4, webm, url genérica)
}

function extractYouTubeId(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1) || null;
    const v = url.searchParams.get("v");
    if (v) return v;
    const liveMatch = url.pathname.match(/\/live\/([^/?]+)/);
    if (liveMatch) return liveMatch[1];
    const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/);
    if (embedMatch) return embedMatch[1];
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    // No era una URL válida: asumimos que ya nos pasaron el ID pelado.
    return value || null;
  }
}

function extractTwitchChannel(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] || value;
  } catch {
    return value;
  }
}

function extractVimeoId(value: string): string | null {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return value || null;
  }
}

/**
 * `embedHost` tiene que ser el hostname exacto desde el que se sirve
 * la app (ej. "localhost") — Twitch exige que el parámetro `parent`
 * del embed coincida con el dominio que lo aloja, si no, no reproduce.
 */
export function buildChannelEmbed(type: string, value: string, embedHost: string): ChannelEmbed {
  switch (type) {
    case "YOUTUBE": {
      const id = extractYouTubeId(value);
      return id
        ? { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` }
        : { kind: "link", streamUrl: value };
    }
    case "TWITCH": {
      const channel = extractTwitchChannel(value);
      return {
        kind: "twitch",
        embedUrl: `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(embedHost)}&muted=true`,
      };
    }
    case "VIMEO": {
      const id = extractVimeoId(value);
      return id ? { kind: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}` } : { kind: "link", streamUrl: value };
    }
    case "M3U8":
      return { kind: "hls", streamUrl: value };
    case "MP4":
    case "WEBM":
      return { kind: "video", streamUrl: value };
    default:
      return { kind: "link", streamUrl: value };
  }
}
