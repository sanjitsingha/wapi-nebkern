"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { PersonAvatar } from "@/components/ui/person-avatar";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const contactName = deal.contact?.name || deal.contact?.phone || null;
  const contactLabel = contactName ?? "No contact";
  const assigneeLabel = deal.assignee?.full_name || null;

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-border/50 bg-muted/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <h4 className="flex-1 text-sm font-semibold leading-snug text-foreground break-words">
          {deal.title}
        </h4>
        {deal.status === "won" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Check className="h-3 w-3" />
            Won
          </span>
        )}
        {deal.status === "lost" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
            <X className="h-3 w-3" />
            Lost
          </span>
        )}
      </div>

      {/* Contact row — seeded by contact id so the colour matches the
          same contact's avatar in the inbox and call history. */}
      <div className="mt-2 flex items-center gap-2">
        <PersonAvatar
          name={contactName}
          avatarUrl={deal.contact?.avatar_url}
          seed={deal.contact?.id || contactName}
        />
        <span className="truncate text-xs text-muted-foreground">{contactLabel}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formatDate(deal.expected_close_date)}
          </span>
        )}
      </div>

      {/* Assignee — right-aligned, so the avatar keeps the far-right
          corner it had before the name sat next to it. Same circle as
          the contact row above, seeded by name to match the inbox
          assign control. */}
      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {assigneeLabel}
          </span>
          <PersonAvatar
            name={assigneeLabel}
            avatarUrl={deal.assignee?.avatar_url}
          />
        </div>
      )}
    </button>
  );
}
