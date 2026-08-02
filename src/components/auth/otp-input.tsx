"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  /** The code so far, compact — "" through "123456". */
  value: string;
  onChange: (value: string) => void;
  /** Fired once every box is filled, with the finished code. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Lands on the first box, so a <Label htmlFor> still points somewhere. */
  id?: string;
  /** Paints every box in the destructive colour — a rejected code. */
  invalid?: boolean;
  className?: string;
}

/**
 * One box per digit, with the focus walking itself forward as you type.
 *
 * Boxes render from internal slot state rather than straight off `value`,
 * which is what stops a digit cleared out of the middle from yanking the
 * ones after it leftwards. `value` stays a plain compact string for the
 * caller, so a half-filled code is simply shorter than `length` and the
 * usual `code.length < CODE_LENGTH` submit guard keeps working — a code
 * with a hole in it can never satisfy that, so it can't be submitted.
 *
 * Autofill is why only the first box carries `one-time-code`: iOS and
 * Android offer the code from the notification on a single field, and
 * pasting all six digits into box one fans them out across the rest.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus,
  id,
  invalid,
  className,
}: OtpInputProps) {
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [slots, setSlots] = React.useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] ?? ""),
  );

  // Re-sync when the caller replaces the code out from under us — the
  // "Use another email" reset clears it to "". Compared against the
  // joined slots so our own onChange echo doesn't clobber a mid-edit
  // hole and re-pack the digits.
  React.useEffect(() => {
    if (value !== slots.join("")) {
      setSlots(Array.from({ length }, (_, i) => value[i] ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const focusBox = (i: number) => {
    const el = inputs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[]) => {
    setSlots(next);
    const joined = next.join("");
    onChange(joined);
    if (joined.length === length) onComplete?.(joined);
  };

  /** Writes `digits` across the boxes from `start`, returns the next empty. */
  const fillFrom = (start: number, digits: string) => {
    const next = [...slots];
    let i = start;
    for (const d of digits) {
      if (i >= length) break;
      next[i] = d;
      i += 1;
    }
    commit(next);
    return i;
  };

  const handleChange = (i: number, raw: string) => {
    let digits = raw.replace(/\D/g, "");

    if (!digits) {
      const next = [...slots];
      next[i] = "";
      commit(next);
      return;
    }

    // Typing into a box that already holds a digit without the browser
    // having selected it appends, giving "old+new". Drop the old one so
    // the keystroke replaces rather than spilling into the next box.
    if (slots[i] && digits.length > 1 && digits[0] === slots[i]) {
      digits = digits.slice(1);
    }

    focusBox(fillFrom(i, digits));
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      // A filled box clears itself through onChange. An empty one steps
      // back and clears the box behind it, so held-down backspace eats
      // the code right to left the way it does in a normal field.
      if (!slots[i]) {
        e.preventDefault();
        if (i > 0) {
          const next = [...slots];
          next[i - 1] = "";
          commit(next);
          focusBox(i - 1);
        }
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusBox(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusBox(length - 1);
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    focusBox(fillFrom(i, digits));
  };

  return (
    <div
      role="group"
      aria-label={`${length}-digit code`}
      className={cn("flex items-center gap-2 sm:gap-2.5", className)}
    >
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={slots[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 min-w-0 flex-1 rounded-xl border bg-muted/40 text-center text-xl font-semibold text-foreground transition-colors outline-none",
            "focus-visible:border-primary focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-primary/20",
            "disabled:pointer-events-none disabled:opacity-50",
            invalid
              ? "border-destructive/50 ring-3 ring-destructive/20"
              : "border-border",
          )}
        />
      ))}
    </div>
  );
}
