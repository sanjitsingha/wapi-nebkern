import { useEffect, useState } from 'react';

export interface WaPhoneInfo {
  verified_name?: string;
  display_phone_number?: string;
}

/**
 * The connected WhatsApp Business phone's identity, straight from the
 * Meta Graph API (via /api/whatsapp/config, which calls verifyPhoneNumber).
 * Returns null until the config loads or if WhatsApp isn't connected —
 * callers should fall back to a generic label in that case.
 */
export function useWhatsAppInfo() {
  const [info, setInfo] = useState<WaPhoneInfo | null>(null);

  useEffect(() => {
    fetch('/api/whatsapp/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.connected && data?.phone_info) {
          setInfo({
            verified_name: data.phone_info.verified_name,
            display_phone_number: data.phone_info.display_phone_number,
          });
        }
      })
      .catch(() => {});
  }, []);

  return info;
}
