"use client";

import { Check, Info, X } from "lucide-react";

import { PASSWORD_RULES, checkPassword } from "@/lib/auth/password";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Live checklist under a password field.
 *
 * Shown as the user types rather than only on submit — a policy with
 * five clauses is guesswork otherwise, and rejecting an attempt one
 * rule at a time is the worst version of it.
 *
 * `aria-live="polite"` so a screen reader hears rules being satisfied
 * without the announcement interrupting typing; each row states its
 * own met/unmet status in text, since the icon alone carries the
 * meaning visually.
 */
export function PasswordRequirements({
  value,
  className,
  id,
}: {
  value: string;
  className?: string;
  /** Lets the password input point at this list via aria-describedby. */
  id?: string;
}) {
  const states = checkPassword(value);

  return (
    <ul
      id={id}
      aria-live="polite"
      className={cn("flex flex-col gap-1.5 text-xs", className)}
    >
      {states.map(({ rule, met }) => (
        <li key={rule.id} className="flex items-center gap-2">
          {met ? (
            <Check className="text-primary h-3.5 w-3.5 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              "transition-colors",
              met ? "text-primary" : "text-muted-foreground",
            )}
          >
            {rule.label}
          </span>
          <span className="sr-only">{met ? " — met" : " — not met yet"}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The small "i" that sits next to a "Password" label. Hovering (or
 * clicking, or Enter — the only routes that exist on a touch screen)
 * reveals the rules.
 *
 * Popover rather than Tooltip for the same reason InfoHint uses one: a
 * tooltip may not contain structured content, and this is a list. The
 * rules are shown flat rather than ticked off live — this is the
 * reference you consult *before* typing; whether your specific password
 * satisfies them is answered below the field, after you submit.
 */
export function PasswordRequirementsHint({
  className,
}: {
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={150}
        // type=button or it submits the form it lives in.
        type="button"
        aria-label="Password requirements"
        className={cn(
          "text-muted-foreground/70 hover:text-foreground data-popup-open:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
          className,
        )}
      >
        <Info className="size-4" />
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-72 gap-2 p-3">
        <p className="text-foreground text-sm font-medium">
          Your password needs
        </p>
        <ul className="text-muted-foreground flex flex-col gap-1.5 text-[13px]">
          {PASSWORD_RULES.map((rule) => (
            <li key={rule.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className="bg-muted-foreground/50 mt-1.5 size-1 shrink-0 rounded-full"
              />
              {rule.label}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The rules a password is currently failing, for display under the
 * field after a submit attempt.
 *
 * Renders nothing when the password passes, so the caller can mount it
 * unconditionally once the form has been submitted. `role="alert"` so
 * the failure is announced — the user pressed a button and appears, to
 * a screen reader, to have got no response otherwise.
 */
export function PasswordErrorList({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const unmet = checkPassword(value).filter((s) => !s.met);
  if (unmet.length === 0) return null;

  return (
    <ul
      role="alert"
      className={cn("flex flex-col gap-1 text-xs text-red-500", className)}
    >
      {unmet.map(({ rule }) => (
        <li key={rule.id} className="flex items-center gap-2">
          <X className="h-3.5 w-3.5 shrink-0" />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
