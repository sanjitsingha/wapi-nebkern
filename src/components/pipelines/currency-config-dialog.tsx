"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Account-wide default currency, edited from the pipeline board's Config
 * button instead of a dedicated settings page (issue #218's control, moved
 * here so it lives next to the deals it governs).
 *
 * One currency per account: the chosen code seeds new deals and formats
 * every aggregated total; existing deals keep their own saved currency.
 * Writes go straight to `accounts.default_currency`; the accounts_update
 * RLS policy (017) restricts that to admins+, so non-admins see a
 * disabled, read-only control.
 */
export function CurrencyConfigDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const {
    accountId,
    defaultCurrency,
    canEditSettings,
    profileLoading,
    refreshProfile,
  } = useAuth();

  const [selected, setSelected] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);

  // Sync to the account default whenever it resolves/changes, and reset
  // any unsaved pick each time the dialog is reopened.
  useEffect(() => {
    setSelected(defaultCurrency);
  }, [open, defaultCurrency]);

  const dirty = selected !== defaultCurrency;

  async function handleSave() {
    if (!accountId || !dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ default_currency: selected })
      .eq("id", accountId);
    if (error) {
      toast.error("Failed to save default currency");
      setSaving(false);
      return;
    }
    // Pull the new value back into the auth context so the deal form and
    // every total pick it up without a full reload.
    await refreshProfile();
    setSaving(false);
    toast.success("Default currency updated");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-popover border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-popover-foreground">
            <Coins className="size-4 text-primary" />
            Default currency
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            New deals default to this currency, and pipeline and dashboard
            totals are shown in it. Existing deals keep the currency they were
            saved with.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label className="text-muted-foreground">Currency</Label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!canEditSettings || profileLoading}
            className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
          {!canEditSettings && (
            <p className="text-xs text-muted-foreground">
              Only account admins can change the default currency.
            </p>
          )}
        </div>

        <DialogFooter className="bg-popover border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {canEditSettings ? "Cancel" : "Close"}
          </Button>
          {canEditSettings && (
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
