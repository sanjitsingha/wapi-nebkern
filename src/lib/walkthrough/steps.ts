/**
 * Guided walkthrough script.
 *
 * Each step points at a UI element by its `data-walkthrough` attribute
 * rather than a CSS class or DOM path, so restyling a component can't
 * silently break the tour — the attribute is the contract.
 *
 * Anchor targets must be elements that are ALWAYS mounted while the
 * dashboard shell is up. That rules out the nav-group children
 * (Contacts › Lists, Market › Templates, …), which only render while
 * their group is expanded; the tour anchors to the group toggle
 * instead. A step whose target is missing degrades to a centered card
 * rather than disappearing — see resolveTarget in walkthrough-overlay.
 */

export type StepPlacement = 'right' | 'left' | 'top' | 'bottom';

export interface WalkthroughStep {
  /** Stable id — also the React key and the analytics handle. */
  id: string;
  /**
   * Value of the target's `data-walkthrough` attribute, or null for an
   * unanchored card centred on screen (used for the intro/outro beats).
   */
  target: string | null;
  title: string;
  body: string;
  /** Preferred side to place the tooltip. Flips automatically when it
   *  would overflow the viewport. Ignored when `target` is null. */
  placement?: StepPlacement;
}

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome aboard',
    body: "Here's a quick two-minute tour of the workspace. You can skip it at any point and replay it later from the sidebar.",
  },
  {
    id: 'inbox',
    target: 'inbox',
    title: 'Your shared inbox',
    body: 'Every customer conversation lands here, and your whole team works out of the same queue. Unread threads show a live count on this row.',
    placement: 'right',
  },
  {
    id: 'contacts',
    target: 'contacts',
    title: 'Contacts, lists and segments',
    body: 'People you talk to are saved automatically. Group them into lists by hand, or build segments that update themselves from rules.',
    placement: 'right',
  },
  {
    id: 'campaigns',
    target: 'campaigns',
    title: 'Broadcast campaigns',
    body: 'Send an approved template to a list or segment, then track delivery and replies per recipient.',
    placement: 'right',
  },
  {
    id: 'automation',
    target: 'automation',
    title: 'Automations and flows',
    body: 'Set up replies that fire on a keyword, a schedule, or a stage change — so routine conversations handle themselves.',
    placement: 'right',
  },
  {
    id: 'agents',
    target: 'agents',
    title: 'AI agents',
    body: 'Hand a conversation to an AI agent trained on your business, and let it draft or send replies with your team watching.',
    placement: 'right',
  },
  {
    id: 'settings',
    target: 'settings',
    title: 'Connect your number',
    body: "Start here: open this menu and go to Settings to link your WhatsApp Business number. Nothing can send or receive until that's connected.",
    placement: 'bottom',
  },
  {
    id: 'walkthrough',
    target: 'walkthrough',
    title: 'Replay any time',
    body: "That's the tour. This button brings it back whenever you want a refresher.",
    placement: 'top',
  },
  {
    id: 'support',
    target: 'support',
    title: 'We are one message away',
    body: 'Stuck on something? Open a support ticket here and our team replies in the same window.',
    placement: 'top',
  },
];
