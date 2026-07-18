'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Send, Trash2, Globe, Building2 } from 'lucide-react';

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
import { fmtDateTime } from '../_lib/format';

export interface AccountOption {
  id: string;
  name: string;
}

export interface AdminNotificationView {
  id: string;
  title: string;
  body: string;
  href: string | null;
  imageUrl: string | null;
  audience: 'all' | 'account';
  accountId: string | null;
  accountName: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export function NotificationsManager({
  notifications,
  accounts,
}: {
  notifications: AdminNotificationView[];
  accounts: AccountOption[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Composer accounts={accounts} />
      </div>
      <div className="lg:col-span-3">
        <NotificationList notifications={notifications} />
      </div>
    </div>
  );
}

function Composer({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audience, setAudience] = useState<'all' | 'account'>('all');
  const [accountId, setAccountId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    if (audience === 'account' && !accountId) {
      toast.error('Pick an account to target');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/admin/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          href: href.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
          audience,
          account_id: audience === 'account' ? accountId : undefined,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send');
        return;
      }
      toast.success('Announcement sent');
      setTitle('');
      setBody('');
      setHref('');
      setImageUrl('');
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
          <Label className="text-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Scheduled maintenance"
            disabled={sending}
            className="border-border bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Message</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="We'll be doing maintenance on Sunday 2–3am IST…"
            disabled={sending}
            className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
          />
        </div>

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
              <SelectItem value="all">All accounts (global)</SelectItem>
              <SelectItem value="account">Specific account</SelectItem>
            </SelectContent>
          </Select>
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

        <div className="space-y-2">
          <Label className="text-foreground">Image URL (optional)</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…/banner.png"
            disabled={sending}
            className="border-border bg-muted"
          />
          {imageUrl.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl.trim()}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="border-border mt-1 max-h-32 w-full rounded-lg border object-cover"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-foreground">Link (optional)</Label>
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/plan or https://…"
              disabled={sending}
              className="border-border bg-muted"
            />
            <p className="text-[11px] text-muted-foreground">
              In-app path (/…) or an external https link.
            </p>
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

        <Button
          type="button"
          onClick={send}
          disabled={sending}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send announcement
        </Button>
      </div>
    </div>
  );
}

function NotificationList({
  notifications,
}: {
  notifications: AdminNotificationView[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(n: AdminNotificationView) {
    setBusyId(n.id);
    try {
      const res = await fetch(`/admin/api/notifications/${n.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !n.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(n.isActive ? 'Deactivated' : 'Reactivated');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function del(n: AdminNotificationView) {
    setBusyId(n.id);
    try {
      const res = await fetch(`/admin/api/notifications/${n.id}`, {
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

  if (notifications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No announcements sent yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((n) => {
        const busy = busyId === n.id;
        const expired = n.expiresAt && Date.parse(n.expiresAt) <= Date.now();
        return (
          <div
            key={n.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {n.title}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {n.audience === 'all' ? (
                      <>
                        <Globe className="size-3" /> Global
                      </>
                    ) : (
                      <>
                        <Building2 className="size-3" /> {n.accountName ?? 'Account'}
                      </>
                    )}
                  </span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (!n.isActive || expired
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                    }
                  >
                    {!n.isActive ? 'Inactive' : expired ? 'Expired' : 'Live'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                {n.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={n.imageUrl}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="border-border mt-2 max-h-28 rounded-lg border object-cover"
                  />
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sent {fmtDateTime(n.createdAt)}
                  {n.expiresAt ? ` · Expires ${fmtDateTime(n.expiresAt)}` : ''}
                  {n.href ? ` · ${n.href}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => toggle(n)}
                  className="border-border"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : n.isActive ? (
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
                  onClick={() => del(n)}
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
