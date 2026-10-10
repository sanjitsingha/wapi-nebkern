-- ============================================================
-- Zoho CRM: one shared application instead of one per account.
--
-- 097 made client_id and client_secret NOT NULL because every customer
-- registered their own Zoho server-based application and pasted the
-- pair into Settings before they could connect. The reasoning there was
-- that Zoho is region-partitioned, so a client registered on .com is
-- unknown to .in — which is true, but Zoho's multi-DC support exists to
-- solve precisely that: one client works in every data centre, the
-- consent flow starts at accounts.zoho.com, and the callback names the
-- DC the user actually came from.
--
-- What that bought was a connect flow with no API console, no client
-- id, no secret and no region picker: press Connect, approve at Zoho,
-- done. The credentials now live in ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET
-- on the server.
--
-- ── Why the columns stay ──
--
-- Dropping them would break every connection made under the old design.
-- A refresh token is minted BY a particular OAuth client and can only
-- be refreshed by that same client, so an account that connected with
-- its own application must keep using its own credentials or its
-- connection dies at the next refresh. The code reads these columns
-- when they are populated and falls back to the platform app when they
-- are not, which lets old and new connections coexist with no
-- re-consent and no data migration.
--
-- So: nullable, not dropped. New rows simply leave them NULL.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zoho_connections'
  ) THEN
    ALTER TABLE zoho_connections ALTER COLUMN client_id     DROP NOT NULL;
    ALTER TABLE zoho_connections ALTER COLUMN client_secret DROP NOT NULL;

    COMMENT ON COLUMN zoho_connections.client_id IS
      'Legacy: the account''s OWN Zoho client, from when each customer registered one. NULL on connections made through the platform app (ZOHO_CLIENT_ID). Kept because a refresh token can only be refreshed by the client that minted it.';
    COMMENT ON COLUMN zoho_connections.client_secret IS
      'Legacy, app-encrypted. See client_id.';
  END IF;
END $$;
