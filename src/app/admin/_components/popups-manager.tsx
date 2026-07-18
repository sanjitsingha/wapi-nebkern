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
  Image as ImageIcon,
  Video,
  Link2,
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
import { fmtDateTime } from '../_lib/format';

export interface AccountOption {
  id: string;
  name: string;
}

export interface PopupView {
  id: string;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  audience: 'all' | 'account';
  accountId: string | null;
  accountName: string | null;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function PopupsManager({
  popups,
  accounts,
}: {
  popups: PopupView[];
  accounts: AccountOption[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Composer accounts={accounts} />
      </div>
      <div className="lg:col-span-3">
        <PopupList popups={popups} />
      </div>
    </div>
  );
}

function Composer({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [audience, setAudience] = useState<'all' | 'account'>('all');
  const [accountId, setAccountId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() && !body.trim() && !imageUrl.trim() && !youtubeUrl.trim()) {
      toast.error('Add a title, message, image, or video');
      return;
    }
    if (audience === 'account' && !accountId) {
      toast.error('Pick an account to target');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/admin/api/popups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || undefined,
          body: body.trim() || undefined,
          image_url: imageUrl.trim() || undefined,
          youtube_url: youtubeUrl.trim() || undefined,
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
      toast.success('Popup published');
      setTitle('');
      setBody('');
      setImageUrl('');
      setYoutubeUrl('');
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
      <h2 className="text-sm font-medium text-foreground">New popup</h2>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label className="text-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="What's new"
            disabled={sending}
            className="border-border bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Message</Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Tell your users about it…"
            disabled={sending}
            className="w-full resize-none rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus-visible:border-primary"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-foreground">
            <ImageIcon className="size-3.5" /> Image URL
          </Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…/banner.png"
            disabled={sending}
            className="border-border bg-muted"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5 text-foreground">
            <Video className="size-3.5" /> YouTube URL
          </Label>
          <Input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtu.be/…"
            disabled={sending}
            className="border-border bg-muted"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-foreground">
              <Link2 className="size-3.5" /> Link
            </Label>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="/plan or https://…"
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
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Publish popup
        </Button>
      </div>
    </div>
  );
}

function PopupList({ popups }: { popups: PopupView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(p: PopupView) {
    setBusyId(p.id);
    try {
      const res = await fetch(`/admin/api/popups/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed');
        return;
      }
      toast.success(p.isActive ? 'Deactivated' : 'Reactivated');
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function del(p: PopupView) {
    setBusyId(p.id);
    try {
      const res = await fetch(`/admin/api/popups/${p.id}`, { method: 'DELETE' });
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

  if (popups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No popups yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {popups.map((p) => {
        const busy = busyId === p.id;
        const expired = p.expiresAt && Date.parse(p.expiresAt) <= Date.now();
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {p.title || p.body?.slice(0, 40) || 'Popup'}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {p.audience === 'all' ? (
                      <>
                        <Globe className="size-3" /> Global
                      </>
                    ) : (
                      <>
                        <Building2 className="size-3" /> {p.accountName ?? 'Account'}
                      </>
                    )}
                  </span>
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                      (!p.isActive || expired
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')
                    }
                  >
                    {!p.isActive ? 'Inactive' : expired ? 'Expired' : 'Live'}
                  </span>
                </div>
                {p.body && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.body}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {p.imageUrl && (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="size-3" /> image
                    </span>
                  )}
                  {p.youtubeUrl && (
                    <span className="inline-flex items-center gap-1">
                      <Video className="size-3" /> video
                    </span>
                  )}
                  {p.linkUrl && (
                    <span className="inline-flex items-center gap-1">
                      <Link2 className="size-3" /> {p.linkLabel || 'link'}
                    </span>
                  )}
                  <span>· {fmtDateTime(p.createdAt)}</span>
                  {p.expiresAt ? <span>· Expires {fmtDateTime(p.expiresAt)}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => toggle(p)}
                  className="border-border"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : p.isActive ? (
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
                  onClick={() => del(p)}
                  className="size-8 text-destructive hover:bg-destructive/10"
                  aria-label="Delete popup"
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
