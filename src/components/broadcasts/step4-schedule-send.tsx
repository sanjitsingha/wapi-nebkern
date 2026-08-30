'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate, Contact } from '@/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScheduleBroadcastDialog } from '@/components/broadcasts/schedule-broadcast-dialog';
import {
  resolveVariables,
  type VariableMapping,
} from '@/lib/broadcasts/variables';
import {
  ArrowLeft,
  Send,
  Loader2,
  Users,
  Save,
  CalendarClock,
  FlaskConical,
} from 'lucide-react';

interface AudienceConfig {
  type: string;
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}

interface Step4Props {
  name: string;
  onNameChange: (name: string) => void;
  template: MessageTemplate;
  audience: AudienceConfig;
  /** Variable mappings, used to render a faithful test message. */
  variables?: Record<string, VariableMapping>;
  onSend: () => void;
  onSaveDraft?: () => void;
  /**
   * Persist a scheduled send. When provided, a "Schedule" button appears
   * next to "Send Broadcast". Must resolve on success / throw on failure.
   */
  onSchedule?: (scheduledAtIso: string) => Promise<void>;
  /** Primary action on the schedule success screen (e.g. go to campaigns). */
  onScheduleDone?: () => void;
  onBack?: () => void;
  isProcessing: boolean;
  progress: number;
  embedded?: boolean;
}

export function Step4ScheduleSend({
  name,
  onNameChange,
  template,
  audience,
  variables = {},
  onSend,
  onSaveDraft,
  onSchedule,
  onScheduleDone,
  onBack,
  isProcessing,
  progress,
  embedded = false,
}: Step4Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [estimatedReach, setEstimatedReach] = useState<number>(0);
  const [loadingReach, setLoadingReach] = useState(true);
  const [showTest, setShowTest] = useState(false);
  const [testPhones, setTestPhones] = useState('');
  const [testing, setTesting] = useState(false);

  // A stand-in contact so the test renders like a real send: static
  // variables resolve verbatim; field/custom-field ones show sample
  // values (there's no real recipient behind a test number).
  const sampleContact = useMemo(
    () =>
      ({
        id: 'test',
        user_id: '',
        account_id: '',
        name: 'Test Contact',
        email: 'test@example.com',
        company: 'Test Co',
        created_at: '',
        updated_at: '',
      }) as Contact,
    [],
  );

  const testParams = useMemo(
    () => resolveVariables(variables, sampleContact),
    [variables, sampleContact],
  );

  const renderedBody = useMemo(
    () =>
      template.body_text.replace(
        /\{\{\s*(\d+)\s*\}\}/g,
        (_m, n: string) => testParams[Number(n) - 1] ?? `{{${n}}}`,
      ),
    [template.body_text, testParams],
  );

  async function handleTest() {
    const phones = testPhones
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (phones.length === 0) {
      toast.error('Enter at least one phone number.');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: phones.map((phone) => ({ phone, params: testParams })),
          template_name: template.name,
          template_language: template.language ?? 'en_US',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Test send failed');
      toast.success(
        `Test sent: ${data.sent} delivered${data.failed ? `, ${data.failed} failed` : ''}.`,
      );
      setShowTest(false);
      setTestPhones('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    async function calculateReach() {
      setLoadingReach(true);
      try {
        const supabase = createClient();

        if (audience.type === 'all') {
          const { count } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });
          setEstimatedReach(count ?? 0);
        } else if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', audience.tagIds);

          const uniqueIds = new Set((contactTags ?? []).map((ct) => ct.contact_id));
          setEstimatedReach(uniqueIds.size);
        } else if (audience.type === 'csv' && audience.csvContacts) {
          setEstimatedReach(audience.csvContacts.length);
        } else {
          setEstimatedReach(0);
        }
      } finally {
        setLoadingReach(false);
      }
    }

    calculateReach();
  }, [audience]);

  const audienceLabel =
    audience.type === 'all'
      ? 'All Contacts'
      : audience.type === 'tags'
        ? `Tags (${audience.tagIds?.length ?? 0} selected)`
        : audience.type === 'csv'
          ? 'CSV Upload'
          : 'Custom';

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold text-foreground">Review & Send</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Name your broadcast, review the details, and send.
          </p>
        </div>
      )}

      {/* Broadcast Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Broadcast Name</label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Summer Sale Announcement"
          className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
        <p className="text-sm font-medium text-foreground">Summary</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Template</p>
            <p className="text-foreground">{template.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Audience</p>
            <p className="text-foreground">{audienceLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estimated Reach</p>
            <div className="flex items-center gap-1.5">
              {loadingReach ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              ) : (
                <>
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">{estimatedReach.toLocaleString()}</p>
                </>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-foreground">{template.language ?? 'en_US'}</p>
          </div>
        </div>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Sending broadcast...</p>
            </div>
            <span className="text-xs font-medium text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        {/* Left cluster — Back (wizard mode) + the Test broadcast link. */}
        <div className="flex items-center gap-3">
          {!embedded && onBack && (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={isProcessing}
              className="border-border text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <button
            type="button"
            onClick={() => setShowTest(true)}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
          >
            <FlaskConical className="h-4 w-4" />
            Test broadcast
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onSaveDraft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={!name.trim() || isProcessing}
              className="border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save as Draft
            </Button>
          )}

          {onSchedule && (
            <Button
              variant="outline"
              onClick={() => setShowSchedule(true)}
              disabled={!name.trim() || isProcessing}
              className="border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <CalendarClock className="h-4 w-4" />
              Schedule
            </Button>
          )}

          <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogTrigger
            render={
              <Button
                disabled={!name.trim() || isProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              />
            }
          >
            <Send className="h-4 w-4" />
            Send Broadcast
          </DialogTrigger>
          <DialogContent className="border-border bg-popover sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-popover-foreground">Confirm Broadcast</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                You are about to send this broadcast to{' '}
                <span className="font-medium text-popover-foreground">{estimatedReach.toLocaleString()}</span>{' '}
                contacts using the{' '}
                <span className="font-medium text-popover-foreground">{template.name}</span> template.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                className="border-border text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowConfirm(false);
                  onSend();
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                Confirm & Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {onSchedule && (
        <ScheduleBroadcastDialog
          open={showSchedule}
          onOpenChange={setShowSchedule}
          campaignName={name}
          templateName={template.name}
          estimatedReach={estimatedReach}
          disabled={isProcessing}
          onSchedule={onSchedule}
          onDone={onScheduleDone}
        />
      )}

      {/* Test broadcast — sends the template to a few numbers you type,
          without creating a campaign or touching the real audience. */}
      <Dialog open={showTest} onOpenChange={(o) => !testing && setShowTest(o)}>
        <DialogContent className="border-border bg-popover sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-popover-foreground">
              <FlaskConical className="h-4 w-4 text-primary" />
              Test broadcast
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Send this message to yourself or a teammate before the real
              campaign. Test numbers don&apos;t need to be saved contacts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Broadcast info */}
            <div className="rounded-lg border border-border bg-card/50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Template</span>
                <span className="text-foreground">{template.name}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Language</span>
                <span className="text-foreground">
                  {template.language ?? 'en_US'}
                </span>
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <p className="mb-1 text-xs text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap text-xs text-foreground">
                  {renderedBody}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Phone numbers
              </label>
              <Input
                value={testPhones}
                onChange={(e) => setTestPhones(e.target.value)}
                placeholder="9198xxxxxxxx, 9199xxxxxxxx"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Separate multiple numbers with commas. Use full international
                format (country code, no +).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTest(false)}
              disabled={testing}
              className="border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTest}
              disabled={testing || !testPhones.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
