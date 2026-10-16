'use client';

import { useState, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * A prompt box for Maya's settings: the text area, a footer with its
 * word and character count, and "Open full editor" for room to write.
 * `footerActions` sit beside that button (e.g. "Use suggested rules").
 */
export function PromptEditor({
  value,
  onChange,
  disabled = false,
  rows = 6,
  placeholder,
  labelledBy,
  maxChars,
  editorTitle,
  editorDescription,
  footerActions,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  /** id of the visible heading that names this box. */
  labelledBy?: string;
  /** Over this, the count turns red and says the limit. */
  maxChars?: number;
  editorTitle: string;
  editorDescription?: string;
  footerActions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const chars = value.trim().length;
  const tooLong = maxChars !== undefined && chars > maxChars;
  const count = (
    <span className={cn('text-xs', tooLong ? 'text-red-700' : 'text-muted-foreground')}>
      {countWords(value)} words · {chars} chars
      {tooLong && ` — at most ${maxChars}`}
    </span>
  );

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          aria-labelledby={labelledBy}
          className="resize-none rounded-none border-0 leading-relaxed shadow-none focus-visible:ring-0"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-2">
          {count}
          <div className="flex items-center gap-2">
            {footerActions}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="bg-card"
            >
              <Maximize2 className="size-3.5" />
              Open full editor
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editorTitle}</DialogTitle>
            {editorDescription && <DialogDescription>{editorDescription}</DialogDescription>}
          </DialogHeader>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={20}
            placeholder={placeholder}
            autoFocus
            className="resize-y leading-relaxed"
          />
          <DialogFooter className="items-center sm:justify-between">
            {count}
            <Button onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
