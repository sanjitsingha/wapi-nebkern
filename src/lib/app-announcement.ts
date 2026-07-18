// ============================================================
// App announcement bar — shared types + helpers (migration 061).
//
// A slim bar shown under the dashboard navbar. `variant` drives the
// severity styling; URL validation is shared with app-popup.
// ============================================================

export const ANNOUNCEMENT_VARIANTS = [
  'info',
  'success',
  'warning',
  'critical',
] as const;

export type AnnouncementVariant = (typeof ANNOUNCEMENT_VARIANTS)[number];

export function isAnnouncementVariant(v: unknown): v is AnnouncementVariant {
  return (
    typeof v === 'string' &&
    (ANNOUNCEMENT_VARIANTS as readonly string[]).includes(v)
  );
}

export interface AppAnnouncement {
  id: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  variant: AnnouncementVariant;
  dismissible: boolean;
}

export interface AppAnnouncementRow {
  id: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  variant: string;
  dismissible: boolean;
}

export function mapAnnouncementRow(r: AppAnnouncementRow): AppAnnouncement {
  return {
    id: r.id,
    message: r.message,
    linkUrl: r.link_url,
    linkLabel: r.link_label,
    // Fall back to 'info' if the DB ever holds an unexpected value.
    variant: isAnnouncementVariant(r.variant) ? r.variant : 'info',
    dismissible: r.dismissible,
  };
}
