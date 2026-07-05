"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  CircleCheck,
  CircleAlert,
  Clock,
  UserPlus,
  PlayCircle,
  PauseCircle,
  Send,
  CornerDownLeft,
  RotateCcw,
  CircleDot,
  Flag,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

import { cn } from "@/lib/utils";

/**
 * Run history viewer — a full-page master/detail:
 *   • Left 30%  — the runs list (one contact per row), newest first.
 *   • Right 70% — the selected run's full details + a human-readable
 *                 step-by-step timeline of what the flow actually did.
 */

interface RunRow {
  id: string;
  status:
    | "active"
    | "completed"
    | "handed_off"
    | "timed_out"
    | "paused_by_agent"
    | "failed";
  current_node_key: string | null;
  started_at: string;
  last_advanced_at: string;
  ended_at: string | null;
  end_reason: string | null;
  vars: Record<string, unknown>;
  reprompt_count: number;
  contact: { id: string; name: string | null; phone: string } | null;
}

interface EventRow {
  flow_run_id: string;
  event_type: string;
  node_key: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const STATUS_META: Record<
  RunRow["status"],
  { label: string; classes: string; icon: typeof Clock }
> = {
  active: {
    label: "In progress",
    classes:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    icon: PlayCircle,
  },
  completed: {
    label: "Completed",
    classes: "border-primary/30 bg-primary-soft text-primary",
    icon: CircleCheck,
  },
  handed_off: {
    label: "Handed to agent",
    classes:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    icon: UserPlus,
  },
  timed_out: {
    label: "Timed out",
    classes: "border-border bg-muted text-muted-foreground",
    icon: Clock,
  },
  paused_by_agent: {
    label: "Paused by agent",
    classes: "border-border bg-muted text-muted-foreground",
    icon: PauseCircle,
  },
  failed: {
    label: "Failed",
    classes:
      "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
    icon: CircleAlert,
  },
};

function initials(name?: string | null, phone?: string) {
  const src = name?.trim() || phone || "?";
  return src.charAt(0).toUpperCase();
}

function StatusPill({ status }: { status: RunRow["status"] }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        meta.classes,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

export default function FlowRunsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [flow, setFlow] = useState<{ id: string; name: string } | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/flows/${params.id}/runs`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = (await res.json()) as {
          flow: { id: string; name: string };
          runs: RunRow[];
          events: EventRow[];
        };
        if (!cancelled) {
          setFlow(json.flow);
          setRuns(json.runs ?? []);
          setEvents(json.events ?? []);
          setSelectedId(json.runs?.[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          toast.error("Couldn't load runs.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (notFound || !flow) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Flow not found.</p>
        <button
          type="button"
          onClick={() => router.push("/flows")}
          className="text-sm text-primary hover:opacity-80"
        >
          ← Back to flows
        </button>
      </div>
    );
  }

  const selectedRun = runs.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card">
      {/* Left — runs list (30%) */}
      <aside className="flex w-[30%] min-w-64 max-w-sm shrink-0 flex-col border-r border-border">
        <div className="shrink-0 border-b border-border p-4">
          <button
            type="button"
            onClick={() => router.push(`/flows/${flow.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="truncate">{flow.name}</span>
          </button>
          <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground">
            Run history
          </h1>
          <p className="text-xs text-muted-foreground">
            {runs.length} run{runs.length === 1 ? "" : "s"} · newest first
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {runs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No runs yet.
            </div>
          ) : (
            runs.map((run) => (
              <RunListItem
                key={run.id}
                run={run}
                selected={run.id === selectedId}
                onSelect={() => setSelectedId(run.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Right — selected run details (70%) */}
      <div className="min-w-0 flex-1 overflow-y-auto">
        {runs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <PlayCircle className="size-9 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No runs yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Once this flow triggers for a customer (a matching keyword, first
              message, or a manual bot assignment), each run shows up here.
            </p>
          </div>
        ) : selectedRun ? (
          <RunDetail
            run={selectedRun}
            events={events.filter((e) => e.flow_run_id === selectedRun.id)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">Select a run to see the details</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Left: run list row ──────────────────────────────────────────── */

function RunListItem({
  run,
  selected,
  onSelect,
}: {
  run: RunRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const contactLabel =
    run.contact?.name?.trim() || run.contact?.phone || "Unknown contact";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors",
        selected
          ? "border-l-2 border-l-primary bg-primary-soft/60"
          : "border-l-2 border-l-transparent hover:bg-muted/50",
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initials(run.contact?.name, run.contact?.phone)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {contactLabel}
          </span>
          <time className="shrink-0 text-[10px] text-muted-foreground">
            {formatDistanceToNow(new Date(run.started_at), { addSuffix: false })}
          </time>
        </div>
        <div className="mt-1.5">
          <StatusPill status={run.status} />
        </div>
      </div>
    </button>
  );
}

/* ─── Right: run detail ───────────────────────────────────────────── */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </p>
    </div>
  );
}

function RunDetail({ run, events }: { run: RunRow; events: EventRow[] }) {
  const contactLabel =
    run.contact?.name?.trim() || run.contact?.phone || "Unknown contact";
  const duration = run.ended_at
    ? formatDistanceToNow(new Date(run.started_at), { addSuffix: false })
    : "Still running";

  return (
    <div className="p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {initials(run.contact?.name, run.contact?.phone)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-foreground">
            {contactLabel}
          </h2>
          {run.contact?.phone && run.contact?.name && (
            <p className="truncate text-sm text-muted-foreground">
              {run.contact.phone}
            </p>
          )}
          <div className="mt-2">
            <StatusPill status={run.status} />
          </div>
        </div>
      </div>

      {/* Meta */}
      <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetaItem label="Started" value={format(new Date(run.started_at), "PP p")} />
        <MetaItem label="Duration" value={duration} />
        <MetaItem label="Re-prompts" value={String(run.reprompt_count)} />
        {run.status === "active" && run.current_node_key && (
          <MetaItem label="Waiting at" value={run.current_node_key} />
        )}
        {run.ended_at && (
          <MetaItem label="Ended" value={format(new Date(run.ended_at), "PP p")} />
        )}
        {run.end_reason && (
          <MetaItem label="Reason" value={run.end_reason.replace(/_/g, " ")} />
        )}
      </dl>

      {/* Timeline */}
      <div className="mt-7">
        <h3 className="mb-4 text-sm font-semibold text-foreground">
          What happened
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No steps were recorded for this run.
          </p>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>

      {/* Captured answers */}
      {Object.keys(run.vars).length > 0 && (
        <div className="mt-7 border-t border-border pt-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Captured answers
          </h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(run.vars).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k}
                </dt>
                <dd className="truncate text-sm text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/* ─── Event timeline ──────────────────────────────────────────────── */

const EVENT_META: Record<
  string,
  { label: string; icon: typeof CircleDot; color: string }
> = {
  started: { label: "Flow started", icon: PlayCircle, color: "text-primary" },
  node_entered: {
    label: "Moved to next step",
    icon: CircleDot,
    color: "text-muted-foreground",
  },
  message_sent: { label: "Sent a message", icon: Send, color: "text-sky-500" },
  reply_received: {
    label: "Customer replied",
    icon: CornerDownLeft,
    color: "text-primary",
  },
  fallback_fired: {
    label: "Fallback triggered",
    icon: RotateCcw,
    color: "text-amber-500",
  },
  handoff: {
    label: "Handed off to an agent",
    icon: UserPlus,
    color: "text-amber-500",
  },
  timeout: { label: "Timed out", icon: Clock, color: "text-muted-foreground" },
  error: { label: "Something went wrong", icon: CircleAlert, color: "text-red-500" },
  completed: { label: "Flow completed", icon: Flag, color: "text-primary" },
};

function EventTimeline({ events }: { events: EventRow[] }) {
  return (
    <ol className="relative space-y-3.5">
      <span
        aria-hidden
        className="absolute bottom-2 left-3 top-2 w-px bg-border"
      />
      {events.map((ev, ix) => {
        const meta =
          EVENT_META[ev.event_type] ?? {
            label: ev.event_type.replace(/_/g, " "),
            icon: CircleDot,
            color: "text-muted-foreground",
          };
        const Icon = meta.icon;
        const detail = eventDetail(ev);
        return (
          <li key={ix} className="relative flex gap-3">
            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-card ring-4 ring-card">
              <Icon className={cn("size-3.5", meta.color)} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-xs font-medium text-foreground">
                  {meta.label}
                </p>
                <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {format(new Date(ev.created_at), "HH:mm:ss")}
                </time>
              </div>
              {detail && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Friendly one-line detail for an event, pulled from its payload. */
function eventDetail(ev: EventRow): string {
  const p = ev.payload ?? {};
  if (ev.event_type === "reply_received") {
    if (p.reply_id) return `Tapped "${String(p.reply_id)}"`;
    if (typeof p.text_length === "number") return `Typed a reply`;
    return "";
  }
  if (ev.event_type === "fallback_fired" && p.reason) {
    return `Reason: ${String(p.reason)}`;
  }
  if (ev.event_type === "error" && p.reason) {
    return String(p.reason);
  }
  if (ev.event_type === "node_entered" && p.captured_key) {
    return `Saved answer as "${String(p.captured_key)}"`;
  }
  return "";
}
