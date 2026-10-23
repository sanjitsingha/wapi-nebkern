import { describe, expect, it } from 'vitest';

import { hubspotNoteBody, noteHeading } from './note-sync';

describe('CRM note copies', () => {
  it('head the note with who wrote it', () => {
    expect(noteHeading('Asha Rao')).toBe('Note by Asha Rao · Dripo');
  });

  it('turn the text into escaped paragraphs for HubSpot, blank lines kept', () => {
    expect(hubspotNoteBody('Asha', 'Wants <b>bulk</b> pricing\n\nCall back Monday')).toBe(
      '<p><strong>Note by Asha · Dripo</strong></p>' +
        '<p>Wants &lt;b&gt;bulk&lt;/b&gt; pricing</p><p><br></p><p>Call back Monday</p>',
    );
  });
});
