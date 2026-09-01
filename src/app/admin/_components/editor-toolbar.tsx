'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Code2,
  Minus,
  Table as TableIcon,
  Info,
  MousePointerClick,
  Smile,
  Link2,
  Image as ImageIcon,
  RemoveFormatting,
  Undo2,
  Redo2,
  Highlighter,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  ArrowDownToLine,
  Columns3,
  Rows3,
  Combine,
  Split,
  PanelTop,
  PanelLeft,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageDialog, LinkDialog } from './editor-dialogs';

// ============================================================
// The editor's formatting bar: one persistent row across the writing
// column, rather than a bubble that only appears over a selection.
//
// Button state comes from `useEditorState` with a selector, so this
// re-renders when the things it actually displays change — not on every
// keystroke, which is what subscribing to raw transactions would do.
// ============================================================

const EMOJI = [
  '😀',
  '😄',
  '😉',
  '😊',
  '🙂',
  '😍',
  '🤩',
  '🤔',
  '😴',
  '🙌',
  '👏',
  '👍',
  '👎',
  '🙏',
  '💪',
  '🔥',
  '✨',
  '🎉',
  '🚀',
  '💡',
  '⚡',
  '✅',
  '❌',
  '⚠️',
  '📌',
  '📈',
  '📉',
  '💬',
  '📣',
  '🛒',
  '💳',
  '🏷️',
  '📦',
  '🚚',
  '⏰',
  '📅',
  '⭐',
  '❤️',
  '🧡',
  '💚',
  '💙',
  '💜',
  '🥳',
  '🤝',
  '👀',
  '🎯',
  '🧠',
  '🛠️',
];

function Divider() {
  return <span className="mx-1.5 h-5 w-px shrink-0 bg-neutral-200" />;
}

function Btn({
  onClick,
  active,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      // Keep the selection: a mousedown would blur the editable surface
      // first and the command would have nothing to act on.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40',
        active
          ? 'bg-neutral-900 text-white'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      )}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      code: e.isActive('code'),
      codeBlock: e.isActive('codeBlock'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      callout: e.isActive('callout'),
      link: e.isActive('link'),
      inTable: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      block: e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : e.isActive('heading', { level: 4 })
              ? 'h4'
              : e.isActive('heading', { level: 5 })
                ? 'h5'
                : e.isActive('heading', { level: 6 })
                  ? 'h6'
                  : 'p',
    }),
  });

  const chain = () => editor.chain().focus();

  const setBlock = (value: string) => {
    if (value === 'p') chain().setParagraph().run();
    else {
      const level = Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
      chain().setHeading({ level }).run();
    }
  };

  const addCta = () => {
    const href = window.prompt(
      'Button links to (https://… or /path)',
      '/signup'
    );
    if (!href) return;
    if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
      toast.error('Use an http(s) URL or a path starting with /');
      return;
    }
    chain()
      .insertContent({
        type: 'ctaButton',
        attrs: { href },
        content: [{ type: 'text', text: 'Get started' }],
      })
      .run();
  };

  return (
    <div className="sticky top-14 z-10 border-y border-neutral-200 bg-white/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-0.5 px-8 py-2 sm:px-12">
        {/* Block type — a select rather than a menu so every level is
            one click away and the current one is always visible. */}
        <Select
          items={{
            p: 'Paragraph',
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            h4: 'Heading 4',
            h5: 'Heading 5',
            h6: 'Heading 6',
          }}
          value={state.block}
          onValueChange={(v) => setBlock(v ?? state.block)}
        >
          <SelectTrigger
            onMouseDown={(e) => e.stopPropagation()}
            aria-label="Text style"
            className="mr-1 h-8 gap-1 rounded-md border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 data-[size=default]:h-8"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
            <SelectItem value="h4">Heading 4</SelectItem>
            <SelectItem value="h5">Heading 5</SelectItem>
            <SelectItem value="h6">Heading 6</SelectItem>
          </SelectContent>
        </Select>

        <Divider />

        <Btn
          label="Bold  (Ctrl+B)"
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Btn>
        <Btn
          label="Italic  (Ctrl+I)"
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Btn>
        <Btn
          label="Underline  (Ctrl+U)"
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-4" />
        </Btn>
        <Btn
          label="Strikethrough"
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough className="size-4" />
        </Btn>
        <Btn
          label="Highlight"
          active={state.highlight}
          onClick={() => chain().toggleHighlight().run()}
        >
          <Highlighter className="size-4" />
        </Btn>
        <Btn
          label="Inline code"
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <Code className="size-4" />
        </Btn>

        <Divider />

        <Btn
          label="Bullet list"
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List className="size-4" />
        </Btn>
        <Btn
          label="Numbered list"
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </Btn>
        <Btn
          label="Checklist"
          active={state.taskList}
          onClick={() => chain().toggleTaskList().run()}
        >
          <ListChecks className="size-4" />
        </Btn>

        <Divider />

        <Btn
          label="Quote"
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote className="size-4" />
        </Btn>
        <Btn
          label="Code block"
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <Code2 className="size-4" />
        </Btn>
        <Btn
          label="Callout / info box"
          active={state.callout}
          onClick={() => chain().toggleWrap('callout').run()}
        >
          <Info className="size-4" />
        </Btn>

        <Divider />

        <Btn label="Link" active={state.link} onClick={() => setLinkOpen(true)}>
          <Link2 className="size-4" />
        </Btn>
        <Btn label="Image" onClick={() => setImageOpen(true)}>
          <ImageIcon className="size-4" />
        </Btn>
        <Btn label="Button (CTA)" onClick={addCta}>
          <MousePointerClick className="size-4" />
        </Btn>
        <Btn
          label={state.inTable ? 'Delete table' : 'Insert table'}
          active={state.inTable}
          onClick={() =>
            state.inTable
              ? chain().deleteTable().run()
              : chain()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
          }
        >
          <TableIcon className="size-4" />
        </Btn>
        <Btn label="Divider" onClick={() => chain().setHorizontalRule().run()}>
          <Minus className="size-4" />
        </Btn>

        {/* Emoji. A fixed grid rather than a picker dependency — the
            list covers what a marketing post reaches for, and the OS
            picker (Win+. / Ctrl+Cmd+Space) handles everything else. */}
        <div className="relative">
          <Btn
            label="Emoji"
            active={emojiOpen}
            onClick={() => setEmojiOpen((v) => !v)}
          >
            <Smile className="size-4" />
          </Btn>
          {emojiOpen && (
            <>
              {/* Click-away. Sits under the panel, over everything else. */}
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setEmojiOpen(false)}
              />
              <div className="absolute top-full left-0 z-30 mt-1 grid w-64 grid-cols-8 gap-0.5 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                {EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      chain().insertContent(e).run();
                      setEmojiOpen(false);
                    }}
                    className="flex size-7 items-center justify-center rounded text-base hover:bg-neutral-100"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <Divider />

        <Btn
          label="Clear formatting"
          onClick={() => chain().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="size-4" />
        </Btn>

        <div className="ml-auto flex items-center gap-0.5">
          <Btn
            label="Undo  (Ctrl+Z)"
            disabled={!state.canUndo}
            onClick={() => chain().undo().run()}
          >
            <Undo2 className="size-4" />
          </Btn>
          <Btn
            label="Redo  (Ctrl+Shift+Z)"
            disabled={!state.canRedo}
            onClick={() => chain().redo().run()}
          >
            <Redo2 className="size-4" />
          </Btn>
        </div>
      </div>

      {/* Table row — only while the caret is inside a table. A second
          row rather than a floating menu: table editing is a burst of
          several operations in a row, and a menu that re-positions
          itself after each one is exhausting to aim at. */}
      {state.inTable && (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-neutral-200 bg-neutral-50 px-8 py-1.5 sm:px-12">
          <span className="mr-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            Table
          </span>

          <Btn
            label="Insert column before"
            onClick={() => chain().addColumnBefore().run()}
          >
            <ArrowLeftToLine className="size-4" />
          </Btn>
          <Btn
            label="Insert column after"
            onClick={() => chain().addColumnAfter().run()}
          >
            <ArrowRightToLine className="size-4" />
          </Btn>
          <Btn
            label="Delete column"
            onClick={() => chain().deleteColumn().run()}
          >
            <Columns3 className="size-4" />
          </Btn>

          <Divider />

          <Btn
            label="Insert row above"
            onClick={() => chain().addRowBefore().run()}
          >
            <ArrowUpToLine className="size-4" />
          </Btn>
          <Btn
            label="Insert row below"
            onClick={() => chain().addRowAfter().run()}
          >
            <ArrowDownToLine className="size-4" />
          </Btn>
          <Btn label="Delete row" onClick={() => chain().deleteRow().run()}>
            <Rows3 className="size-4" />
          </Btn>

          <Divider />

          <Btn
            label="Toggle header row"
            onClick={() => chain().toggleHeaderRow().run()}
          >
            <PanelTop className="size-4" />
          </Btn>
          <Btn
            label="Toggle header column"
            onClick={() => chain().toggleHeaderColumn().run()}
          >
            <PanelLeft className="size-4" />
          </Btn>
          <Btn label="Merge cells" onClick={() => chain().mergeCells().run()}>
            <Combine className="size-4" />
          </Btn>
          <Btn label="Split cell" onClick={() => chain().splitCell().run()}>
            <Split className="size-4" />
          </Btn>

          <Divider />

          <Btn label="Delete table" onClick={() => chain().deleteTable().run()}>
            <Trash2 className="size-4" />
          </Btn>

          <span className="ml-auto text-[11px] text-neutral-500">
            Drag a column edge to resize
          </span>
        </div>
      )}

      {/* Mounted only while open: each opens with fresh state, which is
          what makes the dialogs effect-free. */}
      {imageOpen && (
        <ImageDialog
          onOpenChange={setImageOpen}
          onInsert={(src, alt) => chain().setImage({ src, alt }).run()}
        />
      )}

      {linkOpen && (
        <LinkDialog
          onOpenChange={setLinkOpen}
          hasLink={state.link}
          initialHref={(editor.getAttributes('link').href as string) ?? ''}
          onSubmit={(href) => chain().setLink({ href }).run()}
          onRemove={() => chain().unsetLink().run()}
        />
      )}
    </div>
  );
}
