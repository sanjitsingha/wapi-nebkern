"use client"

import { InfoHint } from "@/components/ui/info-hint";
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Zap,
  Plus,
  Loader2,
  History,
  PlayCircle,
  CircleDot,
  Search,
  Filter,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useCan } from "@/hooks/use-can"
import type { Automation } from "@/types"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { triggerMeta } from "@/lib/automations/trigger-meta"
import { format } from "date-fns"

// Automations have a single boolean, is_active — surfaced here as a
// two-value status so it reads (and filters) like Flows' status column.
type AutomationStatus = "active" | "draft"

const STATUS_LABELS: Record<AutomationStatus, string> = {
  active: "Active",
  draft: "Draft",
}

function statusOf(a: Automation): AutomationStatus {
  return a.is_active ? "active" : "draft"
}

export default function AutomationsPage() {
  const router = useRouter()
  const canCreate = useCan("send-messages")
  const [automations, setAutomations] = useState<Automation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AutomationStatus[]>([])

  async function load() {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false })
      if (fetchErr) throw fetchErr
      setAutomations((data ?? []) as Automation[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredAutomations = useMemo(() => {
    const list = automations ?? []
    const q = search.trim().toLowerCase()
    return list.filter((a) => {
      if (statusFilter.length > 0 && !statusFilter.includes(statusOf(a))) {
        return false
      }
      if (!q) return true
      const haystack = [
        a.name,
        a.description ?? "",
        triggerMeta(a.trigger_type).label,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [automations, search, statusFilter])

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (automations === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">Automations</h1>
            <InfoHint label="Automations" docs="/docs/automations">
              If-this-then-that rules: a trigger (a keyword, a new contact, a
              stage change), an optional condition, and an action that runs
              without anyone watching.
            </InfoHint>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Build workflows that react to WhatsApp® events automatically.
          </p>
        </div>
        <GatedButton
          canAct={canCreate}
          gateReason="create automations"
          onClick={() => router.push("/automations/new")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Automation
        </GatedButton>
      </header>

      {automations.length === 0 ? (
        <EmptyState
          onCreate={() => router.push("/automations/new")}
          canCreate={canCreate}
        />
      ) : (
        <div className="space-y-4">
          {/* Search + status filter */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search automations by name, description, or trigger"
                className="h-11 pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="h-11 gap-2" />}
              >
                <Filter className="h-4 w-4" />
                Status
                {statusFilter.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {statusFilter.length}
                  </span>
                )}
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(Object.keys(STATUS_LABELS) as AutomationStatus[]).map(
                  (status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={statusFilter.includes(status)}
                      className="gap-2"
                      onCheckedChange={() =>
                        setStatusFilter((prev) =>
                          prev.includes(status)
                            ? prev.filter((s) => s !== status)
                            : [...prev, status],
                        )
                      }
                    >
                      {STATUS_LABELS[status]}
                    </DropdownMenuCheckboxItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {filteredAutomations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
              <Search className="h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No automations match your filters
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or clear the status filter.
              </p>
              {(search || statusFilter.length > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSearch("")
                    setStatusFilter([])
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/50 hover:bg-muted/50">
                    <TableHead className="px-6 py-3.5 text-muted-foreground">Name</TableHead>
                    <TableHead className="px-6 py-3.5 text-muted-foreground" icon={CircleDot}>Status</TableHead>
                    <TableHead className="hidden px-6 py-3.5 text-muted-foreground md:table-cell" icon={Zap}>
                      Trigger
                    </TableHead>
                    <TableHead className="hidden px-6 py-3.5 text-muted-foreground lg:table-cell" icon={History}>
                      Last modified
                    </TableHead>
                    <TableHead className="px-6 py-3.5 text-muted-foreground" icon={PlayCircle}>Runs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAutomations.map((a) => (
                    <AutomationTableRow
                      key={a.id}
                      automation={a}
                      onEdit={() => router.push(`/automations/${a.id}/edit`)}
                      onRuns={() => router.push(`/automations/${a.id}/logs`)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState({
  onCreate,
  canCreate,
}: {
  onCreate: () => void
  canCreate: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Zap className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-base font-medium text-foreground">
        No automations yet
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Build your first if-this-then-that rule — a welcome message, an
        out-of-office reply, a lead qualifier. A trigger fires and the action
        runs without anyone watching.
      </p>
      <GatedButton
        canAct={canCreate}
        gateReason="create automations"
        onClick={onCreate}
        className="mt-5"
      >
        <Plus className="h-4 w-4" />
        Create your first automation
      </GatedButton>
    </div>
  )
}

function AutomationTableRow({
  automation,
  onEdit,
  onRuns,
}: {
  automation: Automation
  onEdit: () => void
  onRuns: () => void
}) {
  const triggerSummary = triggerMeta(automation.trigger_type).label
  const lastModified = format(
    new Date(automation.updated_at),
    "MMM d, yyyy · h:mm a",
  )

  return (
    <TableRow className="border-border hover:bg-muted/50">
      {/* Name — with an arrow button that opens the workflow. */}
      <TableCell className="group/cell px-6 py-4 font-medium text-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate">{automation.name}</span>
          <OpenButton label="Open workflow" onClick={onEdit} />
        </div>
      </TableCell>

      {/* Status */}
      <TableCell className="px-6 py-4 text-sm text-muted-foreground">
        {STATUS_LABELS[statusOf(automation)]}
      </TableCell>

      {/* Trigger */}
      <TableCell className="hidden max-w-48 truncate px-6 py-4 text-sm text-muted-foreground md:table-cell">
        {triggerSummary}
      </TableCell>

      {/* Last modified */}
      <TableCell className="hidden px-6 py-4 text-sm text-muted-foreground lg:table-cell">
        {lastModified}
      </TableCell>

      {/* Runs — with an arrow button that opens the run history. */}
      <TableCell className="group/cell px-6 py-4 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span className="tabular-nums">{automation.execution_count}</span>
          <OpenButton label="Open runs" onClick={onRuns} />
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * A bordered arrow button that opens a destination from inside a
 * clickable row. Stops propagation so it acts on its own target rather
 * than firing the row's own click.
 */
function OpenButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground opacity-0 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:opacity-100 group-hover/cell:opacity-100"
    >
      <ArrowUpRight className="h-4 w-4" />
    </button>
  )
}
