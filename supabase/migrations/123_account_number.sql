-- ============================================================
-- 123 — A short account ID for support.
--
-- Every account gets a permanent number (100001, 100002, …) that a
-- customer can read out or paste to the help desk, and that support
-- can search the admin by. The uuid stays the real key; this is only
-- the name people use.
--
-- Existing accounts are numbered oldest first. New ones take the next
-- number from the sequence. Nobody can change it afterwards: workspace
-- admins may update their account row (accounts_update), so a trigger
-- keeps the old value on every update.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS accounts_account_number_seq START WITH 100001;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number bigint;

UPDATE accounts a
SET account_number = 100000 + n.rn
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM accounts
) n
WHERE a.id = n.id
  AND a.account_number IS NULL;

-- Carry on after the highest number handed out (no-op on an empty table).
SELECT setval('accounts_account_number_seq', max(account_number))
FROM accounts
HAVING max(account_number) IS NOT NULL;

ALTER SEQUENCE accounts_account_number_seq OWNED BY accounts.account_number;
ALTER TABLE accounts
  ALTER COLUMN account_number SET DEFAULT nextval('accounts_account_number_seq'),
  ALTER COLUMN account_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_account_number_key'
  ) THEN
    ALTER TABLE accounts
      ADD CONSTRAINT accounts_account_number_key UNIQUE (account_number);
  END IF;
END;
$$;

-- Permanent: an update can't move it.
CREATE OR REPLACE FUNCTION accounts_keep_account_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.account_number := OLD.account_number;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_keep_account_number ON accounts;
CREATE TRIGGER accounts_keep_account_number
  BEFORE UPDATE OF account_number ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounts_keep_account_number();
