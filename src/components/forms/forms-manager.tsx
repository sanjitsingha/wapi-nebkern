'use client';

import { InfoHint } from '@/components/ui/info-hint';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  AlertCircle,
  Search,
  ClipboardList,
  CircleDot,
  ListChecks,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';

import { createClient } from '@/lib/supabase/client';
import { formStatusConfig } from '@/lib/whatsapp-form-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WhatsAppForm } from '@/types';
import { OpenRowButton } from '@/components/ui/open-row-button';

/**
 * List for WhatsApp Forms (native WhatsApp Flows — see
 * src/lib/whatsapp/forms.ts for the naming note). Matches the Templates,
 * Flows, and Automations tables: search, plain-text status, a matched
 * padding scale, and a hover-reveal arrow that opens the form's editor
 * (publish / send / delete live inside that editor).
 */
export function FormsManager() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<WhatsAppForm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchForms() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_forms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setForms((data as WhatsAppForm[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch forms:', err);
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
    }
  }

  const filteredForms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.name.toLowerCase().includes(q));
  }, [forms, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  return (
    <section className="animate-in fade-in-50 space-y-4 duration-200">
      <div className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Forms</h1>
            {/* No /docs page for Forms yet, so the hint stands alone —
                InfoHint drops the link when `docs` is omitted. */}
            <InfoHint label="Forms">
              A structured questionnaire that opens inside WhatsApp. Answers
              come back onto the contact record, so you collect details
              without a back-and-forth conversation.
            </InfoHint>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Structured forms that open inside WhatsApp — build one, publish it, then send it
            from any conversation.
          </p>
        </div>
        <Button onClick={() => router.push('/forms/new')} className="h-11">
          <Plus className="size-4" />
          New Form
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardList className="text-muted-foreground/50 mb-3 size-8" />
            <p className="text-muted-foreground text-sm">No forms yet.</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Create a form to capture leads or feedback without the customer leaving WhatsApp.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative w-full sm:max-w-sm">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search forms"
              className="h-11 pl-9"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={ClipboardList}>
                    Name
                  </TableHead>
                  <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>
                    Status
                  </TableHead>
                  <TableHead
                    className="hidden px-6 py-3.5 text-muted-foreground md:table-cell"
                    icon={ListChecks}
                  >
                    Fields
                  </TableHead>
                  <TableHead
                    className="hidden px-6 py-3.5 text-muted-foreground lg:table-cell"
                    icon={CalendarDays}
                  >
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredForms.map((form) => {
                  const status = formStatusConfig[form.status];
                  const hasErrors = form.validation_errors?.length > 0;
                  return (
                    <TableRow
                      key={form.id}
                      className="border-border hover:bg-muted/50"
                    >
                      <TableCell className="group/cell px-6 py-4 font-medium text-foreground">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{form.name}</span>
                            {hasErrors && (
                              <span title="Meta reported validation issues on this form">
                                <AlertCircle className="size-3.5 shrink-0 text-red-400" />
                              </span>
                            )}
                          </div>
                          <OpenRowButton
                            label="Open form"
                            onClick={() => router.push(`/forms/${form.id}/edit`)}
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className={`px-6 py-4 text-sm ${
                          form.status === 'BLOCKED'
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {status.label}
                      </TableCell>
                      <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground md:table-cell">
                        {form.fields?.length ?? 0}
                      </TableCell>
                      <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground lg:table-cell">
                        {format(new Date(form.created_at), 'MMM d, yyyy · h:mm a')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
