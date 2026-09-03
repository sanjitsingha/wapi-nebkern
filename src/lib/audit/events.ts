// ============================================================
// Audit event catalog — PURE (no server imports), shared by the write
// helper (src/lib/audit/log.ts) and the client-side viewer.
//
// `action` values follow a dotted `domain.verb` convention. Adding a new
// tracked event = add a constant here + a label below + call logAudit()
// at the event site. No migration (audit_logs.action is free text).
// ============================================================

export const AUDIT = {
  // Team & access
  MEMBER_INVITED: 'member.invited',
  INVITATION_REVOKED: 'invitation.revoked',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_PHOTO_CHANGED: 'member.photo_changed',
  MEMBER_REMOVED: 'member.removed',
  OWNERSHIP_TRANSFERRED: 'account.ownership_transferred',

  // Billing
  BILLING_PAYMENT: 'billing.payment',
  BILLING_ACTIVATION_REDEEMED: 'billing.activation_redeemed',
  BILLING_TRIAL_STARTED: 'billing.trial_started',

  // Conversations
  CONVERSATION_ASSIGNED_BOT: 'conversation.assigned_bot',
  CONVERSATION_ASSIGNED_AGENT: 'conversation.assigned_agent',
  CONVERSATION_ASSIGNED_AI: 'conversation.assigned_ai',
  CONVERSATION_UNASSIGNED: 'conversation.unassigned',

  // Operational
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_DELETED: 'contact.deleted',
  CONTACT_TAG_ADDED: 'contact.tag_added',
  CONTACT_TAG_REMOVED: 'contact.tag_removed',
  TAG_CREATED: 'tag.created',
  TAG_DELETED: 'tag.deleted',
  FIELD_CREATED: 'field.created',
  FIELD_DELETED: 'field.deleted',
  DEAL_CREATED: 'deal.created',
  DEAL_DELETED: 'deal.deleted',
  BROADCAST_SENT: 'broadcast.sent',
  CHANNEL_CONNECTED: 'channel.connected',
  CHANNEL_DISCONNECTED: 'channel.disconnected',

  // Calls
  CALL_COMPLETED: 'call.completed',
  CALL_MISSED: 'call.missed',
  CALL_DECLINED: 'call.declined',
  CALL_FAILED: 'call.failed',

  // System & errors
  MESSAGE_FAILED: 'message.failed',
  SYSTEM_ERROR: 'system.error',
} as const;

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT];

/** Coarse grouping for the viewer's filter + colour. */
export type AuditCategory =
  | 'team'
  | 'billing'
  | 'conversations'
  | 'contacts'
  | 'fields'
  | 'calls'
  | 'deals'
  | 'broadcast'
  | 'channel'
  | 'system'
  | 'other';

interface ActionMeta {
  /** Human sentence template. `{target}` is replaced with target_label. */
  label: string;
  category: AuditCategory;
}

export const ACTION_META: Record<string, ActionMeta> = {
  [AUDIT.MEMBER_INVITED]: { label: 'Invited a teammate', category: 'team' },
  [AUDIT.INVITATION_REVOKED]: { label: 'Revoked an invitation', category: 'team' },
  [AUDIT.MEMBER_ROLE_CHANGED]: { label: 'Changed a member’s role', category: 'team' },
  [AUDIT.MEMBER_PHOTO_CHANGED]: { label: 'Updated a member’s photo', category: 'team' },
  [AUDIT.MEMBER_REMOVED]: { label: 'Removed a member', category: 'team' },
  [AUDIT.OWNERSHIP_TRANSFERRED]: { label: 'Transferred ownership', category: 'team' },

  [AUDIT.BILLING_PAYMENT]: { label: 'Made a payment', category: 'billing' },
  [AUDIT.BILLING_ACTIVATION_REDEEMED]: {
    label: 'Redeemed an activation code',
    category: 'billing',
  },
  [AUDIT.BILLING_TRIAL_STARTED]: { label: 'Started the free trial', category: 'billing' },

  [AUDIT.CONVERSATION_ASSIGNED_BOT]: {
    label: 'Assigned a chat to a bot',
    category: 'conversations',
  },
  [AUDIT.CONVERSATION_ASSIGNED_AGENT]: {
    label: 'Assigned a chat to a teammate',
    category: 'conversations',
  },
  [AUDIT.CONVERSATION_ASSIGNED_AI]: {
    label: 'Assigned a chat to the AI',
    category: 'conversations',
  },
  [AUDIT.CONVERSATION_UNASSIGNED]: {
    label: 'Unassigned a chat',
    category: 'conversations',
  },

  [AUDIT.CONTACT_CREATED]: { label: 'Created a contact', category: 'contacts' },
  [AUDIT.CONTACT_UPDATED]: { label: 'Updated a contact', category: 'contacts' },
  [AUDIT.CONTACT_DELETED]: { label: 'Deleted a contact', category: 'contacts' },
  [AUDIT.CONTACT_TAG_ADDED]: { label: 'Tagged a contact', category: 'contacts' },
  [AUDIT.CONTACT_TAG_REMOVED]: {
    label: 'Removed a tag from a contact',
    category: 'contacts',
  },
  [AUDIT.TAG_CREATED]: { label: 'Created a tag', category: 'contacts' },
  [AUDIT.TAG_DELETED]: { label: 'Deleted a tag', category: 'contacts' },
  [AUDIT.FIELD_CREATED]: { label: 'Created a custom field', category: 'fields' },
  [AUDIT.FIELD_DELETED]: { label: 'Deleted a custom field', category: 'fields' },
  [AUDIT.DEAL_CREATED]: { label: 'Created a deal', category: 'deals' },
  [AUDIT.DEAL_DELETED]: { label: 'Deleted a deal', category: 'deals' },
  [AUDIT.BROADCAST_SENT]: { label: 'Sent a broadcast', category: 'broadcast' },
  [AUDIT.CHANNEL_CONNECTED]: { label: 'Connected a channel', category: 'channel' },
  [AUDIT.CHANNEL_DISCONNECTED]: { label: 'Disconnected a channel', category: 'channel' },

  [AUDIT.CALL_COMPLETED]: { label: 'Completed a call', category: 'calls' },
  [AUDIT.CALL_MISSED]: { label: 'Missed a call', category: 'calls' },
  [AUDIT.CALL_DECLINED]: { label: 'Declined a call', category: 'calls' },
  [AUDIT.CALL_FAILED]: { label: 'Call failed', category: 'calls' },

  [AUDIT.MESSAGE_FAILED]: { label: 'A message failed to send', category: 'system' },
  [AUDIT.SYSTEM_ERROR]: { label: 'System error', category: 'system' },
};

/** Label for an action, falling back to the raw key for anything unknown. */
export function actionLabel(action: string): string {
  return ACTION_META[action]?.label ?? action;
}

export function actionCategory(action: string): AuditCategory {
  return ACTION_META[action]?.category ?? 'other';
}

/** Every action key belonging to a category — for the API's filter. */
export function actionsForCategory(category: AuditCategory): string[] {
  return Object.entries(ACTION_META)
    .filter(([, m]) => m.category === category)
    .map(([action]) => action);
}

/** The categories offered in the viewer's filter, with display labels. */
export const AUDIT_CATEGORIES: { value: AuditCategory; label: string }[] = [
  { value: 'team', label: 'Team & access' },
  { value: 'billing', label: 'Billing' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'contacts', label: 'Contacts & tags' },
  { value: 'fields', label: 'Custom fields' },
  { value: 'calls', label: 'Calls' },
  { value: 'deals', label: 'Deals' },
  { value: 'broadcast', label: 'Broadcasts' },
  { value: 'channel', label: 'Channels' },
  { value: 'system', label: 'Errors & system' },
];

/** A single audit row as returned by the API / consumed by the viewer. */
export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}
