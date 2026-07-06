import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders as a native checkbox input', () => {
    const html = renderToStaticMarkup(
      <Checkbox checked onCheckedChange={() => {}} />
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });
});
