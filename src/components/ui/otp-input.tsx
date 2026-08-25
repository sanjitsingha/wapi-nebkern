'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

// ============================================================
// A six-box one-time-code field.
//
// Six real <input>s rather than one input drawn to look like six: a
// single field with letter-spacing tricks looks right until someone
// backspaces from the middle, and screen readers announce it as one
// value with no sense of position.
//
// The behaviours that make or break this pattern, all handled below:
//
//   paste       a six-digit code pasted into ANY box fills all six.
//               This is how most people enter it — copy from the
//               authenticator, paste, done.
//   backspace   on an empty box, steps back and clears the previous
//               one. Without this, deleting a typo means clicking.
//   arrows      left/right move between boxes, so it behaves like the
//               single field it is pretending to be.
//   overtype    typing in a full box replaces rather than being
//               swallowed, and advances.
//
// `value` is the whole code and `onChange` reports the whole code, so
// the caller never thinks in boxes — it holds one string.
// ============================================================

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  invalid = false,
  ariaLabel = 'One-time code',
  className,
}: {
  /** The code so far. Shorter than `length` leaves later boxes empty. */
  value: string;
  onChange: (next: string) => void;
  /** Fired when the last box is filled — usually submits. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Paints the error state. The message itself belongs to the caller. */
  invalid?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // One slot per box. A gap in the middle is a SPACE, not a missing
  // character, so a cleared box stays a hole instead of pulling the
  // digits after it one box to the left. `value` is padded to length
  // for reading and trimmed on the way out (see `report`).
  const digits = Array.from({ length }, (_, i) => value[i] ?? ' ');

  const focusBox = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  /**
   * Hand the slot array back up as a string.
   *
   * Trailing gaps are dropped so a half-typed code is just its digits —
   * "12" not "12    " — which is what a length check upstream expects.
   * Interior gaps survive as spaces: they are what stops box 3 of
   * "1_3456" being read as the "3". A code with a hole in it is
   * incomplete by definition, so it never passes the `isComplete` test
   * below and can never be submitted.
   */
  const report = (arr: string[]) => {
    const next = arr.join('').replace(/ +$/, '');
    onChange(next);
    return next;
  };

  /** True only when every slot holds a digit. */
  const isComplete = (code: string) =>
    code.length === length && !code.includes(' ');

  /** Write one digit at `index`. Pass '' to clear the slot. */
  const setDigit = (index: number, digit: string) => {
    const arr = digits.slice();
    arr[index] = digit || ' ';
    return report(arr);
  };

  const handleChange = (index: number, raw: string) => {
    // A box can receive more than one character — Android keyboards and
    // autofill both do it — so treat any multi-digit input as a paste
    // starting at this box rather than dropping all but the first.
    const digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) return;

    if (digitsOnly.length > 1) {
      fill(index, digitsOnly);
      return;
    }

    const next = setDigit(index, digitsOnly);
    if (index < length - 1) focusBox(index + 1);
    if (isComplete(next)) onComplete?.(next);
  };

  /** Spread `incoming` across the boxes from `start`. */
  const fill = (start: number, incoming: string) => {
    const chars = incoming.replace(/\D/g, '').split('');
    const arr = digits.slice();
    let i = start;
    for (const c of chars) {
      if (i >= length) break;
      arr[i] = c;
      i += 1;
    }
    const next = report(arr);
    // Land on the first gap, or the last box when there is none —
    // wherever the user would want to keep typing.
    const firstGap = next.indexOf(' ');
    focusBox(
      firstGap !== -1 ? firstGap : next.length >= length ? length - 1 : next.length,
    );
    if (isComplete(next)) onComplete?.(next);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      // `!== ' '` rather than a truthiness check: an empty slot holds a
      // space, which is truthy, and would swallow the keystroke here
      // instead of stepping back to the previous box.
      if (digits[index] !== ' ') {
        setDigit(index, '');
        return;
      }
      // Empty box: clear the one before and go there.
      if (index > 0) {
        setDigit(index - 1, '');
        focusBox(index - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusBox(index - 1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/\d/.test(text)) return;
    e.preventDefault();
    fill(index, text);
  };

  return (
    // `role="group"` with a label: without it a screen reader meets six
    // unrelated single-character fields and never says what they are for.
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn('flex items-center gap-2 sm:gap-2.5', className)}
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          // Only the first box advertises itself for autofill. On all
          // six, iOS and the password managers offer the code once per
          // box and fight each other for the field.
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          // maxLength 1 keeps a box to a digit; the change handler still
          // sees longer strings from paste and autofill, and spreads them.
          maxLength={1}
          // A gap slot carries a space internally; the box shows empty.
          value={digit === ' ' ? '' : digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            'h-13 w-full min-w-0 rounded-xl border text-center font-mono text-lg font-semibold',
            'bg-muted/40 text-foreground transition-colors outline-none',
            'focus-visible:border-primary focus-visible:bg-background focus-visible:ring-primary/20 focus-visible:ring-[3px]',
            'disabled:opacity-50',
            invalid
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-border',
          )}
        />
      ))}
    </div>
  );
}
