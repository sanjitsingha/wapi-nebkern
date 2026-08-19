-- ============================================================
-- newsletter_subscribers.updated_at
--
-- The admin list wants a "last modified" column and the table had
-- nothing that could serve as one.
--
-- `unsubscribed_at` looks like a candidate but isn't: the status route
-- sets it on unsubscribe and CLEARS IT BACK TO NULL on resubscribe, so
-- anyone who has come back shows no date at all. It answers "when did
-- they leave", not "when did this row last change".
--
-- Backfilled from created_at rather than NOW() so existing rows read as
-- "untouched since signup", which is true of almost all of them. Using
-- NOW() would have stamped the entire list as modified at migration
-- time and thrown away the only ordering signal the old rows have.
-- ============================================================

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE newsletter_subscribers
   SET updated_at = COALESCE(unsubscribed_at, created_at)
 WHERE updated_at IS NULL;

ALTER TABLE newsletter_subscribers
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE newsletter_subscribers
  ALTER COLUMN updated_at SET NOT NULL;

-- Reuses the function defined in 001_initial_schema.sql.
DROP TRIGGER IF EXISTS set_updated_at ON newsletter_subscribers;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
