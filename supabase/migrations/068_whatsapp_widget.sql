-- ============================================================
-- 068_whatsapp_widget.sql — embeddable WhatsApp chat widget
--
-- One configurable chat bubble per account, embedded on the
-- customer's own website via a one-line <script> tag. The loader is
-- served publicly from /widget.js?id=<public_key>, which reads this
-- row with the service-role client (RLS is bypassed there), so the
-- policies below only need to cover the dashboard's own access.
--
-- Design notes:
--   - `public_key` is the identifier that ends up in the customer's
--     page source. Deliberately NOT the account_id: it is rotatable,
--     so a widget embedded on a site you no longer control can be
--     killed without touching anything else, and it leaks no internal
--     tenancy id. It is not a credential — it grants read of exactly
--     this row's presentation fields and nothing more.
--   - `phone` is a SNAPSHOT of the account's connected WhatsApp
--     number, written by the settings page on save. It is not typed
--     by hand. Denormalized on purpose: the public loader is a hot
--     path on third-party sites, and resolving the live number means
--     decrypting a token and calling Meta — far too expensive to do
--     per widget load.
--   - `placement`, not `position`: POSITION is a SQL function, and an
--     unquoted column of that name is a footgun in later migrations.
--   - Text defaults are the same strings the settings UI seeds, so a
--     row inserted by hand still renders a sane widget.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS whatsapp_widgets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  public_key              TEXT NOT NULL UNIQUE,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Master switch. Disabled serves a no-op script rather than a 404,
  -- so a still-embedded snippet degrades to nothing instead of a
  -- console error on the customer's site.
  enabled                 BOOLEAN NOT NULL DEFAULT true,

  -- Destination (snapshot of the connected number — see notes above).
  phone                   TEXT,
  prefilled_message       TEXT NOT NULL DEFAULT '',

  -- Presentation
  business_name           TEXT NOT NULL DEFAULT '',
  tagline                 TEXT NOT NULL DEFAULT 'Typically replies within minutes',
  greeting                TEXT NOT NULL DEFAULT 'Hi there! How can we help you today?',
  brand_color             TEXT NOT NULL DEFAULT '#25D366',
  placement               TEXT NOT NULL DEFAULT 'right' CHECK (placement IN ('left', 'right')),

  -- Behaviour. NULL delay means "never auto-open" — 0 would be
  -- ambiguous with "open immediately".
  auto_open_delay_seconds INTEGER CHECK (auto_open_delay_seconds IS NULL OR auto_open_delay_seconds BETWEEN 0 AND 300),
  show_on_mobile          BOOLEAN NOT NULL DEFAULT true,
  show_on_desktop         BOOLEAN NOT NULL DEFAULT true,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The public loader's only lookup.
CREATE INDEX IF NOT EXISTS idx_whatsapp_widgets_public_key
  ON whatsapp_widgets (public_key);

ALTER TABLE whatsapp_widgets ENABLE ROW LEVEL SECURITY;

-- Any member can read the config (the settings page renders it);
-- admin+ to change it, matching messenger_config / instagram_config.
DROP POLICY IF EXISTS whatsapp_widgets_select ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_select ON whatsapp_widgets FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS whatsapp_widgets_insert ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_insert ON whatsapp_widgets FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_widgets_update ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_update ON whatsapp_widgets FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS whatsapp_widgets_delete ON whatsapp_widgets;
CREATE POLICY whatsapp_widgets_delete ON whatsapp_widgets FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_widgets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
