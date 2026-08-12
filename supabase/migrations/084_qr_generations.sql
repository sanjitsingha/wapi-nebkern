-- ============================================================
-- 084 — public QR generator log
--
-- WHAT THIS RECORDS
--
-- One row per code generated on the public /qr-generator tool: the
-- WhatsApp number it points at, the pre-filled message, and when. It
-- is a lead signal — someone typing their own business number into a
-- free WhatsApp tool is exactly the person this product is for.
--
-- WHY RLS IS ON WITH NO POLICIES
--
-- Same reasoning as migration 083. RLS enabled with zero policies
-- means anon and authenticated can do nothing: no select, no insert,
-- no update. Writes arrive through /api/qr/log, which runs on the
-- server, rate-limits per IP, and uses the service-role key — which
-- bypasses RLS. So the only path in is the one doing the throttling.
--
-- An anon INSERT policy would be worse than useless here: the anon key
-- ships in the client bundle by design, so anyone could POST unlimited
-- rows straight to Postgres and skip the rate limit entirely.
--
-- THIS IS PERSONAL DATA
--
-- A phone number belongs to a person. The tool's page says plainly
-- that the number is recorded (it used to claim the opposite, which
-- was true until this table existed), and the privacy policy lists it.
-- If that copy is ever reverted, this table has to go with it.
-- ============================================================

CREATE TABLE IF NOT EXISTS qr_generations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Normalized to digits only, exactly as it is encoded into the wa.me
  -- link — so what is stored is what the QR actually points at, not
  -- whatever spacing the visitor happened to type.
  phone      TEXT NOT NULL,

  -- The pre-filled message. Optional: an empty one is a valid code
  -- that just opens the chat, and that is worth knowing too.
  message    TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The admin list is "newest first", and nothing else queries this.
CREATE INDEX IF NOT EXISTS qr_generations_created_at_idx
  ON qr_generations (created_at DESC);

ALTER TABLE qr_generations ENABLE ROW LEVEL SECURITY;
