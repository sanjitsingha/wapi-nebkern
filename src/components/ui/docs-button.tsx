import { MdOutlineOpenInNew } from 'react-icons/md';

import { Button } from '@/components/ui/button';

/**
 * The app's one Documentation button, for page headers: outlined, the
 * word, then the open-in-new mark, opening the guide in a new tab.
 * Every page uses this rather than its own (docs/design-system.md §3).
 */
export function DocsButton({ href }: { href: string }) {
  return (
    <Button
      variant="outline"
      size="lg"
      nativeButton={false}
      render={<a href={href} target="_blank" rel="noopener noreferrer" />}
    >
      Documentation
      <MdOutlineOpenInNew className="size-4" />
    </Button>
  );
}
