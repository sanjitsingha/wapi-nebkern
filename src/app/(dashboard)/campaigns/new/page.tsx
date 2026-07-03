'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { MessageTemplate } from '@/types';
import { Step1ChooseTemplate } from '@/components/broadcasts/step1-choose-template';
import { Step2SelectAudience } from '@/components/broadcasts/step2-select-audience';
import { Step3Personalize } from '@/components/broadcasts/step3-personalize';
import { Step4ScheduleSend } from '@/components/broadcasts/step4-schedule-send';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { useWhatsAppInfo } from '@/hooks/use-whatsapp-info';
import { CampaignPreview } from '@/components/campaign-preview';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

const SECTIONS = ['template', 'audience', 'personalize', 'send'] as const;

function audienceSummary(audience: {
  type: 'all' | 'tags' | 'custom_field' | 'csv';
  tagIds?: string[];
  csvContacts?: { phone: string; name?: string }[];
}): string {
  switch (audience.type) {
    case 'all':
      return 'All contacts';
    case 'tags':
      return `${audience.tagIds?.length ?? 0} tag${(audience.tagIds?.length ?? 0) === 1 ? '' : 's'} selected`;
    case 'custom_field':
      return 'Custom field filter';
    case 'csv':
      return `${audience.csvContacts?.length ?? 0} CSV contact${(audience.csvContacts?.length ?? 0) === 1 ? '' : 's'}`;
  }
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');
  const { accountId } = useAuth();
  const { createAndSendBroadcast, isProcessing, progress } =
    useBroadcastSending();
  const waInfo = useWhatsAppInfo();

  const [openSections, setOpenSections] = useState<string[]>([...SECTIONS]);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [audience, setAudience] = useState<{
    type: 'all' | 'tags' | 'custom_field' | 'csv';
    tagIds?: string[];
    customField?: {
      fieldId: string;
      operator: 'is' | 'is_not' | 'contains';
      value: string;
    };
    csvContacts?: { phone: string; name?: string }[];
    excludeTagIds?: string[];
  }>({ type: 'all' });
  const [variables, setVariables] = useState<
    Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>
  >({});
  const [name, setName] = useState('');

  useEffect(() => {
    if (!draftId) return;
    async function loadDraft() {
      const supabase = createClient();
      const { data: bc } = await supabase
        .from('broadcasts')
        .select('*')
        .eq('id', draftId)
        .single();
      if (!bc) return;

      setName(bc.name);

      if (bc.template_variables) {
        setVariables(
          bc.template_variables as Record<
            string,
            { type: 'static' | 'field' | 'custom_field'; value: string }
          >
        );
      }

      const af = bc.audience_filter as Record<string, unknown> | null;
      if (af) {
        setAudience({
          type: (af.type as 'all' | 'tags' | 'custom_field' | 'csv') ?? 'all',
          tagIds: af.tagIds as string[] | undefined,
        });
      }

      if (bc.template_name) {
        const { data: tmpl } = await supabase
          .from('message_templates')
          .select('*')
          .eq('name', bc.template_name)
          .maybeSingle();
        if (tmpl) setTemplate(tmpl as MessageTemplate);
      }
    }
    loadDraft();
  }, [draftId]);

  const unmappedVariableCount = useMemo(() => {
    if (!template) return 0;
    const placeholders = template.body_text.match(/\{\{(\d+)\}\}/g);
    if (!placeholders) return 0;
    return [...new Set(placeholders)].filter((placeholder) => {
      const key = placeholder.replace(/^\{\{|\}\}$/g, '');
      const mapping = variables[key];
      return !mapping?.value;
    }).length;
  }, [template, variables]);

  async function handleSend() {
    if (!template) return;

    try {
      const broadcastId = await createAndSendBroadcast({
        name,
        template,
        audience: {
          type: audience.type,
          tagIds: audience.tagIds,
          customField: audience.customField,
          csvContacts: audience.csvContacts,
          excludeTagIds: audience.excludeTagIds,
        },
        variables,
      });

      if (draftId) {
        const supabase = createClient();
        await supabase.from('broadcasts').delete().eq('id', draftId);
      }

      router.push(`/campaigns/${broadcastId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Broadcast failed';
      console.error('Broadcast failed:', err);
      toast.error(message);
    }
  }

  async function handleSaveDraft() {
    if (!template || !name.trim()) {
      toast.error('Give the campaign a name before saving a draft.');
      return;
    }
    const supabase = createClient();

    const draftPayload = {
      name: name.trim(),
      template_name: template.name,
      template_language: template.language ?? 'en_US',
      template_variables: variables,
      audience_filter: {
        type: audience.type,
        tagIds: audience.tagIds,
      },
      status: 'draft' as const,
    };

    if (draftId) {
      const { error } = await supabase
        .from('broadcasts')
        .update(draftPayload)
        .eq('id', draftId);
      if (error) {
        toast.error(`Failed to update draft: ${error.message}`);
        return;
      }
      toast.success('Draft updated');
      router.push('/campaigns');
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not signed in.');
      return;
    }
    if (!accountId) {
      toast.error('Your profile is not linked to an account.');
      return;
    }

    const { error } = await supabase.from('broadcasts').insert({
      user_id: user.id,
      account_id: accountId,
      ...draftPayload,
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
    });

    if (error) {
      toast.error(`Failed to save draft: ${error.message}`);
      return;
    }
    toast.success('Draft saved');
    router.push('/campaigns');
  }

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold">
            {draftId ? 'Edit Campaign' : 'New Campaign'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure your template, audience, and message in one place.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/campaigns')}
          className="border-border text-muted-foreground"
        >
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[6fr_4fr] lg:gap-16">
        <div className="min-w-0">
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              opacity: isProcessing ? 0.6 : 1,
              pointerEvents: isProcessing ? 'none' : 'auto',
            }}
          >
            <Accordion
              multiple
              keepMounted
              value={openSections}
              onValueChange={setOpenSections}
              className="space-y-3"
            >
              <AccordionItem
                value="template"
                className="rounded-xl border border-border bg-card/50 px-4 not-last:border-b"
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="pr-2 text-left">
                    <p className="text-base font-semibold text-foreground">
                      Choose Template
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                      {template ? template.name : 'Select an approved template'}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <Step1ChooseTemplate
                    embedded
                    selectedTemplate={template}
                    onSelect={setTemplate}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="audience"
                className="rounded-xl border border-border bg-card/50 px-4 not-last:border-b"
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="pr-2 text-left">
                    <p className="text-base font-semibold text-foreground">
                      Select Audience
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                      {audienceSummary(audience)}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <Step2SelectAudience
                    embedded
                    audience={audience}
                    onUpdate={setAudience}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="personalize"
                className="rounded-xl border border-border bg-card/50 px-4 not-last:border-b"
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="pr-2 text-left">
                    <p className="text-base font-semibold text-foreground">
                      Personalize Message
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                      {!template
                        ? 'Select a template first'
                        : unmappedVariableCount > 0
                          ? `${unmappedVariableCount} variable${unmappedVariableCount === 1 ? '' : 's'} need mapping`
                          : 'All variables mapped'}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {template ? (
                    <Step3Personalize
                      embedded
                      template={template}
                      variables={variables}
                      onUpdate={setVariables}
                    />
                  ) : (
                    <p className="text-muted-foreground py-2 text-sm">
                      Choose a template above to map message variables.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="send"
                className="rounded-xl border border-border bg-card/50 px-4 not-last:border-b"
              >
                <AccordionTrigger className="py-4 hover:no-underline">
                  <div className="pr-2 text-left">
                    <p className="text-base font-semibold text-foreground">
                      Review & Send
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs font-normal">
                      {name.trim() ? name : 'Name your campaign and send'}
                    </p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  {template ? (
                    <Step4ScheduleSend
                      embedded
                      name={name}
                      onNameChange={setName}
                      template={template}
                      audience={audience}
                      onSend={handleSend}
                      onSaveDraft={handleSaveDraft}
                      isProcessing={isProcessing}
                      progress={progress}
                    />
                  ) : (
                    <p className="text-muted-foreground py-2 text-sm">
                      Choose a template above before sending your campaign.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <CampaignPreview
            template={template}
            variables={variables}
            businessName={waInfo?.verified_name}
          />
        </aside>
      </div>
    </div>
  );
}
