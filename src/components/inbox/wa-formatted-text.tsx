import { cn } from '@/lib/utils';
import { parseWhatsAppFormatting } from '@/lib/whatsapp/formatting';

/**
 * Message text as WhatsApp shows it: *bold*, _italic_, ~strikethrough~
 * and ```monospace``` applied, markers hidden, line breaks kept.
 */
export function WaFormattedText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn('break-words whitespace-pre-wrap', className)}>
      {parseWhatsAppFormatting(text).map((run, i) => (
        <span
          key={i}
          className={cn(
            run.bold && 'font-semibold',
            run.italic && 'italic',
            run.strike && 'line-through',
            run.mono && 'font-mono text-[0.92em]',
          )}
        >
          {run.text}
        </span>
      ))}
    </p>
  );
}
