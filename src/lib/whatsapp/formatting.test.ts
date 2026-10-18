import { describe, expect, it } from 'vitest';

import { parseWhatsAppFormatting as parse } from './formatting';

describe('parseWhatsAppFormatting', () => {
  it('reads bold, italic and strikethrough', () => {
    expect(parse('Hi *Asha*, _thanks_ ~sorry~')).toEqual([
      { text: 'Hi ' },
      { text: 'Asha', bold: true },
      { text: ', ' },
      { text: 'thanks', italic: true },
      { text: ' ' },
      { text: 'sorry', strike: true },
    ]);
  });

  it('nests styles', () => {
    expect(parse('*_both_*')).toEqual([{ text: 'both', bold: true, italic: true }]);
  });

  it('leaves markers that do not hug the text', () => {
    expect(parse('* not bold *')).toEqual([{ text: '* not bold *' }]);
  });

  it('leaves markers inside a word', () => {
    expect(parse('2*3*4 and snake_case_name')).toEqual([{ text: '2*3*4 and snake_case_name' }]);
  });

  it('does not format across lines', () => {
    expect(parse('*one\ntwo*')).toEqual([{ text: '*one\ntwo*' }]);
  });

  it('takes monospace literally', () => {
    expect(parse('Code: ```*x* _y_```')).toEqual([
      { text: 'Code: ' },
      { text: '*x* _y_', mono: true },
    ]);
  });

  it('formats after punctuation', () => {
    expect(parse('(*sale*)')).toEqual([{ text: '(' }, { text: 'sale', bold: true }, { text: ')' }]);
  });
});
