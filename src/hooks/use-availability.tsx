"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Manual availability toggle, surfaced in the account menu. When the
// member sets themselves Unavailable, the presence heartbeat reports
// 'offline' (instead of online/away) so teammates see them offline even
// though the tab is still open. Persisted locally so the choice survives
// reloads — it is per-device, like the sidebar collapse preference.
const STORAGE_KEY = "wacrm.availability";

interface AvailabilityContextValue {
  /** true = Available (online/away), false = Unavailable (offline). */
  available: boolean;
  setAvailable: (value: boolean) => void;
}

const AvailabilityContext = createContext<AvailabilityContextValue | undefined>(
  undefined,
);

export function AvailabilityProvider({ children }: { children: ReactNode }) {
  // Default Available. Hydrate the persisted choice in an effect (not a
  // lazy initializer) so the server and first client render agree.
  const [available, setAvailableState] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "0") setAvailableState(false);
  }, []);

  const setAvailable = useCallback((value: boolean) => {
    setAvailableState(value);
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  }, []);

  const value = useMemo(
    () => ({ available, setAvailable }),
    [available, setAvailable],
  );

  return (
    <AvailabilityContext.Provider value={value}>
      {children}
    </AvailabilityContext.Provider>
  );
}

export function useAvailability(): AvailabilityContextValue {
  const ctx = useContext(AvailabilityContext);
  if (!ctx) {
    throw new Error("useAvailability must be used within an AvailabilityProvider");
  }
  return ctx;
}
