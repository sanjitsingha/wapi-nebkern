-- ============================================================
-- Record whether an event was filled in from the record it points at.
--
-- A Workflow Rule used to have to carry every field the automation
-- needed, added one at a time through Zoho's merge-field picker. Now
-- the receiver can read the record itself, so a rule can send an id and
-- a module and nothing else.
--
-- That fetch is deliberately soft: an unfetchable module, a deleted
-- record, an expired connection or a Zoho outage all leave the event
-- running on exactly what the webhook carried. Which is the problem
-- these columns solve — a silent improvement that silently stops is
-- indistinguishable from one that never ran, and the symptom is an
-- automation that used to branch on a field and now cannot see it.
--
-- `payload` stays the body AS RECEIVED, so it remains the honest
-- account of what the rule sent. These sit beside it rather than
-- changing it.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zoho_events'
  ) THEN
    ALTER TABLE zoho_events
      ADD COLUMN IF NOT EXISTS enriched boolean NOT NULL DEFAULT false;

    -- Null when enrichment succeeded, otherwise why it did not:
    -- no_record_id, module_not_fetchable, fetch_failed.
    ALTER TABLE zoho_events
      ADD COLUMN IF NOT EXISTS enrich_skipped text;

    COMMENT ON COLUMN zoho_events.enriched IS
      'True when the record was read back from Zoho and added fields the webhook did not carry.';
    COMMENT ON COLUMN zoho_events.enrich_skipped IS
      'Why the record was not read: no_record_id, module_not_fetchable, fetch_failed. NULL when it was.';
  END IF;
END $$;
