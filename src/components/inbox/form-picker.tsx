"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { WhatsAppForm } from "@/types";
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
import { ArrowLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";

export interface FormSendValues {
  headerText?: string;
  bodyText: string;
  footerText?: string;
  ctaText: string;
}

interface FormPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (form: WhatsAppForm, values: FormSendValues) => void;
}

/**
 * Mirrors template-picker.tsx's two-step shape (pick → fill message
 * text → send) but simpler: a Form has no variable substitution, just
 * the surrounding message text (header/body/footer) and the button
 * label the customer taps to open it.
 */
export function FormPicker({ open, onOpenChange, onSelect }: FormPickerProps) {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<WhatsAppForm[]>([]);
  const [selected, setSelected] = useState<WhatsAppForm | null>(null);
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [ctaText, setCtaText] = useState("Open");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("whatsapp_forms")
        .select("*")
        .eq("status", "PUBLISHED")
        .order("name");
      if (cancelled) return;
      setForms((data as WhatsAppForm[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function resetDraft() {
    setSelected(null);
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setCtaText("Open");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetDraft();
    onOpenChange(next);
  }

  function handleConfirm() {
    if (!selected || !bodyText.trim()) return;
    onSelect(selected, {
      headerText: headerText.trim() || undefined,
      bodyText: bodyText.trim(),
      footerText: footerText.trim() || undefined,
      ctaText: ctaText.trim() || "Open",
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{selected ? selected.name : "Send a form"}</DialogTitle>
          <DialogDescription>
            {selected
              ? "Write the message that introduces the form."
              : "Pick a published form to send in this conversation."}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-primary size-5 animate-spin" />
            </div>
          ) : forms.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No published forms yet — publish one from the Forms page first.
            </p>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {forms.map((form) => (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => setSelected(form)}
                  className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                >
                  <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-md">
                    <ClipboardList className="size-4" />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {form.name}
                  </span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="form-header">Header (optional)</Label>
              <Input
                id="form-header"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g. Quick question"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-body">Message</Label>
              <Input
                id="form-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="e.g. Mind filling this out so we can help faster?"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-footer">Footer (optional)</Label>
              <Input
                id="form-footer"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Takes under a minute"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="form-cta">Button text</Label>
              <Input
                id="form-cta"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Open"
                className="h-10"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {selected ? (
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={!bodyText.trim()}>
                Send
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
