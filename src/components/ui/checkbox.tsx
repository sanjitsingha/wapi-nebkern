'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type CheckboxProps = Omit<React.ComponentProps<'input'>, 'checked' | 'type'> & {
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
};

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate,
  disabled,
  onChange,
  ...props
}: CheckboxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(event.target.checked);
    onChange?.(event);
  };

  return (
    <input
      ref={inputRef}
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'peer border-input bg-background accent-primary size-4 shrink-0 cursor-pointer rounded border transition-colors',
        'focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      checked={checked === undefined ? undefined : checked === true}
      defaultChecked={defaultChecked}
      disabled={disabled}
      aria-checked={
        indeterminate
          ? 'mixed'
          : checked === true
            ? 'true'
            : checked === false
              ? 'false'
              : undefined
      }
      onChange={handleChange}
      {...props}
    />
  );
}

export { Checkbox };
