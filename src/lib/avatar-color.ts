// Deterministic avatar colours, WhatsApp-style: the same seed (contact
// id / phone / name) always maps to the same tonal pair, so a contact's
// initial-avatar stays stable across renders and sessions.
//
// Each entry is a same-family pair — a deep, muted `bg` with a brighter
// `fg` of the same hue for the initial on top (not white).

export interface AvatarColor {
  bg: string;
  fg: string;
}

const AVATAR_COLORS: AvatarColor[] = [
  { bg: '#14532d', fg: '#4ade80' }, // green
  { bg: '#7c2d12', fg: '#fb923c' }, // orange
  { bg: '#78350f', fg: '#fbbf24' }, // amber
  { bg: '#134e4a', fg: '#2dd4bf' }, // teal
  { bg: '#164e63', fg: '#22d3ee' }, // cyan
  { bg: '#1e3a8a', fg: '#60a5fa' }, // blue
  { bg: '#312e81', fg: '#818cf8' }, // indigo
  { bg: '#4c1d95', fg: '#a78bfa' }, // violet
  { bg: '#701a75', fg: '#e879f9' }, // fuchsia
  { bg: '#831843', fg: '#f472b6' }, // pink
  { bg: '#881337', fg: '#fb7185' }, // rose
  { bg: '#7f1d1d', fg: '#f87171' }, // red
  { bg: '#3f6212', fg: '#a3e635' }, // lime
];

/** Pick a stable tonal colour pair for a seed via a simple string hash. */
export function avatarColor(seed: string | null | undefined): AvatarColor {
  const key = seed && seed.length > 0 ? seed : '?';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
