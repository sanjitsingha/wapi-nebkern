import { Node, mergeAttributes } from '@tiptap/core';

// ============================================================
// The two block types TipTap does not ship: a callout box and a CTA
// button.
//
// Both are deliberately plain HTML rather than custom React node views.
// Post bodies are stored as an HTML string and re-rendered on the
// public article with `dangerouslySetInnerHTML` — nothing over there
// knows TipTap exists. A node view would look right in the editor and
// vanish on the live page, so what these render is exactly what gets
// saved, and the two stylesheets (src/styles/post-content.css for the
// editor, src/app/(marketing)/blog/post-content.css for the article)
// style the same markup.
//
// The `data-` attribute, not the class, is what `parseHTML` matches on:
// classes are for styling and may be restyled or renamed, whereas the
// data attribute is the contract that lets a saved post round-trip back
// into the editor as the right node type.
// ============================================================

/** A tinted box for an aside, a warning, or a note. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  // `defining` keeps the box itself when its contents are replaced —
  // without it, selecting everything inside and typing deletes the
  // callout too.
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        class: 'post-callout',
      }),
      0,
    ];
  },
});

/** A link styled as a button. Block-level so it sits on its own line
 *  the way a call to action does, with its label still editable. */
export const CtaButton = Node.create({
  name: 'ctaButton',
  group: 'block',
  content: 'inline*',
  // No marks inside: a bold-italic-underlined button is never what
  // anyone wanted, and the styling is the point of the node.
  marks: '',
  defining: true,

  addAttributes() {
    return {
      href: {
        default: '#',
        parseHTML: (element) => element.getAttribute('href') ?? '#',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-cta]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-cta': '',
        class: 'post-cta',
      }),
      0,
    ];
  },
});
