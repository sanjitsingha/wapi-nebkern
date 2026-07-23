'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { FormBuilder } from '@/components/forms/form-builder';
import type { WhatsAppForm } from '@/types';

export default function EditFormPage() {
  const params = useParams();
  const router = useRouter();
  const formId = params.id as string;

  const [form, setForm] = useState<WhatsAppForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchForm() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('whatsapp_forms')
          .select('*')
          .eq('id', formId)
          .single();
        if (fetchError) throw fetchError;
        setForm(data as WhatsAppForm);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load form');
      } finally {
        setLoading(false);
      }
    }
    fetchForm();
  }, [formId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-destructive text-sm">{error ?? 'Form not found'}</p>
        <Button variant="outline" onClick={() => router.push('/forms')}>
          Back to Forms
        </Button>
      </div>
    );
  }

  return <FormBuilder initial={form} />;
}
