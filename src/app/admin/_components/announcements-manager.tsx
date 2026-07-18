'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Send,
  Trash2,
  Globe,
  Building2,
  Link2,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnnouncementVariant } from '@/lib/app-announcement';
import { fmtDateTime } from '../_lib/format';

export interface AccountOption {
  id: string;
  name: string;
}

export interface AnnouncementView {
  id: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  variant: AnnouncementVariant;
  dismissible: boolean;
  audience: 'all' | 'account';
  accountId: string | null;
  accountName: string | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const VARIANT_META: Record<
  AnnouncementVariant,
  { label: string; icon: typeof Info; className: string }
> = {
  info: {
    label: 'Info',
    icon: Info,
    className: 'bg-primary-soft text-primary',
  },
  success: {
    label: 'Success',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  critical: {
    label: 'Critical',
    icon: AlertOctagon,
    className: 'bg-destructive/10 text-destructive',
  },
};

export function AnnouncementsManager({
  announcements,
  accounts,
}: {
  announcements: AnnouncementView[];
  accounts: AccountOption[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Composer accounts={accounts} />
      </div>
      <div className="lg:col-span-3">
        <AnnouncementList announcements={announcements} />
      </div>
    </div>
  );
}

function Composer({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState<AnnouncementVariant>('info');
  const [dismissible, setDismissible] = useState<'yes' | 'no'>('yes');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [audience, setAudience] = useState<'all' | 'account'>('all');
  const [accountId, setAccountId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!message.trim()) {
      toast.error('Add a message');
      return;
    }
    if (audience === 'account' && !accountId) {
      toast.error('Pick an account to target');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/admin/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          variant,
          dismissible: dismissible === 'yes',
          link_url: linkUrl.trim() || undefined,
          link_label: linkLabel.trim() || undefined,
          audience,
          account_id: audience === 'account' ? accountId : undefined,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to publish');
        return;
      }
      toast.success('Announcement published');
      setMessage('');
      setVariant('info');
      setDismissible('yes');
      setLinkUrl('');
      setLinkLabel('');
      setExpiresAt('');
      setAudience('all');
      setAccountId('');
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">New announcement</h2>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground">Message</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={400}
            rows={2}
            placeholder="e.g. Your plan expires in 3 days — renew to avoid interruption."
            disabled={sending}
            className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-foreground">Severity</Label>
            <Select
              value={variant}
              onValueChange={(v) => v && setVariant(v as AnnouncementVariant)}
            >
              <SelectTrigger className="h-10 w-full border-border bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Dismissible</Label>
            <Select
              value={dismissible}
              onValueChange={(v) => v && setDismissible(v as 'yes' | 'no')}
            >
              <SelectTrigger className="h-10 w-full border-border bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Users can close</SelectItem>
                <SelectItem value="no">Always show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-foreground">
              <Link2 className="size-3.5" /> Link (optional)
            </Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/settings/plan or https://…"
              disabled={sending}
              className="border-border bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Button label</Label>
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Learn more"
              disabled={sending || !linkUrl.trim()}
              className="border-border bg-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-foreground">Audience</Label>
            <Select
              value={audience}
              onValueChange={(v) => v && setAudience(v as 'all' | 'account')}
            >
              <SelectTrigger className="h-10 w-full border-border bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                <SelectItem value="account">Specific account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Expires (optional)</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={sending}
              className="border-border bg-muted"
            />
          </div>
        </div>

        {audience === 'account' && (
          <div className="space-y-2">
            <Label className="text-foreground">Account</Label>
            <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
              <SelectTrigger className="h-10 w-full border-border bg-muted">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          type="button"
          onClick={send}
          disabled={sending}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Publish announcement
        </Button>
      </div>
    </div>
  );
}

function AnnouncementList({
  announcements,
}: {
  announcements: AnnouncementView[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(a: AnnouncementView) {
    setBusyId(a.id);
    try {
      const res = await fetch(`/admin/api/announcements/${a.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !a.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(a.isActive ? 'Deactivated' : 'Reactivated');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function del(a: AnnouncementView) {
    setBusyId(a.id);
    try {
      const res = await fetch(`/admin/api/announcements/${a.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Delete failed');
        return;
      }
      toast.success('Deleted');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (announcements.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No announcements yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((a) => {
        const busy = busyId === a.id;
        const expired = a.expiresAt && Date.parse(a.expiresAt) <= Date.now();
        const meta = VARIANT_META[a.variant];
        const VariantIcon = meta.icon;
        return (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      meta.className
                    }
                  >
                    <VariantIcon className="size-3" />
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {a.audience === 'all' ? (
                      <>
                        <Globe className="size-3" /> Global
                      </>
                    ) : (
                      <>
                        <Building2 className="size-3" /> {a.accountName ?? 'Account'}
                      </>
                    )}
                  </span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (!a.isActive || expired
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                    }
                  >
                    {!a.isActive ? 'Inactive' : expired ? 'Expired' : 'Live'}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-foreground">
                  {a.message}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {a.linkUrl && (
                    <span className="inline-flex items-center gap-1">
                      <Link2 className="size-3" /> {a.linkLabel || 'link'}
                    </span>
                  )}
                  {!a.dismissible && <span>· Always shown</span>}
                  <span>· {fmtDateTime(a.createdAt)}</span>
                  {a.expiresAt ? (
                    <span>· Expires {fmtDateTime(a.expiresAt)}</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => toggle(a)}
                  className="border-border"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : a.isActive ? (
                    'Deactivate'
                  ) : (
                    'Reactivate'
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => del(a)}
                  className="size-8 text-destructive hover:bg-destructive/10"
                  aria-label="Delete announcement"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
