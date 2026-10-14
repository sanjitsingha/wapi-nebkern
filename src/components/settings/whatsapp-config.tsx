'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCan } from '@/hooks/use-can';
import type { WhatsAppConfig as WhatsAppConfigType } from '@/types';
import { SettingsPanelHead } from './settings-panel-head';
import { WhatsAppConnectWizard } from './whatsapp-connect-wizard';
import { WhatsAppConnected, type ConnectionHealth, type PhoneInfo } from './whatsapp-connected';

const UNKNOWN: ConnectionHealth = { status: 'unknown', tokenCorrupted: false, message: '' };

/**
 * Settings → WhatsApp. Not connected: the step-by-step connect wizard.
 * Connected: the number, whether it's live, and the one-click fixes.
 */
export function WhatsAppConfig() {
  const supabase = createClient();
  // After multi-user, whatsapp_config is one-row-per-account, not
  // one-row-per-user. We pull `accountId` straight off the auth
  // context and key every read off it — so a teammate who just
  // joined an account sees the inviter's saved config without
  // having to re-enter anything.
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();
  const canEdit = useCan('edit-settings');

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WhatsAppConfigType | null>(null);
  const [health, setHealth] = useState<ConnectionHealth>(UNKNOWN);
  const [phoneInfo, setPhoneInfo] = useState<PhoneInfo | null>(null);
  // Set by the wizard's success, so the page opens on "you're connected".
  const [justConnected, setJustConnected] = useState(false);

  const fetchConfig = useCallback(
    async (acctId: string, { quiet = false }: { quiet?: boolean } = {}) => {
      if (!quiet) setLoading(true);
      try {
        // UNIQUE(account_id) keeps .maybeSingle() accurate.
        const { data, error } = await supabase
          .from('whatsapp_config')
          .select('*')
          .eq('account_id', acctId)
          .maybeSingle();
        if (error) console.error('Failed to load config row:', error);
        setConfig(data ?? null);

        if (!data) {
          setHealth(UNKNOWN);
          setPhoneInfo(null);
          return;
        }

        // The row only says what was saved; this asks Meta whether the
        // saved token still works (decrypts it server-side).
        try {
          const res = await fetch('/api/whatsapp/config');
          const payload = await res.json();
          if (payload.connected) {
            setHealth({ status: 'connected', tokenCorrupted: false, message: '' });
            setPhoneInfo(payload.phone_info ?? null);
          } else {
            setHealth({
              status: 'disconnected',
              tokenCorrupted: payload.reason === 'token_corrupted',
              message: payload.message || '',
            });
          }
        } catch (err) {
          console.error('Health check failed:', err);
          setHealth({ status: 'disconnected', tokenCorrupted: false, message: '' });
        }
      } catch (err) {
        console.error('fetchConfig error:', err);
        toast.error('Failed to load WhatsApp configuration');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    // Need both the auth session (`!authLoading`) AND the profile
    // (`!profileLoading`, which carries `accountId`). Without the
    // second guard, the effect would fire with `accountId === null`
    // for the first render window and bail without ever retrying
    // once the profile arrives.
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      setLoading(false);
      return;
    }
    fetchConfig(accountId);
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  const reload = useCallback(async () => {
    if (accountId) await fetchConfig(accountId, { quiet: true });
  }, [accountId, fetchConfig]);

  const head = (
    <SettingsPanelHead
      title="WhatsApp"
      description={
        config
          ? 'Your WhatsApp Business number and its connection to Instant.'
          : 'Connect your WhatsApp Business number in a few minutes — no API keys or developer setup.'
      }
    />
  );

  if (loading) {
    return (
      <section className="animate-in fade-in-50 duration-200">
        {head}
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in-50 duration-200">
      {head}
      {config ? (
        <WhatsAppConnected
          config={config}
          phoneInfo={phoneInfo}
          health={health}
          justConnected={justConnected}
          canEdit={canEdit}
          onChanged={reload}
          onDisconnected={() => {
            setJustConnected(false);
            setConfig(null);
            setHealth(UNKNOWN);
            setPhoneInfo(null);
          }}
        />
      ) : canEdit ? (
        <WhatsAppConnectWizard
          onConnected={() => {
            setJustConnected(true);
            void reload();
          }}
        />
      ) : (
        <p className="max-w-2xl rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No WhatsApp number is connected yet. Ask an admin of your workspace to connect one
          from this page.
        </p>
      )}
    </section>
  );
}
