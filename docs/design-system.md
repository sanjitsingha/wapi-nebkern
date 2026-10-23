# Dripo — UI design system

The rules every screen in Dripo follows, so a new screen looks like it
was always part of the app. They come from the product owner's own
corrections to real screens; when one of these rules and a "nicer" idea
disagree, the rule wins.

**Before building or changing any UI:**

1. Find the closest existing screen (the reference screens are listed at
   the end) and copy its structure and classes. Don't invent a new
   pattern when one exists.
2. Check the result against every rule below.
3. If the owner corrects a screen, add the correction here in the same
   change, so the rule holds everywhere from then on.

---

## 1. Principles

- **Quiet and minimal.** Show what the user needs to act on, and nothing
  else. No explanatory paragraphs, no "Live analytics…" lines, no
  per-record status lines, no counts nobody asked for.
- **One frame per thing.** A section, card or list has one border. A box
  never sits inside another box. If something lives inside a framed
  section, it has no frame of its own.
- **Grey, not colour.** Icons are `text-muted-foreground`, with no
  coloured or grey tile behind them. Colour is kept for meaning: primary
  actions, destructive actions, status, and brand logos.
- **Real brand marks.** Third-party tools use their real logo from
  `public/images/integrations/`, never a generic icon. Small square
  slots, 40px and under, use the mark alone, not the wordmark.
- **Defaults over settings.** Everything works on day one. Show a switch
  only when it's a real choice, and default it on.

## 2. Tokens

- **Theme tokens only:** `bg-card`, `bg-muted`, `bg-background`,
  `border-border`, `text-foreground`, `text-muted-foreground`,
  `text-primary`, `bg-primary`. Raw palette colours only for
  meaning: red for destructive or required, amber for "needs your
  action", emerald for connected or success. Status pills use
  `softBadge` from `src/lib/badge-colors.ts`.
- **Radius** comes from the `--radius` token, `0.375rem` across the app.
  The marketing site (`.lp2`) keeps `0.55rem`. Never hard-code a larger
  radius.
- **Emoji** render in Noto Color Emoji. It's wired in `layout.tsx` and
  `globals.css`; don't override `font-family` locally.

## 3. Page header

Every settings or list page opens with `SettingsPanelHead`, given
`className="mb-8"`:

- a title and a one-line description;
- on the right, the **Documentation** button. Always `<DocsButton
  href={docHref('<guide>')} />` from `src/components/ui/docs-button.tsx`
  (outlined, the word, then the open-in-new mark, opening in a new
  tab). Never a hand-made one with another icon or label like "Go to
  documentation".
- Documentation buttons go in page headers only, never inside a modal.

## 3a. Top bar

- **Help** is a plain link: one click opens the docs (`/docs`) in a
  new tab. No menu behind it. Support lives at the foot of the
  sidebar, with its unread count.

## 4. Lists (tags, custom fields, quick replies, members…)

The toolbar has a search box on the left and actions on the right:

- **Search:** underline only, no box and no fill. A grey search icon sits
  at the left, and the placeholder reads "Search &lt;things&gt;...":
  `border-border focus-visible:border-primary h-10 rounded-none border-0 border-b bg-transparent pr-0 pl-6 focus-visible:ring-0 dark:bg-transparent`.
- **Delete:** `variant="outline"`, `h-10`. It looks washed out (grey
  text) until something is ticked, then the text turns dark. It shows no
  count, and always asks for confirmation in a dialog.
- **Add:** the primary button, `h-10`, labelled "Add field", "Create tag"
  and so on.

The list is one bordered box with a line between rows:
`divide-border border-border bg-card divide-y overflow-hidden rounded-xl border`.

- No table header row.
- Each row has a checkbox, aligned with the row's first line, then the
  content, then a **pencil** (`variant="ghost" size="icon-sm"`,
  muted) that opens an edit modal.
- No delete button on a row; deleting is tick and Delete.
- Secondary details on a row use small grey text, with no borders around
  chips like a role.
- Related pending items (for example invites) sit inline in the same
  list with a small status pill, not in a separate section.

**Empty state (a page-level list):** one dashed card holding a small
muted icon, a single line, and at most one hint line.

## 5. Panels and sections (inbox side panel, cards)

- The inbox's two side columns are the same width: the conversation
  list and the contact panel are both `w-96` (384px). The chat column
  in the middle takes the rest.

- A section's frame is the section. Anything inside it (a composer, a
  list) has no border or box of its own.
- **Adding something inside a section** (a tag, a note) uses a small
  **"+ Add"** text button at the right of the section header. No "Add
  note" button inside the section. For text, "+ Add" opens an underlined
  box: Enter saves, Shift+Enter is a new line, Esc closes. Copy the
  Notes and Tags sections in `contact-sidebar.tsx`.
- **No jumping.** Whatever opens in place of something else (the add box
  replacing "No notes yet") has the same minimum height, so the section
  never shrinks or jumps on a click.
- Inline text inputs and text areas inside a section have **a bottom
  border only**: `rounded-none border-0 border-b bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-primary`.
- **Empty state inside a section:** plain muted text with a small icon
  above it. No border and no dashed box.
- **Main tab bar:** the panel's underline icon tabs. The open tab spells
  out its name.
- **A choice inside a tab** (for example Integrations → Zoho / HubSpot) is a
  segmented control, not a second row of underline tabs:
  `bg-muted flex gap-0.5 rounded-lg p-0.5`, with the active item
  `bg-card text-foreground shadow-sm`, each with a logo and name.

## 5a. Message composer

- No box around it: the composer's top line, separating it from the
  chat, is its only frame. The text box spans the full width at the top
  with no border of its own. Underneath, one row: action icons on the
  left (attach, emoji, template, form, AI — `h-8 w-8`, grey), any hint and the
  **Send** button on the right.
- Copy `src/components/inbox/message-composer.tsx` for any new box
  where people type a message.
- A prompt box with one action (Write with Maya's Generate / Use this) is
  one bordered box: the text on top, the action button inside it at the
  bottom right. Not a button beside the box. Copy
  `src/components/inbox/ai-write-popover.tsx`.
- Menus opened from an icon (attach) are roomy: `w-52 p-1.5`, rows
  `gap-3 px-3 py-2.5 text-sm`, each with an 18px grey icon before the
  label.

## 6. Modals and forms

- Width fits the content: `sm:max-w-lg` for a simple form, up to
  `sm:max-w-2xl` for a dense one. Don't cram.
- In a short form, the **placeholder can do the label's job**: "Field
  name". When a field has no label, give it an `aria-label`.
- A dropdown with no choice yet reads **"Choose &lt;thing&gt;"** in grey,
  and Save stays disabled until something is chosen.
- A choice between kinds (field type, role), or of one item from a list
  (a template to send), is a **dropdown** (`Select`), not a grid or
  list of cards. Its items may carry a small grey icon and a one-line
  hint. Whatever the choice needs (a preview, its fields) appears below
  the dropdown once something is chosen. Copy `template-picker.tsx`.
- A dropdown over a list that can grow (templates, tags) has a **search
  row at the top**: a grey search icon and a borderless input, with the
  line beneath it as its underline. It filters as you type and the list
  closes on a pick. Build it as a popover list (as `template-picker.tsx`
  and the inbox tag picker do), since `Select` has no room for one.
- A field that can't be changed any more is disabled, with one small
  muted line under it saying so.
- Required fields are marked with a red `*` after the label. A
  "Mandatory" chip, where shown, is a small red pill.
- The footer is Cancel (`variant="outline"`) then the primary action.
  Destructive actions (Remove, Delete) are red and always confirm.
- A colour picker uses the preset swatches plus a picker whose hex input
  is **inside** the picker popover, never a separate hex box beside the
  swatches.
- Save happens in the form, not as a Save button in the page header.

## 7. People and records

- **Avatars:** always `PersonAvatar`, which shows the photo or a coloured
  initial. Seed it with the user's id, so a person keeps one colour
  everywhere.
- **Anything a teammate wrote** (notes, messages) shows the author's
  avatar and name, then the date and time (`d MMM yyyy, HH:mm`).
- Dates in compact panels: `d MMM, HH:mm`.

## 7a. Tags

- A tag always looks like a **price tag**: `TagShape` from
  `src/components/tags/tag-shape.tsx`, with a pointed end, a punched
  hole and a soft wash of the tag's colour. Never a round chip or a
  coloured dot.
- `size="sm"` in panels and pickers. Pass `onRemove` when the tag can
  be taken off right there; it adds a × after the name.
- A picker (the "+ Add" dropdown) lists tags in that same shape, and
  **closes after each pick**.

## 8. Dashboards and metrics

- Related metrics share **one** white box, with vertical dividers between
  them and a small grey icon before each label. Not one card per metric.
- No charts or activity feeds on the dashboard. Those belong on an
  analytics page.
- Until WhatsApp is connected, the figures and the Team panel give way
  to **how to connect it**, shaped like the Team panel: just the four
  numbered steps side by side with room to breathe (one short line
  each — no requirement lists; those live in the docs), then Connect
  WhatsApp (admins only) and the Documentation button.
  Copy `src/components/dashboard/connect-whatsapp-guide.tsx`.

## 9. Integrations

Follow the Periskope-style pattern in `zoho-manage.tsx` and
`hubspot-manage.tsx`. The connected page has three cards:

- **Account:** the account name, ID, and the actions Resync,
  Delete integration and Open &lt;tool&gt;.
- **Additional settings:** a few on/off switches, each with a title and
  one line of description, all on by default.
- **Granted permissions.**

Show a "Syncing…" bar only while work is in flight, and a message only
when the user must act (Reconnect). No event lists or status lines.

## 9a. Plan and billing

- Settings → Profile → Plan is two sections: **Current plan** (a
  status pill and Upgrade / Choose a plan in its header, then the plan
  as one row of facts with dividers) and **Invoices** (a plain list).
- No usage meters or feature lists there.
- **Activation codes are redeemed only where a plan is bought**: the
  upgrade dialog and onboarding. Never on a settings page.
- Copy `src/components/settings/plan-config.tsx`.

## 10. Copy

- Sentence case everywhere ("Add field", "Create tag", "Custom fields").
- One line per setting, hint or description.
- Plain words. Never surface internal names (`field_options`,
  `push_contacts`).

## 11. Docs screenshots

- **Every screenshot sits in a 5:3 frame**, full column width, so all
  pictures on a page are the same shape whatever the crop. The shot
  keeps its own ratio inside. The gap is filled with the shot's edge
  colour: `#f9fafc` (the app and sign-in pages) by default, or
  `background` on the image to match another.
- **Corners are 6px** (`rounded-[6px]`). The site's WhatsApp theme
  turns every `rounded-*` class into 25px, so docs use an exact value.
- **Every screenshot enlarges on click.** It opens over a dark, blurred
  page (`bg-black/80 backdrop-blur-sm`). Esc, a click anywhere or the ×
  closes it.
- Copy `src/components/docs/docs-zoom-image.tsx`. Pages pass images
  through `DocsScreenshot` or a `DocsWalkthrough` step's `image`, never
  a bare `<Image>`.

---

## Reference screens

| Pattern | Copy from |
| --- | --- |
| List page (header, search, Delete + Add, bordered list, pencil, edit modal) | `src/components/settings/custom-fields-settings.tsx`, `tag-manager.tsx`, `quick-replies-manager.tsx` |
| Members list with inline pending invites | `src/components/settings/members-tab.tsx` |
| Form with a dropdown and a locked field | `FieldDialog` in `custom-fields-settings.tsx` |
| Inbox side panel section with a composer | `src/components/contacts/contact-notes.tsx` (`compact`) |
| Segmented choice inside a tab | `src/components/inbox/integrations-tab.tsx` |
| Integration connected page | `src/components/settings/hubspot-manage.tsx` |
| Metrics in one box | the dashboard metrics strip |
| Docs screenshot (5:3 frame, click to enlarge) | `src/components/docs/docs-zoom-image.tsx` |
