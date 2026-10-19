"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MessageTemplate } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractVariableIndices } from "@/lib/whatsapp/template-validators";

export interface TemplateSendValues {
  body: string[];
  headerText?: string;
  buttonParams?: Record<number, string>;
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: MessageTemplate, values: TemplateSendValues) => void;
}

function renderBodyPreview(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const idx = Number(raw) - 1;
    const value = params[idx];
    return value && value.trim().length > 0 ? value : `{{${raw}}}`;
  });
}

interface UrlButtonSlot {
  index: number;
  text: string;
  url: string;
}

/**
 * Templates may need values for: body variables, a text-header
 * variable, and per-URL-button suffixes. Collect them all so the
 * send-message path doesn't 400 on missing parameters.
 */
function collectVariableSlots(template: MessageTemplate): {
  bodyVars: number[];
  headerVarCount: number;
  urlButtonSlots: UrlButtonSlot[];
} {
  const bodyVars = extractVariableIndices(template.body_text);
  const headerVarCount =
    template.header_type === "text" && template.header_content
      ? extractVariableIndices(template.header_content).length
      : 0;
  const urlButtonSlots: UrlButtonSlot[] = [];
  (template.buttons ?? []).forEach((b, i) => {
    if (b.type === "URL" && extractVariableIndices(b.url).length > 0) {
      urlButtonSlots.push({ index: i, text: b.text, url: b.url });
    }
  });
  return { bodyVars, headerVarCount, urlButtonSlots };
}

export function TemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [headerText, setHeaderText] = useState<string>("");
  const [buttonParams, setButtonParams] = useState<Record<number, string>>({});
  // The template dropdown: open, and what is typed in its search.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setTemplates([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch templates:", error);
        setTemplates([]);
      } else {
        setTemplates((data as MessageTemplate[]) ?? []);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function resetSelection() {
    setSelectedId(null);
    setParams([]);
    setHeaderText("");
    setButtonParams({});
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetSelection();
    onOpenChange(next);
  }

  // Search by name or by what the template says.
  const shownTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.body_text ?? "").toLowerCase().includes(q),
    );
  }, [templates, query]);

  /** Choose (or switch) the template: its fields start empty. */
  function pickTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const slots = collectVariableSlots(template);
    setSelectedId(id);
    setParams(new Array(slots.bodyVars.length).fill(""));
    setHeaderText("");
    setButtonParams({});
  }

  function confirm() {
    if (!selected) return;
    const values: TemplateSendValues = { body: params };
    if (headerText.trim()) values.headerText = headerText.trim();
    if (Object.keys(buttonParams).length > 0) {
      values.buttonParams = Object.fromEntries(
        Object.entries(buttonParams).map(([k, v]) => [Number(k), v.trim()]),
      );
    }
    onSelect(selected, values);
    handleOpenChange(false);
  }

  const slots = useMemo(
    () => (selected ? collectVariableSlots(selected) : null),
    [selected],
  );
  const canConfirm =
    !!selected &&
    !!slots &&
    slots.bodyVars.every((_, i) => (params[i] ?? "").trim().length > 0) &&
    (slots.headerVarCount === 0 || headerText.trim().length > 0) &&
    slots.urlButtonSlots.every(
      (s) => (buttonParams[s.index] ?? "").trim().length > 0,
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border bg-popover sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">Send template</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pick an approved WhatsApp template to send to this contact.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          {!loading && templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No approved templates. Approve one in WhatsApp Manager, then sync
              it from Settings → Templates.
            </p>
          ) : (
            // A dropdown with a search box: Select has no room for one,
            // so this is a popover list, as the inbox tag picker is.
            <Popover
              open={pickerOpen}
              onOpenChange={(next) => {
                setPickerOpen(next);
                if (!next) setQuery("");
              }}
            >
              <PopoverTrigger
                disabled={loading}
                aria-label="Template"
                className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-transparent px-3.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading templates…
                  </span>
                ) : selected ? (
                  <span className="truncate text-foreground">{selected.name}</span>
                ) : (
                  <span className="text-muted-foreground">Choose template</span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-(--anchor-width) gap-0 p-0">
                {/* The line under the search is its underline. */}
                <div className="flex items-center gap-2 border-b border-border px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search templates…"
                    aria-label="Search templates"
                    autoFocus
                    className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                  {shownTemplates.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No templates match.
                    </p>
                  ) : (
                    shownTemplates.map((t) => {
                      const active = t.id === selectedId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            pickTemplate(t.id);
                            setPickerOpen(false);
                            setQuery("");
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted",
                            active && "bg-muted",
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium text-foreground">{t.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[t.category?.toLowerCase(), t.language].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {selected && (
            <>
              <div className="rounded-md border border-border bg-background/50 p-3">
                <p className="mb-1 text-xs text-muted-foreground">Preview</p>
                <p className="whitespace-pre-wrap text-sm text-popover-foreground">
                  {renderBodyPreview(selected.body_text, params)}
                </p>
                {selected.footer_text && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    {selected.footer_text}
                  </p>
                )}
              </div>
              {slots && slots.headerVarCount > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-popover-foreground">
                    {`Header {{1}}`}
                  </Label>
                  <Input
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Value for the header variable"
                    className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}
              {slots?.bodyVars.map((v, i) => (
                <div key={v} className="space-y-1">
                  <Label className="text-xs text-popover-foreground">{`Body {{${v}}}`}</Label>
                  <Input
                    value={params[i] ?? ""}
                    onChange={(e) => {
                      const next = [...params];
                      next[i] = e.target.value;
                      setParams(next);
                    }}
                    placeholder={`Value for {{${v}}}`}
                    className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              ))}
              {slots?.urlButtonSlots.map((slot) => (
                <div key={slot.index} className="space-y-1">
                  <Label className="text-xs text-popover-foreground">
                    {`URL button "${slot.text}" — value for `}{`{{1}}`}
                  </Label>
                  <Input
                    value={buttonParams[slot.index] ?? ""}
                    onChange={(e) =>
                      setButtonParams((prev) => ({
                        ...prev,
                        [slot.index]: e.target.value,
                      }))
                    }
                    placeholder="URL suffix value"
                    className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground break-all">
                    Final URL: {slot.url.replace(/\{\{1\}\}/g, buttonParams[slot.index] || "{{1}}")}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-border text-popover-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={confirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Send template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
