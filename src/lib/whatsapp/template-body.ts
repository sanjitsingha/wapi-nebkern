/**
 * Fill a template body's {{1}}, {{2}}, … placeholders with param values —
 * the text the recipient actually reads, the same shape the inbox stores
 * on messages.content_text for a template send.
 *
 * A placeholder with no value is left as written rather than blanked, so
 * a missing variable shows up in the chat instead of reading as a gap.
 */
export function renderTemplateBody(body: string, params: string[]): string {
  if (!body) return '';
  return body.replace(
    /\{\{\s*(\d+)\s*\}\}/g,
    (_m, n: string) => params[Number(n) - 1] ?? `{{${n}}}`,
  );
}
