"use client";

/**
 * Per-node configuration form, dispatched by node_type.
 *
 * One component, ten branches. Each branch renders the inputs that
 * map onto the node's `config` JSONB shape (text + buttons for
 * send_buttons, prompt + var_key for collect_input, etc.) and forwards
 * edits up via `onUpdateConfig`.
 *
 * Why this lives in src/components/flows/forms/ instead of next to
 * the list editor: PR 2 (canvas editing) needs to mount the same
 * form in a side panel when a user clicks a node on the canvas.
 * Keeping the per-node forms here means there's exactly one place
 * where each form's behaviour and validation lives — drift between
 * "what the list editor shows" and "what the canvas side panel
 * shows" becomes impossible.
 *
 * `showAdvanced` is the disclosure that surfaces internal
 * identifiers (node_key, button reply_id, list row reply_id) — owned
 * by the host (NodeCard / SideSheet) so the toggle is rendered
 * outside this form alongside whatever delete/cancel buttons that
 * host wants. The form just reads the boolean and conditionally
 * renders the advanced rows.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { uploadAccountMedia, MEDIA_MAX_BYTES } from "@/lib/storage/upload-media";
import type {
  ConditionOperator,
  ConditionSubject,
} from "@/lib/flows/types";
import { slugify, type BuilderNode } from "../shared";
import { NextNodeRow, NodeKeySelect, TextRow } from "./fields";

interface NodeConfigFormProps {
  node: BuilderNode;
  allNodes: BuilderNode[];
  showAdvanced: boolean;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}

export function NodeConfigForm({
  node,
  allNodes,
  showAdvanced,
  onUpdateConfig,
}: NodeConfigFormProps) {
  const cfg = node.config;
  switch (node.node_type) {
    case "start":
      return (
        <NextNodeRow
          value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
          allNodes={allNodes}
          currentKey={node.node_key}
          onChange={(v) => onUpdateConfig({ next_node_key: v })}
          label="Advances to"
        />
      );

    case "send_message":
      return (
        <>
          <TextRow
            label="Text sent to the customer"
            value={(cfg as { text?: string }).text ?? ""}
            onChange={(v) => onUpdateConfig({ text: v })}
          />
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label="Advances to"
          />
        </>
      );

    case "send_buttons":
      return (
        <SendButtonsForm
          cfg={cfg as SendButtonsCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
        />
      );

    case "send_list":
      return (
        <SendListForm
          cfg={cfg as SendListCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
          showAdvanced={showAdvanced}
        />
      );

    case "send_media":
      return (
        <SendMediaForm
          cfg={cfg as SendMediaCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      );

    case "collect_input":
      return (
        <>
          <TextRow
            label="Prompt sent to the customer"
            value={(cfg as { prompt_text?: string }).prompt_text ?? ""}
            onChange={(v) => onUpdateConfig({ prompt_text: v })}
            rows={2}
          />
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Variable key (stored in flow_runs.vars; alphanumeric + underscore)
            </label>
            <Input
              value={(cfg as { var_key?: string }).var_key ?? ""}
              onChange={(e) =>
                onUpdateConfig({
                  var_key: e.target.value.replace(/[^a-zA-Z0-9_]/g, ""),
                })
              }
              placeholder="e.g. name, email, company"
              className="bg-muted font-mono text-xs"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Interpolate in downstream prompts and handoff notes with{" "}
              <code className="rounded bg-muted px-1">
                {"{{vars."}
                {(cfg as { var_key?: string }).var_key || "name"}
                {"}}"}
              </code>
              .
            </p>
            {/* Said here because this is where someone decides to ask.
                A flow that opens by asking for a name the CRM already
                holds is the most common way one of these reads badly. */}
            <p className="mt-1 text-[10px] text-muted-foreground">
              No need to ask for{" "}
              <code className="rounded bg-muted px-1">name</code>,{" "}
              <code className="rounded bg-muted px-1">phone</code>,{" "}
              <code className="rounded bg-muted px-1">email</code>,{" "}
              <code className="rounded bg-muted px-1">city</code> or{" "}
              <code className="rounded bg-muted px-1">tags</code> — those are
              already filled in from the contact, along with{" "}
              <code className="rounded bg-muted px-1">message</code>, what they
              just sent.
            </p>
          </div>
          <NextNodeRow
            value={(cfg as { next_node_key?: string }).next_node_key ?? ""}
            allNodes={allNodes}
            currentKey={node.node_key}
            onChange={(v) => onUpdateConfig({ next_node_key: v })}
            label="After capturing, advance to"
          />
        </>
      );

    case "condition":
      return (
        <ConditionForm
          cfg={cfg as ConditionCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      );

    case "set_tag":
      return (
        <SetTagForm
          cfg={cfg as SetTagCfg}
          allNodes={allNodes}
          currentKey={node.node_key}
          onUpdateConfig={onUpdateConfig}
        />
      );

    case "handoff":
      return (
        <TextRow
          label="Internal note (for the agent picking up)"
          value={(cfg as { note?: string }).note ?? ""}
          onChange={(v) => onUpdateConfig({ note: v })}
          rows={2}
        />
      );

    case "end":
      return (
        <p className="text-xs text-muted-foreground">
          Terminal node. When the runner reaches this node the run is marked
          complete. No config needed.
        </p>
      );
  }
}

// ============================================================
// send_buttons
// ============================================================

interface SendButtonsCfg {
  text?: string;
  footer_text?: string;
  buttons?: Array<{ reply_id: string; title: string; next_node_key: string }>;
}

function SendButtonsForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
}: {
  cfg: SendButtonsCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
}) {
  const buttons = cfg.buttons ?? [];
  const updateButton = (
    idx: number,
    patch: Partial<NonNullable<SendButtonsCfg["buttons"]>[number]>,
  ) => {
    onUpdateConfig({
      buttons: buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };
  const addButton = () =>
    onUpdateConfig({
      buttons: [
        ...buttons,
        {
          reply_id: `btn_${buttons.length + 1}`,
          title: "Option",
          next_node_key: "",
        },
      ],
    });
  const removeButton = (idx: number) =>
    onUpdateConfig({ buttons: buttons.filter((_, i) => i !== idx) });

  return (
    <>
      <TextRow
        label="Body text"
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <TextRow
        label="Footer (optional, 60 chars)"
        value={cfg.footer_text ?? ""}
        onChange={(v) => onUpdateConfig({ footer_text: v })}
      />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs text-muted-foreground">
            Buttons (1–3) — each one routes to a different next node
          </label>
        </div>
        <div className="flex flex-col gap-3">
          {buttons.map((b, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/40 p-3",
                showAdvanced
                  ? "md:grid-cols-[1fr_2fr_2fr_auto]"
                  : "md:grid-cols-[2fr_2fr_auto]",
              )}
            >
              {showAdvanced && (
                <Input
                  value={b.reply_id}
                  onChange={(e) =>
                    updateButton(i, {
                      reply_id: slugify(e.target.value, `btn_${i + 1}`),
                    })
                  }
                  placeholder="reply_id"
                  className="bg-muted font-mono text-xs"
                />
              )}
              <Input
                value={b.title}
                onChange={(e) => updateButton(i, { title: e.target.value })}
                placeholder="Visible title (≤20 chars)"
                className="bg-muted"
                maxLength={20}
              />
              <NodeKeySelect
                value={b.next_node_key || null}
                nodes={allNodes}
                excludeKey={currentKey}
                onChange={(v) => updateButton(i, { next_node_key: v ?? "" })}
                placeholder="Next node…"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeButton(i)}
                className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
        {buttons.length < 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addButton}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add button
          </Button>
        )}
      </div>
    </>
  );
}

// ============================================================
// send_list
// ============================================================

interface SendListCfg {
  text?: string;
  button_label?: string;
  footer_text?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{
      reply_id: string;
      title: string;
      description?: string;
      next_node_key: string;
    }>;
  }>;
}

function SendListForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
  showAdvanced,
}: {
  cfg: SendListCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
  showAdvanced: boolean;
}) {
  const sections = cfg.sections ?? [];
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);

  const updateSection = (
    sIdx: number,
    patch: Partial<NonNullable<SendListCfg["sections"]>[number]>,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, ...patch } : s,
      ),
    });
  };
  const addSection = () =>
    onUpdateConfig({
      sections: [
        ...sections,
        {
          title: "",
          rows: [
            {
              reply_id: `row_${totalRows + 1}`,
              title: `Option ${totalRows + 1}`,
              next_node_key: "",
            },
          ],
        },
      ],
    });
  const removeSection = (sIdx: number) =>
    onUpdateConfig({ sections: sections.filter((_, i) => i !== sIdx) });
  const updateRow = (
    sIdx: number,
    rIdx: number,
    patch: Partial<
      NonNullable<SendListCfg["sections"]>[number]["rows"][number]
    >,
  ) => {
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: s.rows.map((r, j) => (j === rIdx ? { ...r, ...patch } : r)),
            }
          : s,
      ),
    });
  };
  const addRow = (sIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              rows: [
                ...s.rows,
                {
                  reply_id: `row_${totalRows + 1}`,
                  title: `Option ${totalRows + 1}`,
                  next_node_key: "",
                },
              ],
            }
          : s,
      ),
    });
  const removeRow = (sIdx: number, rIdx: number) =>
    onUpdateConfig({
      sections: sections.map((s, i) =>
        i === sIdx ? { ...s, rows: s.rows.filter((_, j) => j !== rIdx) } : s,
      ),
    });

  return (
    <>
      <TextRow
        label="Body text"
        value={cfg.text ?? ""}
        onChange={(v) => onUpdateConfig({ text: v })}
        rows={3}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TextRow
          label="Tap-to-expand button label (≤20 chars)"
          value={cfg.button_label ?? ""}
          onChange={(v) => onUpdateConfig({ button_label: v })}
        />
        <TextRow
          label="Footer (optional, 60 chars)"
          value={cfg.footer_text ?? ""}
          onChange={(v) => onUpdateConfig({ footer_text: v })}
        />
      </div>

      <div className="mt-2">
        <label className="mb-2 block text-xs text-muted-foreground">
          Rows (1–10 total across all sections)
        </label>
        {sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="mb-3 rounded-md border border-border bg-muted/40 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={section.title ?? ""}
                onChange={(e) =>
                  updateSection(sIdx, { title: e.target.value })
                }
                placeholder={`Section ${sIdx + 1} title (optional)`}
                className="bg-muted text-xs"
              />
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSection(sIdx)}
                  className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  aria-label="Remove section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {section.rows.map((row, rIdx) => (
              <div
                key={rIdx}
                className={cn(
                  "mb-2 grid grid-cols-1 gap-2",
                  showAdvanced
                    ? "md:grid-cols-[1fr_2fr_2fr_auto]"
                    : "md:grid-cols-[2fr_2fr_auto]",
                )}
              >
                {showAdvanced && (
                  <Input
                    value={row.reply_id}
                    onChange={(e) =>
                      updateRow(sIdx, rIdx, {
                        reply_id: slugify(
                          e.target.value,
                          `row_${rIdx + 1}`,
                        ),
                      })
                    }
                    placeholder="reply_id"
                    className="bg-muted font-mono text-xs"
                  />
                )}
                <Input
                  value={row.title}
                  onChange={(e) =>
                    updateRow(sIdx, rIdx, { title: e.target.value })
                  }
                  placeholder="Row title (≤24)"
                  className="bg-muted"
                  maxLength={24}
                />
                <NodeKeySelect
                  value={row.next_node_key || null}
                  nodes={allNodes}
                  excludeKey={currentKey}
                  onChange={(v) =>
                    updateRow(sIdx, rIdx, { next_node_key: v ?? "" })
                  }
                  placeholder="Next node…"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(sIdx, rIdx)}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {totalRows < 10 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => addRow(sIdx)}
                className="mt-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add row
              </Button>
            )}
          </div>
        ))}
        {/* WhatsApp's interactive-list spec caps sections at 10. Group rows
            by category (Billing / Support / Sales etc.) to give customers a
            scannable menu. */}
        {sections.length < 10 && (
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            Add section
          </Button>
        )}
      </div>
    </>
  );
}

// ============================================================
// condition
// ============================================================

interface ConditionCfg {
  subject?: ConditionSubject;
  subject_key?: string;
  // Imported rather than re-declared. This union used to be spelled out
  // here as well, so adding an operator to the engine left the form
  // silently unable to offer it — the two drifted apart with nothing to
  // catch it.
  operator?: ConditionOperator;
  value?: string;
  true_next?: string;
  false_next?: string;
}

interface UserTag {
  id: string;
  name: string;
  color?: string;
}

/** Operators, grouped so the list reads as kinds of comparison rather
 *  than one flat run of fourteen. */
const CONDITION_OPERATORS: {
  group: string;
  items: { value: NonNullable<ConditionCfg["operator"]>; label: string }[];
}[] = [
  {
    group: "Text",
    items: [
      { value: "equals", label: "is exactly" },
      { value: "not_equals", label: "is not" },
      { value: "contains", label: "contains" },
      { value: "not_contains", label: "does not contain" },
      { value: "starts_with", label: "starts with" },
      { value: "ends_with", label: "ends with" },
    ],
  },
  {
    group: "Number",
    items: [
      { value: "gt", label: "is greater than" },
      { value: "gte", label: "is at least" },
      { value: "lt", label: "is less than" },
      { value: "lte", label: "is at most" },
    ],
  },
  {
    group: "List",
    items: [
      { value: "in", label: "is one of" },
      { value: "not_in", label: "is not one of" },
    ],
  },
  {
    group: "Presence",
    items: [
      { value: "present", label: "has any value" },
      { value: "absent", label: "is empty" },
    ],
  },
];

/** Operators that compare against nothing — the value box is hidden. */
const VALUELESS_OPERATORS = new Set(["present", "absent"]);

/** Contact columns worth branching on. Deliberately the same four the
 *  engine resolves — offering a field it cannot read would produce a
 *  branch that silently never fires. */
const CONTACT_FIELDS = ["name", "email", "phone", "company"] as const;

/**
 * Variables every run starts with, seeded by the engine before the
 * first node executes — see `seedVarsFromContact`.
 *
 * They existed before this list did, and were invisible: the picker
 * only offered keys from collect_input nodes, so a flow author had no
 * way to learn that `{{vars.name}}` already held the contact's name
 * and would ask for it with a question instead.
 */
const SEEDED_VARS: { key: string; note: string }[] = [
  { key: "message", note: "what they just sent" },
  { key: "name", note: "from the contact" },
  { key: "phone", note: "from the contact" },
  { key: "email", note: "from the contact" },
  { key: "company", note: "from the contact" },
  { key: "city", note: "from the contact" },
  { key: "state", note: "from the contact" },
  { key: "country", note: "from the contact" },
  { key: "pin_code", note: "from the contact" },
  { key: "tags", note: "comma-separated tag names" },
];

/**
 * The if/else node's configuration.
 *
 * Laid out as a sentence — "If <subject> <operator> <value>" — rather
 * than a labelled grid of If / var name / Operator / Value. The old
 * layout read as a database form and gave no hint of what the node
 * actually did at a glance.
 *
 * The variable picker lists the keys this flow ACTUALLY captures,
 * gathered from every collect_input node. It used to be a bare text box
 * with the placeholder "e.g. email", so getting a branch working
 * depended on remembering a key exactly — and a typo produced a
 * condition that was simply always false, with nothing on screen to
 * say so.
 */
function ConditionForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  cfg: ConditionCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const tags = useUserTags();

  const subject = cfg.subject ?? "var";
  const operator = cfg.operator ?? "equals";
  const showValue = !VALUELESS_OPERATORS.has(operator);
  const isList = operator === "in" || operator === "not_in";
  const isNumeric = ["gt", "gte", "lt", "lte"].includes(operator);

  // Variables this flow captures, from every collect_input node. Not
  // filtered to upstream nodes: the builder does not enforce ordering,
  // and hiding a key because of where it sits on the canvas would be
  // more confusing than listing one that has not run yet.
  const capturedVars = useMemo(() => {
    const keys = new Set<string>();
    for (const n of allNodes) {
      if (n.node_type !== "collect_input") continue;
      const key = (n.config as { var_key?: string })?.var_key?.trim();
      if (key) keys.add(key);
    }
    return [...keys].sort();
  }, [allNodes]);

  const selectedTag = tags.find((t) => t.id === cfg.subject_key);

  return (
    <>
      {/* The rule, as one sentence. */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">If</span>

          <Select
            value={subject}
            onValueChange={(v) =>
              // Changing the subject invalidates the key that went with
              // it — a tag UUID is meaningless as a variable name.
              onUpdateConfig({
                subject: v as ConditionCfg["subject"],
                subject_key: "",
              })
            }
          >
            <SelectTrigger className="h-8 w-auto min-w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="var">a captured answer</SelectItem>
              <SelectItem value="tag">a contact tag</SelectItem>
              <SelectItem value="contact_field">a contact field</SelectItem>
            </SelectContent>
          </Select>

          {subject === "tag" ? (
            <Select
              value={cfg.subject_key || ""}
              onValueChange={(v) => onUpdateConfig({ subject_key: v })}
            >
              <SelectTrigger className="h-8 w-auto min-w-36 bg-background">
                <SelectValue placeholder="pick a tag…" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : subject === "contact_field" ? (
            <Select
              value={cfg.subject_key || ""}
              onValueChange={(v) => onUpdateConfig({ subject_key: v })}
            >
              <SelectTrigger className="h-8 w-auto min-w-32 bg-background">
                <SelectValue placeholder="pick a field…" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            // Two groups: what the run already knows before it starts,
            // and what this flow asks for. The seeded group is the
            // point — without it an author asks a question for
            // something the CRM already holds.
            <Select
              value={cfg.subject_key || ""}
              onValueChange={(v) => onUpdateConfig({ subject_key: v })}
            >
              <SelectTrigger className="h-8 w-auto min-w-40 bg-background">
                <SelectValue placeholder="pick a value…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Already known</SelectLabel>
                  {SEEDED_VARS.map((v) => (
                    <SelectItem key={v.key} value={v.key}>
                      {v.key}
                      <span className="ml-1.5 text-muted-foreground">
                        {v.note}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
                {capturedVars.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Asked in this flow</SelectLabel>
                    {capturedVars.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          )}

          <Select
            value={operator}
            onValueChange={(v) =>
              onUpdateConfig({ operator: v as ConditionCfg["operator"] })
            }
          >
            <SelectTrigger className="h-8 w-auto min-w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPERATORS.map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel>{g.group}</SelectLabel>
                  {g.items.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          {showValue && (
            <Input
              value={cfg.value ?? ""}
              onChange={(e) => onUpdateConfig({ value: e.target.value })}
              inputMode={isNumeric ? "decimal" : "text"}
              placeholder={
                isList ? "Kochi, Kollam, Delhi" : isNumeric ? "1000" : "value"
              }
              className="h-8 w-auto min-w-32 flex-1 bg-background"
            />
          )}
        </div>

        {/* Say what an operator means where the label alone does not. */}
        {isList && (
          <p className="text-[11px] text-muted-foreground">
            Separate the options with commas. Matching ignores upper and lower
            case.
          </p>
        )}
        {isNumeric && (
          <p className="text-[11px] text-muted-foreground">
            Compared as a number. If either side is not a number the condition
            is false — it never falls back to comparing text.
          </p>
        )}
        {subject === "var" && capturedVars.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            The values under &ldquo;Already known&rdquo; need no question —
            they are filled in before the flow starts. Add an &ldquo;Ask a
            question&rdquo; step to collect anything else.
          </p>
        )}
        {subject === "tag" && tags.length === 0 && (
          <p className="text-[11px] text-amber-500">
            No tags on this account yet. Create one under Contacts → a
            contact → Tags, and it will appear here.
          </p>
        )}
        {subject === "tag" && tags.length > 0 && !selectedTag && cfg.subject_key && (
          <p className="text-[11px] text-amber-500">
            That tag no longer exists. Pick another, or this branch is always
            false.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <NextNodeRow
          value={cfg.true_next ?? ""}
          allNodes={allNodes}
          currentKey={currentKey}
          onChange={(v) => onUpdateConfig({ true_next: v })}
          label="If true → advance to"
        />
        <NextNodeRow
          value={cfg.false_next ?? ""}
          allNodes={allNodes}
          currentKey={currentKey}
          onChange={(v) => onUpdateConfig({ false_next: v })}
          label="If false → advance to"
        />
      </div>
    </>
  );
}

// ============================================================
// set_tag
// ============================================================

interface SetTagCfg {
  mode?: "add" | "remove";
  tag_id?: string;
  next_node_key?: string;
}

function SetTagForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  cfg: SetTagCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const tags = useUserTags();

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Action</label>
          <Select
            value={cfg.mode ?? "add"}
            onValueChange={(v) =>
              onUpdateConfig({ mode: v as SetTagCfg["mode"] })
            }
          >
            <SelectTrigger className="bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Add tag</SelectItem>
              <SelectItem value="remove">Remove tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tag</label>
          {tags.length > 0 ? (
            <Select
              value={cfg.tag_id ?? ""}
              onValueChange={(v) => onUpdateConfig({ tag_id: v })}
            >
              <SelectTrigger className="bg-muted">
                <SelectValue placeholder="Pick a tag…" />
              </SelectTrigger>
              <SelectContent>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={cfg.tag_id ?? ""}
              onChange={(e) => onUpdateConfig({ tag_id: e.target.value })}
              placeholder="Tag UUID"
              className="bg-muted font-mono text-xs"
            />
          )}
        </div>
      </div>
      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label="Then advance to"
      />
    </>
  );
}

/**
 * Shared loader for both `condition` (subject=tag) and `set_tag`.
 * Falls back to raw UUID input if the endpoint is absent on older
 * deployments — the form remains authorable in that case.
 */
function useUserTags(): UserTag[] {
  const [tags, setTags] = useState<UserTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Straight to Supabase, the way every other tag picker in the app
      // reads them (contacts, campaigns, automations). This used to
      // fetch "/api/tags", a route that does not exist — the 404 was
      // swallowed by the catch and the dropdown just stayed empty, with
      // nothing anywhere to say why.
      //
      // RLS scopes `tags` to the caller's account, so no filter here.
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .order("name");
      if (error) {
        console.error("[flows] tag load failed:", error.message);
        return;
      }
      if (!cancelled) setTags((data as UserTag[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return tags;
}

// ============================================================
// send_media
// ============================================================

interface SendMediaCfg {
  media_type?: "image" | "video" | "document";
  media_url?: string;
  caption?: string;
  filename?: string;
  next_node_key?: string;
}

// Mirrors the bucket's allowed_mime_types from migration 016. Kept in
// sync with the storage policy so the picker rejects unsupported files
// before they hit the network rather than failing with a confusing
// Supabase RLS / mime-type error.
const MEDIA_ACCEPT: Record<NonNullable<SendMediaCfg["media_type"]>, string> = {
  image: "image/png,image/jpeg,image/webp",
  video: "video/mp4,video/3gpp",
  document:
    "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
};

const FLOW_MEDIA_BUCKET = "flow-media";

function SendMediaForm({
  cfg,
  allNodes,
  currentKey,
  onUpdateConfig,
}: {
  cfg: SendMediaCfg;
  allNodes: BuilderNode[];
  currentKey: string;
  onUpdateConfig: (patch: Record<string, unknown>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const mediaType = cfg.media_type ?? "image";
  const isDocument = mediaType === "document";
  const displayName =
    cfg.filename ||
    (cfg.media_url ? cfg.media_url.split("/").pop() ?? "" : "");

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > MEDIA_MAX_BYTES) {
        toast.error(
          `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is 16 MB.`,
        );
        return;
      }
      setUploading(true);
      try {
        // Account-scoped upload (path `account-<id>/...`) — see
        // uploadAccountMedia + migration 020's flow-media RLS policy.
        const { publicUrl } = await uploadAccountMedia(FLOW_MEDIA_BUCKET, file);
        // Patch all fields in one call so the form doesn't re-render
        // with a half-uploaded state.
        onUpdateConfig({
          media_url: publicUrl,
          filename: file.name,
        });
        toast.success("File uploaded.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUpdateConfig],
  );

  const handleClear = () => {
    onUpdateConfig({ media_url: "", filename: "" });
  };

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Media type</label>
        <Select
          value={mediaType}
          onValueChange={(v) => {
            // Changing type clears the existing file — the bucket
            // accepts different MIME sets per type and a previously
            // uploaded PDF can't be sent as an image.
            onUpdateConfig({
              media_type: v as NonNullable<SendMediaCfg["media_type"]>,
              media_url: "",
              filename: "",
            });
          }}
        >
          <SelectTrigger className="bg-muted">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="image">Image (PNG, JPEG, WebP)</SelectItem>
            <SelectItem value="video">Video (MP4, 3GP)</SelectItem>
            <SelectItem value="document">
              Document (PDF, Word, Excel, PowerPoint, TXT)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">File</label>
        {cfg.media_url ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs">
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <a
              href={cfg.media_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-foreground hover:text-cyan-300"
              title={displayName || cfg.media_url}
            >
              {displayName || cfg.media_url}
            </a>
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove file"
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Click to upload (max 16 MB)
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={MEDIA_ACCEPT[mediaType]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            // Reset so picking the same file twice still fires onChange.
            e.target.value = "";
          }}
        />
      </div>

      <TextRow
        label="Caption (optional, shown under the media)"
        value={cfg.caption ?? ""}
        onChange={(v) => onUpdateConfig({ caption: v })}
        rows={2}
      />

      {isDocument && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Filename shown to the customer (documents only)
          </label>
          <Input
            value={cfg.filename ?? ""}
            onChange={(e) => onUpdateConfig({ filename: e.target.value })}
            placeholder="invoice.pdf"
            className="bg-muted text-xs"
          />
        </div>
      )}

      <NextNodeRow
        value={cfg.next_node_key ?? ""}
        allNodes={allNodes}
        currentKey={currentKey}
        onChange={(v) => onUpdateConfig({ next_node_key: v })}
        label="After sending, advance to"
      />
    </>
  );
}
