// ============================================================
// WhatsApp's text formatting, parsed into styled runs — so a preview
// (the quick-reply editor's, for one) shows a message the way the
// customer's phone will:
//
//   *bold*   _italic_   ~strikethrough~   ```monospace```
//
// Following WhatsApp's own rules: a marker only counts when it hugs the
// text (`* not bold *` stays as typed) and isn't inside a word
// (`2*3*4` stays as typed); bold, italic and strikethrough nest
// (`*_both_*`); they don't span lines; and nothing inside ``` ``` is
// formatted.
// ============================================================

export interface FormattedRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  mono?: boolean;
}

type Style = Omit<FormattedRun, 'text'>;

/** One marker pair: preceded by a non-word character (or the start),
 *  hugging its text, followed by a non-word character (or the end). */
const INLINE = /(^|[^\p{L}\p{N}])([*_~])(?!\s)((?:(?!\2).)+?)(?<!\s)\2(?![\p{L}\p{N}])/u;

const STYLE_OF: Record<string, keyof Style> = { '*': 'bold', _: 'italic', '~': 'strike' };

function parseInline(text: string, style: Style): FormattedRun[] {
  const out: FormattedRun[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ text: rest, ...style });
      break;
    }
    const open = m.index + m[1].length;
    if (open > 0) out.push({ text: rest.slice(0, open), ...style });
    out.push(...parseInline(m[3], { ...style, [STYLE_OF[m[2]]]: true }));
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function parseWhatsAppFormatting(text: string): FormattedRun[] {
  const runs: FormattedRun[] = [];
  // Monospace first: its insides are taken literally.
  const parts = text.split(/```([\s\S]+?)```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) runs.push({ text: part, mono: true });
    else runs.push(...parseInline(part, {}));
  });
  return runs.filter((r) => r.text.length > 0);
}
