// Luca embeds structured action payloads in its replies as HTML-comment-style
// markers (e.g. `<!--FACTURE_DATA {...} FACTURE_DATA-->`). This parses them out
// and strips them from the text shown to the user.
export const ACTION_MARKERS = [
  'FACTURE_DATA',
  'CLIENT_DATA',
  'ENTREPRISE_DATA',
  'PREVISIONNEL_DATA',
  'NOTE_FRAIS_DATA',
] as const;

export type ActionMarker = typeof ACTION_MARKERS[number];

export function parseActionData<T>(text: string, marker: ActionMarker): T | null {
  const re = new RegExp(`<!--${marker}\\s*([\\s\\S]*?)\\s*${marker}-->`);
  const match = text.match(re);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

export function stripActionData(text: string, marker: ActionMarker): string {
  return text.replace(new RegExp(`<!--${marker}[\\s\\S]*?${marker}-->`, 'g'), '').trim();
}
