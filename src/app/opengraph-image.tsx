import { ImageResponse } from 'next/og';

// ============================================================
// The link-preview image for every page that does not set its own —
// what WhatsApp, LinkedIn, X and Google show when a page is shared.
//
// Generated at build time from this component, in the site's WhatsApp
// palette: cream ground, ink type, the voltage-green pill. Blog posts
// with a cover image still use their cover (set in their metadata).
// Only glyphs the built-in font covers — no ₹ sign.
// ============================================================

export const alt = 'Instant — WhatsApp CRM & Marketing Automation by Nebkern Technology';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#fcf5eb',
          color: '#1c1e21',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: '#25d366',
              display: 'flex',
            }}
          />
          <div style={{ fontSize: 56, letterSpacing: -1 }}>instant</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 960 }}>
            Turn every WhatsApp conversation into revenue
          </div>
          <div style={{ fontSize: 32, color: '#5e5e5e' }}>
            Shared inbox, AI replies, campaigns and follow-ups on the official WhatsApp Business API.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              display: 'flex',
              padding: '14px 28px',
              borderRadius: 999,
              border: '2px solid #1c1e21',
              background: '#25d366',
              fontSize: 28,
            }}
          >
            instant.nebkern.com
          </div>
          <div style={{ fontSize: 28, color: '#5e5e5e' }}>by Nebkern Technology</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
