"use client";

import { Check, X } from "lucide-react";

import { checkPassword } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

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
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              "transition-colors",
              met ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground",
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
