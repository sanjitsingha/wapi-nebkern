'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Loader2, Mic, MicOff, Phone, PhoneIncoming, PhoneOff } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useEntitlements } from '@/hooks/use-entitlements';
import { Softphone, type SoftphoneState } from '@/lib/webrtc/softphone';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================
// The softphone, mounted once for the whole dashboard.
//
// It lives in the shell rather than on /calls because a call has to be
// answerable from wherever the agent happens to be — a ringing panel
// that only exists on one page is a missed call everywhere else.
//
// Signalling rides Supabase Realtime on `call_logs`: the webhook writes
// the customer's SDP offer to a row, Realtime delivers the row here, and
// the answer goes back out through /api/whatsapp/calls. Nothing polls.
//
// Every agent on the account sees the same inbound ring — the shared
// inbox model, where whoever is free picks up. Meta rejects the losers'
// `accept`, and this surfaces that as "another agent took the call"
// rather than an error.
// ============================================================

export interface ActiveCall {
  waCallId: string;
  direction: 'inbound' | 'outbound';
  /** Display name or number. */
  peer: string;
  state: SoftphoneState;
  /** Epoch ms when audio connected, for the duration timer. */
  connectedAt: number | null;
}

interface CallCenterValue {
  /** Dial an E.164 number. Rejects loudly if a call is already up. */
  placeCall: (phone: string, displayName?: string) => Promise<void>;
  /** True while any call is ringing or connected. */
  busy: boolean;
  /** The live call, or null. Exposed so a page can render its own
   *  in-call surface instead of the floating panel. */
  activeCall: ActiveCall | null;
  /** True while an inbound call is still ringing (offer un-answered). */
  ringing: boolean;
  muted: boolean;
  working: boolean;
  answer: () => void;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  /** A page showing its own in-call UI calls this to hide the floating
   *  panel while it owns the call — set false when it stops. */
  setDockedInCall: (docked: boolean) => void;
}

const CallCenterContext = createContext<CallCenterValue | null>(null);

/** Dial from anywhere in the dashboard. Returns null outside the shell
 *  (e.g. in tests) so a caller can degrade instead of crashing. */
export function useCallCenter(): CallCenterValue | null {
  return useContext(CallCenterContext);
}

interface CallLogRow {
  wa_call_id: string;
  direction: 'inbound' | 'outbound';
  status: string;
  contact_id: string | null;
  sdp_offer: string | null;
  sdp_answer: string | null;
}

/** Statuses that mean the call is over, whoever ended it. */
const TERMINAL = new Set(['completed', 'missed', 'declined', 'failed']);

export function CallCenterProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { snapshot } = useEntitlements();
  // Fail open while entitlements load — same rule as the rest of the app.
  const allowed = snapshot?.entitlements?.allowCalling !== false;

  const [call, setCall] = useState<ActiveCall | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [working, setWorking] = useState(false);
  // Set by a page (the Calls dock) that renders its own in-call surface,
  // so the floating panel steps aside rather than doubling it up.
  const [dockedInCall, setDockedInCall] = useState(false);

  const phoneRef = useRef<Softphone | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Read inside the Realtime handler, which is registered once — state
  // would be captured stale there.
  const activeIdRef = useRef<string | null>(null);

  const teardown = useCallback((message?: string) => {
    phoneRef.current?.dispose();
    phoneRef.current = null;
    activeIdRef.current = null;
    setCall(null);
    setIncomingOffer(null);
    setMuted(false);
    setWorking(false);
    if (message) toast.info(message);
  }, []);

  const attachRemote = useCallback((stream: MediaStream) => {
    if (!audioRef.current) return;
    audioRef.current.srcObject = stream;
    // Autoplay can be refused until the user has interacted with the
    // page; they just clicked Answer or Call, so this normally succeeds.
    void audioRef.current.play().catch(() => {
      toast.warning('Allow audio playback in your browser to hear the call.');
    });
  }, []);

  const newSoftphone = useCallback(() => {
    const phone = new Softphone({
      onState: (state, detail) => {
        setCall((prev) =>
          prev
            ? {
                ...prev,
                state,
                connectedAt:
                  state === 'in-call' ? (prev.connectedAt ?? Date.now()) : prev.connectedAt,
              }
            : prev,
        );
        if (state === 'failed' && detail) toast.error(detail);
      },
      onRemoteStream: attachRemote,
    });
    phoneRef.current = phone;
    return phone;
  }, [attachRemote]);

  /** One call-control request. Errors surface as a toast — every caller
   *  here is a button the user just pressed. */
  const control = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      try {
        const res = await fetch('/api/whatsapp/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body.error || 'The call could not be completed.');
          return false;
        }
        return true;
      } catch {
        toast.error('Could not reach the calling service.');
        return false;
      }
    },
    [],
  );

  // ── Signalling ────────────────────────────────────────────────
  useEffect(() => {
    if (!allowed) return;

    const channel = supabase
      .channel('softphone')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_logs' },
        async (payload) => {
          const row = payload.new as CallLogRow | null;
          if (!row?.wa_call_id) return;

          // A call we are already on: watch for its ending, and for the
          // answer that completes an outbound handshake.
          if (activeIdRef.current === row.wa_call_id) {
            if (TERMINAL.has(row.status)) {
              teardown('Call ended.');
              return;
            }
            if (row.sdp_answer && phoneRef.current) {
              try {
                await phoneRef.current.acceptAnswer(row.sdp_answer);
              } catch {
                toast.error('The call was answered but audio could not start.');
                teardown();
              }
            }
            return;
          }

          // Someone else's call, or one already over — not our business.
          if (activeIdRef.current) return;
          if (row.direction !== 'inbound' || row.status !== 'ringing') return;
          if (!row.sdp_offer) return; // pre-Layer-B row, nothing to answer

          activeIdRef.current = row.wa_call_id;
          setIncomingOffer(row.sdp_offer);
          setCall({
            waCallId: row.wa_call_id,
            direction: 'inbound',
            peer: 'Incoming call',
            state: 'idle',
            connectedAt: null,
          });

          // Name the caller if we know them. Best-effort: an unknown
          // number still rings, it just rings as "Incoming call".
          if (row.contact_id) {
            const { data } = await supabase
              .from('contacts')
              .select('name, phone')
              .eq('id', row.contact_id)
              .maybeSingle();
            const label = data?.name?.trim() || data?.phone;
            if (label) {
              setCall((prev) => (prev ? { ...prev, peer: label } : prev));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, allowed, teardown]);

  // Release the microphone if the component unmounts mid-call.
  useEffect(() => () => phoneRef.current?.dispose(), []);

  // ── Actions ───────────────────────────────────────────────────

  /**
   * Ask the customer, in chat, to allow calls from this business.
   *
   * Meta refuses business-initiated calls to anyone who hasn't granted
   * permission, so this is the remedy offered whenever a dial hits that
   * wall — and it is an ordinary message, so it only sends inside the
   * 24-hour window after they last wrote in.
   */
  const requestPermission = useCallback(
    async (phone: string) => {
      const ok = await control({ action: 'request_permission', to: phone });
      if (ok) {
        toast.success(
          'Permission request sent. They can allow calls from the chat, then try again.',
        );
      }
    },
    [control],
  );

  const placeCall = useCallback(
    async (phone: string, displayName?: string) => {
      if (activeIdRef.current) {
        toast.error('Finish the current call first.');
        return;
      }
      if (!Softphone.isSupported()) {
        toast.error('This browser cannot make calls. Try Chrome, Edge or Safari over HTTPS.');
        return;
      }

      // Pre-flight before touching the microphone: Meta refuses calls to
      // customers who haven't granted permission, and asking for the mic
      // only to fail a second later is a rotten way to find that out.
      try {
        const res = await fetch(`/api/whatsapp/calls?phone=${encodeURIComponent(phone)}`);
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.allowed === false) {
          toast.error('This customer has not allowed calls from you yet.', {
            duration: 12000,
            action: {
              label: 'Ask permission',
              onClick: () => void requestPermission(phone),
            },
          });
          return;
        }
      } catch {
        // Pre-flight is an optimisation, not a gate — if it can't be
        // reached, dial anyway and let Meta be the authority.
      }

      setWorking(true);
      setCall({
        waCallId: '',
        direction: 'outbound',
        peer: displayName || phone,
        state: 'requesting-mic',
        connectedAt: null,
      });

      try {
        const sp = newSoftphone();
        const sdp = await sp.createOffer();
        const res = await fetch('/api/whatsapp/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'connect', to: phone, sdp }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.call_id) {
          // Permission can lapse between the pre-flight and the dial, so
          // the same remedy is offered here rather than assuming the
          // check upstream caught every case.
          if (body.code === 'call_permission_required') {
            toast.error(body.error, {
              duration: 12000,
              action: {
                label: 'Ask permission',
                onClick: () => void requestPermission(phone),
              },
            });
          } else {
            toast.error(body.error || 'The call could not be placed.');
          }
          teardown();
          return;
        }
        activeIdRef.current = body.call_id;
        setCall((prev) => (prev ? { ...prev, waCallId: body.call_id } : prev));
      } catch (err) {
        // Overwhelmingly this is a denied microphone permission.
        toast.error(
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Microphone access was blocked. Allow it and try again.'
            : 'Could not start the call.',
        );
        teardown();
      } finally {
        setWorking(false);
      }
    },
    [newSoftphone, teardown, requestPermission],
  );

  const answer = useCallback(async () => {
    if (!call || !incomingOffer) return;
    if (!Softphone.isSupported()) {
      toast.error('This browser cannot answer calls. Try Chrome, Edge or Safari over HTTPS.');
      return;
    }
    setWorking(true);
    try {
      const sp = newSoftphone();
      const sdp = await sp.answerOffer(incomingOffer);
      const ok = await control({ action: 'accept', call_id: call.waCallId, sdp });
      if (!ok) {
        teardown();
        return;
      }
      setIncomingOffer(null);
    } catch (err) {
      toast.error(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it and try again.'
          : 'Could not answer the call.',
      );
      teardown();
    } finally {
      setWorking(false);
    }
  }, [call, incomingOffer, newSoftphone, control, teardown]);

  const decline = useCallback(async () => {
    if (!call) return;
    setWorking(true);
    await control({ action: 'reject', call_id: call.waCallId });
    teardown();
  }, [call, control, teardown]);

  const hangUp = useCallback(async () => {
    if (!call) return;
    setWorking(true);
    // Tear down locally first: the mic light going out the instant they
    // press End is worth more than waiting on a round trip, and Meta
    // sends the terminate webhook regardless.
    const id = call.waCallId;
    teardown();
    if (id) await control({ action: 'terminate', call_id: id });
  }, [call, control, teardown]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    phoneRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const value = useMemo<CallCenterValue>(
    () => ({
      placeCall,
      busy: call !== null,
      activeCall: call,
      ringing: incomingOffer !== null,
      muted,
      working,
      answer,
      decline,
      hangUp,
      toggleMute,
      setDockedInCall,
    }),
    [placeCall, call, incomingOffer, muted, working, answer, decline, hangUp, toggleMute],
  );

  return (
    <CallCenterContext.Provider value={value}>
      {children}
      {/* Always mounted: attaching the remote stream to an element that
          only exists while a call is up is a race the call loses. */}
      <audio ref={audioRef} autoPlay className="hidden" />
      {/* Held back while a page (the Calls dock) owns the in-call UI, so
          the two never render the same call at once. */}
      {allowed && call && !dockedInCall && (
        <CallPanel
          call={call}
          ringing={incomingOffer !== null}
          muted={muted}
          working={working}
          onAnswer={answer}
          onDecline={decline}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
        />
      )}
    </CallCenterContext.Provider>
  );
}

/* ─── Panel ───────────────────────────────────────────────────── */

export const STATE_LABEL: Record<SoftphoneState, string> = {
  idle: 'Incoming call',
  'requesting-mic': 'Waiting for microphone…',
  negotiating: 'Connecting…',
  connecting: 'Connecting…',
  'in-call': 'Connected',
  ended: 'Call ended',
  failed: 'Connection failed',
};

function CallPanel({
  call,
  ringing,
  muted,
  working,
  onAnswer,
  onDecline,
  onHangUp,
  onToggleMute,
}: {
  call: ActiveCall;
  ringing: boolean;
  muted: boolean;
  working: boolean;
  onAnswer: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onToggleMute: () => void;
}) {
  const elapsed = useElapsed(call.connectedAt);

  return (
    <div
      role="dialog"
      aria-label={ringing ? 'Incoming call' : 'Call in progress'}
      className="fixed right-4 bottom-4 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            ringing ? 'animate-pulse bg-primary-soft text-primary' : 'bg-muted text-foreground',
          )}
        >
          {ringing ? <PhoneIncoming className="size-5" /> : <Phone className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{call.peer}</p>
          <p className="truncate text-xs text-muted-foreground">
            {call.state === 'in-call' && elapsed ? elapsed : STATE_LABEL[call.state]}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {ringing ? (
          <>
            <Button
              onClick={onAnswer}
              disabled={working}
              className="flex-1 bg-primary text-primary-foreground"
            >
              {working ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
              Answer
            </Button>
            <Button variant="outline" onClick={onDecline} disabled={working} className="flex-1">
              <PhoneOff className="size-4" />
              Decline
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-pressed={muted}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>
            <Button
              onClick={onHangUp}
              disabled={working}
              className="flex-1 bg-red-600 text-white hover:bg-red-600/90"
            >
              <PhoneOff className="size-4" />
              End call
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * mm:ss since the call connected, ticking each second.
 *
 * The clock is read in the interval callback and kept in state, never
 * during render: `Date.now()` in a render body makes the component
 * non-idempotent, so its output would drift on any re-render React
 * chooses to do for its own reasons. `Math.max(0, …)` covers the tick
 * left over from a previous call whose start time was later.
 */
export function useElapsed(since: number | null): string | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (since === null) return null;
  const total = now === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
