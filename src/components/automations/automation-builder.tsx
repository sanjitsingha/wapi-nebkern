"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MessageSquare,
  FileText,
  Tag,
  TagIcon,
  UserCheck,
  PencilLine,
  Briefcase,
  Hourglass,
  GitBranch,
  Webhook,
  CircleSlash,
  Zap,
  Loader2,
  ArrowDown,
  ArrowUp,
  MousePointerClick,
  MessageSquareReply,
  Terminal,
  X,
  Search,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { InfoHint } from "@/components/ui/info-hint"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type {
  AccountMember,
  AutomationBranch,
  AutomationStepType,
  AutomationTriggerType,
  CustomField,
  KeywordMatchTriggerConfig,
  MessageTemplate,
  Tag as TagRecord,
} from "@/types"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

// ------------------------------------------------------------
// Types (builder-local — mirror the flattened rows we POST)
// ------------------------------------------------------------

export interface BuilderStep {
  /** Client id; the API assigns real UUIDs server-side. */
  cid: string
  step_type: AutomationStepType
  step_config: Record<string, unknown>
  branches?: {
    yes: BuilderStep[]
    no: BuilderStep[]
    /** Only a wait_for_reply uses this; a condition leaves it empty. */
    timeout: BuilderStep[]
  }
}

export interface BuilderInitial {
  id?: string
  name: string
  description: string
  trigger_type: AutomationTriggerType
  trigger_config: Record<string, unknown>
  is_active: boolean
  steps: BuilderStep[]
}

// ------------------------------------------------------------
// Step metadata — one source of truth for icon + label + border color
// ------------------------------------------------------------

/**
 * One accent per node, expressed as complete static class strings (so
 * Tailwind's JIT sees them). `tile` colors the icon square; `hover` and
 * `on` color the card's outline so it matches the icon on hover and when
 * its settings are open in the panel.
 */
type NodeColor =
  | "green"
  | "blue"
  | "violet"
  | "emerald"
  | "rose"
  | "amber"
  | "cyan"
  | "indigo"
  | "slate"
  | "orange"
  | "teal"

const NODE_COLORS: Record<NodeColor, { tile: string; hover: string; on: string }> = {
  green: {
    tile: "bg-primary/10 text-primary",
    hover: "hover:border-primary/60",
    on: "border-primary ring-1 ring-primary/30",
  },
  blue: {
    tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    hover: "hover:border-blue-500/60",
    on: "border-blue-500 ring-1 ring-blue-500/30",
  },
  violet: {
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    hover: "hover:border-violet-500/60",
    on: "border-violet-500 ring-1 ring-violet-500/30",
  },
  emerald: {
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    hover: "hover:border-emerald-500/60",
    on: "border-emerald-500 ring-1 ring-emerald-500/30",
  },
  rose: {
    tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    hover: "hover:border-rose-500/60",
    on: "border-rose-500 ring-1 ring-rose-500/30",
  },
  amber: {
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hover: "hover:border-amber-500/60",
    on: "border-amber-500 ring-1 ring-amber-500/30",
  },
  cyan: {
    tile: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    hover: "hover:border-cyan-500/60",
    on: "border-cyan-500 ring-1 ring-cyan-500/30",
  },
  indigo: {
    tile: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    hover: "hover:border-indigo-500/60",
    on: "border-indigo-500 ring-1 ring-indigo-500/30",
  },
  slate: {
    tile: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    hover: "hover:border-slate-500/60",
    on: "border-slate-500 ring-1 ring-slate-500/30",
  },
  orange: {
    tile: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    hover: "hover:border-orange-500/60",
    on: "border-orange-500 ring-1 ring-orange-500/30",
  },
  teal: {
    tile: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    hover: "hover:border-teal-500/60",
    on: "border-teal-500 ring-1 ring-teal-500/30",
  },
}

interface StepMeta {
  label: string
  icon: typeof Zap
  /** Accent color key — drives the icon tile and the matching outline. */
  color: NodeColor
}

const STEP_META: Record<AutomationStepType, StepMeta> = {
  send_message: { label: "Send Message", icon: MessageSquare, color: "green" },
  send_template: { label: "Send Template", icon: FileText, color: "blue" },
  send_buttons: { label: "Send Buttons", icon: MousePointerClick, color: "violet" },
  add_tag: { label: "Add Tag", icon: Tag, color: "emerald" },
  remove_tag: { label: "Remove Tag", icon: TagIcon, color: "rose" },
  assign_conversation: { label: "Assign Conversation", icon: UserCheck, color: "amber" },
  update_contact_field: { label: "Update Contact Field", icon: PencilLine, color: "cyan" },
  create_deal: { label: "Create Deal", icon: Briefcase, color: "indigo" },
  wait: { label: "Wait", icon: Hourglass, color: "slate" },
  wait_for_reply: { label: "Wait for Reply", icon: MessageSquareReply, color: "amber" },
  condition: { label: "Condition (If/Else)", icon: GitBranch, color: "orange" },
  send_webhook: { label: "Send Webhook", icon: Webhook, color: "teal" },
  close_conversation: { label: "Close Conversation", icon: CircleSlash, color: "rose" },
}

const ADDABLE_STEPS: AutomationStepType[] = [
  "send_message",
  "send_template",
  "send_buttons",
  "add_tag",
  "remove_tag",
  "assign_conversation",
  "update_contact_field",
  "create_deal",
  "wait",
  "wait_for_reply",
  "condition",
  "send_webhook",
  "close_conversation",
]

/**
 * Step types whose children live in branch buckets instead of following
 * inline. They render their outcomes as columns and have no linear
 * "continue" connector — anything after them belongs inside a branch.
 */
const BRANCHING_STEPS: AutomationStepType[] = ["condition", "wait_for_reply"]

/** Which outcome columns a branching step shows, and how they read. */
const BRANCH_COLUMNS: Record<
  string,
  { branch: AutomationBranch; label: string; color: string }[]
> = {
  condition: [
    { branch: "yes", label: "Yes", color: "text-primary" },
    { branch: "no", label: "No", color: "text-rose-400" },
  ],
  wait_for_reply: [
    { branch: "yes", label: "Reply matches", color: "text-primary" },
    { branch: "no", label: "Other reply", color: "text-rose-400" },
    { branch: "timeout", label: "No reply", color: "text-muted-foreground" },
  ],
}

const TRIGGER_OPTIONS: { value: AutomationTriggerType; label: string; hint: string }[] = [
  { value: "new_message_received", label: "New Message Received", hint: "Any incoming message" },
  {
    value: "first_inbound_message",
    label: "First Message from Contact",
    hint: "First time this contact ever messages you (works for manually-added contacts too)",
  },
  { value: "keyword_match", label: "Keyword Match", hint: "Message contains specific keyword(s)" },
  { value: "new_contact_created", label: "New Contact Created", hint: "When a contact is auto-created from an incoming message" },
  { value: "conversation_assigned", label: "Conversation Assigned", hint: "When assigned to an agent" },
  { value: "tag_added", label: "Tag Added", hint: "When a tag is added to a contact" },
  {
    value: "woocommerce_order",
    label: "WooCommerce Order",
    hint: "When a new order comes in from your connected WooCommerce store",
  },
  {
    value: "shopify_order",
    label: "Shopify Order",
    hint: "When a new order comes in from your connected Shopify store",
  },
  { value: "time_based", label: "Time-Based", hint: "On a recurring schedule" },
]

function cid(): string {
  return (
    "c_" +
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  )
}

function blankConfig(type: AutomationStepType): Record<string, unknown> {
  switch (type) {
    case "send_message":
      return { text: "" }
    case "send_template":
      return { template_name: "", language: "en_US" }
    case "send_buttons":
      return { text: "", header_text: "", footer_text: "", buttons: [{ id: cid(), title: "" }] }
    case "add_tag":
    case "remove_tag":
      return { tag_id: "" }
    case "assign_conversation":
      return { mode: "round_robin" }
    case "update_contact_field":
      return { field: "name", value: "" }
    case "create_deal":
      return { pipeline_id: "", stage_id: "", title: "", value: 0 }
    case "wait":
      return { amount: 1, unit: "hours" }
    case "wait_for_reply":
      // 3 days is the drip-campaign default: long enough that a contact
      // who checks WhatsApp a few times a week still gets counted as a
      // reply, short enough that the sequence doesn't stall for a week.
      return { match_value: "", timeout_amount: 3, timeout_unit: "days" }
    case "condition":
      return { subject: "tag_presence", operand: "", value: "" }
    case "send_webhook":
      return { url: "", headers: {}, body_template: "" }
    case "close_conversation":
      return {}
    default:
      return {}
  }
}

// ------------------------------------------------------------
// Account resources (tags, members, approved templates)
//
// Loaded once at the builder root and shared via context so the
// tag / agent / template pickers below can offer existing resources
// by name instead of asking the user to paste raw UUIDs. Every picker
// falls back to a raw input when its list is empty (fresh account or
// an older deployment), so an automation is always authorable.
// ------------------------------------------------------------

interface AutomationResources {
  tags: TagRecord[]
  members: AccountMember[]
  templates: MessageTemplate[]
  customFields: CustomField[]
}

const ResourcesContext = createContext<AutomationResources>({
  tags: [],
  members: [],
  templates: [],
  customFields: [],
})

function useResources(): AutomationResources {
  return useContext(ResourcesContext)
}

function ResourcesProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<TagRecord[]>([])
  const [members, setMembers] = useState<AccountMember[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // Tags, templates and custom fields come straight from the DB — RLS
    // scopes them to the caller's account. Only APPROVED templates can
    // actually be sent (anything else 400s at send time), matching the
    // broadcast picker.
    void (async () => {
      const [tagsRes, templatesRes, customFieldsRes] = await Promise.all([
        supabase.from("tags").select("*").order("name"),
        supabase
          .from("message_templates")
          .select("*")
          .eq("status", "APPROVED")
          .order("name"),
        supabase.from("custom_fields").select("*").order("field_name"),
      ])
      if (cancelled) return
      setTags((tagsRes.data as TagRecord[] | null) ?? [])
      setTemplates((templatesRes.data as MessageTemplate[] | null) ?? [])
      setCustomFields((customFieldsRes.data as CustomField[] | null) ?? [])
    })()

    // Members go through the API so we inherit its email-visibility
    // rules (agents/viewers don't see emails). Unreachable on older
    // deployments → pickers fall back to a raw agent-id input.
    void (async () => {
      try {
        const res = await fetch("/api/account/members", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { members?: AccountMember[] }
        if (!cancelled) setMembers(json.members ?? [])
      } catch {
        // Members endpoint absent — caller falls back to raw input.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ResourcesContext.Provider value={{ tags, members, templates, customFields }}>
      {children}
    </ResourcesContext.Provider>
  )
}

const SELECT_CLASS =
  "w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"

/** Tag dropdown by name + color, storing the tag's id. Falls back to a
 *  raw id input when no tags exist yet. */
function TagSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { tags } = useResources()
  if (tags.length === 0) {
    return (
      <Input
        placeholder="Tag id"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-muted text-foreground"
      />
    )
  }
  const selected = tags.find((t) => t.id === value)
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-3 w-3 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: selected?.color ?? "transparent" }}
        aria-hidden
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Select a tag…</option>
        {tags.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        {/* Preserve a saved tag that's since been deleted so editing an
            existing automation doesn't silently drop it. */}
        {value && !selected && (
          <option value={value}>{value} (unknown tag)</option>
        )}
      </select>
    </div>
  )
}

/** Contact-field dropdown for "Update Contact Field": built-in columns plus
 *  any account custom fields (stored as `custom:<id>`). A saved custom field
 *  that's since been deleted is preserved as a labelled option so editing an
 *  existing automation doesn't silently drop it. */
function ContactFieldSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { customFields } = useResources()
  const customValue = value.startsWith("custom:") ? value : ""
  const knownCustom =
    customValue && customFields.some((f) => `custom:${f.id}` === customValue)
  return (
    <select
      value={value || "name"}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="name">Name</option>
      <option value="email">Email</option>
      <option value="company">Company</option>
      <option value="marketing_opt_out">Marketing Opt-Out</option>
      {customFields.length > 0 && (
        <optgroup label="Custom fields">
          {customFields.map((f) => (
            <option key={f.id} value={`custom:${f.id}`}>
              {f.field_name}
            </option>
          ))}
        </optgroup>
      )}
      {customValue && !knownCustom && (
        <option value={customValue}>{customValue} (unknown field)</option>
      )}
    </select>
  )
}

/** Agent dropdown by name, storing the member's user_id. Falls back to
 *  a raw id input when the member list is unavailable. */
function AgentSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { members } = useResources()
  if (members.length === 0) {
    return (
      <Input
        placeholder="Agent id"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-muted text-foreground"
      />
    )
  }
  const selected = members.find((m) => m.user_id === value)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">Select an agent…</option>
      {members.map((m) => (
        <option key={m.user_id} value={m.user_id}>
          {m.full_name || m.email || m.user_id}
        </option>
      ))}
      {value && !selected && (
        <option value={value}>{value} (unknown agent)</option>
      )}
    </select>
  )
}

/** Template dropdown showing approved templates by name + language,
 *  storing both template_name and language. Falls back to manual name +
 *  language inputs when no approved templates are synced yet. */
/** The distinct positional placeholders ({{1}}, {{2}}, …) in a template
 *  body, sorted numerically. */
function extractTemplateVars(body: string): string[] {
  const set = new Set<string>()
  for (const m of (body ?? "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)) set.add(m[1])
  return [...set].sort((a, b) => Number(a) - Number(b))
}

/** Buttons that need a send-time parameter: URL buttons with a {{n}} in
 *  the link, and COPY_CODE buttons. Returns the button index, a label,
 *  and — for URL buttons — the approved base the value is appended to. */
function buttonsNeedingParams(
  t: MessageTemplate,
): { index: number; label: string; kind: "url" | "code"; base?: string }[] {
  return (t.buttons ?? [])
    .map((b, index) => ({ b, index }))
    .filter(
      ({ b }) =>
        (b.type === "URL" && /\{\{/.test(b.url)) || b.type === "COPY_CODE",
    )
    .map(({ b, index }) =>
      b.type === "COPY_CODE"
        ? {
            index,
            label: `Copy-code button "${b.text}"`,
            kind: "code" as const,
          }
        : {
            index,
            label: `Link button "${b.text}"`,
            kind: "url" as const,
            // Everything before the {{1}}. This is the half that was
            // fixed when Meta approved the template and cannot change
            // per send — showing it is the difference between "what do
            // I type here?" and an obvious blank to fill.
            base: (b as { url: string }).url.replace(/\{\{\s*\d+\s*\}\}.*$/, ""),
          },
    )
}

/** The `{{vars.*}}` a WooCommerce order trigger publishes.
 *
 *  Mirrors the vars block in the WooCommerce webhook route; if a field
 *  is added there, add it here or it stays invisible in the builder.
 *
 *  Only the handful a link or a code actually wants is offered as a
 *  one-click chip — the rest live behind the info hint. Fifteen chips
 *  under a field is a wall, and this step is used by every trigger, so
 *  most of them are irrelevant most of the time. */
const ORDER_VARS = [
  "order_id",
  "order_number",
  "order_status",
  "order_total",
  "order_currency",
  "customer_name",
  "customer_first_name",
  "customer_email",
  "customer_phone",
  "order_items",
  "item_count",
  "payment_method",
  "shipping_city",
  "shipping_address",
  "order_date",
] as const

/** Why a link button only takes the tail of its URL, behind an "i" on
 *  the field label.
 *
 *  Says nothing about any particular trigger: this step sends templates
 *  on keyword matches, tags and schedules as much as on orders, and the
 *  Meta rule it describes is the same in every one of those cases. */
function ButtonValuesHint() {
  return (
    <InfoHint label="Button values" docs="/docs/templates" side="right">
      <p>
        A link button appends this to the URL Meta approved when the
        template was created — everything before it is fixed, and changing
        it means editing the template. A copy-code button shows this as the
        code.
      </p>
      <p className="mt-2">
        Type a fixed value or a{" "}
        <code className="text-foreground">{"{{variable}}"}</code> your trigger
        provides. Required — Meta rejects the send without it.
      </p>
    </InfoHint>
  )
}

/** The full order-variable list, behind an "i" on the trigger card.
 *
 *  It lives on the trigger because the trigger is what publishes these
 *  — every step below can use them, so documenting the list once at the
 *  source beats repeating fifteen chips under each field. */
function OrderVarsHint() {
  return (
    <InfoHint
      label="Order variables"
      docs="/docs/automations"
      side="right"
      className="ml-0.5 shrink-0"
    >
      <p>
        Each order this trigger receives publishes these. Type{" "}
        <code className="text-foreground">{"{{vars.name}}"}</code> in any step
        below — a message, a template variable, a tracking link — and the
        engine fills it in when the automation runs.
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {ORDER_VARS.map((v) => (
          <code
            key={v}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-foreground"
          >
            {v}
          </code>
        ))}
      </div>
    </InfoHint>
  )
}

/** Sample values, so the preview shows a plausible link rather than the
 *  raw token. Only the shapes that matter for a URL need to be right. */
const VAR_SAMPLES: Record<string, string> = {
  order_id: "12345",
  order_number: "1042",
  order_status: "processing",
  order_total: "2499.00",
  order_currency: "INR",
  customer_name: "Priya Raman",
  customer_first_name: "Priya",
  customer_email: "priya@example.com",
  customer_phone: "919876543210",
  order_items: "2x Linen Shirt",
  item_count: "2",
  payment_method: "UPI",
  shipping_city: "Kochi",
  shipping_address: "12 MG Road, Kochi, Kerala, 682001",
  order_date: "2026-08-26",
}

/** Render a field's value the way it will look once the engine has
 *  substituted real order data — `{{vars.order_id}}` becomes `12345`.
 *  Unknown tokens are left visible rather than blanked, so a typo shows
 *  up in the preview instead of silently vanishing at send time. */
function previewValue(raw: string): string {
  return raw.replace(/\{\{\s*vars\.([\w]+)\s*\}\}/g, (whole, name: string) =>
    VAR_SAMPLES[name] !== undefined ? VAR_SAMPLES[name] : whole,
  )
}

/**
 * Searchable template dropdown. A native <select> can't filter, and an
 * account can have a long approved-template list — so this is a custom
 * popover with a search box over the fetched templates.
 */
function TemplatePicker({
  templates,
  valueName,
  valueLang,
  selected,
  onSelect,
}: {
  templates: MessageTemplate[]
  valueName: string
  valueLang: string
  selected: MessageTemplate | null
  onSelect: (t: MessageTemplate | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      (t.language ?? "en_US").toLowerCase().includes(q),
  )

  const label = selected
    ? `${selected.name} (${selected.language ?? "en_US"})`
    : valueName
      ? `${valueName} (${valueLang || "unknown"}) — not in approved list`
      : "Select a template…"

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(SELECT_CLASS, "flex items-center justify-between gap-2 text-left")}
      >
        <span className={cn("truncate", !selected && !valueName && "text-muted-foreground")}>
          {label}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Click-away catcher. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => {
              setOpen(false)
              setQuery("")
            }}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            <div className="border-b border-border p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search templates"
                  className="w-full rounded-md bg-muted py-1.5 pr-2 pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No templates found.
                </p>
              ) : (
                filtered.map((t) => {
                  const lang = t.language ?? "en_US"
                  const isSel = selected?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelect(t)
                        setOpen(false)
                        setQuery("")
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                        isSel && "bg-muted",
                      )}
                    >
                      <span className="truncate text-foreground">{t.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{lang}</span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SendTemplateFields({
  templateName,
  language,
  variables,
  buttonParams,
  onChange,
}: {
  templateName: string
  language: string
  variables: Record<string, string>
  buttonParams: Record<string, string>
  onChange: (patch: {
    template_name?: string
    language?: string
    variables?: Record<string, string>
    button_params?: Record<string, string>
  }) => void
}) {
  const { templates } = useResources()

  if (templates.length === 0) {
    return (
      <>
        <FieldBlock label="Template name">
          <Input
            value={templateName}
            onChange={(e) => onChange({ template_name: e.target.value })}
            className="bg-muted text-foreground"
          />
        </FieldBlock>
        <FieldBlock label="Language">
          <Input
            value={language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="bg-muted text-foreground"
          />
        </FieldBlock>
      </>
    )
  }

  // Encode name + language in the option value so two templates that
  // share a name across languages stay distinct.
  const toValue = (name: string, lang: string) => `${name}::${lang}`
  const current = templateName ? toValue(templateName, language) : ""
  const selected = templates.find(
    (t) => toValue(t.name, t.language ?? "en_US") === current,
  )
  const placeholders = selected ? extractTemplateVars(selected.body_text) : []
  const needyButtons = selected ? buttonsNeedingParams(selected) : []

  const setVar = (key: string, val: string) =>
    onChange({ variables: { ...variables, [key]: val } })
  const setBtn = (index: number, val: string) =>
    onChange({ button_params: { ...buttonParams, [String(index)]: val } })

  // Selecting a template prunes stale variable/button keys so a template
  // with fewer placeholders can't ship extra params (Meta rejects a
  // param-count mismatch).
  const applyTemplate = (tpl: MessageTemplate | null) => {
    if (!tpl) {
      onChange({ template_name: "", language: "", variables: {}, button_params: {} })
      return
    }
    const ph = extractTemplateVars(tpl.body_text)
    const pruned: Record<string, string> = {}
    for (const k of ph) if (variables[k] != null) pruned[k] = variables[k]
    const needy = buttonsNeedingParams(tpl)
    const prunedBtn: Record<string, string> = {}
    for (const { index } of needy) {
      const key = String(index)
      if (buttonParams[key] != null) prunedBtn[key] = buttonParams[key]
    }
    onChange({
      template_name: tpl.name,
      language: tpl.language ?? "en_US",
      variables: pruned,
      button_params: prunedBtn,
    })
  }

  return (
    <>
      <FieldBlock label="Template">
        <TemplatePicker
          templates={templates}
          valueName={templateName}
          valueLang={language}
          selected={selected ?? null}
          onSelect={applyTemplate}
        />
      </FieldBlock>

      {selected && placeholders.length > 0 && (
        <FieldBlock label="Template variables">
          {/* Show the body so it's clear what each {{n}} fills. */}
          <p className="mb-2 rounded-md bg-muted/60 px-3 py-2 text-xs whitespace-pre-wrap text-muted-foreground">
            {selected.body_text}
          </p>
          <div className="space-y-2">
            {placeholders.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">
                  {`{{${k}}}`}
                </span>
                <Input
                  value={variables[k] ?? ""}
                  onChange={(e) => setVar(k, e.target.value)}
                  placeholder="text or {{vars.order_number}}"
                  className="bg-muted text-foreground"
                />
              </div>
            ))}
          </div>
          {/* Names no specific variable. This step runs on every
              trigger, and which `{{vars.*}}` exist depends entirely on
              which one fired — the trigger card is where that list
              lives, because the trigger is what publishes them. */}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Type a fixed value, or insert data with{" "}
            <code className="text-foreground">{"{{message.text}}"}</code> or a{" "}
            <code className="text-foreground">{"{{vars.name}}"}</code> your
            trigger provides.
          </p>
        </FieldBlock>
      )}

      {selected && needyButtons.length > 0 && (
        <FieldBlock label="Button values" hint={<ButtonValuesHint />}>
          <div className="space-y-4">
            {needyButtons.map(({ index, label, kind, base }) => {
              const val = buttonParams[String(index)] ?? ""
              return (
                <div key={index} className="space-y-1.5">
                  <span className="block text-xs font-medium text-foreground">
                    {label}
                  </span>

                  {/* The approved base, then the box. Meta fixes
                      everything left of {{1}} at approval time, so the
                      only honest way to show this field is as the tail
                      of a link that already exists. */}
                  {kind === "url" && base && (
                    <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <span className="break-all">{base}</span>
                      <span className="rounded bg-primary-soft px-1.5 py-0.5 text-primary">
                        your value ↓
                      </span>
                    </div>
                  )}

                  <Input
                    value={val}
                    onChange={(e) => setBtn(index, e.target.value)}
                    placeholder={
                      kind === "url" ? "Value or {{variable}}" : "Code or {{variable}}"
                    }
                    className="bg-muted text-foreground"
                  />

                  {kind === "url" && base && val.trim() !== "" && (
                    <p className="text-[11px] break-all text-muted-foreground">
                      Sends as{" "}
                      <span className="font-mono text-foreground">
                        {base}
                        {previewValue(val)}
                      </span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>

        </FieldBlock>
      )}
    </>
  )
}

/** Body/header/footer text + a 1-3 row button list editor for the
 *  "Send Buttons" step. Meta caps button titles at 20 chars and the
 *  message to 3 buttons total — enforced both here (input maxLength +
 *  disabled "Add button" at 3) and again in validate.ts at activation. */
function SendButtonsFields({
  text,
  headerText,
  footerText,
  buttons,
  onChange,
}: {
  text: string
  headerText: string
  footerText: string
  buttons: { id: string; title: string }[]
  onChange: (patch: Record<string, unknown>) => void
}) {
  const updateButton = (i: number, title: string) => {
    onChange({ buttons: buttons.map((b, bi) => (bi === i ? { ...b, title } : b)) })
  }
  const addButton = () => {
    if (buttons.length >= 3) return
    onChange({ buttons: [...buttons, { id: cid(), title: "" }] })
  }
  const removeButton = (i: number) => {
    onChange({ buttons: buttons.filter((_, bi) => bi !== i) })
  }

  return (
    <>
      <FieldBlock label="Header (optional)">
        <Input
          value={headerText}
          onChange={(e) => onChange({ header_text: e.target.value })}
          placeholder="Short header line"
          maxLength={60}
          className="bg-muted text-foreground"
        />
      </FieldBlock>
      <FieldBlock label="Message text">
        <Textarea
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Would you like to proceed?"
          className="min-h-20 bg-muted text-foreground"
        />
      </FieldBlock>
      <FieldBlock label="Footer (optional)">
        <Input
          value={footerText}
          onChange={(e) => onChange({ footer_text: e.target.value })}
          placeholder="Small grey line under the buttons"
          maxLength={60}
          className="bg-muted text-foreground"
        />
      </FieldBlock>
      <FieldBlock label={`Buttons (${buttons.length}/3)`}>
        <div className="space-y-1.5">
          {buttons.map((b, i) => (
            <div key={b.id} className="flex items-center gap-1.5">
              <Input
                value={b.title}
                onChange={(e) => updateButton(i, e.target.value)}
                placeholder={`Button ${i + 1} label`}
                maxLength={20}
                className="bg-muted text-foreground"
              />
              <button
                type="button"
                onClick={() => removeButton(i)}
                aria-label={`Remove button ${i + 1}`}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {buttons.length < 3 && (
            <Button type="button" variant="outline" size="sm" onClick={addButton} className="w-full">
              <Plus className="h-3.5 w-3.5" />
              Add button
            </Button>
          )}
        </div>
      </FieldBlock>
    </>
  )
}

// ------------------------------------------------------------
// Main builder component
// ------------------------------------------------------------

export function AutomationBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter()
  const isEditing = !!initial.id
  const [state, setState] = useState<BuilderInitial>(initial)
  const [saving, setSaving] = useState(false)
  const [editingName, setEditingName] = useState(false)
  // The right slide-in panel: either the node-type picker (with the
  // insertion target) or a specific node's settings (by client id).
  const [panel, setPanel] = useState<
    | { mode: "picker"; parent: ParentScope; index: number }
    | { mode: "edit"; cid: string }
    | null
  >(null)

  function patchTop<K extends keyof BuilderInitial>(key: K, value: BuilderInitial[K]) {
    setState((s) => ({ ...s, [key]: value }))
  }

  // --- Panel controls ---

  function openPicker(parent: ParentScope, index: number) {
    setPanel({ mode: "picker", parent, index })
  }
  function openEdit(id: string) {
    setPanel({ mode: "edit", cid: id })
  }
  function closePanel() {
    setPanel(null)
  }

  // --- Step tree mutations (immutable) ---

  function updateStepByCid(id: string, updater: (s: BuilderStep) => BuilderStep) {
    setState((s) => ({ ...s, steps: mapStepsByCid(s.steps, id, updater) }))
  }

  function addStepAt(parent: ParentScope, index: number, type: AutomationStepType) {
    const node: BuilderStep = {
      cid: cid(),
      step_type: type,
      step_config: blankConfig(type),
      branches: BRANCHING_STEPS.includes(type)
        ? { yes: [], no: [], timeout: [] }
        : undefined,
    }
    setState((s) => ({ ...s, steps: insertAt(s.steps, parent, index, node) }))
    // Jump the panel straight to the new node's settings.
    setPanel({ mode: "edit", cid: node.cid })
  }

  function deleteStepByCid(id: string) {
    setState((s) => ({ ...s, steps: removeStepsByCid(s.steps, id) }))
    setPanel(null)
  }

  function moveStepByCid(id: string, direction: -1 | 1) {
    setState((s) => ({ ...s, steps: moveStepsByCid(s.steps, id, direction) }))
  }

  async function save(activeOverride?: boolean) {
    setSaving(true)
    try {
      const nextActive = activeOverride ?? state.is_active
      const payload = {
        name: state.name || "Untitled automation",
        description: state.description || null,
        trigger_type: state.trigger_type,
        trigger_config: state.trigger_config,
        is_active: nextActive,
        steps: toApiSteps(state.steps),
      }

      const res = isEditing
        ? await fetch(`/api/automations/${initial.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/automations`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })

      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // If the server blocked activation with validation issues,
        // surface the first concrete problem so the user can fix it
        // without opening DevTools for the full array.
        const firstIssue: { path?: string; message?: string } | undefined =
          body?.issues?.[0]
        if (firstIssue?.message) {
          toast.error(firstIssue.message, {
            description: firstIssue.path ? `at ${firstIssue.path}` : undefined,
          })
        } else {
          toast.error(body?.error ?? "Save failed")
        }
        return
      }
      // Reflect the new publish state locally so the Live/Draft badge and
      // the menu update without a refetch.
      if (activeOverride !== undefined && activeOverride !== state.is_active) {
        patchTop("is_active", activeOverride)
      }
      toast.success(
        activeOverride === true
          ? "Published"
          : activeOverride === false
            ? "Unpublished"
            : isEditing
              ? "Automation saved"
              : "Automation created",
      )
      if (!isEditing && body?.automation?.id) {
        router.replace(`/automations/${body.automation.id}/edit`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top bar. At sub-sm widths the "Active" label is hidden and the
          switch moves to the right of the save button, so the name input
          gets maximum width. */}
      <header className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3 py-3 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={() => router.push("/automations")}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to automations"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {/* Name (click the pencil / the name to rename) + Live-Draft
            status, both on the left beside each other. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editingName ? (
            <input
              autoFocus
              value={state.name}
              onChange={(e) => patchTop("name", e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape")
                  (e.target as HTMLInputElement).blur()
              }}
              placeholder="Untitled automation"
              className="min-w-0 flex-1 px-2 py-1 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-base"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              title="Rename"
              className="flex min-w-0 items-center px-2 py-1"
            >
              <span className="truncate text-sm font-semibold text-foreground sm:text-base">
                {state.name || "Untitled automation"}
              </span>
            </button>
          )}

          {isEditing && (
            <span
              className={cn(
                "hidden shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
                state.is_active
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {state.is_active ? "Live" : "Draft"}
            </span>
          )}
        </div>

        {/* Runs / execution logs */}
        {isEditing && (
          <button
            type="button"
            onClick={() => router.push(`/automations/${initial.id}/logs`)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Runs"
            title="Runs"
          >
            <Terminal className="h-4 w-4" />
          </button>
        )}

        {/* Single "Save" button that opens a menu — Publish (go live) or
            Save as draft (persist without publishing / take it offline). */}
        <div className="flex flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none disabled:opacity-50 data-[popup-open]:bg-primary/90"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
              <ChevronDown className="h-4 w-4 opacity-80" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48 p-1.5">
              <DropdownMenuItem
                onClick={() => save(true)}
                className="px-3 py-2.5"
              >
                Publish
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => save(false)}
                className="px-3 py-2.5"
              >
                Save as draft
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Resources (templates / tags / members / fields) are shared by
          both the canvas nodes and the right settings panel, so the
          provider wraps both — the panel renders outside the canvas. */}
      <ResourcesProvider>
        {/* Canvas */}
        <div className="relative flex-1 overflow-y-auto">
          <div className="absolute inset-0 bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-0 px-4 py-10">
            <TriggerCard
              type={state.trigger_type}
              config={state.trigger_config}
              onTypeChange={(t) => patchTop("trigger_type", t)}
              onConfigChange={(c) => patchTop("trigger_config", c)}
            />
            <StepList
              steps={state.steps}
              parentPath={[]}
              selectedCid={panel?.mode === "edit" ? panel.cid : null}
              openPicker={openPicker}
              openEdit={openEdit}
            />
          </div>
        </div>

        {/* Right slide-in panel: node picker + per-node settings. */}
        <NodePanel
          panel={panel}
          steps={state.steps}
          onClose={closePanel}
          onPick={(t) => {
            if (panel?.mode === "picker") addStepAt(panel.parent, panel.index, t)
          }}
          onChange={(id, next) => updateStepByCid(id, () => next)}
          onMove={moveStepByCid}
          onDelete={deleteStepByCid}
        />
      </ResourcesProvider>
    </div>
  )
}

// ------------------------------------------------------------
// Trigger card
// ------------------------------------------------------------

function TriggerCard({
  type,
  config,
  onTypeChange,
  onConfigChange,
}: {
  type: AutomationTriggerType
  config: Record<string, unknown>
  onTypeChange: (t: AutomationTriggerType) => void
  onConfigChange: (c: Record<string, unknown>) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    // Card width: full on mobile, fixed 320px on sm+. The canvas wrapper
    // (max-w-2xl + px-4) keeps this tidy on tablet/desktop.
    <div className="z-10 w-full max-w-[320px] sm:w-80">
      <div className="rounded-lg border border-border bg-card shadow-lg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-blue-300">Trigger</div>
            <div className="truncate text-sm font-medium text-foreground">
              {TRIGGER_OPTIONS.find((o) => o.value === type)?.label ?? type}
            </div>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="space-y-3 border-t border-border px-4 py-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Trigger type
              </label>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as AutomationTriggerType)}
                className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {/* The trigger is what publishes the variables, so this is
                  where they are documented — one "i" beside the hint,
                  only for the trigger that has any. Steps further down
                  then just reference `{{vars.…}}` without each one
                  carrying its own copy of the list. */}
              <p className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
                <span>
                  {TRIGGER_OPTIONS.find((o) => o.value === type)?.hint}
                </span>
                {type === "woocommerce_order" && <OrderVarsHint />}
              </p>
            </div>
            {type === "keyword_match" && (
              <KeywordMatchConfig
                config={config as unknown as KeywordMatchTriggerConfig}
                onChange={onConfigChange}
              />
            )}
            {type === "tag_added" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Tag
                </label>
                <TagSelect
                  value={(config.tag_id as string) ?? ""}
                  onChange={(v) => onConfigChange({ ...config, tag_id: v })}
                />
              </div>
            )}
            {type === "time_based" && (
              <Input
                placeholder="Cron expression or HH:mm"
                value={(config.schedule as string) ?? ""}
                onChange={(e) =>
                  onConfigChange({ ...config, schedule: e.target.value })
                }
                className="bg-muted text-foreground"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function KeywordMatchConfig({
  config,
  onChange,
}: {
  config: KeywordMatchTriggerConfig
  onChange: (c: Record<string, unknown>) => void
}) {
  const keywords = config?.keywords ?? []
  // Keep a local draft string so the comma and trailing space aren't
  // stripped on every keystroke (which made multi-word, comma-separated
  // entry like "SEO, search engine optimization" impossible to type).
  // We only parse into the keywords array on blur, then re-display the
  // cleaned, rejoined form. Seeded once on mount; this component remounts
  // when the trigger type changes, so the seed stays in sync.
  const [draft, setDraft] = useState(keywords.join(", "))

  // Persist the default the <select> displays. The dropdown falls back to
  // "contains" for display, but leaving it untouched would otherwise omit
  // match_type from the saved config — and activation validation then
  // rejected it (trigger.match_type). Seed once on mount; the component
  // remounts when the trigger type changes, matching the keywords draft.
  useEffect(() => {
    if (config?.match_type == null) {
      onChange({ ...config, match_type: "contains" })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function commit() {
    const parsed = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    setDraft(parsed.join(", "))
    onChange({ ...config, keywords: parsed })
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Keywords (comma-separated)
        </label>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            }
          }}
          placeholder="e.g. pricing, demo request, talk to sales"
          className="bg-muted text-foreground"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Match type
        </label>
        <select
          value={config?.match_type ?? "contains"}
          onChange={(e) => onChange({ ...config, match_type: e.target.value as "exact" | "contains" })}
          className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground focus:outline-none"
        >
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
        </select>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Step list + card + connectors
// ------------------------------------------------------------

type ParentScope =
  | { kind: "root" }
  | { kind: "branch"; parentCid: string; branch: AutomationBranch }

type StepPath = (
  | { kind: "root"; index: number }
  | { kind: "branch"; parentCid: string; branch: AutomationBranch; index: number }
)[]

interface StepListProps {
  steps: BuilderStep[]
  parentPath: StepPath
  /** cid of the node whose settings are open in the panel (for highlight). */
  selectedCid: string | null
  /** Open the right panel's node picker, targeting this insertion point. */
  openPicker: (parent: ParentScope, index: number) => void
  /** Open the right panel on an existing node's settings. */
  openEdit: (cid: string) => void
}

function StepList(props: StepListProps) {
  const { steps, parentPath, ...rest } = props
  const parentScope: ParentScope =
    parentPath.length === 0
      ? { kind: "root" }
      : (() => {
          const last = parentPath[parentPath.length - 1]
          if (last.kind !== "branch") return { kind: "root" } as const
          return { kind: "branch", parentCid: last.parentCid, branch: last.branch } as const
        })()

  return (
    <div className="flex flex-col items-center">
      <AddButton onOpen={() => props.openPicker(parentScope, 0)} />
      {steps.map((step, idx) => (
        <StepRenderer
          key={step.cid}
          step={step}
          index={idx}
          parentScope={parentScope}
          parentPath={parentPath}
          {...rest}
        />
      ))}
    </div>
  )
}

function StepRenderer({
  step,
  index,
  parentScope,
  parentPath,
  ...props
}: {
  step: BuilderStep
  index: number
  parentScope: ParentScope
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const path: StepPath = [
    ...parentPath,
    parentScope.kind === "root"
      ? { kind: "root", index }
      : { kind: "branch", parentCid: parentScope.parentCid, branch: parentScope.branch, index },
  ]
  const meta = STEP_META[step.step_type]
  const Icon = meta.icon
  const selected = props.selectedCid === step.cid
  const isBranching = BRANCHING_STEPS.includes(step.step_type)
  const branchCount = (BRANCH_COLUMNS[step.step_type] ?? []).length
  // Card widths on mobile fill the full canvas column (max-w-2xl px-4
  // still keeps them reasonable). On sm+ the original fixed widths
  // come back so the flow visual stays recognisable. A three-outcome
  // step gets more room so its columns don't crush.
  const width = !isBranching
    ? "w-full max-w-[320px] sm:w-80"
    : branchCount === 3
      ? "w-full max-w-[560px] sm:w-[560px]"
      : "w-full max-w-[400px] sm:w-[400px]"

  return (
    <>
      <div className={cn("z-10 flex flex-col", width)}>
        <button
          type="button"
          onClick={() => props.openEdit(step.cid)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left shadow-lg transition-colors",
            selected
              ? NODE_COLORS[meta.color].on
              : cn("border-border", NODE_COLORS[meta.color].hover),
          )}
        >
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              NODE_COLORS[meta.color].tile,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {step.step_type === "condition"
                ? "Condition"
                : step.step_type === "wait_for_reply"
                  ? "Wait for reply"
                  : step.step_type === "wait"
                    ? "Wait"
                    : "Action"}
            </div>
            <div className="truncate text-sm font-medium text-foreground">{meta.label}</div>
            <div className="truncate text-[11px] text-muted-foreground">{previewFor(step)}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {isBranching && (
          <ConditionBranches step={step} parentPath={path} {...props} />
        )}
      </div>

      {/* A branching step's outcomes are rendered above by
          ConditionBranches, so it has no linear "continue" path — adding
          the trailing connector here would produce a spurious extra
          output that could never be reached. */}
      {!isBranching && (
        <AddButton onOpen={() => props.openPicker(parentScope, index + 1)} />
      )}
    </>
  )
}

function ConditionBranches({
  step,
  parentPath,
  ...props
}: {
  step: BuilderStep
  parentPath: StepPath
} & Omit<StepListProps, "steps" | "parentPath">) {
  const columns = BRANCH_COLUMNS[step.step_type] ?? BRANCH_COLUMNS.condition
  return (
    // Stack vertically on mobile — even two columns at 375px would cram
    // each branch to ~170px, too narrow for the nested cards. The column
    // count on sm+ follows the step: 2 for a condition, 3 for a
    // wait_for_reply.
    <div
      className={cn(
        "mt-3 grid grid-cols-1 gap-3",
        columns.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {columns.map((col) => {
        // Build the child scope by appending a branch marker. The scope
        // StepList uses is driven by the LAST element of parentPath, so
        // the tail's `index` doesn't matter — walks replace it per child.
        const path: StepPath = [
          ...parentPath,
          { kind: "branch", parentCid: step.cid, branch: col.branch, index: 0 },
        ]
        return (
          <BranchColumn key={col.branch} label={col.label} color={col.color}>
            <StepList
              {...props}
              steps={step.branches?.[col.branch] ?? []}
              parentPath={path}
            />
          </BranchColumn>
        )
      })}
    </div>
  )
}

function BranchColumn({
  label,
  color,
  children,
}: {
  label: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn("mb-2 text-[11px] font-semibold uppercase", color)}>{label}</div>
      {children}
    </div>
  )
}

function AddButton({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="h-4 w-[2px] bg-border" aria-hidden />
      <button
        type="button"
        onClick={onOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
        aria-label="Add step"
      >
        <Plus className="h-4 w-4" />
      </button>
      <div className="h-4 w-[2px] bg-border" aria-hidden />
    </div>
  )
}

// ------------------------------------------------------------
// Right slide-in panel — node picker + per-node settings
// ------------------------------------------------------------

function NodePanel({
  panel,
  steps,
  onClose,
  onPick,
  onChange,
  onMove,
  onDelete,
}: {
  panel:
    | { mode: "picker"; parent: ParentScope; index: number }
    | { mode: "edit"; cid: string }
    | null
  steps: BuilderStep[]
  onClose: () => void
  onPick: (t: AutomationStepType) => void
  onChange: (cid: string, next: BuilderStep) => void
  onMove: (cid: string, direction: -1 | 1) => void
  onDelete: (cid: string) => void
}) {
  const open = panel !== null
  const editing =
    panel?.mode === "edit" ? findStepByCid(steps, panel.cid) : null
  const info =
    panel?.mode === "edit" ? siblingInfoByCid(steps, panel.cid) : null

  const title =
    panel?.mode === "edit" && editing
      ? STEP_META[editing.step_type].label
      : "Add a step"

  // Node-picker search. Cleared whenever the panel leaves picker mode so
  // it never opens pre-filtered from a previous visit.
  const [query, setQuery] = useState("")
  useEffect(() => {
    if (panel?.mode !== "picker") setQuery("")
  }, [panel?.mode])
  const q = query.trim().toLowerCase()
  const pickerSteps = ADDABLE_STEPS.filter((t) =>
    STEP_META[t].label.toLowerCase().includes(q),
  )

  return (
    <>
      {/* Backdrop — click to dismiss. */}
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed right-0 top-0 bottom-0 z-40 flex w-full max-w-[380px] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Search — picker mode only, pinned above the scrolling list. */}
        {panel?.mode === "picker" && (
          <div className="flex-shrink-0 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search nodes"
                className="h-10 bg-muted pl-9 text-foreground"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {panel?.mode === "picker" ? (
            pickerSteps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No nodes match &quot;{query.trim()}&quot;.
              </p>
            ) : (
            <div className="grid gap-1.5">
              {pickerSteps.map((t) => {
                const Icon = STEP_META[t].icon
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onPick(t)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted/50",
                      NODE_COLORS[STEP_META[t].color].hover,
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md",
                        NODE_COLORS[STEP_META[t].color].tile,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {STEP_META[t].label}
                    </span>
                  </button>
                )
              })}
            </div>
            )
          ) : editing ? (
            <StepEditor
              step={editing}
              onChange={(next) => onChange(editing.cid, next)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              This step no longer exists.
            </p>
          )}
        </div>

        {panel?.mode === "edit" && editing && (
          <footer className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-border p-3">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={!info || info.index === 0}
                aria-label="Move up"
                onClick={() => onMove(editing.cid, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!info || info.index === info.total - 1}
                aria-label="Move down"
                onClick={() => onMove(editing.cid, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(editing.cid)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </footer>
        )}
      </aside>
    </>
  )
}

// ------------------------------------------------------------
// Per-step config editor
// ------------------------------------------------------------

function StepEditor({
  step,
  onChange,
}: {
  step: BuilderStep
  onChange: (s: BuilderStep) => void
}) {
  const cfg = step.step_config
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...step, step_config: { ...cfg, ...patch } })

  switch (step.step_type) {
    case "send_message":
      return (
        <FieldBlock label="Message text">
          <Textarea
            value={(cfg.text as string) ?? ""}
            onChange={(e) => set({ text: e.target.value })}
            placeholder="Hi! Thanks for reaching out…"
            className="min-h-24 bg-muted text-foreground"
          />
        </FieldBlock>
      )
    case "send_template":
      return (
        <SendTemplateFields
          templateName={(cfg.template_name as string) ?? ""}
          language={(cfg.language as string) ?? ""}
          variables={(cfg.variables as Record<string, string>) ?? {}}
          buttonParams={(cfg.button_params as Record<string, string>) ?? {}}
          onChange={(patch) => set(patch)}
        />
      )
    case "send_buttons":
      return (
        <SendButtonsFields
          text={(cfg.text as string) ?? ""}
          headerText={(cfg.header_text as string) ?? ""}
          footerText={(cfg.footer_text as string) ?? ""}
          buttons={(cfg.buttons as { id: string; title: string }[]) ?? []}
          onChange={(patch) => set(patch)}
        />
      )
    case "add_tag":
    case "remove_tag":
      return (
        <FieldBlock label="Tag">
          <TagSelect
            value={(cfg.tag_id as string) ?? ""}
            onChange={(v) => set({ tag_id: v })}
          />
        </FieldBlock>
      )
    case "assign_conversation":
      return (
        <>
          <FieldBlock label="Mode">
            <select
              value={(cfg.mode as string) ?? "round_robin"}
              onChange={(e) => set({ mode: e.target.value })}
              className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
            >
              <option value="round_robin">Round-robin</option>
              <option value="specific">Specific agent</option>
            </select>
          </FieldBlock>
          {cfg.mode === "specific" && (
            <FieldBlock label="Agent">
              <AgentSelect
                value={(cfg.agent_id as string) ?? ""}
                onChange={(v) => set({ agent_id: v })}
              />
            </FieldBlock>
          )}
        </>
      )
    case "update_contact_field":
      return (
        <>
          <FieldBlock label="Field">
            <ContactFieldSelect
              value={(cfg.field as string) ?? "name"}
              onChange={(v) => set({ field: v })}
            />
          </FieldBlock>
          <FieldBlock label="Value">
            {cfg.field === "marketing_opt_out" ? (
              <select
                value={(cfg.value as string) === "true" ? "true" : "false"}
                onChange={(e) => set({ value: e.target.value })}
                className={SELECT_CLASS}
              >
                <option value="true">Opted out (stop sending)</option>
                <option value="false">Opted in (resume sending)</option>
              </select>
            ) : (
              <Input
                value={(cfg.value as string) ?? ""}
                onChange={(e) => set({ value: e.target.value })}
                placeholder="Text or {{ vars.x }} / {{ message.text }}"
                className="bg-muted text-foreground"
              />
            )}
          </FieldBlock>
        </>
      )
    case "create_deal":
      return (
        <>
          <FieldBlock label="Pipeline id">
            <Input
              value={(cfg.pipeline_id as string) ?? ""}
              onChange={(e) => set({ pipeline_id: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <FieldBlock label="Stage id">
            <Input
              value={(cfg.stage_id as string) ?? ""}
              onChange={(e) => set({ stage_id: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <FieldBlock label="Title">
            <Input
              value={(cfg.title as string) ?? ""}
              onChange={(e) => set({ title: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <FieldBlock label="Value">
            <Input
              type="number"
              value={(cfg.value as number) ?? 0}
              onChange={(e) => set({ value: Number(e.target.value) })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
        </>
      )
    case "wait":
      return (
        <div className="grid grid-cols-2 gap-2">
          <FieldBlock label="Amount">
            <Input
              type="number"
              min={1}
              value={(cfg.amount as number) ?? 1}
              onChange={(e) => set({ amount: Math.max(1, Number(e.target.value)) })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <FieldBlock label="Unit">
            <select
              value={(cfg.unit as string) ?? "hours"}
              onChange={(e) => set({ unit: e.target.value })}
              className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </FieldBlock>
        </div>
      )
    case "wait_for_reply":
      return (
        <>
          <FieldBlock label="Reply matches (leave empty for any reply)">
            <Input
              placeholder="Yes, keep going"
              value={(cfg.match_value as string) ?? ""}
              onChange={(e) => set({ match_value: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <p className="-mt-1 mb-2 text-[11px] leading-relaxed text-muted-foreground">
            Matched case-insensitively against what the contact sends. For a
            template button, use the button&apos;s exact label.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <FieldBlock label="Give up after">
              <Input
                type="number"
                min={1}
                value={(cfg.timeout_amount as number) ?? 3}
                onChange={(e) =>
                  set({ timeout_amount: Math.max(1, Number(e.target.value)) })
                }
                className="bg-muted text-foreground"
              />
            </FieldBlock>
            <FieldBlock label="Unit">
              <select
                value={(cfg.timeout_unit as string) ?? "days"}
                onChange={(e) => set({ timeout_unit: e.target.value })}
                className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </FieldBlock>
          </div>
        </>
      )
    case "condition":
      return (
        <>
          <FieldBlock label="Subject">
            <select
              value={(cfg.subject as string) ?? "tag_presence"}
              onChange={(e) => set({ subject: e.target.value })}
              className="w-full rounded-md border border-border bg-muted px-2 py-1.5 text-sm text-foreground"
            >
              <option value="tag_presence">Tag presence</option>
              <option value="contact_field">Contact field</option>
              <option value="message_content">Message content</option>
              <option value="time_of_day">Time of day</option>
            </select>
          </FieldBlock>
          <FieldBlock label="Operand">
            <Input
              placeholder={
                cfg.subject === "time_of_day"
                  ? "HH:mm-HH:mm"
                  : cfg.subject === "contact_field"
                  ? "name / email / company"
                  : cfg.subject === "tag_presence"
                  ? "tag id"
                  : ""
              }
              value={(cfg.operand as string) ?? ""}
              onChange={(e) => set({ operand: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          {(cfg.subject === "contact_field" || cfg.subject === "message_content") && (
            <FieldBlock label="Value">
              <Input
                value={(cfg.value as string) ?? ""}
                onChange={(e) => set({ value: e.target.value })}
                className="bg-muted text-foreground"
              />
            </FieldBlock>
          )}
        </>
      )
    case "send_webhook":
      return (
        <>
          <FieldBlock label="URL">
            <Input
              value={(cfg.url as string) ?? ""}
              onChange={(e) => set({ url: e.target.value })}
              className="bg-muted text-foreground"
            />
          </FieldBlock>
          <FieldBlock label="Body template (JSON)">
            <Textarea
              value={(cfg.body_template as string) ?? ""}
              onChange={(e) => set({ body_template: e.target.value })}
              className="min-h-20 bg-muted font-mono text-xs text-foreground"
            />
          </FieldBlock>
        </>
      )
    case "close_conversation":
      return (
        <p className="text-xs text-muted-foreground">
          Sets the conversation status to &quot;closed&quot;. No configuration needed.
        </p>
      )
    default:
      return null
  }
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string
  /** Optional "i" beside the label — for the explanation that would
   *  otherwise sit under the field as a paragraph nobody reads twice. */
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex items-center gap-1">
        <label className="block text-xs font-medium text-muted-foreground">{label}</label>
        {hint}
      </div>
      {children}
    </div>
  )
}

function previewFor(step: BuilderStep): string {
  switch (step.step_type) {
    case "send_message":
      return (step.step_config.text as string) || "no text yet"
    case "send_template":
      return (step.step_config.template_name as string) || "pick a template"
    case "send_buttons": {
      const buttons = (step.step_config.buttons as { title: string }[] | undefined) ?? []
      const titles = buttons.map((b) => b.title).filter(Boolean)
      return titles.length > 0 ? titles.join(" / ") : "no buttons yet"
    }
    case "wait":
      return `${step.step_config.amount ?? "?"} ${step.step_config.unit ?? ""}`
    case "condition":
      return `when ${step.step_config.subject ?? "?"}`
    case "send_webhook":
      return (step.step_config.url as string) || "no url"
    default:
      return ""
  }
}

// ------------------------------------------------------------
// Tree mutation helpers
// ------------------------------------------------------------

function insertAt(
  steps: BuilderStep[],
  parent: ParentScope,
  index: number,
  node: BuilderStep,
): BuilderStep[] {
  if (parent.kind === "root") {
    const copy = [...steps]
    copy.splice(index, 0, node)
    return copy
  }
  return steps.map((s) => {
    if (s.cid !== parent.parentCid || !s.branches) return s
    const list = [...s.branches[parent.branch]]
    list.splice(index, 0, node)
    return { ...s, branches: { ...s.branches, [parent.branch]: list } }
  })
}

// ------------------------------------------------------------
// cid-addressed tree ops — used by the slide-in node panel, which
// holds a step's client id rather than a positional path.
// ------------------------------------------------------------

function findStepByCid(steps: BuilderStep[], target: string): BuilderStep | null {
  for (const s of steps) {
    if (s.cid === target) return s
    if (s.branches) {
      for (const bucket of [s.branches.yes, s.branches.no, s.branches.timeout]) {
        const found = findStepByCid(bucket, target)
        if (found) return found
      }
    }
  }
  return null
}

/** The step's position within its own sibling list — drives the
 *  move-up/down disabled states in the panel. */
function siblingInfoByCid(
  steps: BuilderStep[],
  target: string,
): { index: number; total: number } | null {
  const idx = steps.findIndex((s) => s.cid === target)
  if (idx !== -1) return { index: idx, total: steps.length }
  for (const s of steps) {
    if (!s.branches) continue
    for (const bucket of [s.branches.yes, s.branches.no, s.branches.timeout]) {
      const info = siblingInfoByCid(bucket, target)
      if (info) return info
    }
  }
  return null
}

function mapStepsByCid(
  steps: BuilderStep[],
  target: string,
  updater: (s: BuilderStep) => BuilderStep,
): BuilderStep[] {
  return steps.map((s) => {
    if (s.cid === target) return updater(s)
    if (!s.branches) return s
    return {
      ...s,
      branches: {
        yes: mapStepsByCid(s.branches.yes, target, updater),
        no: mapStepsByCid(s.branches.no, target, updater),
        timeout: mapStepsByCid(s.branches.timeout, target, updater),
      },
    }
  })
}

function removeStepsByCid(steps: BuilderStep[], target: string): BuilderStep[] {
  return steps
    .filter((s) => s.cid !== target)
    .map((s) =>
      s.branches
        ? {
            ...s,
            branches: {
              yes: removeStepsByCid(s.branches.yes, target),
              no: removeStepsByCid(s.branches.no, target),
              timeout: removeStepsByCid(s.branches.timeout, target),
            },
          }
        : s,
    )
}

function moveStepsByCid(
  steps: BuilderStep[],
  target: string,
  direction: -1 | 1,
): BuilderStep[] {
  const idx = steps.findIndex((s) => s.cid === target)
  if (idx !== -1) {
    const j = idx + direction
    if (j < 0 || j >= steps.length) return steps
    const copy = [...steps]
    ;[copy[idx], copy[j]] = [copy[j], copy[idx]]
    return copy
  }
  return steps.map((s) =>
    s.branches
      ? {
          ...s,
          branches: {
            yes: moveStepsByCid(s.branches.yes, target, direction),
            no: moveStepsByCid(s.branches.no, target, direction),
            timeout: moveStepsByCid(s.branches.timeout, target, direction),
          },
        }
      : s,
  )
}

// ------------------------------------------------------------
// Serialize builder tree → API payload (flattened shape)
// ------------------------------------------------------------

interface ApiStep {
  step_type: string
  step_config: Record<string, unknown>
  branches?: { yes?: ApiStep[]; no?: ApiStep[]; timeout?: ApiStep[] }
}

export function toApiSteps(steps: BuilderStep[]): ApiStep[] {
  return steps.map((s) => ({
    step_type: s.step_type,
    step_config: s.step_config,
    branches: s.branches
      ? {
          yes: toApiSteps(s.branches.yes),
          no: toApiSteps(s.branches.no),
          timeout: toApiSteps(s.branches.timeout ?? []),
        }
      : undefined,
  }))
}

/**
 * Convert server-returned step tree (from loadStepsTree) into the
 * builder-local shape with client ids.
 */
export interface ServerStepNode {
  id: string
  step_type: string
  step_config: Record<string, unknown>
  branches: {
    yes: ServerStepNode[]
    no: ServerStepNode[]
    timeout?: ServerStepNode[]
  }
}

export function fromServerSteps(nodes: ServerStepNode[]): BuilderStep[] {
  return nodes.map((n) => ({
    cid: cid(),
    step_type: n.step_type as AutomationStepType,
    step_config: n.step_config ?? {},
    branches: BRANCHING_STEPS.includes(n.step_type as AutomationStepType)
      ? {
          yes: fromServerSteps(n.branches?.yes ?? []),
          no: fromServerSteps(n.branches?.no ?? []),
          timeout: fromServerSteps(n.branches?.timeout ?? []),
        }
      : undefined,
  }))
}
