"use client"

import { Fragment, use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Check,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import type {
  Automation,
  AutomationLog,
  AutomationLogStepResult,
} from "@/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelative } from "@/lib/automations/trigger-meta"

export default function AutomationLogsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [automation, setAutomation] = useState<Automation | null>(null)
  const [logs, setLogs] = useState<AutomationLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openLogId, setOpenLogId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const [autRes, logRes] = await Promise.all([
          supabase
            .from("automations")
            .select("*")
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("automation_logs")
            .select("*, contact:contacts(id, name, phone)")
            .eq("automation_id", id)
            .order("created_at", { ascending: false })
            .limit(100),
        ])
        if (autRes.error) throw autRes.error
        if (logRes.error) throw logRes.error
        setAutomation(autRes.data as Automation | null)
        setLogs((logRes.data ?? []) as AutomationLog[])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load logs")
      }
    }
    load()
  }, [id])

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => router.push("/automations")}>
          Back
        </Button>
      </div>
    )
  }

  if (!automation || logs === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/automations")}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{automation.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Execution logs</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <p className="text-sm text-foreground">No executions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Trigger this automation to see runs here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="w-8" />
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Trigger</th>
                  <th className="px-3 py-2 font-medium">Steps</th>
                  <th className="px-3 py-2 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isOpen = openLogId === log.id
                  const stepCount = log.steps_executed?.length ?? 0
                  return (
                    <Fragment key={log.id}>
                      <tr
                        onClick={() => setOpenLogId(isOpen ? null : log.id)}
                        className={cn(
                          "cursor-pointer border-b border-border transition-colors hover:bg-muted/40",
                          isOpen && "bg-muted/30",
                        )}
                      >
                        <td className="pl-3 align-middle text-muted-foreground">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-middle">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="px-3 py-2.5 align-middle font-medium text-foreground">
                          {log.contact?.name ??
                            log.contact?.phone ??
                            "Unknown contact"}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">
                          {log.trigger_event}
                        </td>
                        <td className="px-3 py-2.5 align-middle text-muted-foreground">
                          {stepCount}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right align-middle text-xs whitespace-nowrap text-muted-foreground"
                          title={new Date(log.created_at).toLocaleString()}
                        >
                          {formatRelative(log.created_at)}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border bg-muted/20">
                          <td />
                          <td colSpan={5} className="px-3 pt-1 pb-3">
                            {log.error_message && (
                              <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                                {log.error_message}
                              </p>
                            )}
                            <ul className="space-y-1.5">
                              {(log.steps_executed ?? []).map((r, i) => (
                                <StepRow key={i} result={r} />
                              ))}
                              {stepCount === 0 && (
                                <li className="text-xs text-muted-foreground">
                                  No steps recorded.
                                </li>
                              )}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AutomationLog["status"] }) {
  const classes =
    status === "success"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "partial"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-red-500/30 bg-red-500/10 text-red-300"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        classes,
      )}
    >
      {status}
    </span>
  )
}

function StepRow({ result }: { result: AutomationLogStepResult }) {
  const ok = result.status === "success"
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full",
          ok ? "bg-primary/20 text-primary" : "bg-red-500/20 text-red-400",
        )}
        aria-hidden
      >
        {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      <span className="text-muted-foreground">{result.step_type}</span>
      {result.detail && (
        <span className="truncate text-muted-foreground">— {result.detail}</span>
      )}
    </li>
  )
}
