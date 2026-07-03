"use client";

import { Toaster } from "sonner";

export function ThemedToaster() {
  return (
    <Toaster
      theme="light"
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          border: "1px solid var(--border)",
          color: "var(--popover-foreground)",
        },
      }}
    />
  );
}
